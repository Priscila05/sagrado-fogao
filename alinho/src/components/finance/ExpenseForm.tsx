import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { parseCurrencyInput } from '../../utils/format';
import { fromDateInputValue, toDateInputValue } from '../../utils/date';
import { EXPENSE_STATUS_LABEL, type Expense, type ExpenseStatus } from '../../models/finance';

interface FormState {
  description: string;
  category: string;
  amount: string;
  spentAt: string;
  contractId: string;
  status: ExpenseStatus;
  notes: string;
}

export function ExpenseForm({
  open,
  onClose,
  expense,
  defaultContractId,
}: {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
  defaultContractId?: string;
}) {
  const { settings, contracts, actions, saving } = useData();
  const [form, setForm] = useState<FormState>({
    description: '',
    category: '',
    amount: '',
    spentAt: toDateInputValue(new Date()),
    contractId: defaultContractId ?? '',
    status: 'paga',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Reposiciona o formulário já na renderização em que o modal abre.
  const openKey = open ? expense?.id ?? 'nova' : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    setErrors({});
    setForm(
      expense && open
        ? {
            description: expense.description,
            category: expense.category,
            amount: expense.amount ? String(expense.amount).replace('.', ',') : '',
            spentAt: toDateInputValue(expense.spentAt),
            contractId: expense.contractId ?? '',
            status: expense.status,
            notes: expense.notes,
          }
        : {
            description: '',
            category: '',
            amount: '',
            spentAt: toDateInputValue(new Date()),
            contractId: defaultContractId ?? '',
            status: 'paga',
            notes: '',
          },
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.description.trim()) next.description = 'Descreva a despesa.';
    const amount = parseCurrencyInput(form.amount);
    if (amount <= 0) next.amount = 'Informe um valor maior que zero.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const spentAt = fromDateInputValue(form.spentAt) ?? new Date().toISOString();
    const payload = {
      description: form.description.trim(),
      category: form.category.trim(),
      amount,
      spentAt,
      contractId: form.contractId || null,
      status: form.status,
      // Despesa prevista não tem data de pagamento: só a paga afeta o lucro.
      paidAt: form.status === 'paga' ? spentAt : null,
      notes: form.notes.trim(),
    };

    const saved = expense
      ? await actions.updateExpense(expense.id, payload)
      : await actions.createExpense(payload);
    if (saved) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Editar despesa' : 'Nova despesa'}
      description="Apenas despesas pagas entram no cálculo do lucro realizado."
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {expense ? 'Salvar despesa' : 'Registrar despesa'}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <TextInput
          label="Descrição"
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          error={errors.description}
          required
          className="sm:col-span-2"
          placeholder="Ex.: Hospedagem anual do site"
          data-autofocus
          autoComplete="off"
        />
        <SelectInput
          label="Categoria"
          value={form.category}
          onChange={(event) => update('category', event.target.value)}
          options={settings.expenseCategories.map((category) => ({
            value: category,
            label: category,
          }))}
          placeholder="Selecione"
        />
        <TextInput
          label="Valor"
          value={form.amount}
          onChange={(event) => update('amount', event.target.value)}
          error={errors.amount}
          adornment="R$"
          placeholder="0,00"
          inputMode="decimal"
          required
          autoComplete="off"
        />
        <TextInput
          label="Data"
          type="date"
          value={form.spentAt}
          onChange={(event) => update('spentAt', event.target.value)}
        />
        <SelectInput
          label="Situação"
          value={form.status}
          onChange={(event) => update('status', event.target.value as ExpenseStatus)}
          options={(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map((value) => ({
            value,
            label: EXPENSE_STATUS_LABEL[value],
          }))}
          hint="Prevista = ainda não saiu do caixa."
        />
        <SelectInput
          label="Projeto vinculado"
          value={form.contractId}
          onChange={(event) => update('contractId', event.target.value)}
          options={contracts.map((contract) => ({
            value: contract.id,
            label: `${contract.projectName} — ${contract.clientName}`,
          }))}
          placeholder={contracts.length ? 'Sem vínculo' : 'Nenhum contrato cadastrado'}
          className="sm:col-span-2"
        />
        <TextArea
          label="Observações"
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          rows={2}
          className="sm:col-span-2"
        />
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
