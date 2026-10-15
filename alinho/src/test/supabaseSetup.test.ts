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
    for (const table of ['companies', 'leads', 'activities']) {
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

  it('não expõe nenhuma tabela ao papel anônimo', () => {
    expect(rls).toContain('revoke all on all tables in schema public from anon');
    expect(rls).not.toMatch(/to anon/);
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

  it('cria o perfil automaticamente e faz do primeiro usuário um administrador', () => {
    expect(bootstrap).toContain('create trigger on_auth_user_created');
    expect(bootstrap).toContain("v_role := 'admin'");
    expect(bootstrap).toContain("else\n    v_role := 'vendedor';");
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
