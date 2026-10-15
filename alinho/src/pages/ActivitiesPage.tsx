import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useData } from '../state/DataProvider';
import { bucketActivities } from '../services/metrics';
import { Button } from '../components/ui/Button';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  PriorityBadge,
  SegmentedControl,
} from '../components/ui/primitives';
import { ActivityForm } from '../components/activities/ActivityForm';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatDateTime, formatWeekday, isOverdue, relativeDayLabel } from '../utils/date';
import { formatNumber } from '../utils/format';
import { ACTIVITY_TYPE_LABEL, type Activity, type ActivityType } from '../models/types';

type TypeFilter = 'todos' | ActivityType;

function ActivityRow({
  activity,
  leadName,
  companyName,
  onToggle,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  leadName?: string;
  companyName?: string;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const late = !activity.done && isOverdue(activity.dueAt);
  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/50 sm:px-5">
      <input
        type="checkbox"
        checked={activity.done}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={`${activity.done ? 'Reabrir' : 'Concluir'} ${activity.title}`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded-sm border-line-strong accent-[rgb(var(--c-accent))]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={`min-w-0 break-words text-base ${
              activity.done ? 'text-subtle line-through' : 'font-medium text-ink'
            }`}
          >
            {activity.title}
          </p>
          {late ? <Badge tone="critical">Atrasada</Badge> : null}
          {!activity.done && !late ? <PriorityBadge priority={activity.priority} /> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {ACTIVITY_TYPE_LABEL[activity.type]} · {formatDateTime(activity.dueAt)}
          {!activity.done ? ` · ${relativeDayLabel(activity.dueAt)}` : ''}
        </p>
        {leadName || companyName ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
            {leadName && activity.leadId ? (
              <Link to={`/leads/${activity.leadId}`} className="focus-ring rounded-sm text-accent">
                {leadName}
              </Link>
            ) : null}
            {companyName && activity.companyId ? (
              <Link
                to={`/empresas/${activity.companyId}`}
                className="focus-ring rounded-sm text-muted hover:text-ink"
              >
                {companyName}
              </Link>
            ) : null}
          </p>
        ) : null}
        {activity.notes ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-subtle">
            {activity.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-60">
        <Button variant="ghost" size="icon" aria-label="Editar atividade" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Excluir atividade" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export function ActivitiesPage() {
  const { activities, leads, companies, actions, dataset } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [toDelete, setToDelete] = useState<Activity | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [showDone, setShowDone] = useState(false);

  const filtered = useMemo(
    () =>
      typeFilter === 'todos'
        ? activities
        : activities.filter((activity) => activity.type === typeFilter),
    [activities, typeFilter],
  );

  const buckets = useMemo(() => bucketActivities(filtered), [filtered]);

  const leadName = (id: string | null) => {
    if (!id) return undefined;
    const lead = leads.find((candidate) => candidate.id === id);
    return lead ? lead.establishmentName || lead.contactName : undefined;
  };
  const companyName = (id: string | null) => {
    if (!id) return undefined;
    return companies.find((candidate) => candidate.id === id)?.name;
  };

  const renderList = (rows: Activity[]) => (
    <ul className="divide-y divide-line">
      {rows.map((activity) => (
        <ActivityRow
          key={activity.id}
          activity={activity}
          leadName={leadName(activity.leadId)}
          companyName={companyName(activity.companyId)}
          onToggle={(done) => void actions.setActivityDone(activity.id, done)}
          onEdit={() => {
            setEditing(activity);
            setFormOpen(true);
          }}
          onDelete={() => setToDelete(activity)}
        />
      ))}
    </ul>
  );

  const sections: {
    key: string;
    title: string;
    description?: string;
    rows: Activity[];
    tone: 'critical' | 'caution' | 'neutral';
  }[] = [
    {
      key: 'atrasadas',
      title: 'Atrasadas',
      description: 'Vencidas e ainda não concluídas',
      rows: buckets.overdue,
      tone: 'critical',
    },
    {
      key: 'hoje',
      title: `Hoje · ${formatWeekday(new Date())}`,
      rows: buckets.today,
      tone: 'caution',
    },
    { key: 'semana', title: 'Próximos 7 dias', rows: buckets.next7, tone: 'neutral' },
    { key: 'depois', title: 'Mais adiante', rows: buckets.later, tone: 'neutral' },
  ];

  const hasPending =
    buckets.overdue.length + buckets.today.length + buckets.next7.length + buckets.later.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Agenda'}
        title="Atividades e follow-ups"
        description="Lembretes aparecem aqui ao abrir o aplicativo. Não há notificações com o navegador fechado."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Nova atividade
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Tipo
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="todos">Todos</option>
              {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((value) => (
                <option key={value} value={value}>
                  {ACTIVITY_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <SegmentedControl
            label="Mostrar"
            value={showDone ? 'concluidas' : 'pendentes'}
            onChange={(value) => setShowDone(value === 'concluidas')}
            options={[
              { value: 'pendentes', label: 'Pendentes' },
              { value: 'concluidas', label: `Concluídas (${formatNumber(buckets.done.length)})` },
            ]}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-critical" aria-hidden="true" />
            {formatNumber(buckets.overdue.length)} atrasada(s)
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-caution" aria-hidden="true" />
            {formatNumber(buckets.today.length)} hoje
          </span>
        </div>
      </div>

      {showDone ? (
        <Panel>
          <PanelHeader
            title="Concluídas"
            description={`${formatNumber(buckets.done.length)} atividade(s) finalizada(s)`}
          />
          {buckets.done.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nada concluído ainda"
              description="As atividades finalizadas aparecem aqui com a data de conclusão."
              compact
            />
          ) : (
            renderList(buckets.done)
          )}
        </Panel>
      ) : !hasPending ? (
        <Panel>
          <EmptyState
            icon={CalendarCheck}
            title={activities.length === 0 ? 'Nenhuma atividade cadastrada' : 'Nenhuma atividade pendente'}
            description={
              activities.length === 0
                ? 'Agende ligações, mensagens e reuniões para não perder nenhum retorno.'
                : 'Tudo em dia por aqui. Crie um novo follow-up quando precisar.'
            }
            action={
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Nova atividade
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {sections
            .filter((section) => section.rows.length > 0)
            .map((section) => (
              <Panel key={section.key}>
                <PanelHeader
                  title={
                    <span className="flex items-center gap-2">
                      {section.title}
                      <Badge tone={section.tone === 'neutral' ? 'neutral' : section.tone}>
                        {formatNumber(section.rows.length)}
                      </Badge>
                    </span>
                  }
                  description={section.description}
                />
                {renderList(section.rows)}
              </Panel>
            ))}
        </div>
      )}

      <ActivityForm
        open={formOpen}
        activity={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir atividade"
        message={toDelete ? `Excluir "${toDelete.title}"?` : ''}
        detail="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (toDelete) await actions.deleteActivity(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
