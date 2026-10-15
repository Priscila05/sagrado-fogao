# ALINHO

**Nenhuma oportunidade esquecida.**

CRM para organizar clientes, acompanhar oportunidades e não esquecer nenhum contato —
com módulo de **controle financeiro** (contratos, recebimentos e despesas) e **versão
multiusuário** opcional, com login individual e permissões por papel.
Aplicação estática (React + TypeScript + Vite + Tailwind), publicada no Netlify.

Funciona em **dois modos**, decididos pelas variáveis de ambiente do build:

| | Modo local | Modo equipe |
| --- | --- | --- |
| Quando | Sem `VITE_SUPABASE_*` | Com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Login | Não existe | Individual, pelo Supabase Auth |
| Dados | IndexedDB, só neste navegador | Banco compartilhado no Supabase, com RLS |
| Papéis | Uma pessoa, dona de tudo | Administrador, gerente e vendedor |
| Financeiro | Disponível | Exclusivo do administrador |

O modo local é exatamente o ALINHO de sempre: ninguém que já usa precisa mudar nada, e os
dados do navegador continuam intactos mesmo depois que a versão multiusuário é publicada.

---

## Como publicar no Netlify (upload manual)

1. Gere o build e o pacote:
   ```bash
   npm install
   npm run build
   npm run package
   ```
2. Abra [app.netlify.com/drop](https://app.netlify.com/drop) (ou, em um site existente,
   *Deploys → Deploy manually*).
3. Arraste **`dist-zip/alinho-netlify.zip`** para a área de upload — ou arraste a **pasta `dist`**
   inteira, que funciona do mesmo jeito.
4. Pronto. O arquivo `_redirects` já vai no pacote e faz o Netlify devolver o `index.html` em
   qualquer rota, então endereços como `/leads/<id>` funcionam ao recarregar a página.

> O ZIP tem o `index.html` na raiz do arquivo (não dentro de uma subpasta), que é o formato
> aceito pelo Netlify. O script `npm run package` falha se isso não for verdade.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite). |
| `npm run build` | Verificação de tipos + build de produção em `dist/`. |
| `npm run preview` | Serve o build de produção localmente. |
| `npm test` | Testes automatizados (Vitest). |
| `npm run package` | Gera `dist-zip/alinho-netlify.zip` e valida o conteúdo. |
| `npm run package:equipe` | O mesmo, mas recusa o pacote se o build não for do modo equipe. |
| `npm run verificar:supabase` | Confere a conexão com o Supabase só com leituras. |
| `npm run test:e2e` | Baterias de navegador (precisa do build servido; veja *Testes*). |

Para publicar no modo equipe, crie um `.env` (modelo em `.env.example`) **antes** do build:
o Vite grava as variáveis no pacote no momento da compilação. O pacote traz um
`build-info.json` dizendo em que modo foi compilado (e o host do Supabase, nunca a chave);
`npm run package:equipe` confere isso no próprio JavaScript publicado antes de gerar o ZIP.
O passo a passo da publicação em equipe, com a conferência de papéis no ar, está em
**[`PUBLICACAO.md`](PUBLICACAO.md)**.

## Versão multiusuário (modo equipe)

Toda a configuração do Supabase está em **[`supabase/README.md`](supabase/README.md)**:
as três migrações SQL, como criar os acessos das pessoas e o que ajustar no painel.

Resumo do que cada papel enxerga:

| | Admin | Gerente | Vendedor |
| --- | --- | --- | --- |
| Leads, empresas, atividades | Tudo da empresa | Os seus e os da equipe | Apenas os seus |
| Distribuir leads | Sim | Dentro da equipe | Não |
| Painel de equipe | Toda a empresa | Sua equipe | Não vê |
| Financeiro | Sim | Não | Não |
| Etapas, origens e listas | Edita | Usa | Usa |
| Backup | Exporta e importa | Exporta | Não |

As regras valem no **banco**, não só na tela: as políticas de RLS do Supabase recusam
qualquer leitura ou escrita fora do alcance do papel, mesmo que alguém chame a API
diretamente. A interface apenas evita oferecer caminhos que o banco negaria.

**Nunca** publique a chave `service_role`: ela ignora o RLS. O aplicativo detecta chaves de
servidor em `VITE_SUPABASE_PUBLISHABLE_KEY`, recusa usá-las e avisa no console.

