# Sagrado Fogão

Site institucional de um restaurante de cozinha brasileira contemporânea.
Projeto demonstrativo da **Monter Web Studio**.

Site estático, sem build, sem dependências e sem requisições a terceiros
(exceto o mapa incorporado do OpenStreetMap nas páginas Home e Contato).

---

## Estrutura

```
public/                     ← o site publicado (output directory)
  index.html                  Home
  o-sagrado.html              História e filosofia
  cardapio.html               Cardápio completo
  experiencia.html            Ambiente, cozinha, bar, serviço
  galeria.html                Mosaico de fotos com lightbox
  contato.html                Contato, horários e mapa
  reservas.html               Assistente de reserva em 5 etapas
  404.html                    Página de erro
  robots.txt · sitemap.xml · site.webmanifest
  favicon.svg · favicon.ico · apple-touch-icon.png · icon-192.png · icon-512.png
  assets/
    css/site.css              Folha de estilo única
    js/site.js                Comportamento (JavaScript puro)
    fonts/*.woff2             Instrument Serif + Hanken Grotesk auto-hospedadas
    og/sagrado-fogao.png      Imagem de compartilhamento (1200×630)
  images/                     Fotos do restaurante — ver images/README.md

src/claude-design/          ← export original do Claude Design (.dc.html)
_interno/                   ← material de trabalho, não publicado

vercel.json · netlify.toml  ← configuração de deploy
```

`src/claude-design/` guarda o projeto como saiu do Claude Design, com os
arquivos lado a lado para continuar editável naquele ambiente. **Nada dessa
pasta é publicado**: o site em produção é o conteúdo de `public/`.

---

## Rodar localmente

Não há instalação nem build. Qualquer servidor estático serve:

```sh
cd public
python3 -m http.server 8000
# ou: npx http-server -p 8000 -c-1
```

Abra <http://localhost:8000>.

> Abrir os arquivos direto pelo `file://` também funciona, mas o mapa e as
> fontes podem se comportar de forma diferente. Prefira o servidor local.

---

## Publicação

| Item | Valor |
|---|---|
| Build command | *(nenhum)* |
| Output directory | `public` |
| Node / runtime | não é necessário |
| Variáveis de ambiente | nenhuma |

`vercel.json` e `netlify.toml` já trazem o diretório de saída, cabeçalhos de
cache e cabeçalhos de segurança. Em outras hospedagens, aponte a raiz do site
para `public/`.

**Antes de publicar, troque o domínio.** `https://www.sagradofogao.com.br`
aparece nas tags `canonical`, `og:url`, `twitter:image`, no `robots.txt` e no
`sitemap.xml`. Para trocar tudo de uma vez:

```sh
cd public
grep -rl "www.sagradofogao.com.br" . | xargs sed -i 's|www\.sagradofogao\.com\.br|SEU-DOMINIO|g'
```

---

## O que ainda não é real

- **Fotos**: nenhuma imagem existe no repositório. Ver `public/images/README.md`.
- **Formulários**: Contato e Reservas validam os campos e mostram a tela de
  confirmação, mas **não enviam nada**. O ponto de integração é a função
  `sendToBackend`, no fim de `public/assets/js/site.js`.
- **Disponibilidade de horários** na página de Reservas é demonstrativa: alguns
  horários aparecem como esgotados por uma regra fixa no código, não por
  consulta a uma agenda real (`isBusy`, em `site.js`).
- **Endereço, telefones, e-mail, Instagram e depoimentos** são fictícios, como
  convém a um projeto de portfólio.

---

## Manutenção

O cabeçalho e o rodapé são repetidos nas 7 páginas (site estático, sem
template). Ao alterar um deles, aplique a mudança em todas — inclusive em
`404.html`, que usa caminhos absolutos (`/cardapio.html`) por poder ser servido
de qualquer URL.

Estilos de `:hover` e `:focus` ficam em classes utilitárias no topo da seção 5
de `site.css` (`hv-*`, `fc-*`), porque o HTML usa estilos inline herdados do
export do Claude Design.
