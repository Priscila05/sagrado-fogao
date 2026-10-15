import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { fromDateInputValue, toDateTimeInputValue } from '../../utils/date';
import {
  INTERACTION_TYPE_LABEL,
  MANUAL_INTERACTION_TYPES,
  type InteractionType,
} from '../../models/types';

/**
 * Logs a real interaction. Opening a tel:/WhatsApp link never records anything
 * on its own — the user confirms here that the contact actually happened.
 */
export function InteractionDialog({
  open,
  onClose,
  leadId,
  companyId,
  suggestedType,
  suggestedDescription,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: string | null;
  companyId?: string | null;
  suggestedType?: InteractionType;
  suggestedDescription?: string;
}) {
  const { actions, saving } = useData();
  const [type, setType] = useState<InteractionType>(suggestedType ?? 'ligacao_realizada');
  const [description, setDescription] = useState(suggestedDescription ?? '');
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeInputValue(new Date()));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setType(suggestedType ?? 'ligacao_realizada');
    setDescription(suggestedDescription ?? '');
    setOccurredAt(toDateTimeInputValue(new Date()));
    setError(undefined);
  }, [open, suggestedType, suggestedDescription]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Descreva brevemente o que aconteceu.');
      return;
    }
    const saved = await actions.addInteraction({
      leadId: leadId ?? null,
      companyId: companyId ?? null,
      type,
      description: description.trim(),
      occurredAt: fromDateInputValue(occurredAt),
    });
    if (saved) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar interação"
      description="O histórico recebe apenas o que você confirmar como realizado."
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            Registrar
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
        <SelectInput
          label="Tipo de interação"
          value={type}
          onChange={(event) => setType(event.target.value as InteractionType)}
          options={MANUAL_INTERACTION_TYPES.map((value) => ({
            value,
            label: INTERACTION_TYPE_LABEL[value],
          }))}
        />
        <TextInput
          label="Quando aconteceu"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
        />
        <TextArea
          label="Descrição"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setError(undefined);
          }}
          error={error}
          rows={4}
          required
          placeholder="O que foi conversado, o que ficou combinado…"
          data-autofocus
        />
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Registrar
        </button>
      </form>
    </Modal>
  );
}
