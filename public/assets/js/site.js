/* ==========================================================================
   Sagrado Fogão — comportamento do site
   Monter Web Studio

   Substitui o runtime de preview do Claude Design (support.js + image-slot.js),
   que carregava React e Babel de um CDN externo em tempo de execução. Aqui é
   JavaScript puro, sem dependências e sem requisições a terceiros.

   Módulos (cada um só roda se encontrar seu ponto de ancoragem no HTML):
     header        — estado de rolagem, menu móvel
     reveal        — animações de entrada
     parallax      — profundidade nos heros
     transitions   — fade entre páginas
     images        — fallback para arquivo ausente
     menuTabs      — navegação por categorias do cardápio
     gallery       — filtros e lightbox
     forms         — validação e envio
     booking       — assistente de reserva em 5 etapas

   >>> PONTO DE INTEGRAÇÃO DE FORMULÁRIOS: função `sendToBackend`, no fim deste
   >>> arquivo. Hoje os formulários NÃO enviam dados a lugar algum.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------------------- header */

  function initHeader() {
    var header = $('.sf-header');
    if (!header) return;

    var burger = $('.sf-burger', header);
    var menu = $('.sf-menu');
    var open = false;

    function sync() {
      var scrolled = window.scrollY > 40;
      header.classList.toggle('is-scrolled', scrolled);
      header.classList.toggle('is-solid', scrolled || open);
    }

    function setMenu(next) {
      if (!menu || !burger) return;
      open = next;
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      document.body.classList.toggle('sf-locked', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      sync();
      if (open) {
        var first = $('a, button', menu);
        if (first) first.focus();
      } else {
        burger.focus();
      }
    }

    if (burger && menu) {
      burger.addEventListener('click', function () { setMenu(!open); });

      // Esc fecha; Tab fica preso dentro do menu enquanto ele está aberto
      document.addEventListener('keydown', function (e) {
        if (!open) return;
        if (e.key === 'Escape') { setMenu(false); return; }
        if (e.key !== 'Tab') return;
        var items = $$('a[href], button:not([disabled])', menu);
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });

      // ao voltar para a largura de desktop, o overlay não deve ficar preso
      window.addEventListener('resize', function () {
        if (open && window.innerWidth >= 980) setMenu(false);
      });
    }

    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* ---------------------------------------------------------------- reveal */

  function initReveal() {
    var nodes = $$('[data-reveal]');
    if (!nodes.length) return;

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.classList.add('sf-rv-in'); });
      return;
    }

    var ease = 'cubic-bezier(.2,.7,.2,1)';
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('sf-rv-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px' });

    nodes.forEach(function (el) {
      // conteúdo já visível entra sem animação: nada de piscar no carregamento
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        el.classList.add('sf-rv-in');
        return;
      }
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10) || 0;
      if (el.getAttribute('data-reveal') === 'img') {
        el.classList.add('sf-rv-img');
        el.style.transition = 'clip-path 1.3s ' + ease + ' ' + delay + 'ms, opacity .9s ease ' + delay + 'ms';
      } else {
        el.classList.add('sf-rv-up');
        el.style.transition = 'opacity 1s ' + ease + ' ' + delay + 'ms, transform 1s ' + ease + ' ' + delay + 'ms';
      }
      io.observe(el);
    });
  }

  /* -------------------------------------------------------------- parallax */

  function initParallax() {
    var layers = $$('[data-parallax]');
    if (!layers.length) return;

    function apply() {
      if (reduceMotion.matches) {
        layers.forEach(function (el) { el.style.transform = ''; });
        return;
      }
      var vh = window.innerHeight;
      layers.forEach(function (el) {
        var parent = el.parentElement;
        if (!parent) return;
        var box = parent.getBoundingClientRect();
        if (box.bottom < -200 || box.top > vh + 200) return;
        var k = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        var offset = ((box.top + box.height / 2) - vh / 2) * -k;
        el.style.transform = 'translate3d(0,' + offset.toFixed(2) + 'px,0)';
      });
    }

    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; apply(); });
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', apply);
    apply();
  }

  /* ----------------------------------------------------------- transitions */

  function initTransitions() {
    // restaura a opacidade ao voltar pelo histórico (inclusive via bfcache)
    function restore() { document.body.style.opacity = ''; }
    window.addEventListener('pageshow', restore);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) restore();
    });

    if (reduceMotion.matches) return;

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target || a.hasAttribute('download') || a.dataset.noTransition != null) return;

      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;

      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) return;        // só muda a âncora
      if (!/\.html?$/.test(url.pathname) && url.pathname !== '/') return;

      e.preventDefault();
      document.body.style.transition = 'opacity .22s ease';
      document.body.style.opacity = '0';
      var went = false;
      var go = function () { if (!went) { went = true; location.href = a.href; } };
      setTimeout(go, 200);
      // rede de segurança: se a navegação não acontecer, a página volta a aparecer
      setTimeout(function () { if (!went) restore(); }, 1500);
    });
  }

  /* ---------------------------------------------------------------- images */

  function initImages() {
    function mark(img) {
      img.classList.add('is-missing');
      img.setAttribute('data-missing', 'true');
    }
    $$('img.sf-img').forEach(function (img) {
      img.addEventListener('error', function () { mark(img); });
      // imagens em cache podem falhar antes do listener existir
      if (img.complete && img.naturalWidth === 0) mark(img);
    });
  }

  /* -------------------------------------------------------------- menuTabs */

  function initMenuTabs() {
    var nav = $('.sf-menu-tabs');
    if (!nav) return;
    var links = $$('a[href^="#"]', nav);
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });

    function sync() {
      var active = 0;
      targets.forEach(function (el, i) {
        if (el && el.getBoundingClientRect().top < 200) active = i;
      });
      links.forEach(function (a, i) {
        var on = i === active;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* --------------------------------------------------------------- gallery */

  function initGallery() {
    var grid = $('#sf-gal-grid');
    if (!grid) return;

    var items = $$('.sf-gal-item', grid);
    var filters = $$('.sf-filter');
    var box = $('#sf-lightbox');
    var img = box && $('#sf-lb-img', box);
    var cap = box && $('#sf-lb-cap', box);
    var pos = box && $('#sf-lb-pos', box);
    var frame = box && $('#sf-lb-frame', box);
    var visible = items.slice();
    var index = -1;
    var lastFocus = null;

    function refreshVisible() {
      visible = items.filter(function (el) { return !el.classList.contains('sf-hidden'); });
    }

    function setFilter(cat) {
      items.forEach(function (el) {
        var show = cat === 'todas' || el.dataset.cat === cat;
        el.classList.toggle('sf-hidden', !show);
      });
      filters.forEach(function (b) {
        var on = b.dataset.filter === cat;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      refreshVisible();
    }

    function show(i) {
      if (!box || !visible.length) return;
      index = (i + visible.length) % visible.length;
      var el = visible[index];
      var src = el.dataset.src || '';
      var alt = el.dataset.alt || '';
      img.classList.remove('is-missing');
      img.removeAttribute('data-missing');
      img.src = src;
      img.alt = alt;
      cap.textContent = el.dataset.cap || '';
      pos.textContent = pad(index + 1) + ' / ' + pad(visible.length);
      if (frame) {
        frame.style.animation = 'none';
        // reinicia a animação de entrada a cada troca de foto
        void frame.offsetWidth;
        frame.style.animation = '';
      }
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function open(i) {
      if (!box) return;
      lastFocus = document.activeElement;
      refreshVisible();
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sf-locked');
      show(i);
      var close = $('#sf-lb-close', box);
      if (close) close.focus();
    }

    function close() {
      if (!box) return;
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sf-locked');
      index = -1;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    filters.forEach(function (b) {
      b.addEventListener('click', function () { setFilter(b.dataset.filter); });
    });

    items.forEach(function (el) {
      var btn = $('button', el);
      if (btn) btn.addEventListener('click', function () {
        refreshVisible();
        open(visible.indexOf(el));
      });
    });

    if (box) {
      var closeBtn = $('#sf-lb-close', box);
      var prevBtn = $('#sf-lb-prev', box);
      var nextBtn = $('#sf-lb-next', box);
      if (closeBtn) closeBtn.addEventListener('click', close);
      if (prevBtn) prevBtn.addEventListener('click', function () { show(index - 1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { show(index + 1); });

      // clicar no fundo fecha
      box.addEventListener('click', function (e) { if (e.target === box) close(); });

      document.addEventListener('keydown', function (e) {
        if (!box.classList.contains('is-open')) return;
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowRight') { show(index + 1); return; }
        if (e.key === 'ArrowLeft') { show(index - 1); return; }
        if (e.key !== 'Tab') return;
        var focusables = $$('button', box);
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }

    refreshVisible();
  }

  /* ----------------------------------------------------------------- forms */

  var MSG = {
    required: 'Preencha este campo.',
    email: 'Informe um e-mail válido.',
    tel: 'Informe um telefone com DDD.',
    select: 'Selecione uma opção.'
  };

  function fieldError(field) {
    var id = field.id;
    return id ? document.getElementById(id + '-erro') : null;
  }

  function clearError(field) {
    field.removeAttribute('aria-invalid');
    var box = fieldError(field);
    if (box) { box.textContent = ''; box.classList.remove('is-shown'); }
  }

  function showError(field, message) {
    field.setAttribute('aria-invalid', 'true');
    var box = fieldError(field);
    if (box) { box.textContent = message; box.classList.add('is-shown'); }
  }

  function validateField(field) {
    var value = (field.value || '').trim();
    if (field.hasAttribute('required') && !value) {
      showError(field, field.tagName === 'SELECT' ? MSG.select : MSG.required);
      return false;
    }
    if (!value) { clearError(field); return true; }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) {
      showError(field, MSG.email);
      return false;
    }
    if (field.type === 'tel' && (value.replace(/\D/g, '').length < 10)) {
      showError(field, MSG.tel);
      return false;
    }
    clearError(field);
    return true;
  }

  function validateForm(form) {
    var fields = $$('input, select, textarea', form).filter(function (f) {
      return f.type !== 'hidden' && !f.disabled;
    });
    var firstBad = null;
    fields.forEach(function (f) {
      if (!validateField(f) && !firstBad) firstBad = f;
    });
    if (firstBad) {
      firstBad.focus();
      return false;
    }
    return true;
  }

  function initForms() {
    $$('form[data-sf-form]').forEach(function (form) {
      // validação só depois de o campo ser tocado, nunca durante a digitação inicial
      $$('input, select, textarea', form).forEach(function (f) {
        f.addEventListener('blur', function () { if (f.dataset.touched) validateField(f); });
        f.addEventListener('change', function () { f.dataset.touched = '1'; validateField(f); });
        f.addEventListener('input', function () {
          if (f.getAttribute('aria-invalid') === 'true') validateField(f);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        $$('input, select, textarea', form).forEach(function (f) { f.dataset.touched = '1'; });
        if (!validateForm(form)) return;

        var done = document.getElementById(form.dataset.sfSuccess);
        var button = $('button[type="submit"]', form);
        if (button) { button.disabled = true; }

        sendToBackend(form.dataset.sfForm, new FormData(form))
          .then(function () {
            if (done) {
              form.classList.add('sf-hidden');
              done.classList.remove('sf-hidden');
              var heading = $('h2, h3', done);
              if (heading) {
                heading.setAttribute('tabindex', '-1');
                heading.focus();
              }
            }
          })
          .catch(function () {
            var fail = document.getElementById(form.dataset.sfError || '');
            if (fail) fail.classList.add('is-shown');
          })
          .then(function () { if (button) button.disabled = false; });
      });
    });

    // "enviar outra mensagem" / "fazer outra solicitação"
    $$('[data-sf-reset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var form = document.getElementById(btn.dataset.sfReset);
        var done = btn.closest('[data-sf-panel]');
        if (!form) return;
        form.reset();
        $$('input, select, textarea', form).forEach(function (f) {
          clearError(f);
          delete f.dataset.touched;
        });
        if (done) done.classList.add('sf-hidden');
        form.classList.remove('sf-hidden');
        var first = $('input, select, textarea', form);
        if (first) first.focus();
      });
    });

    // data mínima = hoje nos campos de data
    $$('input[type="date"][data-sf-min-today]').forEach(function (input) {
      var d = new Date();
      var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      input.min = iso;
    });
  }

  /* --------------------------------------------------------------- booking */

  var MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var WD = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var WDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  function range(from, to) {
    var out = [];
    for (var m = from; m <= to; m += 30) {
      out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
    }
    return out;
  }

  // Horários de funcionamento (iguais aos publicados no rodapé e no Contato)
  function slotsFor(date) {
    var w = date.getDay();
    if (w === 0) return [['Almoço', range(720, 960)]];                              // dom 12h–17h
    if (w === 6) return [['Almoço', range(720, 960)], ['Jantar', range(1140, 1350)]]; // sáb
    if (w === 5) return [['Almoço', range(720, 870)], ['Jantar', range(1140, 1350)]]; // sex
    return [['Almoço', range(720, 870)], ['Jantar', range(1140, 1290)]];             // ter–qui
  }

  // ATENÇÃO: disponibilidade DEMONSTRATIVA. Marca alguns horários como esgotados
  // de forma determinística para o fluxo parecer real. Não há consulta a agenda.
  function isBusy(date, time) {
    return ((date.getDate() * 7 + parseInt(time, 10) * 3 + parseInt(time.slice(3), 10)) % 9) === 0;
  }

  function initBooking() {
    var root = $('#sf-booking');
    if (!root) return;

    var state = { step: 1, done: false, people: 0, date: null, time: '', mOff: 0 };
    var panels = {};
    [1, 2, 3, 5].forEach(function (n) { panels[n] = $('#sf-step-' + n, root); });
    // a etapa 4 é o próprio formulário de dados
    panels[4] = $('#sf-dados', root);
    var donePanel = $('#sf-step-done', root);
    var stepBtns = $$('.sf-step-btn', root);
    var summaryEl = $('#sf-summary', root);
    var backBtn = $('#sf-back', root);
    var form = $('#sf-dados', root);

    var monthLabel = $('#sf-month', root);
    var daysGrid = $('#sf-days', root);
    var prevMonth = $('#sf-prev-month', root);
    var nextMonth = $('#sf-next-month', root);
    var slotsWrap = $('#sf-slots', root);
    var bigGroup = $('#sf-big-group', root);
    var reviewList = $('#sf-review', root);
    var doneSummary = $('#sf-done-summary', root);

    function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

    function peopleLabel() {
      if (!state.people) return '';
      if (state.people === 1) return '1 pessoa';
      if (state.people > 8) return 'Mais de 8 pessoas';
      return state.people + ' pessoas';
    }

    function fmtDate(d) {
      return d ? WDS[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()] : '';
    }

    function summaryText() {
      return [peopleLabel(), fmtDate(state.date), state.time].filter(Boolean).join(' · ');
    }

    function go(step) {
      state.step = step;
      render();
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    /* etapa 1 — pessoas */
    $$('.sf-people', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.people = parseInt(btn.dataset.n, 10);
        if (state.people < 9) go(2); else render();
      });
    });

    /* etapa 2 — calendário */
    function buildDays() {
      if (!daysGrid) return;
      daysGrid.textContent = '';
      var t = today();
      var base = new Date(t.getFullYear(), t.getMonth() + state.mOff, 1);
      var firstDow = base.getDay();
      var daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

      if (monthLabel) monthLabel.textContent = MONTHS[base.getMonth()] + ' ' + base.getFullYear();
      if (prevMonth) { prevMonth.disabled = state.mOff <= 0; prevMonth.style.opacity = state.mOff <= 0 ? '.3' : '1'; }
      if (nextMonth) { nextMonth.disabled = state.mOff >= 2; nextMonth.style.opacity = state.mOff >= 2 ? '.3' : '1'; }

      for (var i = 0; i < firstDow; i++) {
        var filler = document.createElement('span');
        filler.setAttribute('aria-hidden', 'true');
        daysGrid.appendChild(filler);
      }

      for (var n = 1; n <= daysInMonth; n++) {
        var d = new Date(base.getFullYear(), base.getMonth(), n);
        var closed = d.getDay() === 1;                    // segunda-feira
        var off = d < t || closed;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sf-slot sf-day hv-border-dark' + (closed && d >= t ? ' sf-day--closed' : '');
        btn.style.cssText = 'aspect-ratio:1/1;min-height:44px;font-size:15px';
        btn.textContent = String(n);
        btn.disabled = off;
        btn.setAttribute('aria-label', WD[d.getDay()] + ', ' + n + ' de ' + MONTHS[d.getMonth()] + (off ? ' — indisponível' : ''));
        btn.setAttribute('aria-pressed', state.date && d.getTime() === state.date.getTime() ? 'true' : 'false');
        if (!off) {
          (function (day) {
            btn.addEventListener('click', function () {
              state.date = day;
              state.time = '';
              go(3);
            });
          })(d);
        }
        daysGrid.appendChild(btn);
      }
    }

    if (prevMonth) prevMonth.addEventListener('click', function () {
      state.mOff = Math.max(0, state.mOff - 1); buildDays();
    });
    if (nextMonth) nextMonth.addEventListener('click', function () {
      state.mOff = Math.min(2, state.mOff + 1); buildDays();
    });

    /* etapa 3 — horários */
    function buildSlots() {
      if (!slotsWrap || !state.date) return;
      slotsWrap.textContent = '';
      var now = new Date();
      var isToday = state.date.getTime() === today().getTime();

      slotsFor(state.date).forEach(function (group) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:36px;max-width:640px';

        var label = document.createElement('p');
        label.style.cssText = 'margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#6B5848';
        label.textContent = group[0];
        wrap.appendChild(label);

        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px';

        group[1].forEach(function (time) {
          var tooLate = isToday &&
            (parseInt(time, 10) * 60 + parseInt(time.slice(3), 10)) <= now.getHours() * 60 + now.getMinutes() + 30;
          var off = tooLate || isBusy(state.date, time);
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sf-slot hv-border-dark';
          btn.style.cssText = 'height:56px;font-size:16px';
          btn.textContent = time;
          btn.disabled = off;
          btn.setAttribute('aria-pressed', time === state.time ? 'true' : 'false');
          btn.setAttribute('aria-label', time + (off ? ' — esgotado' : ''));
          if (!off) btn.addEventListener('click', function () { state.time = time; go(4); });
          row.appendChild(btn);
        });

        wrap.appendChild(row);
        slotsWrap.appendChild(wrap);
      });
    }

    /* etapa 4 — dados */
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        $$('input, select, textarea', form).forEach(function (f) { f.dataset.touched = '1'; });
        if (!validateForm(form)) return;
        go(5);
      });
      $$('input, select, textarea', form).forEach(function (f) {
        f.addEventListener('blur', function () { if (f.dataset.touched) validateField(f); });
        f.addEventListener('change', function () { f.dataset.touched = '1'; validateField(f); });
        f.addEventListener('input', function () {
          if (f.getAttribute('aria-invalid') === 'true') validateField(f);
        });
      });
    }

    function formValue(name) {
      var f = form && form.elements[name];
      return f ? (f.value || '').trim() : '';
    }

    /* etapa 5 — revisão */
    function buildReview() {
      if (!reviewList) return;
      reviewList.textContent = '';
      var rows = [
        ['Pessoas', peopleLabel(), 1],
        ['Data', fmtDate(state.date), 2],
        ['Horário', state.time, 3],
        ['Nome', formValue('nome'), 4],
        ['Contato', [formValue('telefone'), formValue('email')].filter(Boolean).join(' · '), 4]
      ];
      if (formValue('ocasiao')) rows.push(['Ocasião', formValue('ocasiao'), 4]);
      if (formValue('obs')) rows.push(['Observações', formValue('obs'), 4]);

      rows.forEach(function (row) {
        var dt = document.createElement('dt');
        dt.style.cssText = 'padding:18px 24px 18px 0;border-top:1px solid rgba(71,55,45,.2);font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#6B5848;align-self:center';
        dt.textContent = row[0];

        var dd = document.createElement('dd');
        dd.style.cssText = 'margin:0;padding:18px 0;border-top:1px solid rgba(71,55,45,.2);overflow-wrap:anywhere';
        dd.textContent = row[1];

        var act = document.createElement('dd');
        act.style.cssText = 'margin:0;padding:12px 0;border-top:1px solid rgba(71,55,45,.2);text-align:right';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'min-height:44px;background:transparent;border:0;color:#A54F32;cursor:pointer;font-size:13px;text-decoration:underline;text-underline-offset:4px';
        btn.textContent = 'Alterar';
        btn.setAttribute('aria-label', 'Alterar ' + row[0].toLowerCase());
        (function (step) { btn.addEventListener('click', function () { go(step); }); })(row[2]);
        act.appendChild(btn);

        reviewList.appendChild(dt);
        reviewList.appendChild(dd);
        reviewList.appendChild(act);
      });
    }

    var confirmBtn = $('#sf-confirm', root);
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      confirmBtn.disabled = true;
      var data = new FormData(form || undefined);
      data.append('pessoas', peopleLabel());
      data.append('data', state.date ? state.date.toISOString().slice(0, 10) : '');
      data.append('horario', state.time);
      sendToBackend('reserva', data)
        .then(function () { state.done = true; render(); window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); })
        .then(function () { confirmBtn.disabled = false; });
    });

    var restartBtn = $('#sf-restart', root);
    if (restartBtn) restartBtn.addEventListener('click', function () {
      state = { step: 1, done: false, people: 0, date: null, time: '', mOff: 0 };
      if (form) {
        form.reset();
        $$('input, select, textarea', form).forEach(function (f) { clearError(f); delete f.dataset.touched; });
      }
      render();
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });

    if (backBtn) backBtn.addEventListener('click', function () { go(Math.max(1, state.step - 1)); });

    stepBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!btn.disabled) go(parseInt(btn.dataset.step, 10));
      });
    });

    /* render */
    function render() {
      var reached = [
        true,
        state.people > 0,
        !!state.date,
        !!state.time,
        !!(formValue('nome') && formValue('telefone') && formValue('email'))
      ];
      var current = state.done ? 0 : state.step;

      [1, 2, 3, 4, 5].forEach(function (n) {
        if (panels[n]) panels[n].classList.toggle('sf-hidden', state.done || state.step !== n);
      });
      if (donePanel) donePanel.classList.toggle('sf-hidden', !state.done);

      stepBtns.forEach(function (btn, i) {
        var n = i + 1;
        var unlocked = reached[i] && !state.done;
        btn.disabled = !unlocked;
        btn.style.borderTopColor = n === current ? '#A54F32'
          : (n < current || state.done) ? '#161411' : 'rgba(71,55,45,.18)';
        btn.style.color = (n === current || n < current || state.done) ? '#161411' : 'rgba(71,55,45,.55)';
        btn.style.cursor = unlocked ? 'pointer' : 'default';
        if (n === current) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      });

      var text = summaryText();
      if (summaryEl) {
        summaryEl.textContent = text;
        summaryEl.classList.toggle('sf-hidden', !text || state.done);
      }
      if (doneSummary) doneSummary.textContent = text;
      if (bigGroup) bigGroup.classList.toggle('sf-hidden', state.people <= 8);
      if (backBtn) backBtn.classList.toggle('sf-hidden', state.done || state.step <= 1);

      $$('.sf-people', root).forEach(function (btn) {
        btn.setAttribute('aria-checked', parseInt(btn.dataset.n, 10) === state.people ? 'true' : 'false');
      });

      if (state.step === 2 && !state.done) buildDays();
      if (state.step === 3 && !state.done) buildSlots();
      if (state.step === 5 && !state.done) buildReview();
    }

    render();
  }

  /* ==========================================================================
     ENVIO DE FORMULÁRIOS — PONTO DE INTEGRAÇÃO

     Estado atual: NADA É ENVIADO. A função resolve após uma pequena espera só
     para que a interface mostre a tela de confirmação. Nenhum dado sai do
     navegador: não há endpoint, chave, serviço de e-mail ou banco de dados.

     Para ativar o envio de verdade, troque o corpo desta função por uma
     chamada ao serviço escolhido, por exemplo:

       return fetch('/api/contato', {
         method: 'POST',
         body: data
       }).then(function (r) { if (!r.ok) throw new Error(r.status); });

     Alternativas sem servidor próprio: Formspree, Basin, Web3Forms, Netlify
     Forms ou uma Serverless Function na Vercel. Qualquer uma delas exige
     configuração fora do repositório (conta, endpoint e, em alguns casos,
     uma chave que deve ficar em variável de ambiente — nunca no HTML).
     ========================================================================== */

  function sendToBackend(kind, data) {
    if (window.console && console.info) {
      console.info('[Sagrado Fogão] Formulário "' + kind + '" validado. ' +
        'Envio real não configurado — nenhum dado foi transmitido.');
    }
    return new Promise(function (resolve) { setTimeout(resolve, 450); });
  }

  /* ------------------------------------------------------------------ boot */

  function boot() {
    initHeader();
    initReveal();
    initParallax();
    initTransitions();
    initImages();
    initMenuTabs();
    initGallery();
    initForms();
    initBooking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
