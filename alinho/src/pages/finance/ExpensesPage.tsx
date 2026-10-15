import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, TrendingDown } from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge, EmptyState, Panel, SegmentedControl } from '../../components/ui/primitives';
import { ExpenseForm } from '../../components/finance/ExpenseForm';
import { formatCurrency, formatCurrencyShort, formatNumber, normalizeText } from '../../utils/format';
import { formatDate } from '../../utils/date';
import { EXPENSE_STATUS_LABEL, type Expense, type ExpenseStatus } from '../../models/finance';

export function ExpensesPage() {
  const { expenses, contracts, actions } = useData();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [status, setStatus] = useState<'todas' | ExpenseStatus>('todas');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const contractById = useMemo(
    () => new Map(contracts.map((contract) => [contract.id, contract])),
    [contracts],
  );

  const rows = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    return expenses
      .filter((expense) => {
        if (status !== 'todas' && expense.status !== status) return false;
        if (!term) return true;
        const contract = expense.contractId ? contractById.get(expense.contractId) : undefined;
        return normalizeText(
          [expense.description, expense.category, contract?.projectName].join(' '),
        ).includes(term);
      })
      .sort((a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime());
  }, [expenses, contractById, debouncedQuery, status]);

  const totals = useMemo(
    () => ({
      paid: rows.filter((row) => row.status === 'paga').reduce((total, row) => total + row.amount, 0),
      planned: rows
        .filter((row) => row.status === 'prevista')
        .reduce((total, row) => total + row.amount, 0),
    }),
    [rows],
  );

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
              placeholder="Buscar despesa, categoria ou projeto…"
              aria-label="Buscar despesas"
              className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <SegmentedControl
            label="Filtrar despesas por situação"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'paga', label: 'Pagas' },
              { value: 'prevista', label: 'Previstas' },
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
          Nova despesa
        </Button>
      </div>

      <Panel>
        {rows.length === 0 ? (
          expenses.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="Nenhuma despesa registrada"
              description="Registre os custos do estúdio para acompanhar o lucro realizado. Despesas previstas não entram no cálculo até serem marcadas como pagas."
              action={
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setFormOpen(true)}
                >
                  Nova despesa
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste a busca ou o filtro." compact />
          )
        ) : (
          <>
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-2xs uppercase tracking-[0.05em] text-subtle">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Descrição</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Categoria</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Projeto</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Data</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Valor</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((expense) => {
                    const contract = expense.contractId ? contractById.get(expense.contractId) : undefined;
                    return (
                      <tr key={expense.id} className="transition-colors hover:bg-sunken/60">
                        <td className="px-4 py-2.5 text-base text-ink">{expense.description}</td>
                        <td className="px-4 py-2.5 text-sm text-muted">{expense.category || '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-muted">
                          {contract?.projectName ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted">{formatDate(expense.spentAt)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={expense.status === 'paga' ? 'critical' : 'neutral'}>
                            {EXPENSE_STATUS_LABEL[expense.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar ${expense.description}`}
                              onClick={() => {
                                setEditing(expense);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Excluir ${expense.description}`}
                              onClick={() => setToDelete(expense)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line lg:hidden">
              {rows.map((expense) => (
                <li key={expense.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">{expense.description}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[expense.category, formatDate(expense.spentAt)].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-1.5">
                      <Badge tone={expense.status === 'paga' ? 'critical' : 'neutral'}>
                        {EXPENSE_STATUS_LABEL[expense.status]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium text-ink tnum">
                      {formatCurrency(expense.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(expense);
                        setFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-subtle tnum">
              <span>{formatNumber(rows.length)} despesa(s)</span>
              <span className="text-critical">Pagas {formatCurrencyShort(totals.paid)}</span>
              <span>Previstas {formatCurrencyShort(totals.planned)}</span>
            </div>
          </>
        )}
      </Panel>

      <ExpenseForm
        open={formOpen}
        expense={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir despesa"
        message={toDelete ? `Excluir "${toDelete.description}"?` : ''}
        detail="Esta ação não pode ser desfeita e altera o lucro realizado."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (toDelete) await actions.deleteExpense(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
