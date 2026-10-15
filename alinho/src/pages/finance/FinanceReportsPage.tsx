import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { MetricTile } from '../../components/shared/MetricTile';
import { BarList } from '../../components/charts/BarList';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, Panel, PanelHeader } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import {
  billableContracts,
  inPeriod,
  paymentDisplayStatus,
  computeFinanceMetrics,
} from '../../services/finance';
import { PERIOD_PRESETS, resolvePeriod, type PeriodPresetId } from '../../services/reports';
import { downloadTextFile, fileStamp, toCsv } from '../../utils/csv';
import { formatCurrency, formatCurrencyShort, formatNumber, formatPercent } from '../../utils/format';
import { formatDate, formatMonthLabel, monthKey, toDateInputValue } from '../../utils/date';
import { BarChart3 } from 'lucide-react';

export function FinanceReportsPage() {
  const { contracts, payments, expenses } = useData();
  const toast = useToast();
  const [preset, setPreset] = useState<PeriodPresetId>('90d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const earliest = useMemo(() => {
    const dates = [
      ...contracts.map((contract) => contract.signedAt),
      ...payments.map((payment) => payment.dueAt),
      ...expenses.map((expense) => expense.spentAt),
    ].map((iso) => new Date(iso).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates));
  }, [contracts, payments, expenses]);

  const period = useMemo(() => {
    if (preset === 'custom') {
      const from = customFrom ? new Date(`${customFrom}T00:00`) : null;
      const to = customTo ? new Date(`${customTo}T23:59`) : new Date();
      if (from && !Number.isNaN(from.getTime())) {
        return { from, to: Number.isNaN(to.getTime()) ? new Date() : to };
      }
      return resolvePeriod('tudo', earliest);
    }
    return resolvePeriod(preset, earliest);
  }, [preset, customFrom, customTo, earliest]);

  const report = useMemo(() => {
    // Contratado: assinados no período. Recebido e despesas: caixa do período.
    const signed = billableContracts(contracts).filter((contract) =>
      inPeriod(contract.signedAt, period.from, period.to),
    );
    const received = payments.filter(
      (payment) =>
        payment.status === 'pago' &&
        payment.paidAt &&
        inPeriod(payment.paidAt, period.from, period.to),
    );
    const paidExpenses = expenses.filter(
      (expense) =>
        expense.status === 'paga' &&
        inPeriod(expense.paidAt ?? expense.spentAt, period.from, period.to),
    );
    const pending = payments.filter((payment) => payment.status === 'pendente');

    const receivedTotal = received.reduce((total, payment) => total + payment.paidAmount, 0);
    const expensesTotal = paidExpenses.reduce((total, expense) => total + expense.amount, 0);

    const byCategory = new Map<string, number>();
    for (const expense of paidExpenses) {
      const label = expense.category.trim() || 'Sem categoria';
      byCategory.set(label, (byCategory.get(label) ?? 0) + expense.amount);
    }

    const byClient = new Map<string, number>();
    const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
    for (const payment of received) {
      const contract = payment.contractId ? contractById.get(payment.contractId) : undefined;
      const label = contract?.clientName?.trim() || 'Sem cliente';
      byClient.set(label, (byClient.get(label) ?? 0) + payment.paidAmount);
    }

    const months = new Map<string, { label: string; received: number; expenses: number }>();
    for (const payment of received) {
      const key = monthKey(payment.paidAt ?? payment.dueAt);
      const entry = months.get(key) ?? {
        label: formatMonthLabel(payment.paidAt ?? payment.dueAt),
        received: 0,
        expenses: 0,
      };
      entry.received += payment.paidAmount;
      months.set(key, entry);
    }
    for (const expense of paidExpenses) {
      const reference = expense.paidAt ?? expense.spentAt;
      const key = monthKey(reference);
      const entry = months.get(key) ?? {
        label: formatMonthLabel(reference),
        received: 0,
        expenses: 0,
      };
      entry.expenses += expense.amount;
      months.set(key, entry);
    }

    const overdue = pending.filter((payment) => paymentDisplayStatus(payment) === 'vencido');

    return {
      contractedTotal: signed.reduce((total, contract) => total + contract.totalValue, 0),
      contractsCount: signed.length,
      receivedTotal,
      expensesTotal,
      result: receivedTotal - expensesTotal,
      margin: receivedTotal > 0 ? ((receivedTotal - expensesTotal) / receivedTotal) * 100 : 0,
      receivedCount: received.length,
      byCategory: Array.from(byCategory.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      byClient: Array.from(byClient.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      monthly: Array.from(months.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, value]) => value),
      pending,
      overdue,
      pendingTotal: pending
        .filter((payment) => paymentDisplayStatus(payment) === 'pendente')
        .reduce((total, payment) => total + payment.amount, 0),
      overdueTotal: overdue.reduce((total, payment) => total + payment.amount, 0),
    };
  }, [contracts, payments, expenses, period]);

  const globalMetrics = useMemo(
    () => computeFinanceMetrics(contracts, payments, expenses),
    [contracts, payments, expenses],
  );

  const handleExport = () => {
    const rows: (string | number)[][] = [];
    rows.push(['Relatório financeiro ALINHO']);
    rows.push(['Período', formatDate(period.from), formatDate(period.to)]);
    rows.push([]);
    rows.push(['Indicador', 'Valor']);
    rows.push(['Contratos assinados no período', report.contractsCount]);
    rows.push(['Faturamento contratado (R$)', report.contractedTotal.toFixed(2).replace('.', ',')]);
    rows.push(['Total recebido (R$)', report.receivedTotal.toFixed(2).replace('.', ',')]);
    rows.push(['Despesas pagas (R$)', report.expensesTotal.toFixed(2).replace('.', ',')]);
    rows.push(['Resultado financeiro (R$)', report.result.toFixed(2).replace('.', ',')]);
    rows.push(['Margem sobre o recebido (%)', report.margin.toFixed(1).replace('.', ',')]);
    rows.push([]);

    rows.push(['Receitas por cliente', 'Valor recebido (R$)']);
    for (const row of report.byClient) {
      rows.push([row.label, row.value.toFixed(2).replace('.', ',')]);
    }
    rows.push([]);

    rows.push(['Despesas por categoria', 'Valor pago (R$)']);
    for (const row of report.byCategory) {
      rows.push([row.label, row.value.toFixed(2).replace('.', ',')]);
    }
    rows.push([]);

    rows.push(['Mês', 'Recebido (R$)', 'Despesas pagas (R$)', 'Resultado (R$)']);
    for (const row of report.monthly) {
      rows.push([
        row.label,
        row.received.toFixed(2).replace('.', ','),
        row.expenses.toFixed(2).replace('.', ','),
        (row.received - row.expenses).toFixed(2).replace('.', ','),
      ]);
    }
    rows.push([]);

    rows.push(['Pagamentos pendentes', 'Vencimento', 'Situação', 'Valor (R$)']);
    for (const payment of report.pending) {
      rows.push([
        payment.label,
        formatDate(payment.dueAt),
        paymentDisplayStatus(payment) === 'vencido' ? 'Vencido' : 'Pendente',
        payment.amount.toFixed(2).replace('.', ','),
      ]);
    }

    downloadTextFile(
      `alinho-relatorio-financeiro_${fileStamp()}.csv`,
      toCsv(['ALINHO', '', '', ''], rows),
      'text/csv',
    );
    toast.success('Relatório financeiro exportado');
  };

  if (contracts.length === 0 && payments.length === 0 && expenses.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={BarChart3}
          title="Sem dados financeiros para analisar"
          description="Cadastre contratos e registre recebimentos e despesas. Os relatórios passam a ser calculados a partir dos lançamentos reais."
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
              Período
              <select
                value={preset}
                onChange={(event) => setPreset(event.target.value as PeriodPresetId)}
                className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {PERIOD_PRESETS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {preset === 'custom' ? (
              <>
                <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                  De
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || toDateInputValue(new Date())}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                  Até
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </label>
              </>
            ) : null}
            <p className="text-xs text-subtle">
              {formatDate(period.from)} a {formatDate(period.to)}
            </p>
          </div>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Exportar CSV
          </Button>
        </div>
      </Panel>

      <section aria-label="Resultado do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Contratado no período"
          value={formatCurrencyShort(report.contractedTotal)}
          hint={`${formatNumber(report.contractsCount)} contrato(s) assinado(s)`}
        />
        <MetricTile
          label="Receitas"
          value={formatCurrencyShort(report.receivedTotal)}
          hint={`${formatNumber(report.receivedCount)} recebimento(s)`}
          tone="positive"
        />
        <MetricTile
          label="Despesas"
          value={formatCurrencyShort(report.expensesTotal)}
          hint="Somente despesas pagas"
          tone={report.expensesTotal > 0 ? 'critical' : 'neutral'}
        />
        <MetricTile
          label="Resultado"
          value={formatCurrencyShort(report.result)}
          hint={
            report.receivedTotal > 0
              ? `Margem de ${formatPercent(report.margin)} sobre o recebido`
              : 'Sem receita no período'
          }
          tone={report.result >= 0 ? 'positive' : 'critical'}
        />
      </section>

      <Panel>
        <PanelHeader title="Receitas e despesas por mês" description="Movimentação de caixa no período" />
        <div className="px-4 py-4 sm:px-5">
          <ColumnChart
            data={report.monthly.map((row) => ({
              label: row.label,
              values: { received: row.received, expenses: row.expenses },
            }))}
            series={[
              { key: 'received', label: 'Receitas', className: 'bg-positive/80' },
              { key: 'expenses', label: 'Despesas', className: 'bg-critical/70' },
            ]}
            emptyLabel="Nenhuma movimentação no período selecionado."
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Receitas por cliente" description="Valores efetivamente recebidos" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={report.byClient}
              tone="positive"
              maxItems={8}
              valueFormatter={(value) => formatCurrencyShort(value)}
              emptyLabel="Nenhum recebimento no período."
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Despesas por categoria" description="Somente despesas pagas" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={report.byCategory}
              tone="critical"
              maxItems={8}
              valueFormatter={(value) => formatCurrencyShort(value)}
              emptyLabel="Nenhuma despesa paga no período."
            />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Pagamentos pendentes"
          description="Situação atual, independente do período selecionado"
          action={
            <span className="text-xs text-muted tnum">
              {formatCurrencyShort(report.pendingTotal)} a vencer ·{' '}
              <span className="text-critical">{formatCurrencyShort(report.overdueTotal)} vencidos</span>
            </span>
          }
        />
        {report.pending.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nenhum pagamento pendente"
            description="Todas as parcelas lançadas já foram recebidas."
            compact
          />
        ) : (
          <ul className="divide-y divide-line">
            {report.pending.slice(0, 12).map((payment) => {
              const display = paymentDisplayStatus(payment);
              return (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base text-ink">{payment.label}</p>
                    <p className="mt-0.5 text-xs text-muted">vence em {formatDate(payment.dueAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium text-ink tnum">
                      {formatCurrency(payment.amount)}
                    </span>
                    <Badge tone={display === 'vencido' ? 'critical' : 'neutral'}>
                      {display === 'vencido' ? 'Vencido' : 'Pendente'}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-subtle">
        Saldo geral acumulado: {formatCurrencyShort(globalMetrics.receivedTotal)} recebidos,{' '}
        {formatCurrencyShort(globalMetrics.openBalance)} a receber e{' '}
        {formatCurrencyShort(globalMetrics.expensesPaidTotal)} em despesas pagas desde o início.
      </p>
    </div>
  );
}
