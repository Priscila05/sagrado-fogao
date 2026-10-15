/**
 * Domain model for ALINHO.
 *
 * Every persisted record carries `createdAt`/`updatedAt` as ISO 8601 strings and
 * a `dataset` marker so demonstration records can live beside real ones without
 * ever being mixed into counts, reports or backups.
 */

import type { Contract, Expense, Payment } from './finance';

export type ISODate = string;

/** Real user data vs. clearly-labelled demonstration data. */
export type Dataset = 'real' | 'demo';

export type Priority = 'baixa' | 'media' | 'alta';

export type StageKind = 'aberta' | 'ganha' | 'perdida';

export type CompanyStatus = 'prospect' | 'cliente' | 'inativo';

export type ActivityType =
  | 'ligacao'
  | 'whatsapp'
  | 'reuniao'
  | 'proposta'
  | 'tarefa'
  | 'outro';

export type InteractionType =
  | 'ligacao_realizada'
  | 'nao_atendeu'
  | 'mensagem_enviada'
  | 'resposta_recebida'
  | 'reuniao'
  | 'proposta'
  | 'negociacao'
  | 'observacao'
  | 'sistema';

export interface Stage {
  id: string;
  name: string;
  /** Sort order inside the pipeline, ascending. */
  order: number;
  kind: StageKind;
  /** Whether the stage may be removed in settings (seeded terminal stages may not). */
  locked?: boolean;
}

export interface Lead {
  id: string;
  contactName: string;
  establishmentName: string;
  segment: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  website: string;
  neighborhood: string;
  city: string;
  source: string;
  stageId: string;
  potentialValue: number;
  priority: Priority;
  companyId: string | null;
  notes: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  lastInteractionAt: ISODate | null;
  nextContactAt: ISODate | null;
  /** Set when the lead reaches a `ganha` stage. */
  wonAt: ISODate | null;
  /** Set when the lead reaches a `perdida` stage. */
  lostAt: ISODate | null;
  dataset: Dataset;
}

export interface Company {
  id: string;
  name: string;
  segment: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  instagram: string;
  website: string;
  notes: string;
  status: CompanyStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  dataset: Dataset;
}

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  leadId: string | null;
  companyId: string | null;
  /** Scheduled date and time. */
  dueAt: ISODate;
  priority: Priority;
  notes: string;
  done: boolean;
  doneAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  dataset: Dataset;
}

export interface Interaction {
  id: string;
  leadId: string | null;
  companyId: string | null;
  type: InteractionType;
  description: string;
  occurredAt: ISODate;
  /** True when recorded by the app itself (stage change, creation, conversion). */
  automatic: boolean;
  createdAt: ISODate;
  dataset: Dataset;
}

export interface Settings {
  id: 'app';
  stages: Stage[];
  sources: string[];
  segments: string[];
  /** Categorias oferecidas no cadastro de despesas. */
  expenseCategories: string[];
  /** Formas de pagamento oferecidas em contratos e parcelas. */
  paymentMethods: string[];
  theme: 'light' | 'dark' | 'system';
  lastBackupAt: ISODate | null;
  /** Which dataset the interface is currently showing. */
  activeDataset: Dataset;
  /** True once demonstration records have been generated. */
  demoSeeded: boolean;
  updatedAt: ISODate;
}

export type EntityName =
  | 'leads'
  | 'companies'
  | 'activities'
  | 'interactions'
  | 'contracts'
  | 'payments'
  | 'expenses';

export interface BackupFile {
  format: 'alinho-backup';
  version: number;
  exportedAt: ISODate;
  appVersion: string;
  counts: Record<EntityName, number>;
  data: {
    leads: Lead[];
    companies: Company[];
    activities: Activity[];
    interactions: Interaction[];
    /** Presentes a partir da versão 2 do formato. */
    contracts: Contract[];
    payments: Payment[];
    expenses: Expense[];
    settings: Settings;
  };
}

/* ---------------------------------------------------------------- labels --- */

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  alta: 0,
  media: 1,
  baixa: 2,
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  tarefa: 'Tarefa',
  outro: 'Outro',
};

export const INTERACTION_TYPE_LABEL: Record<InteractionType, string> = {
  ligacao_realizada: 'Ligação realizada',
  nao_atendeu: 'Não atendeu',
  mensagem_enviada: 'Mensagem enviada',
  resposta_recebida: 'Resposta recebida',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  observacao: 'Observação',
  sistema: 'Registro automático',
};

/** Interaction types the user can log by hand (system entries are excluded). */
export const MANUAL_INTERACTION_TYPES: InteractionType[] = [
  'ligacao_realizada',
  'nao_atendeu',
  'mensagem_enviada',
  'resposta_recebida',
  'reuniao',
  'proposta',
  'negociacao',
  'observacao',
];

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  prospect: 'Prospect',
  cliente: 'Cliente',
  inativo: 'Inativo',
};

export const STAGE_KIND_LABEL: Record<StageKind, string> = {
  aberta: 'Em andamento',
  ganha: 'Ganho',
  perdida: 'Perdido',
};
