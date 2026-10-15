import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

/** Editable list of simple labels (lead sources, segments). */
export function TagListEditor({
  label,
  description,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  description: string;
  values: string[];
  onChange: (next: string[]) => void | Promise<unknown>;
  placeholder: string;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      toast.error('Item repetido', `"${value}" já está na lista.`);
      return;
    }
    void onChange([...values, value]);
    setDraft('');
  };

  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-base font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{description}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <li
            key={value}
            className="flex items-center gap-1 rounded-sm border border-line bg-surface py-0.5 pl-2 pr-0.5 text-sm text-ink"
          >
            {value}
            <button
              type="button"
              onClick={() => void onChange(values.filter((item) => item !== value))}
              aria-label={`Remover ${value}`}
              className="focus-ring rounded p-0.5 text-subtle transition-colors hover:bg-sunken hover:text-critical"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </li>
        ))}
        {values.length === 0 ? (
          <li className="text-sm text-subtle">Nenhum item cadastrado.</li>
        ) : null}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{`Novo item em ${label}`}</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={add}>
          Adicionar
        </Button>
      </div>
      <p className="mt-2 text-xs text-subtle">
        Remover um item da lista não altera os leads já cadastrados com esse valor.
      </p>
    </div>
  );
}
