-- ============================================================================
-- Testes negativos das migrações do ALINHO, executados contra PostgreSQL real.
-- Cada caso tenta fazer algo que NÃO deveria ser permitido.
-- ============================================================================

\set ON_ERROR_STOP on
\set QUIET on

create temp table resultado (ordem serial, caso text, ok boolean, detalhe text);
-- Os testes rodam sob os papéis anon/authenticated; todos precisam registrar.
grant all on resultado to public;
grant all on sequence resultado_ordem_seq to public;

create or replace function pg_temp.checar(p_caso text, p_ok boolean, p_detalhe text default '')
returns void language sql as $$
  insert into resultado (caso, ok, detalhe) values (p_caso, p_ok, p_detalhe);
$$;

-- Executa um comando esperando que ele seja RECUSADO.
create or replace function pg_temp.deve_falhar(p_caso text, p_sql text)
returns void language plpgsql as $$
begin
  execute p_sql;
  perform pg_temp.checar(p_caso, false, 'PERMITIU — o comando deveria ter sido recusado');
exception when others then
  perform pg_temp.checar(p_caso, true, left(sqlerrm, 70));
end;
$$;

-- Executa um comando esperando que ele FUNCIONE.
create or replace function pg_temp.deve_passar(p_caso text, p_sql text)
returns void language plpgsql as $$
begin
  execute p_sql;
  perform pg_temp.checar(p_caso, true, '');
exception when others then
  perform pg_temp.checar(p_caso, false, 'RECUSOU — ' || left(sqlerrm, 60));
end;
$$;

-- ---------------------------------------------------------------- cenário ---
-- Monta a empresa com admin, gerente, dois vendedores (um fora da equipe) e
-- uma segunda organização, para testar vazamento entre empresas.

insert into public.admin_bootstrap_allowlist (email, note)
values ('dona@empresa.com.br', 'proprietária');

-- (1) tentativa de escalonamento por metadados, ANTES de qualquer admin existir
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'invasor@fora.com',
   '{"role":"admin","full_name":"Invasor"}'::jsonb);

select pg_temp.checar(
  '1. Metadados {"role":"admin"} NÃO viram admin',
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000001') = 'vendedor',
  'papel obtido: ' || (select role::text from public.profiles where id = '00000000-0000-4000-8000-000000000001')
);

-- (2) o primeiro usuário cadastrado não vira admin por ser o primeiro
select pg_temp.checar(
  '2. Primeiro usuário cadastrado NÃO vira admin automaticamente',
  not exists (select 1 from public.profiles where role = 'admin')
);

-- admin de verdade: só quem está na lista do proprietário
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000002', 'dona@empresa.com.br');

select pg_temp.checar(
  '2b. E-mail autorizado pelo proprietário nasce admin',
  (select role from public.profiles where id = '00000000-0000-4000-8000-000000000002') = 'admin'
);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000003', 'gerente@empresa.com.br'),
  ('00000000-0000-4000-8000-000000000004', 'vendedor1@empresa.com.br'),
  ('00000000-0000-4000-8000-000000000005', 'vendedor2@empresa.com.br');

-- papéis atribuídos pelo caminho legítimo (função administrativa), como admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select public.admin_set_member_role('00000000-0000-4000-8000-000000000003', 'gerente');
select public.admin_set_member_manager('00000000-0000-4000-8000-000000000004',
                                       '00000000-0000-4000-8000-000000000003');
reset role;

-- segunda organização, com o seu próprio admin
insert into public.organizations (id, name)
values ('99999999-9999-4999-8999-999999999999', 'Outra Empresa');
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000009', 'admin@outra.com.br');
-- o gatilho criou o perfil na organização principal; aqui ele é movido para a
-- segunda organização (operação de proprietário, fora da API)
update public.profiles
set org_id = '99999999-9999-4999-8999-999999999999', role = 'admin'
where id = '00000000-0000-4000-8000-000000000009';
insert into public.profiles (id, org_id, email, full_name, role)
values ('00000000-0000-4000-8000-000000000009', '99999999-9999-4999-8999-999999999999',
        'admin@outra.com.br', 'Outro Admin', 'admin')
