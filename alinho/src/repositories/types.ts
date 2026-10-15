import type {
  Activity,
  Company,
  Dataset,
  Interaction,
  Lead,
  Settings,
} from '../models/types';

/**
 * Repository contracts. Pages and hooks depend on these interfaces only, so a
 * future remote implementation (e.g. Supabase) can replace the local one
 * without touching the interface layer.
 */

export interface CollectionRepository<T> {
  list(dataset?: Dataset): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  save(record: T): Promise<T>;
  saveMany(records: T[]): Promise<T[]>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  clear(dataset?: Dataset): Promise<void>;
}

export interface LeadRepository extends CollectionRepository<Lead> {
  listByCompany(companyId: string): Promise<Lead[]>;
}

export interface ActivityRepository extends CollectionRepository<Activity> {
  listByLead(leadId: string): Promise<Activity[]>;
  listByCompany(companyId: string): Promise<Activity[]>;
}

export interface InteractionRepository extends CollectionRepository<Interaction> {
  listByLead(leadId: string): Promise<Interaction[]>;
  listByCompany(companyId: string): Promise<Interaction[]>;
}

export interface SettingsRepository {
  read(): Promise<Settings>;
  write(settings: Settings): Promise<Settings>;
}

export interface Repositories {
  leads: LeadRepository;
  companies: CollectionRepository<Company>;
  activities: ActivityRepository;
  interactions: InteractionRepository;
  settings: SettingsRepository;
  /** Replaces every collection atomically from a validated backup. */
  replaceAll(payload: {
    leads: Lead[];
    companies: Company[];
    activities: Activity[];
    interactions: Interaction[];
    settings: Settings;
  }): Promise<void>;
  /** Removes every record of a dataset (used by "remove demonstration data"). */
  clearDataset(dataset: Dataset): Promise<void>;
}
