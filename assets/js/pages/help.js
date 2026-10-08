/* ============================================================
   pages/help.js — behaviour for help.html

   The guides and FAQ are real markup in the page (they are
   content, not data). This file only handles search filtering,
   the accordion, and opening a guide in a dialog.
   ============================================================ */
(function (global) {

  function faqItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#faqList .acc-item'));
  }

  function updateCount(visible, q) {
    UI.bind({
      faqCount: visible + ' question' + (visible === 1 ? '' : 's') +
                (q ? ' matching &ldquo;' + UI.esc(q) + '&rdquo;' : '')
    });
  }

  function filter(q) {
    q = q.trim().toLowerCase();
    var shown = 0;

    faqItems().forEach(function (item) {
      var hit = !q || item.textContent.toLowerCase().indexOf(q) > -1;
      item.hidden = !hit;
      if (hit) shown++;
      if (q && hit) item.classList.add('open');
      if (!q) item.classList.remove('open');
    });

    document.querySelectorAll('#guideGrid .help-card').forEach(function (card) {
      card.hidden = !!q && card.textContent.toLowerCase().indexOf(q) === -1;
    });

    var empty = document.getElementById('faqEmpty');
    if (shown === 0) {
      empty.hidden = false;
      empty.innerHTML = UI.emptyState('search', 'Nothing found',
        'Try a different word, or contact support below.');
    } else {
      empty.hidden = true;
      empty.innerHTML = '';
    }

    updateCount(shown, q);
  }

  function openGuide(card) {
    var tpl = card.querySelector('template');
    UI.modal({
      title: card.querySelector('b').textContent,
      sub: card.querySelector('p').textContent,
      body: '<ol style="padding-left:20px;line-height:1.75;font-size:13.5px;color:var(--ink-2)">' +
            (tpl ? tpl.innerHTML : '') + '</ol>',
      foot: '<button class="btn btn-ghost" data-close>Close</button>' +
            '<button class="btn btn-primary" data-confirm>Got it</button>',
      onConfirm: function () {}
    });
  }

  function refresh() {
    UI.resolveIcons(document);
    updateCount(faqItems().length, '');
    UI.bind({ firstName: UI.esc(DB.me.name.split(' ')[0]) });
  }

  function init() {
    refresh();
    UI.wireAccordion(document);

    document.getElementById('hq').addEventListener('input', function (e) {
      filter(e.target.value);
    });

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var g = e.target.closest('[data-guide]');
      if (g) return openGuide(g);

      var a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'contact') {
        UI.modal({
          title: 'Property contacts',
          body: '<dl class="kv">' +
            '<dt>Office</dt><dd>' + UI.esc(DB.settings.contact_phone || '—') + '</dd>' +
            '<dt>Email</dt><dd>' + UI.esc(DB.settings.contact_email || '—') + '</dd>' +
            DB.staff.filter(function (s) { return s.role !== 'Owner'; }).map(function (s) {
              return '<dt>' + UI.esc(s.name) + '</dt><dd>' + UI.esc(s.role) + ' &middot; ' + UI.esc(s.phone || '—') + '</dd>';
            }).join('') + '</dl>',
          foot: '<button class="btn btn-primary" data-close>Close</button>'
        });
      }
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var g = e.target.closest('[data-guide]');
      if (g) openGuide(g);
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
