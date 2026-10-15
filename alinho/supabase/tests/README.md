# Testes de segurança das migrações

Os arquivos desta pasta **não** fazem parte das migrações e não devem ser
executados no Supabase. Eles rodam contra um PostgreSQL local para provar, com
comandos reais, que as políticas recusam o que precisam recusar.

| Arquivo | Para que serve |
| --- | --- |
| `00_harness.sql` | Reproduz o ambiente do Supabase: papéis `anon`/`authenticated`/`service_role`, o schema `auth` com `auth.users` e `auth.uid()`, e os privilégios amplos que o Supabase concede por padrão — exatamente o que as migrações precisam restringir. |
| `01_negativos.sql` | 63 casos: tentativas de escalonamento de privilégio, de assumir leads alheios, de forjar autoria no histórico, de cruzar organizações e de acessar o financeiro sem ser admin. |

## Como rodar

Com o PostgreSQL 15 ou superior instalado (as migrações usam
`ON DELETE SET NULL (coluna)`, de PG 15+):

```bash
initdb -D /tmp/pgalinho -U alinho_owner --auth=trust
pg_ctl -D /tmp/pgalinho -o "-p 54329 -k /tmp" start

export PGHOST=/tmp PGPORT=54329 PGUSER=alinho_owner
createdb alinho_test
psql -d alinho_test -f supabase/tests/00_harness.sql
psql -d alinho_test -f supabase/migrations/0001_schema.sql
psql -d alinho_test -f supabase/migrations/0002_rls.sql
psql -d alinho_test -f supabase/migrations/0003_bootstrap.sql
psql -d alinho_test -f supabase/tests/01_negativos.sql
```

A última linha imprime a tabela de resultados e **falha com erro** se qualquer
caso passar quando deveria ser barrado.

## Por que alguns testes checam o dado, e não um erro

O RLS não lança exceção em `UPDATE` e `DELETE`: ele simplesmente não encontra
linhas, e o comando termina "com sucesso" tendo afetado zero registros. Por
isso os casos dessa natureza conferem, com privilégio, que o dado continua
intacto — é a prova mais forte de que a tentativa não teve efeito.

## O que estes testes não cobrem

Eles rodam no PostgreSQL puro. O comportamento do PostgREST (a API do Supabase)
em cima dessas mesmas políticas é equivalente, mas quem confirma o conjunto é
você, rodando as migrações no seu projeto e repetindo o roteiro de conferência
do `supabase/README.md` com dois navegadores.
