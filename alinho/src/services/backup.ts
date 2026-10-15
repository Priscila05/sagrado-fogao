import { APP_VERSION, BACKUP_VERSION } from '../models/defaults';
import {
  normalizeActivity,
  normalizeCompany,
  normalizeContract,
  normalizeExpense,
  normalizeInteraction,
  normalizeLead,
  normalizePayment,
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
import type { Contract, Expense, Payment } from '../models/finance';

export interface BackupPayload {
  leads: Lead[];
  companies: Company[];
  activities: Activity[];
  interactions: Interaction[];
  contracts: Contract[];
  payments: Payment[];
  expenses: Expense[];
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
      contracts: payload.contracts.length,
      payments: payload.payments.length,
      expenses: payload.expenses.length,
    },
    data: {
      leads: payload.leads,
      companies: payload.companies,
      activities: payload.activities,
      interactions: payload.interactions,
      contracts: payload.contracts,
      payments: payload.payments,
      expenses: payload.expenses,
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
    contracts: number;
    payments: number;
    expenses: number;
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

  /**
   * Coleções do módulo financeiro. São opcionais de propósito: um backup da
   * versão 1 (anterior ao financeiro) continua válido e importa com o
   * financeiro vazio.
   */
  const rawContracts = Array.isArray(data.contracts) ? (data.contracts as unknown[]) : [];
  const rawPayments = Array.isArray(data.payments) ? (data.payments as unknown[]) : [];
  const rawExpenses = Array.isArray(data.expenses) ? (data.expenses as unknown[]) : [];

  const contracts = rawContracts.map((row) => {
    const contract = normalizeContract(row, now);
    if (contract.companyId && !companyIds.has(contract.companyId)) {
      warnings.push(
        `Contrato "${contract.projectName || contract.clientName}" citava uma empresa inexistente; o vínculo foi removido.`,
      );
      contract.companyId = null;
    }
    if (contract.leadId && !leadIds.has(contract.leadId)) contract.leadId = null;
    return contract;
  });
  const contractIds = new Set(contracts.map((contract) => contract.id));

  const payments = rawPayments.map((row) => {
    const payment = normalizePayment(row, now);
    if (payment.contractId && !contractIds.has(payment.contractId)) {
      warnings.push(
        `Pagamento "${payment.label}" citava um contrato inexistente; passou a ser um lançamento avulso.`,
      );
      payment.contractId = null;
      payment.kind = 'avulso';
    }
    if (payment.companyId && !companyIds.has(payment.companyId)) payment.companyId = null;
    return payment;
  });

  const expenses = rawExpenses.map((row) => {
    const expense = normalizeExpense(row, now);
    if (expense.contractId && !contractIds.has(expense.contractId)) {
      warnings.push(
        `Despesa "${expense.description}" citava um contrato inexistente; o vínculo foi removido.`,
      );
      expense.contractId = null;
    }
    return expense;
  });

  if (version < 2 && (rawContracts.length === 0 || rawPayments.length === 0)) {
    warnings.push(
      'Backup gerado antes do módulo financeiro: os dados do CRM foram importados e o financeiro começa vazio.',
    );
  }

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
    contracts: dedupe(contracts, 'contratos'),
    payments: dedupe(payments, 'pagamentos'),
    expenses: dedupe(expenses, 'despesas'),
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
      contracts: payload.contracts.length,
      payments: payload.payments.length,
      expenses: payload.expenses.length,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
      version,
    },
  };
}
