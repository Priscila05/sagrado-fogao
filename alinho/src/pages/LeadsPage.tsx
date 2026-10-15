import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  CopyCheck,
  Download,
  Filter,
  Plus,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useData } from '../state/DataProvider';
import { useAuth } from '../auth/AuthProvider';
import { displayName } from '../auth/roles';
import { DistributeDialog } from '../components/leads/DistributeDialog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Button } from '../components/ui/Button';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PriorityBadge,
  StageBadge,
} from '../components/ui/primitives';
import { LeadForm } from '../components/leads/LeadForm';
import { ContactIconLinks } from '../components/shared/ContactActions';
import { LeadsCsvDialog } from '../components/leads/LeadsCsvDialog';
import { findDuplicateGroups } from '../services/duplicates';
import { leadsToCsv } from '../services/leadsCsv';
import { downloadTextFile, fileStamp } from '../utils/csv';
import { formatCurrencyShort, formatNumber, normalizeText, phoneDigits } from '../utils/format';
import { formatDate, relativeDayLabel } from '../utils/date';
import { PRIORITY_LABEL, PRIORITY_ORDER, type Lead, type Priority } from '../models/types';
import { useToast } from '../components/ui/Toast';

type SortKey = 'recentes' | 'antigos' | 'valor' | 'prioridade' | 'nome' | 'interacao';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigos', label: 'Mais antigos' },
  { value: 'valor', label: 'Maior valor' },
  { value: 'prioridade', label: 'Prioridade' },
  { value: 'nome', label: 'Nome (A–Z)' },
  { value: 'interacao', label: 'Interação mais antiga' },
];

