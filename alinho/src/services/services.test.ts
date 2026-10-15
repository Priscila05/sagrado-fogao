import { describe, expect, it } from 'vitest';
import { buildBackup, readBackup } from './backup';
import { bucketActivities, computeDashboard, nextActivityForLead } from './metrics';
import { buildReport, resolvePeriod } from './reports';
import { findDuplicateGroups, findPossibleMatches } from './duplicates';
import { buildDemoDataset } from './demo';
import { applyStageChange, buildActivity, buildLead, firstStageId } from './crm';
import { leadsToCsv, buildCsvPreview, mapCsvRowsToLeads } from './leadsCsv';
import { createDefaultSettings, DEFAULT_STAGES } from '../models/defaults';
import { normalizeLead } from '../models/normalize';
import { addDays, endOfDay } from '../utils/date';
import type { Activity, Lead } from '../models/types';

const stages = DEFAULT_STAGES;
const settings = createDefaultSettings();

function lead(partial: Partial<Lead>): Lead {
  return normalizeLead({ establishmentName: 'Teste', ...partial });
}

function activity(partial: Partial<Activity>): Activity {
  return buildActivity({ title: 'Atividade', ...partial }, 'real');
}

describe('backup', () => {
  const payload = {
    leads: [lead({ id: 'lead-1', companyId: 'empresa-1', stageId: 'interessado' })],
    companies: [
      {
        ...createDefaultSettings(),
      },
    ] as never,
    activities: [],
    interactions: [],
    settings,
  };

  it('exporta e relê o próprio arquivo sem perda', () => {
    const backup = buildBackup({
      leads: payload.leads,
      companies: [],
      activities: [],
      interactions: [],
      contracts: [],
      payments: [],
      expenses: [],
      settings,
    });
    const result = readBackup(JSON.stringify(backup));
    expect(result.ok).toBe(true);
    expect(result.payload?.leads).toHaveLength(1);
    expect(result.payload?.leads[0].establishmentName).toBe('Teste');
  });

  it('recusa JSON malformado', () => {
    const result = readBackup('{ isso não é json');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('JSON');
  });

  it('recusa arquivo de outro sistema', () => {
    const result = readBackup(JSON.stringify({ format: 'outro-crm', version: 1, data: {} }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('não é um backup do ALINHO');
  });

  it('recusa versão de formato mais nova', () => {
    const result = readBackup(
      JSON.stringify({ format: 'alinho-backup', version: 99, data: { leads: [] } }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('versão mais nova');
  });

  it('recusa estrutura sem as coleções obrigatórias', () => {
    const result = readBackup(
      JSON.stringify({ format: 'alinho-backup', version: 1, data: { leads: [] } }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('companies');
  });

  it('repara vínculos órfãos e avisa', () => {
    const result = readBackup(
      JSON.stringify({
        format: 'alinho-backup',
        version: 1,
        data: {
          leads: [{ id: 'l1', establishmentName: 'Loja', companyId: 'inexistente', stageId: 'zzz' }],
          companies: [],
          activities: [{ id: 'a1', title: 'Ligar', leadId: 'fantasma' }],
          interactions: [{ id: 'i1', leadId: 'fantasma', description: 'nada' }],
          settings,
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.payload?.leads[0].companyId).toBeNull();
    expect(result.payload?.leads[0].stageId).toBe(DEFAULT_STAGES[0].id);
    expect(result.payload?.activities[0].leadId).toBeNull();
    expect(result.payload?.interactions).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('descarta identificadores duplicados', () => {
    const result = readBackup(
      JSON.stringify({
        format: 'alinho-backup',
        version: 1,
        data: {
          leads: [
            { id: 'dup', establishmentName: 'A' },
            { id: 'dup', establishmentName: 'B' },
          ],
          companies: [],
          activities: [],
          interactions: [],
          settings,
        },
      }),
    );
    expect(result.payload?.leads).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes('duplicado'))).toBe(true);
  });
});

describe('indicadores do painel', () => {
  const leads = [
    lead({ id: 'a', stageId: 'novo', potentialValue: 1000 }),
    lead({ id: 'b', stageId: 'negociacao', potentialValue: 2000 }),
    lead({ id: 'c', stageId: 'ganho', potentialValue: 3000, wonAt: new Date().toISOString() }),
    lead({ id: 'd', stageId: 'perdido', potentialValue: 500, lostAt: new Date().toISOString() }),
  ];
  const activities = [
    activity({ dueAt: addDays(new Date(), -1).toISOString(), leadId: 'a' }),
    activity({ dueAt: endOfDay().toISOString(), leadId: 'b' }),
    activity({ dueAt: addDays(new Date(), 3).toISOString(), leadId: 'b' }),
    activity({ dueAt: addDays(new Date(), 30).toISOString(), done: true }),
  ];

  it('conta oportunidades por situação e soma valores reais', () => {
    const metrics = computeDashboard(leads, activities, stages);
    expect(metrics.totalLeads).toBe(4);
    expect(metrics.openOpportunities).toBe(2);
    expect(metrics.wonOpportunities).toBe(1);
    expect(metrics.lostOpportunities).toBe(1);
    expect(metrics.pipelineValue).toBe(3000);
    expect(metrics.wonValue).toBe(3000);
    expect(metrics.conversionRate).toBe(50);
  });

  it('não inventa números quando não há dados', () => {
    const metrics = computeDashboard([], [], stages);
    expect(metrics.totalLeads).toBe(0);
    expect(metrics.conversionRate).toBe(0);
    expect(metrics.pipelineValue).toBe(0);
    expect(metrics.leadsOverTime.every((point) => point.count === 0)).toBe(true);
  });

  it('separa atividades em atrasadas, hoje e próximos dias', () => {
    const buckets = bucketActivities(activities);
    expect(buckets.overdue).toHaveLength(1);
    expect(buckets.today).toHaveLength(1);
    expect(buckets.next7).toHaveLength(1);
    expect(buckets.done).toHaveLength(1);

    const metrics = computeDashboard(leads, activities, stages);
    expect(metrics.overdueActivities).toBe(1);
    expect(metrics.todayActivities).toBe(1);
  });

  it('encontra a próxima atividade pendente de um lead', () => {
    const next = nextActivityForLead(activities, 'b');
    expect(next).not.toBeNull();
    expect(new Date(next!.dueAt).getTime()).toBeLessThanOrEqual(
      addDays(new Date(), 3).getTime() + 1000,
    );
  });
});

describe('relatórios', () => {
  it('agrupa por origem, segmento e etapa no período', () => {
    const leads = [
      lead({ id: '1', source: 'Indicação', segment: 'Pet shop', city: 'Curitiba', potentialValue: 1000 }),
      lead({ id: '2', source: 'Indicação', segment: 'Restaurante', city: 'Curitiba', potentialValue: 2000 }),
      lead({ id: '3', source: 'Instagram', segment: 'Pet shop', city: 'Pinhais', potentialValue: 500 }),
    ];
    const report = buildReport(leads, [], stages, resolvePeriod('30d', null));
    expect(report.leadCount).toBe(3);
    expect(report.bySource[0]).toMatchObject({ label: 'Indicação', count: 2 });
    expect(report.bySegment[0]).toMatchObject({ label: 'Pet shop', count: 2 });
    expect(report.byCity[0]).toMatchObject({ label: 'Curitiba', count: 2 });
    expect(report.openValue).toBe(3500);
  });

  it('calcula conversão e ticket médio apenas com oportunidades encerradas', () => {
    const now = new Date().toISOString();
    const leads = [
      lead({ id: 'g', stageId: 'ganho', wonAt: now, potentialValue: 4000 }),
      lead({ id: 'p', stageId: 'perdido', lostAt: now, potentialValue: 1000 }),
    ];
    const report = buildReport(leads, [], stages, resolvePeriod('30d', null));
    expect(report.won).toBe(1);
    expect(report.lost).toBe(1);
    expect(report.conversionRate).toBe(50);
    expect(report.averageTicket).toBe(4000);

    const empty = buildReport([], [], stages, resolvePeriod('30d', null));
    expect(empty.conversionRate).toBe(0);
    expect(empty.averageTicket).toBe(0);
  });
});

describe('duplicidade', () => {
  it('agrupa por telefone e e-mail repetidos sem bloquear', () => {
    const leads = [
      lead({ id: '1', phone: '41999998888', email: 'a@b.com.br' }),
      lead({ id: '2', whatsapp: '(41) 99999-8888' }),
      lead({ id: '3', email: 'A@B.com.br' }),
      lead({ id: '4', phone: '4133334444' }),
    ];
    const groups = findDuplicateGroups(leads);
    expect(groups.length).toBe(2);
    expect(findPossibleMatches(leads, { phone: '41999998888' }, '1').map((l) => l.id)).toEqual(['2']);
    expect(findPossibleMatches(leads, { phone: '41000000000' })).toHaveLength(0);
  });
});

describe('etapas e demonstração', () => {
  it('marca data de ganho e limpa a de perda ao mudar de etapa', () => {
    const base = lead({ id: 'x', stageId: 'negociacao' });
    const won = applyStageChange(base, stages, 'ganho');
    expect(won.wonAt).not.toBeNull();
    expect(won.lostAt).toBeNull();
    const reopened = applyStageChange(won, stages, 'negociacao');
    expect(reopened.wonAt).toBeNull();
  });

  it('cria leads na primeira etapa por padrão', () => {
    const created = buildLead({ establishmentName: 'Nova Loja' }, 'real', firstStageId(stages));
    expect(created.stageId).toBe('novo');
    expect(created.dataset).toBe('real');
  });

  it('gera demonstração marcada e isolada', () => {
    const demo = buildDemoDataset(stages);
    expect(demo.leads.length).toBeGreaterThan(5);
    expect(demo.leads.every((row) => row.dataset === 'demo')).toBe(true);
    expect(demo.companies.every((row) => row.name.includes('(demo)'))).toBe(true);
    expect(demo.leads.every((row) => row.phone.startsWith('1190000'))).toBe(true);
    expect(demo.interactions.every((row) => row.dataset === 'demo')).toBe(true);
  });

  it('inclui financeiro de demonstração coerente e marcado', () => {
    const demo = buildDemoDataset(stages);
    expect(demo.contracts.length).toBeGreaterThan(0);
    expect(demo.contracts.every((row) => row.dataset === 'demo')).toBe(true);
    expect(demo.contracts.every((row) => row.projectName.includes('(demo)'))).toBe(true);
    expect(demo.payments.every((row) => row.dataset === 'demo')).toBe(true);
    expect(demo.expenses.every((row) => row.dataset === 'demo')).toBe(true);

    for (const contract of demo.contracts) {
      const own = demo.payments.filter((payment) => payment.contractId === contract.id);
      const total = own.reduce((sum, payment) => sum + payment.amount, 0);
      // a agenda de demonstração fecha exatamente com o valor do contrato
      expect(Number(total.toFixed(2))).toBe(contract.totalValue);
      expect(own.some((payment) => payment.status === 'pago')).toBe(true);
      expect(own.some((payment) => payment.status === 'pendente')).toBe(true);
    }
    // despesas de demonstração cobrem os dois estados
    expect(demo.expenses.some((row) => row.status === 'paga')).toBe(true);
    expect(demo.expenses.some((row) => row.status === 'prevista')).toBe(true);
  });
});

describe('CSV de leads', () => {
  it('exporta cabeçalhos em português', () => {
    const csv = leadsToCsv([lead({ establishmentName: 'Pet Shop', potentialValue: 1500 })], stages);
    expect(csv).toContain('Estabelecimento');
    expect(csv).toContain('Pet Shop');
    expect(csv).toContain('1500,00');
  });

  it('sugere o mapeamento das colunas e importa as linhas válidas', () => {
    const text =
      'Estabelecimento;Contato;Telefone;Valor potencial;Etapa;Prioridade\n' +
      'Pet Shop Patas;Ana;(41) 99999-8888;1.500,00;Interessado;Alta\n' +
      ';;;;;\n' +
      'Cantina;Marta;4133334444;2000;Etapa Inexistente;baixa\n';
    const preview = buildCsvPreview(text);
    expect(preview.mapping[0]).toBe('establishmentName');
    expect(preview.mapping[1]).toBe('contactName');
    expect(preview.mapping[3]).toBe('potentialValue');

    const { rows } = { rows: text.split('\n').slice(1, 4).map((line) => line.split(';')) };
    const result = mapCsvRowsToLeads(preview, rows, stages);
    expect(result.leads).toHaveLength(2);
    expect(result.skipped).toBe(1);
    expect(result.leads[0]).toMatchObject({
      establishmentName: 'Pet Shop Patas',
      potentialValue: 1500,
      priority: 'alta',
      stageId: 'interessado',
    });
    expect(result.issues.some((issue) => issue.includes('Etapa Inexistente'))).toBe(true);
  });
});
