import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Plus,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useData } from '../state/DataProvider';
import { computeDashboard } from '../services/metrics';
import { MetricTile } from '../components/shared/MetricTile';
import { AreaTrend } from '../components/charts/AreaTrend';
import { BarList } from '../components/charts/BarList';
import { Button } from '../components/ui/Button';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  PriorityDot,
} from '../components/ui/primitives';
import { LeadForm } from '../components/leads/LeadForm';
import { formatCurrencyShort, formatNumber, formatPercent } from '../utils/format';
import { formatDate, formatDateTime, isOverdue, relativeDayLabel } from '../utils/date';
import { ACTIVITY_TYPE_LABEL } from '../models/types';
import { stageName } from '../services/crm';

export function OverviewPage() {
  const { leads, activities, stages, dataset, counts, actions } = useData();
  const [formOpen, setFormOpen] = useState(false);

  const metrics = useMemo(
    () => computeDashboard(leads, activities, stages),
    [leads, activities, stages],
  );

  const isEmpty = leads.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Visão geral'}
        title="Bom acompanhamento começa aqui"
        description="Indicadores calculados a partir dos seus registros. Nada é estimado."
        actions={
          <>
            <Link to="/funil" className="focus-ring hidden rounded-md sm:block">
              <Button variant="secondary">Ver funil</Button>
            </Link>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setFormOpen(true)}
            >
              Novo lead
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <Panel>
          <EmptyState
            icon={UserPlus}
            title="Comece cadastrando seu primeiro lead"
            description="Assim que você registrar um contato, os indicadores, o funil e os relatórios passam a ser calculados automaticamente com dados reais."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setFormOpen(true)}
                >
                  Cadastrar lead
                </Button>
                {dataset === 'real' && counts.demo.leads === 0 ? (
                  <Button variant="secondary" onClick={() => void actions.seedDemo()}>
                    Explorar demonstração
                  </Button>
                ) : null}
              </div>
            }
          />
        </Panel>
      ) : (
        <>
          <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile
              label="Leads cadastrados"
              value={formatNumber(metrics.totalLeads)}
              hint={`${formatNumber(metrics.newLeads)} novos`}
              icon={Users}
              to="/leads"
            />
            <MetricTile
              label="Em andamento"
              value={formatNumber(metrics.openOpportunities)}
              hint={`${formatCurrencyShort(metrics.pipelineValue)} em potencial`}
              icon={TrendingUp}
              tone="accent"
              to="/funil"
            />
            <MetricTile
              label="Ganhas"
              value={formatNumber(metrics.wonOpportunities)}
              hint={`${formatCurrencyShort(metrics.wonValue)} fechados`}
              icon={Trophy}
              tone="positive"
            />
            <MetricTile
              label="Perdidas"
              value={formatNumber(metrics.lostOpportunities)}
              hint={
                metrics.wonOpportunities + metrics.lostOpportunities > 0
                  ? `Conversão de ${formatPercent(metrics.conversionRate)}`
                  : 'Sem oportunidades encerradas'
              }
              icon={XCircle}
              tone={metrics.lostOpportunities > 0 ? 'critical' : 'neutral'}
            />
          </section>

          <section aria-label="Indicadores de agenda" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile
              label="Atividades atrasadas"
              value={formatNumber(metrics.overdueActivities)}
              icon={BellRing}
              tone={metrics.overdueActivities > 0 ? 'critical' : 'neutral'}
              to="/atividades"
            />
            <MetricTile
              label="Programadas para hoje"
              value={formatNumber(metrics.todayActivities)}
              icon={CalendarClock}
              tone={metrics.todayActivities > 0 ? 'caution' : 'neutral'}
              to="/atividades"
            />
            <MetricTile
              label="Valor do funil"
              value={formatCurrencyShort(metrics.pipelineValue)}
              hint="Oportunidades abertas"
              icon={CircleDollarSign}
            />
            <MetricTile
              label="Taxa de conversão"
              value={
                metrics.wonOpportunities + metrics.lostOpportunities > 0
                  ? formatPercent(metrics.conversionRate)
                  : '—'
              }
              hint={
                metrics.wonOpportunities + metrics.lostOpportunities > 0
                  ? `${formatNumber(metrics.wonOpportunities)} de ${formatNumber(
                      metrics.wonOpportunities + metrics.lostOpportunities,
                    )} encerradas`
                  : 'Encerre uma oportunidade para calcular'
              }
              icon={Target}
            />
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2">
              <PanelHeader
                title="Evolução de leads"
                description="Novos cadastros nos últimos 30 dias"
              />
              <div className="px-4 py-4 sm:px-5">
                <AreaTrend
                  points={metrics.leadsOverTime.map((point) => ({
                    label: point.label,
                    value: point.count,
                  }))}
                  caption="Leads cadastrados por dia nos últimos 30 dias"
                />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Oportunidades por etapa" />
              <div className="px-4 py-4 sm:px-5">
                <BarList
                  items={metrics.stageDistribution
                    .filter((entry) => entry.count > 0)
                    .map((entry) => ({
                      label: entry.stage.name,
                      value: entry.count,
                      meta: entry.value > 0 ? formatCurrencyShort(entry.value) : undefined,
                    }))}
                  emptyLabel="Nenhuma oportunidade distribuída ainda."
                />
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel>
              <PanelHeader
                title="Próximas atividades"
                action={
                  <Link to="/atividades" className="focus-ring rounded-sm text-xs font-medium text-accent">
                    Ver todas
                  </Link>
                }
              />
              {metrics.upcomingActivities.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Agenda livre"
                  description="Crie um follow-up para não perder o próximo contato."
                  compact
                />
              ) : (
                <ul className="divide-y divide-line">
                  {metrics.upcomingActivities.map((activity) => {
                    const late = isOverdue(activity.dueAt);
                    const lead = leads.find((candidate) => candidate.id === activity.leadId);
                    return (
                      <li key={activity.id} className="px-4 py-3 sm:px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-ink">{activity.title}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {ACTIVITY_TYPE_LABEL[activity.type]} · {formatDateTime(activity.dueAt)}
                            </p>
                            {lead ? (
                              <Link
                                to={`/leads/${lead.id}`}
                                className="focus-ring mt-1 inline-block truncate rounded-sm text-xs font-medium text-accent"
                              >
                                {lead.establishmentName || lead.contactName}
                              </Link>
                            ) : null}
                          </div>
                          <Badge tone={late ? 'critical' : 'neutral'}>
                            {late ? 'Atrasada' : relativeDayLabel(activity.dueAt)}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHeader
                title="Leads que precisam de atenção"
                description="Sem interação recente ou com retorno vencido"
              />
              {metrics.leadsNeedingAttention.length === 0 ? (
                <EmptyState
                  icon={Clock3}
                  title="Tudo em dia"
                  description="Nenhum lead aberto está parado há mais de 7 dias."
                  compact
                />
              ) : (
                <ul className="divide-y divide-line">
                  {metrics.leadsNeedingAttention.map((lead) => (
                    <li key={lead.id}>
                      <Link
                        to={`/leads/${lead.id}`}
                        className="focus-ring flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-base font-medium text-ink">
                            <PriorityDot priority={lead.priority} />
                            {lead.establishmentName || lead.contactName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {stageName(stages, lead.stageId)} ·{' '}
                            {lead.lastInteractionAt
                              ? `última interação ${relativeDayLabel(lead.lastInteractionAt)}`
                              : 'sem interação registrada'}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Oportunidades recentes" />
              <ul className="divide-y divide-line">
                {metrics.recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="focus-ring flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-ink">
                          {lead.establishmentName || lead.contactName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {stageName(stages, lead.stageId)} · criado em {formatDate(lead.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-ink tnum">
                        {lead.potentialValue > 0 ? formatCurrencyShort(lead.potentialValue) : '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}

      <LeadForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
