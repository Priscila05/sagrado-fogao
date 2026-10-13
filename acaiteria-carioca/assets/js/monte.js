/* ==========================================================================
   MONTE SEU AÇAÍ — escolhe tamanho, base e complementos e manda o pedido
   pronto para o WhatsApp da loja.
   Para mudar tamanhos, preços ou complementos, mexa só no bloco abaixo.
   ========================================================================== */
window.MONTE = {
  tamanhos: [
    { nome: '300 ml', preco: 12 },
    { nome: '400 ml', preco: 16 },
    { nome: '500 ml', preco: 19, destaque: 'Mais pedido' },
    { nome: '700 ml', preco: 25 },
    { nome: '1 litro', preco: 35, destaque: 'Para dividir' }
  ],
  bases: [
    { nome: 'Açaí tradicional', desc: 'Cremoso, batido na hora' },
    { nome: 'Açaí com banana', desc: 'Mais doce e encorpado' },
    { nome: 'Cupuaçu', desc: 'Azedinho e refrescante' },
    { nome: 'Meio a meio', desc: 'Metade açaí, metade cupuaçu' },
    { nome: 'Sorvete', desc: 'Sabor do dia da loja' }
  ],
  complementos: [
    { grupo: 'Frutas', itens: ['Banana', 'Morango', 'Kiwi', 'Uva', 'Manga', 'Abacaxi'] },
    { grupo: 'Guloseimas', itens: ['Granola', 'Leite em pó', 'Paçoca', 'Bis', 'Ovomaltine', 'Confete', 'Amendoim', 'Jujuba'] },
    { grupo: 'Coberturas', itens: ['Leite condensado', 'Chocolate', 'Creme de avelã', 'Calda de morango', 'Mel', 'Caramelo'] }
  ],
  pagamentos: ['Pix', 'Cartão', 'Dinheiro']
};

