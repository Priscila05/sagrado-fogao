import { describe, expect, it } from 'vitest';
import {
  billableContracts,
  buildContract,
  buildExpense,
  buildLedger,
  buildPayment,
  computeFinanceMetrics,
  contractSummary,
  paymentDisplayStatus,
  planSchedule,
  syncContractSchedule,
} from './finance';
import { normalizeContract, normalizeExpense, normalizePayment } from '../models/normalize';
import { addDays } from '../utils/date';
import type { Contract, Payment } from '../models/finance';

function contractOf(partial: Partial<Contract> = {}): Contract {
  return normalizeContract({
    id: 'c1',
    clientName: 'Cliente',
    projectName: 'Projeto',
    totalValue: 3000,
    signedAt: '2026-01-10T12:00:00.000Z',
    firstDueAt: '2026-02-10T12:00:00.000Z',
    downPayment: 0,
    installments: 3,
    status: 'ativo',
    ...partial,
  });
}

const soma = (payments: { amount: number }[]) =>
  Number(payments.reduce((total, p) => total + p.amount, 0).toFixed(2));

describe('agenda de parcelas', () => {
  it('divide o valor total entre as parcelas, sem sobra de centavos', () => {
    const slots = planSchedule(contractOf({ totalValue: 1000, installments: 3 }));
    expect(slots).toHaveLength(3);
    expect(soma(slots)).toBe(1000);
    expect(slots[0].amount).toBeCloseTo(333.33, 2);
    expect(slots[2].amount).toBeCloseTo(333.34, 2);
  });

  it('gera entrada na data do contrato e parcelas mensais', () => {
    const slots = planSchedule(
      contractOf({ totalValue: 3000, downPayment: 900, installments: 3 }),
    );
    expect(slots).toHaveLength(4);
    expect(slots[0]).toMatchObject({ sequence: 0, kind: 'entrada', amount: 900 });
    expect(slots[1].amount).toBe(700);
    expect(soma(slots)).toBe(3000);
    // vencimentos mês a mês a partir do primeiro
    expect(new Date(slots[1].dueAt).getMonth()).toBe(1);
    expect(new Date(slots[2].dueAt).getMonth()).toBe(2);
    expect(new Date(slots[3].dueAt).getMonth()).toBe(3);
  });

  it('cria uma cobrança única quando não há entrada nem parcelas', () => {
    const slots = planSchedule(contractOf({ totalValue: 500, installments: 0, downPayment: 0 }));
    expect(slots).toHaveLength(1);
    expect(slots[0].amount).toBe(500);
  });

  it('redistribui apenas o que falta receber, preservando o já pago', () => {
    const pago = new Map([[1, 1000]]);
    const slots = planSchedule(contractOf({ totalValue: 3000, installments: 3 }), pago);
    expect(slots[0].amount).toBe(1000);
    expect(slots[1].amount).toBe(1000);
    expect(slots[2].amount).toBe(1000);
    expect(soma(slots)).toBe(3000);
  });
});

describe('reconciliação ao editar contrato', () => {
  it('não duplica parcelas quando o contrato é salvo novamente', () => {
    const contract = contractOf({ totalValue: 3000, installments: 3 });
    const first = syncContractSchedule(contract, []);
    expect(first.created).toHaveLength(3);

    const second = syncContractSchedule(contract, first.created);
    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(0);
    expect(second.kept).toHaveLength(3);
  });

  it('recalcula as parcelas em aberto e mantém as pagas intactas', () => {
    const contract = contractOf({ totalValue: 3000, installments: 3 });
    const { created } = syncContractSchedule(contract, []);
    const pago: Payment = normalizePayment({
      ...created[0],
      status: 'pago',
      paidAmount: 1000,
      paidAt: '2026-02-10T12:00:00.000Z',
    });
    const existing = [pago, created[1], created[2]];

    const maior = { ...contract, totalValue: 4000 };
    const result = syncContractSchedule(maior, existing);

    expect(result.created).toHaveLength(0);
    expect(result.kept.map((p) => p.id)).toContain(pago.id);
    expect(result.updated).toHaveLength(2);
    // R$ 4.000 − R$ 1.000 recebidos = R$ 3.000 divididos em duas parcelas
    expect(result.updated.every((p) => p.amount === 1500)).toBe(true);
    const total = [...result.kept, ...result.updated].reduce(
      (sum, p) => sum + (p.status === 'pago' ? p.paidAmount : p.amount),
      0,
    );
    expect(total).toBe(4000);
  });

  it('remove parcelas em aberto que deixaram de existir, nunca as pagas', () => {
    const contract = contractOf({ totalValue: 3000, installments: 3 });
    const { created } = syncContractSchedule(contract, []);
    const pago = normalizePayment({ ...created[2], status: 'pago', paidAmount: 1000 });
    const existing = [created[0], created[1], pago];

    const menor = { ...contract, installments: 1 };
    const result = syncContractSchedule(menor, existing);

    expect(result.removed.map((p) => p.id)).toEqual([created[1].id]);
    expect(result.kept.map((p) => p.id)).toContain(pago.id);
    expect(result.removed.some((p) => p.status === 'pago')).toBe(false);
  });

  it('preserva lançamentos avulsos ao recalcular a agenda', () => {
    const contract = contractOf();
    const { created } = syncContractSchedule(contract, []);
    const avulso = buildPayment(
      { contractId: contract.id, kind: 'avulso', sequence: 99, label: 'Extra', amount: 200 },
      'real',
    );
    const result = syncContractSchedule(contract, [...created, avulso]);
    expect(result.removed.find((p) => p.id === avulso.id)).toBeUndefined();
  });
});

