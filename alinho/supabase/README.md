# ALINHO no Supabase — o que configurar

Três migrações, na ordem. Nenhuma apaga dados e todas podem ser rodadas de novo
sem efeito colateral.

## 1. Rodar as migrações

No painel do Supabase → **SQL Editor** → **New query**, cole e execute, uma de cada vez:

| Arquivo | O que faz |
| --- | --- |
| `migrations/0001_schema.sql` | Cria tabelas, tipos e índices do CRM e do financeiro. |
| `migrations/0002_rls.sql` | Liga o RLS e cria as políticas de admin, gerente e vendedor. |
| `migrations/0003_bootstrap.sql` | Cria a organização, as etapas padrão, a lista de administradores autorizados e o gatilho que gera o perfil de cada novo usuário. |

> `migrations/0004_operacoes_admin.sql.exemplo` **não** é uma migração: são
> comandos prontos para autorizar o primeiro administrador e para emergências.

Antes de rodar a `0003`, troque `'Monter Web Studio'` pelo nome da sua empresa,
se quiser outro.

## 2. Criar o primeiro administrador com segurança

O papel **nunca** vem do cadastro. Quem define quem é administrador é uma lista
de e-mails que só você consegue preencher: a tabela
`public.admin_bootstrap_allowlist` tem RLS ligado e **nenhuma política**, então
nem `anon` nem `authenticated` conseguem ler ou escrever nela pela API. O único
caminho é o SQL Editor do painel, que exige ser dono do projeto.

**Passo 1** — no SQL Editor, autorize o seu e-mail *antes* de criar a conta:

```sql
insert into public.admin_bootstrap_allowlist (email, note)
values ('voce@suaempresa.com.br', 'Proprietária do ALINHO')
on conflict (email) do nothing;
```

**Passo 2** — crie a conta em *Authentication → Users → Add user*, com esse
mesmo e-mail. O perfil nasce com papel `admin`.

**Passo 3** — confirme:

```sql
select email, role, active from public.profiles order by role;
```

**Passo 4 (recomendado)** — depois que o administrador existe, esvazie a lista:

```sql
delete from public.admin_bootstrap_allowlist;
```

> Se a conta já tinha sido criada antes de você autorizar o e-mail, promova-a
> com o `update` que está em `0004_operacoes_admin.sql.exemplo`.

## 3. Criar os acessos da equipe

Não existe cadastro aberto no aplicativo — isso é proposital. Os acessos são
criados por você em **Authentication → Users → Add user**.

- Todo mundo entra como **vendedor**, independentemente do que for informado no
  cadastro. Metadados como `{"role":"admin"}` são **ignorados**.
- Ajuste papéis e supervisão na tela *Equipe* dentro do aplicativo. Ela usa
  funções que conferem quem chamou e protegem invariantes: ninguém altera o
  próprio papel, a empresa nunca fica sem administrador ativo e a supervisão
  não pode formar ciclos.
- Para que um **gerente** enxergue a equipe, defina o **Supervisor** de cada
  vendedor na mesma tela.

## 4. Ajustes de autenticação

**Authentication → Providers → Email**

- Mantenha **Email + Password** habilitado.
- Desative **Enable sign-ups** (*Allow new users to sign up*): só você cria acessos.
- Se deixar **Confirm email** ligado, cada pessoa precisa confirmar o e-mail antes
  do primeiro login.

**Authentication → URL Configuration**

- **Site URL**: o endereço do seu site no Netlify (ex.: `https://alinho.netlify.app`).
- **Redirect URLs**: inclua o mesmo endereço — é para onde volta o link de
  "esqueci minha senha".

## 5. Variáveis do build

Em *Project Settings → API*, copie:

| Campo no Supabase | Variável |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| Publishable key (anon) | `VITE_SUPABASE_PUBLISHABLE_KEY` |

Crie um arquivo `.env` na pasta `alinho/` (use `.env.example` como modelo) **antes**
de gerar o build: o Vite grava esses valores no pacote no momento da compilação.

```bash
cd alinho
cp .env.example .env    # preencha com os seus dados
npm install
npm run build
npm run package         # gera dist-zip/alinho-netlify.zip
```

Se você conectar o Netlify ao repositório em vez de subir o ZIP, defina as duas
variáveis em *Site configuration → Environment variables* e deixe o Netlify
compilar.

**Nunca** coloque a `service_role` nessas variáveis. Ela dá acesso total ao banco
e qualquer visitante do site conseguiria lê-la. O aplicativo detecta e recusa
chaves de servidor, mas a responsabilidade de não publicá-las é de quem gera o build.

## 6. Conferir se ficou seguro

No SQL Editor:

```sql
-- Toda tabela do app precisa aparecer com rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Políticas criadas
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
-- As colunas sensíveis de profiles não podem ser atualizadas por authenticated
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated';
-- esperado: apenas UPDATE em full_name (além dos SELECT/INSERT herdados)
```

Teste prático, com dois navegadores: entre como vendedor em um e como admin no
outro. O vendedor não deve ver o item **Financeiro** no menu — e, se digitar
`/financeiro` na barra de endereços, volta para a visão geral. O banco recusaria
os dados de qualquer forma.

Tentativas que o banco recusa, e que você pode repetir pelo SQL Editor usando
`set role authenticated` e `set request.jwt.claim.sub`:

- vendedor mudando o próprio papel para `admin`;
- vendedor assumindo ou apagando lead sem responsável;
- vendedor repassando o próprio lead para outra pessoa;
- qualquer um registrando histórico em nome de outra pessoa;
- qualquer um ligando um lead a uma empresa de outra organização;
- gerente ou vendedor lendo contratos, pagamentos ou despesas.

Essas e outras 57 tentativas estão automatizadas em `supabase/tests/` — veja o
README daquela pasta para rodá-las em um PostgreSQL local.

## O que cada papel enxerga

| | Admin | Gerente | Vendedor |
| --- | --- | --- | --- |
| Leads, empresas, atividades | Tudo da empresa | Os seus e os da equipe | Apenas os seus |
| Distribuir leads | Sim | Dentro da equipe | Não |
| Painel de equipe | Toda a empresa | Sua equipe | Não vê |
| Financeiro | Sim | Não | Não |
| Etapas, origens, listas | Edita | Usa | Usa |
| Backup | Exporta e importa | Exporta | Não |

Leads **sem responsável** formam a fila de distribuição e são visíveis apenas
para **admin e gerente** — um vendedor não enxerga, não assume e não apaga o que
ninguém lhe atribuiu. A redistribuição também é privilégio de admin e gerente:
o vendedor não repassa nem devolve leads por conta própria.

O **histórico** é imutável: ninguém edita um registro já gravado, a autoria é
carimbada pelo banco (não dá para registrar em nome de outra pessoa) e os
registros automáticos do sistema só o administrador remove.