(function () {
  'use strict';
  var app = document.querySelector('[data-monte]');
  if (!app) return;

  var M = window.MONTE;
  var ETAPAS = ['Tamanho', 'Base', 'Complementos', 'Entrega', 'Resumo'];

  var S = {
    passo: 1,
    tamanho: null,
    base: null,
    extras: [],
    entrega: 'Retirada na loja',
    f: { nome: '', telefone: '', endereco: '', pagamento: '', obs: '' }
  };

  var acoes = [];
  function acao(fn) { acoes.push(fn); return acoes.length - 1; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function reais(v) { return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/,00$/, ''); }
  function total() { return S.tamanho ? S.tamanho.preco : 0; }

  function ir(passo, rolar) {
    S.passo = passo;
    desenhar(true);
    if (rolar !== false) {
      var topo = app.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
    }
  }

  function trilha() {
    var feitos = [!!S.tamanho, !!S.base, S.extras.length > 0 || S.passo > 3, !!S.f.nome, false];
    return '<ol class="trilha" aria-label="Etapas do pedido">' + ETAPAS.map(function (rotulo, i) {
      var n = i + 1;
      var liberado = n === 1 || feitos.slice(0, n - 1).every(Boolean);
      var classe = n === S.passo ? 'agora' : (n < S.passo ? 'feito' : '');
      var a = acao(function () { if (liberado) ir(n); });
      return '<li class="' + classe + '"><button type="button" data-a="' + a + '"' +
        (liberado ? '' : ' disabled') + (n === S.passo ? ' aria-current="step"' : '') +
        '><span class="rot">' + rotulo + '</span></button></li>';
    }).join('') + '</ol><p class="trilha-atual">' + ETAPAS[S.passo - 1] + '</p>';
  }

  function passo1() {
    var html = '<h2>Qual o tamanho do copo?</h2>' +
      '<p class="item-desc">Todos vêm com complementos à vontade, sem custo a mais.</p>' +
      '<div class="opcoes" role="radiogroup" aria-label="Tamanho do copo">';
    M.tamanhos.forEach(function (t) {
      var sel = S.tamanho && S.tamanho.nome === t.nome;
      var a = acao(function () { S.tamanho = t; ir(2); });
      html += '<button type="button" class="opcao" role="radio" aria-checked="' + !!sel + '" data-a="' + a + '">' +
        '<b>' + esc(t.nome) + '</b><small>' + reais(t.preco) + (t.destaque ? ' · ' + esc(t.destaque) : '') + '</small></button>';
    });
    return html + '</div>';
  }

  function passo2() {
    var html = '<h2>Qual a base?</h2>' +
      '<p class="item-desc">É o creme que vai no copo antes dos complementos.</p>' +
      '<div class="opcoes" role="radiogroup" aria-label="Base do copo">';
    M.bases.forEach(function (b) {
      var sel = S.base === b.nome;
      var a = acao(function () { S.base = b.nome; ir(3); });
      html += '<button type="button" class="opcao" role="radio" aria-checked="' + sel + '" data-a="' + a + '">' +
        '<b>' + esc(b.nome) + '</b><small>' + esc(b.desc) + '</small></button>';
    });
    return html + '</div>';
  }

  function passo3() {
    var html = '<h2>Escolha os complementos</h2>' +
      '<p class="item-desc">Pode marcar quantos quiser: na Carioca os complementos são ilimitados e não mudam o preço.</p>';
    M.complementos.forEach(function (g) {
      html += '<div class="grupo-compl"><p class="rotulo">' + esc(g.grupo) + '</p><div class="fichas">';
      g.itens.forEach(function (item) {
        var on = S.extras.indexOf(item) > -1;
        var a = acao(function () {
          if (on) S.extras = S.extras.filter(function (x) { return x !== item; });
          else S.extras = S.extras.concat([item]);
          desenhar(false, item);
        });
        html += '<button type="button" class="ficha" aria-pressed="' + on + '" data-ficha="' + esc(item) + '" data-a="' + a + '">' + esc(item) + '</button>';
      });
      html += '</div></div>';
    });
    var seguir = acao(function () { ir(4); });
    return html + '<div class="botoes" style="margin-top:32px">' +
      '<button type="button" class="btn btn--roxo" data-a="' + seguir + '">Continuar <span aria-hidden="true">→</span></button></div>';
  }

  function passo4() {
    var f = S.f;
    var opcoesEntrega = ['Retirada na loja', 'Entrega (delivery)'].map(function (op) {
      var sel = S.entrega === op;
      var a = acao(function () { S.entrega = op; desenhar(false, null, '[data-entrega="' + op + '"]'); });
      return '<button type="button" class="opcao" role="radio" aria-checked="' + sel + '" data-entrega="' + esc(op) + '" data-a="' + a + '">' +
        '<b>' + esc(op) + '</b><small>' + (op === 'Retirada na loja' ? 'Você busca na R. Zike Tuma, 751' : 'Combinamos a taxa pelo WhatsApp') + '</small></button>';
    }).join('');

    var pagamentos = '<option value="">Escolher depois</option>' + M.pagamentos.map(function (p) {
      return '<option' + (f.pagamento === p ? ' selected' : '') + '>' + esc(p) + '</option>';
    }).join('');

    var seguir = acao(function () {
      var form = app.querySelector('[data-monte-form]');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      ir(5);
    });

    return '<h2>Como você quer receber?</h2>' +
      '<p class="item-desc">Esses dados vão junto na mensagem do WhatsApp.</p>' +
      '<form data-monte-form novalidate>' +
      '<div class="opcoes" role="radiogroup" aria-label="Forma de entrega" style="margin-bottom:28px">' + opcoesEntrega + '</div>' +
      '<div class="formulario">' +
      '<label class="campo"><span>Seu nome</span><input class="campo-monte" name="nome" type="text" required autocomplete="name" value="' + esc(f.nome) + '"></label>' +
      '<label class="campo"><span>Telefone</span><input class="campo-monte" name="telefone" type="tel" autocomplete="tel" placeholder="(11) 90000-0000" value="' + esc(f.telefone) + '"></label>' +
      (S.entrega === 'Entrega (delivery)'
        ? '<label class="campo largo"><span>Endereço de entrega</span><input class="campo-monte" name="endereco" type="text" required autocomplete="street-address" placeholder="Rua, número, complemento e bairro" value="' + esc(f.endereco) + '"></label>'
        : '') +
      '<label class="campo"><span>Pagamento</span><select class="campo-monte" name="pagamento">' + pagamentos + '</select></label>' +
      '<label class="campo largo"><span>Observações</span><textarea class="campo-monte" name="obs" rows="3" placeholder="Sem granola, caprichar no morango, copo separado…">' + esc(f.obs) + '</textarea></label>' +
      '</div>' +
      '<div class="botoes" style="margin-top:28px">' +
      '<button type="button" class="btn btn--roxo" data-a="' + seguir + '">Ver resumo <span aria-hidden="true">→</span></button></div></form>';
  }

  function mensagem() {
    var f = S.f;
    var linhas = ['Olá! Quero montar meu açaí na ' + ((window.LOJA || {}).nome || 'loja') + ':', ''];
    linhas.push('*Tamanho:* ' + S.tamanho.nome + ' (' + reais(S.tamanho.preco) + ')');
    linhas.push('*Base:* ' + S.base);
    linhas.push('*Complementos:* ' + (S.extras.length ? S.extras.join(', ') : 'sem complementos'));
    linhas.push('*Entrega:* ' + S.entrega);
    if (f.nome) linhas.push('*Nome:* ' + f.nome);
    if (f.telefone) linhas.push('*Telefone:* ' + f.telefone);
    if (S.entrega === 'Entrega (delivery)' && f.endereco) linhas.push('*Endereço:* ' + f.endereco);
    if (f.pagamento) linhas.push('*Pagamento:* ' + f.pagamento);
    if (f.obs) linhas.push('*Observações:* ' + f.obs);
    linhas.push('', '*Total do copo:* ' + reais(total()));
    if (S.entrega === 'Entrega (delivery)') linhas.push('(Combinar a taxa de entrega)');
    return linhas.join('\n');
  }

  function passo5() {
    var f = S.f;
    var linhas = [
      ['Tamanho', S.tamanho.nome + ' · ' + reais(S.tamanho.preco), 1],
      ['Base', S.base, 2],
      ['Complementos', S.extras.length ? S.extras.join(', ') : 'Sem complementos', 3],
      ['Entrega', S.entrega, 4],
      ['Nome', f.nome, 4]
    ];
    if (f.telefone) linhas.push(['Telefone', f.telefone, 4]);
    if (S.entrega === 'Entrega (delivery)' && f.endereco) linhas.push(['Endereço', f.endereco, 4]);
    if (f.pagamento) linhas.push(['Pagamento', f.pagamento, 4]);
    if (f.obs) linhas.push(['Observações', f.obs, 4]);

    var html = '<h2>Confira seu pedido</h2>' +
      '<p class="item-desc">Está tudo certo? O botão abre o WhatsApp da loja com essa mensagem pronta.</p>' +
      '<ul class="lista" style="margin-top:28px">';
    linhas.forEach(function (l) {
      var a = acao(function () { ir(l[2]); });
      html += '<li><div class="item-topo"><h3>' + esc(l[0]) + '</h3>' +
        '<button type="button" class="item-preco" data-a="' + a + '" aria-label="Alterar ' + esc(l[0].toLowerCase()) +
        '" style="background:none;border:0;cursor:pointer;color:var(--roxo-600);font-size:14px;text-decoration:underline;text-underline-offset:4px">Alterar</button></div>' +
        '<p class="item-desc">' + esc(l[1]) + '</p></li>';
    });
    html += '</ul>';

    var enviar = acao(function () { window.acAbrirWhatsApp(mensagem()); });
    return html +
      '<div class="botoes" style="margin-top:32px">' +
      '<button type="button" class="btn btn--amarelo" data-a="' + enviar + '">Enviar pedido no WhatsApp <span aria-hidden="true">→</span></button>' +
      '<a class="btn btn--linha-roxo" data-goomer href="https://acaiteria-carioca.goomer.app/">Pedir pelo delivery</a></div>' +
      '<p class="item-desc" style="margin-top:18px">O valor final é confirmado pela loja na conversa.</p>';
  }

  function resumo() {
    var linhas = [
      ['Tamanho', S.tamanho ? S.tamanho.nome : 'a escolher'],
      ['Base', S.base || 'a escolher'],
      ['Complementos', S.extras.length ? S.extras.join(', ') : 'nenhum ainda'],
      ['Entrega', S.entrega]
    ];
    return '<aside class="resumo-caixa" aria-live="polite">' +
      '<h2>Seu copo</h2>' +
      '<ul class="resumo-lista">' + linhas.map(function (l) {
        return '<li><span>' + l[0] + '</span><span>' + esc(l[1]) + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="resumo-total"><span>Total</span><span>' + (S.tamanho ? reais(total()) : '—') + '</span></div>' +
      '<p class="resumo-nota">Complementos ilimitados, sem custo adicional. A taxa de entrega, quando houver, é combinada no WhatsApp.</p>' +
      '</aside>';
  }

  function desenhar(focar, fichaFoco, seletorFoco) {
    acoes = [];
    var corpo = [passo1, passo2, passo3, passo4, passo5][S.passo - 1]();
    var voltar = '';
    if (S.passo > 1) {
      var a = acao(function () { ir(S.passo - 1, false); });
      voltar = '<button type="button" class="voltar" data-a="' + a + '">← Voltar</button>';
    }
    app.innerHTML = '<div class="monte-passos">' + trilha() +
      '<div class="passo" data-passo tabindex="-1">' + corpo + '</div>' + voltar + '</div>' + resumo();

    if (fichaFoco) {
      var f = app.querySelector('[data-ficha="' + fichaFoco.replace(/"/g, '\\"') + '"]');
      if (f) f.focus({ preventScroll: true });
    } else if (seletorFoco) {
      var s = app.querySelector(seletorFoco);
      if (s) s.focus({ preventScroll: true });
    } else if (focar) {
      var t = app.querySelector('[data-passo] h2');
      if (t) { t.tabIndex = -1; t.style.outline = 'none'; t.focus({ preventScroll: true }); }
    }
  }

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    var fn = acoes[+b.getAttribute('data-a')];
    if (fn) fn();
  });
  function guardar(e) {
    if (e.target.classList && e.target.classList.contains('campo-monte')) S.f[e.target.name] = e.target.value;
  }
  app.addEventListener('input', guardar);
  app.addEventListener('change', guardar);

  desenhar(false);
})();
