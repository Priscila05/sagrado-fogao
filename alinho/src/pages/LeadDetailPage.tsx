import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  History,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useData } from '../state/DataProvider';
import { Button } from '../components/ui/Button';
import {
  Badge,
  DataRow,
  EmptyState,
  Panel,
  PanelHeader,
  PriorityBadge,
  StageBadge,
} from '../components/ui/primitives';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LeadForm } from '../components/leads/LeadForm';
import { ActivityForm } from '../components/activities/ActivityForm';
import { InteractionDialog } from '../components/leads/InteractionDialog';
import { Timeline } from '../components/leads/Timeline';
import { ContactActions } from '../components/shared/ContactActions';
import { formatCurrency, formatPhone, initialsOf } from '../utils/format';
import { formatDate, formatDateTime, isOverdue, relativeDayLabel } from '../utils/date';
import { displayUrl, instagramHandle } from '../utils/links';
import { ACTIVITY_TYPE_LABEL, type Interaction } from '../models/types';
import { useToast } from '../components/ui/Toast';

export function LeadDetailPage() {
  const { leadId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { leads, companies, activities, interactions, stages, actions, saving } = useData();

  const lead = leads.find((candidate) => candidate.id === leadId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [interactionToDelete, setInteractionToDelete] = useState<Interaction | null>(null);

  const leadInteractions = useMemo(
    () =>
      interactions
        .filter((interaction) => interaction.leadId === leadId)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [interactions, leadId],
  );

  const leadActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.leadId === leadId)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [activities, leadId],
  );

  if (!lead) {
    return (
      <Panel>
        <EmptyState
          icon={ClipboardList}
          title="Lead não encontrado"
          description="Ele pode ter sido excluído ou pertencer ao outro conjunto de dados (real/demonstração)."
          action={
            <Link to="/leads" className="focus-ring rounded-md">
              <Button variant="primary">Voltar para os leads</Button>
            </Link>
          }
        />
      </Panel>
    );
  }

  const stage = stages.find((candidate) => candidate.id === lead.stageId);
  const company = lead.companyId
    ? companies.find((candidate) => candidate.id === lead.companyId)
    : undefined;
  const title = lead.establishmentName || lead.contactName || 'Lead sem nome';
  const isClosed = stage?.kind !== 'aberta';

  const handleDelete = async () => {
    const removed = await actions.deleteLead(lead.id);
    setDeleteOpen(false);
    if (removed) navigate('/leads', { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/leads"
          className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Leads
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-md font-semibold text-muted"
          >
            {initialsOf(lead.establishmentName, lead.contactName)}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {stage ? <StageBadge name={stage.name} kind={stage.kind} /> : <Badge>Etapa removida</Badge>}
              <PriorityBadge priority={lead.priority} />
              {lead.segment ? <Badge tone="outline">{lead.segment}</Badge> : null}
              {company ? (
                <Link to={`/empresas/${company.id}`} className="focus-ring rounded-sm">
                  <Badge tone="neutral" icon={Building2}>
                    {company.name}
                  </Badge>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button
            variant="secondary"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setDeleteOpen(true)}
          >
            Excluir
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Panel>
            <PanelHeader
              title="Ações de contato"
              description="Abrir um link não registra a interação — confirme depois o que realmente aconteceu."
            />
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              <ContactActions contact={lead} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  onClick={() => setInteractionOpen(true)}
                >
                  Registrar interação
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CalendarPlus className="h-3.5 w-3.5" />}
                  onClick={() => setActivityOpen(true)}
                >
                  Agendar follow-up
                </Button>
                {!company ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    onClick={() => void actions.createCompanyFromLead(lead.id)}
                    loading={saving}
                  >
                    Criar empresa
                  </Button>
                ) : null}
                {stage?.kind === 'ganha' && company?.status !== 'cliente' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<UserCheck className="h-3.5 w-3.5" />}
                    onClick={() => setConvertOpen(true)}
                  >
                    Transformar em cliente
                  </Button>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Informações" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
              <DataRow label="Contato">{lead.contactName || '—'}</DataRow>
              <DataRow label="Telefone">{lead.phone ? formatPhone(lead.phone) : '—'}</DataRow>
              <DataRow label="WhatsApp">{lead.whatsapp ? formatPhone(lead.whatsapp) : '—'}</DataRow>
              <DataRow label="E-mail">{lead.email || '—'}</DataRow>
              <DataRow label="Instagram">
                {lead.instagram ? instagramHandle(lead.instagram) : '—'}
              </DataRow>
              <DataRow label="Site">{lead.website ? displayUrl(lead.website) : '—'}</DataRow>
              <DataRow label="Bairro">{lead.neighborhood || '—'}</DataRow>
              <DataRow label="Cidade">{lead.city || '—'}</DataRow>
              <DataRow label="Origem">{lead.source || '—'}</DataRow>
              <DataRow label="Valor potencial">
                <span className="tnum">
                  {lead.potentialValue > 0 ? formatCurrency(lead.potentialValue) : '—'}
                </span>
              </DataRow>
              <DataRow label="Criado em">{formatDate(lead.createdAt)}</DataRow>
              <DataRow label="Última interação">
                {lead.lastInteractionAt
                  ? `${formatDate(lead.lastInteractionAt)} (${relativeDayLabel(lead.lastInteractionAt)})`
                  : 'Nenhuma'}
              </DataRow>
              <DataRow label="Próximo contato">
                {lead.nextContactAt ? (
                  <span
                    className={
                      isOverdue(lead.nextContactAt) && !isClosed ? 'font-medium text-critical' : ''
                    }
                  >
                    {formatDate(lead.nextContactAt)} ({relativeDayLabel(lead.nextContactAt)})
                  </span>
                ) : (
                  '—'
                )}
              </DataRow>
              {lead.wonAt ? <DataRow label="Ganho em">{formatDate(lead.wonAt)}</DataRow> : null}
              {lead.lostAt ? <DataRow label="Perdido em">{formatDate(lead.lostAt)}</DataRow> : null}
            </dl>
            {lead.notes ? (
              <div className="border-t border-line px-4 py-4 sm:px-5">
                <p className="label-eyebrow mb-1.5">Observações</p>
                <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-muted">
                  {lead.notes}
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader
              title="Histórico de interações"
              description={`${leadInteractions.length} registro(s)`}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setInteractionOpen(true)}
                >
                  Registrar
                </Button>
              }
            />
            <div className="px-4 py-4 sm:px-5">
              {leadInteractions.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Nenhuma interação registrada"
                  description="Registre ligações, mensagens e reuniões para manter a linha do tempo completa."
                  compact
                />
              ) : (
                <Timeline
                  interactions={leadInteractions}
                  onDelete={(interaction) => setInteractionToDelete(interaction)}
                />
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Etapa do funil" />
            <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
              <label htmlFor="stage-select" className="text-sm font-medium text-ink">
                Mover para
              </label>
              <select
                id="stage-select"
                value={lead.stageId}
                onChange={(event) => void actions.changeLeadStage(lead.id, event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {stages.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                Cada mudança de etapa entra automaticamente no histórico.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Atividades vinculadas"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setActivityOpen(true)}
                >
                  Nova
                </Button>
              }
            />
            {leadActivities.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="Nenhuma atividade"
                description="Agende o próximo contato para não perder o timing."
                compact
              />
            ) : (
              <ul className="divide-y divide-line">
                {leadActivities.map((activity) => {
                  const late = !activity.done && isOverdue(activity.dueAt);
                  return (
                    <li key={activity.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <input
                        type="checkbox"
                        checked={activity.done}
                        onChange={(event) =>
                          void actions.setActivityDone(activity.id, event.target.checked)
                        }
                        aria-label={`Concluir ${activity.title}`}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded-sm border-line-strong accent-[rgb(var(--c-accent))]"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-base ${
                            activity.done ? 'text-subtle line-through' : 'font-medium text-ink'
                          }`}
                        >
                          {activity.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {ACTIVITY_TYPE_LABEL[activity.type]} · {formatDateTime(activity.dueAt)}
                        </p>
                      </div>
                      {late ? <Badge tone="critical">Atrasada</Badge> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {company ? (
            <Panel>
              <PanelHeader title="Empresa" />
              <div className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                <Link
                  to={`/empresas/${company.id}`}
                  className="focus-ring rounded-sm text-base font-medium text-accent"
                >
                  {company.name}
                </Link>
                <p className="text-sm text-muted">
                  {[company.segment, company.city].filter(Boolean).join(' · ') || 'Sem detalhes'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => void actions.linkLeadToCompany(lead.id, null)}
                >
                  Remover vínculo
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      <LeadForm open={editOpen} lead={lead} onClose={() => setEditOpen(false)} />
      <ActivityForm
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        defaultLeadId={lead.id}
        defaultCompanyId={lead.companyId ?? undefined}
      />
      <InteractionDialog
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
        leadId={lead.id}
        companyId={lead.companyId}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir lead"
        message={`Excluir "${title}" definitivamente?`}
        detail="As atividades e o histórico vinculados também serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir lead"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <ConfirmDialog
        open={convertOpen}
        title="Transformar em cliente"
        message="Marcar este estabelecimento como cliente?"
        detail="O histórico comercial e as oportunidades são mantidos. A empresa passa a constar como cliente."
        confirmLabel="Transformar em cliente"
        tone="primary"
        onConfirm={async () => {
          await actions.convertLeadToClient(lead.id);
          setConvertOpen(false);
        }}
        onCancel={() => setConvertOpen(false)}
      />
      <ConfirmDialog
        open={Boolean(interactionToDelete)}
        title="Remover registro"
        message="Remover este registro do histórico?"
        detail="Registros automáticos de etapa e criação não podem ser removidos."
        confirmLabel="Remover"
        onConfirm={async () => {
          if (interactionToDelete) {
            const removed = await actions.deleteInteraction(interactionToDelete.id);
            if (removed) toast.success('Registro removido');
          }
          setInteractionToDelete(null);
        }}
        onCancel={() => setInteractionToDelete(null)}
      />
    </div>
  );
}
