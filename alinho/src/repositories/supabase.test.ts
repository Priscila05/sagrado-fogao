import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErroDoBanco, createSupabaseRepositories, describeError, type RemoteContext } from './supabase';
import { buildLead, buildActivity, buildInteraction } from '../services/crm';
import { buildContract, buildPayment } from '../services/finance';

/**
 * Cliente falso: grava o que seria enviado ao PostgREST e devolve o que o
 * servidor devolveria. Permite testar a conversão de ida e volta sem rede.
 */
function fakeClient(rows: Record<string, unknown[]> = {}) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];

  const builder = (table: string) => {
    const result = { data: rows[table] ?? [], error: null as unknown };
    const chain: Record<string, unknown> = {};
    const self = () => chain as never;

    Object.assign(chain, {
      select: () => self(),
      eq: () => self(),
      in: () => self(),
      not: () => self(),
      order: () => self(),
      maybeSingle: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      single: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      upsert: (payload: unknown) => {
        calls.push({ table, op: 'upsert', payload });
        const sent = Array.isArray(payload) ? payload : [payload];
        return {
          select: () => ({
            single: async () => ({ data: sent[0], error: null }),
            then: (resolve: (value: unknown) => unknown) =>
              resolve({ data: sent, error: null }),
          }),
        } as never;
      },
      delete: () => {
        calls.push({ table, op: 'delete' });
        return {
          eq: async () => ({ error: null }),
          in: async () => ({ error: null }),
          not: async () => ({ error: null }),
        } as never;
      },
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    });
    return chain;
  };

  const client = { from: vi.fn((table: string) => builder(table)) } as unknown as SupabaseClient;
  return { client, calls };
}

const context = (client: SupabaseClient): (() => RemoteContext) => () => ({
  client,
  orgId: 'org-1',
  userId: 'user-1',
});

