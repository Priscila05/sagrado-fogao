-- ============================================================================
-- ALINHO — diagnóstico de leitura
--
-- Rode no SQL Editor do Supabase quando o login funcionar mas o aplicativo
-- disser que não conseguiu carregar os dados. Só lê catálogo; não altera nada.
-- Cada linha devolve OK ou o que corrigir.
-- ============================================================================

with esperadas(tabela) as (
  values ('organizations'), ('profiles'), ('org_settings'), ('companies'),
         ('leads'), ('activities'), ('interactions'), ('contracts'),
         ('payments'), ('expenses')
),
estado as (
  select
    e.tabela,
    c.oid is not null                                        as existe,
    coalesce(c.relrowsecurity, false)                        as rls,
    coalesce(has_table_privilege('authenticated', c.oid, 'SELECT'), false) as pode_ler,
    coalesce(has_table_privilege('anon', c.oid, 'SELECT'), false)          as anon_le
  from esperadas e
  left join pg_class c
    on c.relname = e.tabela
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
)
select
  tabela,
  case
    when not existe  then 'FALTA A TABELA — rode a migração 0001_schema.sql'
    when not pode_ler then 'SEM PERMISSÃO DE LEITURA — rode a migração 0002_rls.sql'
    when not rls      then 'RLS DESLIGADO — rode a migração 0002_rls.sql'
    when anon_le      then 'VISÍVEL SEM LOGIN — rode a migração 0002_rls.sql'
    else 'OK'
  end as situacao
from estado
order by (case when not existe then 0 when not pode_ler then 1 else 9 end), tabela;

-- Políticas de LEITURA por tabela. Contar políticas no geral não serve: uma
-- tabela pode ter políticas de escrita e nenhuma de leitura, e aí o aplicativo
-- abre vazio sem dar erro nenhum. `polcmd` 'r' é SELECT e '*' é ALL.
select
  c.relname as tabela,
  count(p.polname) filter (where p.polcmd in ('r', '*')) as politicas_de_leitura,
  case
    when count(p.polname) filter (where p.polcmd in ('r', '*')) = 0
      then 'SEM POLÍTICA DE LEITURA — rode 0002_rls.sql'
    else 'OK'
  end as situacao
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname in ('organizations','profiles','org_settings','companies','leads',
                    'activities','interactions','contracts','payments','expenses')
group by c.relname
order by count(p.polname) filter (where p.polcmd in ('r', '*')), c.relname;

-- Seu perfil: sem org_id o aplicativo abre vazio; sem perfil, nem abre.
select
  u.email,
  p.id is not null as tem_perfil,
  p.role,
  p.active,
  p.org_id is not null as tem_empresa,
  case
    when p.id is null       then 'SEM PERFIL — veja a seção 2 do supabase/README.md'
    when p.org_id is null   then 'PERFIL SEM EMPRESA — rode a migração 0003_bootstrap.sql'
    when not p.active       then 'CONTA DESATIVADA'
    else 'OK'
  end as situacao
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
