import { useState } from 'react';
import { LogOut, ShieldCheck, UserCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { Badge, PanelHeader } from '../ui/primitives';
import { useAuth } from '../../auth/AuthProvider';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '../../auth/roles';
import { useToast } from '../ui/Toast';
import { supabaseUrl } from '../../lib/supabaseClient';

/** Conta do usuário no modo equipe: nome, papel e saída. */
export function AccountPanel() {
  const { profile, permissions, updateProfileName, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.fullName ?? '');
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const host = (() => {
    try {
      return new URL(supabaseUrl).host;
    } catch {
      return supabaseUrl;
    }
  })();

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateProfileName(name);
    setSaving(false);
    if (ok) toast.success('Nome atualizado');
    else toast.error('Não foi possível atualizar o nome');
  };

  return (
    <>
      <PanelHeader
        title="Minha conta"
        description="Seu acesso é individual e identifica quem registrou cada interação."
      />
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-sunken text-subtle">
              <UserCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-ink">{profile.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone={profile.role === 'admin' ? 'positive' : 'accent'}>
                  {ROLE_LABEL[profile.role]}
                </Badge>
                <span className="text-xs text-muted">{ROLE_DESCRIPTION[profile.role]}</span>
              </div>
            </div>
          </div>
          <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>
            Sair
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <TextInput
            label="Nome exibido"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-[14rem] flex-1"
            autoComplete="name"
          />
          <Button
            variant="secondary"
            onClick={handleSave}
            loading={saving}
            disabled={name.trim() === profile.fullName.trim()}
          >
            Salvar nome
          </Button>
        </div>

        <p className="flex items-start gap-2 rounded-md bg-sunken/60 px-3 py-2.5 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
          <span>
            Conectado ao banco da empresa em <strong className="font-medium text-ink">{host}</strong>.
            As permissões são aplicadas pelo próprio banco: mesmo que uma tela mostrasse um botão a
            mais, o servidor recusaria a operação.
            {permissions.viewFinance
              ? ' Como administrador, você enxerga o financeiro.'
              : ' O módulo financeiro é exclusivo do administrador.'}
          </span>
        </p>
      </div>
    </>
  );
}