describe('situação dos pagamentos', () => {
  it('deriva "vencido" da data, sem gravar no registro', () => {
    const vencido = buildPayment({ dueAt: addDays(new Date(), -3).toISOString(), amount: 100 }, 'real');
    const futuro = buildPayment({ dueAt: addDays(new Date(), 3).toISOString(), amount: 100 }, 'real');
    expect(paymentDisplayStatus(vencido)).toBe('vencido');
    expect(paymentDisplayStatus(futuro)).toBe('pendente');
    expect(vencido.status).toBe('pendente');
  });

  it('nunca guarda valor recebido em parcela pendente', () => {
    const pendente = normalizePayment({ status: 'pendente', amount: 500, paidAmount: 500 });
    expect(pendente.paidAmount).toBe(0);
    expect(pendente.paidAt).toBeNull();
  });

  it('assume o valor previsto quando o pago não informa o recebido', () => {
    const pago = normalizePayment({ status: 'pago', amount: 500, paidAmount: 0 });
    expect(pago.paidAmount).toBe(500);
    expect(pago.paidAt).not.toBeNull();
  });
});

describe('indicadores financeiros', () => {
  const contract = contractOf({ totalValue: 3000, installments: 3 });
  const slots = planSchedule(contract);
  const payments: Payment[] = [
    normalizePayment({
      id: 'p1',
      contractId: 'c1',
      sequence: 1,
      amount: slots[0].amount,
      dueAt: addDays(new Date(), -40).toISOString(),
      status: 'pago',
      paidAmount: 1000,
      paidAt: new Date().toISOString(),
    }),
    normalizePayment({
      id: 'p2',
      contractId: 'c1',
      sequence: 2,
      amount: 1000,
      dueAt: addDays(new Date(), -5).toISOString(),
      status: 'pendente',
    }),
    normalizePayment({
      id: 'p3',
      contractId: 'c1',
      sequence: 3,
      amount: 1000,
      dueAt: addDays(new Date(), 20).toISOString(),
      status: 'pendente',
    }),
  ];
  const expenses = [
    normalizeExpense({ id: 'e1', description: 'Hospedagem', amount: 300, status: 'paga', category: 'Infra' }),
    normalizeExpense({ id: 'e2', description: 'Anúncios', amount: 500, status: 'prevista' }),
  ];

  it('separa contratado, recebido, a receber e vencido', () => {
    const metrics = computeFinanceMetrics([contract], payments, expenses);
    expect(metrics.contractedTotal).toBe(3000);
    expect(metrics.receivedTotal).toBe(1000);
    expect(metrics.overdueTotal).toBe(1000);
    expect(metrics.receivableTotal).toBe(1000);
    expect(metrics.overdueCount).toBe(1);
    // parcelas pendentes não entram no faturamento recebido
    expect(metrics.receivedTotal).not.toBe(metrics.contractedTotal);
  });

  it('calcula lucro realizado como recebido menos despesas pagas', () => {
    const metrics = computeFinanceMetrics([contract], payments, expenses);
    expect(metrics.expensesPaidTotal).toBe(300);
    expect(metrics.expensesPlannedTotal).toBe(500);
    expect(metrics.realizedProfit).toBe(700);
  });

  it('ignora contratos cancelados no faturamento contratado', () => {
    const cancelado = contractOf({ id: 'c2', totalValue: 5000, status: 'cancelado' });
    const metrics = computeFinanceMetrics([contract, cancelado], payments, expenses);
    expect(metrics.contractedTotal).toBe(3000);
    expect(billableContracts([contract, cancelado])).toHaveLength(1);
  });

  it('não inventa números quando não há lançamentos', () => {
    const metrics = computeFinanceMetrics([], [], []);
    expect(metrics.contractedTotal).toBe(0);
    expect(metrics.receivedTotal).toBe(0);
    expect(metrics.realizedProfit).toBe(0);
    expect(metrics.monthly.every((month) => month.received === 0 && month.expenses === 0)).toBe(true);
  });

  it('resume um contrato com recebido, pendente e progresso', () => {
    const summary = contractSummary(contract, payments);
    expect(summary.received).toBe(1000);
    expect(summary.pending).toBe(2000);
    expect(summary.overdueCount).toBe(1);
    expect(summary.progress).toBeCloseTo(33.33, 1);
  });
});

describe('histórico financeiro', () => {
  it('une recebimentos e despesas em ordem cronológica, com sinal', () => {
    const contract = contractOf();
    const payment = normalizePayment({
      id: 'p1',
      contractId: contract.id,
      amount: 500,
      status: 'pago',
      paidAmount: 500,
      paidAt: '2026-03-01T12:00:00.000Z',
      label: 'Parcela 1/1',
    });
    const expense = normalizeExpense({
      id: 'e1',
      description: 'Domínio',
      amount: 60,
      status: 'paga',
      spentAt: '2026-03-05T12:00:00.000Z',
      paidAt: '2026-03-05T12:00:00.000Z',
    });
    const ledger = buildLedger([payment], [expense], [contract]);
    expect(ledger).toHaveLength(2);
    expect(ledger[0].kind).toBe('despesa');
    expect(ledger[0].value).toBe(-60);
    expect(ledger[1].kind).toBe('recebimento');
    expect(ledger[1].value).toBe(500);
    expect(ledger[1].clientName).toBe('Cliente');
  });
});

describe('construtores', () => {
  it('normalizam valores inválidos', () => {
    const contract = buildContract({ totalValue: -100, installments: 999, downPayment: 5000 }, 'real');
    expect(contract.totalValue).toBe(0);
    expect(contract.installments).toBe(120);
    expect(contract.downPayment).toBe(0);
    expect(buildExpense({ amount: -5 }, 'demo').amount).toBe(0);
    expect(buildExpense({ status: 'prevista' }, 'real').paidAt).toBeNull();
  });
});
