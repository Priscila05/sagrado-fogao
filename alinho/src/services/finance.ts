import { createId } from '../utils/id';
import { normalizeContract, normalizeExpense, normalizePayment } from '../models/normalize';
import type {
  Contract,
  Expense,
  Payment,
  PaymentDisplayStatus,
} from '../models/finance';
import type { Dataset } from '../models/types';
import { addMonths, eachMonth, endOfDay, formatMonthLabel, monthKey, startOfDay } from '../utils/date';

/**
 * Regras financeiras do ALINHO.
 *
 * Princípio: "contratado" e "recebido" são grandezas diferentes. Nenhuma
 * parcela pendente entra em receita, e o lucro realizado considera apenas
 * despesas efetivamente pagas.
 */

export type ContractDraft = Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'dataset'>>;
export type ExpenseDraft = Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'dataset'>>;
export type PaymentDraft = Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'dataset'>>;

export function buildContract(draft: ContractDraft, dataset: Dataset): Contract {
  const now = new Date().toISOString();
  return normalizeContract({ ...draft, id: createId(), createdAt: now, updatedAt: now, dataset }, now);
}

export function buildExpense(draft: ExpenseDraft, dataset: Dataset): Expense {
  const now = new Date().toISOString();
  return normalizeExpense({ ...draft, id: createId(), createdAt: now, updatedAt: now, dataset }, now);
}

export function buildPayment(draft: PaymentDraft, dataset: Dataset): Payment {
  const now = new Date().toISOString();
  return normalizePayment({ ...draft, id: createId(), createdAt: now, updatedAt: now, dataset }, now);
}

/* ------------------------------------------------------------- arredonda --- */

/** Centavos, para que a soma das parcelas feche exatamente com o contrato. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return Math.round(value) / 100;
}

/* -------------------------------------------------------- agenda prevista --- */

export interface ScheduleSlot {
  sequence: number;
  kind: 'entrada' | 'parcela';
  label: string;
  dueAt: string;
  amount: number;
}

/**
 * Agenda prevista de um contrato: entrada (quando houver) na data da
 * assinatura e N parcelas mensais a partir do primeiro vencimento.
 *
 * `alreadyPaidCents` permite recalcular apenas o que ainda não foi recebido,
 * mantendo intactos os valores já pagos.
 */
export function planSchedule(
  contract: Pick<
    Contract,
    'totalValue' | 'downPayment' | 'installments' | 'signedAt' | 'firstDueAt'
  >,
  paidBySequence: Map<number, number> = new Map(),
): ScheduleSlot[] {
  const totalCents = toCents(contract.totalValue);
  const installments = Math.max(0, Math.trunc(contract.installments));
  const hasDownPayment = contract.downPayment > 0;

  const slots: ScheduleSlot[] = [];
  if (hasDownPayment) {
    slots.push({
      sequence: 0,
      kind: 'entrada',
      label: 'Entrada',
      dueAt: contract.signedAt,
      amount: 0,
    });
  }
  for (let index = 0; index < installments; index += 1) {
    slots.push({
      sequence: index + 1,
      kind: 'parcela',
      label: `Parcela ${index + 1}/${installments}`,
      dueAt: addMonths(new Date(contract.firstDueAt), index).toISOString(),
      amount: 0,
    });
  }
  // Contrato sem entrada e sem parcelas: uma cobrança única na assinatura.
  if (slots.length === 0) {
    slots.push({
      sequence: 1,
      kind: 'parcela',
      label: 'Pagamento único',
      dueAt: contract.signedAt,
      amount: 0,
    });
  }

  // O que já foi recebido não é redistribuído; o restante é dividido entre os
  // vencimentos em aberto, com a diferença de centavos no último.
  let paidCents = 0;
  const openSlots: ScheduleSlot[] = [];
  for (const slot of slots) {
    const paid = paidBySequence.get(slot.sequence);
    if (paid !== undefined) {
      slot.amount = paid;
      paidCents += toCents(paid);
    } else {
      openSlots.push(slot);
    }
  }

  let remainingCents = totalCents - paidCents;
  if (remainingCents < 0) remainingCents = 0;

  if (openSlots.length > 0) {
    const downCents = hasDownPayment ? Math.min(toCents(contract.downPayment), remainingCents) : 0;
    const downSlot = openSlots.find((slot) => slot.kind === 'entrada');
    let installmentPool = remainingCents;

    if (downSlot) {
      downSlot.amount = fromCents(downCents);
      installmentPool = remainingCents - downCents;
    }

    const openInstallments = openSlots.filter((slot) => slot.kind === 'parcela');
    if (openInstallments.length > 0) {
      const share = Math.floor(installmentPool / openInstallments.length);
      let distributed = 0;
      openInstallments.forEach((slot, index) => {
        const isLast = index === openInstallments.length - 1;
        const value = isLast ? installmentPool - distributed : share;
        distributed += value;
        slot.amount = fromCents(Math.max(0, value));
      });
    }
  }

  return slots;
}