Quem já usava o modo local pode levar os dados para a empresa em
*Configurações → Enviar dados deste navegador para o Supabase* (só administrador). O envio
usa os mesmos identificadores, então repetir atualiza em vez de duplicar, e o banco local
não é alterado.

## Módulo financeiro

Fica em **Financeiro**, na navegação lateral, com seis seções de URL própria:

| Seção | O que faz |
| --- | --- |
| `/financeiro` | Faturamento contratado, total recebido, a receber, vencidos, despesas, lucro realizado e gráfico mensal. |
| `/financeiro/contratos` | Contratos com cliente do CRM, projeto, valor, data, descrição e situação. A agenda de entrada e parcelas é gerada automaticamente. |
| `/financeiro/pagamentos` | Entrada e parcelas com vencimento, valor recebido, forma de pagamento e situação (pendente, pago, vencido). |
| `/financeiro/despesas` | Descrição, categoria, valor, data, situação e projeto vinculado (opcional). |
| `/financeiro/historico` | Recebimentos e despesas em uma linha única, com filtros por cliente, período e situação, e exportação CSV. |
| `/financeiro/relatorios` | Receitas, despesas, resultado, margem e pagamentos pendentes, com filtro de período e exportação CSV. |

### Como os valores são calculados

- **Faturamento contratado** soma os contratos não cancelados — é o que foi vendido, não o que entrou.
- **Total recebido** soma apenas o valor efetivamente recebido das parcelas quitadas.
  Parcela pendente **nunca** entra em receita: o campo de valor recebido é zerado enquanto
  a parcela não é confirmada.
- **Vencido** é derivado da data a cada exibição, nunca gravado — não existe parcela
  "vencida" desatualizada no banco.
- **Lucro realizado** = total recebido − despesas **pagas**. Despesa marcada como
  "prevista" não afeta o lucro até ser paga.
- **Sem duplicidade ao editar:** cada parcela é identificada pela posição na agenda do
  contrato. Salvar o mesmo contrato de novo reconcilia a agenda em vez de recriá-la —
  parcelas já pagas ficam intactas, as em aberto são recalculadas para cobrir o que falta
  receber, e sobras deixam de existir sem apagar nada que já foi recebido.
- Os indicadores são recalculados a partir dos lançamentos a cada alteração.

## Estrutura

```
src/
  components/   componentes reutilizáveis (ui/, charts/, layout/, leads/, …)
  pages/        uma página por rota
  models/       tipos do domínio, padrões e normalização/validação
  db/           esquema do IndexedDB, migrações e abstração de armazenamento
  repositories/ contratos de persistência + implementação local
  services/     regras de negócio (métricas, relatórios, financeiro, backup, CSV, demonstração)
  hooks/        tema, media queries, debounce
  state/        provedor de dados da aplicação
  utils/        formatação brasileira, datas, links seguros, CSV
  design/       logotipo e identidade
  auth/         papéis, permissões e sessão do Supabase
  lib/          cliente do Supabase
supabase/
  migrations/   SQL para criar o banco da empresa, com RLS
  README.md     passo a passo da configuração no Supabase
```

Nenhum componente React conversa diretamente com o banco: tudo passa por `repositories/`.
É exatamente essa camada que permitiu acrescentar o Supabase sem reescrever as telas —
`repositories/local.ts` (IndexedDB) e `repositories/supabase.ts` cumprem a mesma interface
(`src/repositories/types.ts`), e `src/repositories/index.ts` troca a implementação ativa
quando a sessão muda.

## Dados, privacidade e backup

- Os registros ficam **apenas neste navegador, neste dispositivo**. Não há servidor,
  conta, sincronização automática nem proteção por senha.
- A única informação guardada fora do banco local é a preferência de tema (localStorage).
- Não há analytics, rastreadores ou chamadas a serviços externos. As fontes são
  empacotadas junto com o aplicativo.
- **Faça backups.** Em *Configurações → Backup e portabilidade* você exporta um JSON
  completo (leads, empresas, oportunidades, atividades, histórico, contratos, pagamentos,
  despesas, configurações e os vínculos entre eles) e importa de volta, com validação e
  confirmação antes de substituir.
