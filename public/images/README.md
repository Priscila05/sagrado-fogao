# Imagens do site

**Status: nenhum arquivo de imagem existe neste repositório.** As 28 fotos
listadas abaixo são referenciadas por 90 pontos do site e precisam ser
colocadas nesta pasta (`public/images/`) antes da publicação.

Enquanto os arquivos não existirem, cada espaço mostra uma textura quente da
própria paleta da marca, sem ícone de imagem quebrada e sem alterar o layout —
mas o site **não deve ir ao ar assim**: a direção visual depende das fotos.

## Como preparar os arquivos

1. Gere ou selecione as fotos seguindo `_interno/Prompts de imagem.md`, que traz
   o bloco de estilo e o briefing de cada cena.
2. Exporte em **JPEG, qualidade 78–82**, com no máximo **2000 px no lado maior**
   (as fotos nunca são exibidas acima de ~1440 px de largura). Alvo: **200–350 KB
   por arquivo**. O site inteiro deve ficar abaixo de ~8 MB de imagens.
3. Salve com exatamente o nome da tabela, em minúsculas, nesta pasta.
4. Opcional, mas recomendado: gere também a versão `.webp` de cada arquivo
   (30–40 % menor). Para usá-las é preciso trocar `<img>` por `<picture>` nas
   páginas — peça e isso é feito em uma passada.

## Verificação rápida

Depois de copiar os arquivos, rode na raiz do repositório:

```sh
cd public && grep -oh 'src="images/[^"]*"' *.html | sed 's|src="images/||;s|"$||' \
  | sort -u | while read f; do [ -f "images/$f" ] || echo "FALTANDO: $f"; done
```

Nenhuma saída significa que todas as imagens estão no lugar.

## Inventário

`Usos` = quantas vezes o arquivo aparece no site. `Descrição esperada` reúne os
textos alternativos já escritos para cada aparição — é o que a foto precisa
mostrar.

| Arquivo | Usos | Páginas | Descrição esperada |
|---|---|---|---|
| `arroz-de-pato.jpg` | 3 | Home, O Sagrado, Galeria | Arroz de pato caldoso com farofa crocante e ervas frescas / Panela de ferro com arroz caldoso e colher de madeira / Arroz de pato em panela de ferro |
| `arroz-dourado.jpg` | 3 | Home, O Sagrado, Experiência | Preparo na cozinha: mãos, vapor e luz lateral / Mãos do chef temperando um prato / Prato principal recém-servido, com vapor subindo |
| `banquete-fogo.jpg` | 4 | Home, O Sagrado, Cardápio, Galeria | Prato sendo servido à mesa, com o movimento da mão do garçom / Lenha acesa no forno da cozinha, com chamas baixas iluminando o rosto do cozinheiro / Mesa vista de cima com vários pratos para compartilhar e mãos servindo / Grupo de amigos rindo à mesa |
| `camaroes.jpg` | 3 | Home, Experiência, Galeria | Detalhe de uma mesa posta / Garçom apresentando o prato à mesa / Pratos saindo da cozinha |
| `cheesecake-cafe.jpg` | 1 | Home | Sobremesa servida |
| `cheesecake.jpg` | 2 | Experiência, Galeria | Varanda com plantas e mesa para dois / Casal à mesa, à luz de vela |
| `chef-brasa.jpg` | 4 | Home, O Sagrado, Experiência, Galeria | Prato sendo finalizado junto à brasa, cozinha escura ao fundo e luz quente lateral / Retrato do chef junto ao forno a lenha / Cozinha aberta em pleno serviço, com fogo e cozinheiros em movimento / Chef empratando |
| `coquetel-citrico.jpg` | 3 | Home, Experiência, Galeria | Bar do restaurante: balcão de pedra e garrafas / Bartender preparando um coquetel no balcão / Brinde em mesa longa |
| `coquetel-maracuja.jpg` | 5 | Home, Cardápio, Experiência, Galeria | Detalhe arquitetônico em tijolo e ferro, com sombra marcada / Drink no balcão do bar / Coquetel âmbar com fumaça sobre balcão escuro / Copo com gelo e casca de limão-cravo / Balcão de pedra do bar |
| `costela-por-do-sol.jpg` | 1 | Galeria | Fachada do restaurante à noite |
| `costela.jpg` | 4 | Home, O Sagrado, Cardápio, Galeria | Costela na brasa com purê de mandioca defumada e cebola tostada / Brasa em close, com a textura das cinzas e o brilho laranja do carvão / Costela na brasa servida em prato de cerâmica escura, com luz lateral / Costela na brasa, com luz lateral |
| `file-grelhado.jpg` | 1 | Home | Mesa para dois à luz de vela |
| `file-molho.jpg` | 1 | O Sagrado | Garçom servindo vinho a uma mesa de amigos |
| `fondant.jpg` | 1 | Home | Fachada do restaurante à noite |
| `mesa-petiscos.jpg` | 4 | Home, O Sagrado, Experiência, Galeria | Mesa preparada com linho cru, cerâmica e luz de vela / Ingredientes sobre a bancada: mandioca, pimentas e ervas / Entradas para compartilhar vistas de cima / Mesa posta com linho e cerâmica |
| `nhoque.jpg` | 2 | Home, Galeria | Nhoque de mandioquinha com manteiga de ervas e castanhas tostadas / Nhoque de mandioquinha |
| `peixe-do-dia.jpg` | 3 | Home, O Sagrado, Galeria | Peixe do dia grelhado com arroz de coco e banana-da-terra / Empratamento: mãos finalizando o prato com ervas frescas / Peixe do dia com arroz de coco |
| `peixe-risoto.jpg` | 3 | Home, O Sagrado, Galeria | A cozinha vista do salão / Queijo curado cortado em lascas / Ingredientes sobre a bancada |
| `polvo-grelha.jpg` | 3 | Home, Cardápio, Galeria | Retrato do chef Rafael Monteiro na cozinha, em luz natural / Polvo na grelha sobre brasa viva / Forno a lenha aceso |
| `polvo-lareira.jpg` | 2 | Home, Galeria | Brasa viva e lenha, com fumaça discreta na cozinha aberta / Brasa viva em close |
| `polvo-por-do-sol.jpg` | 1 | Home | Brasa e grelha em funcionamento |
| `pudim-tapioca.jpg` | 3 | Home, Cardápio, Galeria | Ingredientes sobre a bancada: mandioca e ervas / Pudim de tapioca com calda escura de rapadura / Pudim de tapioca com calda de rapadura |
| `risoto-camarao.jpg` | 2 | Home, Galeria | Prato visto de cima / Coquetel âmbar com fio de fumaça |
| `salao.jpg` | 5 | Home, O Sagrado, Experiência, Galeria, Contato | Salão principal ao anoitecer, com luz baixa, madeira clara e linho / Fachada do restaurante ao entardecer, com portas abertas e luz quente vinda de dentro / Salão cheio à noite, com mesas iluminadas e a cozinha aberta ao fundo / Salão principal à noite / Fachada na Rua Harmonia, com portas abertas e luz quente à noite |
| `salmao-lareira.jpg` | 2 | Home, Galeria | Fogo na cozinha aberta: chamas baixas e panelas de ferro / Detalhe arquitetônico em tijolo e ferro |
| `salmao-salao.jpg` | 1 | Experiência | Salão em plano aberto, com pé-direito alto e luminárias pendentes |
| `salmao.jpg` | 1 | O Sagrado | Peixe fresco sobre o gelo |
| `sobremesa-faisca.jpg` | 2 | Experiência, Galeria | Brinde em mesa longa, em uma celebração à luz de vela / Sobremesa com vela de aniversário |

