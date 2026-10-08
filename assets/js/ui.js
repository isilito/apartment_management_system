/* ============================================================
   ui.js — formatting helpers + shared HTML builders + overlays
   ============================================================ */
(function (global) {

  /* ---------------- Formatting ---------------- */
  var peso = function (n, opts) {
    opts = opts || {};
    var v = Math.abs(Math.round(n));
    var s = v.toLocaleString('en-PH');
    return (n < 0 ? '-' : '') + '₱' + s + (opts.suffix || '');
  };

  var pesoK = function (n) {
    if (Math.abs(n) >= 1000) return '₱' + Math.round(n / 1000) + 'k';
    return '₱' + n;
  };

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function fmtDate(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtDateLong(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return d.toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtMonthYear(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  function relative(d) {
    var n = daysBetween(d, DB.today);
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n < 7) return n + ' days ago';
    if (n < 30) return Math.floor(n / 7) + ' week' + (n < 14 ? '' : 's') + ' ago';
    return fmtDate(d);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Deterministic avatar tint from a string */
  function tintOf(str) {
    var h = 0;
    for (var i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) % 997;
    return 't' + (h % 6);
  }

  /* ---------------- HTML builders ---------------- */
  function avatar(initials, cls) {
    return '<span class="avatar ' + tintOf(initials) + ' ' + (cls || '') + '">' + esc(initials) + '</span>';
  }

  function badge(text, tone, ico) {
    return '<span class="badge badge-' + (tone || 'slate') + '">' +
           (ico ? icon(ico) : '') + esc(text) + '</span>';
  }

  var STATUS_MAP = {
    cleared:      ['Cleared',      'green'],
    pending:      ['Pending',      'amber'],
    failed:       ['Failed',       'red'],
    rejected:     ['Rejected',     'red'],
    paid:         ['Paid',         'green'],
    partial:      ['Partly paid',  'amber'],
    unpaid:       ['Unpaid',       'red'],
    upcoming:     ['Upcoming',     'slate'],
    occupied:     ['Occupied',     'green'],
    vacant:       ['Vacant',       'slate'],
    repair:       ['Under repair', 'amber'],
    current:      ['Current',      'green'],
    overdue:      ['Overdue',      'red'],
    notice:       ['On notice',    'amber'],
    'new':        ['New',          'red'],
    scheduled:    ['Scheduled',    'amber'],
    'in-progress':['In progress',  'teal'],
    done:         ['Resolved',     'green'],
    urgent:       ['Urgent',       'red'],
    high:         ['High',         'amber'],
    normal:       ['Normal',       'teal'],
    low:          ['Low',          'slate']
  };
  function statusBadge(key) {
    var m = STATUS_MAP[key] || [key, 'slate'];
    return badge(m[0], m[1]);
  }

  function meter(pct, tone) {
    return '<div class="meter"><i class="m-' + (tone || 'teal') +
           '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>';
  }

  function personCell(initials, name, sub) {
    return '<div class="cell-person">' + avatar(initials, 'avatar-sm') +
           '<span class="cp-text"><b>' + esc(name) + '</b>' +
           (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span></div>';
  }

  function card(inner, cls) {
    return '<section class="card ' + (cls || '') + '">' + inner + '</section>';
  }

  function cardHead(title, sub, actions, noRule) {
    return '<header class="card-head' + (noRule ? ' no-rule' : '') + '">' +
             '<div><h3>' + esc(title) + '</h3>' +
             (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') + '</div>' +
             (actions ? '<div class="card-head-actions">' + actions + '</div>' : '') +
           '</header>';
  }

  function emptyState(ico, title, body, action) {
    return '<div class="empty"><div class="ico">' + icon(ico) + '</div>' +
           '<b>' + esc(title) + '</b><p>' + esc(body) + '</p>' +
           (action ? '<div class="u-mt">' + action + '</div>' : '') + '</div>';
  }

  /**
   * table(cols, rows)
   *   cols: [{ label, cls }]
   *   rows: [{ cells:[html], attrs:'' }]
   */
  function table(cols, rows, minWidth) {
    var head = cols.map(function (c) {
      return '<th class="' + (c.cls || '') + '">' + esc(c.label) + '</th>';
    }).join('');
    var body = rows.map(function (r) {
      return '<tr ' + (r.attrs || '') + '>' + r.cells.map(function (c, i) {
        return '<td class="' + (cols[i] && cols[i].cls || '') + '">' + c + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="tbl"' +
           (minWidth ? ' style="min-width:' + minWidth + 'px"' : '') + '>' +
           '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function pageHead(title, crumbs, actions) {
    return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' +
           (crumbs ? '<div class="crumbs">' + crumbs + '</div>' : '') + '</div>' +
           (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
  }

  function crumbList(items) {
    return items.map(function (t) { return '<span>' + esc(t) + '</span>'; })
                .join('<span class="sep">&middot;</span>');
  }

  /* ============================================================
     Markup binding helpers
     These keep the page structure in the .html file and let JS fill
     only the data. Each one maps onto a PHP equivalent:

       <span data-icon="peso">          ->  <?= icon('peso') ?>
       <b data-bind="occupied">         ->  <?= $stats['occupied'] ?>
       <tbody id="rows">                ->  <?php foreach(...): ?>
     ============================================================ */

  /* Replace every <el data-icon="name"> with its SVG. */
  function resolveIcons(scope) {
    (scope || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = icon(el.dataset.icon);
    });
  }

  /* Fill every [data-bind] / [data-bind-width] slot from a value map. */
  function bind(map, scope) {
    scope = scope || document;
    scope.querySelectorAll('[data-bind]').forEach(function (el) {
      var v = map[el.dataset.bind];
      if (v !== undefined && v !== null) el.innerHTML = v;
    });
    scope.querySelectorAll('[data-bind-width]').forEach(function (el) {
      var v = map[el.dataset.bindWidth];
      if (v !== undefined && v !== null) el.style.width = Math.max(0, Math.min(100, v)) + '%';
    });
  }

  /* Set innerHTML on an element by id. Returns the element (or null). */
  function fill(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
    return el;
  }

  /* Build <tr> rows for a <tbody> whose <thead> already lives in the HTML.
     rows: [{ cells:[html], attrs:'' }]   colCls: ['', '', 'num', ...] */
  function tbody(rows, colCls) {
    colCls = colCls || [];
    return rows.map(function (r) {
      return '<tr ' + (r.attrs || '') + '>' + r.cells.map(function (c, i) {
        return '<td class="' + (colCls[i] || '') + '">' + c + '</td>';
      }).join('') + '</tr>';
    }).join('');
  }

  /* Read a query-string value — the direct analogue of $_GET['x']. */
  function query(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /* Debounced window resize — used to redraw charts at their new width. */
  function onResize(fn, wait) {
    var timer = null;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait || 180);
    });
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, tone) {
    var root = document.getElementById('toastRoot');
    var el = document.createElement('div');
    var ico = tone === 'warn' ? 'alert' : (tone === 'info' ? 'info' : 'check');
    el.className = 'toast ' + (tone || 'ok');
    el.innerHTML = '<span class="t-ico">' + icon(ico) + '</span><span>' + esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 220);
    }, 3200);
  }

  /* ---------------- Modal ---------------- */
  function modal(opts) {
    var root = document.getElementById('modalRoot');
    var box = document.getElementById('modalBox');
    box.className = 'modal' + (opts.wide ? ' wide' : '');
    box.innerHTML =
      '<div class="modal-head"><div><h3>' + esc(opts.title) + '</h3>' +
        (opts.sub ? '<p class="sub">' + esc(opts.sub) + '</p>' : '') + '</div>' +
        '<button class="icon-btn sm" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      '<div class="modal-body">' + opts.body + '</div>' +
      (opts.foot === null ? '' :
        '<div class="modal-foot">' + (opts.foot ||
          '<button class="btn btn-ghost" data-close>Cancel</button>' +
          '<button class="btn btn-primary" data-confirm>' + esc(opts.confirmText || 'Save') + '</button>') +
        '</div>');
    root.hidden = false;

    var confirmBtn = box.querySelector('[data-confirm]');
    if (confirmBtn && opts.onConfirm) {
      confirmBtn.addEventListener('click', function () {
        if (confirmBtn.disabled) return;
        var r = opts.onConfirm(box);
        /* async save: keep the dialog open until the server answers */
        if (r && typeof r.then === 'function') {
          var label = confirmBtn.innerHTML;
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Saving…';
          r.then(function (v) {
            if (v !== false && box.contains(confirmBtn)) closeModal();
          }, function (err) {
            toast(err && err.message ? err.message : 'Something went wrong', 'warn');
          }).then(function () {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = label;
          });
          return;
        }
        if (r !== false) closeModal();
      });
    }
    if (opts.onOpen) opts.onOpen(box);
    var first = box.querySelector('input,select,textarea,button:not([data-close])');
    if (first) first.focus();
  }

  function closeModal() {
    var root = document.getElementById('modalRoot');
    root.hidden = true;
    document.getElementById('modalBox').innerHTML = '';
  }

  /* ---------------- Drawer ---------------- */
  function drawer(opts) {
    closeDrawer();
    var root = document.createElement('div');
    root.className = 'drawer-root';
    root.id = 'drawerRoot';
    root.innerHTML =
      '<div class="drawer-scrim" data-close></div>' +
      '<aside class="drawer" role="dialog" aria-modal="true">' +
        '<header class="drawer-head">' + opts.head +
          '<button class="icon-btn sm u-end" data-close aria-label="Close">' + icon('close') + '</button>' +
        '</header>' +
        '<div class="drawer-body">' + opts.body + '</div>' +
        (opts.foot ? '<div class="drawer-foot">' + opts.foot + '</div>' : '') +
      '</aside>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeDrawer();
    });
    if (opts.onOpen) opts.onOpen(root);
  }

  function closeDrawer() {
    var d = document.getElementById('drawerRoot');
    if (d) d.remove();
  }

  /* ---------------- Accordion / tabs wiring ---------------- */
  function wireAccordion(scope) {
    (scope || document).querySelectorAll('.acc-head').forEach(function (h) {
      h.addEventListener('click', function () {
        h.parentElement.classList.toggle('open');
      });
    });
  }

  function wireTabs(scope, onChange) {
    (scope || document).querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        b.parentElement.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        if (onChange) onChange(b.dataset.tab, b);
      });
    });
  }

  function wireSegment(scope, onChange) {
    (scope || document).querySelectorAll('.segment').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        if (onChange) onChange(b.dataset.val, b, seg);
      });
    });
  }

  /* Animate every meter on screen from 0 -> target.
     Falls back to setting the final width directly where
     requestAnimationFrame is unavailable, so a meter can never be
     left stranded at 0%. */
  function animateMeters(scope) {
    var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;

    (scope || document).querySelectorAll('.meter > i').forEach(function (bar) {
      var target = bar.style.width;
      if (!target) return;
      if (!raf) { bar.style.width = target; return; }

      bar.style.width = '0%';
      raf(function () { raf(function () { bar.style.width = target; }); });
    });
  }

  global.UI = {
    peso: peso, pesoK: pesoK, esc: esc, tintOf: tintOf,
    fmtDate: fmtDate, fmtDateLong: fmtDateLong, fmtMonthYear: fmtMonthYear,
    relative: relative, daysBetween: daysBetween, MONTHS: MONTHS,
    avatar: avatar, badge: badge, statusBadge: statusBadge, meter: meter,
    personCell: personCell, card: card, cardHead: cardHead,
    emptyState: emptyState, table: table, pageHead: pageHead, crumbList: crumbList,
    resolveIcons: resolveIcons, bind: bind, fill: fill, tbody: tbody, query: query,
    onResize: onResize,
    toast: toast, modal: modal, closeModal: closeModal,
    drawer: drawer, closeDrawer: closeDrawer,
    wireAccordion: wireAccordion, wireTabs: wireTabs, wireSegment: wireSegment,
    animateMeters: animateMeters
  };

})(window);
