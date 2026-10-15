import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectInput } from '../ui/Field';
import { useAuth } from '../../auth/AuthProvider';
import { useData } from '../../state/DataProvider';
import { useToast } from '../ui/Toast';
import { displayName } from '../../auth/roles';
import { formatNumber } from '../../utils/format';
import type { Lead } from '../../models/types';

/**
 * Distribuição de leads: atribui vários leads a uma pessoa de uma vez.
 * Só aparece para quem pode distribuir, e a lista de destinos é limitada a
 * quem o usuário enxerga — as mesmas regras que o banco aplica.
 */
export function DistributeDialog({
  open,
  onClose,
  leads,
  onDistributed,
}: {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  onDistributed?: () => void;
}) {
  const { team, profile } = useAuth();
  const { actions } = useData();
  const toast = useToast();
  const [ownerId, setOwnerId] = useState('');
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async () => {
    if (leads.length === 0) return;
    setWorking(true);
    setProgress(0);
    let done = 0;
    let failed = 0;
    try {
      for (const lead of leads) {
        const saved = await actions.updateLead(lead.id, { ownerId: ownerId || null });
        if (saved) done += 1;
        else failed += 1;
        setProgress(done + failed);
      }
      const target = team.find((member) => member.id === ownerId);
      if (done > 0) {
        toast.success(
          `${formatNumber(done)} lead(s) distribuído(s)`,
          target ? `Agora sob responsabilidade de ${displayName(target)}.` : 'Responsável removido.',
        );
      }
      if (failed > 0) {
        toast.error(
          `${formatNumber(failed)} lead(s) não puderam ser distribuídos`,
          'Verifique se você tem permissão sobre esses registros.',
        );
      }
      onDistributed?.();
      onClose();
    } finally {
      setWorking(false);
      setProgress(0);
    }
  };

  return (
    <Modal
      open={open}
      onClose={working ? () => undefined : onClose}
      title="Distribuir leads"
      description={`${formatNumber(leads.length)} lead(s) selecionado(s).`}
      size="sm"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={working}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={working}>
            {working && progress > 0
              ? `Distribuindo ${progress}/${leads.length}…`
              : 'Distribuir'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectInput
          label="Novo responsável"
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
          options={team.map((member) => ({
            value: member.id,
            label: `${displayName(member)}${member.id === profile?.id ? ' (você)' : ''}`,
          }))}
          placeholder="Deixar sem responsável"
          data-autofocus
        />
        <p className="text-xs leading-relaxed text-muted">
          O histórico, as atividades e as oportunidades de cada lead continuam como estão — muda
          apenas quem acompanha.
        </p>
        <ul className="max-h-40 overflow-y-auto rounded-md border border-line bg-sunken/40 px-3 py-2 text-xs text-muted">
          {leads.slice(0, 20).map((lead) => (
            <li key={lead.id} className="truncate py-0.5">
              {lead.establishmentName || lead.contactName || 'Lead sem nome'}
            </li>
          ))}
          {leads.length > 20 ? <li className="py-0.5">e mais {leads.length - 20}…</li> : null}
        </ul>
      </div>
    </Modal>
  );
}
