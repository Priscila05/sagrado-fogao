import {
  type Activity,
  type ActivityType,
  type Company,
  type CompanyStatus,
  type Dataset,
  type Interaction,
  type InteractionType,
  type Lead,
  type Priority,
  type Settings,
  type Stage,
  type StageKind,
} from './types';
import { createDefaultSettings, DEFAULT_STAGES } from './defaults';
import { createId, slugify } from '../utils/id';

/**
 * Coercion layer. Everything written to storage — whether typed by the user or
 * read from an imported file — passes through here, so records always match the
 * model and strings can never carry control characters or unbounded payloads.
 */

const MAX_SHORT = 200;
const MAX_LONG = 5000;

/** Strips control characters and clamps length. Never interprets markup. */
export function cleanString(value: unknown, max = MAX_SHORT): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const stripped = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return stripped.trim().slice(0, max);
}

export function cleanNotes(value: unknown): string {
  return cleanString(value, MAX_LONG);
}

export function cleanNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(value, 1_000_000_000));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(parsed, 1_000_000_000));
  }
  return fallback;
}

export function cleanBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return fallback;
}

/** Returns a valid ISO string or null. */
export function cleanIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function cleanIso(value: unknown, fallback = new Date().toISOString()): string {
  return cleanIsoOrNull(value) ?? fallback;
}

export function cleanId(value: unknown): string {
  const id = cleanString(value, 80);
  return /^[A-Za-z0-9._:-]{1,80}$/.test(id) ? id : createId();
}

export function cleanIdOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const id = cleanString(value, 80);
  return /^[A-Za-z0-9._:-]{1,80}$/.test(id) ? id : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const PRIORITIES: Priority[] = ['baixa', 'media', 'alta'];
const DATASETS: Dataset[] = ['real', 'demo'];
const STAGE_KINDS: StageKind[] = ['aberta', 'ganha', 'perdida'];
const COMPANY_STATUSES: CompanyStatus[] = ['prospect', 'cliente', 'inativo'];
const ACTIVITY_TYPES: ActivityType[] = [
  'ligacao',
  'whatsapp',
  'reuniao',
  'proposta',
  'tarefa',
  'outro',
];
const INTERACTION_TYPES: InteractionType[] = [
  'ligacao_realizada',
  'nao_atendeu',
  'mensagem_enviada',
  'resposta_recebida',
  'reuniao',
  'proposta',
  'negociacao',
  'observacao',
  'sistema',
];

export function cleanPriority(value: unknown): Priority {
  return oneOf(value, PRIORITIES, 'media');
}

export function cleanDataset(value: unknown): Dataset {
  return oneOf(value, DATASETS, 'real');
}

/* ------------------------------------------------------------------- lead --- */

export function normalizeLead(input: unknown, now = new Date().toISOString()): Lead {
  const raw = (input ?? {}) as Record<string, unknown>;
  const createdAt = cleanIso(raw.createdAt, now);
  return {
    id: cleanId(raw.id),
    contactName: cleanString(raw.contactName),
    establishmentName: cleanString(raw.establishmentName),
    segment: cleanString(raw.segment, 80),
    phone: cleanString(raw.phone, 40),
    whatsapp: cleanString(raw.whatsapp, 40),
    email: cleanString(raw.email, 254),
    instagram: cleanString(raw.instagram, 120),
    website: cleanString(raw.website, 300),
    neighborhood: cleanString(raw.neighborhood, 120),
    city: cleanString(raw.city, 120),
    source: cleanString(raw.source, 80),
    stageId: cleanId(raw.stageId ?? DEFAULT_STAGES[0].id),
    potentialValue: cleanNumber(raw.potentialValue),
    priority: cleanPriority(raw.priority),
    companyId: cleanIdOrNull(raw.companyId),
    notes: cleanNotes(raw.notes),
    createdAt,
    updatedAt: cleanIso(raw.updatedAt, createdAt),
    lastInteractionAt: cleanIsoOrNull(raw.lastInteractionAt),
    nextContactAt: cleanIsoOrNull(raw.nextContactAt),
    wonAt: cleanIsoOrNull(raw.wonAt),
    lostAt: cleanIsoOrNull(raw.lostAt),
    dataset: cleanDataset(raw.dataset),
  };
}

/* ---------------------------------------------------------------- company --- */

