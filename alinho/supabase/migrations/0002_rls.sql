-- ============================================================================
-- ALINHO — versão multiusuário
-- Migração 2/3: permissões, RLS e travas de integridade
--
-- Revisada após auditoria de segurança. Princípios:
--
--   1. O cliente nunca define quem ele é. `org_id`, `owner_id` em inserções de
--      vendedor e `author_id` do histórico são preenchidos pelo banco.
--   2. Papel, organização, supervisor e situação de uma pessoa NÃO podem ser
--      alterados por UPDATE direto: a permissão de coluna é negada e as
--      mudanças passam por funções administrativas que validam invariantes.
--   3. Mudança de responsável é verificada comparando o registro antigo com o
--      novo (gatilho), algo que uma política RLS sozinha não consegue fazer.
--   4. Registro sem responsável não é terra de ninguém: só admin e gerente
--      enxergam e distribuem.
--   5. O histórico exige permissão sobre o lead/empresa ancorado, na leitura,
--      na inserção e na exclusão, e nunca pode ser editado.
--
-- Regras por papel:
--   admin    — tudo da empresa, inclusive o financeiro.
--   gerente  — o que é dele e o da sua equipe; distribui dentro da equipe.
--   vendedor — apenas o que está sob sua responsabilidade; não distribui.
-- ============================================================================

-- ------------------------------------------------------- funções auxiliares --
-- SECURITY DEFINER para poderem ler `profiles` sem disparar as políticas da
-- própria tabela (evita recursão). `search_path` fixo impede sequestro de nome.

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

create or replace function public.app_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.app_role() = 'gerente', false);
$$;

/**
 * Pessoas que o usuário atual enxerga:
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
      public.app_is_admin()
      or p.id = auth.uid()
      or (public.app_is_manager() and p.manager_id = auth.uid())
    );
$$;

/**
 * Pode ver/editar um registro cujo responsável é `owner`?
 *
 * Correção da auditoria: registro SEM responsável não fica acessível a todos.
 * Ele é a fila de distribuição e só admin e gerente o enxergam — um vendedor
 * não pode assumir, editar nem excluir leads que ninguém lhe atribuiu.
 */
