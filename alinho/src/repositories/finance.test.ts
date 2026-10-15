import { beforeEach, describe, expect, it } from 'vitest';
import { repositories } from './index';
import { getBackend, resetBackend } from '../db/backend';
import { buildContract, buildExpense, buildPayment, syncContractSchedule } from '../services/finance';
import { createDefaultSettings } from '../models/defaults';

describe('persistência do financeiro', () => {
  beforeEach(async () => {
    resetBackend();
    const backend = await getBackend();
    await backend.clearAll();
  });

  it('cria, lê, atualiza e remove um contrato', async () => {
    const contract = buildContract(
      { projectName: 'Site institucional', clientName: 'Cantina', totalValue: 3000, installments: 3 },
      'real',
    );
    await repositories.contracts.save(contract);

    expect((await repositories.contracts.get(contract.id))?.projectName).toBe('Site institucional');

    await repositories.contracts.save({ ...contract, totalValue: 4000 });
    expect((await repositories.contracts.get(contract.id))?.totalValue).toBe(4000);

    await repositories.contracts.remove(contract.id);
    expect(await repositories.contracts.list()).toHaveLength(0);
  });

  it('grava a agenda gerada e a mantém após reabrir o banco', async () => {
    const contract = buildContract({ projectName: 'App', totalValue: 1200, installments: 3 }, 'real');
    await repositories.contracts.save(contract);
    const { created } = syncContractSchedule(contract, []);
    await repositories.payments.saveMany(created);

    resetBackend(); // simula fechar e reabrir o aplicativo
    const stored = await repositories.payments.listByContract(contract.id);
    expect(stored).toHaveLength(3);
    expect(stored.reduce((total, payment) => total + payment.amount, 0)).toBe(1200);
  });

  it('consulta despesas por contrato', async () => {
    const contract = buildContract({ projectName: 'Loja', totalValue: 500 }, 'real');
    await repositories.contracts.save(contract);
    await repositories.expenses.save(
      buildExpense({ description: 'Domínio', amount: 60, contractId: contract.id }, 'real'),
    );
    await repositories.expenses.save(buildExpense({ description: 'Café', amount: 10 }, 'real'));

    expect(await repositories.expenses.listByContract(contract.id)).toHaveLength(1);
    expect(await repositories.expenses.list()).toHaveLength(2);
  });

  it('separa financeiro real do de demonstração', async () => {
    await repositories.contracts.save(buildContract({ projectName: 'Real', totalValue: 100 }, 'real'));
    await repositories.contracts.save(buildContract({ projectName: 'Demo', totalValue: 100 }, 'demo'));
    await repositories.payments.save(buildPayment({ amount: 50 }, 'demo'));

    expect(await repositories.contracts.list('real')).toHaveLength(1);
    await repositories.clearDataset('demo');
    expect(await repositories.contracts.list('demo')).toHaveLength(0);
    expect(await repositories.payments.list('demo')).toHaveLength(0);
    expect(await repositories.contracts.list('real')).toHaveLength(1);
  });

  it('substitui também as coleções financeiras ao importar um backup', async () => {
    await repositories.contracts.save(buildContract({ projectName: 'Antigo', totalValue: 100 }, 'real'));
    await repositories.payments.save(buildPayment({ amount: 100 }, 'real'));

    const novo = buildContract({ projectName: 'Importado', totalValue: 900 }, 'real');
    await repositories.replaceAll({
      leads: [],
      companies: [],
      activities: [],
      interactions: [],
      contracts: [novo],
      payments: [],
      expenses: [buildExpense({ description: 'Importada', amount: 10 }, 'real')],
      settings: createDefaultSettings(),
    });

    const contracts = await repositories.contracts.list();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].projectName).toBe('Importado');
    expect(await repositories.payments.list()).toHaveLength(0);
    expect(await repositories.expenses.list()).toHaveLength(1);
  });

  it('abre o banco já existente na versão 2 com as lojas do financeiro', async () => {
    const backend = await getBackend();
    // uma gravação em cada loja nova prova que a migração criou todas
    await backend.put('contracts', buildContract({ projectName: 'X', totalValue: 1 }, 'real'));
    await backend.put('payments', buildPayment({ amount: 1 }, 'real'));
    await backend.put('expenses', buildExpense({ description: 'Y', amount: 1 }, 'real'));
    expect(await repositories.contracts.list()).toHaveLength(1);
    expect(await repositories.payments.list()).toHaveLength(1);
    expect(await repositories.expenses.list()).toHaveLength(1);
  });
});
