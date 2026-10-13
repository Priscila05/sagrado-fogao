/* Açaiteria Carioca — comportamento comum a todas as páginas:
   cabeçalho, menu do celular, revelação ao rolar e formulários (que abrem o WhatsApp). */
(function () {
  'use strict';

  var topo = document.querySelector('[data-topo]');
  var menu = document.getElementById('menu-mob');
  var botao = document.querySelector('[data-menu]');
  var aberto = false, rolou = null;

  function pintar() {
    if (!topo) return;
    topo.classList.toggle('rolou', !!rolou);
    topo.classList.toggle('solido', !!rolou || aberto);
  }

  function abrirMenu(v) {
    if (!menu || !botao) return;
    aberto = v;
    menu.hidden = !v;
    botao.setAttribute('aria-expanded', String(v));
    botao.setAttribute('aria-label', v ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('travado', v);
    pintar();
  }

  if (botao) botao.addEventListener('click', function () { abrirMenu(!aberto); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && aberto) { abrirMenu(false); botao.focus(); }
  });
  var largo = window.matchMedia('(min-width: 980px)');
  var ajusta = function () { if (largo.matches && aberto) abrirMenu(false); };
  largo.addEventListener ? largo.addEventListener('change', ajusta) : largo.addListener(ajusta);

  window.addEventListener('scroll', function () {
    var s = window.scrollY > 30;
    if (s !== rolou) { rolou = s; pintar(); }
  }, { passive: true });
  rolou = window.scrollY > 30;
  pintar();

  // Formulários: montam a mensagem e abrem o WhatsApp da loja
  var ROTULOS = {
    nome: 'Nome', telefone: 'Telefone', assunto: 'Assunto', mensagem: 'Mensagem',
    pedido: 'Pedido', entrega: 'Entrega', endereco: 'Endereço', pagamento: 'Pagamento', obs: 'Observações'
  };

  document.querySelectorAll('[data-form]').forEach(function (form) {
    var chave = form.getAttribute('data-form');
    var ok = document.querySelector('[data-enviado="' + chave + '"]');
    var denovo = document.querySelector('[data-denovo="' + chave + '"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var linhas = ['Olá! Vim pelo site da ' + ((window.LOJA || {}).nome || 'loja') + '.', ''];
      new FormData(form).forEach(function (v, k) {
        v = String(v || '').trim();
        if (v) linhas.push('*' + (ROTULOS[k] || k) + ':* ' + v);
      });
      window.acAbrirWhatsApp(linhas.join('\n'));
      form.reset();
      if (ok) { form.hidden = true; ok.hidden = false; ok.focus({ preventScroll: true }); }
    });

    if (denovo) denovo.addEventListener('click', function () {
      if (ok) ok.hidden = true;
      form.hidden = false;
      var primeiro = form.querySelector('input,select,textarea');
      if (primeiro) primeiro.focus();
    });
  });
})();
