/* ============================================================
   shell.js — shared chrome for the tenant portal.

   Same contract as the admin console: each page is a real .html file
   holding only its own markup, and this file injects the sidebar,
   topbar and overlay roots so navigation lives in one place.

   PHP port: the sidebar/topbar builders become partials/*.php pulled
   in with <?php include ?> where data-shell="..." sits.
   ============================================================ */
(function (global) {

  var PAGE = document.body.dataset.page || 'dashboard';

  var NAV = [
    { label: 'My home', items: [
      { key: 'dashboard',   href: 'dashboard.html',   label: 'Dashboard',          icon: 'dashboard' },
      { key: 'rental',      href: 'rental.html',      label: 'My Rental Info',     icon: 'home' }
    ]},
    { label: 'Requests', items: [
      { key: 'maintenance', href: 'maintenance.html', label: 'Maintenance Requests', icon: 'wrench',
        count: function () { return DB.stats.openRequests; } }
    ]},
    { label: 'Money', items: [
      { key: 'payments',    href: 'payments.html',    label: 'Payment & Balance',  icon: 'peso' }
    ]}
  ];

  var FOOTER_NAV = [
    { key: 'help', href: 'dashboard.html#help', label: 'Help & Contacts', icon: 'help' }
  ];

  /* ============================================================
     Chrome markup
     ============================================================ */
  function navItem(it) {
    var n = typeof it.count === 'function' ? it.count() : null;
    return '<a class="nav-item' + (it.key === PAGE ? ' active' : '') + '" href="' + it.href + '">' +
             icon(it.icon) + '<span>' + it.label + '</span>' +
             (n ? '<span class="count">' + n + '</span>' : '') +
           '</a>';
  }

  function sidebarHtml() {
    return '<div class="brand">' +
        '<div class="brand-mark">S</div>' +
        '<div class="brand-text"><strong>Saraza\'s Apartment</strong><span>Tenant Portal</span></div>' +
      '</div>' +
      '<nav class="nav">' + NAV.map(function (g) {
        return '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' +
               g.items.map(navItem).join('') + '</div>';
      }).join('') + '</nav>' +
      '<div class="nav-footer">' +
        '<div class="unit-chip">' +
          '<span class="uc-ico">' + icon('doorOpen') + '</span>' +
          '<div><b>Unit ' + DB.rental.unitNo + '</b><span>' + DB.rental.building + '</span></div>' +
        '</div>' +
        FOOTER_NAV.map(navItem).join('') +
      '</div>';
  }

  function topbarHtml() {
    var t = DB.tenant;
    return '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Toggle navigation">' + icon('menu') + '</button>' +
      '<div class="topbar-title">' +
        '<strong id="pageTitle"></strong>' +
        '<span id="pageSub"></span>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<button class="btn btn-outline pay-shortcut" id="payShortcut">' + icon('peso') + 'Pay rent</button>' +
        '<button class="icon-btn bell" id="bellBtn" aria-label="Notices">' + icon('bell') +
          '<span class="dot" hidden></span></button>' +
        '<div class="user-chip" id="userChip" tabindex="0">' +
          '<div class="avatar avatar-teal">' + t.initials + '</div>' +
          '<div class="user-meta"><strong>' + UI.esc(t.name.split(' ')[0]) + '</strong>' +
            '<span>Unit ' + DB.rental.unitNo + '</span></div>' +
          '<span class="caret">' + icon('chevDown') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="popover" id="notifPopover"></div>' +
      '<div class="popover popover-sm" id="userPopover"></div>';
  }

  function overlaysHtml() {
    return '<div class="modal-root" id="modalRoot" hidden>' +
        '<div class="modal-scrim" data-close></div>' +
        '<div class="modal" role="dialog" aria-modal="true" id="modalBox"></div>' +
      '</div>' +
      '<div class="toast-root" id="toastRoot"></div>';
  }

  function mountChrome() {
    var side = document.querySelector('[data-shell="sidebar"]');
    var top  = document.querySelector('[data-shell="topbar"]');
    if (side) side.innerHTML = sidebarHtml();
    if (top)  top.innerHTML  = topbarHtml();
    document.body.insertAdjacentHTML('beforeend', overlaysHtml());

    /* The topbar carries the page name, so each page declares it once */
    var title = document.body.dataset.title || '';
    var sub   = document.body.dataset.sub || '';
    var tEl = document.getElementById('pageTitle');
    var sEl = document.getElementById('pageSub');
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = sub;
  }

  /* ============================================================
     Notices + account menu
     ============================================================ */
  var TONE_CLASS = { red: 'i-red', amber: 'i-amber', green: 'i-green', teal: 'i-teal' };

  function buildNotices() {
    var unread = DB.stats.unreadNotices;
    UI.fill('notifPopover',
      '<div class="pop-head"><b>Notices</b>' +
        (unread ? '<span class="badge badge-red">' + unread + ' new</span>' : '') +
        '<button class="btn btn-quiet" data-act="read-all">Mark all read</button></div>' +
      '<div class="pop-list">' + DB.notices.map(function (n) {
        return '<button class="pop-item"' + (n.unread ? ' style="background:var(--teal-050)"' : '') + '>' +
          '<span class="pi-ico stat-icon ' + (TONE_CLASS[n.tone] || 'i-teal') + '">' + icon(n.icon) + '</span>' +
          '<span class="pi-text"><b>' + UI.esc(n.title) + '</b>' +
            '<span>' + UI.esc(n.body) + '</span><i>' + UI.esc(n.when) + '</i></span></button>';
      }).join('') + '</div>');

    var dot = document.querySelector('#bellBtn .dot');
    if (dot) dot.hidden = !unread;
  }

  function buildUserMenu() {
    UI.fill('userPopover',
      '<div style="padding:6px">' +
        '<div style="padding:10px 14px 12px;border-bottom:1px solid var(--line-soft);margin-bottom:6px">' +
          '<b style="font-size:13.5px;display:block">' + UI.esc(DB.tenant.name) + '</b>' +
          '<span class="u-xs u-muted">' + UI.esc(DB.tenant.email) + '</span></div>' +
        '<a class="menu-item" href="rental.html">' + icon('idCard') + 'My rental info</a>' +
        '<a class="menu-item" href="payments.html">' + icon('receipt') + 'Payment history</a>' +
        '<div class="menu-sep"></div>' +
        '<button class="menu-item danger" data-act="logout">' + icon('logout') + 'Log out</button>' +
      '</div>');
  }

  function closePopovers() {
    document.querySelectorAll('.popover').forEach(function (p) { p.classList.remove('open'); });
  }

  function togglePopover(id) {
    var p = document.getElementById(id);
    var open = p.classList.contains('open');
    closePopovers();
    if (!open) p.classList.add('open');
  }

  /* ============================================================
     Shared dialogs
     ============================================================ */
  function afterMutation(msg) {
    DB.refresh();
    buildNotices();
    if (msg) UI.toast(msg);
    if (global.Page && typeof Page.refresh === 'function') Page.refresh();
  }

  /* ---- Pay a charge ---- */
  function openPay(chargeId) {
    /* Soonest due first, so the default selection matches the "next due"
       date shown on the dashboard and the balance card. */
    var unpaid = DB.charges.filter(function (c) { return c.status !== 'paid'; })
                           .sort(function (a, b) { return a.due - b.due; });
    if (!unpaid.length) { UI.toast('You have nothing due right now', 'info'); return; }
    var picked = chargeId ? DB.charges.filter(function (c) { return c.id === chargeId; })[0] : unpaid[0];

    UI.modal({
      title: 'Pay ' + (picked ? picked.label.toLowerCase() : 'a charge'),
      sub: 'Send your payment, then upload the proof so it can be confirmed',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>What are you paying?</label>' +
            '<select class="select" id="payCharge">' + unpaid.map(function (c) {
              return '<option value="' + c.id + '"' + (picked && c.id === picked.id ? ' selected' : '') + '>' +
                     UI.esc(c.label) + ' — ' + UI.peso(c.amount) + ' (due ' + UI.fmtDate(c.due) + ')</option>';
            }).join('') + '</select></div>' +
          '<div class="form-row"><label>Amount</label>' +
            '<input class="input" id="payAmount" type="number" /></div>' +
          '<div class="form-row"><label>Payment method</label>' +
            '<select class="select" id="payMethod">' + DB.methods.map(function (m) {
              return '<option value="' + m.key + '">' + UI.esc(m.label) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="form-row full"><div class="pay-detail" id="payDetail"></div></div>' +
          '<div class="form-row full"><label>Reference number <span class="u-muted">(from your receipt)</span></label>' +
            '<input class="input" id="payRef" placeholder="e.g. 9174 2866 10" /></div>' +
          '<div class="form-row full"><label>Proof of payment <span class="u-muted">(screenshot or photo)</span></label>' +
            dropzoneHtml('payProof', 'image/*') + '</div>' +
        '</div>',
      confirmText: 'Submit payment',
      onOpen: function (box) {
        var sel = box.querySelector('#payCharge');
        var amt = box.querySelector('#payAmount');
        var mth = box.querySelector('#payMethod');
        var det = box.querySelector('#payDetail');

        function syncAmount() {
          var c = DB.charges.filter(function (x) { return x.id === sel.value; })[0];
          if (c) amt.value = c.amount;
        }
        function syncMethod() {
          var m = DB.methods.filter(function (x) { return x.key === mth.value; })[0];
          det.innerHTML = m
            ? '<span class="pd-ico">' + icon(m.icon) + '</span>' +
              '<div><b>' + UI.esc(m.label) + '</b><span>' + UI.esc(m.detail) + '</span></div>'
            : '';
        }
        sel.addEventListener('change', syncAmount);
        mth.addEventListener('change', syncMethod);
        syncAmount(); syncMethod();
        wireDropzone(box.querySelector('#payProof'));
      },
      onConfirm: function (box) {
        var amount = Number(box.querySelector('#payAmount').value) || 0;
        if (amount <= 0) { UI.toast('Enter the amount you paid', 'warn'); return false; }
        if (!box.querySelector('#payRef').value.trim() &&
            box.querySelector('#payMethod').value !== 'cash') {
          UI.toast('Add the reference number from your receipt', 'warn'); return false;
        }
        UI.toast(UI.peso(amount) + ' submitted — waiting for the admin to confirm');
      }
    });
  }

  /* ---- Submit a maintenance request ---- */
  function openNewRequest(presetCategory) {
    UI.modal({
      title: 'Submit a maintenance request',
      sub: 'Tell us what is wrong and add a photo or video if you can',
      wide: true,
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>What is the problem?</label>' +
            '<input class="input" id="reqTitle" placeholder="e.g. Leaking kitchen faucet" /></div>' +
          '<div class="form-row"><label>Category</label>' +
            '<select class="select" id="reqCat">' + DB.categories.map(function (c) {
              return '<option value="' + c.key + '"' +
                     (presetCategory === c.key ? ' selected' : '') + '>' + UI.esc(c.label) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="form-row"><label>How urgent is it?</label>' +
            '<select class="select" id="reqPri">' +
              '<option value="urgent">Urgent — unsafe or unusable</option>' +
              '<option value="high">Soon — getting worse</option>' +
              '<option value="normal" selected>Normal — can wait a few days</option>' +
              '<option value="low">Whenever convenient</option>' +
            '</select></div>' +
          '<div class="form-row full"><label>Describe it</label>' +
            '<textarea class="textarea" id="reqDetail" ' +
              'placeholder="When did it start? Does it happen all the time? Anything we should know before visiting?"></textarea></div>' +
          '<div class="form-row full"><label>Photos or video <span class="u-muted">(optional, up to 5)</span></label>' +
            dropzoneHtml('reqMedia', 'image/*,video/*') +
            '<span class="hint">A short clip of the problem helps the caretaker bring the right tools.</span></div>' +
          '<div class="form-row full"><label class="switch"><input type="checkbox" id="reqEntry" checked />' +
            '<span class="track"></span><span class="sw-text"><b>Allow entry when I am out</b>' +
            '<span>The caretaker may use the spare key if nobody answers</span></span></label></div>' +
        '</div>',
      confirmText: 'Send request',
      onOpen: function (box) { wireDropzone(box.querySelector('#reqMedia')); },
      onConfirm: function (box) {
        var title = box.querySelector('#reqTitle').value.trim();
        if (!title) { UI.toast('Give the problem a short title', 'warn'); return false; }

        var files = box.querySelector('#reqMedia').__files || [];
        var cat = box.querySelector('#reqCat').value;
        var id = 'REQ-' + (1043 + DB.requests.filter(function (r) { return r.id.indexOf('REQ-10') === 0; }).length);

        DB.requests.unshift({
          id: id,
          title: title,
          detail: box.querySelector('#reqDetail').value.trim() || 'No extra detail given.',
          category: cat,
          priority: box.querySelector('#reqPri').value,
          status: 'new',
          submitted: DB.today,
          assignee: null,
          media: files.map(function (f) {
            return { kind: f.type.indexOf('video') === 0 ? 'video' : 'photo', name: f.name };
          }),
          timeline: [
            { label: 'Request submitted', when: DB.today,
              note: files.length ? 'You sent this with ' + files.length + ' attachment' + (files.length > 1 ? 's' : '') + '.' : '',
              done: true },
            { label: 'Received by admin',  when: null, note: 'Usually within a few hours.', done: false },
            { label: 'Assigned',           when: null, note: '', done: false },
            { label: 'Repair in progress', when: null, note: '', done: false },
            { label: 'Marked resolved',    when: null, note: '', done: false }
          ]
        });

        afterMutation('Request ' + id + ' sent to the admin');
      }
    });
  }

  /* ============================================================
     File dropzone — real previews via object URLs
     ============================================================ */
  function dropzoneHtml(id, accept) {
    return '<div class="dropzone" id="' + id + '" data-accept="' + accept + '">' +
        '<input type="file" accept="' + accept + '" multiple hidden />' +
        '<div class="dz-prompt">' +
          '<span class="dz-ico">' + icon('upload') + '</span>' +
          '<b>Tap to choose a file</b>' +
          '<span>or drag it here &middot; JPG, PNG or MP4</span>' +
        '</div>' +
        '<div class="dz-thumbs"></div>' +
      '</div>';
  }

  function wireDropzone(zone) {
    if (!zone) return;
    var input  = zone.querySelector('input[type=file]');
    var thumbs = zone.querySelector('.dz-thumbs');
    zone.__files = [];

    function render() {
      thumbs.innerHTML = zone.__files.map(function (f, i) {
        var url = URL.createObjectURL(f);
        var isVideo = f.type.indexOf('video') === 0;
        return '<figure class="dz-thumb">' +
          (isVideo
            ? '<video src="' + url + '" muted playsinline></video><span class="dz-badge">' + icon('play') + '</span>'
            : '<img src="' + url + '" alt="' + UI.esc(f.name) + '" />') +
          '<button type="button" class="dz-remove" data-i="' + i + '" aria-label="Remove">' + icon('close') + '</button>' +
          '<figcaption>' + UI.esc(f.name) + '</figcaption>' +
        '</figure>';
      }).join('');
      zone.classList.toggle('has-files', zone.__files.length > 0);
    }

    function add(list) {
      Array.prototype.forEach.call(list, function (f) {
        if (zone.__files.length >= 5) return;
        if (f.size > 25 * 1024 * 1024) { UI.toast(f.name + ' is larger than 25 MB', 'warn'); return; }
        zone.__files.push(f);
      });
      render();
    }

    zone.addEventListener('click', function (e) {
      if (e.target.closest('.dz-remove')) {
        zone.__files.splice(Number(e.target.closest('.dz-remove').dataset.i), 1);
        render();
        return;
      }
      input.click();
    });
    input.addEventListener('change', function () { add(input.files); input.value = ''; });

    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); });
    });
    zone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files);
    });
  }

  function doLogout() {
    UI.modal({
      title: 'Log out?',
      sub: 'You will need to sign in again to see your rental.',
      body: '<p class="u-sm u-muted" style="line-height:1.6">Anything you have not submitted will be lost.</p>',
      foot: '<button class="btn btn-ghost" data-close>Stay signed in</button>' +
            '<button class="btn btn-primary" data-confirm>Log out</button>',
      onConfirm: function () { UI.toast('Signed out — connect this to your auth flow', 'info'); }
    });
  }

  /* ============================================================
     Wiring
     ============================================================ */
  function wire() {
    document.getElementById('menuBtn').addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
    });
    var scrim = document.getElementById('sidebarScrim');
    if (scrim) scrim.addEventListener('click', function () { document.body.classList.remove('nav-open'); });

    document.getElementById('bellBtn').addEventListener('click', function (e) {
      e.stopPropagation(); togglePopover('notifPopover');
    });
    document.getElementById('userChip').addEventListener('click', function (e) {
      e.stopPropagation(); togglePopover('userPopover');
    });
    document.getElementById('payShortcut').addEventListener('click', function () { openPay(); });

    document.getElementById('notifPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="read-all"]')) {
        DB.notices.forEach(function (n) { n.unread = false; });
        DB.refresh();
        buildNotices();
        UI.toast('All notices marked as read');
      }
    });
    document.getElementById('userPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="logout"]')) { closePopovers(); doLogout(); }
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.popover') && !e.target.closest('#bellBtn') && !e.target.closest('#userChip')) {
        closePopovers();
      }
    });

    document.getElementById('modalRoot').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) UI.closeModal();
    });

    /* Any page can trigger these */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-shell-act]');
      if (!a) return;
      var act = a.dataset.shellAct;
      if (act === 'pay')         openPay(a.dataset.charge || null);
      if (act === 'new-request') openNewRequest(a.dataset.category || null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        UI.closeModal(); UI.closeDrawer(); closePopovers();
        document.body.classList.remove('nav-open');
      }
    });
  }

  function init() {
    mountChrome();
    buildNotices();
    buildUserMenu();
    wire();

    UI.resolveIcons(document);
    if (global.Page && typeof Page.init === 'function') Page.init();
    UI.animateMeters(document);
  }

  global.Shell = {
    page: PAGE,
    openPay: openPay,
    openNewRequest: openNewRequest,
    dropzoneHtml: dropzoneHtml,
    wireDropzone: wireDropzone,
    afterMutation: afterMutation,
    buildNotices: buildNotices
  };

  document.addEventListener('DOMContentLoaded', init);

})(window);
