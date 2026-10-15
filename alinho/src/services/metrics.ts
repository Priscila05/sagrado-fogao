import { dayKey, eachDay, endOfDay, isBeforeToday, isOverdue, startOfDay, addDays } from '../utils/date';
import type { Activity, Interaction, Lead, Stage } from '../models/types';
import { lostStageIds, wonStageIds } from './crm';

export interface DashboardMetrics {
  totalLeads: number;
  newLeads: number;
  openOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  pipelineValue: number;
  wonValue: number;
  overdueActivities: number;
  todayActivities: number;
  conversionRate: number;
  leadsNeedingAttention: Lead[];
  upcomingActivities: Activity[];
  recentLeads: Lead[];
  stageDistribution: { stage: Stage; count: number; value: number }[];
  leadsOverTime: { label: string; date: string; count: number }[];
}

/** "New" means still in the first open stage or created in the last 7 days. */
function isNewLead(lead: Lead, firstStageId: string): boolean {
  if (lead.stageId === firstStageId) return true;
  const created = new Date(lead.createdAt).getTime();
  return Date.now() - created <= 7 * 86400000;
}

export function computeDashboard(
  leads: Lead[],
  activities: Activity[],
  stages: Stage[],
  options: { attentionDays?: number; timelineDays?: number } = {},
): DashboardMetrics {
  const won = wonStageIds(stages);
  const lost = lostStageIds(stages);
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const firstStageId = sortedStages[0]?.id ?? '';

  const openLeads = leads.filter((lead) => !won.has(lead.stageId) && !lost.has(lead.stageId));
  const wonLeads = leads.filter((lead) => won.has(lead.stageId));
  const lostLeads = leads.filter((lead) => lost.has(lead.stageId));

  const pipelineValue = openLeads.reduce((total, lead) => total + lead.potentialValue, 0);
  const wonValue = wonLeads.reduce((total, lead) => total + lead.potentialValue, 0);

  const closed = wonLeads.length + lostLeads.length;
  const conversionRate = closed > 0 ? (wonLeads.length / closed) * 100 : 0;

  const pending = activities.filter((activity) => !activity.done);
  const overdueActivities = pending.filter((activity) => isOverdue(activity.dueAt)).length;
  const now = Date.now();
  const todayEnd = endOfDay().getTime();
  const todayActivities = pending.filter((activity) => {
    const time = new Date(activity.dueAt).getTime();
    return time >= now && time <= todayEnd;
  }).length;

  const attentionDays = options.attentionDays ?? 7;
  const staleLimit = Date.now() - attentionDays * 86400000;
  const leadsNeedingAttention = openLeads
    .filter((lead) => {
      if (lead.nextContactAt && isBeforeToday(lead.nextContactAt)) return true;
      const reference = lead.lastInteractionAt ?? lead.createdAt;
      return new Date(reference).getTime() < staleLimit;
    })
    .sort((a, b) => {
      const aRef = new Date(a.lastInteractionAt ?? a.createdAt).getTime();
      const bRef = new Date(b.lastInteractionAt ?? b.createdAt).getTime();
      return aRef - bRef;
    })
    .slice(0, 6);

  const upcomingActivities = pending
    .slice()
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 6);

  const recentLeads = leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const stageDistribution = sortedStages.map((stage) => {
    const stageLeads = leads.filter((lead) => lead.stageId === stage.id);
    return {
      stage,
      count: stageLeads.length,
      value: stageLeads.reduce((total, lead) => total + lead.potentialValue, 0),
    };
  });

  const timelineDays = options.timelineDays ?? 30;
  const from = addDays(startOfDay(), -(timelineDays - 1));
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = dayKey(lead.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const leadsOverTime = eachDay(from, new Date()).map((day) => ({
    label: `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`,
    date: day.toISOString(),
    count: counts.get(dayKey(day)) ?? 0,
  }));

  return {
    totalLeads: leads.length,
    newLeads: leads.filter((lead) => isNewLead(lead, firstStageId)).length,
    openOpportunities: openLeads.length,
    wonOpportunities: wonLeads.length,
    lostOpportunities: lostLeads.length,
    pipelineValue,
    wonValue,
    overdueActivities,
    todayActivities,
    conversionRate,
    leadsNeedingAttention,
    upcomingActivities,
    recentLeads,
    stageDistribution,
    leadsOverTime,
  };
}

/* ------------------------------------------------------------- activities --- */

export interface ActivityBuckets {
  overdue: Activity[];
  today: Activity[];
  next7: Activity[];
  later: Activity[];
  done: Activity[];
}

export function bucketActivities(activities: Activity[]): ActivityBuckets {
  // "Late" is measured against the exact scheduled moment, so an activity due
  // earlier today is overdue — and never counted twice under "today".
  const now = Date.now();
  const todayEnd = endOfDay().getTime();
  const weekEnd = endOfDay(addDays(new Date(), 7)).getTime();

  const byDue = (a: Activity, b: Activity) =>
    new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();

  const overdue: Activity[] = [];
  const today: Activity[] = [];
  const next7: Activity[] = [];
  const later: Activity[] = [];
  const done: Activity[] = [];

  for (const activity of activities) {
    if (activity.done) {
      done.push(activity);
      continue;
    }
    const time = new Date(activity.dueAt).getTime();
    if (time < now) overdue.push(activity);
    else if (time <= todayEnd) today.push(activity);
    else if (time <= weekEnd) next7.push(activity);
    else later.push(activity);
  }

  return {
    overdue: overdue.sort(byDue),
    today: today.sort(byDue),
    next7: next7.sort(byDue),
    later: later.sort(byDue),
    done: done
      .slice()
      .sort(
        (a, b) =>
          new Date(b.doneAt ?? b.updatedAt).getTime() - new Date(a.doneAt ?? a.updatedAt).getTime(),
      ),
  };
}

/** Next pending activity for a lead, used on pipeline cards. */
export function nextActivityForLead(activities: Activity[], leadId: string): Activity | null {
  const pending = activities
    .filter((activity) => activity.leadId === leadId && !activity.done)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return pending[0] ?? null;
}

export function timelineForLead(interactions: Interaction[], leadId: string): Interaction[] {
  return interactions
    .filter((interaction) => interaction.leadId === leadId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}
