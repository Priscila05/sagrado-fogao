import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput, TextArea, TextInput } from '../ui/Field';
import { useData } from '../../state/DataProvider';
import { isValidEmail, isValidPhone } from '../../utils/format';
import { COMPANY_STATUS_LABEL, type Company, type CompanyStatus } from '../../models/types';

interface FormState {
  name: string;
  segment: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  instagram: string;
  website: string;
  status: CompanyStatus;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  segment: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  neighborhood: '',
  city: '',
  instagram: '',
  website: '',
  status: 'prospect',
  notes: '',
};

export function CompanyForm({
  open,
  onClose,
  company,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  company?: Company | null;
  onSaved?: (company: Company) => void;
}) {
  const { settings, actions, saving } = useData();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setForm(
      company
        ? {
            name: company.name,
            segment: company.segment,
            phone: company.phone,
            whatsapp: company.whatsapp,
            email: company.email,
            address: company.address,
            neighborhood: company.neighborhood,
            city: company.city,
            instagram: company.instagram,
            website: company.website,
            status: company.status,
            notes: company.notes,
          }
        : EMPTY,
    );
    setErrors({});
  }, [open, company]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Informe o nome da empresa.';
    if (form.phone.trim() && !isValidPhone(form.phone)) next.phone = 'Telefone inválido.';
    if (form.whatsapp.trim() && !isValidPhone(form.whatsapp)) next.whatsapp = 'WhatsApp inválido.';
    if (form.email.trim() && !isValidEmail(form.email)) next.email = 'E-mail inválido.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      ...form,
      name: form.name.trim(),
      segment: form.segment.trim(),
      notes: form.notes.trim(),
    };
    const saved = company
      ? await actions.updateCompany(company.id, payload)
      : await actions.createCompany(payload);
    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={company ? 'Editar empresa' : 'Nova empresa'}
      description={
        company
          ? 'Atualize os dados cadastrais e a situação comercial.'
          : 'Cadastre uma empresa para agrupar contatos e oportunidades.'
      }
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {company ? 'Salvar alterações' : 'Cadastrar empresa'}
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
          label="Nome da empresa"
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          error={errors.name}
          required
          className="sm:col-span-2"
          data-autofocus
          autoComplete="off"
        />
        <SelectInput
          label="Segmento"
          value={form.segment}
          onChange={(event) => update('segment', event.target.value)}
          options={settings.segments.map((segment) => ({ value: segment, label: segment }))}
          placeholder="Selecione"
        />
        <SelectInput
          label="Situação comercial"
          value={form.status}
          onChange={(event) => update('status', event.target.value as CompanyStatus)}
          options={(Object.keys(COMPANY_STATUS_LABEL) as CompanyStatus[]).map((value) => ({
            value,
            label: COMPANY_STATUS_LABEL[value],
          }))}
          hint="Prospect vira cliente quando uma oportunidade é ganha."
        />
        <TextInput
          label="Telefone"
          value={form.phone}
          onChange={(event) => update('phone', event.target.value)}
          error={errors.phone}
          inputMode="tel"
          placeholder="(41) 3333-4444"
          autoComplete="off"
        />
        <TextInput
          label="WhatsApp"
          value={form.whatsapp}
          onChange={(event) => update('whatsapp', event.target.value)}
          error={errors.whatsapp}
          inputMode="tel"
          placeholder="(41) 99999-8888"
          autoComplete="off"
        />
        <TextInput
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email}
          autoComplete="off"
        />
        <TextInput
          label="Site"
          value={form.website}
          onChange={(event) => update('website', event.target.value)}
          placeholder="empresa.com.br"
          autoComplete="off"
        />
        <TextInput
          label="Instagram"
          value={form.instagram}
          onChange={(event) => update('instagram', event.target.value)}
          placeholder="@perfil"
          autoComplete="off"
        />
        <TextInput
          label="Endereço"
          value={form.address}
          onChange={(event) => update('address', event.target.value)}
          placeholder="Rua, número, complemento"
          autoComplete="off"
        />
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
        <TextArea
          label="Observações"
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          className="sm:col-span-2"
          rows={3}
        />
        <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
