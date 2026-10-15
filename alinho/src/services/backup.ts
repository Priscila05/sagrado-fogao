import { APP_VERSION, BACKUP_VERSION } from '../models/defaults';
import {
  normalizeActivity,
  normalizeCompany,
  normalizeInteraction,
  normalizeLead,
  normalizeSettings,
} from '../models/normalize';
import type {
  Activity,
  BackupFile,
  Company,
  Interaction,
  Lead,
  Settings,
} from '../models/types';

export interface BackupPayload {
  leads: Lead[];
  companies: Company[];
  activities: Activity[];
  interactions: Interaction[];
  settings: Settings;
}

export function buildBackup(payload: BackupPayload): BackupFile {
  return {
    format: 'alinho-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    counts: {
      leads: payload.leads.length,
      companies: payload.companies.length,
      activities: payload.activities.length,
      interactions: payload.interactions.length,
    },
    data: {
      leads: payload.leads,
      companies: payload.companies,
      activities: payload.activities,
      interactions: payload.interactions,
      settings: payload.settings,
    },
  };
}

export interface BackupReadResult {
  ok: boolean;
  /** Reason shown to the user when the file cannot be used. */
  error?: string;
  /** Non-blocking notes (dropped orphan links, trimmed records). */
  warnings: string[];
  payload?: BackupPayload;
  summary?: {
    leads: number;
    companies: number;
    activities: number;
    interactions: number;
    exportedAt: string | null;
    version: number;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and sanitizes a backup file. Rejects anything that is not an
 * ALINHO backup of a supported version; repairs what can be repaired and
 * reports the rest as warnings instead of importing broken relations.
 */
export function readBackup(text: string): BackupReadResult {
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.', warnings };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'Estrutura inesperada: o arquivo não contém um objeto.', warnings };
  }
  if (parsed.format !== 'alinho-backup') {
    return {
      ok: false,
      error: 'Este arquivo não é um backup do ALINHO (campo "format" ausente ou diferente).',
      warnings,
    };
  }
  const version = typeof parsed.version === 'number' ? parsed.version : NaN;
  if (!Number.isFinite(version)) {
    return { ok: false, error: 'O backup não informa a versão do formato.', warnings };
  }
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `O backup foi gerado por uma versão mais nova do ALINHO (formato ${version}). Atualize o aplicativo antes de importar.`,
      warnings,
    };
  }
  if (!isObject(parsed.data)) {
    return { ok: false, error: 'O backup não contém a seção "data".', warnings };
  }

  const data = parsed.data;
  const requiredArrays = ['leads', 'companies', 'activities', 'interactions'] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      return { ok: false, error: `A seção "${key}" está ausente ou não é uma lista.`, warnings };
    }
  }

  const now = new Date().toISOString();
  const settings = normalizeSettings(isObject(data.settings) ? data.settings : undefined);

  const companies = (data.companies as unknown[]).map((row) => normalizeCompany(row, now));
  const companyIds = new Set(companies.map((company) => company.id));
  const stageIds = new Set(settings.stages.map((stage) => stage.id));
  const firstStageId = [...settings.stages].sort((a, b) => a.order - b.order)[0]?.id ?? 'novo';

  const leads = (data.leads as unknown[]).map((row) => {
    const lead = normalizeLead(row, now);
    if (lead.companyId && !companyIds.has(lead.companyId)) {
      warnings.push(`Lead "${lead.establishmentName || lead.contactName}" citava uma empresa inexistente; o vínculo foi removido.`);
      lead.companyId = null;
    }
    if (!stageIds.has(lead.stageId)) {
      warnings.push(`Lead "${lead.establishmentName || lead.contactName}" estava em uma etapa inexistente; movido para "${firstStageId}".`);
      lead.stageId = firstStageId;
    }
    return lead;
  });
  const leadIds = new Set(leads.map((lead) => lead.id));

  const activities = (data.activities as unknown[]).map((row) => {
    const activity = normalizeActivity(row, now);
    if (activity.leadId && !leadIds.has(activity.leadId)) {
      warnings.push(`Atividade "${activity.title}" citava um lead inexistente; o vínculo foi removido.`);
      activity.leadId = null;
    }
    if (activity.companyId && !companyIds.has(activity.companyId)) {
      activity.companyId = null;
    }
    return activity;
  });

  const interactions = (data.interactions as unknown[])
    .map((row) => normalizeInteraction(row, now))
    .filter((interaction) => {
      if (interaction.leadId && !leadIds.has(interaction.leadId)) return false;
      if (interaction.companyId && !companyIds.has(interaction.companyId)) {
        interaction.companyId = null;
      }
      return Boolean(interaction.leadId || interaction.companyId);
    });

  const droppedInteractions = (data.interactions as unknown[]).length - interactions.length;
  if (droppedInteractions > 0) {
    warnings.push(
      `${droppedInteractions} registro(s) de histórico sem lead ou empresa correspondente foram descartados.`,
    );
  }

  // Duplicate ids inside a single collection would silently overwrite records.
  const dedupe = <T extends { id: string }>(rows: T[], label: string): T[] => {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) {
        warnings.push(`Identificador duplicado em ${label} foi ignorado.`);
        continue;
      }
      seen.add(row.id);
      unique.push(row);
    }
    return unique;
  };

  const payload: BackupPayload = {
    leads: dedupe(leads, 'leads'),
    companies: dedupe(companies, 'empresas'),
    activities: dedupe(activities, 'atividades'),
    interactions: dedupe(interactions, 'histórico'),
    settings,
  };

  return {
    ok: true,
    warnings,
    payload,
    summary: {
      leads: payload.leads.length,
      companies: payload.companies.length,
      activities: payload.activities.length,
      interactions: payload.interactions.length,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
      version,
    },
  };
}
