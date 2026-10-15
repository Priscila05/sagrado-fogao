import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, UserCog, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useData } from '../state/DataProvider';
import { computeMemberPerformance, sumPerformance } from '../services/teamMetrics';
import { ROLE_LABEL, displayName, type Role } from '../auth/roles';
import { MetricTile } from '../components/shared/MetricTile';
import { BarList } from '../components/charts/BarList';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
} from '../components/ui/primitives';
import { formatCurrencyShort, formatNumber, formatPercent } from '../utils/format';
import { relativeDayLabel } from '../utils/date';

const ROLE_TONE: Record<Role, 'accent' | 'positive' | 'neutral'> = {
  admin: 'positive',
  gerente: 'accent',
  vendedor: 'neutral',
};

/** Painel de supervisão: desempenho individual de quem o usuário enxerga. */
export function TeamPage() {
  const { profile, team, permissions, updateMember, refreshTeam } = useAuth();
  const { leads, activities, stages } = useData();
  const [saving, setSaving] = useState<string | null>(null);

  const rows = useMemo(() => {
    const members = team.map((member) => ({
      member,
      performance: computeMemberPerformance(member.id, leads, activities, stages),
    }));
    // Leads ainda sem responsável aparecem como uma linha própria: é o que
    // falta distribuir.
    const unassigned = computeMemberPerformance(null, leads, activities, stages);
    return { members, unassigned };
  }, [team, leads, activities, stages]);

  const totals = useMemo(
    () => sumPerformance([...rows.members.map((row) => row.performance), rows.unassigned]),
    [rows],
  );

  if (!profile) {
    return (
      <Panel>
        <EmptyState
          icon={Users}
          title="Painel disponível apenas no modo equipe"
          description="Conecte o ALINHO ao Supabase para acompanhar o desempenho individual da equipe."
        />
      </Panel>
    );
  }

  const handleRole = async (id: string, role: Role) => {
    setSaving(id);
    await updateMember(id, { role });
    setSaving(null);
  };

  const handleManager = async (id: string, managerId: string) => {
    setSaving(id);
    await updateMember(id, { managerId: managerId || null });
    setSaving(null);
  };

  const handleActive = async (id: string, active: boolean) => {
    setSaving(id);
    await updateMember(id, { active });
    setSaving(null);
  };

  const managers = team.filter((member) => member.role === 'gerente' || member.role === 'admin');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Supervisão"
        title="Equipe"
        description={
          profile.role === 'admin'
            ? 'Desempenho de toda a empresa, calculado a partir dos registros.'
            : 'Desempenho da sua equipe direta.'
        }
      />

      <section aria-label="Totais da equipe" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Pessoas" value={formatNumber(team.length)} icon={Users} />
        <MetricTile label="Leads acompanhados" value={formatNumber(totals.leads)} />
        <MetricTile
          label="Em andamento"
          value={formatNumber(totals.open)}
          hint={`${formatCurrencyShort(totals.pipelineValue)} em potencial`}
          tone="accent"
        />
        <MetricTile
          label="Atividades atrasadas"
          value={formatNumber(totals.activitiesOverdue)}
          tone={totals.activitiesOverdue > 0 ? 'critical' : 'neutral'}
        />
      </section>

      <Panel>
        <PanelHeader
          title="Desempenho individual"
          description="Cada linha considera os leads e as atividades sob responsabilidade da pessoa."
        />
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-[0.05em] text-subtle">
                <th scope="col" className="px-4 py-2.5 font-semibold">Pessoa</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Papel</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Leads</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Em aberto</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Ganhos</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Conversão</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Funil</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Atrasadas</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Última interação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.members.map(({ member, performance }) => (
                <tr key={member.id} className="transition-colors hover:bg-sunken/60">
                  <td className="px-4 py-2.5">
                    <p className="text-base font-medium text-ink">
                      {displayName(member)}
                      {member.id === profile.id ? (
                        <span className="ml-1.5 text-xs font-normal text-subtle">(você)</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">{member.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-1">
                      <Badge tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                      {!member.active ? <Badge tone="critical">Inativo</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                    {formatNumber(performance.leads)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                    {formatNumber(performance.open)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-positive tnum">
                    {formatNumber(performance.won)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                    {performance.won + performance.lost > 0
                      ? formatPercent(performance.conversionRate)
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-muted tnum">
                    {formatCurrencyShort(performance.pipelineValue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base tnum">
                    {performance.activitiesOverdue > 0 ? (
                      <span className="font-medium text-critical">
                        {formatNumber(performance.activitiesOverdue)}
                      </span>
                    ) : (
                      <span className="text-subtle">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted">
                    {performance.lastActivityAt
                      ? relativeDayLabel(performance.lastActivityAt)
                      : 'nunca'}
                  </td>
                </tr>
              ))}

              {rows.unassigned.leads > 0 ? (
                <tr className="bg-caution-soft/40">
                  <td className="px-4 py-2.5" colSpan={2}>
                    <p className="flex items-center gap-1.5 text-base font-medium text-caution-ink">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Sem responsável
                    </p>
                    <p className="mt-0.5 text-xs text-caution-ink/80">
                      <Link to="/leads" className="focus-ring rounded-sm underline underline-offset-2">
                        Distribua estes leads
                      </Link>{' '}
                      para que alguém acompanhe.
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                    {formatNumber(rows.unassigned.leads)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base text-ink tnum">
                    {formatNumber(rows.unassigned.open)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base tnum">—</td>
                  <td className="px-4 py-2.5 text-right text-base tnum">—</td>
                  <td className="px-4 py-2.5 text-right text-base text-muted tnum">
                    {formatCurrencyShort(rows.unassigned.pipelineValue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-base tnum">
                    {formatNumber(rows.unassigned.activitiesOverdue)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-subtle">—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Leads por responsável" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={[
                ...rows.members.map(({ member, performance }) => ({
                  label: displayName(member),
                  value: performance.leads,
                })),
                ...(rows.unassigned.leads > 0
                  ? [{ label: 'Sem responsável', value: rows.unassigned.leads }]
                  : []),
              ]}
              emptyLabel="Nenhum lead atribuído ainda."
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Valor em aberto por responsável" />
          <div className="px-4 py-4 sm:px-5">
            <BarList
              items={rows.members.map(({ member, performance }) => ({
                label: displayName(member),
                value: performance.pipelineValue,
              }))}
              tone="accent"
              valueFormatter={(value) => formatCurrencyShort(value)}
              emptyLabel="Nenhuma oportunidade aberta."
            />
          </div>
        </Panel>
      </div>

      {permissions.manageTeam ? (
        <Panel>
          <PanelHeader
            title="Papéis e supervisão"
            description="Quem pode ver o quê. O banco aplica as mesmas regras, independentemente da tela."
            action={
              <button
                type="button"
                onClick={() => void refreshTeam()}
                className="focus-ring rounded-sm text-xs font-medium text-accent"
              >
                Atualizar
              </button>
            }
          />
          <ul className="divide-y divide-line">
            {team.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-[10rem] flex-1">
                  <p className="truncate text-base font-medium text-ink">{displayName(member)}</p>
                  <p className="truncate text-xs text-subtle">{member.email}</p>
                </div>

                <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                  Papel
                  <select
                    value={member.role}
                    disabled={saving === member.id || member.id === profile.id}
                    onChange={(event) => void handleRole(member.id, event.target.value as Role)}
                    className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
                    aria-label={`Papel de ${displayName(member)}`}
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-2xs font-medium text-subtle">
                  Supervisor
                  <select
                    value={member.managerId ?? ''}
                    disabled={saving === member.id}
                    onChange={(event) => void handleManager(member.id, event.target.value)}
                    className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
                    aria-label={`Supervisor de ${displayName(member)}`}
                  >
                    <option value="">Sem supervisor</option>
                    {managers
                      .filter((candidate) => candidate.id !== member.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {displayName(candidate)}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={member.active}
                    disabled={saving === member.id || member.id === profile.id}
                    onChange={(event) => void handleActive(member.id, event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded-sm border-line-strong accent-[rgb(var(--c-accent))]"
                  />
                  Ativo
                </label>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-xs leading-relaxed text-subtle sm:px-5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Você não pode alterar o próprio papel nem se desativar — isso evita que a empresa
            fique sem administrador. Novos acessos são criados no painel do Supabase.
          </p>
        </Panel>
      ) : (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
          <UserCog className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Papéis e supervisão são definidos pelo administrador da empresa.
        </p>
      )}
    </div>
  );
}
