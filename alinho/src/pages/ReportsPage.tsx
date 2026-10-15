import { useMemo, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { useData } from '../state/DataProvider';
import {
  PERIOD_PRESETS,
  buildReport,
  resolvePeriod,
  type PeriodPresetId,
} from '../services/reports';
import { MetricTile } from '../components/shared/MetricTile';
import { BarList } from '../components/charts/BarList';
import { ColumnChart } from '../components/charts/ColumnChart';
import { Button } from '../components/ui/Button';
import { EmptyState, PageHeader, Panel, PanelHeader } from '../components/ui/primitives';
import { toCsv, downloadTextFile, fileStamp } from '../utils/csv';
import { formatCurrency, formatCurrencyShort, formatNumber, formatPercent } from '../utils/format';
import { formatDate, toDateInputValue } from '../utils/date';
import { useToast } from '../components/ui/Toast';

export function ReportsPage() {
  const { leads, activities, stages, dataset } = useData();
  const toast = useToast();
  const [preset, setPreset] = useState<PeriodPresetId>('90d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const earliest = useMemo(() => {
    if (leads.length === 0) return null;
    return leads.reduce<Date>((oldest, lead) => {
      const created = new Date(lead.createdAt);
      return created < oldest ? created : oldest;
    }, new Date());
  }, [leads]);

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

  const report = useMemo(
    () => buildReport(leads, activities, stages, period),
    [leads, activities, stages, period],
  );

  const handleExport = () => {
    const sections: (string | number)[][] = [];
    sections.push(['Relatório ALINHO']);
    sections.push(['Período', formatDate(period.from), formatDate(period.to)]);
    sections.push([]);
    sections.push(['Indicador', 'Valor']);
    sections.push(['Leads criados no período', report.leadCount]);
    sections.push(['Oportunidades ganhas', report.won]);
    sections.push(['Oportunidades perdidas', report.lost]);
    sections.push(['Oportunidades em aberto', report.open]);
    sections.push(['Taxa de conversão (%)', report.conversionRate.toFixed(1).replace('.', ',')]);
    sections.push(['Valor ganho (R$)', report.wonValue.toFixed(2).replace('.', ',')]);
    sections.push(['Valor em aberto (R$)', report.openValue.toFixed(2).replace('.', ',')]);
    sections.push(['Ticket médio ganho (R$)', report.averageTicket.toFixed(2).replace('.', ',')]);
    sections.push(['Atividades concluídas', report.activitiesDone]);
    sections.push([]);

    const appendBreakdown = (title: string, rows: { label: string; count: number; value: number }[]) => {
      sections.push([title, 'Quantidade', 'Valor potencial (R$)']);
      for (const row of rows) {
        sections.push([row.label, row.count, row.value.toFixed(2).replace('.', ',')]);
      }
      sections.push([]);
    };

    appendBreakdown('Origem', report.bySource);
    appendBreakdown('Segmento', report.bySegment);
    appendBreakdown('Etapa', report.byStage);
    appendBreakdown('Cidade', report.byCity);

    sections.push(['Mês', 'Criados', 'Ganhos', 'Perdidos']);
    for (const row of report.timeline) {
      sections.push([row.label, row.created, row.won, row.lost]);
    }

    downloadTextFile(
      `alinho-relatorio_${fileStamp()}.csv`,
      toCsv(['ALINHO', '', ''], sections),
      'text/csv',
    );
    toast.success('Relatório exportado', 'Arquivo CSV gerado no seu dispositivo.');
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={dataset === 'demo' ? 'Demonstração' : 'Análise'}
          title="Relatórios"
          description="Métricas calculadas a partir dos seus registros."
        />
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="Sem dados para analisar"
            description="Cadastre leads e registre o andamento das oportunidades. Os relatórios passam a ser calculados automaticamente, sem estimativas."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={dataset === 'demo' ? 'Demonstração' : 'Análise'}
        title="Relatórios"
        description={`Período analisado: ${formatDate(period.from)} a ${formatDate(period.to)}`}
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Exportar CSV
          </Button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-5">
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
        </div>
      </Panel>

      <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Leads no período" value={formatNumber(report.leadCount)} />
        <MetricTile label="Ganhas" value={formatNumber(report.won)} tone="positive" hint={formatCurrencyShort(report.wonValue)} />
        <MetricTile label="Perdidas" value={formatNumber(report.lost)} tone={report.lost > 0 ? 'critical' : 'neutral'} />
        <MetricTile
          label="Conversão"
          value={report.won + report.lost > 0 ? formatPercent(report.conversionRate) : '—'}
          hint={report.won + report.lost > 0 ? `${report.won} de ${report.won + report.lost}` : 'sem oportunidades encerradas'}
        />
      </section>

      <section aria-label="Valores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Valor em aberto" value={formatCurrencyShort(report.openValue)} hint={`${formatNumber(report.open)} oportunidade(s)`} />
        <MetricTile label="Valor ganho" value={formatCurrencyShort(report.wonValue)} tone="positive" />
        <MetricTile
          label="Ticket médio ganho"
          value={report.averageTicket > 0 ? formatCurrency(report.averageTicket) : '—'}
        />
        <MetricTile
          label="Atividades concluídas"
          value={formatNumber(report.activitiesDone)}
          hint={`${formatNumber(report.activitiesPending)} pendente(s) no período`}
        />
      </section>

      <Panel>
        <PanelHeader title="Evolução comercial" description="Leads criados, ganhos e perdidos por mês" />
        <div className="px-4 py-4 sm:px-5">
          <ColumnChart
            data={report.timeline.map((row) => ({
              label: row.label,
              values: { created: row.created, won: row.won, lost: row.lost },
            }))}
            series={[
              { key: 'created', label: 'Criados', className: 'bg-accent/80' },
              { key: 'won', label: 'Ganhos', className: 'bg-positive/80' },
              { key: 'lost', label: 'Perdidos', className: 'bg-critical/70' },
            ]}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Origem dos leads" description="Leads criados no período" />
          <div className="px-4 py-4 sm:px-5">
            <BarList items={report.bySource} maxItems={8} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Segmentos mais prospectados" />
          <div className="px-4 py-4 sm:px-5">
            <BarList items={report.bySegment} maxItems={8} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Leads por etapa" description="Distribuição dos leads criados no período" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={report.byStage.map((row) => ({
                label: row.label,
                value: row.count,
                meta: row.value > 0 ? formatCurrencyShort(row.value) : undefined,
              }))}
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Atividades realizadas" description="Concluídas no período, por tipo" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={report.activitiesByType}
              tone="positive"
              emptyLabel="Nenhuma atividade concluída no período."
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHeader title="Cidades" description="Onde estão os leads criados no período" />
          <div className="px-4 py-4 sm:px-5">
            <BarList items={report.byCity} maxItems={10} tone="neutral" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
