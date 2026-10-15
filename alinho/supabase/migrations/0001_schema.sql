-- ============================================================================
-- ALINHO — versão multiusuário
-- Migração 1/3: esquema
--
-- Revisada após auditoria de segurança. Pontos de atenção tratados aqui:
--   * toda referência entre tabelas carrega a organização junto (chaves
--     estrangeiras compostas), o que torna impossível ligar registros de
--     organizações diferentes — mesmo via API direta;
--   * `org_id` nunca pode ser anulado por uma exclusão em cascata: usamos
--     ON DELETE SET NULL restrito à coluna do vínculo (PostgreSQL 15+).
--
-- Esta migração é ADITIVA: só cria objetos novos, no schema `public`, e não
-- altera nem remove nada existente. Rode no SQL Editor do Supabase.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ tipos ---

do $$ begin
  create type public.user_role as enum ('admin', 'gerente', 'vendedor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.company_status as enum ('prospect', 'cliente', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority as enum ('baixa', 'media', 'alta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_type as enum ('ligacao', 'whatsapp', 'reuniao', 'proposta', 'tarefa', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.interaction_type as enum (
    'ligacao_realizada', 'nao_atendeu', 'mensagem_enviada', 'resposta_recebida',
    'reuniao', 'proposta', 'negociacao', 'observacao', 'sistema'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum ('ativo', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pendente', 'pago');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_kind as enum ('entrada', 'parcela', 'avulso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_status as enum ('paga', 'prevista');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- empresas ---

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.organizations is
  'Empresa que usa o ALINHO. Esta versão opera com uma única organização.';

-- ---------------------------------------------------------------- pessoas ---

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'vendedor',
  -- Gerente responsável por este vendedor. Define o time que ele supervisiona.
  manager_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Alvo das chaves compostas: garante que um vínculo sempre aponte para
  -- alguém da MESMA organização.
  constraint profiles_id_org_key unique (id, org_id),
  constraint profiles_manager_same_org
    foreign key (manager_id, org_id) references public.profiles (id, org_id)
    on delete set null (manager_id),
  constraint profiles_manager_not_self check (manager_id is null or manager_id <> id)
);

create index if not exists profiles_org_idx on public.profiles (org_id);
create index if not exists profiles_manager_idx on public.profiles (manager_id);

comment on column public.profiles.role is
  'Definido apenas pelo gatilho de criação (lista de administradores) ou pelas '
  'funções admin_set_member_*. Nunca por dados enviados pelo cliente.';

-- --------------------------------------------------------- configurações ---

create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  -- Mesmo formato usado pelo aplicativo local, para manter a personalização
  -- de etapas sem reconstruir as telas.
  stages jsonb not null default '[]'::jsonb,
  sources text[] not null default '{}',
  segments text[] not null default '{}',
  expense_categories text[] not null default '{}',
  payment_methods text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- empresas --

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid,
  name text not null default '',
  segment text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  address text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  instagram text not null default '',
  website text not null default '',
  notes text not null default '',
  status public.company_status not null default 'prospect',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_id_org_key unique (id, org_id),
  constraint companies_owner_same_org
    foreign key (owner_id, org_id) references public.profiles (id, org_id)
    on delete set null (owner_id)
);

create index if not exists companies_org_idx on public.companies (org_id);
create index if not exists companies_owner_idx on public.companies (owner_id);

-- ------------------------------------------------------------------- leads --

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Responsável pelo lead. É a base da distribuição e das permissões.
  owner_id uuid,
  company_id uuid,
  contact_name text not null default '',
  establishment_name text not null default '',
  segment text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  instagram text not null default '',
  website text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  source text not null default '',
  stage_id text not null default 'novo',
  potential_value numeric(14, 2) not null default 0,
  priority public.priority not null default 'media',
  notes text not null default '',
  last_interaction_at timestamptz,
  next_contact_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_id_org_key unique (id, org_id),
  constraint leads_owner_same_org
    foreign key (owner_id, org_id) references public.profiles (id, org_id)
    on delete set null (owner_id),
  constraint leads_company_same_org
    foreign key (company_id, org_id) references public.companies (id, org_id)
    on delete set null (company_id)
);

create index if not exists leads_org_idx on public.leads (org_id);
create index if not exists leads_owner_idx on public.leads (owner_id);
create index if not exists leads_company_idx on public.leads (company_id);
create index if not exists leads_stage_idx on public.leads (stage_id);

-- -------------------------------------------------------------- atividades --

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid,
  lead_id uuid,
  company_id uuid,
  title text not null default '',
  type public.activity_type not null default 'tarefa',
  due_at timestamptz not null default now(),
  priority public.priority not null default 'media',
  notes text not null default '',
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_id_org_key unique (id, org_id),
  constraint activities_owner_same_org
    foreign key (owner_id, org_id) references public.profiles (id, org_id)
    on delete set null (owner_id),
  constraint activities_lead_same_org
    foreign key (lead_id, org_id) references public.leads (id, org_id)
    on delete cascade,
  constraint activities_company_same_org
    foreign key (company_id, org_id) references public.companies (id, org_id)
    on delete set null (company_id)
);

