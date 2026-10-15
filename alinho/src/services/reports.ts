import { eachMonth, formatMonthLabel, monthKey, startOfDay, endOfDay } from '../utils/date';
import type { Activity, Lead, Stage } from '../models/types';
import { lostStageIds, wonStageIds } from './crm';

export interface Period {
  from: Date;
  to: Date;
}

export interface Breakdown {
  label: string;
  count: number;
  value: number;
}

export interface ReportData {
  period: Period;
  leadCount: number;
  bySource: Breakdown[];
  bySegment: Breakdown[];
  byStage: Breakdown[];
  byCity: Breakdown[];
  won: number;
  lost: number;
  open: number;
  wonValue: number;
  lostValue: number;
  openValue: number;
  conversionRate: number;
  averageTicket: number;
  activitiesDone: number;
  activitiesPending: number;
  activitiesByType: Breakdown[];
  timeline: { label: string; created: number; won: number; lost: number }[];
}

function inPeriod(iso: string | null, period: Period): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= startOfDay(period.from).getTime() && time <= endOfDay(period.to).getTime();
}

function groupBy(
  leads: Lead[],
  pick: (lead: Lead) => string,
  emptyLabel: string,
): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const lead of leads) {
    const label = pick(lead).trim() || emptyLabel;
    const current = map.get(label) ?? { label, count: 0, value: 0 };
    current.count += 1;
    current.value += lead.potentialValue;
    map.set(label, current);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || b.value - a.value);
}

export function buildReport(
  leads: Lead[],
  activities: Activity[],
  stages: Stage[],
  period: Period,
): ReportData {
  const won = wonStageIds(stages);
  const lost = lostStageIds(stages);

  const createdInPeriod = leads.filter((lead) => inPeriod(lead.createdAt, period));
  const wonInPeriod = leads.filter((lead) => won.has(lead.stageId) && inPeriod(lead.wonAt, period));
  const lostInPeriod = leads.filter(
    (lead) => lost.has(lead.stageId) && inPeriod(lead.lostAt, period),
  );
  const openNow = leads.filter((lead) => !won.has(lead.stageId) && !lost.has(lead.stageId));

  const closed = wonInPeriod.length + lostInPeriod.length;
  const wonValue = wonInPeriod.reduce((total, lead) => total + lead.potentialValue, 0);

  const stageOrder = [...stages].sort((a, b) => a.order - b.order);
  const byStage: Breakdown[] = stageOrder.map((stage) => {
    const stageLeads = createdInPeriod.filter((lead) => lead.stageId === stage.id);
    return {
      label: stage.name,
      count: stageLeads.length,
      value: stageLeads.reduce((total, lead) => total + lead.potentialValue, 0),
    };
  });

  const doneInPeriod = activities.filter((activity) => activity.done && inPeriod(activity.doneAt, period));
  const pendingInPeriod = activities.filter(
    (activity) => !activity.done && inPeriod(activity.dueAt, period),
  );

  const activityTypeLabels: Record<string, string> = {
    ligacao: 'Ligação',
    whatsapp: 'WhatsApp',
    reuniao: 'Reunião',
    proposta: 'Proposta',
    tarefa: 'Tarefa',
    outro: 'Outro',
  };
  const activitiesByTypeMap = new Map<string, Breakdown>();
  for (const activity of doneInPeriod) {
    const label = activityTypeLabels[activity.type] ?? activity.type;
    const current = activitiesByTypeMap.get(label) ?? { label, count: 0, value: 0 };
    current.count += 1;
    activitiesByTypeMap.set(label, current);
  }

  const months = eachMonth(period.from, period.to);
  const timeline = months.map((month) => {
    const key = monthKey(month);
    return {
      label: formatMonthLabel(month),
      created: leads.filter((lead) => monthKey(lead.createdAt) === key).length,
      won: leads.filter((lead) => lead.wonAt && monthKey(lead.wonAt) === key).length,
      lost: leads.filter((lead) => lead.lostAt && monthKey(lead.lostAt) === key).length,
    };
  });

  return {
    period,
    leadCount: createdInPeriod.length,
    bySource: groupBy(createdInPeriod, (lead) => lead.source, 'Sem origem'),
    bySegment: groupBy(createdInPeriod, (lead) => lead.segment, 'Sem segmento'),
    byStage,
    byCity: groupBy(createdInPeriod, (lead) => lead.city, 'Sem cidade'),
    won: wonInPeriod.length,
    lost: lostInPeriod.length,
    open: openNow.length,
    wonValue,
    lostValue: lostInPeriod.reduce((total, lead) => total + lead.potentialValue, 0),
    openValue: openNow.reduce((total, lead) => total + lead.potentialValue, 0),
    conversionRate: closed > 0 ? (wonInPeriod.length / closed) * 100 : 0,
    averageTicket: wonInPeriod.length > 0 ? wonValue / wonInPeriod.length : 0,
    activitiesDone: doneInPeriod.length,
    activitiesPending: pendingInPeriod.length,
    activitiesByType: Array.from(activitiesByTypeMap.values()).sort((a, b) => b.count - a.count),
    timeline,
  };
}

export type PeriodPresetId = '30d' | '90d' | 'ano' | 'tudo' | 'custom';

export const PERIOD_PRESETS: { id: PeriodPresetId; label: string }[] = [
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'ano', label: 'Este ano' },
  { id: 'tudo', label: 'Todo o período' },
  { id: 'custom', label: 'Personalizado' },
];

export function resolvePeriod(preset: PeriodPresetId, earliest: Date | null): Period {
  const now = new Date();
  switch (preset) {
    case '30d':
      return { from: new Date(now.getTime() - 29 * 86400000), to: now };
    case '90d':
      return { from: new Date(now.getTime() - 89 * 86400000), to: now };
    case 'ano':
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case 'tudo':
    default:
      return { from: earliest ?? new Date(now.getFullYear(), 0, 1), to: now };
  }
}
