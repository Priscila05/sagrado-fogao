import { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Receipt, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge, EmptyState, Panel, SegmentedControl } from '../../components/ui/primitives';
import { PaymentEditDialog, PaymentReceiveDialog } from '../../components/finance/PaymentDialog';
import { paymentDisplayStatus } from '../../services/finance';
import { formatCurrency, formatCurrencyShort, formatNumber, normalizeText } from '../../utils/format';
import { formatDate, relativeDayLabel } from '../../utils/date';
import {
  PAYMENT_STATUS_LABEL,
  type Payment,
  type PaymentDisplayStatus,
} from '../../models/finance';

const TONE = {
  pago: 'positive',
  pendente: 'neutral',
  vencido: 'critical',
} as const;

export function PaymentsPage() {
  const { payments, contracts, actions } = useData();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [status, setStatus] = useState<'todos' | PaymentDisplayStatus>('todos');
  const [toReceive, setToReceive] = useState<Payment | null>(null);
  const [toEdit, setToEdit] = useState<Payment | null>(null);
  const [toReopen, setToReopen] = useState<Payment | null>(null);
  const [toDelete, setToDelete] = useState<Payment | null>(null);

  const contractById = useMemo(
    () => new Map(contracts.map((contract) => [contract.id, contract])),
    [contracts],
  );

  const rows = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    return payments
      .map((payment) => ({
        payment,
        display: paymentDisplayStatus(payment),
        contract: payment.contractId ? contractById.get(payment.contractId) : undefined,
      }))
      .filter(({ payment, display, contract }) => {
        if (status !== 'todos' && display !== status) return false;
        if (!term) return true;
        return normalizeText(
          [payment.label, contract?.projectName, contract?.clientName, payment.method].join(' '),
        ).includes(term);
      })
      .sort((a, b) => {
        // Vencidas primeiro, depois por vencimento mais próximo.
        if (a.display === 'vencido' && b.display !== 'vencido') return -1;
        if (b.display === 'vencido' && a.display !== 'vencido') return 1;
        if (a.payment.status !== b.payment.status) return a.payment.status === 'pendente' ? -1 : 1;
        return new Date(a.payment.dueAt).getTime() - new Date(b.payment.dueAt).getTime();
      });
  }, [payments, contractById, debouncedQuery, status]);

  const totals = useMemo(() => {
    let received = 0;
    let open = 0;
    let overdue = 0;
    for (const { payment, display } of rows) {
      if (display === 'pago') received += payment.paidAmount;
      else if (display === 'vencido') overdue += payment.amount;
      else open += payment.amount;
    }
    return { received, open, overdue };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar parcela, projeto ou cliente…"
            aria-label="Buscar pagamentos"
            className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <SegmentedControl
          label="Filtrar pagamentos por situação"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'pendente', label: 'Pendentes' },
            { value: 'vencido', label: 'Vencidos' },
            { value: 'pago', label: 'Pagos' },
          ]}
        />
      </div>

      <Panel>
        {rows.length === 0 ? (
          payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum pagamento lançado"
              description="As parcelas aparecem aqui assim que você cadastra um contrato — a agenda é gerada automaticamente."
            />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste a busca ou o filtro." compact />
          )
        ) : (
          <>
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-[0.05em] text-subtle">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Parcela</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Projeto / cliente</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Vencimento</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Forma</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Previsto</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Recebido</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(({ payment, display, contract }) => (
                    <tr key={payment.id} className="transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-2.5 text-base text-ink">{payment.label}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-base text-ink">{contract?.projectName ?? 'Lançamento avulso'}</p>
                        {contract?.clientName ? (
                          <p className="mt-0.5 text-xs text-subtle">{contract.clientName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">
                        {formatDate(payment.dueAt)}
                        {payment.status === 'pendente' ? (
                          <span className="block text-xs text-subtle">
                            {relativeDayLabel(payment.dueAt)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">{payment.method || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={TONE[display]}>{PAYMENT_STATUS_LABEL[display]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-base tnum">
                        {payment.status === 'pago' ? (
                          <span className="text-positive">{formatCurrency(payment.paidAmount)}</span>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
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
                              size="sm"
                              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                              onClick={() => setToReceive(payment)}
                            >
                              Receber
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${payment.label}`}
                            onClick={() => setToEdit(payment)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          {payment.kind === 'avulso' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Excluir ${payment.label}`}
                              onClick={() => setToDelete(payment)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line lg:hidden">
              {rows.map(({ payment, display, contract }) => (
                <li key={payment.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-ink">{payment.label}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {contract?.projectName ?? 'Lançamento avulso'} · vence{' '}
                        {formatDate(payment.dueAt)}
                      </p>
                    </div>
                    <Badge tone={TONE[display]}>{PAYMENT_STATUS_LABEL[display]}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink tnum">
                      {payment.status === 'pago'
                        ? formatCurrency(payment.paidAmount)
                        : formatCurrency(payment.amount)}
                    </span>
                    {payment.status === 'pago' ? (
                      <Button variant="ghost" size="sm" onClick={() => setToReopen(payment)}>
                        Reabrir
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        onClick={() => setToReceive(payment)}
                      >
                        Receber
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-subtle tnum">
              <span>{formatNumber(rows.length)} lançamento(s)</span>
              <span className="text-positive">Recebido {formatCurrencyShort(totals.received)}</span>
              <span>A receber {formatCurrencyShort(totals.open)}</span>
              <span className="text-critical">Vencido {formatCurrencyShort(totals.overdue)}</span>
            </div>
          </>
        )}
      </Panel>

      <PaymentReceiveDialog
        open={Boolean(toReceive)}
        payment={toReceive}
        onClose={() => setToReceive(null)}
      />
      <PaymentEditDialog open={Boolean(toEdit)} payment={toEdit} onClose={() => setToEdit(null)} />
      <ConfirmDialog
        open={Boolean(toReopen)}
        title="Reabrir pagamento"
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
        title="Excluir lançamento"
        message={toDelete ? `Excluir "${toDelete.label}"?` : ''}
        detail="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (toDelete) await actions.deletePayment(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
