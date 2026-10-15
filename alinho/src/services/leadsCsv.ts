import { toCsv, parseCsv } from '../utils/csv';
import { formatDate } from '../utils/date';
import { normalizeText, parseCurrencyInput } from '../utils/format';
import type { Lead, Priority, Stage } from '../models/types';
import { stageName } from './crm';

/** Column set used for both lead export and lead import. */
export const LEAD_CSV_FIELDS = [
  { key: 'contactName', label: 'Contato' },
  { key: 'establishmentName', label: 'Estabelecimento' },
  { key: 'segment', label: 'Segmento' },
  { key: 'phone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'website', label: 'Site' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'source', label: 'Origem' },
  { key: 'stage', label: 'Etapa' },
  { key: 'potentialValue', label: 'Valor potencial' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'nextContactAt', label: 'Próximo contato' },
  { key: 'notes', label: 'Observações' },
] as const;

export type LeadCsvField = (typeof LEAD_CSV_FIELDS)[number]['key'];

export function leadsToCsv(leads: Lead[], stages: Stage[]): string {
  const headers = [
    ...LEAD_CSV_FIELDS.map((field) => field.label),
    'Criado em',
    'Última interação',
  ];
  const rows = leads.map((lead) => [
    lead.contactName,
    lead.establishmentName,
    lead.segment,
    lead.phone,
    lead.whatsapp,
    lead.email,
    lead.instagram,
    lead.website,
    lead.neighborhood,
    lead.city,
    lead.source,
    stageName(stages, lead.stageId),
    lead.potentialValue ? lead.potentialValue.toFixed(2).replace('.', ',') : '',
    lead.priority,
    lead.nextContactAt ? formatDate(lead.nextContactAt) : '',
    lead.notes,
    formatDate(lead.createdAt),
    lead.lastInteractionAt ? formatDate(lead.lastInteractionAt) : '',
  ]);
  return toCsv(headers, rows);
}

/* ------------------------------------------------------------------ import --- */

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  /** Suggested field for each column index ('' = ignore). */
  mapping: (LeadCsvField | '')[];
  totalRows: number;
}

const HEADER_HINTS: Record<LeadCsvField, string[]> = {
  contactName: ['contato', 'nome', 'responsavel', 'pessoa'],
  establishmentName: ['estabelecimento', 'empresa', 'negocio', 'loja', 'razao'],
  segment: ['segmento', 'ramo', 'categoria', 'nicho'],
  phone: ['telefone', 'fone', 'tel'],
  whatsapp: ['whatsapp', 'whats', 'celular', 'zap'],
  email: ['email', 'e-mail', 'mail'],
  instagram: ['instagram', 'insta', 'ig'],
  website: ['site', 'website', 'url', 'pagina'],
  neighborhood: ['bairro', 'regiao'],
  city: ['cidade', 'municipio'],
  source: ['origem', 'fonte', 'canal'],
  stage: ['etapa', 'estagio', 'status', 'funil'],
  potentialValue: ['valor', 'potencial', 'ticket', 'orcamento'],
  priority: ['prioridade'],
  nextContactAt: ['proximo contato', 'proximo', 'retorno', 'follow'],
  notes: ['observacoes', 'observacao', 'notas', 'obs', 'comentario'],
};

function guessField(header: string): LeadCsvField | '' {
  const normalized = normalizeText(header);
  if (!normalized) return '';
  for (const field of LEAD_CSV_FIELDS) {
    if (normalizeText(field.label) === normalized) return field.key;
  }
  for (const [field, hints] of Object.entries(HEADER_HINTS) as [LeadCsvField, string[]][]) {
    if (hints.some((hint) => normalized.includes(hint))) return field;
  }
  return '';
}

export function buildCsvPreview(text: string, maxPreviewRows = 5): CsvPreview {
  const { headers, rows } = parseCsv(text);
  return {
    headers,
    rows: rows.slice(0, maxPreviewRows),
    mapping: headers.map((header) => guessField(header)),
    totalRows: rows.length,
  };
}

export interface CsvImportResult {
  leads: Partial<Lead>[];
  skipped: number;
  issues: string[];
}

function parsePriority(raw: string): Priority {
  const value = normalizeText(raw);
  if (value.startsWith('alt')) return 'alta';
  if (value.startsWith('baix')) return 'baixa';
  return 'media';
}

/** Accepts dd/mm/yyyy and ISO dates. */
function parseLooseDate(raw: string): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  const br = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    const date = new Date(year, Number(br[2]) - 1, Number(br[1]), 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Converts mapped CSV rows into lead drafts. A row is skipped when it has
 * neither a contact nor an establishment name — there would be nothing to show.
 */
export function mapCsvRowsToLeads(
  preview: { headers: string[]; mapping: (LeadCsvField | '')[] },
  allRows: string[][],
  stages: Stage[],
): CsvImportResult {
  const issues: string[] = [];
  const leads: Partial<Lead>[] = [];
  let skipped = 0;

  const stageByName = new Map(stages.map((stage) => [normalizeText(stage.name), stage.id]));

  allRows.forEach((row, rowIndex) => {
    const draft: Record<string, unknown> = {};
    preview.mapping.forEach((field, columnIndex) => {
      if (!field) return;
      const raw = (row[columnIndex] ?? '').trim();
      if (!raw) return;
      switch (field) {
        case 'potentialValue':
          draft.potentialValue = parseCurrencyInput(raw);
          break;
        case 'priority':
          draft.priority = parsePriority(raw);
          break;
        case 'nextContactAt': {
          const iso = parseLooseDate(raw);
          if (iso) draft.nextContactAt = iso;
          else issues.push(`Linha ${rowIndex + 2}: data "${raw}" não reconhecida e ignorada.`);
          break;
        }
        case 'stage': {
          const stageId = stageByName.get(normalizeText(raw));
          if (stageId) draft.stageId = stageId;
          else issues.push(`Linha ${rowIndex + 2}: etapa "${raw}" não existe; o lead entrou na primeira etapa.`);
          break;
        }
        default:
          draft[field] = raw;
      }
    });

    const hasName =
      typeof draft.contactName === 'string' && draft.contactName.trim().length > 0;
    const hasEstablishment =
      typeof draft.establishmentName === 'string' && draft.establishmentName.trim().length > 0;

    if (!hasName && !hasEstablishment) {
      skipped += 1;
      return;
    }
    leads.push(draft as Partial<Lead>);
  });

  return { leads, skipped, issues: issues.slice(0, 12) };
}
