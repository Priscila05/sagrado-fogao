import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  FileSignature,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  Badge,
  DataRow,
  EmptyState,
  Panel,
  SegmentedControl,
} from '../../components/ui/primitives';
import { ContractForm } from '../../components/finance/ContractForm';
import { PaymentEditDialog, PaymentReceiveDialog } from '../../components/finance/PaymentDialog';
import { contractSummary, paymentDisplayStatus } from '../../services/finance';
import { formatCurrency, formatCurrencyShort, formatNumber, normalizeText } from '../../utils/format';
import { formatDate } from '../../utils/date';
import {
  CONTRACT_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type Contract,
  type ContractStatus,
  type Payment,
} from '../../models/finance';

const STATUS_TONE: Record<ContractStatus, 'accent' | 'positive' | 'neutral'> = {
  ativo: 'accent',
  concluido: 'positive',
  cancelado: 'neutral',
};

const PAYMENT_TONE = {
  pago: 'positive',
  pendente: 'neutral',
  vencido: 'critical',
} as const;

export function ContractsPage() {
  const { contracts, payments, companies, actions, saving } = useData();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [status, setStatus] = useState<'todos' | ContractStatus>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [detail, setDetail] = useState<Contract | null>(null);
  const [toDelete, setToDelete] = useState<Contract | null>(null);
  const [toReceive, setToReceive] = useState<Payment | null>(null);
  const [toEditPayment, setToEditPayment] = useState<Payment | null>(null);
  const [toReopen, setToReopen] = useState<Payment | null>(null);

  const rows = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    return contracts
      .filter((contract) => {
        if (status !== 'todos' && contract.status !== status) return false;
        if (!term) return true;
        return normalizeText(
          [contract.projectName, contract.clientName, contract.description].join(' '),
        ).includes(term);
      })
      .map((contract) => ({ contract, summary: contractSummary(contract, payments) }))
      .sort((a, b) => new Date(b.contract.signedAt).getTime() - new Date(a.contract.signedAt).getTime());
  }, [contracts, payments, debouncedQuery, status]);

  // O painel de detalhes sempre lê o contrato atual do estado.
  const current = detail ? contracts.find((row) => row.id === detail.id) ?? null : null;
  const currentSummary = current ? contractSummary(current, payments) : null;
  const currentCompany = current?.companyId
    ? companies.find((company) => company.id === current.companyId)
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar projeto ou cliente…"
              aria-label="Buscar contratos"
              className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <SegmentedControl
            label="Filtrar contratos por situação"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'ativo', label: 'Ativos' },
              { value: 'concluido', label: 'Concluídos' },
              { value: 'cancelado', label: 'Cancelados' },
            ]}
          />
        </div>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Novo contrato
        </Button>
      </div>

      <Panel>
        {rows.length === 0 ? (
          contracts.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="Nenhum contrato cadastrado"
              description="Cadastre um contrato para gerar a agenda de entrada e parcelas e acompanhar o que já foi recebido."
              action={
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setFormOpen(true)}
                >
                  Novo contrato
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste a busca ou o filtro." compact />
          )
        ) : (
          <>
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-[0.05em] text-subtle">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Projeto</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Cliente</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Contratado</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Recebido</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">A receber</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(({ contract, summary }) => (
                    <tr key={contract.id} className="transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setDetail(contract)}
                          className="focus-ring rounded-sm text-left text-base font-medium text-ink hover:text-accent"
                        >
                          {contract.projectName}
                        </button>
                        <p className="mt-0.5 text-xs text-subtle">
                          {formatDate(contract.signedAt)}
                          {summary.overdueCount > 0
                            ? ` · ${summary.overdueCount} parcela(s) vencida(s)`
                            : ''}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-base text-ink">{contract.clientName || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_TONE[contract.status]}>
                          {CONTRACT_STATUS_LABEL[contract.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                        {formatCurrencyShort(contract.totalValue)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-base text-positive tnum">
                        {formatCurrencyShort(summary.received)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-base text-muted tnum">
                        {formatCurrencyShort(summary.pending)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(contract)}>
                            Parcelas
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${contract.projectName}`}
                            onClick={() => {
                              setEditing(contract);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${contract.projectName}`}
                            onClick={() => setToDelete(contract)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line lg:hidden">
              {rows.map(({ contract, summary }) => (
                <li key={contract.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setDetail(contract)}
                    className="focus-ring w-full rounded-sm text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-ink">{contract.projectName}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {contract.clientName || 'Sem cliente'} · {formatDate(contract.signedAt)}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[contract.status]}>
                        {CONTRACT_STATUS_LABEL[contract.status]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tnum">
                      <span>Contratado {formatCurrencyShort(contract.totalValue)}</span>
                      <span className="text-positive">Recebido {formatCurrencyShort(summary.received)}</span>
                      <span>A receber {formatCurrencyShort(summary.pending)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-4 py-2.5 text-xs text-subtle tnum">
              {formatNumber(rows.length)} contrato(s) ·{' '}
              {formatCurrencyShort(rows.reduce((total, row) => total + row.contract.totalValue, 0))}{' '}
              contratados ·{' '}
              {formatCurrencyShort(rows.reduce((total, row) => total + row.summary.received, 0))}{' '}
              recebidos
            </div>
          </>
        )}
      </Panel>

      {/* Detalhes do contrato com a agenda de parcelas */}
      <Modal
        open={Boolean(current)}
        onClose={() => setDetail(null)}
        title={current?.projectName ?? ''}
        description={current ? `${current.clientName || 'Sem cliente'} · ${formatDate(current.signedAt)}` : ''}
        size="lg"
        footer={
          current ? (
            <>
              <Button
                variant="ghost"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => {
                  setEditing(current);
                  setDetail(null);
                  setFormOpen(true);
                }}
              >
                Editar contrato
              </Button>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Fechar
              </Button>
            </>
          ) : null
        }
      >
        {current && currentSummary ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <DataRow label="Contratado">
                <span className="tnum">{formatCurrency(current.totalValue)}</span>
              </DataRow>
              <DataRow label="Recebido">
                <span className="tnum text-positive">{formatCurrency(currentSummary.received)}</span>
              </DataRow>
              <DataRow label="A receber">
                <span className="tnum">{formatCurrency(currentSummary.pending)}</span>
              </DataRow>
              <DataRow label="Situação">
                <Badge tone={STATUS_TONE[current.status]}>
                  {CONTRACT_STATUS_LABEL[current.status]}
                </Badge>
              </DataRow>
            </dl>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>Progresso do recebimento</span>
                <span className="tnum">{currentSummary.progress.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-positive/80 transition-[width] duration-500 ease-swift"
                  style={{ width: `${Math.max(2, currentSummary.progress)}%` }}
                />
              </div>
            </div>

            {currentCompany ? (
              <p className="text-sm text-muted">
                Cliente do CRM:{' '}
                <Link
                  to={`/empresas/${currentCompany.id}`}
                  className="focus-ring rounded-sm font-medium text-accent"
                >
                  {currentCompany.name}
                </Link>
              </p>
            ) : null}

            {current.description ? (
              <p className="whitespace-pre-wrap break-words rounded-md bg-sunken/50 px-3 py-2 text-sm leading-relaxed text-muted">
                {current.description}
              </p>
            ) : null}

            <div>
              <p className="label-eyebrow mb-2">Agenda de pagamentos</p>
              <ul className="divide-y divide-line rounded-md border border-line">
                {currentSummary.payments.map((payment) => {
                  const display = paymentDisplayStatus(payment);
                  return (
                    <li key={payment.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium text-ink">{payment.label}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          vence {formatDate(payment.dueAt)}
                          {payment.status === 'pago' && payment.paidAt
                            ? ` · recebido em ${formatDate(payment.paidAt)}`
                            : ''}
                          {payment.method ? ` · ${payment.method}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-ink tnum">
                        {payment.status === 'pago'
                          ? formatCurrency(payment.paidAmount)
                          : formatCurrency(payment.amount)}
                      </span>
                      <Badge tone={PAYMENT_TONE[display]}>{PAYMENT_STATUS_LABEL[display]}</Badge>
                      <div className="flex items-center gap-0.5">
                        {payment.status === 'pago' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Reabrir ${payment.label}`}
                            onClick={() => setToReopen(payment)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Registrar recebimento de ${payment.label}`}
                            onClick={() => setToReceive(payment)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${payment.label}`}
                          onClick={() => setToEditPayment(payment)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-subtle">
                <Receipt className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                Editar o contrato recalcula apenas as parcelas em aberto — nada é duplicado e os
                recebimentos já confirmados permanecem como estão.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <ContractForm
        open={formOpen}
        contract={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <PaymentReceiveDialog
        open={Boolean(toReceive)}
        payment={toReceive}
        onClose={() => setToReceive(null)}
      />
      <PaymentEditDialog
        open={Boolean(toEditPayment)}
        payment={toEditPayment}
        onClose={() => setToEditPayment(null)}
      />
      <ConfirmDialog
        open={Boolean(toReopen)}
        title="Reabrir parcela"
        message={toReopen ? `Reabrir "${toReopen.label}"?` : ''}
        detail="O valor sai do total recebido e a parcela volta a constar como pendente."
        confirmLabel="Reabrir"
        tone="primary"
        onConfirm={async () => {
          if (toReopen) await actions.setPaymentPaid(toReopen.id, false);
          setToReopen(null);
        }}
        onCancel={() => setToReopen(null)}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir contrato"
        message={toDelete ? `Excluir o contrato "${toDelete.projectName}"?` : ''}
        detail={
          toDelete
            ? `Todas as parcelas deste contrato serão removidas, inclusive ${formatCurrency(
                contractSummary(toDelete, payments).received,
              )} já registrados como recebidos. As despesas vinculadas são mantidas, apenas sem o vínculo.`
            : ''
        }
        confirmLabel="Excluir contrato"
        onConfirm={async () => {
          if (toDelete) await actions.deleteContract(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
      {saving ? <span className="sr-only" role="status">Salvando…</span> : null}
    </div>
  );
}
