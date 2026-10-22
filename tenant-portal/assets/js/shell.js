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
    { key: 'help', href: 'rental.html#contacts', label: 'Help & Contacts', icon: 'help' }
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
        '<div class="brand-text"><strong>' + UI.esc(DB.settings.propertyName || "Saraza's Apartment") + '</strong><span>Tenant Portal</span></div>' +
        '<button class="icon-btn sm nav-close" id="navClose" aria-label="Close menu">' + icon('close') + '</button>' +
      '</div>' +
      '<nav class="nav">' + NAV.map(function (g) {
        return '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' +
               g.items.map(navItem).join('') + '</div>';
      }).join('') + '</nav>' +
      '<div class="nav-footer">' +
        '<div class="unit-chip">' +
          '<span class="uc-ico">' + icon('doorOpen') + '</span>' +
          '<div><b>Unit ' + UI.esc(DB.rental.unitNo) + '</b><span>' + UI.esc(DB.rental.building) + '</span></div>' +
        '</div>' +
        FOOTER_NAV.map(navItem).join('') +
        '<button class="nav-item nav-logout" data-act="logout">' + icon('logout') + '<span>Log out</span></button>' +
      '</div>';
  }

  function topbarHtml() {
    var t = DB.tenant;
    return '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false">' + icon('menu') + '</button>' +
      '<div class="topbar-title">' +
        '<strong id="pageTitle"></strong>' +
        '<span id="pageSub"></span>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<button class="btn btn-outline pay-shortcut" id="payShortcut">' + icon('peso') + 'Pay rent</button>' +
        '<button class="icon-btn bell" id="bellBtn" aria-label="Notices">' + icon('bell') +
          '<span class="dot" hidden></span></button>' +
        '<div class="user-chip" id="userChip" tabindex="0">' +
          '<div class="avatar avatar-teal">' + UI.esc(t.initials) + '</div>' +
          '<div class="user-meta"><strong>' + UI.esc(t.name.split(' ')[0]) + '</strong>' +
            '<span>Unit ' + UI.esc(DB.rental.unitNo) + '</span></div>' +
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
    if (!document.getElementById('modalRoot')) document.body.insertAdjacentHTML('beforeend', overlaysHtml());

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
      '<div class="pop-list">' + (DB.notices.length ? '' :
        '<div class="empty" style="padding:28px 20px"><b>No notices</b><p>Messages from the office show up here.</p></div>') +
        DB.notices.map(function (n) {
        return '<button class="pop-item" data-nid="' + n.id + '" data-link="' + UI.esc(n.link || '') + '"' +
          (n.unread ? ' style="background:var(--teal-050)"' : '') + '>' +
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
        '<button class="menu-item" data-act="contact">' + icon('phone') + 'Update my contact details</button>' +
        '<button class="menu-item" data-act="password">' + icon('lock') + 'Change password</button>' +
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
  function afterMutation(msg, tone) {
    return DB.reload().then(function () {
      var side = document.querySelector('[data-shell="sidebar"]');
      if (side) side.innerHTML = sidebarHtml();
      buildNotices();
      if (msg) UI.toast(msg, tone);
      if (global.Page && typeof Page.refresh === 'function') Page.refresh();
    });
  }

  function save(action, data, msg) {
    return API.post('tenant.php', action, data).then(function (r) {
      return afterMutation(typeof msg === 'function' ? msg(r) : msg).then(function () { return r; });
    });
  }

  function isoDate(d) {
    d = d || DB.today;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---- Pay a charge ---- */
  function openPay(chargeId) {
    /* Soonest due first, so the default selection matches the "next due"
       date shown on the dashboard and the balance card. */
    var unpaid = DB.charges.filter(function (c) { return c.kind === 'rent' && c.status !== 'paid' && c.status !== 'pending'; })
                           .sort(function (a, b) { return a.due - b.due; });
    if (!unpaid.length) {
      UI.toast(DB.stats.pendingCount ? 'Your payment is waiting for confirmation' : 'You have no rent due right now', 'info');
      return;
    }
    var picked = chargeId ? DB.charge(chargeId) : unpaid[0];
    if (picked && picked.status === 'pending') { UI.toast('You already sent a payment for this. It is waiting for confirmation.', 'info'); return; }
    if (picked && picked.kind !== 'rent') { UI.toast('Only rent can be paid here. Please settle this with the office.', 'info'); return; }

    UI.modal({
      title: 'Pay ' + (picked ? picked.label.toLowerCase() : 'rent'),
      sub: 'Send your payment, then upload the proof so it can be confirmed',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>Which rent are you paying?</label>' +
            '<select class="select" id="payCharge">' + unpaid.map(function (c) {
              return '<option value="' + c.id + '"' + (picked && c.id === picked.id ? ' selected' : '') + '>' +
                     UI.esc(c.label) + ' — ' + UI.peso(c.amount) + ' (due ' + UI.fmtDate(c.due) + ')</option>';
            }).join('') + '</select></div>' +
          '<div class="form-row"><label>Amount</label>' +
            '<input class="input" id="payAmount" type="number" min="0" step="0.01" /></div>' +
          '<div class="form-row"><label>Date you paid</label>' +
            '<input class="input" id="payDate" type="date" value="' + isoDate() + '" /></div>' +
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
          var c = DB.charge(sel.value);
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
        var c = DB.charge(box.querySelector('#payCharge').value);
        var fd = new FormData();
        fd.append('chargeId', c ? c.chargeId : '');
        fd.append('amount', amount);
        fd.append('date', box.querySelector('#payDate').value);
        fd.append('method', box.querySelector('#payMethod').value);
        fd.append('reference', box.querySelector('#payRef').value.trim());
        var proof = box.querySelector('#payProof').__files || [];
        if (proof[0]) fd.append('proof', proof[0]);
        return API.upload('tenant.php', 'submit_payment', fd).then(function () {
          return afterMutation(UI.peso(amount) + ' submitted — waiting for the office to confirm');
        });
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
        var fd = new FormData();
        fd.append('title', title);
        fd.append('category', box.querySelector('#reqCat').value);
        fd.append('priority', box.querySelector('#reqPri').value);
        fd.append('details', box.querySelector('#reqDetail').value.trim());
        fd.append('allowEntry', box.querySelector('#reqEntry').checked ? '1' : '0');
        files.forEach(function (f) { fd.append('media[]', f); });
        return API.upload('tenant.php', 'new_request', fd).then(function (r) {
          return afterMutation('Request ' + r.id + ' sent to the office');
        });
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

    /* limits come from api/config.php (smaller on Vercel, which caps a request at 4.5 MB) */
    var maxFile  = Number(DB.settings.maxUploadMb) || 25;
    var maxTotal = Number(DB.settings.maxRequestMb) || 120;

    function add(list) {
      Array.prototype.forEach.call(list, function (f) {
        if (zone.__files.length >= 5) return;
        if (f.size > maxFile * 1024 * 1024) { UI.toast(f.name + ' is larger than ' + maxFile + ' MB', 'warn'); return; }
        var total = zone.__files.reduce(function (s, x) { return s + x.size; }, f.size);
        if (total > maxTotal * 1024 * 1024) { UI.toast('Attachments can add up to ' + maxTotal + ' MB at most', 'warn'); return; }
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
      onConfirm: function () { return API.logout(); }
    });
  }

  function openContact() {
    var t = DB.tenant;
    var e = t.emergency;
    UI.modal({
      title: 'Update my contact details',
      sub: 'The office is notified when you change these',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>Mobile number</label><input class="input" id="cPhone" value="' + UI.esc(t.phone) + '"/></div>' +
          '<div class="form-row"><label>Emergency contact</label><input class="input" id="cEmName" value="' + UI.esc(e.name === '—' ? '' : e.name) + '"/></div>' +
          '<div class="form-row"><label>Relation</label><input class="input" id="cEmRel" value="' + UI.esc(e.relation === '—' ? '' : e.relation) + '"/></div>' +
          '<div class="form-row full"><label>Their number</label><input class="input" id="cEmPhone" value="' + UI.esc(e.phone === '—' ? '' : e.phone) + '"/></div>' +
        '</div>',
      confirmText: 'Save',
      onConfirm: function (box) {
        var v = function (id) { return box.querySelector(id).value.trim(); };
        if (!v('#cPhone')) { UI.toast('Enter your mobile number', 'warn'); return false; }
        return save('update_contact', { phone: v('#cPhone'), emergencyName: v('#cEmName'),
          emergencyRelation: v('#cEmRel'), emergencyPhone: v('#cEmPhone') }, 'Contact details saved');
      }
    });
  }

  function openPassword() {
    UI.modal({
      title: 'Change password',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>Current password</label><input class="input" type="password" id="pw0" autocomplete="current-password"/></div>' +
          '<div class="form-row"><label>New password</label><input class="input" type="password" id="pw1" placeholder="At least 8 characters" autocomplete="new-password"/></div>' +
          '<div class="form-row"><label>Repeat new password</label><input class="input" type="password" id="pw2" autocomplete="new-password"/></div>' +
        '</div>',
      confirmText: 'Update password',
      onConfirm: function (box) {
        var n = box.querySelector('#pw1').value;
        if (n.length < 8) { UI.toast('Use at least 8 characters', 'warn'); return false; }
        if (n !== box.querySelector('#pw2').value) { UI.toast('The new passwords do not match', 'warn'); return false; }
        return API.post('auth.php', 'change_password', { current: box.querySelector('#pw0').value, next: n })
          .then(function () { UI.toast('Password updated'); });
      }
    });
  }

  /* ============================================================
     Wiring
     ============================================================ */
  function wire() {
    document.getElementById('menuBtn').addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    var scrim = document.getElementById('sidebarScrim');
    if (scrim) scrim.addEventListener('click', function () { setNav(false); });
    document.querySelector('[data-shell="sidebar"]').addEventListener('click', function (e) {
      if (e.target.closest('#navClose')) { setNav(false); return; }
      if (e.target.closest('[data-act="logout"]')) { setNav(false); doLogout(); return; }
      if (e.target.closest('.nav-item')) setNav(false);
    });

    document.getElementById('bellBtn').addEventListener('click', function (e) {
      e.stopPropagation(); togglePopover('notifPopover');
    });
    document.getElementById('userChip').addEventListener('click', function (e) {
      e.stopPropagation(); togglePopover('userPopover');
    });
    document.getElementById('payShortcut').addEventListener('click', function () { openPay(); });

    document.getElementById('notifPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="read-all"]')) {
        API.post('tenant.php', 'mark_notices_read', {}).then(function () {
          DB.notices.forEach(function (n) { n.unread = false; });
          DB.refresh();
          buildNotices();
          UI.toast('All notices marked as read');
        }, function (err) { UI.toast(err.message, 'warn'); });
        return;
      }
      var item = e.target.closest('[data-nid]');
      if (item) {
        var link = item.dataset.link;
        API.post('tenant.php', 'mark_notices_read', { id: Number(item.dataset.nid) }).catch(function () {})
          .then(function () { if (link) location.href = link; else afterMutation(); });
      }
    });
    document.getElementById('userPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="logout"]')) { closePopovers(); doLogout(); }
      if (e.target.closest('[data-act="password"]')) { closePopovers(); openPassword(); }
      if (e.target.closest('[data-act="contact"]')) { closePopovers(); openContact(); }
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
        setNav(false);
      }
    });
  }

  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    var b = document.getElementById('menuBtn');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function init() {
    document.body.classList.add('booting');
    DB.load().then(function () {
      mountChrome();
      buildNotices();
      buildUserMenu();
      wire();

      UI.resolveIcons(document);
      document.body.classList.remove('booting');
      if (global.Page && typeof Page.init === 'function') Page.init();
      UI.animateMeters(document);
    }).catch(function (err) {
      document.body.classList.remove('booting');
      if (!document.getElementById('modalRoot')) document.body.insertAdjacentHTML('beforeend', overlaysHtml());
      var main = document.querySelector('.content');
      if (main) main.innerHTML = '<div class="card" style="max-width:560px;margin:60px auto"><div class="empty">' +
        '<div class="ico">' + icon('alert') + '</div><b>Could not load your portal</b><p>' + UI.esc(err.message) + '</p>' +
        '<div class="u-mt"><button class="btn btn-primary btn-sm" onclick="location.reload()">Try again</button></div></div></div>';
    });
  }

  global.Shell = {
    page: PAGE,
    openPay: openPay,
    openNewRequest: openNewRequest,
    dropzoneHtml: dropzoneHtml,
    wireDropzone: wireDropzone,
    afterMutation: afterMutation,
    save: save,
    isoDate: isoDate,
    openContact: openContact,
    buildNotices: buildNotices
  };

  document.addEventListener('DOMContentLoaded', init);

})(window);
