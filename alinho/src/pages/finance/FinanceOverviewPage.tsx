import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  FileSignature,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { computeFinanceMetrics } from '../../services/finance';
import { MetricTile } from '../../components/shared/MetricTile';
import { BarList } from '../../components/charts/BarList';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, Panel, PanelHeader } from '../../components/ui/primitives';
import { ContractForm } from '../../components/finance/ContractForm';
import { formatCurrency, formatCurrencyShort, formatNumber } from '../../utils/format';
import { formatDate, relativeDayLabel } from '../../utils/date';

export function FinanceOverviewPage() {
  const { contracts, payments, expenses } = useData();
  const [contractOpen, setContractOpen] = useState(false);

  const metrics = useMemo(
    () => computeFinanceMetrics(contracts, payments, expenses),
    [contracts, payments, expenses],
  );

  if (contracts.length === 0 && payments.length === 0 && expenses.length === 0) {
    return (
      <>
        <Panel>
          <EmptyState
            icon={Wallet}
            title="Comece cadastrando um contrato"
            description="Ao registrar o primeiro contrato, o ALINHO gera a agenda de entrada e parcelas e passa a calcular faturamento, recebimentos e lucro a partir dos lançamentos reais."
            action={
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setContractOpen(true)}
              >
                Novo contrato
              </Button>
            }
          />
        </Panel>
        <ContractForm open={contractOpen} onClose={() => setContractOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Indicadores financeiros" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Faturamento contratado"
          value={formatCurrencyShort(metrics.contractedTotal)}
          hint={`${formatNumber(metrics.activeContracts)} contrato(s) ativo(s)`}
          icon={FileSignature}
        />
        <MetricTile
          label="Total recebido"
          value={formatCurrencyShort(metrics.receivedTotal)}
          hint="Somente parcelas quitadas"
          icon={TrendingUp}
          tone="positive"
        />
        <MetricTile
          label="A receber"
          value={formatCurrencyShort(metrics.receivableTotal)}
          hint="Parcelas em aberto no prazo"
          icon={CalendarClock}
          to="/financeiro/pagamentos"
        />
        <MetricTile
          label="Vencidos"
          value={formatCurrencyShort(metrics.overdueTotal)}
          hint={`${formatNumber(metrics.overdueCount)} parcela(s) vencida(s)`}
          icon={AlertTriangle}
          tone={metrics.overdueTotal > 0 ? 'critical' : 'neutral'}
          to="/financeiro/pagamentos"
        />
      </section>

      <section aria-label="Resultado" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Despesas pagas"
          value={formatCurrencyShort(metrics.expensesPaidTotal)}
          hint={
            metrics.expensesPlannedTotal > 0
              ? `${formatCurrencyShort(metrics.expensesPlannedTotal)} previstas`
              : 'Nenhuma despesa prevista'
          }
          icon={TrendingDown}
          to="/financeiro/despesas"
        />
        <MetricTile
          label="Lucro realizado"
          value={formatCurrencyShort(metrics.realizedProfit)}
          hint="Recebido menos despesas pagas"
          icon={Wallet}
          tone={metrics.realizedProfit >= 0 ? 'positive' : 'critical'}
        />
        <MetricTile
          label="Saldo a receber"
          value={formatCurrencyShort(metrics.openBalance)}
          hint="Em aberto + vencido"
          icon={Receipt}
        />
        <MetricTile
          label="Contratos"
          value={formatNumber(metrics.contractsCount)}
          hint={`${formatNumber(metrics.activeContracts)} ativo(s)`}
          icon={FileSignature}
          to="/financeiro/contratos"
        />
      </section>

      <Panel>
        <PanelHeader
          title="Entradas e saídas por mês"
          description="Recebimentos e despesas efetivamente pagos"
        />
        <div className="px-4 py-4 sm:px-5">
          <ColumnChart
            data={metrics.monthly.map((point) => ({
              label: point.label,
              values: { received: point.received, expenses: point.expenses },
            }))}
            series={[
              { key: 'received', label: 'Recebido', className: 'bg-positive/80' },
              { key: 'expenses', label: 'Despesas pagas', className: 'bg-critical/70' },
            ]}
            emptyLabel="Nenhum recebimento ou despesa paga registrado ainda."
          />
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
            {metrics.monthly.slice(-4).map((point) => (
              <div key={point.key}>
                <dt className="text-2xs uppercase tracking-[0.05em] text-subtle">{point.label}</dt>
                <dd
                  className={`text-base font-semibold tnum ${
                    point.result >= 0 ? 'text-ink' : 'text-critical'
                  }`}
                >
                  {formatCurrencyShort(point.result)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel>
          <PanelHeader
            title="Próximos vencimentos"
            action={
              <Link
                to="/financeiro/pagamentos"
                className="focus-ring rounded-sm text-xs font-medium text-accent"
              >
                Ver todos
              </Link>
            }
          />
          {metrics.upcomingPayments.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nada a vencer"
              description="Nenhuma parcela em aberto no prazo."
              compact
            />
          ) : (
            <ul className="divide-y divide-line">
              {metrics.upcomingPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">{payment.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      vence {relativeDayLabel(payment.dueAt)} · {formatDate(payment.dueAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-ink tnum">
                    {formatCurrency(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Parcelas vencidas" description="Prioridade de cobrança" />
          {metrics.overduePayments.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Nenhuma parcela vencida"
              description="Todos os recebimentos estão em dia."
              compact
            />
          ) : (
            <ul className="divide-y divide-line">
              {metrics.overduePayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">{payment.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      venceu {relativeDayLabel(payment.dueAt)} · {formatDate(payment.dueAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium text-ink tnum">
                      {formatCurrency(payment.amount)}
                    </span>
                    <Badge tone="critical">Vencida</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Despesas por categoria" description="Somente despesas pagas" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={metrics.expensesByCategory}
              tone="critical"
              maxItems={6}
              valueFormatter={(value) => formatCurrencyShort(value)}
              emptyLabel="Nenhuma despesa paga registrada."
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
