import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  History,
  Link2,
  Pencil,
  Trash2,
  Users,
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
import { CompanyForm } from '../components/companies/CompanyForm';
import { Modal } from '../components/ui/Modal';
import { SelectInput } from '../components/ui/Field';
import { ActivityForm } from '../components/activities/ActivityForm';
import { ContactActions } from '../components/shared/ContactActions';
import { Timeline } from '../components/leads/Timeline';
import { formatCurrency, formatCurrencyShort, formatNumber, formatPhone } from '../utils/format';
import { formatDate, formatDateTime, isOverdue } from '../utils/date';
import { displayUrl, instagramHandle } from '../utils/links';
import { ACTIVITY_TYPE_LABEL, COMPANY_STATUS_LABEL, type CompanyStatus } from '../models/types';

const STATUS_TONE: Record<CompanyStatus, 'positive' | 'accent' | 'neutral'> = {
  cliente: 'positive',
  prospect: 'accent',
  inativo: 'neutral',
};

export function CompanyDetailPage() {
  const { companyId = '' } = useParams();
  const navigate = useNavigate();
  const { companies, leads, activities, interactions, stages, actions, saving } = useData();

  const company = companies.find((candidate) => candidate.id === companyId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [leadToLink, setLeadToLink] = useState('');

  const companyLeads = useMemo(
    () => leads.filter((lead) => lead.companyId === companyId),
    [leads, companyId],
  );

  const companyActivities = useMemo(
    () =>
      activities
        .filter((activity) => activity.companyId === companyId)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [activities, companyId],
  );

  const companyInteractions = useMemo(
    () =>
      interactions
        .filter((interaction) => interaction.companyId === companyId)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 30),
    [interactions, companyId],
  );

  const unlinkedLeads = useMemo(
    () => leads.filter((lead) => !lead.companyId),
    [leads],
  );

  if (!company) {
    return (
      <Panel>
        <EmptyState
          icon={Building2}
          title="Empresa não encontrada"
          description="Ela pode ter sido excluída ou pertencer ao outro conjunto de dados."
          action={
            <Link to="/empresas" className="focus-ring rounded-md">
              <Button variant="primary">Voltar para empresas</Button>
            </Link>
          }
        />
      </Panel>
    );
  }

  const totalValue = companyLeads.reduce((total, lead) => total + lead.potentialValue, 0);

  const handleDelete = async () => {
    const removed = await actions.deleteCompany(company.id);
    setDeleteOpen(false);
    if (removed) navigate('/empresas', { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/empresas"
          className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Empresas e clientes
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{company.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[company.status]}>{COMPANY_STATUS_LABEL[company.status]}</Badge>
            {company.segment ? <Badge tone="outline">{company.segment}</Badge> : null}
            <span className="text-xs text-subtle">
              Cadastrada em {formatDate(company.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={company.status}
            onChange={(event) =>
              void actions.updateCompany(company.id, {
                status: event.target.value as CompanyStatus,
              })
            }
            aria-label="Situação comercial"
            className="h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {(Object.keys(COMPANY_STATUS_LABEL) as CompanyStatus[]).map((value) => (
              <option key={value} value={value}>
                {COMPANY_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
            Excluir
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Panel>
            <PanelHeader title="Contato" />
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
              <ContactActions contact={company} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                <DataRow label="Telefone">{company.phone ? formatPhone(company.phone) : '—'}</DataRow>
                <DataRow label="WhatsApp">{company.whatsapp ? formatPhone(company.whatsapp) : '—'}</DataRow>
                <DataRow label="E-mail">{company.email || '—'}</DataRow>
                <DataRow label="Site">{company.website ? displayUrl(company.website) : '—'}</DataRow>
                <DataRow label="Instagram">
                  {company.instagram ? instagramHandle(company.instagram) : '—'}
                </DataRow>
                <DataRow label="Endereço">{company.address || '—'}</DataRow>
                <DataRow label="Bairro">{company.neighborhood || '—'}</DataRow>
                <DataRow label="Cidade">{company.city || '—'}</DataRow>
                <DataRow label="Valor somado">
                  <span className="tnum">{totalValue > 0 ? formatCurrency(totalValue) : '—'}</span>
                </DataRow>
              </dl>
              {company.notes ? (
                <div>
                  <p className="label-eyebrow mb-1.5">Observações</p>
                  <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-muted">
                    {company.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Contatos e oportunidades"
              description={`${formatNumber(companyLeads.length)} lead(s) vinculado(s)`}
              action={
                unlinkedLeads.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Link2 className="h-3.5 w-3.5" />}
                    onClick={() => setLinkOpen(true)}
                  >
                    Vincular lead
                  </Button>
                ) : null
              }
            />
            {companyLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum lead vinculado"
                description="Vincule leads existentes para reunir todo o histórico desta empresa."
                compact
                action={
                  unlinkedLeads.length > 0 ? (
                    <Button variant="secondary" size="sm" onClick={() => setLinkOpen(true)}>
                      Vincular lead
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {companyLeads.map((lead) => {
                  const stage = stages.find((candidate) => candidate.id === lead.stageId);
                  return (
                    <li key={lead.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <Link to={`/leads/${lead.id}`} className="focus-ring min-w-0 flex-1 rounded-sm">
                        <p className="truncate text-base font-medium text-ink">
                          {lead.contactName || lead.establishmentName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {stage ? <StageBadge name={stage.name} kind={stage.kind} /> : null}
                          <PriorityBadge priority={lead.priority} />
                        </div>
                      </Link>
                      <span className="shrink-0 text-sm font-medium text-ink tnum">
                        {lead.potentialValue > 0 ? formatCurrencyShort(lead.potentialValue) : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader
              title="Atividades"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CalendarPlus className="h-3.5 w-3.5" />}
                  onClick={() => setActivityOpen(true)}
                >
                  Nova
                </Button>
              }
            />
            {companyActivities.length === 0 ? (
              <EmptyState icon={CalendarPlus} title="Nenhuma atividade" compact />
            ) : (
              <ul className="divide-y divide-line">
                {companyActivities.map((activity) => (
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
                    {!activity.done && isOverdue(activity.dueAt) ? (
                      <Badge tone="critical">Atrasada</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Histórico" description="Eventos dos leads desta empresa" />
            <div className="px-4 py-4 sm:px-5">
              {companyInteractions.length === 0 ? (
                <EmptyState icon={History} title="Sem histórico ainda" compact />
              ) : (
                <Timeline interactions={companyInteractions} />
              )}
            </div>
          </Panel>
        </div>
      </div>

      <CompanyForm open={editOpen} company={company} onClose={() => setEditOpen(false)} />
      <ActivityForm
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        defaultCompanyId={company.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir empresa"
        message={`Excluir "${company.name}"?`}
        detail={
          companyLeads.length > 0
            ? `${companyLeads.length} lead(s) permanecerão cadastrados, apenas sem vínculo com esta empresa.`
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel="Excluir empresa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* Link an existing lead to this company */}
      <Modal
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setLeadToLink('');
        }}
        title="Vincular lead"
        description="Escolha um lead que ainda não pertence a nenhuma empresa."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setLinkOpen(false);
                setLeadToLink('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!leadToLink}
              loading={saving}
              onClick={async () => {
                if (!leadToLink) return;
                const linked = await actions.linkLeadToCompany(leadToLink, company.id);
                if (linked) {
                  setLinkOpen(false);
                  setLeadToLink('');
                }
              }}
            >
              Vincular
            </Button>
          </>
        }
      >
        <SelectInput
          label="Lead sem empresa"
          value={leadToLink}
          onChange={(event) => setLeadToLink(event.target.value)}
          options={unlinkedLeads.map((lead) => ({
            value: lead.id,
            label: lead.establishmentName || lead.contactName || 'Lead sem nome',
          }))}
          placeholder="Selecione um lead"
          data-autofocus
        />
      </Modal>
    </div>
  );
}