export interface ScheduleSyncResult {
  created: Payment[];
  updated: Payment[];
  removed: Payment[];
  kept: Payment[];
}

/**
 * Reconcilia os pagamentos gravados de um contrato com a agenda prevista.
 *
 * Garantias:
 * - identidade por `sequence`, então editar o contrato nunca duplica parcelas;
 * - pagamentos já quitados nunca são alterados nem removidos;
 * - lançamentos avulsos (sequence negativa/extra) são preservados.
 */
export function syncContractSchedule(
  contract: Contract,
  existing: Payment[],
  options: { method?: string } = {},
): ScheduleSyncResult {
  const now = new Date().toISOString();
  const scheduled = existing
    .filter((payment) => payment.contractId === contract.id && payment.kind !== 'avulso')
    .sort((a, b) => a.sequence - b.sequence);

  const paidBySequence = new Map<number, number>();
  for (const payment of scheduled) {
    if (payment.status === 'pago') paidBySequence.set(payment.sequence, payment.paidAmount);
  }

  const slots = planSchedule(contract, paidBySequence);
  const slotsBySequence = new Map(slots.map((slot) => [slot.sequence, slot]));

  const created: Payment[] = [];
  const updated: Payment[] = [];
  const removed: Payment[] = [];
  const kept: Payment[] = [];

  for (const payment of scheduled) {
    const slot = slotsBySequence.get(payment.sequence);
    if (!slot) {
      // Vaga deixou de existir: só pode sumir se nada foi recebido nela.
      if (payment.status === 'pago') kept.push(payment);
      else removed.push(payment);
      continue;
    }
    if (payment.status === 'pago') {
      kept.push(payment);
      continue;
    }
    const next: Payment = normalizePayment({
      ...payment,
      kind: slot.kind,
      label: slot.label,
      dueAt: slot.dueAt,
      amount: slot.amount,
      companyId: contract.companyId,
      method: payment.method || options.method || contract.paymentMethod,
      updatedAt: now,
    });
    const changed =
      next.amount !== payment.amount ||
      next.dueAt !== payment.dueAt ||
      next.label !== payment.label ||
      next.kind !== payment.kind ||
      next.companyId !== payment.companyId;
    if (changed) updated.push(next);
    else kept.push(payment);
  }

  const knownSequences = new Set(scheduled.map((payment) => payment.sequence));
  for (const slot of slots) {
    if (knownSequences.has(slot.sequence)) continue;
    created.push(
      buildPayment(
        {
          contractId: contract.id,
          companyId: contract.companyId,
          kind: slot.kind,
          sequence: slot.sequence,
          label: slot.label,
          dueAt: slot.dueAt,
          amount: slot.amount,
          method: options.method || contract.paymentMethod,
          status: 'pendente',
        },
        contract.dataset,
      ),
    );
  }

  return { created, updated, removed, kept };
}

