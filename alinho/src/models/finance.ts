import type { Dataset, ISODate } from './types';

/**
 * Modelo do módulo financeiro.
 *
 * Três entidades: contratos (o que foi vendido), pagamentos (entrada e
 * parcelas, com o que foi efetivamente recebido) e despesas (custos).
 * A separação entre "contratado" e "recebido" é deliberada: nenhuma parcela
 * pendente entra no faturamento realizado.
 */

export type ContractStatus = 'ativo' | 'concluido' | 'cancelado';

export interface Contract {
  id: string;
  /** Empresa do CRM, quando o cliente já está cadastrado. */
  companyId: string | null;
  /** Lead do CRM que originou o contrato, quando houver. */
  leadId: string | null;
  /** Nome exibido do cliente — preenchido a partir do CRM ou digitado. */
  clientName: string;
  projectName: string;
  totalValue: number;
  signedAt: ISODate;
  description: string;
  status: ContractStatus;
  /** Plano de cobrança usado para gerar a agenda de pagamentos. */
  downPayment: number;
  installments: number;
  firstDueAt: ISODate;
  paymentMethod: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  dataset: Dataset;
}

/** Situação armazenada. "Vencido" é derivado da data, nunca gravado. */
export type PaymentStatus = 'pendente' | 'pago';

/** Situação exibida na interface. */
export type PaymentDisplayStatus = 'pendente' | 'pago' | 'vencido';

export type PaymentKind = 'entrada' | 'parcela' | 'avulso';

export interface Payment {
  id: string;
  contractId: string | null;
  companyId: string | null;
  kind: PaymentKind;
  /** 0 = entrada, 1..n = parcelas. Único por contrato: evita duplicidade. */
  sequence: number;
  label: string;
  dueAt: ISODate;
  /** Valor previsto da parcela. */
  amount: number;
  /** Valor efetivamente recebido. Só conta quando status = 'pago'. */
  paidAmount: number;
  paidAt: ISODate | null;
  method: string;
  status: PaymentStatus;
  notes: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  dataset: Dataset;
}

/** Despesa prevista ainda não saiu do caixa; só a paga afeta o lucro. */
export type ExpenseStatus = 'paga' | 'prevista';

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  spentAt: ISODate;
  /** Projeto/contrato vinculado — opcional. */
  contractId: string | null;
  status: ExpenseStatus;
  paidAt: ISODate | null;
  notes: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  dataset: Dataset;
}

/* ---------------------------------------------------------------- rótulos --- */

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ativo: 'Ativo',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentDisplayStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  entrada: 'Entrada',
  parcela: 'Parcela',
  avulso: 'Avulso',
};

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  paga: 'Paga',
  prevista: 'Prevista',
};