export function LeadsPage() {
  const { leads, stages, settings, companies, dataset } = useData();
  const { mode, team, permissions } = useAuth();
  const canDistribute = mode === 'equipe' && permissions.assignLeads;
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [stageFilter, setStageFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('recentes');
  const [showFilters, setShowFilters] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [distributeOpen, setDistributeOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Deep links: /leads?novo=1 opens the form, ?focus=busca focuses the search.
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setEditing(null);
      setFormOpen(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get('focus') === 'busca') {
      searchRef.current?.focus();
      searchParams.delete('focus');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const duplicateGroups = useMemo(() => findDuplicateGroups(leads), [leads]);
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of duplicateGroups) {
      for (const lead of group.leads) ids.add(lead.id);
    }
    return ids;
  }, [duplicateGroups]);

  const filtered = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    const digits = term.replace(/\D/g, '');

    let rows = leads.filter((lead) => {
      if (stageFilter && lead.stageId !== stageFilter) return false;
      if (ownerFilter) {
        const owner = lead.ownerId ?? '';
        if (ownerFilter === 'sem-responsavel' ? owner !== '' : owner !== ownerFilter) return false;
      }
      if (priorityFilter && lead.priority !== priorityFilter) return false;
      if (sourceFilter && lead.source !== sourceFilter) return false;
      if (segmentFilter && lead.segment !== segmentFilter) return false;
      if (showDuplicates && !duplicateIds.has(lead.id)) return false;
      if (!term) return true;

      const haystack = normalizeText(
        [
          lead.contactName,
          lead.establishmentName,
          lead.email,
          lead.city,
          lead.neighborhood,
          lead.segment,
          lead.source,
          lead.notes,
        ].join(' '),
      );
      if (haystack.includes(term)) return true;
      if (digits.length >= 3) {
        return (
          phoneDigits(lead.phone).includes(digits) || phoneDigits(lead.whatsapp).includes(digits)
        );
      }
      return false;
    });

    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    rows = rows.slice().sort((a, b) => {
      switch (sort) {
        case 'antigos':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'valor':
          return b.potentialValue - a.potentialValue;
        case 'prioridade':
          return (
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            (stageOrder.get(b.stageId) ?? 0) - (stageOrder.get(a.stageId) ?? 0)
          );
        case 'nome':
          return (a.establishmentName || a.contactName).localeCompare(
            b.establishmentName || b.contactName,
            'pt-BR',
          );
        case 'interacao': {
          const aRef = new Date(a.lastInteractionAt ?? a.createdAt).getTime();
          const bRef = new Date(b.lastInteractionAt ?? b.createdAt).getTime();
          return aRef - bRef;
        }
        case 'recentes':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return rows;
  }, [
    leads,
    debouncedQuery,
    stageFilter,
    ownerFilter,
    priorityFilter,
    sourceFilter,
    segmentFilter,
    showDuplicates,
    duplicateIds,
    sort,
    stages,
  ]);

  const activeFilterCount =
    (ownerFilter ? 1 : 0) +
    (stageFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (sourceFilter ? 1 : 0) +
    (segmentFilter ? 1 : 0) +
    (showDuplicates ? 1 : 0);

  const clearFilters = () => {
    setOwnerFilter('');
    setStageFilter('');
    setPriorityFilter('');
    setSourceFilter('');
    setSegmentFilter('');
    setShowDuplicates(false);
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error('Nada para exportar', 'Nenhum lead corresponde aos filtros atuais.');
      return;
    }
    downloadTextFile(
      `alinho-leads_${fileStamp()}.csv`,
      leadsToCsv(filtered, stages),
      'text/csv',
    );
    toast.success(
      `${filtered.length} lead(s) exportado(s)`,
      'Arquivo CSV gerado no seu dispositivo.',
    );
  };

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  const selectClass =
    'h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Carteira'}
        title="Leads"
        description={`${formatNumber(leads.length)} lead(s) cadastrado(s) neste navegador.`}
        actions={
          <>
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setCsvOpen(true)}>
              Importar CSV
            </Button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExportCsv}>
              Exportar CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Novo lead
            </Button>
          </>
        }
      />

      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, estabelecimento, telefone, cidade…"
                aria-label="Buscar leads"
                className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <Button
              variant={showFilters || activeFilterCount > 0 ? 'subtle' : 'secondary'}
              icon={<Filter className="h-4 w-4" />}
              onClick={() => setShowFilters((current) => !current)}
              aria-expanded={showFilters}
            >
              Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowUpDown className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Ordenar</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Ordenar leads"
                className={selectClass}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {showFilters ? (
            <div className="flex flex-wrap items-end gap-2 animate-slide-up">
              <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                Etapa
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Todas</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                Prioridade
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as Priority | '')}
                  className={selectClass}
                >
                  <option value="">Todas</option>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => (
                    <option key={value} value={value}>
                      {PRIORITY_LABEL[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                Origem
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Todas</option>
                  {settings.sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                Segmento
                <select
                  value={segmentFilter}
                  onChange={(event) => setSegmentFilter(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Todos</option>
                  {settings.segments.map((segment) => (
                    <option key={segment} value={segment}>
                      {segment}
                    </option>
                  ))}
                </select>
              </label>
              {mode === 'equipe' ? (
                <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                  Responsável
                  <select
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                    className={selectClass}
                  >
                    <option value="">Todos</option>
                    <option value="sem-responsavel">Sem responsável</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {displayName(member)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {duplicateGroups.length > 0 ? (
                <Button
                  variant={showDuplicates ? 'subtle' : 'secondary'}
                  size="sm"
                  icon={<CopyCheck className="h-3.5 w-3.5" />}
                  onClick={() => setShowDuplicates((current) => !current)}
                >
                  Possíveis duplicados ({duplicateGroups.length})
                </Button>
              ) : null}
              {activeFilterCount > 0 ? (
                <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={clearFilters}>
                  Limpar
                </Button>
              ) : null}
            </div>
          ) : null}

          {canDistribute && selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-accent-soft px-3 py-2 animate-slide-up">
              <p className="text-sm font-medium text-accent-ink">
                {formatNumber(selected.size)} lead(s) selecionado(s)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                  onClick={() => setDistributeOpen(true)}
                >
                  Distribuir
                </Button>
              </div>
            </div>
          ) : null}

          {showDuplicates && duplicateGroups.length > 0 ? (
            <p className="rounded-md bg-caution-soft px-3 py-2 text-xs leading-relaxed text-caution-ink">
              Leads agrupados por telefone ou e-mail repetido. Negócios diferentes podem usar o mesmo
              número — nada é bloqueado nem mesclado automaticamente.
            </p>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          leads.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum lead cadastrado"
              description="Cadastre o primeiro contato para começar a acompanhar oportunidades."
              action={
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                  Cadastrar lead
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              description="Ajuste a busca ou limpe os filtros aplicados."
              action={
                <Button variant="secondary" onClick={() => { setQuery(''); clearFilters(); }}>
                  Limpar busca e filtros
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-[0.05em] text-subtle">
                    {canDistribute ? (
                      <th scope="col" className="w-9 px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os leads filtrados"
                          checked={filtered.length > 0 && selected.size === filtered.length}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? new Set(filtered.map((lead) => lead.id))
                                : new Set(),
                            )
                          }
                          className="h-4 w-4 cursor-pointer rounded-sm border-line-strong accent-[rgb(var(--c-accent))]"
                        />
                      </th>
                    ) : null}
                    <th scope="col" className="px-4 py-2.5 font-semibold">Estabelecimento</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Contato</th>
                    {mode === 'equipe' ? (
                      <th scope="col" className="px-4 py-2.5 font-semibold">Responsável</th>
                    ) : null}
                    <th scope="col" className="px-4 py-2.5 font-semibold">Etapa</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Prioridade</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Valor</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Última interação</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((lead) => {
                    const stage = stageById.get(lead.stageId);
                    const company = lead.companyId ? companyById.get(lead.companyId) : undefined;
                    return (
                      <tr key={lead.id} className="group transition-colors hover:bg-sunken/60">
                        {canDistribute ? (
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${lead.establishmentName || lead.contactName}`}
                              checked={selected.has(lead.id)}
                              onChange={(event) =>
                                setSelected((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(lead.id);
                                  else next.delete(lead.id);
                                  return next;
                                })
                              }
                              className="h-4 w-4 cursor-pointer rounded-sm border-line-strong accent-[rgb(var(--c-accent))]"
                            />
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="focus-ring rounded-sm text-base font-medium text-ink hover:text-accent"
                          >
                            {lead.establishmentName || lead.contactName || 'Lead sem nome'}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
                            {[lead.segment, lead.city].filter(Boolean).join(' · ') || 'Sem segmento'}
                            {duplicateIds.has(lead.id) ? (
                              <Badge tone="caution">possível duplicado</Badge>
                            ) : null}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-base text-ink">{lead.contactName || '—'}</p>
                          {company ? (
                            <Link
                              to={`/empresas/${company.id}`}
                              className="focus-ring mt-0.5 block rounded-sm text-xs text-accent"
                            >
                              {company.name}
                            </Link>
                          ) : null}
                        </td>
                        {mode === 'equipe' ? (
                          <td className="px-4 py-2.5 text-sm">
                            {lead.ownerId ? (
                              <span className="text-ink">
                                {displayName(
                                  team.find((member) => member.id === lead.ownerId) ?? {
                                    fullName: '',
                                    email: 'Fora da sua equipe',
                                  },
                                )}
                              </span>
                            ) : (
                              <Badge tone="caution">Sem responsável</Badge>
                            )}
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5">
                          {stage ? <StageBadge name={stage.name} kind={stage.kind} /> : <Badge>Etapa removida</Badge>}
                        </td>
                        <td className="px-4 py-2.5">
                          <PriorityBadge priority={lead.priority} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                          {lead.potentialValue > 0 ? formatCurrencyShort(lead.potentialValue) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted">
                          {lead.lastInteractionAt ? relativeDayLabel(lead.lastInteractionAt) : 'nunca'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <ContactIconLinks contact={lead} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(lead);
                                setFormOpen(true);
                              }}
                            >
                              Editar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <ul className="divide-y divide-line lg:hidden">
              {filtered.map((lead) => {
                const stage = stageById.get(lead.stageId);
                return (
                  <li key={lead.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/leads/${lead.id}`} className="focus-ring min-w-0 flex-1 rounded-sm">
                        <p className="truncate text-base font-medium text-ink">
                          {lead.establishmentName || lead.contactName || 'Lead sem nome'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {[lead.contactName, lead.city].filter(Boolean).join(' · ') || 'Sem contato'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {stage ? <StageBadge name={stage.name} kind={stage.kind} /> : null}
                          <PriorityBadge priority={lead.priority} />
                          {lead.potentialValue > 0 ? (
                            <span className="text-xs font-medium text-ink tnum">
                              {formatCurrencyShort(lead.potentialValue)}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                      <div className="flex flex-col items-end gap-1.5">
                        <ContactIconLinks contact={lead} />
                        <span className="text-2xs text-subtle">{formatDate(lead.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {filtered.length > 0 ? (
          <div className="border-t border-line px-4 py-2.5 text-xs text-subtle">
            Exibindo {formatNumber(filtered.length)} de {formatNumber(leads.length)} lead(s)
            {filtered.length > 0 ? (
              <>
                {' '}
                · valor somado{' '}
                <span className="font-medium text-muted tnum">
                  {formatCurrencyShort(
                    filtered.reduce((total, lead) => total + lead.potentialValue, 0),
                  )}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <LeadForm
        open={formOpen}
        lead={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <LeadsCsvDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
      <DistributeDialog
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
        leads={filtered.filter((lead) => selected.has(lead.id))}
        onDistributed={() => setSelected(new Set())}
      />
    </div>
  );
}
