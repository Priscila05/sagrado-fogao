import { useRef, useState } from 'react';
import { AlertTriangle, Download, FileJson, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PanelHeader } from '../ui/primitives';
import { useData } from '../../state/DataProvider';
import { useToast } from '../ui/Toast';
import {
  buildBackup,
  readBackup,
  type BackupPayload,
  type BackupReadResult,
} from '../../services/backup';
import { leadsToCsv } from '../../services/leadsCsv';
import { downloadTextFile, fileStamp } from '../../utils/csv';
import { formatDateTime, relativeDayLabel } from '../../utils/date';
import { formatNumber } from '../../utils/format';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

interface PendingImport {
  fileName: string;
  payload: BackupPayload;
  warnings: string[];
  summary: NonNullable<BackupReadResult['summary']>;
}

/** Full JSON backup, CSV export and validated import. */
export function BackupPanel() {
  const { settings, counts, stages, actions, dataset } = useData();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleExportJson = async () => {
    const snapshot = actions.snapshot();
    // Demonstration records are never part of a backup.
    const payload: BackupPayload = {
      leads: snapshot.leads.filter((row) => row.dataset === 'real'),
      companies: snapshot.companies.filter((row) => row.dataset === 'real'),
      activities: snapshot.activities.filter((row) => row.dataset === 'real'),
      interactions: snapshot.interactions.filter((row) => row.dataset === 'real'),
      contracts: snapshot.contracts.filter((row) => row.dataset === 'real'),
      payments: snapshot.payments.filter((row) => row.dataset === 'real'),
      expenses: snapshot.expenses.filter((row) => row.dataset === 'real'),
      settings: { ...snapshot.settings, activeDataset: 'real', demoSeeded: false },
    };
    const backup = buildBackup(payload);
    downloadTextFile(
      `alinho-backup_${fileStamp()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json',
    );
    await actions.markBackupExported();
    toast.success(
      'Backup exportado',
      `${formatNumber(payload.leads.length)} lead(s) e ${formatNumber(
        payload.companies.length,
      )} empresa(s) no arquivo.`,
    );
  };

  const handleExportLeadsCsv = () => {
    const snapshot = actions.snapshot();
    const rows = snapshot.leads.filter((row) => row.dataset === dataset);
    if (rows.length === 0) {
      toast.error('Nada para exportar', 'Nenhum lead cadastrado neste conjunto de dados.');
      return;
    }
    downloadTextFile(`alinho-leads_${fileStamp()}.csv`, leadsToCsv(rows, stages), 'text/csv');
    toast.success(`${formatNumber(rows.length)} lead(s) exportado(s) em CSV`);
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setImportError('O arquivo tem mais de 25 MB e não parece ser um backup do ALINHO.');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportError('Não foi possível ler o arquivo selecionado.');
      return;
    }
    const result = readBackup(text);
    if (!result.ok || !result.payload || !result.summary) {
      setImportError(result.error ?? 'Arquivo de backup inválido.');
      return;
    }
    setPending({
      fileName: file.name,
      payload: result.payload,
      warnings: result.warnings,
      summary: result.summary,
    });
  };

  const confirmImport = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      const imported = await actions.importBackup(pending.payload);
      if (imported) setPending(null);
    } finally {
      setWorking(false);
    }
  };

  const lastBackup = settings.lastBackupAt;

  return (
    <>
      <PanelHeader
        title="Backup e portabilidade"
        description="Seus dados vivem apenas neste navegador. O backup é a única forma de levá-los para outro dispositivo."
      />

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div
          className={[
            'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm',
            lastBackup
              ? 'bg-positive-soft text-positive-ink'
              : 'bg-caution-soft text-caution-ink',
          ].join(' ')}
        >
          {lastBackup ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <p className="leading-relaxed">
            {lastBackup ? (
              <>
                Último backup exportado em{' '}
                <strong className="font-semibold">{formatDateTime(lastBackup)}</strong> (
                {relativeDayLabel(lastBackup)}). Exporte novamente depois de mudanças importantes.
              </>
            ) : (
              <>
                <strong className="font-semibold">Nenhum backup exportado ainda.</strong> Se este
                navegador perder os dados do site, não há como recuperar os registros.
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-sunken/40 p-3.5">
            <p className="flex items-center gap-2 text-base font-medium text-ink">
              <FileJson className="h-4 w-4 text-accent" aria-hidden="true" />
              Backup completo (JSON)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Inclui leads, empresas, oportunidades, atividades, histórico, contratos,
              pagamentos, despesas, configurações e os vínculos entre registros. Dados de
              demonstração ficam de fora.
            </p>
            <p className="mt-2 text-xs text-subtle tnum">
              {formatNumber(counts.real.leads)} lead(s) · {formatNumber(counts.real.companies)}{' '}
              empresa(s) · {formatNumber(counts.real.activities)} atividade(s) ·{' '}
              {formatNumber(counts.real.interactions)} registro(s)
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExportJson}
            >
              Exportar backup
            </Button>
          </div>

          <div className="rounded-md border border-line bg-sunken/40 p-3.5">
            <p className="flex items-center gap-2 text-base font-medium text-ink">
              <Upload className="h-4 w-4 text-accent" aria-hidden="true" />
              Importar backup
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              O arquivo é validado antes de qualquer gravação. A importação substitui todo o
              conteúdo atual deste navegador, e você confirma antes.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                if (inputRef.current) inputRef.current.value = '';
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              icon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => inputRef.current?.click()}
            >
              Escolher arquivo JSON
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={handleExportLeadsCsv}
          >
            Exportar leads em CSV
          </Button>
          <p className="text-xs text-subtle">
            Útil para planilhas. O CSV não substitui o backup JSON: ele não carrega histórico nem
            vínculos.
          </p>
        </div>

        {importError ? (
          <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-critical-ink">
            {importError}
          </p>
        ) : null}
      </div>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Confirmar importação"
        description="Revise o conteúdo do arquivo antes de substituir os dados atuais."
        closeOnOverlay={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={working}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmImport} loading={working}>
              Substituir dados atuais
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Arquivo <span className="font-medium text-ink">{pending.fileName}</span> · formato
              versão {pending.summary.version}
              {pending.summary.exportedAt
                ? ` · exportado em ${formatDateTime(pending.summary.exportedAt)}`
                : ''}
            </p>

            <dl className="grid grid-cols-2 gap-2 rounded-md border border-line bg-sunken/50 p-3 text-sm sm:grid-cols-4">
              {[
                ['Leads', pending.summary.leads],
                ['Empresas', pending.summary.companies],
                ['Atividades', pending.summary.activities],
                ['Histórico', pending.summary.interactions],
                ['Contratos', pending.summary.contracts],
                ['Pagamentos', pending.summary.payments],
                ['Despesas', pending.summary.expenses],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-2xs uppercase tracking-[0.05em] text-subtle">{label}</dt>
                  <dd className="text-md font-semibold text-ink tnum">
                    {formatNumber(Number(value))}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="rounded-md bg-critical-soft px-3 py-2.5 text-sm text-critical-ink">
              <p className="flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Isto apaga os dados atuais deste navegador (
                  {formatNumber(counts.real.leads)} lead(s) e{' '}
                  {formatNumber(counts.real.companies)} empresa(s)) e grava o conteúdo do arquivo.
                  Exporte um backup antes se tiver dúvida.
                </span>
              </p>
            </div>

            {pending.warnings.length > 0 ? (
              <div>
                <p className="label-eyebrow mb-1.5">Ajustes aplicados na leitura</p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted">
                  {pending.warnings.slice(0, 8).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                  {pending.warnings.length > 8 ? (
                    <li>e mais {pending.warnings.length - 8} ajuste(s).</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
