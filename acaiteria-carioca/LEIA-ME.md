# Prévia — Açaiteria Carioca

Site estático feito a partir do modelo da Monter (`site-base/`, da Bromélia), adaptado para
açaiteria: identidade roxo + amarelo da fachada, cardápio de açaí, a seção **Monte seu açaí**
(que manda o pedido pronto pro WhatsApp) e o botão **Fazer pedido** apontando pro Goomer da loja.

## Como subir no Netlify

Arraste `acaiteria-carioca-site.zip` (ou esta pasta) na aba **Deploys** do Netlify. Não tem build:
é HTML, CSS, JS e SVG. Todas as páginas já vão com `<meta name="robots" content="noindex">`,
e o `netlify.toml` repete isso no cabeçalho `X-Robots-Tag` — tirar os dois quando o site for ao ar de verdade.

## Páginas

| Página | Arquivo | O que tem |
| --- | --- | --- |
| Início | `index.html` | Topo, complementos ilimitados, campeões da casa, chamada do Monte, avaliação do Google, mapa e horários |
| Cardápio | `cardapio/index.html` | Açaí e cupuaçu, complementos, vitaminas, sucos e chás, sorvetes, bebidas |
| Monte seu açaí | `monte/index.html` | Tamanho → base → complementos → entrega → resumo, e o botão que abre o WhatsApp |
| Contato | `contato/index.html` | Endereço, horários, telefone, mapa e formulário (também vai pro WhatsApp) |

## Onde trocar os dados

- **`assets/js/dados.js`** — bloco `window.LOJA` no topo: nome, endereço, WhatsApp, telefone,
  Instagram, link do Goomer, horários, cor de destaque e a flag `previa` (selo "Prévia · Monter").
  O resto do arquivo é o motor que aplica isso em todas as páginas.
- **`assets/js/monte.js`** — bloco `window.MONTE` no topo: tamanhos e preços, bases e a lista de
  complementos por grupo.
- **Preços do cardápio** ficam escritos nas páginas (`cardapio/index.html`), no padrão
  nome à esquerda, preço à direita, descrição embaixo.

## Precisa confirmar com a loja antes de mandar

1. **Preços e itens.** O cardápio do Goomer não abriu daqui (bloqueado pela rede desta máquina),
   então os valores do cardápio e do Monte são **exemplos coerentes com a faixa de preço do Google
   (R$ 1–20 por pessoa)**. Trocar pelos reais antes de apresentar.
2. **Horários.** Só é público que fecha às 20h. Está publicado "todos os dias, 12h às 20h" —
   confirmar a semana inteira.
3. **Instagram.** Fica escondido enquanto `instagram` estiver vazio em `dados.js`. O perfil
   @acaiteriacariocaoficial é de uma loja em Madureira (RJ); não entrou no site.
4. **Fotos.** O site está todo em ilustração (SVG) feita para esta prévia — nada de foto de banco
   de imagem nem foto de terceiros. Quando a loja mandar as fotos dela, dá para trocar as
   ilustrações por imagens nos mesmos lugares (`assets/img/`).
5. **Avaliações.** Está no ar só o depoimento real da Eliete Santos (Google) e o número de
   avaliações. A nota não aparece.

## Itens que vieram de fonte real

- Endereço, telefone e faixa de preço: ficha do Google da loja.
- "Complementos ilimitados / monte do seu jeito" e os sabores: descrição da própria loja e os posts.
- Suco detox, suco bomba, chá termogênico, chá seca barriga e vitamina de açaí: quadro da fachada.
