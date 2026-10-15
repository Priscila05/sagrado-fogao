import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search } from 'lucide-react';
import { useData } from '../state/DataProvider';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Button } from '../components/ui/Button';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SegmentedControl,
} from '../components/ui/primitives';
import { CompanyForm } from '../components/companies/CompanyForm';
import { ContactIconLinks } from '../components/shared/ContactActions';
import { formatCurrencyShort, formatNumber, normalizeText } from '../utils/format';
import { COMPANY_STATUS_LABEL, type CompanyStatus } from '../models/types';
import { wonStageIds } from '../services/crm';

type StatusFilter = 'todos' | CompanyStatus;

const STATUS_TONE: Record<CompanyStatus, 'positive' | 'accent' | 'neutral'> = {
  cliente: 'positive',
  prospect: 'accent',
  inativo: 'neutral',
};

export function CompaniesPage() {
  const { companies, leads, stages, dataset } = useData();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [formOpen, setFormOpen] = useState(false);

  const won = useMemo(() => wonStageIds(stages), [stages]);

  const rows = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    return companies
      .filter((company) => {
        if (status !== 'todos' && company.status !== status) return false;
        if (!term) return true;
        return normalizeText(
          [company.name, company.segment, company.city, company.neighborhood, company.email].join(' '),
        ).includes(term);
      })
      .map((company) => {
        const companyLeads = leads.filter((lead) => lead.companyId === company.id);
        return {
          company,
          leadCount: companyLeads.length,
          wonCount: companyLeads.filter((lead) => won.has(lead.stageId)).length,
          value: companyLeads.reduce((total, lead) => total + lead.potentialValue, 0),
        };
      })
      .sort((a, b) => a.company.name.localeCompare(b.company.name, 'pt-BR'));
  }, [companies, leads, debouncedQuery, status, won]);

  const counts = useMemo(
    () => ({
      total: companies.length,
      clientes: companies.filter((company) => company.status === 'cliente').length,
      prospects: companies.filter((company) => company.status === 'prospect').length,
    }),
    [companies],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Base'}
        title="Empresas e clientes"
        description={`${formatNumber(counts.total)} cadastro(s) · ${formatNumber(
          counts.clientes,
        )} cliente(s) · ${formatNumber(counts.prospects)} prospect(s)`}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
            Nova empresa
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3 sm:px-4">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa, segmento ou cidade…"
              aria-label="Buscar empresas"
              className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <SegmentedControl
            label="Filtrar por situação"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'todos', label: 'Todas' },
              { value: 'prospect', label: 'Prospects' },
              { value: 'cliente', label: 'Clientes' },
              { value: 'inativo', label: 'Inativas' },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhuma empresa cadastrada"
              description="Cadastre empresas para agrupar contatos, oportunidades e histórico em um só lugar. Você também pode criar a empresa direto da página de um lead."
              action={
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                  Cadastrar empresa
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              description="Ajuste a busca ou o filtro de situação."
              compact
            />
          )
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ company, leadCount, wonCount, value }) => (
              <li key={company.id} className="flex items-start gap-3 px-4 py-3">
                <Link to={`/empresas/${company.id}`} className="focus-ring min-w-0 flex-1 rounded-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-medium text-ink">{company.name}</p>
                    <Badge tone={STATUS_TONE[company.status]}>
                      {COMPANY_STATUS_LABEL[company.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[company.segment, company.neighborhood, company.city]
                      .filter(Boolean)
                      .join(' · ') || 'Sem segmento ou cidade'}
                  </p>
                  <p className="mt-1 text-xs text-subtle tnum">
                    {formatNumber(leadCount)} lead(s)
                    {wonCount > 0 ? ` · ${formatNumber(wonCount)} ganha(s)` : ''}
                    {value > 0 ? ` · ${formatCurrencyShort(value)}` : ''}
                  </p>
                </Link>
                <ContactIconLinks contact={company} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <CompanyForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
