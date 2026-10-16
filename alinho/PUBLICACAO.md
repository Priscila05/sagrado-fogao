# Publicar o ALINHO modo equipe

Checklist do pacote `alinho-netlify.zip` compilado em **modo equipe**, ou seja,
com o endereço e a chave publicável do seu projeto do Supabase embutidos.

Confira primeiro, dentro do ZIP, o arquivo `build-info.json`:

```json
{ "mode": "equipe", "supabaseHost": "<o host do seu projeto>.supabase.co" }
```

Se aparecer `"mode": "local"`, é o pacote errado — não publique.

## 1. Subir no Netlify

**Atualizando um site que já existe** (o caso normal, depois da primeira vez):

1. Entre em <https://app.netlify.com> e **abra o site** pelo nome na lista.
2. Vá na aba **Deploys** do próprio site.
3. Arraste o `alinho-netlify.zip` para a faixa de upload no rodapé dessa página.
4. Espere a nova implantação aparecer no topo da lista como **Published**.

Não use **Add new site** para atualizar: esse caminho cria um site **novo**, em um
endereço novo, e deixa o site antigo no ar com o pacote velho. É o erro mais fácil
de cometer aqui — a tela não muda e parece que a publicação não funcionou.

**Criando o site pela primeira vez:**

1. **Add new site** → **Deploy manually** e arraste o `alinho-netlify.zip`.
   O ZIP tem o `index.html` na raiz, como o Netlify exige.
2. Anote o endereço que o Netlify der (ex.: `https://alinho-sua-equipe.netlify.app`).
   Se quiser trocar: **Site configuration → Change site name**.

**Confira sempre o que ficou no ar** abrindo `<endereço>/build-info.json`: ele diz o
modo do pacote publicado e o host do Supabase. Se disser `"mode": "local"` depois de
você subir o pacote de equipe, o arquivo foi para outro site.

Se o `build-info.json` já disser `"mode": "equipe"` mas o navegador insistir na tela
antiga, é cache: recarregue com Ctrl+Shift+R ou, em F12 → **Application** →
**Service Workers**, clique em **Unregister** e recarregue. Não clique em
**Clear site data**: isso apaga o IndexedDB, ou seja, os dados da versão individual
guardados naquele navegador.

O roteamento já vem resolvido: o `_redirects` dentro do pacote manda toda rota
para o `index.html`, então `/leads/123` e `/financeiro` abrem direto e o F5 em
qualquer página funciona. Não precisa configurar nada no painel.

## 2. Apontar o Supabase para esse endereço

Este é o **único passo que depende do endereço final** e, sem ele, o link de
"esqueci minha senha" não volta para o site.

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: o endereço do Netlify, sem barra no fim.
- **Redirect URLs**: adicione o mesmo endereço e também `<endereço>/**`.

Na mesma visita, confirme em **Authentication → Providers → Email**:

- **Email + Password** ligado.
- **Enable sign-ups** **desligado** — só você cria acessos. Se ficar ligado,
  qualquer pessoa cria conta sozinha; ela entraria como `vendedor` e sem leads,
  mas é uma porta que não precisa existir.

## 3. Conferir o login e as permissões no ar

Faça isso em **duas janelas anônimas separadas** (ou dois navegadores): a sessão
fica guardada por navegador, então duas abas normais compartilham o mesmo login.

### Como administrador (sua conta)

| Verificar | Esperado |
| --- | --- |
| Entrar com e-mail e senha | Abre o painel com seu nome no rodapé da lateral |
| Menu lateral | Mostra **Financeiro** e **Equipe** |
| Equipe → trocar o papel de alguém | Grava e a pessoa vê a mudança no próximo login |
| Equipe → tentar rebaixar a si mesmo | Recusa, dizendo que não pode mudar o próprio papel |
| Leads | Vê todos, inclusive os sem responsável |
| Backup → exportar | Baixa o JSON com os dados da empresa |

### Como vendedor (crie um acesso de teste)

| Verificar | Esperado |
| --- | --- |
| Menu lateral | **Financeiro** e **Equipe** não aparecem |
| Abrir `/financeiro` digitando na barra de endereços | Recusa; não mostra valor nenhum |
| Leads | Só os dele; os de outra pessoa não aparecem nem na busca |
| Tentar passar um lead para outra pessoa | Recusado pelo banco |
| Funil e atividades | Funcionam normalmente nos leads dele |

### Como gerente (se for usar)

| Verificar | Esperado |
| --- | --- |
| Leads | Os dele, os da equipe que supervisiona e os sem responsável |
| Leads de outra equipe | Não aparecem |
| Financeiro | Não aparece |
| Distribuir um lead sem responsável | Funciona, para alguém da equipe dele |

A recusa do vendedor no financeiro **não é só a tela escondida**: a política do
banco é que nega. Se quiser ver com os próprios olhos, abra o console do
navegador logado como vendedor e peça os contratos — a resposta volta vazia.

## 4. A versão individual continua existindo

O modo equipe não substituiu a versão de uma pessoa só: é o **mesmo código**,
decidido no momento do build.

- Com as duas variáveis preenchidas → modo equipe, login obrigatório, dados no
  Supabase compartilhado.
- Sem as variáveis → modo local, sem login, dados no IndexedDB do próprio
  navegador, exatamente como antes.

Para gerar o pacote individual outra vez:

```bash
mv .env .env.guardado   # tira as variáveis de vista
npm run build           # build-info.json dirá "mode": "local"
npm run package         # sem --equipe
mv .env.guardado .env
```

Os dados que você já tem na versão individual **continuam no navegador onde
foram digitados** — publicar o modo equipe em outro endereço não os apaga. Para
levá-los para o banco compartilhado: exporte o backup JSON na versão individual
e importe como administrador no modo equipe.

Se publicar o modo equipe **no mesmo endereço** da versão individual, o site
passa a pedir login naquele endereço; os dados antigos continuam guardados no
navegador, mas deixam de aparecer. Exporte o backup **antes** de trocar.

## 5. Se algo der errado

| Sintoma | Causa provável |
| --- | --- |
| Tela de login mesmo sendo a versão individual | Pacote em modo equipe; confira `build-info.json` |
| "Configuração do Supabase incompleta" | O build saiu sem uma das duas variáveis |
| Erro ao entrar com a senha certa | Confirmação de e-mail pendente, ou conta desativada em Equipe |
| Entra mas não vê lead nenhum | Normal para vendedor novo: ninguém distribuiu leads ainda |
| Entra e cai em "Não foi possível abrir seus dados" | Abra **Ver o motivo técnico** na própria tela; para o retrato completo, rode `supabase/diagnostico.sql` no SQL Editor |
| Link de senha volta para `localhost` | Site URL / Redirect URLs ainda não apontam para o Netlify (passo 2) |
| F5 em `/leads` dá 404 | O `_redirects` não subiu junto; refaça o upload do ZIP inteiro |
