import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { formatCurrency, parseCurrencyInput } from '../../utils/format';
import { formatDate, fromDateInputValue, toDateInputValue } from '../../utils/date';
import { planSchedule } from '../../services/finance';
import {
  CONTRACT_STATUS_LABEL,
  type Contract,
  type ContractStatus,
} from '../../models/finance';

interface FormState {
  companyId: string;
  clientName: string;
  projectName: string;
  totalValue: string;
  signedAt: string;
  description: string;
  status: ContractStatus;
  downPayment: string;
  installments: string;
  firstDueAt: string;
  paymentMethod: string;
}

function todayInput(): string {
  return toDateInputValue(new Date());
}

function nextMonthInput(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return toDateInputValue(date);
}

function emptyForm(defaultMethod: string): FormState {
  return {
    companyId: '',
    clientName: '',
    projectName: '',
    totalValue: '',
    signedAt: todayInput(),
    description: '',
    status: 'ativo',
    downPayment: '',
    installments: '1',
    firstDueAt: nextMonthInput(),
    paymentMethod: defaultMethod,
  };
}

export function ContractForm({
  open,
  onClose,
  contract,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contract?: Contract | null;
  onSaved?: (contract: Contract) => void;
}) {
  const { companies, payments, settings, actions, saving } = useData();
  const defaultMethod = settings.paymentMethods[0] ?? '';
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultMethod));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Reposiciona o formulário na abertura do modal, ainda durante a renderização:
  // os campos nunca chegam a aparecer com o conteúdo da abertura anterior.
  const openKey = open ? contract?.id ?? 'novo' : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    setErrors({});
    setForm(
      contract && open
        ? {
            companyId: contract.companyId ?? '',
            clientName: contract.clientName,
            projectName: contract.projectName,
            totalValue: contract.totalValue ? String(contract.totalValue).replace('.', ',') : '',
            signedAt: toDateInputValue(contract.signedAt),
            description: contract.description,
            status: contract.status,
            downPayment: contract.downPayment
              ? String(contract.downPayment).replace('.', ',')
              : '',
            installments: String(contract.installments),
            firstDueAt: toDateInputValue(contract.firstDueAt),
            paymentMethod: contract.paymentMethod,
          }
        : emptyForm(defaultMethod),
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Escolher uma empresa do CRM preenche o nome do cliente.
      if (key === 'companyId' && value) {
        const company = companies.find((candidate) => candidate.id === value);
        if (company) next.clientName = company.name;
      }
      return next;
    });
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const paidCount = useMemo(() => {
    if (!contract) return 0;
    return payments.filter(
      (payment) => payment.contractId === contract.id && payment.status === 'pago',
    ).length;
  }, [contract, payments]);

  /** Prévia da agenda, para o usuário ver o que será gerado antes de salvar. */
  const preview = useMemo(() => {
    const totalValue = parseCurrencyInput(form.totalValue);
    if (totalValue <= 0) return [];
    const signedIso = fromDateInputValue(form.signedAt) ?? new Date().toISOString();
    const firstDueIso = fromDateInputValue(form.firstDueAt) ?? signedIso;
    const paidBySequence = new Map<number, number>();
    if (contract) {
      for (const payment of payments) {
        if (payment.contractId === contract.id && payment.status === 'pago') {
          paidBySequence.set(payment.sequence, payment.paidAmount);
        }
      }
    }
    return planSchedule(
      {
        totalValue,
        downPayment: Math.min(parseCurrencyInput(form.downPayment), totalValue),
        installments: Math.max(0, Number.parseInt(form.installments, 10) || 0),
        signedAt: signedIso,
        firstDueAt: firstDueIso,
      },
      paidBySequence,
    );
  }, [form, contract, payments]);

  const handleSubmit = async () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.projectName.trim()) next.projectName = 'Informe o nome do projeto.';
    if (!form.clientName.trim() && !form.companyId) next.clientName = 'Informe o cliente.';
    const totalValue = parseCurrencyInput(form.totalValue);
    if (totalValue <= 0) next.totalValue = 'Informe o valor total do contrato.';
    const downPayment = parseCurrencyInput(form.downPayment);
    if (downPayment > totalValue) next.downPayment = 'A entrada não pode superar o valor total.';
    const installments = Number.parseInt(form.installments, 10);
    if (!Number.isFinite(installments) || installments < 0 || installments > 120) {
      next.installments = 'Use um número de parcelas entre 0 e 120.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const signedAt = fromDateInputValue(form.signedAt) ?? new Date().toISOString();
    const payload = {
      companyId: form.companyId || null,
      clientName: form.clientName.trim(),
      projectName: form.projectName.trim(),
      totalValue,
      signedAt,
      description: form.description.trim(),
      status: form.status,
      downPayment,
      installments,
      firstDueAt: fromDateInputValue(form.firstDueAt) ?? signedAt,
      paymentMethod: form.paymentMethod,
    };

    const saved = contract
      ? await actions.updateContract(contract.id, payload)
      : await actions.createContract(payload);
    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contract ? 'Editar contrato' : 'Novo contrato'}
      description={
        contract
          ? 'A agenda de parcelas é recalculada; parcelas já pagas permanecem intactas.'
          : 'A agenda de entrada e parcelas é gerada automaticamente.'
      }
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {contract ? 'Salvar contrato' : 'Cadastrar contrato'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="label-eyebrow mb-3">Contrato</legend>
          <TextInput
            label="Nome do projeto"
            value={form.projectName}
            onChange={(event) => update('projectName', event.target.value)}
            error={errors.projectName}
            required
            placeholder="Ex.: Site institucional"
            data-autofocus
            autoComplete="off"
          />
          <SelectInput
            label="Cliente do CRM"
            value={form.companyId}
            onChange={(event) => update('companyId', event.target.value)}
            options={companies
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
              .map((company) => ({ value: company.id, label: company.name }))}
            placeholder={companies.length ? 'Sem vínculo' : 'Nenhuma empresa cadastrada'}
            hint="Vincular ao CRM mantém contratos e histórico comercial juntos."
          />
          <TextInput
            label="Cliente"
            value={form.clientName}
            onChange={(event) => update('clientName', event.target.value)}
            error={errors.clientName}
            placeholder="Nome exibido nos relatórios"
            autoComplete="off"
          />
          <SelectInput
            label="Situação"
            value={form.status}
            onChange={(event) => update('status', event.target.value as ContractStatus)}
            options={(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((value) => ({
              value,
              label: CONTRACT_STATUS_LABEL[value],
            }))}
            hint="Contratos cancelados saem do faturamento contratado."
          />
          <TextInput
            label="Valor total"
            value={form.totalValue}
            onChange={(event) => update('totalValue', event.target.value)}
            error={errors.totalValue}
            adornment="R$"
            placeholder="0,00"
            inputMode="decimal"
            required
            autoComplete="off"
          />
          <TextInput
            label="Data do contrato"
            type="date"
            value={form.signedAt}
            onChange={(event) => update('signedAt', event.target.value)}
          />
          <TextArea
            label="Descrição"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            rows={2}
            className="sm:col-span-2"
            placeholder="Escopo combinado, entregas, observações…"
          />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="label-eyebrow mb-3">Condições de pagamento</legend>
          <TextInput
            label="Entrada"
            value={form.downPayment}
            onChange={(event) => update('downPayment', event.target.value)}
            error={errors.downPayment}
            adornment="R$"
            placeholder="0,00"
            inputMode="decimal"
            hint="Deixe zerado se não houver entrada."
            autoComplete="off"
          />
          <TextInput
            label="Número de parcelas"
            type="number"
            min={0}
            max={120}
            value={form.installments}
            onChange={(event) => update('installments', event.target.value)}
            error={errors.installments}
          />
          <TextInput
            label="Primeiro vencimento"
            type="date"
            value={form.firstDueAt}
            onChange={(event) => update('firstDueAt', event.target.value)}
            hint="As demais parcelas vencem mês a mês."
          />
          <SelectInput
            label="Forma de pagamento"
            value={form.paymentMethod}
            onChange={(event) => update('paymentMethod', event.target.value)}
            options={settings.paymentMethods.map((method) => ({ value: method, label: method }))}
            placeholder="Selecione"
          />
        </fieldset>

        {preview.length > 0 ? (
          <div className="rounded-md border border-line bg-sunken/50 p-3">
            <p className="label-eyebrow mb-2">
              Agenda que será gerada
              {paidCount > 0 ? ` · ${paidCount} parcela(s) já paga(s) preservada(s)` : ''}
            </p>
            <ul className="flex flex-col gap-1">
              {preview.slice(0, 8).map((slot) => (
                <li
                  key={slot.sequence}
                  className="flex items-center justify-between gap-3 text-sm text-muted"
                >
                  <span className="truncate">
                    {slot.label} · vence em {formatDate(slot.dueAt)}
                  </span>
                  <span className="shrink-0 font-medium text-ink tnum">
                    {formatCurrency(slot.amount)}
                  </span>
                </li>
              ))}
              {preview.length > 8 ? (
                <li className="text-xs text-subtle">e mais {preview.length - 8} parcela(s).</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
