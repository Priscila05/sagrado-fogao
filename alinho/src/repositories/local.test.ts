import { beforeEach, describe, expect, it } from 'vitest';
import { repositories } from './index';
import { resetBackend, getBackend, backendKind } from '../db/backend';
import { buildActivity, buildCompany, buildInteraction, buildLead } from '../services/crm';
import { createDefaultSettings, DEFAULT_STAGES } from '../models/defaults';

/** Exercises the real persistence path (fake-indexeddb implements the same API). */
describe('repositórios locais', () => {
  beforeEach(async () => {
    resetBackend();
    const backend = await getBackend();
    await backend.clearAll();
  });

  it('usa IndexedDB quando disponível', async () => {
    await getBackend();
    expect(backendKind()).toBe('indexeddb');
  });

  it('cria, lê, atualiza e remove um lead', async () => {
    const lead = buildLead({ establishmentName: 'Pet Shop Patas', phone: '41999998888' }, 'real', 'novo');
    await repositories.leads.save(lead);

    const stored = await repositories.leads.get(lead.id);
    expect(stored?.establishmentName).toBe('Pet Shop Patas');

    await repositories.leads.save({ ...lead, establishmentName: 'Pet Shop Patas Felizes' });
    const updated = await repositories.leads.get(lead.id);
    expect(updated?.establishmentName).toBe('Pet Shop Patas Felizes');
    expect(await repositories.leads.list()).toHaveLength(1);

    await repositories.leads.remove(lead.id);
    expect(await repositories.leads.get(lead.id)).toBeUndefined();
    expect(await repositories.leads.list()).toHaveLength(0);
  });

  it('mantém os dados após reabrir a conexão com o banco', async () => {
    const lead = buildLead({ establishmentName: 'Cantina Dona Marta' }, 'real', 'novo');
    await repositories.leads.save(lead);

    // Simulates closing and reopening the application.
    resetBackend();
    const reloaded = await repositories.leads.get(lead.id);
    expect(reloaded?.establishmentName).toBe('Cantina Dona Marta');
  });

  it('separa os conjuntos real e demonstração', async () => {
    await repositories.leads.save(buildLead({ establishmentName: 'Real' }, 'real', 'novo'));
    await repositories.leads.save(buildLead({ establishmentName: 'Demo' }, 'demo', 'novo'));

    expect(await repositories.leads.list('real')).toHaveLength(1);
    expect(await repositories.leads.list('demo')).toHaveLength(1);

    await repositories.clearDataset('demo');
    expect(await repositories.leads.list('demo')).toHaveLength(0);
    expect(await repositories.leads.list('real')).toHaveLength(1);
  });

  it('consulta por índices de relacionamento', async () => {
    const company = buildCompany({ name: 'Empresa A' }, 'real');
    await repositories.companies.save(company);
    const lead = buildLead({ establishmentName: 'Loja', companyId: company.id }, 'real', 'novo');
    await repositories.leads.save(lead);
    await repositories.activities.save(
      buildActivity({ title: 'Ligar', leadId: lead.id, companyId: company.id }, 'real'),
    );
    await repositories.interactions.save(
      buildInteraction({ leadId: lead.id, type: 'observacao', description: 'nota' }, 'real'),
    );

    expect(await repositories.leads.listByCompany(company.id)).toHaveLength(1);
    expect(await repositories.activities.listByLead(lead.id)).toHaveLength(1);
    expect(await repositories.activities.listByCompany(company.id)).toHaveLength(1);
    expect(await repositories.interactions.listByLead(lead.id)).toHaveLength(1);
  });

  it('grava configurações padrão na primeira leitura e persiste alterações', async () => {
    const settings = await repositories.settings.read();
    expect(settings.stages).toHaveLength(DEFAULT_STAGES.length);
    expect(settings.activeDataset).toBe('real');

    await repositories.settings.write({ ...settings, sources: ['Indicação'] });
    const reread = await repositories.settings.read();
    expect(reread.sources).toEqual(['Indicação']);
  });

  it('sanitiza na gravação, mesmo com dados inválidos', async () => {
    const saved = await repositories.leads.save({
      ...buildLead({ establishmentName: 'X' }, 'real', 'novo'),
      potentialValue: -99 as number,
      priority: 'inexistente' as never,
    });
    expect(saved.potentialValue).toBe(0);
    expect(saved.priority).toBe('media');
  });

  it('substitui todas as coleções ao importar um backup', async () => {
    await repositories.leads.save(buildLead({ establishmentName: 'Antigo' }, 'real', 'novo'));
    const novo = buildLead({ establishmentName: 'Importado' }, 'real', 'novo');

    await repositories.replaceAll({
      leads: [novo],
      companies: [],
      activities: [],
      interactions: [],
      contracts: [],
      payments: [],
      expenses: [],
      settings: createDefaultSettings(),
    });

    const leads = await repositories.leads.list();
    expect(leads).toHaveLength(1);
    expect(leads[0].establishmentName).toBe('Importado');
  });
});
