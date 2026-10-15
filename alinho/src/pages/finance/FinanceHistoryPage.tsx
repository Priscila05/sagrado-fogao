import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, History, Search } from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, Panel, SegmentedControl } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { buildLedger, inPeriod } from '../../services/finance';
import { downloadTextFile, fileStamp, toCsv } from '../../utils/csv';
import { formatCurrency, formatCurrencyShort, formatNumber, normalizeText } from '../../utils/format';
import { formatDate } from '../../utils/date';

type KindFilter = 'todos' | 'recebimento' | 'despesa';

const STATUS_TONE: Record<string, 'positive' | 'neutral' | 'critical'> = {
  pago: 'positive',
  paga: 'critical',
  pendente: 'neutral',
  prevista: 'neutral',
  vencido: 'critical',
};

const STATUS_LABEL: Record<string, string> = {
  pago: 'Recebido',
  pendente: 'Pendente',
  vencido: 'Vencido',
  paga: 'Paga',
  prevista: 'Prevista',
};

export function FinanceHistoryPage() {
  const { payments, expenses, contracts } = useData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [kind, setKind] = useState<KindFilter>('todos');
  const [client, setClient] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');

  const ledger = useMemo(
    () => buildLedger(payments, expenses, contracts),
    [payments, expenses, contracts],
  );

  const clients = useMemo(() => {
    const names = new Set<string>();
    for (const contract of contracts) {
      if (contract.clientName.trim()) names.add(contract.clientName.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contracts]);

  const rows = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    const fromDate = from ? new Date(`${from}T00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59`) : null;

    return ledger.filter((entry) => {
      if (kind !== 'todos' && entry.kind !== kind) return false;
      if (client && entry.clientName !== client) return false;
      if (status && entry.status !== status) return false;
      if (fromDate && toDate && !inPeriod(entry.date, fromDate, toDate)) return false;
      if (fromDate && !toDate && new Date(entry.date).getTime() < fromDate.getTime()) return false;
      if (toDate && !fromDate && new Date(entry.date).getTime() > toDate.getTime()) return false;
      if (!term) return true;
      return normalizeText([entry.description, entry.clientName, entry.category].join(' ')).includes(
        term,
      );
    });
  }, [ledger, kind, client, status, from, to, debouncedQuery]);

  const totals = useMemo(() => {
    let received = 0;
    let paidOut = 0;
    for (const entry of rows) {
      if (entry.kind === 'recebimento' && entry.status === 'pago') received += entry.value;
      if (entry.kind === 'despesa' && entry.status === 'paga') paidOut += Math.abs(entry.value);
    }
    return { received, paidOut, result: received - paidOut };
  }, [rows]);

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error('Nada para exportar', 'Nenhum lançamento corresponde aos filtros.');
      return;
    }
    const csv = toCsv(
      ['Data', 'Tipo', 'Descrição', 'Cliente', 'Categoria', 'Situação', 'Forma', 'Valor'],
      rows.map((entry) => [
        formatDate(entry.date),
        entry.kind === 'recebimento' ? 'Recebimento' : 'Despesa',
        entry.description,
        entry.clientName,
        entry.category,
        STATUS_LABEL[entry.status] ?? entry.status,
        entry.method,
        entry.value.toFixed(2).replace('.', ','),
      ]),
    );
    downloadTextFile(`alinho-historico-financeiro_${fileStamp()}.csv`, csv, 'text/csv');
    toast.success(`${rows.length} lançamento(s) exportado(s)`);
  };

  const selectClass =
    'h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50';

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-3 py-3 sm:px-4">
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
                placeholder="Buscar lançamento…"
                aria-label="Buscar no histórico financeiro"
                className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <SegmentedControl
              label="Filtrar por tipo de lançamento"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'recebimento', label: 'Recebimentos' },
                { value: 'despesa', label: 'Despesas' },
              ]}
            />
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              Exportar CSV
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
              Cliente
              <select
                value={client}
                onChange={(event) => setClient(event.target.value)}
                className={selectClass}
              >
                <option value="">Todos</option>
                {clients.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
              Situação
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={selectClass}
              >
                <option value="">Todas</option>
                <option value="pago">Recebido</option>
                <option value="pendente">Pendente</option>
                <option value="vencido">Vencido</option>
                <option value="paga">Despesa paga</option>
                <option value="prevista">Despesa prevista</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
              De
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className={selectClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
              Até
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className={selectClass}
              />
            </label>
            {client || status || from || to ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setClient('');
                  setStatus('');
                  setFrom('');
                  setTo('');
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </div>

        {rows.length === 0 ? (
          ledger.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhum lançamento financeiro"
              description="Recebimentos e despesas aparecem aqui conforme você registra contratos e custos."
            />
          ) : (
            <EmptyState icon={Search} title="Nenhum resultado" description="Ajuste os filtros aplicados." compact />
          )
        ) : (
          <>
            <ul className="divide-y divide-line">
              {rows.slice(0, 200).map((entry) => (
                <li key={`${entry.kind}-${entry.id}`} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={[
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                      entry.kind === 'recebimento'
                        ? 'border-positive/25 bg-positive-soft text-positive'
                        : 'border-critical/25 bg-critical-soft text-critical',
                    ].join(' ')}
                  >
                    {entry.kind === 'recebimento' ? (
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-ink">{entry.description}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[formatDate(entry.date), entry.clientName, entry.category, entry.method]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`text-sm font-medium tnum ${
                        entry.kind === 'recebimento' ? 'text-positive' : 'text-critical'
                      }`}
                    >
                      {entry.kind === 'recebimento' ? '+' : '−'}
                      {formatCurrency(Math.abs(entry.value))}
                    </span>
                    <Badge tone={STATUS_TONE[entry.status] ?? 'neutral'}>
                      {STATUS_LABEL[entry.status] ?? entry.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            {rows.length > 200 ? (
              <p className="border-t border-line px-4 py-2 text-xs text-subtle">
                Mostrando os 200 lançamentos mais recentes. Use os filtros ou exporte o CSV para ver
                o restante.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-subtle tnum">
              <span>{formatNumber(rows.length)} lançamento(s)</span>
              <span className="text-positive">Recebido {formatCurrencyShort(totals.received)}</span>
              <span className="text-critical">Despesas pagas {formatCurrencyShort(totals.paidOut)}</span>
              <span>Resultado {formatCurrencyShort(totals.result)}</span>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
