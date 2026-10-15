-- ============================================================================
-- Arcabouço que imita o ambiente do Supabase para testar as migrações num
-- PostgreSQL local. NÃO faz parte das migrações e não deve ser rodado lá.
--
-- Reproduz: papéis anon/authenticated/service_role, schema auth com users,
-- auth.uid() lendo as claims do JWT e os privilégios amplos que o Supabase
-- concede por padrão (é justamente o que as migrações precisam restringir).
-- ============================================================================

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- O Supabase concede tudo por padrão; o RLS é que segura.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
