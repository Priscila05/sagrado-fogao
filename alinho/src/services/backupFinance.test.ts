import { describe, expect, it } from 'vitest';
import { buildBackup, readBackup } from './backup';
import { buildContract, buildExpense, buildPayment } from './finance';
import { createDefaultSettings } from '../models/defaults';
import { normalizeLead } from '../models/normalize';

const settings = createDefaultSettings();

describe('backup com o módulo financeiro', () => {
  const contract = buildContract(
    { clientName: 'Cantina Dona Marta', projectName: 'Site', totalValue: 3000, installments: 2 },
    'real',
  );
  const payment = buildPayment(
    { contractId: contract.id, sequence: 1, label: 'Parcela 1/2', amount: 1500, status: 'pago', paidAmount: 1500 },
    'real',
  );
  const expense = buildExpense({ description: 'Hospedagem', amount: 300, status: 'paga' }, 'real');

  it('exporta na versão 2 com contratos, pagamentos e despesas', () => {
    const backup = buildBackup({
      leads: [],
      companies: [],
      activities: [],
      interactions: [],
      contracts: [contract],
      payments: [payment],
      expenses: [expense],
      settings,
    });
    expect(backup.version).toBe(2);
    expect(backup.counts.contracts).toBe(1);
    expect(backup.counts.payments).toBe(1);
    expect(backup.counts.expenses).toBe(1);

    const result = readBackup(JSON.stringify(backup));
    expect(result.ok).toBe(true);
    expect(result.payload?.contracts).toHaveLength(1);
    expect(result.payload?.payments[0].paidAmount).toBe(1500);
    expect(result.payload?.expenses[0].description).toBe('Hospedagem');
    expect(result.summary?.contracts).toBe(1);
  });

  it('importa um backup da versão 1, sem o financeiro, sem quebrar', () => {
    const legacy = {
      format: 'alinho-backup',
      version: 1,
      exportedAt: '2026-05-01T12:00:00.000Z',
      appVersion: '1.0.0',
      counts: { leads: 1, companies: 0, activities: 0, interactions: 0 },
      data: {
        leads: [normalizeLead({ id: 'l1', establishmentName: 'Pet Shop' })],
        companies: [],
        activities: [],
        interactions: [],
        settings: {
          ...settings,
          // o arquivo antigo não conhece as listas do financeiro
          expenseCategories: undefined,
          paymentMethods: undefined,
        },
      },
    };
    const result = readBackup(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    expect(result.payload?.leads).toHaveLength(1);
    expect(result.payload?.contracts).toEqual([]);
    expect(result.payload?.payments).toEqual([]);
    expect(result.payload?.expenses).toEqual([]);
    // as listas do financeiro voltam com os padrões
    expect(result.payload?.settings.expenseCategories.length).toBeGreaterThan(0);
    expect(result.payload?.settings.paymentMethods.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('antes do módulo financeiro'))).toBe(true);
  });

  it('repara vínculos financeiros órfãos', () => {
    const result = readBackup(
      JSON.stringify({
        format: 'alinho-backup',
        version: 2,
        data: {
          leads: [],
          companies: [],
          activities: [],
          interactions: [],
          contracts: [
            { id: 'ct1', projectName: 'Site', clientName: 'X', totalValue: 1000, companyId: 'fantasma' },
          ],
          payments: [{ id: 'pg1', contractId: 'inexistente', label: 'Parcela', amount: 100 }],
          expenses: [{ id: 'ex1', description: 'Custo', amount: 50, contractId: 'inexistente' }],
          settings,
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.payload?.contracts[0].companyId).toBeNull();
    expect(result.payload?.payments[0].contractId).toBeNull();
    expect(result.payload?.payments[0].kind).toBe('avulso');
    expect(result.payload?.expenses[0].contractId).toBeNull();
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('recusa um arquivo com coleções financeiras corrompidas sem travar', () => {
    const result = readBackup(
      JSON.stringify({
        format: 'alinho-backup',
        version: 2,
        data: {
          leads: [],
          companies: [],
          activities: [],
          interactions: [],
          contracts: 'isso não é uma lista',
          payments: null,
          expenses: 42,
          settings,
        },
      }),
    );
    // coleções do financeiro são opcionais: entram vazias em vez de invalidar
    expect(result.ok).toBe(true);
    expect(result.payload?.contracts).toEqual([]);
    expect(result.payload?.payments).toEqual([]);
    expect(result.payload?.expenses).toEqual([]);
  });
});
