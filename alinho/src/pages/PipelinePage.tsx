import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  Workflow,
} from 'lucide-react';
import { useData } from '../state/DataProvider';
import { Button } from '../components/ui/Button';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PriorityBadge,
  PriorityDot,
  SegmentedControl,
  StageBadge,
} from '../components/ui/primitives';
import { LeadForm } from '../components/leads/LeadForm';
import { nextActivityForLead } from '../services/metrics';
import { formatCurrencyShort, formatNumber } from '../utils/format';
import { formatDateTime, isOverdue, relativeDayLabel } from '../utils/date';
import type { Lead, Stage } from '../models/types';

type ViewMode = 'kanban' | 'lista';

/** One opportunity card. Drag is an enhancement; the select is the real control. */
function OpportunityCard({
  lead,
  stages,
  nextActivityLabel,
  overdue,
  onStageChange,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  lead: Lead;
  stages: Stage[];
  nextActivityLabel: string | null;
  overdue: boolean;
  onStageChange: (stageId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const title = lead.establishmentName || lead.contactName || 'Lead sem nome';

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', lead.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={[
        'group rounded-md border border-line bg-surface p-3 shadow-subtle transition-all duration-150 ease-swift',
        'hover:border-line-strong hover:shadow-pop',
        dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-line-strong opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/leads/${lead.id}`}
            className="focus-ring block rounded-sm text-base font-medium leading-snug text-ink hover:text-accent"
          >
            {title}
          </Link>
          {lead.contactName && lead.establishmentName ? (
            <p className="mt-0.5 truncate text-xs text-muted">{lead.contactName}</p>
          ) : null}
        </div>
        <PriorityDot priority={lead.priority} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink tnum">
          {lead.potentialValue > 0 ? formatCurrencyShort(lead.potentialValue) : '—'}
        </span>
        {overdue ? (
          <Badge tone="critical" icon={AlertTriangle}>
            atrasada
          </Badge>
        ) : nextActivityLabel ? (
          <Badge tone="neutral" icon={CalendarClock}>
            {nextActivityLabel}
          </Badge>
        ) : null}
      </div>

      <label className="mt-2.5 block">
        <span className="sr-only">Mover {title} para outra etapa</span>
        <select
          value={lead.stageId}
          onChange={(event) => onStageChange(event.target.value)}
          className="h-7 w-full rounded-sm border border-line bg-canvas px-1.5 text-xs text-muted transition-colors hover:text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export function PipelinePage() {
  const { leads, stages, activities, actions, dataset } = useData();
  const [view, setView] = useState<ViewMode>('kanban');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formStageId, setFormStageId] = useState<string | undefined>();

  const columns = useMemo(
    () =>
      stages.map((stage) => {
        const stageLeads = leads
          .filter((lead) => lead.stageId === stage.id)
          .sort((a, b) => b.potentialValue - a.potentialValue);
        return {
          stage,
          leads: stageLeads,
          total: stageLeads.reduce((sum, lead) => sum + lead.potentialValue, 0),
        };
      }),
    [stages, leads],
  );

  const activityInfo = useMemo(() => {
    const map = new Map<string, { label: string; overdue: boolean }>();
    for (const lead of leads) {
      const next = nextActivityForLead(activities, lead.id);
      if (next) {
        map.set(lead.id, {
          label: relativeDayLabel(next.dueAt),
          overdue: isOverdue(next.dueAt),
        });
      }
    }
    return map;
  }, [leads, activities]);

  const handleDrop = (stageId: string) => {
    const leadId = draggingId;
    setDraggingId(null);
    setDropTarget(null);
    if (!leadId) return;
    const lead = leads.find((candidate) => candidate.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    void actions.changeLeadStage(leadId, stageId);
  };

  const openStageForm = (stageId: string) => {
    setFormStageId(stageId);
    setFormOpen(true);
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={dataset === 'demo' ? 'Demonstração' : 'Pipeline'}
          title="Funil de vendas"
          description="Acompanhe cada oportunidade por etapa."
        />
        <Panel>
          <EmptyState
            icon={Workflow}
            title="O funil está vazio"
            description="Cadastre um lead para vê-lo aparecer como oportunidade nas colunas do funil."
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                Cadastrar lead
              </Button>
            }
          />
        </Panel>
        <LeadForm open={formOpen} onClose={() => setFormOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Pipeline'}
        title="Funil de vendas"
        description="Arraste os cartões ou use o seletor de etapa em cada oportunidade."
        actions={
          <>
            <SegmentedControl
              label="Visualização do funil"
              value={view}
              onChange={setView}
              options={[
                { value: 'kanban', label: 'Kanban', icon: LayoutGrid },
                { value: 'lista', label: 'Lista', icon: List },
              ]}
            />
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setFormStageId(undefined);
                setFormOpen(true);
              }}
            >
              Novo lead
            </Button>
          </>
        }
      />

      {view === 'kanban' ? (
        <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-3">
            {columns.map((column) => (
              <section
                key={column.stage.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTarget(column.stage.id);
                }}
                onDragLeave={() => setDropTarget((current) => (current === column.stage.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(column.stage.id);
                }}
                className={[
                  'flex w-[17rem] shrink-0 flex-col rounded-lg border bg-canvas transition-colors duration-150',
                  dropTarget === column.stage.id
                    ? 'border-accent bg-accent-soft/40'
                    : 'border-line',
                ].join(' ')}
                aria-label={`Etapa ${column.stage.name}`}
              >
                <header className="flex items-start justify-between gap-2 border-b border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                      {column.stage.name}
                      <span className="rounded-sm bg-sunken px-1.5 py-0.5 text-2xs font-semibold text-muted tnum">
                        {formatNumber(column.leads.length)}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-2xs text-subtle tnum">
                      {column.total > 0 ? formatCurrencyShort(column.total) : 'sem valor'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openStageForm(column.stage.id)}
                    aria-label={`Adicionar lead em ${column.stage.name}`}
                    className="focus-ring rounded p-1 text-subtle transition-colors hover:bg-sunken hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </header>

                <div className="flex min-h-[7rem] flex-col gap-2 p-2">
                  {column.leads.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-subtle">
                      Nenhuma oportunidade nesta etapa.
                    </p>
                  ) : (
                    column.leads.map((lead) => {
                      const info = activityInfo.get(lead.id);
                      return (
                        <OpportunityCard
                          key={lead.id}
                          lead={lead}
                          stages={stages}
                          nextActivityLabel={info?.label ?? null}
                          overdue={info?.overdue ?? false}
                          dragging={draggingId === lead.id}
                          onDragStart={() => setDraggingId(lead.id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropTarget(null);
                          }}
                          onStageChange={(stageId) => void actions.changeLeadStage(lead.id, stageId)}
                        />
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <Panel>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-[0.05em] text-subtle">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Oportunidade</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Etapa</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Prioridade</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Valor</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Próxima atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads
                  .slice()
                  .sort((a, b) => {
                    const stageA = stages.find((stage) => stage.id === a.stageId)?.order ?? 0;
                    const stageB = stages.find((stage) => stage.id === b.stageId)?.order ?? 0;
                    return stageA - stageB || b.potentialValue - a.potentialValue;
                  })
                  .map((lead) => {
                    const next = nextActivityForLead(activities, lead.id);
                    return (
                      <tr key={lead.id} className="transition-colors hover:bg-sunken/60">
                        <td className="px-4 py-2.5">
                          <Link
                            to={`/leads/${lead.id}`}
                            className="focus-ring rounded-sm text-base font-medium text-ink hover:text-accent"
                          >
                            {lead.establishmentName || lead.contactName || 'Lead sem nome'}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <label className="sr-only" htmlFor={`stage-${lead.id}`}>
                            Etapa de {lead.establishmentName || lead.contactName}
                          </label>
                          <select
                            id={`stage-${lead.id}`}
                            value={lead.stageId}
                            onChange={(event) =>
                              void actions.changeLeadStage(lead.id, event.target.value)
                            }
                            className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          >
                            {stages.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <PriorityBadge priority={lead.priority} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                          {lead.potentialValue > 0 ? formatCurrencyShort(lead.potentialValue) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {next ? (
                            <span
                              className={isOverdue(next.dueAt) ? 'font-medium text-critical' : 'text-muted'}
                            >
                              {next.title} · {formatDateTime(next.dueAt)}
                            </span>
                          ) : (
                            <span className="text-subtle">sem atividade</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-subtle">
            {columns
              .filter((column) => column.leads.length > 0)
              .map((column) => (
                <span key={column.stage.id} className="flex items-center gap-1.5">
                  <StageBadge name={column.stage.name} kind={column.stage.kind} />
                  <span className="tnum">
                    {formatNumber(column.leads.length)} · {formatCurrencyShort(column.total)}
                  </span>
                </span>
              ))}
          </div>
        </Panel>
      )}

      <LeadForm
        open={formOpen}
        defaultStageId={formStageId}
        onClose={() => {
          setFormOpen(false);
          setFormStageId(undefined);
        }}
      />
    </div>
  );
}
