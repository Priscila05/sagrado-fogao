import { useState } from 'react';
import { Database, Info, Monitor, Moon, PlayCircle, Sun, Trash2 } from 'lucide-react';
import { useData } from '../state/DataProvider';
import { useTheme, type ThemePreference } from '../hooks/useTheme';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader, Panel, PanelHeader, SegmentedControl } from '../components/ui/primitives';
import { StagesEditor } from '../components/settings/StagesEditor';
import { TagListEditor } from '../components/settings/TagListEditor';
import { BackupPanel } from '../components/settings/BackupPanel';
import { formatNumber } from '../utils/format';
import { APP_VERSION } from '../models/defaults';
import type { Dataset } from '../models/types';

export function SettingsPage() {
  const { settings, counts, storageMode, dataset, actions, saving } = useData();
  const { preference, setPreference } = useTheme();
  const [eraseOpen, setEraseOpen] = useState(false);
  const [clearDemoOpen, setClearDemoOpen] = useState(false);

  const changeTheme = (next: ThemePreference) => {
    setPreference(next);
    // Mirrored into the stored settings so a restored backup keeps the choice.
    void actions.updateSettings({ theme: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Configurações"
        title="Preferências e dados"
        description="Personalize o funil, gerencie backups e entenda exatamente onde seus dados ficam."
      />

      <Panel>
        <PanelHeader title="Aparência" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <p className="text-base font-medium text-ink">Tema da interface</p>
            <p className="mt-0.5 text-xs text-muted">
              A preferência fica salva neste navegador (única informação guardada fora do banco
              local).
            </p>
          </div>
          <SegmentedControl
            label="Tema"
            value={preference}
            onChange={changeTheme}
            options={[
              { value: 'light', label: 'Claro', icon: Sun },
              { value: 'dark', label: 'Escuro', icon: Moon },
              { value: 'system', label: 'Sistema', icon: Monitor },
            ]}
          />
        </div>
      </Panel>

      <Panel>
        <StagesEditor />
      </Panel>

      <Panel>
        <PanelHeader
          title="Listas do cadastro"
          description="Opções oferecidas nos formulários de lead e empresa."
        />
        <div className="divide-y divide-line">
          <TagListEditor
            label="Origens de lead"
            description="De onde o contato veio: prospecção, indicação, Instagram…"
            values={settings.sources}
            onChange={(next) => actions.updateSettings({ sources: next })}
            placeholder="Nova origem"
          />
          <TagListEditor
            label="Segmentos"
            description="Tipo de negócio do estabelecimento."
            values={settings.segments}
            onChange={(next) => actions.updateSettings({ segments: next })}
            placeholder="Novo segmento"
          />
          <TagListEditor
            label="Categorias de despesa"
            description="Usadas no cadastro de despesas do módulo financeiro."
            values={settings.expenseCategories}
            onChange={(next) => actions.updateSettings({ expenseCategories: next })}
            placeholder="Nova categoria"
          />
          <TagListEditor
            label="Formas de pagamento"
            description="Oferecidas em contratos e no registro de recebimentos."
            values={settings.paymentMethods}
            onChange={(next) => actions.updateSettings({ paymentMethods: next })}
            placeholder="Nova forma de pagamento"
          />
        </div>
      </Panel>

      <Panel>
        <BackupPanel />
      </Panel>

      <Panel>
        <PanelHeader
          title="Dados de demonstração"
          description="Um conjunto fictício, separado dos seus dados reais, para conhecer o sistema."
        />
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <SegmentedControl
            label="Conjunto de dados em uso"
            value={dataset}
            onChange={(next: Dataset) => void actions.setDataset(next)}
            options={[
              { value: 'real', label: `Meus dados (${formatNumber(counts.real.leads)})` },
              { value: 'demo', label: `Demonstração (${formatNumber(counts.demo.leads)})` },
            ]}
          />
          <p className="text-xs leading-relaxed text-muted">
            Os dois conjuntos nunca se misturam: indicadores, funil e relatórios sempre refletem
            apenas o conjunto ativo, e os registros de demonstração ficam fora dos backups. Todos os
            nomes e telefones da demonstração são fictícios e marcados com “(demo)”.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<PlayCircle className="h-3.5 w-3.5" />}
              onClick={() => void actions.seedDemo()}
              loading={saving}
            >
              {counts.demo.leads > 0 ? 'Recriar demonstração' : 'Explorar demonstração'}
            </Button>
            {counts.demo.leads > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setClearDemoOpen(true)}
              >
                Remover dados de demonstração
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Privacidade e armazenamento" />
        <div className="flex flex-col gap-3 px-4 py-4 text-sm leading-relaxed text-muted sm:px-5">
          <p className="flex items-start gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            <span>
              Todos os registros ficam no banco de dados local deste navegador (IndexedDB), neste
              dispositivo.{' '}
              {storageMode === 'memory'
                ? 'Neste momento o navegador bloqueou o armazenamento: os dados desta sessão serão perdidos ao fechar a aba.'
                : 'Nada é enviado para servidores: o ALINHO não tem back-end, login, análise de uso ou rastreamento.'}
            </span>
          </p>
          <p className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            <span>
              Não há sincronização automática entre dispositivos nem proteção por senha. Limpar os
              dados do site, usar outro navegador ou outro computador significa começar vazio — a
              transferência acontece por exportação e importação de backup. Por isso, esta versão não
              é indicada para dados sensíveis nem para compartilhamento entre equipes.
            </span>
          </p>
          <dl className="mt-1 grid grid-cols-2 gap-3 rounded-md border border-line bg-sunken/40 p-3 sm:grid-cols-4">
            {[
              ['Leads', counts.real.leads],
              ['Empresas', counts.real.companies],
              ['Atividades', counts.real.activities],
              ['Histórico', counts.real.interactions],
              ['Contratos', counts.real.contracts],
              ['Pagamentos', counts.real.payments],
              ['Despesas', counts.real.expenses],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-2xs uppercase tracking-[0.05em] text-subtle">{label}</dt>
                <dd className="text-md font-semibold text-ink tnum">{formatNumber(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-subtle">
            ALINHO versão {APP_VERSION} · armazenamento:{' '}
            {storageMode === 'indexeddb'
              ? 'IndexedDB'
              : storageMode === 'memory'
                ? 'memória temporária'
                : 'verificando'}
          </p>
        </div>
      </Panel>

      <Panel className="border-critical/25">
        <PanelHeader
          title="Apagar meus dados"
          description="Remove definitivamente os registros reais deste navegador."
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Exporte um backup antes: esta ação não pode ser desfeita e não existe cópia em servidor.
          </p>
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setEraseOpen(true)}
            disabled={counts.real.leads + counts.real.companies === 0}
          >
            Apagar dados
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={eraseOpen}
        title="Apagar todos os dados reais"
        message={`Apagar ${formatNumber(counts.real.leads)} lead(s), ${formatNumber(
          counts.real.companies,
        )} empresa(s), ${formatNumber(counts.real.activities)} atividade(s), ${formatNumber(
          counts.real.contracts,
        )} contrato(s), ${formatNumber(counts.real.payments)} pagamento(s), ${formatNumber(
          counts.real.expenses,
        )} despesa(s) e todo o histórico?`}
        detail="A ação é irreversível. As configurações e os dados de demonstração são mantidos."
        confirmLabel="Apagar definitivamente"
        onConfirm={async () => {
          await actions.eraseRealData();
          setEraseOpen(false);
        }}
        onCancel={() => setEraseOpen(false)}
      />

      <ConfirmDialog
        open={clearDemoOpen}
        title="Remover demonstração"
        message="Remover todos os registros de demonstração?"
        detail="Seus dados reais não são afetados. Você pode recriar a demonstração depois."
        confirmLabel="Remover demonstração"
        onConfirm={async () => {
          await actions.clearDemo();
          setClearDemoOpen(false);
        }}
        onCancel={() => setClearDemoOpen(false)}
      />
    </div>
  );
}
