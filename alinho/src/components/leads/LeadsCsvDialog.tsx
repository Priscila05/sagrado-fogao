import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useData } from '../../state/DataProvider';
import { useToast } from '../ui/Toast';
import { parseCsv } from '../../utils/csv';
import {
  LEAD_CSV_FIELDS,
  buildCsvPreview,
  mapCsvRowsToLeads,
  type CsvPreview,
  type LeadCsvField,
} from '../../services/leadsCsv';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Two-step CSV import: preview + column mapping, then confirmation. */
export function LeadsCsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { stages, actions } = useData();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const reset = () => {
    setFileName('');
    setRawText('');
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError('O arquivo tem mais de 5 MB. Divida a planilha em partes menores.');
      return;
    }
    try {
      const text = await file.text();
      const next = buildCsvPreview(text);
      if (next.headers.length === 0 || next.totalRows === 0) {
        setError('O arquivo não contém uma linha de cabeçalho seguida de dados.');
        return;
      }
      setFileName(file.name);
      setRawText(text);
      setPreview(next);
    } catch {
      setError('Não foi possível ler o arquivo selecionado.');
    }
  };

  const updateMapping = (columnIndex: number, field: LeadCsvField | '') => {
    setPreview((current) => {
      if (!current) return current;
      const mapping = [...current.mapping];
      // A field can only be mapped once, so clear a previous assignment.
      if (field) {
        for (let index = 0; index < mapping.length; index += 1) {
          if (mapping[index] === field) mapping[index] = '';
        }
      }
      mapping[columnIndex] = field;
      return { ...current, mapping };
    });
  };

  const handleImport = async () => {
    if (!preview) return;
    const mapped = preview.mapping.filter(Boolean);
    if (mapped.length === 0) {
      setError('Associe pelo menos uma coluna a um campo do lead.');
      return;
    }
    if (!mapped.includes('contactName') && !mapped.includes('establishmentName')) {
      setError('Mapeie a coluna de contato ou de estabelecimento — é o mínimo para criar um lead.');
      return;
    }

    setWorking(true);
    try {
      const { rows } = parseCsv(rawText);
      const result = mapCsvRowsToLeads(preview, rows, stages);
      if (result.leads.length === 0) {
        setError('Nenhuma linha válida encontrada: todas estavam sem nome de contato e de estabelecimento.');
        return;
      }
      const imported = await actions.importLeads(result.leads);
      if (imported > 0) {
        toast.success(
          `${imported} lead(s) importado(s)`,
          [
            result.skipped > 0 ? `${result.skipped} linha(s) ignorada(s) por falta de nome.` : '',
            result.issues.length > 0 ? result.issues[0] : '',
          ]
            .filter(Boolean)
            .join(' ') || undefined,
        );
        handleClose();
      }
    } finally {
      setWorking(false);
    }
  };

  const fieldOptions: { value: LeadCsvField | ''; label: string }[] = [
    { value: '', label: 'Ignorar coluna' },
    ...LEAD_CSV_FIELDS.map((field) => ({ value: field.key, label: field.label })),
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar leads de CSV"
      description="Revise a prévia e confirme a associação das colunas antes de importar."
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={working}>
            Cancelar
          </Button>
          {preview ? (
            <Button variant="primary" onClick={handleImport} loading={working}>
              Importar {preview.totalRows} linha(s)
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {!preview ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-sunken/50 px-5 py-8 text-center">
            <FileSpreadsheet className="mx-auto h-6 w-6 text-subtle" aria-hidden="true" />
            <p className="mt-3 text-base font-medium text-ink">Selecione um arquivo CSV</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
              A primeira linha deve conter os nomes das colunas. Aceita separador ponto e vírgula,
              vírgula ou tabulação. Nada é enviado para fora do seu navegador.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => inputRef.current?.click()}
              data-autofocus
            >
              Escolher arquivo
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-sunken/60 px-3 py-2">
              <p className="min-w-0 truncate text-sm text-ink">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted"> · {preview.totalRows} linha(s) de dados</span>
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Trocar arquivo
              </Button>
            </div>

            <div>
              <p className="label-eyebrow mb-2">Associação de colunas</p>
              <div className="relative overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-sunken/70 text-2xs uppercase tracking-[0.05em] text-subtle">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Coluna do arquivo</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Campo do ALINHO</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.headers.map((header, index) => (
                      <tr key={`${header}-${index}`}>
                        <td className="px-3 py-2 align-middle text-ink">{header || `Coluna ${index + 1}`}</td>
                        <td className="px-3 py-2">
                          <select
                            value={preview.mapping[index] ?? ''}
                            onChange={(event) =>
                              updateMapping(index, event.target.value as LeadCsvField | '')
                            }
                            aria-label={`Campo para a coluna ${header || index + 1}`}
                            className="h-8 w-full min-w-[9rem] rounded-md border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                          >
                            {fieldOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-muted">
                          <span className="line-clamp-1 block max-w-[14rem] truncate">
                            {preview.rows[0]?.[index] || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              Os leads importados entram na primeira etapa do funil quando a coluna de etapa não for
              reconhecida, e cada um recebe um registro de histórico indicando a importação.
            </p>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-critical-ink">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
