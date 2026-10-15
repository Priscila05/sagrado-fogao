export const DB_NAME = 'alinho';

/**
 * Local database version. Bump this and add a migration step in `migrate`
 * whenever stores or indexes change.
 */
export const DB_VERSION = 2;

export type StoreName =
  | 'leads'
  | 'companies'
  | 'activities'
  | 'interactions'
  | 'contracts'
  | 'payments'
  | 'expenses'
  | 'settings';

/** Lojas acrescentadas na versão 2 (módulo financeiro). */
const V2_STORES: StoreName[] = ['contracts', 'payments', 'expenses'];

interface IndexDefinition {
  name: string;
  keyPath: string;
}

interface StoreDefinition {
  name: StoreName;
  keyPath: string;
  indexes: IndexDefinition[];
}

export const STORES: StoreDefinition[] = [
  {
    name: 'leads',
    keyPath: 'id',
    indexes: [
      { name: 'by_stage', keyPath: 'stageId' },
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_company', keyPath: 'companyId' },
      { name: 'by_created', keyPath: 'createdAt' },
    ],
  },
  {
    name: 'companies',
    keyPath: 'id',
    indexes: [
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_status', keyPath: 'status' },
      { name: 'by_created', keyPath: 'createdAt' },
    ],
  },
  {
    name: 'activities',
    keyPath: 'id',
    indexes: [
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_lead', keyPath: 'leadId' },
      { name: 'by_company', keyPath: 'companyId' },
      { name: 'by_due', keyPath: 'dueAt' },
    ],
  },
  {
    name: 'interactions',
    keyPath: 'id',
    indexes: [
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_lead', keyPath: 'leadId' },
      { name: 'by_company', keyPath: 'companyId' },
      { name: 'by_occurred', keyPath: 'occurredAt' },
    ],
  },
  {
    name: 'contracts',
    keyPath: 'id',
    indexes: [
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_company', keyPath: 'companyId' },
      { name: 'by_status', keyPath: 'status' },
      { name: 'by_signed', keyPath: 'signedAt' },
    ],
  },
  {
    name: 'payments',
    keyPath: 'id',
    indexes: [
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_contract', keyPath: 'contractId' },
      { name: 'by_company', keyPath: 'companyId' },
      { name: 'by_due', keyPath: 'dueAt' },
      { name: 'by_status', keyPath: 'status' },
    ],
  },
  {
    name: 'expenses',
    keyPath: 'id',
    indexes: [
      { name: 'by_dataset', keyPath: 'dataset' },
      { name: 'by_contract', keyPath: 'contractId' },
      { name: 'by_category', keyPath: 'category' },
      { name: 'by_spent', keyPath: 'spentAt' },
    ],
  },
  { name: 'settings', keyPath: 'id', indexes: [] },
];

/**
 * Applies schema changes for every version step the browser is behind.
 * Steps must be additive: a user may upgrade from any older version.
 */
export function migrate(db: IDBDatabase, oldVersion: number): void {
  const create = (names: StoreName[]) => {
    for (const store of STORES) {
      if (!names.includes(store.name)) continue;
      if (db.objectStoreNames.contains(store.name)) continue;
      const objectStore = db.createObjectStore(store.name, { keyPath: store.keyPath });
      for (const index of store.indexes) {
        objectStore.createIndex(index.name, index.keyPath, { unique: false });
      }
    }
  };

  if (oldVersion < 1) {
    // Instalação nova (ou anterior a qualquer versão): cria o CRM.
    create(['leads', 'companies', 'activities', 'interactions', 'settings']);
  }
  if (oldVersion < 2) {
    // Módulo financeiro: só acrescenta lojas, nenhum dado existente é tocado.
    create(V2_STORES);
  }
  // Versões futuras: `if (oldVersion < 3) { ... }`
}
