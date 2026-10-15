import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { formatCurrency, parseCurrencyInput } from '../../utils/format';
import { fromDateInputValue, toDateInputValue } from '../../utils/date';
import type { Payment } from '../../models/finance';

/**
 * Registro de recebimento de uma parcela. O valor recebido é informado
 * explicitamente — pagamentos parciais ou com desconto ficam registrados pelo
 * que realmente entrou, nunca pelo previsto.
 */
export function PaymentReceiveDialog({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
}) {
  const { settings, actions, saving } = useData();
  const [paidAmount, setPaidAmount] = useState('');
  const [paidAt, setPaidAt] = useState(toDateInputValue(new Date()));
  const [method, setMethod] = useState('');
  const [error, setError] = useState<string | undefined>();

  // Carrega os valores na própria renderização em que o modal abre. Com um
  // efeito, havia uma janela em que os campos já estavam na tela com o conteúdo
  // anterior e a digitação inicial podia ser sobrescrita.
  const openKey = open && payment ? payment.id : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (open && payment) {
      setPaidAmount(payment.amount ? String(payment.amount).replace('.', ',') : '');
      setPaidAt(toDateInputValue(new Date()));
      setMethod(payment.method || settings.paymentMethods[0] || '');
      setError(undefined);
    }
  }

  const handleSubmit = async () => {
    if (!payment) return;
    const value = parseCurrencyInput(paidAmount);
    if (value <= 0) {
      setError('Informe o valor efetivamente recebido.');
      return;
    }
    const saved = await actions.setPaymentPaid(payment.id, true, {
      paidAmount: value,
      paidAt: fromDateInputValue(paidAt) ?? new Date().toISOString(),
      method,
    });
    if (saved) onClose();
  };

  return (
    <Modal
      open={open && Boolean(payment)}
      onClose={onClose}
      title="Registrar recebimento"
      description={payment ? `${payment.label} · previsto ${formatCurrency(payment.amount)}` : ''}
      size="sm"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <TextInput
          label="Valor recebido"
          value={paidAmount}
          onChange={(event) => {
            setPaidAmount(event.target.value);
            setError(undefined);
          }}
          error={error}
          adornment="R$"
          inputMode="decimal"
          required
          data-autofocus
          autoComplete="off"
        />
        <TextInput
          label="Data do recebimento"
          type="date"
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
        />
        <SelectInput
          label="Forma de pagamento"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          options={settings.paymentMethods.map((item) => ({ value: item, label: item }))}
          placeholder="Selecione"
        />
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Confirmar
        </button>
      </form>
    </Modal>
  );
}

/** Edição de uma parcela (valor previsto, vencimento, forma e observações). */
export function PaymentEditDialog({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
}) {
  const { settings, actions, saving } = useData();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();

  // Carrega os valores na própria renderização em que o modal abre. Com um
  // efeito, havia uma janela em que os campos já estavam na tela com o conteúdo
  // anterior e a digitação inicial podia ser sobrescrita.
  const openKey = open && payment ? payment.id : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (open && payment) {
      setLabel(payment.label);
      setAmount(payment.amount ? String(payment.amount).replace('.', ',') : '');
      setDueAt(toDateInputValue(payment.dueAt));
      setMethod(payment.method);
      setNotes(payment.notes);
      setError(undefined);
    }
  }

  const handleSubmit = async () => {
    if (!payment) return;
    const value = parseCurrencyInput(amount);
    if (value <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    const saved = await actions.updatePayment(payment.id, {
      label: label.trim() || payment.label,
      amount: value,
      dueAt: fromDateInputValue(dueAt) ?? payment.dueAt,
      method,
      notes: notes.trim(),
    });
    if (saved) onClose();
  };

  return (
    <Modal
      open={open && Boolean(payment)}
      onClose={onClose}
      title="Editar parcela"
      description={
        payment?.status === 'pago'
          ? 'Esta parcela já foi recebida: ajustes aqui não alteram o valor recebido.'
          : 'Ajuste valor, vencimento e forma de pagamento desta parcela.'
      }
      size="sm"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            Salvar parcela
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <TextInput
          label="Descrição"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          data-autofocus
          autoComplete="off"
        />
        <TextInput
          label="Valor previsto"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(undefined);
          }}
          error={error}
          adornment="R$"
          inputMode="decimal"
          required
          autoComplete="off"
        />
        <TextInput
          label="Vencimento"
          type="date"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
        <SelectInput
          label="Forma de pagamento"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          options={settings.paymentMethods.map((item) => ({ value: item, label: item }))}
          placeholder="Selecione"
        />
        <TextArea
          label="Observações"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