- O formato do backup está na **versão 2**. Backups da versão 1 (anteriores ao módulo
  financeiro) continuam sendo importados normalmente: o CRM é restaurado e o financeiro
  começa vazio, com um aviso explicando isso. Bancos locais da versão 1 também migram
  sozinhos para a versão 2 ao abrir o aplicativo, sem perder dados.
- Limpar os dados do site, trocar de navegador ou de computador significa começar vazio:
  a transferência é feita por exportação/importação de backup.
- Por essas características, esta versão não é adequada a dados sensíveis nem a
  compartilhamento entre equipes.

## Funcionamento offline

Um service worker guarda os arquivos estáticos do aplicativo na primeira visita, então o
ALINHO abre e funciona sem conexão depois disso (os dados já estão no navegador).
Isso foi testado com a rede desligada. A primeira visita precisa de conexão, e lembretes
só aparecem com o aplicativo aberto — **não há notificação com o navegador fechado**.

## Dados de demonstração

Em *Configurações* é possível carregar um conjunto de demonstração. Ele vive em um
conjunto separado (`dataset: 'demo'`), com nomes marcados com “(demo)” e telefones
fictícios, nunca se mistura aos dados reais e nunca entra nos backups.

## Testes

```bash
npm test                       # testes unitários e de integração (Vitest + fake-indexeddb)
```

As baterias de navegador precisam de **dois builds servidos ao mesmo tempo**: as de `01` a
`09` rodam contra o modo local na porta 4280, e a `10` contra um build em modo equipe na
porta 4281, apontando para um projeto que não existe (é assim que o portão de login e as
mensagens de erro são testados sem depender de um Supabase real).

```bash
# 1. Modo local em dist/, servido na 4280.
#    Se você tem um .env de modo equipe, tire-o de vista antes de compilar.
npm run build
npx vite preview --port 4280 --strictPort &

# 2. Modo equipe de mentira em dist-teste-equipe/, servido na 4281.
#    A chave precisa ser exatamente esta: a bateria 10 confere se o build a embutiu.
VITE_SUPABASE_URL=https://projeto-de-teste.supabase.co \
  VITE_SUPABASE_PUBLISHABLE_KEY=chave-publicavel-de-teste-anon \
  npx vite build --outDir dist-teste-equipe
npx vite preview --outDir dist-teste-equipe --port 4281 --strictPort &

# 3. As baterias, em sequência.
npm run test:e2e
```

Confira o que cada porta está servindo antes de começar — `vite preview --strictPort`
recusa a porta se já houver um servidor nela, e um servidor esquecido de outra rodada
serve o build errado em silêncio:

```bash
curl -s localhost:4280/build-info.json   # deve dizer "mode": "local"
curl -s localhost:4281/build-info.json   # deve dizer "mode": "equipe"
```

Se a 4280 estiver servindo um build em modo equipe, as baterias `01` a `09` encontram a
tela de login em vez do aplicativo e falham em bloco — não é defeito do aplicativo.
Apague também `e2e/.artifacts/profile` quando quiser começar de um navegador limpo: as
baterias partem de um perfil sem dados.

As baterias compartilham **um único perfil do Chromium** (`e2e/.artifacts/profile`) de
propósito: é assim que a persistência "fechar e reabrir o aplicativo" é testada de verdade.
Por isso elas precisam rodar **em sequência** — duas execuções simultâneas disputam o mesmo
perfil e falham sem que haja problema no aplicativo. Também não recompile (`npm run build`)
com os testes em andamento.

Os testes de navegador usam o **Playwright**, que não é dependência do projeto — instale-o
globalmente (`npm i -g playwright`) ou rode os roteiros de `e2e/` com um Playwright já
disponível no ambiente. Eles exercitam o build de produção de verdade: cadastro, edição e
exclusão de leads, empresas, funil (arrastar e soltar e seletor de etapa), atividades,
histórico, backup JSON (exportação, importação e rejeição de arquivo inválido), importação
CSV, filtros, links de contato, layout de 320 px a desktop, contraste, navegação por
teclado, uso offline e o comportamento quando o navegador bloqueia o armazenamento.
As baterias `08` e `09` cobrem o módulo financeiro: geração da agenda de parcelas,
recebimentos, despesas, cálculo de lucro, edição de contrato sem duplicar lançamentos,
histórico, relatórios, backup versão 2, compatibilidade com backups e bancos da versão 1
e layout responsivo das telas financeiras.
