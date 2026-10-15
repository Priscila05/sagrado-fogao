import { getBackend } from '../db/backend';
import type { StoreName } from '../db/schema';
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
import type {
  Activity,
  Company,
  Dataset,
  Interaction,
  Lead,
  Settings,
} from '../models/types';
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

/** Shared CRUD implementation over the storage backend. */
function createCollection<T extends { id: string; dataset: Dataset }>(
  store: StoreName,
  normalize: (input: unknown) => T,
): CollectionRepository<T> {
  return {
    async list(dataset) {
      const backend = await getBackend();
      const rows = await backend.getAll<T>(store);
      const normalized = rows.map((row) => normalize(row));
      return dataset ? normalized.filter((row) => row.dataset === dataset) : normalized;
    },
    async get(id) {
      const backend = await getBackend();
      const row = await backend.get<T>(store, id);
      return row ? normalize(row) : undefined;
    },
    async save(record) {
      const backend = await getBackend();
      const normalized = normalize(record);
      await backend.put(store, normalized);
      return normalized;
    },
    async saveMany(records) {
      const backend = await getBackend();
      const normalized = records.map((record) => normalize(record));
      await backend.putMany(store, normalized);
      return normalized;
    },
    async remove(id) {
      const backend = await getBackend();
      await backend.remove(store, id);
    },
    async removeMany(ids) {
      const backend = await getBackend();
      await backend.removeMany(store, ids);
    },
    async clear(dataset) {
      const backend = await getBackend();
      if (!dataset) {
        await backend.clear(store);
        return;
      }
      const rows = await backend.getAll<T>(store);
      await backend.removeMany(
        store,
        rows.filter((row) => row.dataset === dataset).map((row) => row.id),
      );
    },
  };
}

const leadsCollection = createCollection<Lead>('leads', (input) => normalizeLead(input));
const companiesCollection = createCollection<Company>('companies', (input) =>
  normalizeCompany(input),
);
const activitiesCollection = createCollection<Activity>('activities', (input) =>
  normalizeActivity(input),
);
const interactionsCollection = createCollection<Interaction>('interactions', (input) =>
  normalizeInteraction(input),
);

const leads: LeadRepository = {
  ...leadsCollection,
  async listByCompany(companyId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Lead>('leads', 'by_company', companyId);
    return rows.map((row) => normalizeLead(row));
  },
};

const activities: ActivityRepository = {
  ...activitiesCollection,
  async listByLead(leadId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Activity>('activities', 'by_lead', leadId);
    return rows.map((row) => normalizeActivity(row));
  },
  async listByCompany(companyId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Activity>('activities', 'by_company', companyId);
    return rows.map((row) => normalizeActivity(row));
  },
};

const interactions: InteractionRepository = {
  ...interactionsCollection,
  async listByLead(leadId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Interaction>('interactions', 'by_lead', leadId);
    return rows.map((row) => normalizeInteraction(row));
  },
  async listByCompany(companyId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Interaction>(
      'interactions',
      'by_company',
      companyId,
    );
    return rows.map((row) => normalizeInteraction(row));
  },
};

const contractsCollection = createCollection<Contract>('contracts', (input) =>
  normalizeContract(input),
);
const paymentsCollection = createCollection<Payment>('payments', (input) =>
  normalizePayment(input),
);
const expensesCollection = createCollection<Expense>('expenses', (input) =>
  normalizeExpense(input),
);

const payments: PaymentRepository = {
  ...paymentsCollection,
  async listByContract(contractId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Payment>('payments', 'by_contract', contractId);
    return rows.map((row) => normalizePayment(row));
  },
};

const expenses: ExpenseRepository = {
  ...expensesCollection,
  async listByContract(contractId) {
    const backend = await getBackend();
    const rows = await backend.getAllByIndex<Expense>('expenses', 'by_contract', contractId);
    return rows.map((row) => normalizeExpense(row));
  },
};

const settings: SettingsRepository = {
  async read() {
    const backend = await getBackend();
    const stored = await backend.get<Settings>('settings', 'app');
    if (!stored) {
      const fresh = createDefaultSettings();
      await backend.put('settings', fresh);
      return fresh;
    }
    return normalizeSettings(stored);
  },
  async write(next) {
    const backend = await getBackend();
    const normalized = normalizeSettings({ ...next, updatedAt: new Date().toISOString() });
    await backend.put('settings', normalized);
    return normalized;
  },
};

export const localRepositories: Repositories = {
  leads,
  companies: companiesCollection,
  activities,
  interactions,
  contracts: contractsCollection,
  payments,
  expenses,
  settings,
  async replaceAll(payload) {
    const backend = await getBackend();
    await backend.clear('leads');
    await backend.clear('companies');
    await backend.clear('activities');
    await backend.clear('interactions');
    await backend.clear('contracts');
    await backend.clear('payments');
    await backend.clear('expenses');
    await backend.putMany('leads', payload.leads);
    await backend.putMany('companies', payload.companies);
    await backend.putMany('activities', payload.activities);
    await backend.putMany('interactions', payload.interactions);
    await backend.putMany('contracts', payload.contracts);
    await backend.putMany('payments', payload.payments);
    await backend.putMany('expenses', payload.expenses);
    await backend.put('settings', payload.settings);
  },
  async clearDataset(dataset) {
    await leadsCollection.clear(dataset);
    await companiesCollection.clear(dataset);
    await activitiesCollection.clear(dataset);
    await interactionsCollection.clear(dataset);
    await contractsCollection.clear(dataset);
    await paymentsCollection.clear(dataset);
    await expensesCollection.clear(dataset);
  },
};
