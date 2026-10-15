export const DB_NAME = 'alinho';

/**
 * Local database version. Bump this and add a migration step in `migrate`
 * whenever stores or indexes change.
 */
export const DB_VERSION = 1;

export type StoreName = 'leads' | 'companies' | 'activities' | 'interactions' | 'settings';

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
  { name: 'settings', keyPath: 'id', indexes: [] },
];

/**
 * Applies schema changes for every version step the browser is behind.
 * Steps must be additive: a user may upgrade from any older version.
 */
export function migrate(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    for (const store of STORES) {
      const objectStore = db.objectStoreNames.contains(store.name)
        ? null
        : db.createObjectStore(store.name, { keyPath: store.keyPath });
      if (!objectStore) continue;
      for (const index of store.indexes) {
        objectStore.createIndex(index.name, index.keyPath, { unique: false });
      }
    }
  }
  // Future versions: `if (oldVersion < 2) { ... }`
}
