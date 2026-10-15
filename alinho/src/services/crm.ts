import { createId } from '../utils/id';
import {
  normalizeActivity,
  normalizeCompany,
  normalizeInteraction,
  normalizeLead,
} from '../models/normalize';
import type {
  Activity,
  Company,
  Dataset,
  Interaction,
  InteractionType,
  Lead,
  Stage,
} from '../models/types';

/** Record factories. Each returns a fully normalized record ready to persist. */

export type LeadDraft = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'dataset'>>;
export type CompanyDraft = Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'dataset'>>;
export type ActivityDraft = Partial<Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'dataset'>>;

export function buildLead(draft: LeadDraft, dataset: Dataset, fallbackStageId: string): Lead {
  const now = new Date().toISOString();
  return normalizeLead(
    {
      ...draft,
      id: createId(),
      stageId: draft.stageId || fallbackStageId,
      createdAt: now,
      updatedAt: now,
      dataset,
    },
    now,
  );
}

export function buildCompany(draft: CompanyDraft, dataset: Dataset): Company {
  const now = new Date().toISOString();
  return normalizeCompany(
    { ...draft, id: createId(), createdAt: now, updatedAt: now, dataset },
    now,
  );
}

export function buildActivity(draft: ActivityDraft, dataset: Dataset): Activity {
  const now = new Date().toISOString();
  return normalizeActivity(
    {
      ...draft,
      id: createId(),
      dueAt: draft.dueAt || now,
      createdAt: now,
      updatedAt: now,
      dataset,
    },
    now,
  );
}

export function buildInteraction(
  draft: {
    leadId?: string | null;
    companyId?: string | null;
    /** Quem registrou (modo equipe). */
    authorId?: string | null;
    type: InteractionType;
    description: string;
    occurredAt?: string | null;
    automatic?: boolean;
  },
  dataset: Dataset,
): Interaction {
  const now = new Date().toISOString();
  return normalizeInteraction(
    {
      id: createId(),
      authorId: draft.authorId ?? null,
      leadId: draft.leadId ?? null,
      companyId: draft.companyId ?? null,
      type: draft.type,
      description: draft.description,
      occurredAt: draft.occurredAt || now,
      automatic: draft.automatic ?? false,
      createdAt: now,
      dataset,
    },
    now,
  );
}

/* ----------------------------------------------------------------- stages --- */

export function findStage(stages: Stage[], stageId: string): Stage | undefined {
  return stages.find((stage) => stage.id === stageId);
}

export function stageName(stages: Stage[], stageId: string): string {
  return findStage(stages, stageId)?.name ?? 'Etapa removida';
}

export function openStages(stages: Stage[]): Stage[] {
  return stages.filter((stage) => stage.kind === 'aberta');
}

export function firstStageId(stages: Stage[]): string {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return sorted[0]?.id ?? 'novo';
}

export function wonStageIds(stages: Stage[]): Set<string> {
  return new Set(stages.filter((stage) => stage.kind === 'ganha').map((stage) => stage.id));
}

export function lostStageIds(stages: Stage[]): Set<string> {
  return new Set(stages.filter((stage) => stage.kind === 'perdida').map((stage) => stage.id));
}

/**
 * Applies a stage transition to a lead, keeping the won/lost timestamps and the
 * "last interaction" marker in sync.
 */
export function applyStageChange(lead: Lead, stages: Stage[], nextStageId: string): Lead {
  const now = new Date().toISOString();
  const next = findStage(stages, nextStageId);
  const kind = next?.kind ?? 'aberta';
  return {
    ...lead,
    stageId: nextStageId,
    updatedAt: now,
    lastInteractionAt: now,
    wonAt: kind === 'ganha' ? lead.wonAt ?? now : null,
    lostAt: kind === 'perdida' ? lead.lostAt ?? now : null,
  };
}