## Atenção: incoerências a resolver

Vários arquivos são reaproveitados em contextos muito diferentes. Isso veio da
exportação do Claude Design e **os caminhos foram preservados exatamente como
estavam**, mas o conteúdo precisa de uma decisão sua:

- `banquete-fogo.jpg` aparece como *prato sendo servido*, *lenha acesa no forno*,
  *mesa vista de cima* e *grupo de amigos rindo à mesa*.
- `chef-brasa.jpg` aparece como *prato junto à brasa* (hero da Home), *retrato do
  chef*, *cozinha aberta em serviço* e *chef empratando*.
- `cheesecake.jpg` aparece como *varanda com plantas* e *casal à mesa*.
- `coquetel-maracuja.jpg` aparece como *detalhe arquitetônico*, *balcão do bar*,
  *copo com limão-cravo* e *coquetel âmbar*.
- `peixe-risoto.jpg` aparece como *cozinha vista do salão*, *queijo curado* e
  *ingredientes sobre a bancada*.
- `salmao-lareira.jpg` aparece como *fogo na cozinha aberta* e *detalhe
  arquitetônico em tijolo e ferro*.
- `costela.jpg` aparece como *costela na brasa* e *brasa em close* (O Sagrado).
- `polvo-grelha.jpg` aparece como *retrato do chef* (Home), *polvo na grelha* e
  *forno a lenha*.

Há dois caminhos:

1. **Produzir uma foto específica para cada aparição.** Melhor resultado. Exige
   renomear os `src` nas páginas — tarefa rápida, é só pedir.
2. **Escolher, para cada arquivo, a cena que ele realmente mostra** e ajustar os
   textos alternativos das outras aparições para descreverem a mesma foto.

Enquanto isso não for resolvido, o texto alternativo descreve algo diferente da
foto exibida em parte dos casos — o que prejudica acessibilidade e SEO de imagem.

## Imagem de compartilhamento

`public/assets/og/sagrado-fogao.png` (1200×630) é tipográfica, feita com a
identidade do projeto, e já funciona. Se quiser trocá-la por uma foto do
restaurante depois, mantenha o mesmo caminho e as mesmas dimensões.
