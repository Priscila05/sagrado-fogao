import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PanelHeader } from '../ui/primitives';
import { useData } from '../../state/DataProvider';
import { useToast } from '../ui/Toast';
import { slugify } from '../../utils/id';
import { STAGE_KIND_LABEL, type Stage } from '../../models/types';

/**
 * Pipeline editor. Renaming and reordering never touches lead records; removing
 * a stage moves its leads to the first stage instead of deleting anything.
 */
export function StagesEditor() {
  const { settings, stages, leads, actions, saving } = useData();
  const toast = useToast();
  const [draft, setDraft] = useState<Stage[]>(stages);
  const [newName, setNewName] = useState('');
  const [toRemove, setToRemove] = useState<Stage | null>(null);

  useEffect(() => {
    setDraft(stages);
  }, [stages]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(stages);

  const leadsInStage = (stageId: string) => leads.filter((lead) => lead.stageId === stageId).length;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setDraft(next.map((stage, position) => ({ ...stage, order: position })));
  };

  const rename = (id: string, name: string) => {
    setDraft((current) => current.map((stage) => (stage.id === id ? { ...stage, name } : stage)));
  };

  const addStage = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (draft.some((stage) => stage.id === id)) {
      toast.error('Etapa duplicada', 'Já existe uma etapa com esse nome.');
      return;
    }
    // New stages are inserted before the terminal won/lost stages.
    const openStages = draft.filter((stage) => stage.kind === 'aberta');
    const terminal = draft.filter((stage) => stage.kind !== 'aberta');
    const next = [
      ...openStages,
      { id, name, order: openStages.length, kind: 'aberta' as const },
      ...terminal,
    ].map((stage, position) => ({ ...stage, order: position }));
    setDraft(next);
    setNewName('');
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    const remaining = draft.filter((stage) => stage.id !== toRemove.id);
    const fallback = remaining[0];
    const affected = leads.filter((lead) => lead.stageId === toRemove.id);

    const savedSettings = await actions.updateSettings({
      stages: remaining.map((stage, position) => ({ ...stage, order: position })),
    });
    if (savedSettings && fallback) {
      for (const lead of affected) {
        await actions.updateLead(lead.id, { stageId: fallback.id });
      }
      if (affected.length > 0) {
        toast.success(
          'Etapa removida',
          `${affected.length} lead(s) movido(s) para "${fallback.name}".`,
        );
      } else {
        toast.success('Etapa removida');
      }
    }
    setToRemove(null);
  };

  const save = async () => {
    const cleaned = draft
      .map((stage, position) => ({ ...stage, name: stage.name.trim(), order: position }))
      .filter((stage) => stage.name.length > 0);
    if (cleaned.length !== draft.length) {
      toast.error('Nome obrigatório', 'Todas as etapas precisam de um nome.');
      return;
    }
    const saved = await actions.updateSettings({ stages: cleaned });
    if (saved) toast.success('Etapas atualizadas', 'Nenhum lead foi perdido na alteração.');
  };

  return (
    <>
      <PanelHeader
        title="Etapas do funil"
        description="Renomeie, reordene ou crie etapas. Os leads existentes são preservados."
        action={
          dirty ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setDraft(stages)} disabled={saving}>
                Descartar
              </Button>
              <Button variant="primary" size="sm" onClick={save} loading={saving}>
                Salvar etapas
              </Button>
            </>
          ) : null
        }
      />
      <ul className="divide-y divide-line">
        {draft.map((stage, index) => (
          <li key={stage.id} className="flex items-center gap-2 px-4 py-2.5 sm:px-5">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Mover ${stage.name} para cima`}
                className="focus-ring rounded p-0.5 text-subtle transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30"
              >
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === draft.length - 1}
                aria-label={`Mover ${stage.name} para baixo`}
                className="focus-ring rounded p-0.5 text-subtle transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30"
              >
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Nome da etapa {index + 1}</span>
              <input
                value={stage.name}
                onChange={(event) => rename(stage.id, event.target.value)}
                className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-base text-ink transition-colors hover:border-line focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
            <span className="shrink-0 text-2xs text-subtle tnum">
              {leadsInStage(stage.id)} lead(s)
            </span>
            {stage.kind !== 'aberta' ? (
              <span
                className="flex shrink-0 items-center gap-1 rounded-sm bg-sunken px-1.5 py-0.5 text-2xs font-medium text-muted"
                title="Etapa final obrigatória"
              >
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                {STAGE_KIND_LABEL[stage.kind]}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover etapa ${stage.name}`}
                onClick={() => setToRemove(stage)}
                disabled={draft.filter((candidate) => candidate.kind === 'aberta').length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nome da nova etapa</span>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addStage();
              }
            }}
            placeholder="Nova etapa (ex.: Follow-up pós-proposta)"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addStage}>
          Adicionar
        </Button>
      </div>
      {settings.stages.length > 0 ? (
        <p className="px-4 pb-3 text-xs text-subtle sm:px-5">
          As etapas finais de ganho e perda não podem ser removidas: elas sustentam a taxa de
          conversão e os relatórios.
        </p>
      ) : null}

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remover etapa"
        message={toRemove ? `Remover a etapa "${toRemove.name}"?` : ''}
        detail={
          toRemove && leadsInStage(toRemove.id) > 0
            ? `${leadsInStage(toRemove.id)} lead(s) serão movidos para a primeira etapa. Nenhum lead é excluído.`
            : 'Nenhum lead está nesta etapa.'
        }
        confirmLabel="Remover etapa"
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}
