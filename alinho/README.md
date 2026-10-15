# ALINHO

**Nenhuma oportunidade esquecida.**

CRM pessoal para organizar clientes, acompanhar oportunidades e não esquecer nenhum contato.
Aplicação estática (React + TypeScript + Vite + Tailwind), sem back-end, sem login e sem
serviços externos: todos os dados ficam no banco local do navegador (IndexedDB).

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

## Estrutura

```
src/
  components/   componentes reutilizáveis (ui/, charts/, layout/, leads/, …)
  pages/        uma página por rota
  models/       tipos do domínio, padrões e normalização/validação
  db/           esquema do IndexedDB, migrações e abstração de armazenamento
  repositories/ contratos de persistência + implementação local
  services/     regras de negócio (métricas, relatórios, backup, CSV, demonstração)
  hooks/        tema, media queries, debounce
  state/        provedor de dados da aplicação
  utils/        formatação brasileira, datas, links seguros, CSV
  design/       logotipo e identidade
```

Nenhum componente React conversa diretamente com o IndexedDB: tudo passa por
`repositories/`. Para migrar para Supabase no futuro, basta implementar a interface
`Repositories` (`src/repositories/types.ts`) e trocar a implementação exportada em
`src/repositories/index.ts` — as páginas continuam iguais.

## Dados, privacidade e backup

- Os registros ficam **apenas neste navegador, neste dispositivo**. Não há servidor,
  conta, sincronização automática nem proteção por senha.
- A única informação guardada fora do banco local é a preferência de tema (localStorage).
- Não há analytics, rastreadores ou chamadas a serviços externos. As fontes são
  empacotadas junto com o aplicativo.
- **Faça backups.** Em *Configurações → Backup e portabilidade* você exporta um JSON
  completo (leads, empresas, oportunidades, atividades, histórico, configurações e os
  vínculos entre eles) e importa de volta, com validação e confirmação antes de substituir.
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

npm run build && npm run preview   # em um terminal
npm run test:e2e                   # em outro: testes de navegador (Playwright)
```

Os testes de navegador usam o **Playwright**, que não é dependência do projeto — instale-o
globalmente (`npm i -g playwright`) ou rode os roteiros de `e2e/` com um Playwright já
disponível no ambiente. Eles exercitam o build de produção de verdade: cadastro, edição e
exclusão de leads, empresas, funil (arrastar e soltar e seletor de etapa), atividades,
histórico, backup JSON (exportação, importação e rejeição de arquivo inválido), importação
CSV, filtros, links de contato, layout de 320 px a desktop, contraste, navegação por
teclado, uso offline e o comportamento quando o navegador bloqueia o armazenamento.
