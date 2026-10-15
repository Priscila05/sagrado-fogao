import { describe, expect, it } from 'vitest';
import {
  cleanString,
  normalizeActivity,
  normalizeCompany,
  normalizeInteraction,
  normalizeLead,
  normalizeSettings,
} from './normalize';
import { DEFAULT_STAGES } from './defaults';

describe('sanitização de registros', () => {
  it('remove caracteres de controle e limita o tamanho', () => {
    expect(cleanString('Ana\u0000 Ribeiro\u001f')).toBe('Ana Ribeiro');
    expect(cleanString('x'.repeat(500)).length).toBe(200);
    expect(cleanString(undefined)).toBe('');
    expect(cleanString(42)).toBe('42');
  });

  it('mantém texto com marcação como texto puro, sem interpretar', () => {
    const lead = normalizeLead({ contactName: '<img src=x onerror=alert(1)>' });
    expect(lead.contactName).toBe('<img src=x onerror=alert(1)>');
  });

  it('completa campos ausentes de um lead com valores válidos', () => {
    const lead = normalizeLead({ establishmentName: 'Pet Shop' });
    expect(lead.id).toMatch(/[a-z0-9-]{8,}/i);
    expect(lead.priority).toBe('media');
    expect(lead.dataset).toBe('real');
    expect(lead.potentialValue).toBe(0);
    expect(lead.stageId).toBe(DEFAULT_STAGES[0].id);
    expect(new Date(lead.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('recusa valores fora do domínio e datas inválidas', () => {
    const lead = normalizeLead({
      priority: 'urgentíssima',
      dataset: 'outro',
      potentialValue: -50,
      nextContactAt: 'não é data',
      companyId: 'id inválido com espaço',
    });
    expect(lead.priority).toBe('media');
    expect(lead.dataset).toBe('real');
    expect(lead.potentialValue).toBe(0);
    expect(lead.nextContactAt).toBeNull();
    expect(lead.companyId).toBeNull();
  });

  it('normaliza empresas, atividades e interações', () => {
    expect(normalizeCompany({ status: 'inventado' }).status).toBe('prospect');
    const activity = normalizeActivity({ type: 'telepatia', done: 'true' });
    expect(activity.type).toBe('tarefa');
    expect(activity.done).toBe(true);
    expect(activity.doneAt).not.toBeNull();
    expect(normalizeInteraction({ type: 'xyz' }).type).toBe('observacao');
  });

  it('garante etapas de ganho e perda nas configurações', () => {
    const settings = normalizeSettings({
      stages: [{ id: 'a', name: 'Primeira', order: 0, kind: 'aberta' }],
      sources: ['Indicação', 'indicação', ''],
      theme: 'neon',
    });
    expect(settings.stages.some((stage) => stage.kind === 'ganha')).toBe(true);
    expect(settings.stages.some((stage) => stage.kind === 'perdida')).toBe(true);
    expect(settings.stages.map((stage) => stage.order)).toEqual([0, 1, 2]);
    expect(settings.sources).toEqual(['Indicação']);
    expect(settings.theme).toBe('system');
  });

  it('remove etapas com identificador duplicado', () => {
    const settings = normalizeSettings({
      stages: [
        { id: 'a', name: 'Uma', order: 0, kind: 'aberta' },
        { id: 'a', name: 'Outra', order: 1, kind: 'aberta' },
      ],
    });
    expect(settings.stages.filter((stage) => stage.id === 'a')).toHaveLength(1);
  });
});
