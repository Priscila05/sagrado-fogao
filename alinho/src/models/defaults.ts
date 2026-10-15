import type { Settings, Stage } from './types';

export const APP_VERSION = '1.0.0';
export const BACKUP_VERSION = 1;

export const DEFAULT_STAGES: Stage[] = [
  { id: 'novo', name: 'Novo lead', order: 0, kind: 'aberta' },
  { id: 'primeiro-contato', name: 'Primeiro contato', order: 1, kind: 'aberta' },
  { id: 'contato-realizado', name: 'Contato realizado', order: 2, kind: 'aberta' },
  { id: 'interessado', name: 'Interessado', order: 3, kind: 'aberta' },
  { id: 'reuniao-agendada', name: 'Reunião agendada', order: 4, kind: 'aberta' },
  { id: 'proposta-enviada', name: 'Proposta enviada', order: 5, kind: 'aberta' },
  { id: 'negociacao', name: 'Negociação', order: 6, kind: 'aberta' },
  { id: 'ganho', name: 'Ganho', order: 7, kind: 'ganha', locked: true },
  { id: 'perdido', name: 'Perdido', order: 8, kind: 'perdida', locked: true },
];

export const DEFAULT_SOURCES = [
  'Prospecção ativa',
  'Indicação',
  'Instagram',
  'WhatsApp',
  'Site',
  'Google',
  'Evento',
  'Outro',
];

export const DEFAULT_SEGMENTS = [
  'Pet shop',
  'Restaurante',
  'Loja',
  'Prestador de serviços',
  'Beleza e estética',
  'Saúde',
  'Educação',
  'Outro',
];

export function createDefaultSettings(now = new Date().toISOString()): Settings {
  return {
    id: 'app',
    stages: DEFAULT_STAGES.map((stage) => ({ ...stage })),
    sources: [...DEFAULT_SOURCES],
    segments: [...DEFAULT_SEGMENTS],
    theme: 'system',
    lastBackupAt: null,
    activeDataset: 'real',
    demoSeeded: false,
    updatedAt: now,
  };
}
