import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Teste de contrato entre o código e as migrações.
 *
 * As colunas e as funções abaixo foram extraídas do banco criado pelas três
 * migrações corrigidas (PostgreSQL 16 real). Este teste garante que o
 * repositório remoto e a camada de autenticação só usem nomes que existem lá —
 * um erro de digitação aqui só apareceria em produção, depois do upload.
 */

// Retrato do schema, conferido com:
//   select table_name, string_agg(column_name, ',') from information_schema.columns
//   where table_schema='public' group by table_name;
const SCHEMA: Record<string, string[]> = {
  activities: [
    'company_id', 'created_at', 'done', 'done_at', 'due_at', 'id', 'lead_id', 'notes',
    'org_id', 'owner_id', 'priority', 'title', 'type', 'updated_at',
  ],
  companies: [
    'address', 'city', 'created_at', 'email', 'id', 'instagram', 'name', 'neighborhood',
    'notes', 'org_id', 'owner_id', 'phone', 'segment', 'status', 'updated_at', 'website',
    'whatsapp',
  ],
  contracts: [
    'client_name', 'company_id', 'created_at', 'description', 'down_payment', 'first_due_at',
    'id', 'installments', 'lead_id', 'org_id', 'payment_method', 'project_name', 'signed_at',
    'status', 'total_value', 'updated_at',
  ],
  expenses: [
    'amount', 'category', 'contract_id', 'created_at', 'description', 'id', 'notes', 'org_id',
    'paid_at', 'spent_at', 'status', 'updated_at',
  ],
  interactions: [
    'author_id', 'automatic', 'company_id', 'created_at', 'description', 'id', 'lead_id',
    'occurred_at', 'org_id', 'type',
  ],
  leads: [
    'city', 'company_id', 'contact_name', 'created_at', 'email', 'establishment_name', 'id',
    'instagram', 'last_interaction_at', 'lost_at', 'neighborhood', 'next_contact_at', 'notes',
    'org_id', 'owner_id', 'phone', 'potential_value', 'priority', 'segment', 'source',
    'stage_id', 'updated_at', 'website', 'whatsapp', 'won_at',
  ],
  org_settings: [
    'expense_categories', 'org_id', 'payment_methods', 'segments', 'sources', 'stages',
    'updated_at',
  ],
  payments: [
    'amount', 'company_id', 'contract_id', 'created_at', 'due_at', 'id', 'kind', 'label',
    'method', 'notes', 'org_id', 'paid_amount', 'paid_at', 'sequence', 'status', 'updated_at',
  ],
  profiles: [
    'active', 'created_at', 'email', 'full_name', 'id', 'manager_id', 'org_id', 'role',
    'updated_at',
  ],
};

// Assinaturas conferidas com pg_get_function_arguments().
const RPCS: Record<string, string[]> = {
  admin_set_member_role: ['target_id', 'new_role'],
  admin_set_member_manager: ['target_id', 'new_manager_id'],
  admin_set_member_active: ['target_id', 'new_active'],
};

const repositorio = readFileSync('src/repositories/supabase.ts', 'utf8');
const auth = readFileSync('src/auth/AuthProvider.tsx', 'utf8');

/** Colunas que o código escreve em cada tabela (lado esquerdo dos objetos). */
function colunasEscritas(fonte: string, funcao: string): string[] {
  const inicio = fonte.indexOf(`function ${funcao}`);
  if (inicio < 0) return [];
  const bloco = fonte.slice(inicio, fonte.indexOf('\n}', inicio));
  return Array.from(bloco.matchAll(/^\s{4}([a-z_]+):/gm)).map((m) => m[1]);
}

describe('contrato entre o código e as migrações', () => {
  it.each([
    ['leads', 'leadToRow'],
    ['companies', 'companyToRow'],
    ['activities', 'activityToRow'],
    ['interactions', 'interactionToRow'],
    ['contracts', 'contractToRow'],
    ['payments', 'paymentToRow'],
    ['expenses', 'expenseToRow'],
  ])('escreve em %s apenas colunas existentes', (tabela, funcao) => {
    const colunas = colunasEscritas(repositorio, funcao);
    expect(colunas.length).toBeGreaterThan(5);
    const inexistentes = colunas.filter((coluna) => !SCHEMA[tabela].includes(coluna));
    expect(inexistentes).toEqual([]);
  });

  it('lê as configurações com os nomes de coluna do banco', () => {
    for (const coluna of ['expense_categories', 'payment_methods', 'stages', 'sources', 'segments']) {
      expect(repositorio).toContain(`row.${coluna}`);
      expect(SCHEMA.org_settings).toContain(coluna);
    }
  });

  it('seleciona de profiles apenas colunas existentes', () => {
    const selects = Array.from(auth.matchAll(/\.select\(\s*'([^']+)'\s*\)/g)).map((m) => m[1]);
    expect(selects.length).toBeGreaterThan(0);
    for (const lista of selects) {
      for (const coluna of lista.split(',').map((c) => c.trim())) {
        expect(SCHEMA.profiles).toContain(coluna);
      }
    }
  });

  it('chama as funções administrativas com o nome e os argumentos corretos', () => {
    const chamadas = Array.from(auth.matchAll(/fn:\s*'([a-z_]+)'[\s\S]{0,200}?args:\s*\{([^}]+)\}/g));
    expect(chamadas).toHaveLength(3);
    for (const [, nome, args] of chamadas) {
      expect(Object.keys(RPCS)).toContain(nome);
      const enviados = Array.from(args.matchAll(/([a-z_]+)\s*:/g)).map((m) => m[1]);
      expect(enviados.sort()).toEqual([...RPCS[nome]].sort());
    }
  });

  it('não altera papel, supervisão ou situação por UPDATE direto', () => {
    // O banco revoga esse privilégio; o código precisa usar as funções.
    expect(auth).not.toMatch(/from\('profiles'\)\s*\.update\(\s*\{[^}]*\brole\b/);
    expect(auth).not.toMatch(/from\('profiles'\)\s*\.update\(\s*\{[^}]*manager_id/);
    expect(auth).not.toMatch(/from\('profiles'\)\s*\.update\(\s*\{[^}]*active/);
    // o único UPDATE direto permitido é o do próprio nome
    expect(auth).toMatch(/\.update\(\s*\{\s*full_name/);
  });

  it('não envia org_id: quem define é o banco', () => {
    // Os gatilhos sobrescrevem; enviar seria ruído e daria falsa sensação de controle.
    expect(repositorio).toContain('org_id: context.orgId');
    // mas nunca para o histórico, cuja organização e autoria são carimbadas
    const inicio = repositorio.indexOf('function interactionToRow');
    const bloco = repositorio.slice(inicio, repositorio.indexOf('\n}', inicio));
    expect(bloco).toContain('author_id');
  });
});