describe('repositório Supabase', () => {
  it('converte um lead para as colunas do banco', async () => {
    const { client, calls } = fakeClient();
    const repositories = createSupabaseRepositories(context(client));

    const lead = buildLead(
      {
        ownerId: 'user-2',
        contactName: 'Ana Ribeiro',
        establishmentName: 'Pet Shop',
        phone: '41999998888',
        potentialValue: 2400,
        stageId: 'interessado',
        priority: 'alta',
      },
      'real',
      'novo',
    );
    await repositories.leads.save(lead);

    const sent = calls.find((call) => call.table === 'leads')?.payload as Record<string, unknown>;
    expect(sent.owner_id).toBe('user-2');
    expect(sent.contact_name).toBe('Ana Ribeiro');
    expect(sent.establishment_name).toBe('Pet Shop');
    expect(sent.potential_value).toBe(2400);
    expect(sent.stage_id).toBe('interessado');
    expect(sent.org_id).toBe('org-1');
    // o cliente nunca inventa campos que o banco controla
    expect(sent).not.toHaveProperty('dataset');
  });

  it('converte as linhas do banco de volta para o modelo', async () => {
    const { client } = fakeClient({
      leads: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          owner_id: '22222222-2222-4222-8222-222222222222',
          company_id: null,
          contact_name: 'Marta',
          establishment_name: 'Cantina',
          potential_value: '3800.50',
          stage_id: 'negociacao',
          priority: 'media',
          created_at: '2026-05-01T12:00:00Z',
          updated_at: '2026-05-02T12:00:00Z',
          last_interaction_at: null,
          next_contact_at: null,
          won_at: null,
          lost_at: null,
        },
      ],
    });
    const repositories = createSupabaseRepositories(context(client));

    const leads = await repositories.leads.list();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      ownerId: '22222222-2222-4222-8222-222222222222',
      contactName: 'Marta',
      establishmentName: 'Cantina',
      stageId: 'negociacao',
      // numeric do Postgres chega como texto e precisa virar número
      potentialValue: 3800.5,
      dataset: 'real',
    });
  });

  it('carimba o autor da interação e o responsável da atividade', async () => {
    const { client, calls } = fakeClient();
    const repositories = createSupabaseRepositories(context(client));

    await repositories.activities.save(buildActivity({ title: 'Ligar' }, 'real'));
    await repositories.interactions.save(
      buildInteraction({ type: 'observacao', description: 'nota' }, 'real'),
    );

    const activity = calls.find((c) => c.table === 'activities')?.payload as Record<string, unknown>;
    const interaction = calls.find((c) => c.table === 'interactions')?.payload as Record<
      string,
      unknown
    >;
    expect(activity.owner_id).toBe('user-1');
    expect(interaction.author_id).toBe('user-1');
  });

  it('converte contratos e pagamentos do financeiro', async () => {
    const { client, calls } = fakeClient();
    const repositories = createSupabaseRepositories(context(client));

    const contract = buildContract(
      { projectName: 'Site', clientName: 'Cantina', totalValue: 3000, installments: 3 },
      'real',
    );
    await repositories.contracts.save(contract);
    await repositories.payments.save(
      buildPayment(
        { contractId: contract.id, sequence: 1, label: 'Parcela 1/3', amount: 1000 },
        'real',
      ),
    );

    const sentContract = calls.find((c) => c.table === 'contracts')?.payload as Record<string, unknown>;
    const sentPayment = calls.find((c) => c.table === 'payments')?.payload as Record<string, unknown>;
    expect(sentContract.project_name).toBe('Site');
    expect(sentContract.total_value).toBe(3000);
    expect(sentPayment.contract_id).toBe(contract.id);
    expect(sentPayment.sequence).toBe(1);
    expect(sentPayment.paid_amount).toBe(0);
  });

  it('lê as configurações da organização mantendo as etapas', async () => {
    const { client } = fakeClient({
      org_settings: [
        {
          org_id: 'org-1',
          stages: [{ id: 'novo', name: 'Novo lead', order: 0, kind: 'aberta' }],
          sources: ['Indicação'],
          segments: ['Restaurante'],
          expense_categories: ['Infra'],
          payment_methods: ['Pix'],
          updated_at: '2026-05-01T12:00:00Z',
        },
      ],
    });
    const repositories = createSupabaseRepositories(context(client));
    const settings = await repositories.settings.read();

    expect(settings.sources).toEqual(['Indicação']);
    expect(settings.paymentMethods).toEqual(['Pix']);
    // etapas finais obrigatórias continuam garantidas
    expect(settings.stages.some((stage) => stage.kind === 'ganha')).toBe(true);
    expect(settings.activeDataset).toBe('real');
  });

  it('traduz erros do banco para mensagens compreensíveis', () => {
    expect(describeError({ code: '42501', message: 'new row violates row-level security policy' }))
      .toContain('permissão');
    expect(describeError({ code: '23505', message: 'duplicate key' })).toContain('Já existe');
    expect(describeError({ code: 'PGRST301', message: 'JWT expired' })).toContain('sessão');
    expect(describeError(null)).toBeTruthy();
  });

  it('não oferece conjunto de demonstração no banco compartilhado', async () => {
    const { client, calls } = fakeClient();
    const repositories = createSupabaseRepositories(context(client));
    await repositories.clearDataset('demo');
    expect(calls.filter((call) => call.op === 'delete')).toHaveLength(0);
  });
});

describe('ErroDoBanco', () => {
  it('mostra a mensagem amigável e guarda a resposta crua', () => {
    const erro = new ErroDoBanco({ code: '42501', message: 'permission denied for table leads' });
    expect(erro.message).toBe('Seu perfil não tem permissão para esta operação.');
    expect(erro.detalhe).toBe('42501 · permission denied for table leads');
  });

  it('junta código, mensagem, detalhes e dica', () => {
    const erro = new ErroDoBanco({
      code: 'PGRST205',
      message: "Could not find the table 'public.contracts' in the schema cache",
      hint: 'Rode a migração 0001.',
    });
    expect(erro.detalhe).toContain('PGRST205');
    expect(erro.detalhe).toContain('public.contracts');
    expect(erro.detalhe).toContain('Rode a migração 0001.');
  });

  it('não fica sem detalhe quando o banco não manda nada', () => {
    expect(new ErroDoBanco(null).detalhe).toBe('sem detalhe do banco');
  });

  it('continua sendo um Error, para quem só lê a mensagem', () => {
    const erro = new ErroDoBanco({ code: '23505', message: 'duplicate key' });
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('Já existe um registro com esses dados.');
  });
});
