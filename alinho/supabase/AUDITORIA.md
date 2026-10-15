# Auditoria de segurança — o que foi corrigido

Revisão das três migrações antes da primeira execução. Como nada havia sido
rodado no Supabase, as correções foram feitas **nos próprios arquivos**
`0001`–`0003`, que seguem versionados: você executa a versão corrigida uma única
vez, sem precisar de migrações de remendo.

Cada item abaixo foi verificado com comandos reais contra PostgreSQL 16
(`supabase/tests/01_negativos.sql`, 63 casos, todos passando).

---

## 1. CRÍTICO — papel escolhido pelos metadados do cadastro

**Antes:** `handle_new_user()` lia `raw_user_meta_data ->> 'role'`. Esses
metadados são enviados por quem se cadastra. Com inscrições abertas — ou com a
chave publicável em mãos — bastava pedir `{"role":"admin"}` para nascer
administrador.

**Agora:** o gatilho não lê papel de metadado nenhum. Todo novo usuário entra
como `vendedor`. O único caminho para `admin` é a lista de e-mails autorizados
(item 2). Só o nome exibido ainda aceita metadado, por ser informação sem
privilégio, e com tamanho limitado.

**Verificado:** caso 1 — usuário criado com `{"role":"admin"}` nasce `vendedor`.

## 2. Primeiro administrador por ordem de chegada

**Antes:** quem criasse a primeira conta virava administrador. Com inscrição
pública momentaneamente aberta, um estranho capturaria a conta de administrador
da empresa.

**Agora:** existe `public.admin_bootstrap_allowlist`, com RLS ligado e
**nenhuma política** — o que nega tudo para `anon` e `authenticated`. Só o dono
do projeto escreve nela, pelo SQL Editor. O gatilho concede `admin` apenas a
e-mails que já estavam nessa lista no momento da criação da conta.

**Verificado:** casos 2, 2b, 8c e 8d — o primeiro usuário não vira admin; o
e-mail autorizado vira; a lista é invisível e ingravável pela API.

## 3. Alteração de papel, organização, supervisor e situação

**Antes:** `profiles_update_self` tentava barrar essas colunas comparando com
subconsultas dentro da própria política — frágil, e `profiles_update_admin`
permitia `UPDATE` direto em qualquer coluna.

**Agora:** a permissão de `UPDATE` na tabela foi **revogada** e reconcedida
apenas para a coluna `full_name`. Privilégio de coluna é verificado pelo
PostgreSQL antes de qualquer política, então não há política a contornar.
`INSERT` e `DELETE` em `profiles` também foram revogados. As mudanças legítimas
passam por três funções `SECURITY DEFINER` que conferem se quem chamou é
administrador e protegem invariantes: ninguém altera o próprio papel, ninguém
se desativa, a empresa nunca fica sem administrador ativo e a supervisão não
forma ciclos.

**Verificado:** casos 3a–3j, A4, A5, A6, A7 e G7.

## 4. Registros sem responsável acessíveis a qualquer um

**Antes:** `app_can_access()` retornava verdadeiro para `owner_id is null`.
Qualquer vendedor via, editava, assumia e **excluía** leads e empresas sem dono.

**Agora:** registro sem responsável é a fila de distribuição e só admin e
gerente o enxergam. O vendedor não vê, não assume e não apaga.

**Verificado:** casos 4a, 4b, 4c e G3.

## 5. Vendedor redistribuindo leads

**Antes:** nada impedia um vendedor de trocar o `owner_id` do próprio lead —
entregando-o a outra pessoa ou largando-o sem dono.

**Agora:** um gatilho `BEFORE UPDATE` compara a linha antiga com a nova (algo
que uma política RLS não consegue fazer, pois ela só enxerga a nova) e recusa
qualquer troca de responsável feita por quem não é admin ou gerente. O gerente
só distribui dentro da própria equipe. Na criação, o responsável de um registro
feito por vendedor é forçado para ele mesmo.

**Verificado:** casos 5a–5f, G4, G5, A3 e A9.

## 6. Histórico sem verificação de permissão

**Antes:** a inserção só checava a autoria declarada — era possível gravar
histórico em um lead que não se enxerga. A autoria vinha do cliente e podia ser
forjada.

**Agora:** leitura, inserção e exclusão exigem permissão sobre o lead ou a
empresa ancorados. A autoria e a organização são carimbadas pelo banco, não
pelo cliente. Não existe política de `UPDATE` e o privilégio foi revogado: o
histórico é imutável. Registros automáticos do sistema só o administrador
remove; uma anotação manual pode ser corrigida pelo próprio autor.

**Verificado:** casos 6a–6e e 7c.

## 7. Relacionamentos entre organizações

**Antes:** `lead_id`, `company_id` e `owner_id` apontavam apenas para o `id` do
registro. Nada impedia ligar um lead a uma empresa de outra organização.

**Agora:** toda referência é uma chave estrangeira **composta** que carrega a
organização (`(company_id, org_id) → companies(id, org_id)`), o que torna o
vínculo entre organizações impossível no nível do banco. `ON DELETE SET NULL`
foi restrito à coluna do vínculo, para nunca anular `org_id`. Gatilhos impedem
que a organização de um registro seja trocada depois de criado.

**Verificado:** casos 7a, 7b, A8, A8b, A9 e A10.

## 8. Funções, GRANT/REVOKE e acesso direto à API

**Agora:** funções auxiliares são retiradas de `public` e `anon` e concedidas
somente a `authenticated`; funções de gatilho não são concedidas a ninguém (não
são endpoints); `anon` perde todos os privilégios de tabela e de sequência; e o
RLS é `FORCE`, valendo inclusive para o dono das tabelas. Todas as funções
`SECURITY DEFINER` têm `search_path` fixo.

**Verificado:** casos 8a–8d e AN1–AN5.

## 9. Financeiro exclusivo do administrador

Mantido e reconfirmado: contratos, pagamentos e despesas usam política única
`for all` exigindo `app_is_admin()` em `USING` e `WITH CHECK`, mais a amarração
de organização.

**Verificado:** casos 9a, 9b, 9c, G6 e A2.

## 10. Testes executados × verificações estáticas

- **Executado contra PostgreSQL 16 real:** as três migrações e os 63 casos
  negativos de `supabase/tests/01_negativos.sql`, em um banco local com papéis
  `anon`/`authenticated` e `auth.uid()` reproduzidos.
- **Verificação estática (não executada):** 19 testes em
  `src/test/supabaseSetup.test.ts` conferem a estrutura dos arquivos SQL e
  garantem que nenhuma chave de servidor entre no frontend.
- **Não executado:** nada rodou no seu projeto Supabase. O comportamento do
  PostgREST sobre estas mesmas políticas é equivalente ao testado, mas a
  confirmação final no seu ambiente depende de você rodar as migrações e repetir
  o roteiro da seção 6 do `supabase/README.md`.

## Observação sobre o que o RLS faz em UPDATE e DELETE

Quando uma política barra um `UPDATE` ou `DELETE`, o PostgreSQL **não lança
erro**: o comando simplesmente não encontra linhas e termina afetando zero
registros. Por isso vários testes conferem o estado do dado depois da
tentativa, em vez de esperar uma exceção — é a prova mais forte de que a
operação não teve efeito. O aplicativo também não trata esse caso como sucesso
silencioso: a distribuição em lote confere quantos registros foram realmente
alterados e avisa quando algum não pôde ser.
