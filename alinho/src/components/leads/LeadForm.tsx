import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { findPossibleMatches } from '../../services/duplicates';
import { isValidEmail, isValidPhone, parseCurrencyInput } from '../../utils/format';
import { toDateInputValue, fromDateInputValue } from '../../utils/date';
import { PRIORITY_LABEL, type Lead, type Priority } from '../../models/types';

interface FormState {
  contactName: string;
  establishmentName: string;
  segment: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  website: string;
  neighborhood: string;
  city: string;
  source: string;
  stageId: string;
  potentialValue: string;
  priority: Priority;
  nextContactAt: string;
  companyId: string;
  notes: string;
}

function emptyForm(stageId: string): FormState {
  return {
    contactName: '',
    establishmentName: '',
    segment: '',
    phone: '',
    whatsapp: '',
    email: '',
    instagram: '',
    website: '',
    neighborhood: '',
    city: '',
    source: '',
    stageId,
    potentialValue: '',
    priority: 'media',
    nextContactAt: '',
    companyId: '',
    notes: '',
  };
}

function formFromLead(lead: Lead): FormState {
  return {
    contactName: lead.contactName,
    establishmentName: lead.establishmentName,
    segment: lead.segment,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    instagram: lead.instagram,
    website: lead.website,
    neighborhood: lead.neighborhood,
    city: lead.city,
    source: lead.source,
    stageId: lead.stageId,
    potentialValue: lead.potentialValue ? String(lead.potentialValue).replace('.', ',') : '',
    priority: lead.priority,
    nextContactAt: toDateInputValue(lead.nextContactAt),
    companyId: lead.companyId ?? '',
    notes: lead.notes,
  };
}

