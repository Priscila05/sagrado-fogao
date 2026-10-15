import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useData } from '../../state/DataProvider';
import { Link } from 'react-router-dom';

/**
 * Honest warnings about storage. Shown when the browser refused IndexedDB
 * (nothing is being saved) or when no backup has ever been exported.
 */
export function StorageNotice() {
  const { storageMode, settings, counts } = useData();
  const [dismissed, setDismissed] = useState(false);

  if (storageMode === 'memory') {
    return (
      <div
        role="alert"
        className="border-b border-critical/30 bg-critical-soft px-4 py-2.5 text-sm text-critical-ink sm:px-6 lg:px-8"
      >
        <div className="mx-auto flex max-w-[1400px] items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="font-semibold">O navegador bloqueou o armazenamento local.</strong>{' '}
            Os dados desta sessão ficam apenas na memória e serão perdidos ao fechar a aba. Saia do
            modo de navegação privada ou libere o armazenamento do site.
          </p>
        </div>
      </div>
    );
  }

  const hasData = counts.real.leads > 0 || counts.real.companies > 0;
  const needsBackup = hasData && !settings.lastBackupAt;

  if (!needsBackup || dismissed) return null;

  return (
    <div className="border-b border-caution/25 bg-caution-soft px-4 py-2.5 text-sm text-caution-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 leading-relaxed">
          Você ainda não exportou nenhum backup. Os dados vivem somente neste navegador —{' '}
          <Link
            to="/configuracoes"
            className="focus-ring rounded-sm font-semibold underline underline-offset-2"
          >
            exporte um arquivo JSON
          </Link>{' '}
          para não correr risco de perdê-los.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dispensar aviso"
          className="focus-ring -mr-1 rounded p-1 hover:bg-caution/10"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
