/* ============================================================
   shell.js — the shared page chrome.

   Every page is a real .html file containing only its own content.
   This file injects the sidebar, topbar, chat dock, and overlay
   roots, so navigation and branding are defined in ONE place.

   PHP port:
     - the sidebar/topbar markup below becomes partials/sidebar.php
       and partials/topbar.php, pulled in with <?php include ?>
     - the shared dialogs stay client-side; point their onConfirm
       handlers at your endpoints
   ============================================================ */
(function (global) {

  /* Which page am I on? Set via <body data-page="..."> */
  var PAGE = document.body.dataset.page || 'dashboard';

  /* ============================================================
     Navigation model — add a tab here and every page picks it up
     ============================================================ */
  var NAV = [
    { label: 'Main', items: [
      { key: 'dashboard', href: 'dashboard.html',   label: 'Dashboard',                icon: 'dashboard' },
      { key: 'units',     href: 'units.html',       label: 'Unit & Tenant Management', icon: 'building' },
      { key: 'renters',   href: 'renters.html',     label: 'Renter Information',       icon: 'user' }
    ]},
    { label: 'Money', items: [
      { key: 'payments',  href: 'payments.html',    label: 'Payment & Balances',       icon: 'card' },
      { key: 'reports',   href: 'reports.html',     label: 'Reports & Analytics',      icon: 'chart' }
    ]},
    { label: 'Property', items: [
      { key: 'maintenance', href: 'maintenance.html', label: 'Maintenance Requests',   icon: 'wrench',
        count: function () { return DB.stats.openRepairs; } },
      { key: 'analytics',   href: 'analytics.html',   label: 'Apartment Analytics',    icon: 'activity' }
    ]}
  ];

  var FOOTER_NAV = [
    { key: 'settings', href: 'settings.html', label: 'Settings',     icon: 'settings' },
    { key: 'help',     href: 'help.html',     label: 'Help & Guide', icon: 'help' }
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
        '<div class="brand-text"><strong>Saraza\'s Apartment</strong><span>Property Management</span></div>' +
      '</div>' +
      '<nav class="nav">' + NAV.map(function (g) {
        return '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' +
               g.items.map(navItem).join('') + '</div>';
      }).join('') + '</nav>' +
      '<div class="nav-footer">' + FOOTER_NAV.map(navItem).join('') + '</div>';
  }

  function topbarHtml() {
    return '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Toggle navigation">' + icon('menu') + '</button>' +
      '<div class="search">' +
        '<span class="search-icon">' + icon('search') + '</span>' +
        '<input id="globalSearch" type="text" placeholder="Search a tenant, unit, or invoice..." autocomplete="off"/>' +
        '<div class="search-results" id="searchResults"></div>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<button class="icon-btn bell" id="bellBtn" aria-label="Notifications">' + icon('bell') +
          '<span class="dot" hidden></span></button>' +
        '<div class="user-chip" id="userChip" tabindex="0">' +
          '<div class="avatar avatar-teal">AN</div>' +
          '<div class="user-meta"><strong>Aling Nena</strong><span>Administrator</span></div>' +
          '<span class="caret">' + icon('chevDown') + '</span>' +
        '</div>' +
        '<button class="btn btn-ghost" id="logoutBtn">Log out</button>' +
      '</div>' +
      '<div class="popover" id="notifPopover"></div>' +
      '<div class="popover popover-sm" id="userPopover"></div>';
  }

  function overlaysHtml() {
    return '<div class="chat-dock" id="chatDock">' +
        '<button class="chat-fab" id="chatFab" aria-label="Open assistant">' + icon('bot') + '</button>' +
        '<section class="chat-panel" id="chatPanel" hidden>' +
          '<header class="chat-head">' +
            '<div class="chat-head-id"><span class="chat-avatar">' + icon('bot') + '</span>' +
              '<div><strong>Saraza Assistant</strong><span>Ask about tenants, rent, or repairs</span></div></div>' +
            '<button class="icon-btn sm" id="chatClose" aria-label="Close">' + icon('close') + '</button>' +
          '</header>' +
          '<div class="chat-log" id="chatLog"></div>' +
          '<div class="chat-chips" id="chatChips"></div>' +
          '<form class="chat-input" id="chatForm">' +
            '<input id="chatText" type="text" placeholder="Type a message..." autocomplete="off"/>' +
            '<button class="btn btn-primary btn-icon" type="submit" aria-label="Send">' + icon('send') + '</button>' +
          '</form>' +
        '</section>' +
      '</div>' +
      '<div class="modal-root" id="modalRoot" hidden>' +
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
  }

  /* ============================================================
     Notifications / user menu / search
     ============================================================ */
  var TONE_CLASS = { red: 'i-red', amber: 'i-amber', green: 'i-green', teal: 'i-teal' };

  function buildNotifications() {
    var unread = DB.stats.unreadNotifications;
    UI.fill('notifPopover',
      '<div class="pop-head"><b>Notifications</b>' +
        (unread ? '<span class="badge badge-red">' + unread + ' new</span>' : '') +
        '<button class="btn btn-quiet" data-act="read-all">Mark all read</button></div>' +
      '<div class="pop-list">' + DB.notifications.map(function (n) {
        return '<button class="pop-item"' + (n.unread ? ' style="background:var(--teal-050)"' : '') + '>' +
          '<span class="pi-ico stat-icon ' + (TONE_CLASS[n.tone] || 'i-teal') + '">' + icon(n.icon) + '</span>' +
          '<span class="pi-text"><b>' + UI.esc(n.title) + '</b>' +
            '<span>' + UI.esc(n.body) + '</span><i>' + UI.esc(n.when) + '</i></span></button>';
      }).join('') + '</div>' +
      '<div class="pop-foot"><button>View all activity</button></div>');

    var dot = document.querySelector('#bellBtn .dot');
    if (dot) dot.hidden = !unread;
  }

  function buildUserMenu() {
    UI.fill('userPopover',
      '<div style="padding:6px">' +
        '<a class="menu-item" href="settings.html">' + icon('user') + 'My profile</a>' +
        '<a class="menu-item" href="settings.html">' + icon('settings') + 'Settings</a>' +
        '<a class="menu-item" href="help.html">' + icon('help') + 'Help &amp; guide</a>' +
        '<div class="menu-sep"></div>' +
        '<button class="menu-item danger" data-act="logout">' + icon('logout') + 'Log out</button>' +
      '</div>');
  }

  function closePopovers() {
    document.querySelectorAll('.popover').forEach(function (p) { p.classList.remove('open'); });
    var sr = document.getElementById('searchResults');
    if (sr) sr.classList.remove('open');
  }

  function togglePopover(id) {
    var p = document.getElementById(id);
    var open = p.classList.contains('open');
    closePopovers();
    if (!open) p.classList.add('open');
  }

  function runSearch(q) {
    var box = document.getElementById('searchResults');
    q = q.trim().toLowerCase();
    if (q.length < 2) { box.classList.remove('open'); return; }

    var tenants = DB.tenants.filter(function (t) {
      return (t.name + ' ' + t.phone + ' ' + t.email).toLowerCase().indexOf(q) > -1;
    }).slice(0, 4);
    var units = DB.units.filter(function (u) {
      return (u.no + ' ' + u.type).toLowerCase().indexOf(q) > -1;
    }).slice(0, 4);
    var pays = DB.payments.filter(function (p) {
      return (p.id + ' ' + p.tenantName).toLowerCase().indexOf(q) > -1;
    }).slice(0, 3);
    var tix = DB.tickets.filter(function (t) {
      return (t.id + ' ' + t.title).toLowerCase().indexOf(q) > -1;
    }).slice(0, 3);

    var html = '';
    if (tenants.length) {
      html += '<div class="sr-label">Tenants</div>' + tenants.map(function (t) {
        return '<a class="sr-item" href="renters.html?tenant=' + t.id + '">' + UI.avatar(t.initials, 'avatar-sm') +
          '<span class="sr-text"><b>' + UI.esc(t.name) + '</b><span>Unit ' + UI.esc(t.unitNo) +
          ' · ' + UI.esc(t.phone) + '</span></span>' +
          (t.balance ? UI.badge(UI.peso(t.balance), 'red') : '') + '</a>';
      }).join('');
    }
    if (units.length) {
      html += '<div class="sr-label">Units</div>' + units.map(function (u) {
        var t = DB.tenantOfUnit(u.id);
        return '<a class="sr-item" href="units.html?unit=' + u.id + '">' +
          '<span class="stat-icon i-teal" style="width:32px;height:32px;border-radius:9px">' + icon('doorOpen') + '</span>' +
          '<span class="sr-text"><b>Unit ' + UI.esc(u.no) + '</b><span>' + UI.esc(u.type) + ' · ' +
          (t ? UI.esc(t.name) : 'Vacant') + '</span></span>' + UI.statusBadge(u.status) + '</a>';
      }).join('');
    }
    if (pays.length) {
      html += '<div class="sr-label">Payments</div>' + pays.map(function (p) {
        return '<a class="sr-item" href="payments.html?receipt=' + p.id + '">' +
          '<span class="stat-icon i-green" style="width:32px;height:32px;border-radius:9px">' + icon('receipt') + '</span>' +
          '<span class="sr-text"><b>' + UI.esc(p.id) + '</b><span>' + UI.esc(p.tenantName) + ' · ' +
          UI.peso(p.amount) + '</span></span></a>';
      }).join('');
    }
    if (tix.length) {
      html += '<div class="sr-label">Maintenance</div>' + tix.map(function (t) {
        return '<a class="sr-item" href="maintenance.html?ticket=' + t.id + '">' +
          '<span class="stat-icon i-amber" style="width:32px;height:32px;border-radius:9px">' + icon(t.categoryIcon) + '</span>' +
          '<span class="sr-text"><b>' + UI.esc(t.title) + '</b><span>' + UI.esc(t.id) +
          ' · Unit ' + UI.esc(t.unitNo) + '</span></span></a>';
      }).join('');
    }
    if (!html) {
      html = '<div class="empty" style="padding:32px 20px"><b>No matches</b>' +
             '<p>Nothing found for &ldquo;' + UI.esc(q) + '&rdquo;.</p></div>';
    }

    box.innerHTML = html;
    box.classList.add('open');
  }

  /* ============================================================
     Shared dialogs — available from every page
     ============================================================ */
  function afterMutation(message) {
    DB.refresh();
    buildNotifications();
    if (message) UI.toast(message);
    if (global.Page && typeof Page.refresh === 'function') Page.refresh();
  }

  function openRecordPayment(tenantId) {
    var opts = DB.tenants.slice().sort(function (a, b) { return a.unitNo.localeCompare(b.unitNo); });
    UI.modal({
      title: 'Record a payment',
      sub: 'Log rent that a tenant has already handed over',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>Tenant</label><select class="select" id="pTenant">' +
            opts.map(function (t) {
              return '<option value="' + t.id + '"' + (tenantId === t.id ? ' selected' : '') + '>' +
                     UI.esc(t.name) + ' &mdash; Unit ' + UI.esc(t.unitNo) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="form-row"><label>Amount received</label>' +
            '<input class="input" id="pAmount" type="number" placeholder="0"/>' +
            '<span class="hint" id="pHint"></span></div>' +
          '<div class="form-row"><label>Date paid</label><input class="input" type="date" value="2026-09-11"/></div>' +
          '<div class="form-row"><label>Method</label><select class="select" id="pMethod">' +
            DB.methods.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-row"><label>Covers</label><select class="select" id="pCovers">' +
            '<option>September rent</option><option>August balance</option>' +
            '<option>Aug balance + Sep</option><option>Security deposit</option><option>Other</option></select></div>' +
          '<div class="form-row full"><label>Reference / notes <span class="u-muted">(optional)</span></label>' +
            '<input class="input" placeholder="GCash reference number, remarks..."/></div>' +
        '</div>',
      confirmText: 'Save payment',
      onOpen: function (box) {
        var sel = box.querySelector('#pTenant');
        var amt = box.querySelector('#pAmount');
        var hint = box.querySelector('#pHint');
        function sync() {
          var t = DB.tenant(sel.value);
          amt.value = t.balance || t.rent;
          hint.textContent = t.balance
            ? 'Outstanding balance is ' + UI.peso(t.balance)
            : 'Monthly rent is ' + UI.peso(t.rent);
        }
        sel.addEventListener('change', sync);
        sync();
      },
      onConfirm: function (box) {
        var t = DB.tenant(box.querySelector('#pTenant').value);
        var amount = Number(box.querySelector('#pAmount').value) || 0;
        if (amount <= 0) { UI.toast('Enter an amount greater than zero', 'warn'); return false; }

        DB.payments.unshift({
          id: 'PMT-' + (1000 + DB.payments.length + 1),
          tenantId: t.id, tenantName: t.short, initials: t.initials, unitNo: t.unitNo,
          date: DB.today, method: box.querySelector('#pMethod').value,
          covers: box.querySelector('#pCovers').value, amount: amount, status: 'cleared'
        });
        t.balance = Math.max(0, t.balance - amount);
        if (!t.balance) { t.status = 'current'; t.overdueDays = 0; }
        afterMutation(UI.peso(amount) + ' recorded for ' + t.name);
      }
    });
  }

  function openAddTenant(unitNo) {
    var vacant = DB.units.filter(function (u) { return u.status === 'vacant'; });
    UI.modal({
      title: 'Add a tenant',
      sub: 'Move someone into one of your vacant units',
      wide: true,
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Full name</label><input class="input" id="tName" placeholder="Juan Dela Cruz"/></div>' +
          '<div class="form-row"><label>Mobile number</label><input class="input" placeholder="+63 9XX XXX XXXX"/></div>' +
          '<div class="form-row"><label>Email <span class="u-muted">(optional)</span></label><input class="input" type="email"/></div>' +
          '<div class="form-row"><label>Occupation</label><input class="input" placeholder="Teacher"/></div>' +
          '<div class="form-row"><label>Unit</label><select class="select" id="tUnit">' +
            (vacant.length
              ? vacant.map(function (u) {
                  return '<option value="' + u.id + '"' + (unitNo === u.no ? ' selected' : '') + '>Unit ' +
                         UI.esc(u.no) + ' &mdash; ' + UI.esc(u.type) + ' · ' + UI.peso(u.rent) + '</option>';
                }).join('')
              : '<option value="">No vacant units available</option>') + '</select></div>' +
          '<div class="form-row"><label>Number of occupants</label>' +
            '<select class="select"><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select></div>' +
          '<div class="form-row"><label>Move-in date</label><input class="input" type="date" value="2026-09-11"/></div>' +
          '<div class="form-row"><label>Lease length</label>' +
            '<select class="select"><option>6 months</option><option selected>12 months</option><option>24 months</option></select></div>' +
          '<div class="form-row"><label>Monthly rent</label><input class="input" id="tRent" type="number"/></div>' +
          '<div class="form-row"><label>Security deposit</label><input class="input" id="tDep" type="number"/></div>' +
          '<div class="form-row full"><label>Emergency contact</label>' +
            '<input class="input" placeholder="Name and number of someone to call"/></div>' +
        '</div>',
      confirmText: 'Add tenant',
      onOpen: function (box) {
        var sel = box.querySelector('#tUnit');
        function sync() {
          var u = DB.unit(sel.value);
          if (!u) return;
          box.querySelector('#tRent').value = u.rent;
          box.querySelector('#tDep').value = u.rent * 2;
        }
        sel.addEventListener('change', sync);
        sync();
      },
      onConfirm: function (box) {
        var name = box.querySelector('#tName').value.trim();
        var unitId = box.querySelector('#tUnit').value;
        if (!name)   { UI.toast('Enter the tenant\'s full name', 'warn'); return false; }
        if (!unitId) { UI.toast('There are no vacant units to assign', 'warn'); return false; }

        var u = DB.unit(unitId);
        var parts = name.split(' ');
        DB.tenants.push({
          id: 'T' + String(DB.tenants.length + 1).padStart(3, '0'),
          name: name, short: parts[0][0] + '. ' + parts.slice(1).join(' '),
          initials: (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase(),
          unitId: u.id, unitNo: u.no, buildingId: u.buildingId,
          phone: '+63 9XX XXX XXXX', email: '—', occupation: '—',
          moveIn: DB.today, leaseEnd: new Date(2027, 8, 11),
          rent: Number(box.querySelector('#tRent').value) || u.rent,
          deposit: Number(box.querySelector('#tDep').value) || u.rent * 2,
          balance: 0, overdueDays: 0, occupants: 1, emergency: '—', status: 'current'
        });
        u.status = 'occupied';
        u.tenantId = DB.tenants[DB.tenants.length - 1].id;
        afterMutation(name + ' moved into Unit ' + u.no);
      }
    });
  }

  function openAddUnit() {
    UI.modal({
      title: 'Add a unit',
      sub: 'Create a new rentable space in one of your buildings',
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Building</label><select class="select">' +
            DB.buildings.map(function (b) { return '<option value="' + b.id + '">' + b.name + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-row"><label>Unit number</label><input class="input" placeholder="e.g. 3C"/></div>' +
          '<div class="form-row"><label>Floor</label><select class="select">' +
            '<option>1</option><option>2</option><option>3</option><option>4</option></select></div>' +
          '<div class="form-row"><label>Unit type</label><select class="select">' +
            DB.unitTypes.map(function (t) { return '<option>' + t.label + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-row"><label>Floor area (sqm)</label><input class="input" type="number" placeholder="26"/></div>' +
          '<div class="form-row"><label>Monthly rent</label><input class="input" type="number" placeholder="7200"/></div>' +
          '<div class="form-row full"><label>Notes <span class="u-muted">(optional)</span></label>' +
            '<textarea class="textarea" placeholder="Anything worth remembering about this unit"></textarea></div>' +
        '</div>',
      confirmText: 'Add unit',
      onConfirm: function () { UI.toast('Unit added — wire this to the backend to persist it', 'info'); }
    });
  }

  function openNewTicket() {
    UI.modal({
      title: 'Log a maintenance request',
      sub: 'Record something that needs fixing',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>What is the problem?</label>' +
            '<input class="input" id="kTitle" placeholder="e.g. No water pressure in the bathroom"/></div>' +
          '<div class="form-row"><label>Unit</label><select class="select">' +
            DB.units.map(function (u) { return '<option value="' + u.id + '">Unit ' + u.no + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-row"><label>Category</label><select class="select">' +
            DB.categories.map(function (c) { return '<option value="' + c.key + '">' + c.label + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-row"><label>Priority</label><select class="select">' +
            '<option value="urgent">Urgent</option><option value="high">High</option>' +
            '<option value="normal" selected>Normal</option><option value="low">Low</option></select></div>' +
          '<div class="form-row"><label>Assign to <span class="u-muted">(optional)</span></label>' +
            '<select class="select"><option value="">Leave unassigned</option>' +
            DB.crew.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-row full"><label>Details</label>' +
            '<textarea class="textarea" placeholder="What did the tenant report? Any access instructions?"></textarea></div>' +
        '</div>',
      confirmText: 'Log request',
      onConfirm: function (box) {
        if (!box.querySelector('#kTitle').value.trim()) {
          UI.toast('Describe the problem first', 'warn'); return false;
        }
        UI.toast('Request logged and added to the board');
      }
    });
  }

  function openPayment(id) {
    var p = DB.payments.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var t = DB.tenant(p.tenantId);

    UI.modal({
      title: 'Payment ' + p.id,
      sub: UI.fmtDate(p.date) + ' · ' + p.method,
      body:
        '<div class="u-row u-mb" style="gap:13px">' + UI.avatar(p.initials, 'avatar-lg') +
          '<div style="flex:1"><b style="font-size:15px">' + UI.esc(t ? t.name : p.tenantName) + '</b>' +
          '<div class="u-xs u-muted">Unit ' + UI.esc(p.unitNo) + '</div></div>' +
          UI.statusBadge(p.status) + '</div>' +
        '<dl class="kv">' +
          '<dt>Amount</dt><dd style="font-size:17px">' + UI.peso(p.amount) + '</dd>' +
          '<dt>Covers</dt><dd>' + UI.esc(p.covers) + '</dd>' +
          '<dt>Method</dt><dd>' + UI.esc(p.method) + '</dd>' +
          '<dt>Date paid</dt><dd>' + UI.fmtDate(p.date) + '</dd>' +
          '<dt>Recorded by</dt><dd>Aling Nena</dd>' +
          (t ? '<dt>Remaining balance</dt><dd class="' + (t.balance ? 'u-red' : 'u-green') + '">' +
               (t.balance ? UI.peso(t.balance) : 'None') + '</dd>' : '') +
        '</dl>',
      foot: '<button class="btn btn-ghost" data-close>Close</button>' +
            '<button class="btn btn-outline" data-act="print">' + icon('print') + 'Print receipt</button>' +
            '<button class="btn btn-primary" data-confirm>' + icon('download') + 'Download</button>',
      onConfirm: function () { UI.toast('Receipt ' + p.id + ' downloaded'); },
      onOpen: function (box) {
        box.addEventListener('click', function (e) {
          if (e.target.closest('[data-act="print"]')) UI.toast('Sending receipt to printer', 'info');
        });
      }
    });
  }

  function doLogout() {
    UI.modal({
      title: 'Log out?',
      sub: 'You will need to sign in again to manage the property.',
      body: '<p class="u-sm u-muted" style="line-height:1.6">Any unsaved changes in an open form will be lost.</p>',
      foot: '<button class="btn btn-ghost" data-close>Stay signed in</button>' +
            '<button class="btn btn-primary" data-confirm>Log out</button>',
      onConfirm: function () { UI.toast('Signed out — connect this to your auth flow', 'info'); }
    });
  }

  /* ============================================================
     Assistant
     ============================================================ */
  var chatSeeded = false;

  function answer(q) {
    var s = DB.stats;
    var k = q.toLowerCase();

    if (/late|overdue|owe|balance|utang/.test(k)) {
      return '<b>' + s.overdueTenants.length + ' tenants</b> owe a combined <b>' + UI.peso(s.outstanding) + '</b>.<ul>' +
        s.overdueTenants.slice(0, 4).map(function (t) {
          return '<li>' + UI.esc(t.name) + ' — Unit ' + t.unitNo + ', ' + UI.peso(t.balance) + ' (' + t.overdueDays + ' days)</li>';
        }).join('') + '</ul>' +
        (s.overdueTenants[0] ? 'The longest outstanding is ' + s.overdueTenants[0].overdueDays + ' days.' : '');
    }
    if (/vacant|empty|available|bakante/.test(k)) {
      var v = DB.units.filter(function (u) { return u.status === 'vacant'; });
      return 'There are <b>' + v.length + ' vacant units</b> and ' + s.repair + ' under repair.<ul>' +
        v.map(function (u) {
          return '<li>Unit ' + u.no + ' — ' + u.type + ', ' + UI.peso(u.rent) + '/mo</li>';
        }).join('') + '</ul>That is ' + UI.peso(v.reduce(function (a, u) { return a + u.rent; }, 0)) +
        ' of rent not being earned each month.';
    }
    if (/urgent|repair|maintenance|fix|sira/.test(k)) {
      var open = DB.tickets.filter(function (t) { return t.status !== 'done'; });
      var urgent = open.filter(function (t) { return t.priority === 'urgent'; });
      return '<b>' + open.length + ' open requests</b>, ' + urgent.length + ' of them urgent.<ul>' +
        urgent.concat(open.filter(function (t) { return t.priority !== 'urgent'; }).slice(0, 2))
          .slice(0, 4).map(function (t) {
            return '<li>' + UI.esc(t.title) + ' — Unit ' + t.unitNo + ', ' + t.ageDays + ' days old</li>';
          }).join('') + '</ul>';
    }
    if (/collect|income|revenue|kita|rent this month|target/.test(k)) {
      var pct = Math.round(s.incomeThisMonth / s.expectedThisMonth * 100);
      return 'For ' + UI.fmtMonthYear(DB.today) + ' you have collected <b>' + UI.peso(s.incomeThisMonth) +
        '</b> of ' + UI.peso(s.expectedThisMonth) + ' expected — that is <b>' + pct + '%</b>. ' +
        'Income is up ' + s.incomeDelta + '% against last month.';
    }
    if (/occupan|units|how many/.test(k)) {
      return '<b>' + s.occupied + ' of ' + s.totalUnits + ' units</b> are occupied (' + s.occupancyPct + '%), ' +
        'with ' + s.vacant + ' vacant and ' + s.repair + ' under repair across ' + s.buildingsCount + ' buildings.';
    }
    if (/partial|part pay|hulog/.test(k)) {
      return 'Record exactly what the tenant handed over. The unpaid remainder stays as an outstanding balance and shows ' +
        'up in <b>Payment &amp; Balances → Outstanding</b>, with the day count running from the original due date.';
    }
    if (/lease|expir|renew|contract/.test(k)) {
      var soon = DB.tenants.filter(function (t) {
        var d = UI.daysBetween(DB.today, t.leaseEnd);
        return d >= 0 && d <= 90;
      });
      return '<b>' + soon.length + ' leases</b> end within the next 90 days. You can see them all under ' +
        '<b>Apartment Analytics → Leases ending soon</b> and send renewal notices from there.';
    }
    if (/hello|hi|kumusta|hey/.test(k)) {
      return 'Kumusta! I can pull up collections, vacancies, overdue tenants, or repair status. What would you like to know?';
    }
    return 'I can help with collections, outstanding balances, vacancies, occupancy, leases, and maintenance. ' +
      'Try asking &ldquo;who is late on rent?&rdquo; or &ldquo;what repairs are urgent?&rdquo;';
  }

  function bubble(html, who) {
    var time = new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return '<div class="bubble ' + who + '">' + html + '<span class="stamp">' + time + '</span></div>';
  }

  function seedChat() {
    if (chatSeeded) return;
    chatSeeded = true;
    UI.fill('chatLog', bubble('Kumusta, Aling Nena! I can see your live records. Ask me about rent, vacancies, or repairs.', 'bot'));
    UI.fill('chatChips',
      ['Who is late on rent?', 'Which units are vacant?', 'What repairs are urgent?', 'How is collection this month?']
      .map(function (q) { return '<button data-ask="' + UI.esc(q) + '">' + UI.esc(q) + '</button>'; }).join(''));
  }

  function openChat() {
    seedChat();
    document.body.classList.add('chat-open');
    document.getElementById('chatPanel').hidden = false;
    document.getElementById('chatText').focus();
  }

  function closeChat() {
    document.body.classList.remove('chat-open');
    var p = document.getElementById('chatPanel');
    if (p) p.hidden = true;
  }

  function send(text) {
    if (!text.trim()) return;
    var log = document.getElementById('chatLog');
    log.insertAdjacentHTML('beforeend', bubble(UI.esc(text), 'me'));
    log.insertAdjacentHTML('beforeend', '<div class="bubble bot typing" id="typing"><i></i><i></i><i></i></div>');
    log.scrollTop = log.scrollHeight;

    setTimeout(function () {
      var t = document.getElementById('typing');
      if (t) t.remove();
      log.insertAdjacentHTML('beforeend', bubble(answer(text), 'bot'));
      log.scrollTop = log.scrollHeight;
    }, 620);
  }

  function askAssistant(q) {
    openChat();
    setTimeout(function () { send(q); }, 180);
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

    document.getElementById('notifPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="read-all"]')) {
        DB.notifications.forEach(function (n) { n.unread = false; });
        DB.refresh();
        buildNotifications();
        UI.toast('All notifications marked as read');
      }
    });

    document.getElementById('userPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="logout"]')) { closePopovers(); doLogout(); }
    });
    document.getElementById('logoutBtn').addEventListener('click', doLogout);

    var si = document.getElementById('globalSearch');
    si.addEventListener('input', function () { runSearch(si.value); });
    si.addEventListener('focus', function () { if (si.value.length > 1) runSearch(si.value); });
    si.addEventListener('click', function (e) { e.stopPropagation(); });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.popover') && !e.target.closest('#bellBtn') &&
          !e.target.closest('#userChip') && !e.target.closest('.search')) closePopovers();
    });

    document.getElementById('modalRoot').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) UI.closeModal();
    });

    document.getElementById('chatFab').addEventListener('click', openChat);
    document.getElementById('chatClose').addEventListener('click', closeChat);
    document.getElementById('chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var box = document.getElementById('chatText');
      send(box.value);
      box.value = '';
    });
    document.getElementById('chatChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ask]');
      if (b) send(b.dataset.ask);
    });

    /* Page-agnostic actions any page can trigger with data-shell-act */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-shell-act]');
      if (!a) return;
      var act = a.dataset.shellAct;
      if (act === 'record-payment') openRecordPayment();
      if (act === 'add-tenant')     openAddTenant();
      if (act === 'add-unit')       openAddUnit();
      if (act === 'new-ticket')     openNewTicket();
      var ask = a.dataset.ask;
      if (act === 'ask' && ask)     askAssistant(ask);
    });

    /* Keyboard */
    var chord = null;
    var JUMP = { d: 'dashboard', u: 'units', r: 'renters', p: 'payments',
                 m: 'maintenance', a: 'analytics', s: 'settings', h: 'help' };

    document.addEventListener('keydown', function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);

      if (e.key === 'Escape') {
        UI.closeModal(); UI.closeDrawer(); closePopovers(); closeChat();
        document.body.classList.remove('nav-open');
        return;
      }
      if (typing) return;

      if (e.key === '/') { e.preventDefault(); document.getElementById('globalSearch').focus(); return; }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); return openRecordPayment(); }

      if (chord === 'g') {
        chord = null;
        var k = JUMP[e.key.toLowerCase()];
        if (k) { e.preventDefault(); location.href = k + '.html'; }
        return;
      }
      if (e.key.toLowerCase() === 'g') { chord = 'g'; setTimeout(function () { chord = null; }, 1200); }
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  function init() {
    mountChrome();
    buildNotifications();
    buildUserMenu();
    wire();

    UI.resolveIcons(document);             // any <span data-icon="..."> in the page markup
    if (global.Page && typeof Page.init === 'function') Page.init();
    UI.animateMeters(document);
  }

  global.Shell = {
    page: PAGE,
    openRecordPayment: openRecordPayment,
    openAddTenant: openAddTenant,
    openAddUnit: openAddUnit,
    openNewTicket: openNewTicket,
    openPayment: openPayment,
    askAssistant: askAssistant,
    afterMutation: afterMutation,
    buildNotifications: buildNotifications
  };

  document.addEventListener('DOMContentLoaded', init);

})(window);
