/* Cardápio — marca na barra fixa a categoria que está na tela. */
(function () {
  'use strict';
  var abas = [].slice.call(document.querySelectorAll('[data-aba]'));
  if (!abas.length) return;
  var secoes = abas.map(function (a) { return document.getElementById(a.getAttribute('data-aba')); });
  var atual = null;

  function atualizar() {
    var i = 0;
    secoes.forEach(function (s, n) { if (s && s.getBoundingClientRect().top < 220) i = n; });
    if (i === atual) return;
    atual = i;
    abas.forEach(function (a, n) {
      var on = n === i;
      a.classList.toggle('ativa', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    var barra = abas[i].parentElement, aba = abas[i];
    if (aba.offsetLeft < barra.scrollLeft || aba.offsetLeft + aba.offsetWidth > barra.scrollLeft + barra.clientWidth) {
      barra.scrollTo({ left: Math.max(0, aba.offsetLeft - 20), behavior: 'smooth' });
    }
  }

  var pedido = 0;
  window.addEventListener('scroll', function () {
    if (!pedido) pedido = requestAnimationFrame(function () { pedido = 0; atualizar(); });
  }, { passive: true });
  atualizar();
})();
