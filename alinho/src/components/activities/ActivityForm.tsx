import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { fromDateInputValue, toDateTimeInputValue } from '../../utils/date';
import {
  ACTIVITY_TYPE_LABEL,
  PRIORITY_LABEL,
  type Activity,
  type ActivityType,
  type Priority,
} from '../../models/types';

interface FormState {
  title: string;
  type: ActivityType;
  dueAt: string;
  priority: Priority;
  leadId: string;
  companyId: string;
  notes: string;
}

function defaultDueAt(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toDateTimeInputValue(date);
}

export function ActivityForm({
  open,
  onClose,
  activity,
  defaultLeadId,
  defaultCompanyId,
}: {
  open: boolean;
  onClose: () => void;
  activity?: Activity | null;
  defaultLeadId?: string;
  defaultCompanyId?: string;
}) {
  const { leads, companies, actions, saving } = useData();
  const [form, setForm] = useState<FormState>(() => ({
    title: '',
    type: 'ligacao',
    dueAt: defaultDueAt(),
    priority: 'media',
    leadId: defaultLeadId ?? '',
    companyId: defaultCompanyId ?? '',
    notes: '',
  }));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    if (activity) {
      setForm({
        title: activity.title,
        type: activity.type,
        dueAt: toDateTimeInputValue(activity.dueAt),
        priority: activity.priority,
        leadId: activity.leadId ?? '',
        companyId: activity.companyId ?? '',
        notes: activity.notes,
      });
    } else {
      setForm({
        title: '',
        type: 'ligacao',
        dueAt: defaultDueAt(),
        priority: 'media',
        leadId: defaultLeadId ?? '',
        companyId: defaultCompanyId ?? '',
        notes: '',
      });
    }
    setError(undefined);
  }, [open, activity, defaultLeadId, defaultCompanyId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Selecting a lead carries its company along, keeping the link consistent.
      if (key === 'leadId' && value) {
        const lead = leads.find((candidate) => candidate.id === value);
        if (lead?.companyId) next.companyId = lead.companyId;
      }
      return next;
    });
    if (key === 'title') setError(undefined);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Descreva a atividade.');
      return;
    }
    const dueAt = fromDateInputValue(form.dueAt);
    if (!dueAt) {
      setError('Informe uma data e hora válidas.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      type: form.type,
      dueAt,
      priority: form.priority,
      leadId: form.leadId || null,
      companyId: form.companyId || null,
      notes: form.notes.trim(),
    };
    const saved = activity
      ? await actions.updateActivity(activity.id, payload)
      : await actions.createActivity(payload);
    if (saved) onClose();
  };

  const leadOptions = leads
    .slice()
    .sort((a, b) =>
      (a.establishmentName || a.contactName).localeCompare(
        b.establishmentName || b.contactName,
        'pt-BR',
      ),
    )
    .map((lead) => ({
      value: lead.id,
      label: lead.establishmentName || lead.contactName || 'Lead sem nome',
    }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? 'Editar atividade' : 'Nova atividade'}
      description="Follow-ups garantem que nenhuma oportunidade seja esquecida."
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {activity ? 'Salvar alterações' : 'Criar atividade'}
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
          label="Atividade"
          value={form.title}
          onChange={(event) => update('title', event.target.value)}
          error={error}
          required
          placeholder="Ex.: Retornar ligação para a Ana"
          className="sm:col-span-2"
          data-autofocus
          autoComplete="off"
        />
        <SelectInput
          label="Tipo"
          value={form.type}
          onChange={(event) => update('type', event.target.value as ActivityType)}
          options={(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((value) => ({
            value,
            label: ACTIVITY_TYPE_LABEL[value],
          }))}
        />
        <SelectInput
          label="Prioridade"
          value={form.priority}
          onChange={(event) => update('priority', event.target.value as Priority)}
          options={(Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => ({
            value,
            label: PRIORITY_LABEL[value],
          }))}
        />
        <TextInput
          label="Data e hora"
          type="datetime-local"
          value={form.dueAt}
          onChange={(event) => update('dueAt', event.target.value)}
          required
        />
        <SelectInput
          label="Lead vinculado"
          value={form.leadId}
          onChange={(event) => update('leadId', event.target.value)}
          options={leadOptions}
          placeholder={leadOptions.length ? 'Sem vínculo' : 'Nenhum lead cadastrado'}
        />
        <SelectInput
          label="Empresa vinculada"
          value={form.companyId}
          onChange={(event) => update('companyId', event.target.value)}
          options={companies.map((company) => ({ value: company.id, label: company.name }))}
          placeholder={companies.length ? 'Sem vínculo' : 'Nenhuma empresa cadastrada'}
          className="sm:col-span-2"
        />
        <TextArea
          label="Observações"
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          rows={3}
          className="sm:col-span-2"
        />
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
