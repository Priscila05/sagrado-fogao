-- ============================================================================
-- ALINHO — versão multiusuário
-- Migração 3/3: organização, perfis automáticos e nomeação segura do admin
--
-- Revisada após auditoria de segurança:
--
--   * O papel NÃO vem mais de `raw_user_meta_data`. Metadados são controlados
--     por quem se cadastra e permitiriam pedir `admin` na própria inscrição.
--   * O primeiro administrador NÃO é mais "quem chegou primeiro". Quem manda é
--     uma lista de e-mails autorizados que só o proprietário do projeto
--     consegue preencher (SQL Editor / service_role), nunca a API pública.
--
-- Nada aqui apaga dados. Rodar duas vezes é seguro.
-- ============================================================================

-- --------------------------------------- lista de administradores (cofre) ---

create table if not exists public.admin_bootstrap_allowlist (
  email text primary key,
  note text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.admin_bootstrap_allowlist is
  'E-mails que recebem o papel admin ao criar a conta. Preenchida apenas pelo '
  'proprietário no SQL Editor: a tabela tem RLS sem nenhuma política, então '
  'nem anon nem authenticated conseguem ler ou escrever pela API.';

alter table public.admin_bootstrap_allowlist enable row level security;
alter table public.admin_bootstrap_allowlist force row level security;
-- Sem políticas de propósito: RLS ativo sem política nenhuma nega tudo.
revoke all on public.admin_bootstrap_allowlist from anon, authenticated;

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
 * O papel vem EXCLUSIVAMENTE da lista de administradores. Qualquer outra
 * pessoa entra como `vendedor`, independentemente do que enviar no cadastro —
 * inclusive se tentar `{"role":"admin"}` nos metadados.
 *
 * O nome exibido aceita o metadado `full_name` porque é informação sem
 * privilégio; ainda assim é limitado em tamanho.
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
  v_email text := lower(coalesce(new.email, ''));
  v_name text;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then
    insert into public.organizations (name) values ('Minha empresa') returning id into v_org;
  end if;

  if v_email <> '' and exists (
    select 1 from public.admin_bootstrap_allowlist a where lower(a.email) = v_email
  ) then
    v_role := 'admin';
  else
    v_role := 'vendedor';
  end if;

  v_name := left(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(v_email, '@', 1)),
    120
  );

  insert into public.profiles (id, org_id, email, full_name, role)
  values (new.id, v_org, coalesce(new.email, ''), v_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Função de gatilho: não é um endpoint da API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------- perfis de usuários já criados --

-- Se você já tinha criado usuários antes de rodar as migrações, isto cria os
-- perfis que faltam. O papel segue a mesma regra: admin só quem está na lista.
do $$
declare
  v_org uuid;
  v_user record;
  v_role public.user_role;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then return; end if;

  for v_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at
  loop
    if lower(coalesce(v_user.email, '')) <> '' and exists (
      select 1 from public.admin_bootstrap_allowlist a
      where lower(a.email) = lower(v_user.email)
    ) then
      v_role := 'admin';
    else
      v_role := 'vendedor';
    end if;

    insert into public.profiles (id, org_id, email, full_name, role)
    values (
      v_user.id,
      v_org,
      coalesce(v_user.email, ''),
      left(
        coalesce(
          nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
          split_part(coalesce(v_user.email, ''), '@', 1)
        ),
        120
      ),
      v_role
    )
    on conflict (id) do nothing;
  end loop;
end $$;