export function LeadForm({
  open,
  onClose,
  lead,
  defaultStageId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  defaultStageId?: string;
  onSaved?: (lead: Lead) => void;
}) {
  const { stages, settings, companies, leads, actions, saving } = useData();
  const fallbackStage = defaultStageId || stages[0]?.id || '';
  const [form, setForm] = useState<FormState>(() =>
    lead ? formFromLead(lead) : emptyForm(fallbackStage),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Carrega os valores na própria renderização em que o modal abre. Com um
  // efeito, havia uma janela em que os campos já estavam na tela com o conteúdo
  // anterior e a digitação inicial podia ser sobrescrita.
  const openKey = open ? `${lead?.id ?? 'novo'}:${fallbackStage}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (openKey !== loadedKey) {
    setLoadedKey(openKey);
    if (open) {
      setForm(lead ? formFromLead(lead) : emptyForm(fallbackStage));
      setErrors({});
    }
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const duplicates = useMemo(() => {
    if (!open) return [];
    return findPossibleMatches(
      leads,
      { phone: form.phone, whatsapp: form.whatsapp, email: form.email },
      lead?.id,
    ).slice(0, 3);
  }, [open, leads, form.phone, form.whatsapp, form.email, lead?.id]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.contactName.trim() && !form.establishmentName.trim()) {
      next.establishmentName = 'Informe o nome do contato ou do estabelecimento.';
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      next.phone = 'Telefone brasileiro deve ter 10 ou 11 dígitos com DDD.';
    }
    if (form.whatsapp.trim() && !isValidPhone(form.whatsapp)) {
      next.whatsapp = 'WhatsApp deve ter 10 ou 11 dígitos com DDD.';
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      next.email = 'E-mail inválido.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload = {
      contactName: form.contactName.trim(),
      establishmentName: form.establishmentName.trim(),
      segment: form.segment.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      instagram: form.instagram.trim(),
      website: form.website.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      source: form.source.trim(),
      stageId: form.stageId,
      potentialValue: parseCurrencyInput(form.potentialValue),
      priority: form.priority,
      nextContactAt: fromDateInputValue(form.nextContactAt),
      companyId: form.companyId || null,
      notes: form.notes.trim(),
    };

    const saved = lead
      ? await actions.updateLead(lead.id, payload)
      : await actions.createLead(payload);

    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  const stageOptions = stages.map((stage) => ({ value: stage.id, label: stage.name }));
  const sourceOptions = settings.sources.map((source) => ({ value: source, label: source }));
  const segmentOptions = settings.segments.map((segment) => ({ value: segment, label: segment }));
  const companyOptions = companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((company) => ({ value: company.id, label: company.name }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? 'Editar lead' : 'Novo lead'}
      description={
        lead
          ? 'Atualize as informações comerciais deste lead.'
          : 'Cadastre um novo contato para acompanhar no funil.'
      }
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {lead ? 'Salvar alterações' : 'Cadastrar lead'}
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
          <legend className="label-eyebrow mb-3">Identificação</legend>
          <TextInput
            label="Nome do contato"
            value={form.contactName}
            onChange={(event) => update('contactName', event.target.value)}
            placeholder="Ex.: Ana Ribeiro"
            autoComplete="off"
            data-autofocus
          />
          <TextInput
            label="Estabelecimento"
            value={form.establishmentName}
            onChange={(event) => update('establishmentName', event.target.value)}
            error={errors.establishmentName}
            placeholder="Ex.: Pet Shop Patas Felizes"
            autoComplete="off"
          />
          <SelectInput
            label="Segmento"
            value={form.segment}
            onChange={(event) => update('segment', event.target.value)}
            options={segmentOptions}
            placeholder="Selecione"
          />
          <SelectInput
            label="Origem do lead"
            value={form.source}
            onChange={(event) => update('source', event.target.value)}
            options={sourceOptions}
            placeholder="Selecione"
          />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="label-eyebrow mb-3">Contato</legend>
          <TextInput
            label="Telefone"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            error={errors.phone}
            placeholder="(41) 3333-4444"
            inputMode="tel"
            autoComplete="off"
          />
          <TextInput
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(event) => update('whatsapp', event.target.value)}
            error={errors.whatsapp}
            placeholder="(41) 99999-8888"
            inputMode="tel"
            autoComplete="off"
          />
          <TextInput
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            error={errors.email}
            placeholder="contato@empresa.com.br"
            autoComplete="off"
          />
          <TextInput
            label="Instagram"
            value={form.instagram}
            onChange={(event) => update('instagram', event.target.value)}
            placeholder="@perfil"
            hint="Perfil ou URL completa."
            autoComplete="off"
          />
          <TextInput
            label="Site"
            value={form.website}
            onChange={(event) => update('website', event.target.value)}
            placeholder="empresa.com.br"
            autoComplete="off"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Bairro"
              value={form.neighborhood}
              onChange={(event) => update('neighborhood', event.target.value)}
              autoComplete="off"
            />
            <TextInput
              label="Cidade"
              value={form.city}
              onChange={(event) => update('city', event.target.value)}
              autoComplete="off"
            />
          </div>
        </fieldset>

        {duplicates.length > 0 ? (
          <div className="flex gap-2.5 rounded-md border border-caution/30 bg-caution-soft px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden="true" />
            <div className="text-xs leading-relaxed text-caution-ink">
              <p className="font-semibold">Possível duplicidade</p>
              <p className="mt-0.5">
                Estes leads já usam o mesmo telefone ou e-mail:{' '}
                {duplicates
                  .map((candidate) => candidate.establishmentName || candidate.contactName)
                  .join(', ')}
                . Você pode cadastrar mesmo assim.
              </p>
            </div>
          </div>
        ) : null}

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="label-eyebrow mb-3">Oportunidade</legend>
          <SelectInput
            label="Etapa comercial"
            value={form.stageId}
            onChange={(event) => update('stageId', event.target.value)}
            options={stageOptions}
          />
          <TextInput
            label="Valor potencial"
            value={form.potentialValue}
            onChange={(event) => update('potentialValue', event.target.value)}
            adornment="R$"
            placeholder="0,00"
            inputMode="decimal"
            autoComplete="off"
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
            label="Próximo contato"
            type="date"
            value={form.nextContactAt}
            onChange={(event) => update('nextContactAt', event.target.value)}
          />
          <SelectInput
            label="Empresa vinculada"
            value={form.companyId}
            onChange={(event) => update('companyId', event.target.value)}
            options={companyOptions}
            placeholder={companyOptions.length ? 'Sem vínculo' : 'Nenhuma empresa cadastrada'}
            className="sm:col-span-2"
          />
          <TextArea
            label="Observações"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            rows={3}
            className="sm:col-span-2"
            placeholder="Contexto da conversa, necessidades levantadas, próximos passos…"
          />
        </fieldset>
        {/* Allows Enter-to-submit without a visible duplicate button */}
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
