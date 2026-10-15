-- ============================================================================
-- ALINHO — versão multiusuário
-- Migração 2/3: funções de permissão e políticas RLS
--
-- Regras:
--   admin    — enxerga e edita tudo da empresa, inclusive o financeiro.
--   gerente  — enxerga e edita o que é dele e o da sua equipe (quem aponta
--              para ele em profiles.manager_id). Não acessa o financeiro.
--   vendedor — enxerga e edita apenas o que está sob sua responsabilidade.
--              Não acessa o financeiro.
--
-- As funções abaixo são SECURITY DEFINER para que possam ler `profiles` sem
-- disparar as próprias políticas de `profiles` (evita recursão infinita).
-- ============================================================================

-- ------------------------------------------------------- funções auxiliares --

create or replace function public.app_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.app_role() = 'admin', false);
$$;

/**
 * Conjunto de usuários que o usuário atual pode enxergar:
 *   admin    → todos da organização
 *   gerente  → ele mesmo e sua equipe direta
 *   vendedor → apenas ele mesmo
 */
create or replace function public.app_visible_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.org_id = public.app_org_id()
    and (
      public.app_role() = 'admin'
      or p.id = auth.uid()
      or (public.app_role() = 'gerente' and p.manager_id = auth.uid())
    );
$$;

/** Verdadeiro quando o registro pertence a alguém visível (ou não tem dono). */
create or replace function public.app_can_access(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.app_is_admin()
    or owner is null
    or owner in (select public.app_visible_user_ids());
$$;

comment on function public.app_can_access(uuid) is
  'Registro sem responsável fica visível para a equipe, para que nada se perca na distribuição.';

grant execute on function
  public.app_org_id(), public.app_role(), public.app_is_admin(),
  public.app_visible_user_ids(), public.app_can_access(uuid)
  to authenticated;

-- ------------------------------------------------------------- ligar o RLS --

alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.org_settings  enable row level security;
alter table public.companies     enable row level security;
alter table public.leads         enable row level security;
alter table public.activities    enable row level security;
alter table public.interactions  enable row level security;
alter table public.contracts     enable row level security;
alter table public.payments      enable row level security;
alter table public.expenses      enable row level security;

-- Nenhuma tabela é exposta ao papel anônimo.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------- organizations --

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.app_org_id());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (id = public.app_org_id() and public.app_is_admin())
  with check (id = public.app_org_id());

-- ----------------------------------------------------------------- profiles --

-- Todos enxergam os colegas da própria organização (nomes aparecem em listas,
-- filtros e no painel de supervisão).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (org_id = public.app_org_id());

-- Cada um ajusta o próprio nome; papel e equipe são prerrogativa do admin.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and org_id = public.app_org_id()
    and role = (select role from public.profiles where id = auth.uid())
    and coalesce(manager_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce((select manager_id from public.profiles where id = auth.uid()),
                 '00000000-0000-0000-0000-000000000000'::uuid)
    and active = (select active from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (org_id = public.app_org_id() and public.app_is_admin())
  with check (org_id = public.app_org_id());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (org_id = public.app_org_id() and public.app_is_admin());

-- Exclusão de pessoa não é feita pelo aplicativo: desative com active = false.

-- ------------------------------------------------------------- org_settings --

drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select on public.org_settings
  for select to authenticated
  using (org_id = public.app_org_id());

drop policy if exists org_settings_write on public.org_settings;
create policy org_settings_write on public.org_settings
  for all to authenticated
  using (org_id = public.app_org_id() and public.app_is_admin())
  with check (org_id = public.app_org_id() and public.app_is_admin());

-- ------------------------------------------- CRM: companies, leads, etc. ----
-- Mesmo desenho em todas: leitura e escrita limitadas ao que o papel enxerga,
-- e `org_id` sempre amarrado à organização do usuário.

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id))
  with check (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (org_id = public.app_org_id() and public.app_can_access(owner_id));

-- A distribuição acontece aqui: quem enxerga o lead pode trocar o responsável,
-- desde que o novo dono também esteja no seu alcance (admin: toda a empresa;
-- gerente: a própria equipe). Um vendedor só pode devolver ou manter consigo.
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id))
  with check (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert to authenticated
  with check (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities
  for update to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id))
  with check (org_id = public.app_org_id() and public.app_can_access(owner_id));

drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities
  for delete to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

-- Histórico segue a visibilidade do lead a que pertence.
drop policy if exists interactions_select on public.interactions;
create policy interactions_select on public.interactions
  for select to authenticated
  using (
    org_id = public.app_org_id()
    and (
      public.app_is_admin()
      or public.app_can_access(author_id)
      or exists (
        select 1 from public.leads l
        where l.id = interactions.lead_id and public.app_can_access(l.owner_id)
      )
    )
  );

drop policy if exists interactions_insert on public.interactions;
create policy interactions_insert on public.interactions
  for insert to authenticated
  with check (
    org_id = public.app_org_id()
    and (author_id is null or author_id = auth.uid() or public.app_is_admin())
  );

-- O histórico é memória: ninguém reescreve o passado. Só o admin pode remover
-- um registro lançado por engano.
drop policy if exists interactions_delete on public.interactions;
create policy interactions_delete on public.interactions
  for delete to authenticated
  using (
    org_id = public.app_org_id()
    and (public.app_is_admin() or author_id = auth.uid())
  );

-- ------------------------------------------------- financeiro: só o admin ---

drop policy if exists contracts_admin on public.contracts;
create policy contracts_admin on public.contracts
  for all to authenticated
  using (org_id = public.app_org_id() and public.app_is_admin())
  with check (org_id = public.app_org_id() and public.app_is_admin());

drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments
  for all to authenticated
  using (org_id = public.app_org_id() and public.app_is_admin())
  with check (org_id = public.app_org_id() and public.app_is_admin());

drop policy if exists expenses_admin on public.expenses;
create policy expenses_admin on public.expenses
  for all to authenticated
  using (org_id = public.app_org_id() and public.app_is_admin())
  with check (org_id = public.app_org_id() and public.app_is_admin());
