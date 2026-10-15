import { useMemo, useState } from 'react';
import { AlertTriangle, CloudUpload } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PanelHeader } from '../ui/primitives';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../ui/Toast';
import { localRepositories, repositories } from '../../repositories';
import { formatNumber } from '../../utils/format';

/**
 * Envia os dados que estão neste navegador para o banco da empresa.
 *
 * Só o administrador consegue concluir (o RLS recusa os demais). Nada é
 * apagado: os registros são enviados com os mesmos identificadores, então
 * reenviar atualiza em vez de duplicar, e o banco local permanece intacto.
 */
export function CloudUploadPanel() {
  const { permissions, profile } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  const canUpload = permissions.importBackup;

  const loadCounts = async () => {
    const [leads, companies, activities, interactions, contracts, payments, expenses] =
      await Promise.all([
        localRepositories.leads.list('real'),
        localRepositories.companies.list('real'),
        localRepositories.activities.list('real'),
        localRepositories.interactions.list('real'),
        localRepositories.contracts.list('real'),
        localRepositories.payments.list('real'),
        localRepositories.expenses.list('real'),
      ]);
    setCounts({
      leads: leads.length,
      companies: companies.length,
      activities: activities.length,
      interactions: interactions.length,
      contracts: contracts.length,
      payments: payments.length,
      expenses: expenses.length,
    });
    setConfirmOpen(true);
  };

  const total = useMemo(
    () => (counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0),
    [counts],
  );

  const handleUpload = async () => {
    setWorking(true);
    try {
      const [leads, companies, activities, interactions, contracts, payments, expenses] =
        await Promise.all([
          localRepositories.leads.list('real'),
          localRepositories.companies.list('real'),
          localRepositories.activities.list('real'),
          localRepositories.interactions.list('real'),
          localRepositories.contracts.list('real'),
          localRepositories.payments.list('real'),
          localRepositories.expenses.list('real'),
        ]);

      // A ordem respeita as dependências entre as tabelas.
      await repositories.companies.saveMany(
        companies.map((company) => ({ ...company, ownerId: company.ownerId ?? profile?.id ?? null })),
      );
      await repositories.leads.saveMany(
        leads.map((lead) => ({ ...lead, ownerId: lead.ownerId ?? profile?.id ?? null })),
      );
      await repositories.activities.saveMany(
        activities.map((activity) => ({
          ...activity,
          ownerId: activity.ownerId ?? profile?.id ?? null,
        })),
      );
      await repositories.interactions.saveMany(
        interactions.map((interaction) => ({
          ...interaction,
          authorId: interaction.authorId ?? profile?.id ?? null,
        })),
      );
      await repositories.contracts.saveMany(contracts);
      await repositories.payments.saveMany(payments);
      await repositories.expenses.saveMany(expenses);

      toast.success(
        'Dados enviados para o Supabase',
        `${formatNumber(leads.length)} lead(s) e ${formatNumber(companies.length)} empresa(s). O banco deste navegador continua intacto.`,
      );
      setConfirmOpen(false);
    } catch (error) {
      toast.error(
        'Não foi possível enviar',
        error instanceof Error ? error.message : 'Erro desconhecido.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <PanelHeader
        title="Enviar dados deste navegador para o Supabase"
        description="Leva para o banco da empresa os registros que você já tinha no modo local."
      />
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        <p className="text-sm leading-relaxed text-muted">
          Os registros são enviados com os mesmos identificadores: rodar de novo atualiza o que já
          existe em vez de duplicar. Nada é apagado — nem no banco da empresa, nem aqui.
        </p>
        {!canUpload ? (
          <p className="flex items-start gap-2 rounded-md bg-caution-soft px-3 py-2 text-xs text-caution-ink">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Apenas o administrador pode enviar dados para o banco da empresa.
          </p>
        ) : null}
        <Button
          variant="secondary"
          icon={<CloudUpload className="h-4 w-4" />}
          onClick={loadCounts}
          disabled={!canUpload}
          className="self-start"
        >
          Conferir e enviar
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Enviar dados para o Supabase"
        message={
          counts
            ? `Enviar ${formatNumber(total)} registro(s) deste navegador para o banco da empresa?`
            : ''
        }
        detail={
          counts
            ? `${formatNumber(counts.leads)} lead(s), ${formatNumber(counts.companies)} empresa(s), ${formatNumber(counts.activities)} atividade(s), ${formatNumber(counts.interactions)} registro(s) de histórico, ${formatNumber(counts.contracts)} contrato(s), ${formatNumber(counts.payments)} pagamento(s) e ${formatNumber(counts.expenses)} despesa(s). Registros com o mesmo identificador são atualizados.`
            : ''
        }
        confirmLabel={working ? 'Enviando…' : 'Enviar'}
        tone="primary"
        onConfirm={handleUpload}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
