-- ============================================================================
-- ALINHO — versão multiusuário
-- Migração 3/3: organização inicial, perfis automáticos e etapas padrão
--
-- Nada aqui apaga dados. Rodar duas vezes é seguro.
-- ============================================================================

-- ------------------------------------------------- organização e ajustes ----

do $$
declare
  v_org uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;

  if v_org is null then
    insert into public.organizations (name)
    values ('Monter Web Studio')          -- troque pelo nome da sua empresa
    returning id into v_org;
  end if;

  insert into public.org_settings (org_id, stages, sources, segments, expense_categories, payment_methods)
  values (
    v_org,
    -- Mesmas etapas padrão do aplicativo. Podem ser personalizadas depois na
    -- tela de Configurações, sem perder leads.
    '[
      {"id":"novo","name":"Novo lead","order":0,"kind":"aberta"},
      {"id":"primeiro-contato","name":"Primeiro contato","order":1,"kind":"aberta"},
      {"id":"contato-realizado","name":"Contato realizado","order":2,"kind":"aberta"},
      {"id":"interessado","name":"Interessado","order":3,"kind":"aberta"},
      {"id":"reuniao-agendada","name":"Reunião agendada","order":4,"kind":"aberta"},
      {"id":"proposta-enviada","name":"Proposta enviada","order":5,"kind":"aberta"},
      {"id":"negociacao","name":"Negociação","order":6,"kind":"aberta"},
      {"id":"ganho","name":"Ganho","order":7,"kind":"ganha","locked":true},
      {"id":"perdido","name":"Perdido","order":8,"kind":"perdida","locked":true}
    ]'::jsonb,
    array['Prospecção ativa','Indicação','Instagram','WhatsApp','Site','Google','Evento','Outro'],
    array['Pet shop','Restaurante','Loja','Prestador de serviços','Beleza e estética','Saúde','Educação','Outro'],
    array['Ferramentas e software','Hospedagem e domínio','Serviços de terceiros','Marketing e anúncios','Equipamentos','Impostos e taxas','Deslocamento','Outros'],
    array['Pix','Transferência bancária','Boleto','Cartão de crédito','Dinheiro','Outro']
  )
  on conflict (org_id) do nothing;
end $$;

-- ------------------------------------------- perfil automático no cadastro --

/**
 * Cria o perfil assim que um usuário é criado no Supabase Auth.
 *
 * - O PRIMEIRO usuário da organização entra como `admin`; os demais entram
 *   como `vendedor` e o admin ajusta o papel depois.
 * - É possível predefinir papel e nome pelos metadados do convite
 *   (`role` e `full_name` em raw_user_meta_data).
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_role public.user_role;
  v_is_first boolean;
  v_meta_role text;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then
    insert into public.organizations (name) values ('Minha empresa') returning id into v_org;
  end if;

  select not exists (select 1 from public.profiles where org_id = v_org) into v_is_first;

  v_meta_role := nullif(new.raw_user_meta_data ->> 'role', '');
  if v_is_first then
    v_role := 'admin';
  elsif v_meta_role in ('admin', 'gerente', 'vendedor') then
    v_role := v_meta_role::public.user_role;
  else
    v_role := 'vendedor';
  end if;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    new.id,
    v_org,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------- perfis de usuários já criados --

-- Caso você já tenha criado usuários antes de rodar as migrações, isto cria os
-- perfis que faltam (o primeiro vira admin).
do $$
declare
  v_org uuid;
  v_user record;
  v_is_first boolean;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then return; end if;

  for v_user in
    select u.id, u.email, u.raw_user_meta_data, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at
  loop
    select not exists (select 1 from public.profiles where org_id = v_org) into v_is_first;
    insert into public.profiles (id, org_id, email, full_name, role)
    values (
      v_user.id,
      v_org,
      coalesce(v_user.email, ''),
      coalesce(nullif(v_user.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(v_user.email, ''), '@', 1)),
      case when v_is_first then 'admin'::public.user_role else 'vendedor'::public.user_role end
    )
    on conflict (id) do nothing;
  end loop;
end $$;