on conflict (id) do nothing;

-- dados de trabalho (criados pelo admin)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

insert into public.companies (id, name, owner_id)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Cantina Dona Marta',
        '00000000-0000-4000-8000-000000000004');

insert into public.leads (id, establishment_name, owner_id, company_id) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Lead do vendedor 1',
   '00000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Lead do vendedor 2',
   '00000000-0000-4000-8000-000000000005', null),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'Lead sem responsável', null, null);

insert into public.contracts (id, project_name, client_name, total_value)
values ('cccccccc-0000-4000-8000-000000000001', 'Site', 'Cantina', 3000);

reset role;

-- outra organização cria a sua própria empresa
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000009';
insert into public.companies (id, name)
values ('aaaaaaaa-0000-4000-8000-000000000099', 'Empresa de Outra Org');
reset role;

-- ============================================================================
-- VENDEDOR 1 — o papel mais restrito
-- ============================================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';

-- (3) escalonamento de privilégio no próprio perfil
select pg_temp.deve_falhar('3a. Vendedor NÃO muda o próprio papel',
  $$update public.profiles set role = 'admin' where id = auth.uid()$$);
select pg_temp.deve_falhar('3b. Vendedor NÃO muda a própria organização',
  $$update public.profiles set org_id = '99999999-9999-4999-8999-999999999999' where id = auth.uid()$$);
select pg_temp.deve_falhar('3c. Vendedor NÃO muda o próprio supervisor',
  $$update public.profiles set manager_id = null where id = auth.uid()$$);
select pg_temp.deve_falhar('3d. Vendedor NÃO reativa/desativa acessos',
  $$update public.profiles set active = false where id <> auth.uid()$$);
select pg_temp.deve_passar('3e. Vendedor ainda edita o próprio nome',
  $$update public.profiles set full_name = 'Vendedor Um' where id = auth.uid()$$);