/* ------------------------------------------------------------- situações --- */

/** "Vencido" é sempre derivado da data, nunca gravado no registro. */
export function paymentDisplayStatus(payment: Payment, reference = new Date()): PaymentDisplayStatus {
  if (payment.status === 'pago') return 'pago';
  return new Date(payment.dueAt).getTime() < startOfDay(reference).getTime() ? 'vencido' : 'pendente';
}

export function isOverduePayment(payment: Payment, reference = new Date()): boolean {
  return paymentDisplayStatus(payment, reference) === 'vencido';
}

/** Contratos cancelados não contam como faturamento. */
export function billableContracts(contracts: Contract[]): Contract[] {
  return contracts.filter((contract) => contract.status !== 'cancelado');
}

/* -------------------------------------------------------------- métricas --- */

export interface MonthlyFinancePoint {
  key: string;
  label: string;
  received: number;
  expenses: number;
  result: number;
}

export interface FinanceMetrics {
  contractedTotal: number;
  receivedTotal: number;
  receivableTotal: number;
  overdueTotal: number;
  expensesPaidTotal: number;
  expensesPlannedTotal: number;
  realizedProfit: number;
  contractsCount: number;
  activeContracts: number;
  overdueCount: number;
  /** Quanto falta receber dos contratos não cancelados. */
  openBalance: number;
  monthly: MonthlyFinancePoint[];
  upcomingPayments: Payment[];
  overduePayments: Payment[];
  expensesByCategory: { label: string; value: number }[];
  recentExpenses: Expense[];
}

export function computeFinanceMetrics(
  contracts: Contract[],
  payments: Payment[],
  expenses: Expense[],
  options: { months?: number; reference?: Date } = {},
): FinanceMetrics {
  const reference = options.reference ?? new Date();
  const months = options.months ?? 6;

  const valid = billableContracts(contracts);
  const validIds = new Set(valid.map((contract) => contract.id));
  // Pagamentos de contratos cancelados saem das previsões, mas o que já foi
  // recebido continua sendo dinheiro em caixa.
  const relevantPending = payments.filter(
    (payment) => payment.status === 'pendente' && (!payment.contractId || validIds.has(payment.contractId)),
  );
  const paid = payments.filter((payment) => payment.status === 'pago');

  const contractedTotal = valid.reduce((total, contract) => total + contract.totalValue, 0);
  const receivedTotal = paid.reduce((total, payment) => total + payment.paidAmount, 0);

  const overduePayments = relevantPending
    .filter((payment) => isOverduePayment(payment, reference))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const upcomingPayments = relevantPending
    .filter((payment) => !isOverduePayment(payment, reference))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const receivableTotal = upcomingPayments.reduce((total, payment) => total + payment.amount, 0);
  const overdueTotal = overduePayments.reduce((total, payment) => total + payment.amount, 0);

  const expensesPaid = expenses.filter((expense) => expense.status === 'paga');
  const expensesPaidTotal = expensesPaid.reduce((total, expense) => total + expense.amount, 0);
  const expensesPlannedTotal = expenses
    .filter((expense) => expense.status === 'prevista')
    .reduce((total, expense) => total + expense.amount, 0);

  const from = addMonths(reference, -(months - 1));
  const monthly = eachMonth(from, reference).map((month) => {
    const key = monthKey(month);
    const received = paid
      .filter((payment) => payment.paidAt && monthKey(payment.paidAt) === key)
      .reduce((total, payment) => total + payment.paidAmount, 0);
    const spent = expensesPaid
      .filter((expense) => monthKey(expense.paidAt ?? expense.spentAt) === key)
      .reduce((total, expense) => total + expense.amount, 0);
    return { key, label: formatMonthLabel(month), received, expenses: spent, result: received - spent };
  });

  const categoryMap = new Map<string, number>();
  for (const expense of expensesPaid) {
    const label = expense.category.trim() || 'Sem categoria';
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + expense.amount);
  }

  return {
    contractedTotal,
    receivedTotal,
    receivableTotal,
    overdueTotal,
    expensesPaidTotal,
    expensesPlannedTotal,
    // Lucro realizado: dinheiro que entrou menos dinheiro que saiu.
    realizedProfit: receivedTotal - expensesPaidTotal,
    contractsCount: contracts.length,
    activeContracts: contracts.filter((contract) => contract.status === 'ativo').length,
    overdueCount: overduePayments.length,
    openBalance: receivableTotal + overdueTotal,
    monthly,
    upcomingPayments: upcomingPayments.slice(0, 6),
    overduePayments: overduePayments.slice(0, 6),
    expensesByCategory: Array.from(categoryMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    recentExpenses: expenses
      .slice()
      .sort((a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime())
      .slice(0, 6),
  };
}

/** Totais de um contrato específico, para a tela de detalhes. */
export function contractSummary(contract: Contract, payments: Payment[]) {
  const own = payments.filter((payment) => payment.contractId === contract.id);
  const received = own
    .filter((payment) => payment.status === 'pago')
    .reduce((total, payment) => total + payment.paidAmount, 0);
  const scheduled = own.reduce(
    (total, payment) => total + (payment.status === 'pago' ? payment.paidAmount : payment.amount),
    0,
  );
  const overdue = own.filter((payment) => isOverduePayment(payment));
  return {
    payments: own.sort((a, b) => a.sequence - b.sequence || a.dueAt.localeCompare(b.dueAt)),
    received,
    scheduled,
    pending: Math.max(0, contract.totalValue - received),
    overdueCount: overdue.length,
    overdueTotal: overdue.reduce((total, payment) => total + payment.amount, 0),
    progress: contract.totalValue > 0 ? Math.min(100, (received / contract.totalValue) * 100) : 0,
  };
}

/* ------------------------------------------------------------- histórico --- */

export type LedgerKind = 'recebimento' | 'despesa';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  date: string;
  description: string;
  clientName: string;
  contractId: string | null;
  category: string;
  /** Positivo em recebimentos, negativo em despesas. */
  value: number;
  status: PaymentDisplayStatus | 'paga' | 'prevista';
  method: string;
}

