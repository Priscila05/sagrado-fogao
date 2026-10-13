/* ==========================================================================
   DADOS DA LOJA — Açaiteria Carioca · Monter Web Studio
   --------------------------------------------------------------------------
   Para atualizar a prévia, troque SÓ o que está neste bloco.
   Todas as páginas leem daqui: nome, endereço, WhatsApp, horários, cores,
   link do Goomer e os preços do "Monte seu açaí".
   ========================================================================== */
window.LOJA = {
  nome: 'Açaiteria Carioca',
  nomeCurto: 'Carioca',
  slogan: 'Monte o copo do seu jeito.',
  tipo: 'Açaiteria',

  endereco: 'R. Zike Tuma, 751',
  bairro: 'Jardim Ubirajara',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '04458-000',

  whatsapp: '5511967510122',          // só dígitos, com 55 + DDD
  telefone: '5511967510122',
  instagram: '',                      // vazio: o perfil ainda não foi confirmado com a loja
  goomer: 'https://acaiteria-carioca.goomer.app/',

  horarioResumo: 'Todos os dias · até às 20h',
  horarios: [
    ['Todos os dias', '12h às 20h'],
    ['Feriados', 'Horário pode variar']
  ],

  avaliacoes: 'Mais de 3.400 avaliações no Google',

  corDestaque: '#55147E',             // roxo da fachada
  previa: true,                       // true = mostra o selo "Prévia · Monter Web Studio"
  whatsappMonter: '5511996799945'     // WhatsApp da Monter, usado só no selo da prévia
};

/* ==========================================================================
   Daqui pra baixo é o motor que aplica os dados nas páginas. Não precisa mexer.
   ========================================================================== */
(function () {
  'use strict';
  var L = window.LOJA;
  if (!L) return;

  function digitos(s) { return String(s || '').replace(/\D/g, ''); }

  function telefoneBonito(d) {               // 5511967510122 -> (11) 96751-0122
    d = digitos(d);
    if (d.indexOf('55') === 0 && d.length > 11) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  }

  function semAcento(s) { return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
  var enderecoCompleto = [L.endereco, L.bairro, L.cidade, L.uf].filter(Boolean).join(', ');
  var busca = encodeURIComponent(semAcento(enderecoCompleto)).replace(/%20/g, '+');
  var MAPA = 'https://www.google.com/maps/search/?api=1&query=' + busca;
  var ROTAS = 'https://www.google.com/maps/dir/?api=1&destination=' + busca;

  // Texto pronto para o WhatsApp
  window.acWhatsApp = function (texto) {
    return 'https://wa.me/' + digitos(L.whatsapp) + '?text=' + encodeURIComponent(texto || ('Olá! Vim pelo site da ' + L.nome + '.'));
  };
  window.acAbrirWhatsApp = function (texto) {
    var url = window.acWhatsApp(texto);
    var w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  };

  var valores = {
    nome: L.nome,
    nomeCurto: L.nomeCurto,
    slogan: L.slogan,
    endereco: L.endereco,
    bairro: L.bairro,
    cidade: L.cidade,
    uf: L.uf,
    cep: L.cep,
    enderecoCompleto: enderecoCompleto,
    cidadeUf: L.cidade + ' — ' + L.uf,
    telefone: telefoneBonito(L.telefone),
    whatsapp: telefoneBonito(L.whatsapp),
    horarioResumo: L.horarioResumo,
    avaliacoes: L.avaliacoes,
    ano: String(new Date().getFullYear())
  };

  function aplicar() {
    document.querySelectorAll('[data-loja]').forEach(function (el) {
      var v = valores[el.getAttribute('data-loja')];
      if (v != null) el.textContent = v;
    });

    document.querySelectorAll('[data-wa]').forEach(function (el) {
      el.href = window.acWhatsApp(el.getAttribute('data-wa') || '');
      el.target = '_blank'; el.rel = 'noopener';
    });
    document.querySelectorAll('[data-goomer]').forEach(function (el) {
      el.href = L.goomer; el.target = '_blank'; el.rel = 'noopener';
    });
    document.querySelectorAll('[data-tel]').forEach(function (el) { el.href = 'tel:+' + digitos(L.telefone); });
    document.querySelectorAll('[data-mapa]').forEach(function (el) { el.href = MAPA; el.target = '_blank'; el.rel = 'noopener'; });
    document.querySelectorAll('[data-rotas]').forEach(function (el) { el.href = ROTAS; el.target = '_blank'; el.rel = 'noopener'; });

    // tabela de horários
    document.querySelectorAll('[data-horarios]').forEach(function (ul) {
      ul.innerHTML = L.horarios.map(function (h) {
        return '<li><span>' + h[0] + '</span><span>' + h[1] + '</span></li>';
      }).join('');
    });

    // Instagram: só aparece quando o perfil estiver confirmado
    document.querySelectorAll('[data-instagram]').forEach(function (el) {
      if (!L.instagram) { el.hidden = true; return; }
      var a = el.tagName === 'A' ? el : el.querySelector('a');
      if (a) { a.href = 'https://instagram.com/' + L.instagram; a.textContent = '@' + L.instagram; }
      el.hidden = false;
    });
  }

  function dadosEstruturados() {
    var json = {
      '@context': 'https://schema.org',
      '@type': 'IceCreamShop',
      name: L.nome,
      servesCuisine: 'Açaí',
      priceRange: '$',
      address: {
        '@type': 'PostalAddress',
        streetAddress: L.endereco,
        addressLocality: L.cidade,
        addressRegion: L.uf,
        postalCode: L.cep,
        addressCountry: 'BR'
      },
      telephone: '+' + digitos(L.telefone),
      hasMenu: L.goomer,
      url: L.goomer
    };
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(json);
    document.head.appendChild(s);
  }

  function selo() {
    if (!L.previa) return;
    var a = document.createElement('a');
    a.className = 'selo-previa';
    a.href = 'https://wa.me/' + digitos(L.whatsappMonter) + '?text=' +
      encodeURIComponent('Olá! Vi a prévia do site da ' + L.nome + ' feita pela Monter.');
    a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Prévia · Monter Web Studio';
    a.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:300;padding:9px 15px;border-radius:999px;' +
      'background:rgba(27,5,41,.92);color:#FFC627;font:700 11px/1 "Roboto",sans-serif;letter-spacing:.14em;' +
      'text-transform:uppercase;text-decoration:none;border:1px solid rgba(255,198,39,.45);backdrop-filter:blur(6px)';
    if (window.innerWidth < 700) {
      a.style.cssText += ';left:auto;right:10px;bottom:10px;padding:7px 11px;font-size:9px;letter-spacing:.1em;opacity:.95';
    }
    document.body.appendChild(a);
  }

  document.documentElement.style.setProperty('--roxo-600', L.corDestaque);
  aplicar();
  dadosEstruturados();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', selo); else selo();

  window.acDados = { telefoneBonito: telefoneBonito, mapa: MAPA, rotas: ROTAS, endereco: enderecoCompleto };
})();