create or replace function public.app_can_access(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.app_is_admin() then true
    when owner is null then public.app_is_manager()
    when owner = auth.uid() then true
    when public.app_is_manager() then owner in (select public.app_visible_user_ids())
    else false
  end;
$$;

/**
 * Pode atribuir um registro a `new_owner`?
 *
 * Vendedor nunca distribui — nem para outra pessoa, nem removendo o
 * responsável. Gerente distribui dentro da própria equipe. Admin, na empresa.
 */
create or replace function public.app_can_assign(new_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.app_is_admin() then
      new_owner is null
      or exists (
        select 1 from public.profiles p
        where p.id = new_owner and p.org_id = public.app_org_id()
      )
    when public.app_is_manager() then
      new_owner is null or new_owner in (select public.app_visible_user_ids())
    else false
  end;
$$;

/** Permissão sobre o lead ancorado em um registro de histórico. */
create or replace function public.app_can_access_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead
      and l.org_id = public.app_org_id()
      and public.app_can_access(l.owner_id)
  );
$$;

/** Permissão sobre a empresa ancorada em um registro de histórico. */
create or replace function public.app_can_access_company(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company
      and c.org_id = public.app_org_id()
      and public.app_can_access(c.owner_id)
  );
$$;

-- Funções auxiliares não devem ser chamáveis por quem não está autenticado.
revoke all on function
  public.app_org_id(), public.app_role(), public.app_is_admin(), public.app_is_manager(),
  public.app_visible_user_ids(), public.app_can_access(uuid), public.app_can_assign(uuid),
  public.app_can_access_lead(uuid), public.app_can_access_company(uuid)
  from public, anon;

grant execute on function
  public.app_org_id(), public.app_role(), public.app_is_admin(), public.app_is_manager(),
  public.app_visible_user_ids(), public.app_can_access(uuid), public.app_can_assign(uuid),
  public.app_can_access_lead(uuid), public.app_can_access_company(uuid)
  to authenticated;

-- ---------------------------------------- travas de integridade (gatilhos) --
-- Políticas RLS enxergam apenas a linha NOVA. Para proibir a TRANSFERÊNCIA de
-- responsável e a troca de organização é preciso comparar com a linha antiga,
-- o que só um gatilho faz.

create or replace function public.guard_owned_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.app_org_id();
begin
  if v_org is null then
    raise exception 'Perfil inativo ou inexistente' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- A organização é sempre a do usuário: o cliente não escolhe.
    new.org_id := v_org;

    if public.app_is_admin() or public.app_is_manager() then
      if not public.app_can_assign(new.owner_id) then
        raise exception 'Responsável fora do seu alcance' using errcode = '42501';
      end if;
    else
      -- Vendedor só cria registro para si mesmo.
      new.owner_id := auth.uid();
    end if;
    return new;
  end if;

  -- UPDATE
  if new.org_id is distinct from old.org_id then
    raise exception 'A organização de um registro não pode ser alterada'
      using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id then
    if not (public.app_is_admin() or public.app_is_manager()) then
      raise exception 'Somente gerentes e administradores redistribuem registros'
        using errcode = '42501';
    end if;
    if not public.app_can_assign(new.owner_id) then
      raise exception 'Responsável de destino fora do seu alcance'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_owned_record() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['companies', 'leads', 'activities'] loop
    execute format('drop trigger if exists guard_%1$s on public.%1$s', t);
    execute format(
      'create trigger guard_%1$s before insert or update on public.%1$s
       for each row execute function public.guard_owned_record()', t);
  end loop;
end $$;

/**
 * Histórico: autoria e organização vêm do banco, e o conteúdo é imutável.
 * Isso impede que alguém registre uma interação em nome de outra pessoa.
 */
create or replace function public.guard_interaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.app_org_id();
begin
  if v_org is null then
    raise exception 'Perfil inativo ou inexistente' using errcode = '42501';
  end if;
  new.org_id := v_org;
  new.author_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.guard_interaction() from public, anon, authenticated;

drop trigger if exists guard_interactions on public.interactions;
create trigger guard_interactions before insert on public.interactions
  for each row execute function public.guard_interaction();

/** Financeiro: a organização também não é escolhida pelo cliente. */
create or replace function public.guard_org_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.app_org_id();
begin
  if v_org is null then
    raise exception 'Perfil inativo ou inexistente' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.org_id := v_org;
  elsif new.org_id is distinct from old.org_id then
    raise exception 'A organização de um registro não pode ser alterada'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_org_record() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['contracts', 'payments', 'expenses'] loop
    execute format('drop trigger if exists guard_%1$s on public.%1$s', t);
    execute format(
      'create trigger guard_%1$s before insert or update on public.%1$s
       for each row execute function public.guard_org_record()', t);
  end loop;
end $$;

-- ------------------------------------------ funções administrativas (papéis) --
-- Papel, supervisor e situação só mudam por aqui. Cada função confere se quem
-- chamou é administrador e protege invariantes da empresa.

create or replace function public.admin_set_member_role(
  target_id uuid,
  new_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.app_org_id();
begin
  if not public.app_is_admin() then
    raise exception 'Apenas administradores alteram papéis' using errcode = '42501';
  end if;
  if target_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio papel' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target_id and org_id = v_org) then
    raise exception 'Pessoa não encontrada nesta empresa' using errcode = '42501';
  end if;

  update public.profiles set role = new_role where id = target_id and org_id = v_org;

  -- A empresa nunca pode ficar sem administrador ativo.
  if not exists (
    select 1 from public.profiles
    where org_id = v_org and role = 'admin' and active
  ) then
    raise exception 'A empresa precisa de pelo menos um administrador ativo'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.admin_set_member_manager(
  target_id uuid,
  new_manager_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.app_org_id();
  v_cursor uuid;
  v_depth integer := 0;
begin
  if not public.app_is_admin() then
    raise exception 'Apenas administradores definem a supervisão' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target_id and org_id = v_org) then
    raise exception 'Pessoa não encontrada nesta empresa' using errcode = '42501';
  end if;
  if new_manager_id is not null then
    if new_manager_id = target_id then
      raise exception 'Uma pessoa não pode supervisionar a si mesma' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.profiles
      where id = new_manager_id and org_id = v_org and role in ('admin', 'gerente')
    ) then
      raise exception 'O supervisor precisa ser gerente ou administrador da empresa'
        using errcode = '42501';
    end if;

    -- Impede ciclos de supervisão (A → B → A).
    v_cursor := new_manager_id;
    while v_cursor is not null and v_depth < 20 loop
      if v_cursor = target_id then
        raise exception 'Isso criaria um ciclo de supervisão' using errcode = '42501';
      end if;
      select manager_id into v_cursor from public.profiles where id = v_cursor;
      v_depth := v_depth + 1;
    end loop;
  end if;

  update public.profiles
  set manager_id = new_manager_id
  where id = target_id and org_id = v_org;
end;
$$;

create or replace function public.admin_set_member_active(
  target_id uuid,
  new_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.app_org_id();
begin
  if not public.app_is_admin() then
    raise exception 'Apenas administradores ativam ou desativam acessos'
      using errcode = '42501';
  end if;
  if target_id = auth.uid() then
    raise exception 'Você não pode desativar o próprio acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target_id and org_id = v_org) then
    raise exception 'Pessoa não encontrada nesta empresa' using errcode = '42501';
  end if;

  update public.profiles set active = new_active where id = target_id and org_id = v_org;

  if not exists (
    select 1 from public.profiles
    where org_id = v_org and role = 'admin' and active
  ) then
    raise exception 'A empresa precisa de pelo menos um administrador ativo'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function
  public.admin_set_member_role(uuid, public.user_role),
  public.admin_set_member_manager(uuid, uuid),
  public.admin_set_member_active(uuid, boolean)
  from public, anon;

grant execute on function
  public.admin_set_member_role(uuid, public.user_role),
  public.admin_set_member_manager(uuid, uuid),
  public.admin_set_member_active(uuid, boolean)
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

-- Mesmo o dono das tabelas passa a respeitar o RLS (defesa extra caso alguma
-- rotina futura rode com esse papel).
alter table public.profiles      force row level security;
alter table public.companies     force row level security;
alter table public.leads         force row level security;
alter table public.activities    force row level security;
alter table public.interactions  force row level security;
alter table public.contracts     force row level security;
alter table public.payments      force row level security;
alter table public.expenses      force row level security;

-- --------------------------------------------------- privilégios de tabela --
-- O Supabase concede privilégios amplos a `anon` e `authenticated` por padrão.
-- Aqui o acesso anônimo é removido e o autenticado fica limitado ao necessário.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Ninguém escreve diretamente em organizações, perfis ou histórico já gravado.
revoke insert, update, delete on public.organizations from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
revoke update on public.interactions from authenticated;

-- Única coluna que a própria pessoa edita no seu perfil.
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------- organizations --

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.app_org_id());

-- Sem políticas de escrita: o nome da empresa é alterado no painel do Supabase.

-- ----------------------------------------------------------------- profiles --

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (org_id = public.app_org_id());

-- Só o próprio nome, e só da própria linha. Papel, organização, supervisor e
-- situação estão bloqueados pela permissão de coluna acima: nem esta política
-- nem uma chamada direta à API conseguem alterá-los.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and org_id = public.app_org_id());

drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;

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

-- A troca de responsável é verificada no gatilho `guard_owned_record`, que
-- compara o registro antigo com o novo.
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
  with check (
    org_id = public.app_org_id()
    and public.app_can_access(owner_id)
    -- Não dá para pendurar atividade em lead que você não enxerga.
    and (lead_id is null or public.app_can_access_lead(lead_id))
    and (company_id is null or public.app_can_access_company(company_id))
  );

drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities
  for update to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id))
  with check (
    org_id = public.app_org_id()
    and public.app_can_access(owner_id)
    and (lead_id is null or public.app_can_access_lead(lead_id))
    and (company_id is null or public.app_can_access_company(company_id))
  );

drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities
  for delete to authenticated
  using (org_id = public.app_org_id() and public.app_can_access(owner_id));

-- --------------------------------------------------------------- histórico --
-- Leitura, inserção e exclusão exigem permissão sobre o lead ou a empresa
-- ancorados. Não existe política de UPDATE: o histórico é imutável.

drop policy if exists interactions_select on public.interactions;
create policy interactions_select on public.interactions
  for select to authenticated
  using (
    org_id = public.app_org_id()
    and (
      public.app_is_admin()
      or (lead_id is not null and public.app_can_access_lead(lead_id))
      or (company_id is not null and public.app_can_access_company(company_id))
    )
  );

drop policy if exists interactions_insert on public.interactions;
create policy interactions_insert on public.interactions
  for insert to authenticated
  with check (
    org_id = public.app_org_id()
    and (lead_id is null or public.app_can_access_lead(lead_id))
    and (company_id is null or public.app_can_access_company(company_id))
    and (lead_id is not null or company_id is not null)
  );

-- Correção de engano recente pelo próprio autor; o admin corrige qualquer um.
-- Registros automáticos (mudança de etapa, conversão) são memória do sistema e
-- só o administrador remove.
drop policy if exists interactions_delete on public.interactions;
create policy interactions_delete on public.interactions
  for delete to authenticated
  using (
    org_id = public.app_org_id()
    and (
      public.app_is_admin()
      or (
        author_id = auth.uid()
        and not automatic
        and (
          (lead_id is not null and public.app_can_access_lead(lead_id))
          or (company_id is not null and public.app_can_access_company(company_id))
        )
      )
    )
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
