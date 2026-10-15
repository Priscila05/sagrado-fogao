import { DB_NAME, DB_VERSION, STORES, migrate, type StoreName } from './schema';

/**
 * Storage abstraction. React components never talk to IndexedDB directly —
 * they go through repositories, which go through this backend. Swapping in a
 * remote backend later means implementing this interface only.
 */
export interface StorageBackend {
  readonly kind: 'indexeddb' | 'memory';
  getAll<T>(store: StoreName): Promise<T[]>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]>;
  put<T>(store: StoreName, value: T): Promise<void>;
  putMany<T>(store: StoreName, values: T[]): Promise<void>;
  remove(store: StoreName, key: string): Promise<void>;
  removeMany(store: StoreName, keys: string[]): Promise<void>;
  clear(store: StoreName): Promise<void>;
  clearAll(): Promise<void>;
}

/* --------------------------------------------------------------- indexeddb --- */

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha na operação de leitura'));
  });
}

class IndexedDbBackend implements StorageBackend {
  readonly kind = 'indexeddb' as const;

  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        migrate(request.result, event.oldVersion);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          // Another tab upgraded the schema: close so it is not blocked.
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Não foi possível abrir o banco local'));
      request.onblocked = () =>
        reject(new Error('Banco local bloqueado por outra aba do ALINHO'));
    }).catch((error) => {
      this.dbPromise = null;
      throw error;
    });
    return this.dbPromise;
  }

  private async withStore<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    run: (objectStore: IDBObjectStore) => Promise<T> | T,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(store, mode);
      } catch (error) {
        reject(error);
        return;
      }
      let result: T;
      let settled = false;
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      transaction.onerror = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('Falha ao gravar no banco local'));
        }
      };
      transaction.onabort = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('Operação cancelada pelo banco local'));
        }
      };
      Promise.resolve(run(transaction.objectStore(store)))
        .then((value) => {
          result = value;
        })
        .catch((error) => {
          settled = true;
          try {
            transaction.abort();
          } catch {
            /* already finished */
          }
          reject(error);
        });
    });
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return this.withStore(store, 'readonly', (objectStore) =>
      requestToPromise<T[]>(objectStore.getAll() as IDBRequest<T[]>),
    );
  }

  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.withStore(store, 'readonly', (objectStore) =>
      requestToPromise<T | undefined>(objectStore.get(key) as IDBRequest<T | undefined>),
    );
  }

  getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
    return this.withStore(store, 'readonly', (objectStore) =>
      requestToPromise<T[]>(objectStore.index(index).getAll(value) as IDBRequest<T[]>),
    );
  }

  put<T>(store: StoreName, value: T): Promise<void> {
    return this.withStore(store, 'readwrite', async (objectStore) => {
      await requestToPromise(objectStore.put(value as unknown as never));
    });
  }

  putMany<T>(store: StoreName, values: T[]): Promise<void> {
    if (values.length === 0) return Promise.resolve();
    return this.withStore(store, 'readwrite', async (objectStore) => {
      for (const value of values) {
        await requestToPromise(objectStore.put(value as unknown as never));
      }
    });
  }

  remove(store: StoreName, key: string): Promise<void> {
    return this.withStore(store, 'readwrite', async (objectStore) => {
      await requestToPromise(objectStore.delete(key));
    });
  }

  removeMany(store: StoreName, keys: string[]): Promise<void> {
    if (keys.length === 0) return Promise.resolve();
    return this.withStore(store, 'readwrite', async (objectStore) => {
      for (const key of keys) {
        await requestToPromise(objectStore.delete(key));
      }
    });
  }

  clear(store: StoreName): Promise<void> {
    return this.withStore(store, 'readwrite', async (objectStore) => {
      await requestToPromise(objectStore.clear());
    });
  }

  async clearAll(): Promise<void> {
    for (const store of STORES) {
      await this.clear(store.name);
    }
  }
}

/* ------------------------------------------------------------------ memory --- */

/**
 * Fallback used when IndexedDB is unavailable (private windows, blocked
 * storage). The app stays usable for the session; the interface warns that
 * nothing is being persisted.
 */
class MemoryBackend implements StorageBackend {
  readonly kind = 'memory' as const;

  private data = new Map<StoreName, Map<string, unknown>>();

  private table(store: StoreName): Map<string, unknown> {
    let table = this.data.get(store);
    if (!table) {
      table = new Map();
      this.data.set(store, table);
    }
    return table;
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return Array.from(this.table(store).values()).map((value) => structuredClone(value) as T);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const value = this.table(store).get(key);
    return value === undefined ? undefined : (structuredClone(value) as T);
  }

  async getAllByIndex<T>(store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
    const definition = STORES.find((candidate) => candidate.name === store);
    const keyPath = definition?.indexes.find((candidate) => candidate.name === index)?.keyPath;
    const all = await this.getAll<Record<string, unknown>>(store);
    if (!keyPath) return all as T[];
    return all.filter((row) => row[keyPath] === value) as T[];
  }

  async put<T>(store: StoreName, value: T): Promise<void> {
    const record = value as unknown as { id: string };
    this.table(store).set(record.id, structuredClone(value));
  }

  async putMany<T>(store: StoreName, values: T[]): Promise<void> {
    for (const value of values) await this.put(store, value);
  }

  async remove(store: StoreName, key: string): Promise<void> {
    this.table(store).delete(key);
  }

  async removeMany(store: StoreName, keys: string[]): Promise<void> {
    for (const key of keys) this.table(store).delete(key);
  }

  async clear(store: StoreName): Promise<void> {
    this.table(store).clear();
  }

  async clearAll(): Promise<void> {
    this.data.clear();
  }
}

/* ---------------------------------------------------------------- resolver --- */

let backendPromise: Promise<StorageBackend> | null = null;
let resolvedBackend: StorageBackend | null = null;

async function probeIndexedDb(): Promise<StorageBackend> {
  if (typeof indexedDB === 'undefined') {
    return new MemoryBackend();
  }
  const candidate = new IndexedDbBackend();
  try {
    // A real read proves the database can be opened in this context.
    await candidate.getAll('settings');
    return candidate;
  } catch (error) {
    console.warn('[alinho] IndexedDB indisponível, usando armazenamento temporário.', error);
    return new MemoryBackend();
  }
}

export function getBackend(): Promise<StorageBackend> {
  if (!backendPromise) {
    backendPromise = probeIndexedDb().then((backend) => {
      resolvedBackend = backend;
      return backend;
    });
  }
  return backendPromise;
}

/** Storage mode once resolved — drives the "not being saved" warning. */
export function backendKind(): 'indexeddb' | 'memory' | 'unknown' {
  return resolvedBackend ? resolvedBackend.kind : 'unknown';
}

/** Test seam: forget the resolved backend. */
export function resetBackend(): void {
  backendPromise = null;
  resolvedBackend = null;
}