/** Lançamentos de pagamentos e despesas em uma linha única, ordenada por data. */
export function buildLedger(
  payments: Payment[],
  expenses: Expense[],
  contracts: Contract[],
): LedgerEntry[] {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));

  const paymentEntries: LedgerEntry[] = payments.map((payment) => {
    const contract = payment.contractId ? contractById.get(payment.contractId) : undefined;
    const status = paymentDisplayStatus(payment);
    return {
      id: payment.id,
      kind: 'recebimento',
      date: payment.status === 'pago' ? payment.paidAt ?? payment.dueAt : payment.dueAt,
      description: [contract?.projectName, payment.label].filter(Boolean).join(' · ') || payment.label,
      clientName: contract?.clientName ?? '',
      contractId: payment.contractId,
      category: 'Recebimento',
      value: payment.status === 'pago' ? payment.paidAmount : payment.amount,
      status,
      method: payment.method,
    };
  });

  const expenseEntries: LedgerEntry[] = expenses.map((expense) => {
    const contract = expense.contractId ? contractById.get(expense.contractId) : undefined;
    return {
      id: expense.id,
      kind: 'despesa',
      date: expense.status === 'paga' ? expense.paidAt ?? expense.spentAt : expense.spentAt,
      description: expense.description,
      clientName: contract?.clientName ?? '',
      contractId: expense.contractId,
      category: expense.category || 'Sem categoria',
      value: -expense.amount,
      status: expense.status,
      method: '',
    };
  });

  return [...paymentEntries, ...expenseEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function inPeriod(iso: string, from: Date, to: Date): boolean {
  const time = new Date(iso).getTime();
  return time >= startOfDay(from).getTime() && time <= endOfDay(to).getTime();
}
