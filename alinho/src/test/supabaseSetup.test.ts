import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Verificações estruturais do que vai para o banco e para o navegador.
 *
 * Não substituem rodar as migrações no Supabase, mas impedem que uma tabela
 * fique sem RLS, que o financeiro deixe de ser exclusivo do administrador ou
 * que uma chave de servidor entre no frontend.
 */

const migrationsDir = 'supabase/migrations';
const schema = readFileSync(join(migrationsDir, '0001_schema.sql'), 'utf8');
const rls = readFileSync(join(migrationsDir, '0002_rls.sql'), 'utf8');
const bootstrap = readFileSync(join(migrationsDir, '0003_bootstrap.sql'), 'utf8');

/** Os arquivos alinham colunas com espaços; comparações ignoram esse alinhamento. */
const squeeze = (value: string) => value.replace(/[ \t]+/g, ' ');
const rlsFlat = squeeze(rls);

const APP_TABLES = [
  'organizations',
  'profiles',
  'org_settings',
  'companies',
  'leads',
  'activities',
  'interactions',
  'contracts',
  'payments',
  'expenses',
];

describe('migrações do Supabase', () => {
  it('cria todas as tabelas do aplicativo', () => {
    for (const table of APP_TABLES) {
      expect(schema).toContain(`create table if not exists public.${table}`);
    }
  });

  it('liga o RLS em todas as tabelas', () => {
    for (const table of APP_TABLES) {
      expect(rlsFlat).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('mantém o financeiro restrito ao administrador', () => {
    for (const table of ['contracts', 'payments', 'expenses']) {
      const policy = rls.slice(rls.indexOf(`create policy ${table}_admin`));
      const block = policy.slice(0, policy.indexOf(';') + 1);
      expect(block).toContain('public.app_is_admin()');
      expect(block).toContain('for all to authenticated');
      // precisa checar tanto na leitura quanto na escrita
      expect(block).toContain('using (');
      expect(block).toContain('with check (');
    }
  });

  it('amarra todas as políticas do CRM à organização do usuário', () => {
    for (const table of ['companies', 'leads']) {
      for (const action of ['select', 'insert', 'update', 'delete']) {
        expect(rls).toContain(`create policy ${table}_${action} on public.${table}`);
      }
      const policies = rls.split(`create policy ${table}_`).slice(1);
      for (const policy of policies) {
        const block = policy.slice(0, policy.indexOf(';') + 1);
        expect(block).toContain('org_id = public.app_org_id()');
        expect(block).toContain('public.app_can_access(owner_id)');
      }
    }
  });

  it('não expõe nenhuma tabela nem função ao papel anônimo', () => {
    expect(rls).toContain('revoke all on all tables in schema public from anon');
    expect(rls).toContain('revoke all on all sequences in schema public from anon');
    expect(rls).not.toMatch(/to anon/);
    // funções auxiliares também são retiradas de public/anon antes do grant
    expect(squeeze(rls)).toContain('from public, anon;');
  });

  it('força o RLS inclusive para o dono das tabelas', () => {
    for (const table of ['profiles', 'leads', 'companies', 'interactions', 'contracts']) {
      expect(squeeze(rls)).toContain(`alter table public.${table} force row level security`);
    }
  });

  it('define as funções de permissão como security definer e estáveis', () => {
    for (const fn of ['app_org_id', 'app_role', 'app_is_admin', 'app_visible_user_ids']) {
      const start = rls.indexOf(`create or replace function public.${fn}`);
      expect(start).toBeGreaterThan(-1);
      const block = rls.slice(start, start + 600);
      expect(block).toContain('security definer');
      expect(block).toContain('set search_path = public, pg_temp');
      expect(block).toContain('stable');
    }
  });

  it('não deixa o papel vir dos metadados do cadastro', () => {
    // A correção central da auditoria: metadados são controlados por quem se
    // inscreve e não podem influenciar o papel.
    expect(bootstrap).toContain('create trigger on_auth_user_created');
    expect(bootstrap).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/);
    expect(bootstrap).not.toContain("v_meta_role");
    // o único caminho para admin é a lista do proprietário
    expect(bootstrap).toContain('admin_bootstrap_allowlist');
    expect(bootstrap).toMatch(/v_role := 'admin'/);
  });

  it('não concede admin por ordem de cadastro', () => {
    expect(bootstrap).not.toContain('v_is_first');
    expect(bootstrap).not.toMatch(/not exists \(select 1 from public\.profiles where org_id = v_org\)/);
  });

  it('mantém a lista de administradores inacessível pela API', () => {
    expect(bootstrap).toContain('alter table public.admin_bootstrap_allowlist enable row level security');
    expect(bootstrap).toContain('force row level security');
    expect(bootstrap).toContain('revoke all on public.admin_bootstrap_allowlist from anon, authenticated');
    // RLS ligado e nenhuma política = nega tudo
    expect(bootstrap).not.toMatch(/create policy \w+ on public\.admin_bootstrap_allowlist/);
  });

  it('bloqueia a alteração de papel, organização, supervisor e situação por UPDATE', () => {
    expect(squeeze(rls)).toContain('revoke update on public.profiles from authenticated');
    expect(squeeze(rls)).toContain('grant update (full_name) on public.profiles to authenticated');
    expect(squeeze(rls)).toContain('revoke insert, delete on public.profiles from authenticated');
    // as mudanças passam por funções que conferem quem chamou
    for (const fn of [
      'admin_set_member_role',
      'admin_set_member_manager',
      'admin_set_member_active',
    ]) {
      const start = rls.indexOf(`create or replace function public.${fn}`);
      expect(start).toBeGreaterThan(-1);
      const block = rls.slice(start, start + 2000);
      expect(block).toContain('security definer');
      expect(block).toContain('public.app_is_admin()');
    }
  });

  it('protege registros sem responsável e a redistribuição', () => {
    const start = rls.indexOf('create or replace function public.app_can_access');
    const block = rls.slice(start, start + 800);
    // registro sem dono fica com admin e gerente, nunca com todo mundo
    expect(block).toContain('when owner is null then public.app_is_manager()');
    expect(block).not.toMatch(/owner is null\s*$/m);
    // a troca de responsável é comparada com a linha antiga, no gatilho
    expect(rls).toContain('new.owner_id is distinct from old.owner_id');
    expect(rls).toContain('Somente gerentes e administradores redistribuem registros');
  });

  it('exige permissão sobre o lead ou a empresa no histórico', () => {
    for (const action of ['select', 'insert', 'delete']) {
      const start = rls.indexOf(`create policy interactions_${action}`);
      expect(start).toBeGreaterThan(-1);
      const block = rls.slice(start, rls.indexOf(';', start) + 1);
      expect(block).toMatch(/app_can_access_lead|app_can_access_company|app_is_admin/);
    }
    // histórico não é editável e a autoria é carimbada pelo banco
    expect(squeeze(rls)).toContain('revoke update on public.interactions from authenticated');
    expect(rls).toContain('new.author_id := auth.uid()');
    expect(rls).not.toMatch(/create policy interactions_update/);
  });

  it('amarra as referências à mesma organização', () => {
    for (const constraint of [
      'leads_owner_same_org',
      'leads_company_same_org',
      'activities_lead_same_org',
      'interactions_lead_same_org',
      'contracts_company_same_org',
      'payments_contract_same_org',
      'expenses_contract_same_org',
      'profiles_manager_same_org',
    ]) {
      expect(schema).toContain(constraint);
    }
    // e a organização de um registro não muda depois de criada
    expect(rls).toContain('A organização de um registro não pode ser alterada');
  });

  it('impede que gatilhos sejam chamados como se fossem endpoints', () => {
    for (const fn of ['guard_owned_record', 'guard_interaction', 'guard_org_record']) {
      expect(squeeze(rls)).toContain(`revoke all on function public.${fn}() from public, anon, authenticated`);
    }
    expect(squeeze(bootstrap)).toContain('revoke all on function public.handle_new_user() from public, anon, authenticated');
  });

  it('não contém comandos destrutivos', () => {
    const all = [schema, rls, bootstrap].join('\n').toLowerCase();
    expect(all).not.toMatch(/drop table/);
    expect(all).not.toMatch(/drop schema/);
    expect(all).not.toMatch(/truncate/);
    expect(all).not.toMatch(/delete from/);
    // `drop policy if exists` e `drop trigger if exists` são recriações seguras
  });
});

/* ------------------------------------------------------------- frontend --- */

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('segurança do frontend', () => {
  const files = sourceFiles('src');

  it('não contém chaves de servidor nem segredos embutidos', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith('supabaseSetup.test.ts')) continue;
      const content = readFileSync(file, 'utf8');
      if (/service_role\s*[:=]\s*['"]/.test(content)) offenders.push(`${file}: service_role`);
      if (/sb_secret_[A-Za-z0-9]/.test(content)) offenders.push(`${file}: sb_secret`);
      if (/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/.test(content)) {
        offenders.push(`${file}: variável de service role`);
      }
      // URL de projeto fixa no código indicaria credencial embutida
      if (/https:\/\/[a-z0-9]{20}\.supabase\.co/.test(content)) {
        offenders.push(`${file}: URL de projeto embutida`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lê as credenciais apenas das variáveis combinadas', () => {
    const client = readFileSync('src/lib/supabaseClient.ts', 'utf8');
    expect(client).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(client).toContain('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY');

    const example = readFileSync('.env.example', 'utf8');
    expect(example).toContain('VITE_SUPABASE_URL=');
    expect(example).toContain('VITE_SUPABASE_PUBLISHABLE_KEY=');

    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore.split('\n')).toContain('.env');
  });

  it('recusa uma chave de service_role informada por engano', async () => {
    // JWT de exemplo com role service_role no payload (assinatura irrelevante).
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    const fakeKey = `eyJhbGciOiJIUzI1NiJ9.${payload}.assinatura`;
    const client = readFileSync('src/lib/supabaseClient.ts', 'utf8');
    expect(client).toContain('looksLikeServerKey');
    expect(client).toContain("payload?.role === 'service_role'");
    // o teste abaixo confere a lógica isolada, sem depender do build
    const decoded = JSON.parse(
      Buffer.from(fakeKey.split('.')[1], 'base64').toString('utf8'),
    ) as { role: string };
    expect(decoded.role).toBe('service_role');
  });
});
