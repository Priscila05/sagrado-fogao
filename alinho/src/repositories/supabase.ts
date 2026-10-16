import type { SupabaseClient } from '@supabase/supabase-js';
import { createDefaultSettings } from '../models/defaults';
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
import type { Activity, Company, Dataset, Interaction, Lead } from '../models/types';
import type { Contract, Expense, Payment } from '../models/finance';
import type {
  ActivityRepository,
  CollectionRepository,
  ExpenseRepository,
  InteractionRepository,
  LeadRepository,
  PaymentRepository,
  Repositories,
  SettingsRepository,
} from './types';

/**
 * Implementação remota dos repositórios, sobre o Supabase.
 *
 * Cumpre exatamente a mesma interface da implementação local, então páginas,
 * serviços e componentes não mudam. O que muda é de onde os dados vêm — e
 * quem pode vê-los, decidido pelo RLS no banco.
 *
 * O cliente nunca envia `org_id`: valores padrão e políticas no banco cuidam
 * disso. Da mesma forma, nenhuma consulta filtra por usuário: o RLS já entrega
 * apenas o que o papel pode enxergar.
 */

export interface RemoteContext {
  client: SupabaseClient;
  orgId: string;
  userId: string;
}

/* --------------------------------------------------------------- conversão --- */

const iso = (value: string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

type Row = Record<string, unknown>;

function rowToLead(row: Row): Lead {
  return normalizeLead({
    id: row.id,
    ownerId: row.owner_id,
    companyId: row.company_id,
    contactName: row.contact_name,
    establishmentName: row.establishment_name,
    segment: row.segment,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    instagram: row.instagram,
    website: row.website,
    neighborhood: row.neighborhood,
    city: row.city,
    source: row.source,
    stageId: row.stage_id,
    potentialValue: num(row.potential_value),
    priority: row.priority,
    notes: row.notes,
    lastInteractionAt: iso(row.last_interaction_at as string),
    nextContactAt: iso(row.next_contact_at as string),
    wonAt: iso(row.won_at as string),
    lostAt: iso(row.lost_at as string),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: 'real',
  });
}

function leadToRow(lead: Lead, context: RemoteContext): Row {
  return {
    id: lead.id,
    org_id: context.orgId,
    owner_id: lead.ownerId,
    company_id: lead.companyId,
    contact_name: lead.contactName,
    establishment_name: lead.establishmentName,
    segment: lead.segment,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    instagram: lead.instagram,
    website: lead.website,
    neighborhood: lead.neighborhood,
    city: lead.city,
    source: lead.source,
    stage_id: lead.stageId,
    potential_value: lead.potentialValue,
    priority: lead.priority,
    notes: lead.notes,
    last_interaction_at: lead.lastInteractionAt,
    next_contact_at: lead.nextContactAt,
    won_at: lead.wonAt,
    lost_at: lead.lostAt,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}

function rowToCompany(row: Row): Company {
  return normalizeCompany({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    segment: row.segment,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    instagram: row.instagram,
    website: row.website,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: 'real',
  });
}

function companyToRow(company: Company, context: RemoteContext): Row {
  return {
    id: company.id,
    org_id: context.orgId,
    owner_id: company.ownerId,
    name: company.name,
    segment: company.segment,
    phone: company.phone,
    whatsapp: company.whatsapp,
    email: company.email,
    address: company.address,
    neighborhood: company.neighborhood,
    city: company.city,
    instagram: company.instagram,
    website: company.website,
    notes: company.notes,
    status: company.status,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  };
}

function rowToActivity(row: Row): Activity {
  return normalizeActivity({
    id: row.id,
    ownerId: row.owner_id,
    leadId: row.lead_id,
    companyId: row.company_id,
    title: row.title,
    type: row.type,
    dueAt: row.due_at,
    priority: row.priority,
    notes: row.notes,
    done: row.done,
    doneAt: iso(row.done_at as string),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: 'real',
  });
}

function activityToRow(activity: Activity, context: RemoteContext): Row {
  return {
    id: activity.id,
    org_id: context.orgId,
    owner_id: activity.ownerId ?? context.userId,
    lead_id: activity.leadId,
    company_id: activity.companyId,
    title: activity.title,
    type: activity.type,
    due_at: activity.dueAt,
    priority: activity.priority,
    notes: activity.notes,
    done: activity.done,
    done_at: activity.doneAt,
    created_at: activity.createdAt,
    updated_at: activity.updatedAt,
  };
}

function rowToInteraction(row: Row): Interaction {
  return normalizeInteraction({
    id: row.id,
    authorId: row.author_id,
    leadId: row.lead_id,
    companyId: row.company_id,
    type: row.type,
    description: row.description,
    occurredAt: row.occurred_at,
    automatic: row.automatic,
    createdAt: row.created_at,
    dataset: 'real',
  });
}

function interactionToRow(interaction: Interaction, context: RemoteContext): Row {
  return {
    id: interaction.id,
    org_id: context.orgId,
    author_id: interaction.authorId ?? context.userId,
    lead_id: interaction.leadId,
    company_id: interaction.companyId,
    type: interaction.type,
    description: interaction.description,
    occurred_at: interaction.occurredAt,
    automatic: interaction.automatic,
    created_at: interaction.createdAt,
  };
}

function rowToContract(row: Row): Contract {
  return normalizeContract({
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    clientName: row.client_name,
    projectName: row.project_name,
    totalValue: num(row.total_value),
    signedAt: row.signed_at,
    description: row.description,
    status: row.status,
    downPayment: num(row.down_payment),
    installments: row.installments,
    firstDueAt: row.first_due_at,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: 'real',
  });
}

function contractToRow(contract: Contract, context: RemoteContext): Row {
  return {
    id: contract.id,
    org_id: context.orgId,
    company_id: contract.companyId,
    lead_id: contract.leadId,
    client_name: contract.clientName,
    project_name: contract.projectName,
    total_value: contract.totalValue,
    signed_at: contract.signedAt,
    description: contract.description,
    status: contract.status,
    down_payment: contract.downPayment,
    installments: contract.installments,
    first_due_at: contract.firstDueAt,
    payment_method: contract.paymentMethod,
    created_at: contract.createdAt,
    updated_at: contract.updatedAt,
  };
}

function rowToPayment(row: Row): Payment {
  return normalizePayment({
    id: row.id,
    contractId: row.contract_id,
    companyId: row.company_id,
    kind: row.kind,
    sequence: row.sequence,
    label: row.label,
    dueAt: row.due_at,
    amount: num(row.amount),
    paidAmount: num(row.paid_amount),
    paidAt: iso(row.paid_at as string),
    method: row.method,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: 'real',
  });
}

function paymentToRow(payment: Payment, context: RemoteContext): Row {
  return {
    id: payment.id,
    org_id: context.orgId,
    contract_id: payment.contractId,
    company_id: payment.companyId,
    kind: payment.kind,
    sequence: payment.sequence,
    label: payment.label,
    due_at: payment.dueAt,
    amount: payment.amount,
    paid_amount: payment.paidAmount,
    paid_at: payment.paidAt,
    method: payment.method,
    status: payment.status,
    notes: payment.notes,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  };
}

function rowToExpense(row: Row): Expense {
  return normalizeExpense({
    id: row.id,
    contractId: row.contract_id,
    description: row.description,
    category: row.category,
    amount: num(row.amount),
    spentAt: row.spent_at,
    status: row.status,
    paidAt: iso(row.paid_at as string),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: 'real',
  });
}

function expenseToRow(expense: Expense, context: RemoteContext): Row {
  return {
    id: expense.id,
    org_id: context.orgId,
    contract_id: expense.contractId,
    description: expense.description,
    category: expense.category,
    amount: expense.amount,
    spent_at: expense.spentAt,
    status: expense.status,
    paid_at: expense.paidAt,
    notes: expense.notes,
    created_at: expense.createdAt,
    updated_at: expense.updatedAt,
  };
}

/* ------------------------------------------------------------- utilitários --- */

/**
 * Erro vindo do banco da empresa: a mensagem é a versão legível, e `detalhe`
 * guarda a resposta crua do PostgREST. A versão legível serve para avisar a
 * pessoa; o detalhe é o que diz O QUE corrigir, e sem ele um "sem permissão"
 * não revela nem qual tabela recusou.
 */
export class ErroDoBanco extends Error {
  readonly detalhe: string;

  constructor(error: { message?: string; code?: string; details?: string; hint?: string } | null) {
    super(describeError(error));
    this.name = 'ErroDoBanco';
    this.detalhe =
      [error?.code, error?.message, error?.details, error?.hint]
        .filter((parte) => Boolean(parte))
        .join(' · ') || 'sem detalhe do banco';
  }
}

/** Mensagem legível para um erro do PostgREST, sem vazar detalhes internos. */
export function describeError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Erro desconhecido.';
  const code = error.code ?? '';
  if (code === '42501' || /row-level security/i.test(error.message ?? '')) {
    return 'Seu perfil não tem permissão para esta operação.';
  }
  if (code === '23505') return 'Já existe um registro com esses dados.';
  if (code === 'PGRST301' || code === '401') return 'Sua sessão expirou. Entre novamente.';
  return error.message ?? 'Não foi possível concluir a operação.';
}

/** Coleção genérica sobre uma tabela do Supabase. */
function createCollection<T extends { id: string }>(
  table: string,
  context: () => RemoteContext,
  toModel: (row: Row) => T,
  toRow: (model: T, ctx: RemoteContext) => Row,
): CollectionRepository<T> {
  const query = () => context().client.from(table);

  return {
    async list(_dataset?: Dataset) {
      const { data, error } = await query().select('*');
      if (error) throw new ErroDoBanco(error);
      return (data ?? []).map((row) => toModel(row as Row));
    },
    async get(id) {
      const { data, error } = await query().select('*').eq('id', id).maybeSingle();
      if (error) throw new ErroDoBanco(error);
      return data ? toModel(data as Row) : undefined;
    },
    async save(record) {
      const ctx = context();
      const { data, error } = await query()
        .upsert(toRow(record, ctx), { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw new ErroDoBanco(error);
      return toModel(data as Row);
    },
    async saveMany(records) {
      if (records.length === 0) return [];
      const ctx = context();
      const { data, error } = await query()
        .upsert(
          records.map((record) => toRow(record, ctx)),
          { onConflict: 'id' },
        )
        .select('*');
      if (error) throw new ErroDoBanco(error);
      return (data ?? []).map((row) => toModel(row as Row));
    },
    async remove(id) {
      const { error } = await query().delete().eq('id', id);
      if (error) throw new ErroDoBanco(error);
    },
    async removeMany(ids) {
      if (ids.length === 0) return;
      const { error } = await query().delete().in('id', ids);
      if (error) throw new ErroDoBanco(error);
    },
    async clear(_dataset) {
      // Remove tudo que o usuário atual pode remover — o RLS limita o alcance.
      const { error } = await query().delete().not('id', 'is', null);
      if (error) throw new ErroDoBanco(error);
    },
  };
}

/* ----------------------------------------------------------- repositórios --- */

export function createSupabaseRepositories(context: () => RemoteContext): Repositories {
  const leadsCollection = createCollection<Lead>('leads', context, rowToLead, leadToRow);
  const companiesCollection = createCollection<Company>(
    'companies',
    context,
    rowToCompany,
    companyToRow,
  );
  const activitiesCollection = createCollection<Activity>(
    'activities',
    context,
    rowToActivity,
    activityToRow,
  );
  const interactionsCollection = createCollection<Interaction>(
    'interactions',
    context,
    rowToInteraction,
    interactionToRow,
  );
  const contractsCollection = createCollection<Contract>(
    'contracts',
    context,
    rowToContract,
    contractToRow,
  );
  const paymentsCollection = createCollection<Payment>(
    'payments',
    context,
    rowToPayment,
    paymentToRow,
  );
  const expensesCollection = createCollection<Expense>(
    'expenses',
    context,
    rowToExpense,
    expenseToRow,
  );

  const listBy = async <T>(
    collection: CollectionRepository<T>,
    table: string,
    column: string,
    value: string,
    toModel: (row: Row) => T,
  ): Promise<T[]> => {
    void collection;
    const { data, error } = await context().client.from(table).select('*').eq(column, value);
    if (error) throw new ErroDoBanco(error);
    return (data ?? []).map((row) => toModel(row as Row));
  };

  const leads: LeadRepository = {
    ...leadsCollection,
    listByCompany: (companyId) =>
      listBy(leadsCollection, 'leads', 'company_id', companyId, rowToLead),
  };

  const activities: ActivityRepository = {
    ...activitiesCollection,
    listByLead: (leadId) =>
      listBy(activitiesCollection, 'activities', 'lead_id', leadId, rowToActivity),
    listByCompany: (companyId) =>
      listBy(activitiesCollection, 'activities', 'company_id', companyId, rowToActivity),
  };

  const interactions: InteractionRepository = {
    ...interactionsCollection,
    listByLead: (leadId) =>
      listBy(interactionsCollection, 'interactions', 'lead_id', leadId, rowToInteraction),
    listByCompany: (companyId) =>
      listBy(interactionsCollection, 'interactions', 'company_id', companyId, rowToInteraction),
  };

  const payments: PaymentRepository = {
    ...paymentsCollection,
    listByContract: (contractId) =>
      listBy(paymentsCollection, 'payments', 'contract_id', contractId, rowToPayment),
  };

  const expenses: ExpenseRepository = {
    ...expensesCollection,
    listByContract: (contractId) =>
      listBy(expensesCollection, 'expenses', 'contract_id', contractId, rowToExpense),
  };

  const settings: SettingsRepository = {
    async read() {
      const ctx = context();
      const { data, error } = await ctx.client
        .from('org_settings')
        .select('*')
        .eq('org_id', ctx.orgId)
        .maybeSingle();
      if (error) throw new ErroDoBanco(error);
      const fallback = createDefaultSettings();
      if (!data) return fallback;
      const row = data as Row;
      return normalizeSettings({
        id: 'app',
        stages: row.stages,
        sources: row.sources,
        segments: row.segments,
        expenseCategories: row.expense_categories,
        paymentMethods: row.payment_methods,
        // Tema e conjunto de dados são preferências locais de cada pessoa.
        theme: fallback.theme,
        activeDataset: 'real',
        demoSeeded: false,
        lastBackupAt: null,
        updatedAt: row.updated_at,
      });
    },
    async write(next) {
      const ctx = context();
      const normalized = normalizeSettings({ ...next, activeDataset: 'real', demoSeeded: false });
      const { error } = await ctx.client.from('org_settings').upsert(
        {
          org_id: ctx.orgId,
          stages: normalized.stages,
          sources: normalized.sources,
          segments: normalized.segments,
          expense_categories: normalized.expenseCategories,
          payment_methods: normalized.paymentMethods,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id' },
      );
      if (error) throw new ErroDoBanco(error);
      return normalized;
    },
  };

  return {
    leads,
    companies: companiesCollection,
    activities,
    interactions,
    contracts: contractsCollection,
    payments,
    expenses,
    settings,
    async replaceAll(payload) {
      // Importar backup sobre o banco compartilhado é operação de administrador
      // e o RLS recusa para os demais. A ordem respeita as chaves estrangeiras.
      await interactionsCollection.clear();
      await activitiesCollection.clear();
      await paymentsCollection.clear();
      await expensesCollection.clear();
      await contractsCollection.clear();
      await leadsCollection.clear();
      await companiesCollection.clear();

      await companiesCollection.saveMany(payload.companies);
      await leadsCollection.saveMany(payload.leads);
      await activitiesCollection.saveMany(payload.activities);
      await interactionsCollection.saveMany(payload.interactions);
      await contractsCollection.saveMany(payload.contracts);
      await paymentsCollection.saveMany(payload.payments);
      await expensesCollection.saveMany(payload.expenses);
      await settings.write(payload.settings);
    },
    async clearDataset(dataset) {
      // Não existe conjunto de demonstração no modo equipe.
      if (dataset === 'demo') return;
      await interactionsCollection.clear();
      await activitiesCollection.clear();
      await paymentsCollection.clear();
      await expensesCollection.clear();
      await contractsCollection.clear();
      await leadsCollection.clear();
      await companiesCollection.clear();
    },
  };
}
