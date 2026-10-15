# ALINHO no Supabase — o que configurar

Três migrações, na ordem. Nenhuma apaga dados e todas podem ser rodadas de novo
sem efeito colateral.

## 1. Rodar as migrações

No painel do Supabase → **SQL Editor** → **New query**, cole e execute, uma de cada vez:

| Arquivo | O que faz |
| --- | --- |
| `migrations/0001_schema.sql` | Cria tabelas, tipos e índices do CRM e do financeiro. |
| `migrations/0002_rls.sql` | Liga o RLS e cria as políticas de admin, gerente e vendedor. |
| `migrations/0003_bootstrap.sql` | Cria a organização, as etapas padrão e o gatilho que gera o perfil de cada novo usuário. |

> `migrations/0004_promover_admin.sql.exemplo` **não** é uma migração: é um
> conjunto de comandos prontos para quando você precisar mudar papéis, montar
> equipes ou desativar alguém.

Antes de rodar a `0003`, troque `'Monter Web Studio'` pelo nome da sua empresa,
se quiser outro.

## 2. Criar os acessos das pessoas

Não existe cadastro aberto no aplicativo — isso é proposital. Os acessos são
criados por você:

**Authentication → Users → Add user** (ou *Invite user*), com e-mail e senha.

- O **primeiro** usuário criado vira **administrador** automaticamente.
- Os demais entram como **vendedor**; ajuste o papel em *Equipe* dentro do
  aplicativo, ou pelo SQL de exemplo.
- Para já criar alguém com papel definido, informe em *User Metadata*:
  `{"role": "gerente", "full_name": "Nome da Pessoa"}`.

Para que um **gerente** enxergue a equipe, cada vendedor precisa apontar para
ele. Isso se faz na tela *Equipe* (campo **Supervisor**) ou pelo SQL de exemplo.

## 3. Ajustes de autenticação

**Authentication → Providers → Email**

- Mantenha **Email + Password** habilitado.
- Desative **Enable sign-ups** (*Allow new users to sign up*): só você cria acessos.
- Se deixar **Confirm email** ligado, cada pessoa precisa confirmar o e-mail antes
  do primeiro login.

**Authentication → URL Configuration**

- **Site URL**: o endereço do seu site no Netlify (ex.: `https://alinho.netlify.app`).
- **Redirect URLs**: inclua o mesmo endereço — é para onde volta o link de
  "esqueci minha senha".

## 4. Variáveis do build

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

## 5. Conferir se ficou seguro

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

Teste prático, com dois navegadores: entre como vendedor em um e como admin no
outro. O vendedor não deve ver o item **Financeiro** no menu — e, se digitar
`/financeiro` na barra de endereços, volta para a visão geral. O banco recusaria
os dados de qualquer forma.

## O que cada papel enxerga

| | Admin | Gerente | Vendedor |
| --- | --- | --- | --- |
| Leads, empresas, atividades | Tudo da empresa | Os seus e os da equipe | Apenas os seus |
| Distribuir leads | Sim | Dentro da equipe | Não |
| Painel de equipe | Toda a empresa | Sua equipe | Não vê |
| Financeiro | Sim | Não | Não |
| Etapas, origens, listas | Edita | Usa | Usa |
| Backup | Exporta e importa | Exporta | Não |

Leads **sem responsável** ficam visíveis para todos da organização — é o que
permite distribuí-los. Assim que alguém assume, a visibilidade segue a regra do papel.