-- (3f) e não altera o perfil de outra pessoa
update public.profiles set full_name = 'invadido'
where id = '00000000-0000-4000-8000-000000000005';
select pg_temp.checar('3f. UPDATE no perfil alheio não atinge nenhuma linha',
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-000000000005') <> 'invadido');

-- (3g) funções administrativas recusam quem não é admin
select pg_temp.deve_falhar('3g. Vendedor NÃO usa admin_set_member_role',
  $$select public.admin_set_member_role('00000000-0000-4000-8000-000000000004', 'admin')$$);
select pg_temp.deve_falhar('3h. Vendedor NÃO usa admin_set_member_active',
  $$select public.admin_set_member_active('00000000-0000-4000-8000-000000000003', false)$$);

-- (3i) criar ou apagar perfis pela API está fora de cogitação
select pg_temp.deve_falhar('3i. Vendedor NÃO cria perfil (nem para um admin novo)',
  $$insert into public.profiles (id, org_id, email, role)
    values (gen_random_uuid(), public.app_org_id(), 'novo@admin.com', 'admin')$$);
select pg_temp.deve_falhar('3j. Vendedor NÃO apaga perfis',
  $$delete from public.profiles where id = '00000000-0000-4000-8000-000000000005'$$);

-- (5e) o mesmo vale para empresas e atividades: o responsável é forçado
insert into public.companies (id, name, owner_id)
values ('aaaaaaaa-0000-4000-8000-000000000011', 'Criada pelo vendedor',
        '00000000-0000-4000-8000-000000000005');
select pg_temp.checar('5e. Empresa criada por vendedor fica com ele',
  (select owner_id from public.companies where id = 'aaaaaaaa-0000-4000-8000-000000000011')
    = '00000000-0000-4000-8000-000000000004');

insert into public.activities (id, title, owner_id)
values ('eeeeeeee-0000-4000-8000-000000000001', 'Minha tarefa',
        '00000000-0000-4000-8000-000000000003');
select pg_temp.checar('5f. Atividade criada por vendedor fica com ele',
  (select owner_id from public.activities where id = 'eeeeeeee-0000-4000-8000-000000000001')
    = '00000000-0000-4000-8000-000000000004');

-- (4) registros sem responsável não são terra de ninguém
select pg_temp.checar('4a. Vendedor NÃO enxerga lead sem responsável',
  (select count(*) from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000003') = 0);

update public.leads set owner_id = auth.uid()
where id = 'bbbbbbbb-0000-4000-8000-000000000003';
select pg_temp.checar('4b. Vendedor NÃO assume lead sem responsável',
  (select owner_id from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000003') is null);

-- O RLS faz o DELETE atingir zero linhas (sem erro). O efeito real é conferido
-- no bloco final, com privilégio, que é a verificação que importa.
delete from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000003';

-- (4d) nem enxerga o lead de outro vendedor
select pg_temp.checar('4d. Vendedor NÃO enxerga lead de outro vendedor',
  (select count(*) from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0);

-- (5) redistribuição é privilégio de gerente/admin
select pg_temp.deve_falhar('5a. Vendedor NÃO repassa o próprio lead a outra pessoa',
  $$update public.leads set owner_id = '00000000-0000-4000-8000-000000000005'
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$);
select pg_temp.deve_falhar('5b. Vendedor NÃO remove o responsável do próprio lead',
  $$update public.leads set owner_id = null where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$);
select pg_temp.deve_passar('5c. Vendedor ainda edita o conteúdo do seu lead',
  $$update public.leads set notes = 'conversa de hoje' where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$);

-- (5d) ao criar, o responsável é forçado para ele mesmo
insert into public.leads (id, establishment_name, owner_id)
values ('bbbbbbbb-0000-4000-8000-000000000010', 'Criado pelo vendedor',
        '00000000-0000-4000-8000-000000000005');
select pg_temp.checar('5d. Lead criado por vendedor fica com ele, não com quem ele indicou',
  (select owner_id from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000010')
    = '00000000-0000-4000-8000-000000000004');

-- (6) histórico
select pg_temp.deve_falhar('6a. Vendedor NÃO registra histórico em lead alheio',
  $$insert into public.interactions (lead_id, type, description)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'observacao', 'bisbilhotando')$$);

insert into public.interactions (id, lead_id, type, description, author_id)
values ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
        'observacao', 'ligação feita', '00000000-0000-4000-8000-000000000002');
select pg_temp.checar('6b. Autoria do histórico não pode ser forjada',
  (select author_id from public.interactions where id = 'dddddddd-0000-4000-8000-000000000001')
    = '00000000-0000-4000-8000-000000000004');

select pg_temp.deve_falhar('6c. Histórico não pode ser editado por ninguém',
  $$update public.interactions set description = 'reescrevendo o passado'
    where id = 'dddddddd-0000-4000-8000-000000000001'$$);

-- registro automático do sistema, criado pelo admin
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
insert into public.interactions (id, lead_id, type, description, automatic)
values ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
        'sistema', 'Etapa alterada', true);
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';

delete from public.interactions where id = 'dddddddd-0000-4000-8000-000000000002';
select pg_temp.checar('6d. Vendedor NÃO apaga registro automático do sistema',
  exists (select 1 from public.interactions where id = 'dddddddd-0000-4000-8000-000000000002'));

delete from public.interactions where id = 'dddddddd-0000-4000-8000-000000000001';
select pg_temp.checar('6e. Autor ainda corrige a própria anotação manual',
  not exists (select 1 from public.interactions where id = 'dddddddd-0000-4000-8000-000000000001'));

-- (7) relações entre organizações
select pg_temp.deve_falhar('7a. Lead NÃO pode apontar para empresa de outra organização',
  $$update public.leads set company_id = 'aaaaaaaa-0000-4000-8000-000000000099'
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$);
select pg_temp.deve_falhar('7b. Registro NÃO pode trocar de organização',
  $$update public.leads set org_id = '99999999-9999-4999-8999-999999999999'
    where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$);
select pg_temp.deve_falhar('7c. Atividade NÃO pode ser pendurada em lead alheio',
  $$insert into public.activities (title, lead_id)
    values ('espiando', 'bbbbbbbb-0000-4000-8000-000000000002')$$);

-- (9) financeiro
select pg_temp.checar('9a. Vendedor NÃO enxerga contratos',
  (select count(*) from public.contracts) = 0);
select pg_temp.checar('9b. Vendedor NÃO enxerga pagamentos nem despesas',
  (select count(*) from public.payments) + (select count(*) from public.expenses) = 0);
select pg_temp.deve_falhar('9c. Vendedor NÃO cria contrato',
  $$insert into public.contracts (project_name, total_value) values ('golpe', 1)$$);

-- (8) funções internas não são endpoints
select pg_temp.deve_falhar('8a. Gatilho guard_owned_record não é chamável pela API',
  $$select public.guard_owned_record()$$);
select pg_temp.deve_falhar('8b. handle_new_user não é chamável pela API',
  $$select public.handle_new_user()$$);
select pg_temp.deve_falhar('8c. Lista de administradores é invisível pela API',
  $$select count(*) from public.admin_bootstrap_allowlist$$);
select pg_temp.deve_falhar('8d. Ninguém insere e-mail na lista de administradores',
  $$insert into public.admin_bootstrap_allowlist (email) values ('invasor@fora.com')$$);

reset role;

-- ============================================================================
-- GERENTE — supervisiona a equipe, não a empresa
-- ============================================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';

select pg_temp.checar('G1. Gerente enxerga o lead do seu vendedor',
  exists (select 1 from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000001'));
select pg_temp.checar('G2. Gerente NÃO enxerga lead de vendedor fora da equipe',
  not exists (select 1 from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000002'));
select pg_temp.checar('G3. Gerente enxerga a fila sem responsável (para distribuir)',
  exists (select 1 from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000003'));

select pg_temp.deve_passar('G4. Gerente distribui lead para a própria equipe',
  $$update public.leads set owner_id = '00000000-0000-4000-8000-000000000004'
    where id = 'bbbbbbbb-0000-4000-8000-000000000003'$$);
select pg_temp.deve_falhar('G5. Gerente NÃO distribui para fora da equipe',
  $$update public.leads set owner_id = '00000000-0000-4000-8000-000000000005'
    where id = 'bbbbbbbb-0000-4000-8000-000000000003'$$);

select pg_temp.checar('G6. Gerente NÃO enxerga o financeiro',
  (select count(*) from public.contracts) = 0);
select pg_temp.deve_falhar('G7. Gerente NÃO altera papéis',
  $$select public.admin_set_member_role('00000000-0000-4000-8000-000000000004', 'admin')$$);
-- Também passa sem erro, atingindo zero linhas; o efeito é conferido no final.
update public.org_settings set sources = array['hackeado-pelo-gerente'];

reset role;

-- ============================================================================
-- ADMIN — pode tudo na empresa, mas não quebra invariantes
-- ============================================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select pg_temp.checar('A1. Admin enxerga todos os leads da empresa',
  (select count(*) from public.leads) >= 3);
select pg_temp.checar('A2. Admin enxerga o financeiro',
  (select count(*) from public.contracts) = 1);
select pg_temp.deve_passar('A3. Admin distribui para qualquer pessoa da empresa',
  $$update public.leads set owner_id = '00000000-0000-4000-8000-000000000005'
    where id = 'bbbbbbbb-0000-4000-8000-000000000003'$$);
select pg_temp.deve_falhar('A4. Admin NÃO altera o próprio papel',
  $$select public.admin_set_member_role('00000000-0000-4000-8000-000000000002', 'vendedor')$$);
select pg_temp.deve_falhar('A5. Admin NÃO se desativa',
  $$select public.admin_set_member_active('00000000-0000-4000-8000-000000000002', false)$$);
select pg_temp.deve_falhar('A6. Supervisão não pode criar ciclo',
  $$select public.admin_set_member_manager('00000000-0000-4000-8000-000000000003',
                                           '00000000-0000-4000-8000-000000000004')$$);
select pg_temp.deve_falhar('A7. Supervisor precisa ser gerente ou admin',
  $$select public.admin_set_member_manager('00000000-0000-4000-8000-000000000005',
                                           '00000000-0000-4000-8000-000000000004')$$);
update public.companies set name = 'tomada-por-outro-admin'
where id = 'aaaaaaaa-0000-4000-8000-000000000099';
select pg_temp.checar('A8b. Empresa de outra organização é invisível',
  not exists (select 1 from public.companies where id = 'aaaaaaaa-0000-4000-8000-000000000099'));

reset role;

-- ============================================================================
-- ANÔNIMO — quem não entrou não lê nada
-- ============================================================================
set role anon;
select pg_temp.deve_falhar('AN1. Anônimo NÃO lê leads', $$select count(*) from public.leads$$);
select pg_temp.deve_falhar('AN2. Anônimo NÃO lê perfis', $$select count(*) from public.profiles$$);
select pg_temp.deve_falhar('AN3. Anônimo NÃO lê o financeiro', $$select count(*) from public.contracts$$);
select pg_temp.deve_falhar('AN4. Anônimo NÃO escreve leads',
  $$insert into public.leads (establishment_name) values ('anon')$$);
select pg_temp.deve_falhar('AN5. Anônimo NÃO usa as funções de permissão',
  $$select public.app_is_admin()$$);
reset role;

-- ============================================================================
-- PERFIL DESATIVADO — acesso cessa imediatamente
-- ============================================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select public.admin_set_member_active('00000000-0000-4000-8000-000000000005', false);
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000005';
select pg_temp.checar('D1. Perfil desativado não enxerga mais nada',
  (select count(*) from public.leads) = 0);
select pg_temp.deve_falhar('D2. Perfil desativado não escreve',
  $$insert into public.leads (establishment_name) values ('voltei')$$);
reset role;

-- ============================================================================
-- EFEITO REAL DAS TENTATIVAS BARRADAS
-- Conferido com privilégio: o RLS recusa UPDATE/DELETE sem lançar erro, então
-- o que prova a proteção é o dado continuar intacto.
-- ============================================================================
select pg_temp.checar('4c. Lead sem responsável sobreviveu à tentativa de exclusão pelo vendedor',
  exists (select 1 from public.leads where id = 'bbbbbbbb-0000-4000-8000-000000000003'));

select pg_temp.checar('G8. Configurações da empresa intactas após tentativa do gerente',
  not ('hackeado-pelo-gerente' = any (select unnest(sources) from public.org_settings)));

select pg_temp.checar('A8. Dados de outra organização intactos após tentativa do admin',
  (select name from public.companies where id = 'aaaaaaaa-0000-4000-8000-000000000099')
    = 'Empresa de Outra Org');

select pg_temp.checar('X1. Nenhum perfil mudou de papel por caminho não autorizado',
  (select count(*) from public.profiles where role = 'admin') = 2);

\pset format aligned
\echo ''
\echo '================= RESULTADO DOS TESTES NEGATIVOS ================='
select caso, case when ok then 'PASSOU' else 'FALHOU' end as resultado, detalhe
from resultado order by ordem;

select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam
from resultado;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultado where not ok;
  if v_falhas > 0 then
    raise exception '% teste(s) de segurança falharam', v_falhas;
  end if;
end $$;
