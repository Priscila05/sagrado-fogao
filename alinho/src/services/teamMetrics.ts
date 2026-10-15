import type { Activity, Lead } from '../models/types';
import type { Stage } from '../models/types';
import { lostStageIds, wonStageIds } from './crm';
import { isOverdue, startOfDay, endOfDay } from '../utils/date';

/**
 * Desempenho individual, calculado a partir dos registros que o usuário atual
 * enxerga. O RLS já limita o conjunto; aqui apenas agrupamos por responsável.
 */

export interface MemberPerformance {
  memberId: string | null;
  leads: number;
  newLeads: number;
  open: number;
  won: number;
  lost: number;
  pipelineValue: number;
  wonValue: number;
  conversionRate: number;
  activitiesDone: number;
  activitiesPending: number;
  activitiesOverdue: number;
  activitiesToday: number;
  /** Data da interação mais recente registrada em um lead desta pessoa. */
  lastActivityAt: string | null;
}

export function emptyPerformance(memberId: string | null): MemberPerformance {
  return {
    memberId,
    leads: 0,
    newLeads: 0,
    open: 0,
    won: 0,
    lost: 0,
    pipelineValue: 0,
    wonValue: 0,
    conversionRate: 0,
    activitiesDone: 0,
    activitiesPending: 0,
    activitiesOverdue: 0,
    activitiesToday: 0,
    lastActivityAt: null,
  };
}

export function computeMemberPerformance(
  memberId: string | null,
  leads: Lead[],
  activities: Activity[],
  stages: Stage[],
  options: { newLeadDays?: number } = {},
): MemberPerformance {
  const won = wonStageIds(stages);
  const lost = lostStageIds(stages);
  const newLeadDays = options.newLeadDays ?? 7;
  const newLimit = Date.now() - newLeadDays * 86400000;

  const ownLeads = leads.filter((lead) => (lead.ownerId ?? null) === memberId);
  const ownActivities = activities.filter((activity) => (activity.ownerId ?? null) === memberId);

  const wonLeads = ownLeads.filter((lead) => won.has(lead.stageId));
  const lostLeads = ownLeads.filter((lead) => lost.has(lead.stageId));
  const openLeads = ownLeads.filter(
    (lead) => !won.has(lead.stageId) && !lost.has(lead.stageId),
  );
  const closed = wonLeads.length + lostLeads.length;

  const pending = ownActivities.filter((activity) => !activity.done);
  const now = Date.now();
  const todayEnd = endOfDay().getTime();

  const lastInteraction = ownLeads
    .map((lead) => lead.lastInteractionAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    memberId,
    leads: ownLeads.length,
    newLeads: ownLeads.filter((lead) => new Date(lead.createdAt).getTime() >= newLimit).length,
    open: openLeads.length,
    won: wonLeads.length,
    lost: lostLeads.length,
    pipelineValue: openLeads.reduce((total, lead) => total + lead.potentialValue, 0),
    wonValue: wonLeads.reduce((total, lead) => total + lead.potentialValue, 0),
    conversionRate: closed > 0 ? (wonLeads.length / closed) * 100 : 0,
    activitiesDone: ownActivities.filter((activity) => activity.done).length,
    activitiesPending: pending.length,
    activitiesOverdue: pending.filter((activity) => isOverdue(activity.dueAt)).length,
    activitiesToday: pending.filter((activity) => {
      const time = new Date(activity.dueAt).getTime();
      return time >= Math.max(now, startOfDay().getTime()) && time <= todayEnd;
    }).length,
    lastActivityAt: lastInteraction ?? null,
  };
}

/** Soma de várias linhas, para o rodapé do painel. */
export function sumPerformance(rows: MemberPerformance[]): MemberPerformance {
  const total = emptyPerformance(null);
  for (const row of rows) {
    total.leads += row.leads;
    total.newLeads += row.newLeads;
    total.open += row.open;
    total.won += row.won;
    total.lost += row.lost;
    total.pipelineValue += row.pipelineValue;
    total.wonValue += row.wonValue;
    total.activitiesDone += row.activitiesDone;
    total.activitiesPending += row.activitiesPending;
    total.activitiesOverdue += row.activitiesOverdue;
    total.activitiesToday += row.activitiesToday;
  }
  const closed = total.won + total.lost;
  total.conversionRate = closed > 0 ? (total.won / closed) * 100 : 0;
  return total;
}