create index if not exists activities_org_idx on public.activities (org_id);
create index if not exists activities_owner_idx on public.activities (owner_id);
create index if not exists activities_lead_idx on public.activities (lead_id);
create index if not exists activities_due_idx on public.activities (due_at);

-- ---------------------------------------------------------------- histórico --

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Quem registrou. Preenchido pelo banco, nunca pelo cliente.
  author_id uuid,
  lead_id uuid,
  company_id uuid,
  type public.interaction_type not null default 'observacao',
  description text not null default '',
  occurred_at timestamptz not null default now(),
  automatic boolean not null default false,
  created_at timestamptz not null default now(),
  constraint interactions_id_org_key unique (id, org_id),
  constraint interactions_author_same_org
    foreign key (author_id, org_id) references public.profiles (id, org_id)
    on delete set null (author_id),
  constraint interactions_lead_same_org
    foreign key (lead_id, org_id) references public.leads (id, org_id)
    on delete cascade,
  constraint interactions_company_same_org
    foreign key (company_id, org_id) references public.companies (id, org_id)
    on delete set null (company_id),
  -- Todo registro precisa estar ancorado em algo visível.
  constraint interactions_has_anchor check (lead_id is not null or company_id is not null)
);

create index if not exists interactions_org_idx on public.interactions (org_id);
create index if not exists interactions_lead_idx on public.interactions (lead_id);
create index if not exists interactions_occurred_idx on public.interactions (occurred_at);

-- -------------------------------------------------------------- financeiro --

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid,
  lead_id uuid,
  client_name text not null default '',
  project_name text not null default '',
  total_value numeric(14, 2) not null default 0,
  signed_at timestamptz not null default now(),
  description text not null default '',
  status public.contract_status not null default 'ativo',
  down_payment numeric(14, 2) not null default 0,
  installments integer not null default 1,
  first_due_at timestamptz not null default now(),
  payment_method text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_id_org_key unique (id, org_id),
  constraint contracts_company_same_org
    foreign key (company_id, org_id) references public.companies (id, org_id)
    on delete set null (company_id),
  constraint contracts_lead_same_org
    foreign key (lead_id, org_id) references public.leads (id, org_id)
    on delete set null (lead_id)
);

create index if not exists contracts_org_idx on public.contracts (org_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid,
  company_id uuid,
  kind public.payment_kind not null default 'parcela',
  sequence integer not null default 0,
  label text not null default '',
  due_at timestamptz not null default now(),
  amount numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0,
  paid_at timestamptz,
  method text not null default '',
  status public.payment_status not null default 'pendente',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_id_org_key unique (id, org_id),
  constraint payments_contract_same_org
    foreign key (contract_id, org_id) references public.contracts (id, org_id)
    on delete cascade,
  constraint payments_company_same_org
    foreign key (company_id, org_id) references public.companies (id, org_id)
    on delete set null (company_id)
);

create index if not exists payments_org_idx on public.payments (org_id);
create index if not exists payments_contract_idx on public.payments (contract_id);
create index if not exists payments_due_idx on public.payments (due_at);

-- Uma posição por contrato: é o que impede parcelas duplicadas no banco,
-- espelhando a reconciliação feita no aplicativo.
create unique index if not exists payments_contract_sequence_key
  on public.payments (contract_id, sequence)
  where contract_id is not null and kind <> 'avulso';

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid,
  description text not null default '',
  category text not null default '',
  amount numeric(14, 2) not null default 0,
  spent_at timestamptz not null default now(),
  status public.expense_status not null default 'paga',
  paid_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_id_org_key unique (id, org_id),
  constraint expenses_contract_same_org
    foreign key (contract_id, org_id) references public.contracts (id, org_id)
    on delete set null (contract_id)
);

create index if not exists expenses_org_idx on public.expenses (org_id);
create index if not exists expenses_contract_idx on public.expenses (contract_id);

-- ---------------------------------------------------- updated_at automático --

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'leads', 'activities', 'contracts', 'payments', 'expenses'
  ] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Funções utilitárias não são endpoints: ninguém as chama pela API.
revoke all on function public.touch_updated_at() from public;