export function normalizeCompany(input: unknown, now = new Date().toISOString()): Company {
  const raw = (input ?? {}) as Record<string, unknown>;
  const createdAt = cleanIso(raw.createdAt, now);
  return {
    id: cleanId(raw.id),
    name: cleanString(raw.name),
    segment: cleanString(raw.segment, 80),
    phone: cleanString(raw.phone, 40),
    whatsapp: cleanString(raw.whatsapp, 40),
    email: cleanString(raw.email, 254),
    address: cleanString(raw.address, 300),
    neighborhood: cleanString(raw.neighborhood, 120),
    city: cleanString(raw.city, 120),
    instagram: cleanString(raw.instagram, 120),
    website: cleanString(raw.website, 300),
    notes: cleanNotes(raw.notes),
    status: oneOf(raw.status, COMPANY_STATUSES, 'prospect'),
    createdAt,
    updatedAt: cleanIso(raw.updatedAt, createdAt),
    dataset: cleanDataset(raw.dataset),
  };
}

/* --------------------------------------------------------------- activity --- */

export function normalizeActivity(input: unknown, now = new Date().toISOString()): Activity {
  const raw = (input ?? {}) as Record<string, unknown>;
  const createdAt = cleanIso(raw.createdAt, now);
  const done = cleanBoolean(raw.done);
  return {
    id: cleanId(raw.id),
    title: cleanString(raw.title),
    type: oneOf(raw.type, ACTIVITY_TYPES, 'tarefa'),
    leadId: cleanIdOrNull(raw.leadId),
    companyId: cleanIdOrNull(raw.companyId),
    dueAt: cleanIso(raw.dueAt, now),
    priority: cleanPriority(raw.priority),
    notes: cleanNotes(raw.notes),
    done,
    doneAt: done ? cleanIsoOrNull(raw.doneAt) ?? now : null,
    createdAt,
    updatedAt: cleanIso(raw.updatedAt, createdAt),
    dataset: cleanDataset(raw.dataset),
  };
}

/* ------------------------------------------------------------ interaction --- */

export function normalizeInteraction(input: unknown, now = new Date().toISOString()): Interaction {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    id: cleanId(raw.id),
    leadId: cleanIdOrNull(raw.leadId),
    companyId: cleanIdOrNull(raw.companyId),
    type: oneOf(raw.type, INTERACTION_TYPES, 'observacao'),
    description: cleanNotes(raw.description),
    occurredAt: cleanIso(raw.occurredAt, now),
    automatic: cleanBoolean(raw.automatic),
    createdAt: cleanIso(raw.createdAt, now),
    dataset: cleanDataset(raw.dataset),
  };
}

/* --------------------------------------------------------------- settings --- */

export function normalizeStage(input: unknown, index: number): Stage {
  const raw = (input ?? {}) as Record<string, unknown>;
  const name = cleanString(raw.name, 60) || `Etapa ${index + 1}`;
  const id = cleanIdOrNull(raw.id) ?? slugify(name);
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : index;
  return {
    id,
    name,
    order,
    kind: oneOf(raw.kind, STAGE_KINDS, 'aberta'),
    locked: cleanBoolean(raw.locked),
  };
}

function uniqueStrings(values: unknown, max: number, limit = 60): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = cleanString(value, max);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

export function normalizeSettings(input: unknown): Settings {
  const fallback = createDefaultSettings();
  const raw = (input ?? {}) as Record<string, unknown>;

  let stages = Array.isArray(raw.stages)
    ? raw.stages.map((stage, index) => normalizeStage(stage, index))
    : [];
  // Deduplicate stage ids, then guarantee one won and one lost stage exist.
  const seenStageIds = new Set<string>();
  stages = stages.filter((stage) => {
    if (seenStageIds.has(stage.id)) return false;
    seenStageIds.add(stage.id);
    return true;
  });
  if (stages.length === 0) stages = fallback.stages;
  if (!stages.some((stage) => stage.kind === 'ganha')) {
    stages.push({ ...DEFAULT_STAGES[7], order: stages.length });
  }
  if (!stages.some((stage) => stage.kind === 'perdida')) {
    stages.push({ ...DEFAULT_STAGES[8], order: stages.length });
  }
  stages = stages
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => ({
      ...stage,
      order: index,
      locked: stage.kind !== 'aberta' ? true : false,
    }));

  const sources = uniqueStrings(raw.sources, 80);
  const segments = uniqueStrings(raw.segments, 80);

  return {
    id: 'app',
    stages,
    sources: sources.length ? sources : fallback.sources,
    segments: segments.length ? segments : fallback.segments,
    theme: oneOf(raw.theme, ['light', 'dark', 'system'] as const, 'system'),
    lastBackupAt: cleanIsoOrNull(raw.lastBackupAt),
    activeDataset: cleanDataset(raw.activeDataset),
    demoSeeded: cleanBoolean(raw.demoSeeded),
    updatedAt: cleanIso(raw.updatedAt),
  };
}
