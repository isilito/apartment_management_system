/* ============================================================
   shell.js — the shared page chrome.

   Every page is a real .html file containing only its own content.
   This file loads the data (api/admin.php), then injects the sidebar,
   topbar, chat dock, and overlay roots, so navigation and branding
   are defined in ONE place. The shared dialogs (record payment, add
   tenant, add unit, log request, ...) also live here and save through
   the API.
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
      { key: 'payments',  href: 'payments.html',    label: 'Payment & Balances',       icon: 'card',
        count: function () { return DB.stats.pendingCount; } },
      { key: 'reports',   href: 'reports.html',     label: 'Reports & Analytics',      icon: 'chart' }
    ]},
    { label: 'Property', items: [
      { key: 'maintenance', href: 'maintenance.html', label: 'Maintenance Requests',   icon: 'wrench',
        count: function () { return DB.stats.openRepairs; } }
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
        '<div class="brand-text"><strong>' + UI.esc(DB.settings.property_name || "Saraza's Apartment") + '</strong>' +
          '<span>Property Management</span></div>' +
        '<button class="icon-btn sm nav-close" id="navClose" aria-label="Close menu">' + icon('close') + '</button>' +
      '</div>' +
      '<nav class="nav">' + NAV.map(function (g) {
        return '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' +
               g.items.map(navItem).join('') + '</div>';
      }).join('') + '</nav>' +
      '<div class="nav-footer">' + FOOTER_NAV.map(navItem).join('') +
        '<button class="nav-item nav-logout" data-act="logout">' + icon('logout') + '<span>Log out</span></button>' +
      '</div>';
  }

  function topbarHtml() {
    var me = DB.me;
    return '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false">' + icon('menu') + '</button>' +
      '<div class="search">' +
        '<span class="search-icon">' + icon('search') + '</span>' +
        '<input id="globalSearch" type="text" placeholder="Search a tenant, unit, or receipt..." autocomplete="off"/>' +
        '<div class="search-results" id="searchResults"></div>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<button class="icon-btn bell" id="bellBtn" aria-label="Notifications">' + icon('bell') +
          '<span class="dot" hidden></span></button>' +
        '<div class="user-chip" id="userChip" tabindex="0">' +
          '<div class="avatar avatar-teal">' + UI.esc(me.initials) + '</div>' +
          '<div class="user-meta"><strong>' + UI.esc(me.name) + '</strong><span>' + UI.esc(me.role) + '</span></div>' +
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
    if (!document.getElementById('modalRoot')) document.body.insertAdjacentHTML('beforeend', overlaysHtml());
  }

  /* Re-render just the sidebar (counts change after edits) */
  function refreshSidebar() {
    var side = document.querySelector('[data-shell="sidebar"]');
    if (side) side.innerHTML = sidebarHtml();
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
      '<div class="pop-list">' + (DB.notifications.length ? DB.notifications.map(function (n) {
        return '<button class="pop-item" data-nid="' + n.id + '" data-link="' + UI.esc(n.link || '') + '"' +
          (n.unread ? ' style="background:var(--teal-050)"' : '') + '>' +
          '<span class="pi-ico stat-icon ' + (TONE_CLASS[n.tone] || 'i-teal') + '">' + icon(n.icon) + '</span>' +
          '<span class="pi-text"><b>' + UI.esc(n.title) + '</b>' +
            '<span>' + UI.esc(n.body) + '</span><i>' + UI.esc(n.when) + '</i></span></button>';
      }).join('') : '<div class="empty" style="padding:28px 20px"><b>All caught up</b><p>No notifications yet.</p></div>') +
      '</div>' +
      '<div class="pop-foot"><button data-act="activity">View activity log</button></div>');

    var dot = document.querySelector('#bellBtn .dot');
    if (dot) dot.hidden = !unread;
  }

  function buildUserMenu() {
    UI.fill('userPopover',
      '<div style="padding:6px">' +
        '<div style="padding:10px 14px 12px;border-bottom:1px solid var(--line-soft);margin-bottom:6px">' +
          '<b style="font-size:13.5px;display:block">' + UI.esc(DB.me.name) + '</b>' +
          '<span class="u-xs u-muted">' + UI.esc(DB.me.email) + '</span></div>' +
        '<a class="menu-item" href="settings.html?section=property">' + icon('user') + 'My profile</a>' +
        '<a class="menu-item" href="settings.html?section=security">' + icon('lock') + 'Change password</a>' +
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
      return (t.name + ' ' + t.phone + ' ' + t.email + ' ' + t.unitNo).toLowerCase().indexOf(q) > -1;
    }).slice(0, 4);
    var units = DB.units.filter(function (u) {
      return (u.no + ' ' + u.type + ' ' + DB.building(u.buildingId).name).toLowerCase().indexOf(q) > -1;
    }).slice(0, 4);
    var pays = DB.payments.filter(function (p) {
      return (p.id + ' ' + p.fullName + ' ' + p.reference).toLowerCase().indexOf(q) > -1;
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
        return '<a class="sr-item" href="units.html?unit=' + encodeURIComponent(u.id) + '">' +
          '<span class="stat-icon i-teal" style="width:32px;height:32px;border-radius:9px">' + icon('doorOpen') + '</span>' +
          '<span class="sr-text"><b>Unit ' + UI.esc(u.no) + '</b><span>' + UI.esc(u.type) + ' · ' +
          (t ? UI.esc(t.name) : 'No tenant') + '</span></span>' + UI.statusBadge(u.status) + '</a>';
      }).join('');
    }
    if (pays.length) {
      html += '<div class="sr-label">Payments</div>' + pays.map(function (p) {
        return '<a class="sr-item" href="payments.html?receipt=' + p.id + '">' +
          '<span class="stat-icon i-green" style="width:32px;height:32px;border-radius:9px">' + icon('receipt') + '</span>' +
          '<span class="sr-text"><b>' + UI.esc(p.id) + '</b><span>' + UI.esc(p.tenantName) + ' · ' +
          UI.peso(p.amount) + '</span></span>' + UI.statusBadge(p.status) + '</a>';
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
     Saving
     ============================================================ */

  /* Re-fetch from the server, then redraw the chrome and the page. */
  function afterMutation(message, tone) {
    return DB.reload().then(function () {
      refreshSidebar();
      buildNotifications();
      if (message) UI.toast(message, tone);
      if (global.Page && typeof Page.refresh === 'function') Page.refresh();
    });
  }

  /* POST an action, then reload. Returns the server reply. */
  function save(action, data, message) {
    return API.post('admin.php', action, data).then(function (res) {
      return afterMutation(typeof message === 'function' ? message(res) : message).then(function () { return res; });
    });
  }

  function val(box, sel) { var el = box.querySelector(sel); return el ? el.value.trim() : ''; }

  function isoDate(d) {
    d = d || DB.today;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* After creating a portal account, show the sign-in details once */
  function showCredentials(title, email, pass, note) {
    UI.modal({
      title: title,
      sub: 'Give these to the tenant so they can sign in to the tenant portal',
      body:
        '<dl class="kv">' +
          '<dt>Portal address</dt><dd>' + UI.esc(location.origin + location.pathname.replace(/[^/]*$/, '') + 'login.html') + '</dd>' +
          '<dt>Email</dt><dd>' + UI.esc(email) + '</dd>' +
          '<dt>Temporary password</dt><dd style="font-size:16px;letter-spacing:.02em">' + UI.esc(pass) + '</dd>' +
        '</dl>' +
        '<p class="u-sm u-muted u-mt" style="line-height:1.6">' + UI.esc(note ||
          'This password is shown only once. The tenant can change it from the portal after signing in.') + '</p>',
      foot: '<button class="btn btn-outline" data-act="copy">' + icon('file') + 'Copy</button>' +
            '<button class="btn btn-primary" data-close>Done</button>',
      onOpen: function (box) {
        box.querySelector('[data-act="copy"]').addEventListener('click', function () {
          var text = 'Email: ' + email + '\nPassword: ' + pass;
          if (navigator.clipboard) navigator.clipboard.writeText(text);
          UI.toast('Sign-in details copied');
        });
      }
    });
  }

  /* ============================================================
     Shared dialogs — available from every page
     ============================================================ */
  function methodOptions(selected) {
    return DB.methods.map(function (m) {
      return '<option' + (m === selected ? ' selected' : '') + '>' + UI.esc(m) + '</option>';
    }).join('');
  }

  function openRecordPayment(tenantId) {
    var opts = DB.tenants.slice().sort(function (a, b) { return String(a.unitNo).localeCompare(String(b.unitNo)); });
    if (!opts.length) { UI.toast('Add a tenant first', 'warn'); return; }
    UI.modal({
      title: 'Record a payment',
      sub: 'Log money a tenant has already handed over',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>Tenant</label><select class="select" id="pTenant">' +
            opts.map(function (t) {
              return '<option value="' + t.id + '"' + (tenantId === t.id ? ' selected' : '') + '>' +
                     UI.esc(t.name) + ' &mdash; Unit ' + UI.esc(t.unitNo) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="form-row"><label>Amount received</label>' +
            '<input class="input" id="pAmount" type="number" min="0" step="0.01" placeholder="0"/>' +
            '<span class="hint" id="pHint"></span></div>' +
          '<div class="form-row"><label>Date paid</label><input class="input" id="pDate" type="date" value="' + isoDate() + '"/></div>' +
          '<div class="form-row"><label>Method</label><select class="select" id="pMethod">' + methodOptions() + '</select></div>' +
          '<div class="form-row"><label>Covers</label><input class="input" id="pCovers" list="pCoversList"/>' +
            '<datalist id="pCoversList"></datalist></div>' +
          '<div class="form-row full"><label>Reference number <span class="u-muted">(optional)</span></label>' +
            '<input class="input" id="pRef" placeholder="GCash / bank reference number"/></div>' +
          '<div class="form-row full"><label>Notes <span class="u-muted">(optional)</span></label>' +
            '<input class="input" id="pNotes" placeholder="Remarks"/></div>' +
        '</div>',
      confirmText: 'Save payment',
      onOpen: function (box) {
        var sel = box.querySelector('#pTenant');
        function sync() {
          var t = DB.tenant(sel.value);
          var open = DB.chargesOf(t.id);
          var due = open.filter(function (c) { return c.due <= DB.today; });
          var next = open[0];
          box.querySelector('#pAmount').value = t.balance || (next ? next.amount - next.paid : t.rent);
          box.querySelector('#pHint').textContent = t.balance
            ? 'Outstanding balance is ' + UI.peso(t.balance)
            : (next ? 'Next charge: ' + next.label + ' ' + UI.peso(next.amount - next.paid) : 'Monthly rent is ' + UI.peso(t.rent));
          box.querySelector('#pCovers').value = due.length
            ? due.map(function (c) { return c.label; }).slice(0, 3).join(' + ')
            : (next ? next.label : UI.fmtMonthYear(DB.today) + ' rent');
          box.querySelector('#pCoversList').innerHTML = open.map(function (c) {
            return '<option value="' + UI.esc(c.label) + '">';
          }).join('');
        }
        sel.addEventListener('change', sync);
        sync();
      },
      onConfirm: function (box) {
        var t = DB.tenant(val(box, '#pTenant'));
        var amount = Number(val(box, '#pAmount')) || 0;
        if (amount <= 0) { UI.toast('Enter an amount greater than zero', 'warn'); return false; }
        return save('record_payment', {
          tenantId: t.id, amount: amount, date: val(box, '#pDate'), method: val(box, '#pMethod'),
          covers: val(box, '#pCovers'), reference: val(box, '#pRef'), notes: val(box, '#pNotes')
        }, function (r) { return UI.peso(amount) + ' recorded for ' + t.name + ' · ' + r.id; });
      }
    });
  }

  function openAddTenant(unitId) {
    var vacant = DB.units.filter(function (u) { return u.status === 'vacant'; });
    var depMonths = Number(DB.settings.deposit_months || 2);
    UI.modal({
      title: 'Add a tenant',
      sub: 'Move someone into one of your vacant units',
      wide: true,
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Full name</label><input class="input" id="tName" placeholder="Juan Dela Cruz"/></div>' +
          '<div class="form-row"><label>Mobile number</label><input class="input" id="tPhone" placeholder="+63 9XX XXX XXXX"/></div>' +
          '<div class="form-row"><label>Email <span class="u-muted">(used to sign in)</span></label><input class="input" id="tEmail" type="email"/></div>' +
          '<div class="form-row"><label>Occupation</label><input class="input" id="tJob" placeholder="Teacher"/></div>' +
          '<div class="form-row"><label>Unit</label><select class="select" id="tUnit">' +
            (vacant.length
              ? vacant.map(function (u) {
                  return '<option value="' + UI.esc(u.id) + '"' + (unitId === u.id ? ' selected' : '') + '>Unit ' +
                         UI.esc(u.no) + ' &mdash; ' + UI.esc(u.type) + ' · ' + UI.peso(u.rent) + '</option>';
                }).join('')
              : '<option value="">No vacant units available</option>') + '</select></div>' +
          '<div class="form-row"><label>Number of occupants</label>' +
            '<select class="select" id="tOcc"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></div>' +
          '<div class="form-row"><label>Move-in date</label><input class="input" id="tMove" type="date" value="' + isoDate() + '"/></div>' +
          '<div class="form-row"><label>Lease length</label>' +
            '<select class="select" id="tLease"><option value="6">6 months</option><option value="12" selected>12 months</option><option value="24">24 months</option></select></div>' +
          '<div class="form-row"><label>Monthly rent</label><input class="input" id="tRent" type="number" min="0"/></div>' +
          '<div class="form-row"><label>Security deposit</label><input class="input" id="tDep" type="number" min="0"/></div>' +
          '<div class="form-row"><label>Emergency contact</label><input class="input" id="tEmName" placeholder="Name"/></div>' +
          '<div class="form-row"><label>Emergency number</label><input class="input" id="tEmPhone" placeholder="+63 9XX XXX XXXX"/></div>' +
          '<div class="form-row full"><label class="switch"><input type="checkbox" id="tLogin" checked/><span class="track"></span>' +
            '<span class="sw-text"><b>Create a tenant portal login</b><span>The tenant signs in with their email and a temporary password</span></span></label></div>' +
          '<div class="form-row full"><label class="switch"><input type="checkbox" id="tBill" checked/><span class="track"></span>' +
            '<span class="sw-text"><b>Bill the security deposit</b><span>Adds the deposit as a charge due on the move-in date</span></span></label></div>' +
        '</div>',
      confirmText: 'Add tenant',
      onOpen: function (box) {
        var sel = box.querySelector('#tUnit');
        function sync() {
          var u = DB.unit(sel.value);
          if (!u) return;
          box.querySelector('#tRent').value = u.rent;
          box.querySelector('#tDep').value = u.rent * depMonths;
        }
        sel.addEventListener('change', sync);
        box.querySelector('#tRent').addEventListener('input', function (e) {
          box.querySelector('#tDep').value = (Number(e.target.value) || 0) * depMonths;
        });
        sync();
      },
      onConfirm: function (box) {
        var name = val(box, '#tName');
        var unit = val(box, '#tUnit');
        var login = box.querySelector('#tLogin').checked;
        if (!name) { UI.toast('Enter the tenant\'s full name', 'warn'); return false; }
        if (!unit) { UI.toast('There are no vacant units to assign', 'warn'); return false; }
        if (login && !val(box, '#tEmail')) { UI.toast('Add an email so the tenant can sign in, or turn off the portal login', 'warn'); return false; }
        return API.post('admin.php', 'add_tenant', {
          name: name, phone: val(box, '#tPhone'), email: val(box, '#tEmail'), occupation: val(box, '#tJob'),
          unitId: unit, occupants: Number(val(box, '#tOcc')), moveIn: val(box, '#tMove'),
          leaseMonths: Number(val(box, '#tLease')), rent: Number(val(box, '#tRent')), deposit: Number(val(box, '#tDep')),
          emergencyName: val(box, '#tEmName'), emergencyPhone: val(box, '#tEmPhone'),
          createLogin: login, billDeposit: box.querySelector('#tBill').checked
        }).then(function (r) {
          return afterMutation(name + ' moved into Unit ' + unit).then(function () {
            if (r.tempPassword) setTimeout(function () { showCredentials('Portal login for ' + name, r.email, r.tempPassword); }, 50);
          });
        });
      }
    });
  }

  function unitForm(u) {
    u = u || {};
    return '<div class="form-grid">' +
        (u.id ? '' :
        '<div class="form-row"><label>Building</label><select class="select" id="uB">' +
          DB.buildings.map(function (b) { return '<option value="' + b.id + '">' + UI.esc(b.name) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-row"><label>Unit number</label><input class="input" id="uNo" placeholder="e.g. 305 or A205"/></div>' +
        '<div class="form-row"><label>Floor</label><input class="input" id="uFloor" type="number" min="1" value="1"/></div>') +
        '<div class="form-row"><label>Unit type</label><select class="select" id="uType">' +
          DB.unitTypes.map(function (t) {
            return '<option value="' + t.key + '"' + (u.typeKey === t.key ? ' selected' : '') + '>' + UI.esc(t.label) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="form-row"><label>Floor area (sqm)</label><input class="input" id="uSize" type="number" min="0" step="0.5" value="' + (u.size || '') + '"/></div>' +
        '<div class="form-row"><label>Monthly rent</label><input class="input" id="uRent" type="number" min="0" value="' + (u.rent || '') + '"/></div>' +
        '<div class="form-row"><label>Bathrooms</label><input class="input" id="uBath" type="number" min="0" value="' + (u.bathrooms != null ? u.bathrooms : 1) + '"/></div>' +
        '<div class="form-row"><label>Furnishing</label><select class="select" id="uFurn">' +
          ['Unfurnished', 'Semi-furnished', 'Fully furnished'].map(function (f) {
            return '<option' + (u.furnishing === f ? ' selected' : '') + '>' + f + '</option>';
          }).join('') + '</select></div>' +
        (u.id && u.status !== 'occupied' ?
          '<div class="form-row"><label>Status</label><select class="select" id="uStatus">' +
            '<option value="vacant"' + (u.status === 'vacant' ? ' selected' : '') + '>Vacant — available to rent</option>' +
            '<option value="repair"' + (u.status === 'repair' ? ' selected' : '') + '>Under repair — not rentable</option></select></div>' : '') +
        '<div class="form-row full"><label>Notes <span class="u-muted">(optional)</span></label>' +
          '<textarea class="textarea" id="uNotes" placeholder="Anything worth remembering about this unit">' + UI.esc(u.notes || '') + '</textarea></div>' +
      '</div>';
  }

  function unitPayload(box) {
    return {
      typeKey: val(box, '#uType'), size: Number(val(box, '#uSize')) || 0, rent: Number(val(box, '#uRent')) || 0,
      bathrooms: Number(val(box, '#uBath')) || 0, furnishing: val(box, '#uFurn'), notes: val(box, '#uNotes')
    };
  }

  function openAddUnit() {
    if (!DB.buildings.length) { UI.toast('Add a building first in Settings → Property', 'warn'); return; }
    UI.modal({
      title: 'Add a unit',
      sub: 'Create a new rentable space in one of your buildings',
      body: unitForm(),
      confirmText: 'Add unit',
      onOpen: function (box) {
        var type = box.querySelector('#uType');
        function sync() {
          var t = DB.unitTypes.filter(function (x) { return x.key === type.value; })[0];
          if (t) { box.querySelector('#uSize').value = t.size; box.querySelector('#uRent').value = t.rent; }
        }
        type.addEventListener('change', sync);
        sync();
      },
      onConfirm: function (box) {
        var d = unitPayload(box);
        d.id = val(box, '#uNo'); d.buildingId = val(box, '#uB'); d.floor = Number(val(box, '#uFloor')) || 1;
        if (!d.id) { UI.toast('Enter a unit number', 'warn'); return false; }
        if (d.rent <= 0) { UI.toast('Enter the monthly rent', 'warn'); return false; }
        return save('add_unit', d, function (r) { return 'Unit ' + r.id + ' added'; });
      }
    });
  }

  function openEditUnit(id) {
    var u = DB.unit(id);
    if (!u) return;
    UI.modal({
      title: 'Edit Unit ' + u.no,
      sub: DB.building(u.buildingId).name + ' · Floor ' + u.floor,
      body: unitForm(u) +
        (u.status !== 'occupied' ? '<div class="u-rule"></div><button class="btn btn-ghost btn-sm u-red" data-act="del-unit">' +
          icon('trash') + 'Delete this unit</button>' : '') +
        (u.status === 'occupied' ? '<p class="u-xs u-muted u-mt">Changing the rent here does not change the current tenant\'s lease. ' +
          'Edit the tenant in Renter Information for that.</p>' : ''),
      confirmText: 'Save unit',
      onOpen: function (box) {
        var del = box.querySelector('[data-act="del-unit"]');
        if (del) del.addEventListener('click', function () {
          if (del.dataset.armed) {
            API.post('admin.php', 'delete_unit', { id: u.id }).then(function () {
              UI.closeModal(); UI.closeDrawer();
              afterMutation('Unit ' + u.no + ' deleted');
            }, function (e) { UI.toast(e.message, 'warn'); });
          } else {
            del.dataset.armed = '1';
            del.innerHTML = icon('alert') + 'Click again to delete permanently';
          }
        });
      },
      onConfirm: function (box) {
        var d = unitPayload(box);
        d.id = u.id;
        var st = box.querySelector('#uStatus');
        if (st) d.status = st.value;
        if (d.rent <= 0) { UI.toast('Enter the monthly rent', 'warn'); return false; }
        return save('update_unit', d, 'Unit ' + u.no + ' updated');
      }
    });
  }

  function openNewTicket(unitId) {
    UI.modal({
      title: 'Log a maintenance request',
      sub: 'Record something that needs fixing',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>What is the problem?</label>' +
            '<input class="input" id="kTitle" placeholder="e.g. No water pressure in the bathroom"/></div>' +
          '<div class="form-row"><label>Unit</label><select class="select" id="kUnit">' +
            DB.units.map(function (u) {
              var t = DB.tenantOfUnit(u.id);
              return '<option value="' + UI.esc(u.id) + '"' + (unitId === u.id ? ' selected' : '') + '>Unit ' + UI.esc(u.no) +
                (t ? ' — ' + UI.esc(t.name) : '') + '</option>';
            }).join('') +
          '</select></div>' +
          '<div class="form-row"><label>Category</label><select class="select" id="kCat">' +
            DB.categories.map(function (c) { return '<option value="' + c.key + '">' + UI.esc(c.label) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-row"><label>Priority</label><select class="select" id="kPri">' +
            '<option value="urgent">Urgent</option><option value="high">High</option>' +
            '<option value="normal" selected>Normal</option><option value="low">Low</option></select></div>' +
          '<div class="form-row"><label>Assign to <span class="u-muted">(optional)</span></label>' +
            '<select class="select" id="kWho"><option value="">Leave unassigned</option>' +
            DB.crew.map(function (c) { return '<option>' + UI.esc(c) + '</option>'; }).join('') + '</select></div>' +
          '<div class="form-row"><label>Visit date <span class="u-muted">(optional)</span></label>' +
            '<input class="input" id="kDate" type="date"/></div>' +
          '<div class="form-row full"><label>Details</label>' +
            '<textarea class="textarea" id="kDetails" placeholder="What did the tenant report? Any access instructions?"></textarea></div>' +
        '</div>',
      confirmText: 'Log request',
      onConfirm: function (box) {
        if (!val(box, '#kTitle')) { UI.toast('Describe the problem first', 'warn'); return false; }
        return save('add_ticket', {
          title: val(box, '#kTitle'), unitId: val(box, '#kUnit'), category: val(box, '#kCat'),
          priority: val(box, '#kPri'), assignee: val(box, '#kWho'), scheduledFor: val(box, '#kDate'),
          details: val(box, '#kDetails')
        }, function (r) { return 'Request ' + r.id + ' logged and added to the board'; });
      }
    });
  }

  function openPayment(id) {
    var p = DB.payment(id);
    if (!p) { UI.toast('Receipt ' + id + ' was not found', 'warn'); return; }
    var t = DB.tenant(p.tenantId);
    var pending = p.status === 'pending';

    UI.modal({
      title: 'Payment ' + p.id,
      sub: UI.fmtDate(p.date) + ' · ' + p.method,
      body:
        '<div class="u-row u-mb" style="gap:13px">' + UI.avatar(p.initials, 'avatar-lg') +
          '<div style="flex:1;min-width:0"><b style="font-size:15px">' + UI.esc(p.fullName) + '</b>' +
          '<div class="u-xs u-muted">Unit ' + UI.esc(p.unitNo) + '</div></div>' +
          UI.statusBadge(p.status) + '</div>' +
        (pending ? '<div class="notice-bar u-mb"><span>' + icon('info') + '</span><div><b>Sent by the tenant from the portal</b>' +
          '<span>Check the reference against your GCash / bank records, then confirm it to mark the charge paid.</span></div></div>' : '') +
        '<dl class="kv">' +
          '<dt>Amount</dt><dd style="font-size:17px">' + UI.peso(p.amount) + '</dd>' +
          '<dt>Covers</dt><dd>' + UI.esc(p.covers) + '</dd>' +
          '<dt>Method</dt><dd>' + UI.esc(p.method) + '</dd>' +
          '<dt>Reference</dt><dd>' + UI.esc(p.reference) + '</dd>' +
          '<dt>Date paid</dt><dd>' + UI.fmtDate(p.date) + '</dd>' +
          '<dt>' + (pending ? 'Submitted by' : 'Recorded by') + '</dt><dd>' + UI.esc(p.recordedBy) + '</dd>' +
          (p.notes ? '<dt>Notes</dt><dd>' + UI.esc(p.notes) + '</dd>' : '') +
          (p.proof ? '<dt>Proof of payment</dt><dd><a href="' + p.proof + '" target="_blank" rel="noopener">View attachment</a></dd>' : '') +
          (t ? '<dt>Tenant balance</dt><dd class="' + (t.balance ? 'u-red' : 'u-green') + '">' +
               (t.balance ? UI.peso(t.balance) : 'None') + '</dd>' : '') +
        '</dl>' +
        (pending ? '<div class="form-row u-mt" id="rejectRow" hidden><label>Reason for rejecting</label>' +
          '<input class="input" id="rejReason" placeholder="e.g. Reference number not found in GCash history"/></div>' : ''),
      foot: pending
        ? '<button class="btn btn-ghost" data-close>Close</button>' +
          '<button class="btn btn-outline u-red" data-act="reject">Reject</button>' +
          '<button class="btn btn-primary" data-confirm>' + icon('check') + 'Confirm payment</button>'
        : '<button class="btn btn-ghost" data-close>Close</button>' +
          '<button class="btn btn-primary" data-confirm>' + icon('print') + 'Print receipt</button>',
      onConfirm: function () {
        if (!pending) { window.open(API.url('receipt.php', null, { id: p.id }), '_blank'); return; }
        return save('confirm_payment', { id: p.id }, p.id + ' confirmed — ' + UI.peso(p.amount) + ' applied to ' + p.fullName);
      },
      onOpen: function (box) {
        var rej = box.querySelector('[data-act="reject"]');
        if (rej) rej.addEventListener('click', function () {
          var row = box.querySelector('#rejectRow');
          if (row.hidden) { row.hidden = false; box.querySelector('#rejReason').focus(); rej.textContent = 'Send rejection'; return; }
          rej.disabled = true;
          save('reject_payment', { id: p.id, reason: val(box, '#rejReason') }, p.id + ' rejected — the tenant has been told', 'info')
            .then(function () { UI.closeModal(); }, function (e) { rej.disabled = false; UI.toast(e.message, 'warn'); });
        });
      }
    });
  }

  function openAddCharge(tenantId) {
    var t = DB.tenant(tenantId);
    if (!t) return;
    var d = new Date(DB.today); d.setDate(d.getDate() + 10);
    UI.modal({
      title: 'Bill ' + t.name,
      sub: 'Add a charge to Unit ' + t.unitNo,
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Type</label><select class="select" id="cKind">' +
            '<option value="other">Other charge</option>' +
            '<option value="deposit">Deposit top-up</option></select></div>' +
          '<div class="form-row"><label>Amount</label><input class="input" id="cAmt" type="number" min="0" step="0.01"/></div>' +
          '<div class="form-row"><label>Label</label><input class="input" id="cLabel" placeholder="e.g. Replacement key"/></div>' +
          '<div class="form-row"><label>Due date</label><input class="input" id="cDue" type="date" value="' + isoDate(d) + '"/></div>' +
          '<div class="form-row full"><label>Details <span class="u-muted">(shown to the tenant)</span></label>' +
            '<input class="input" id="cDetail" placeholder="e.g. Lost key replaced on 12 Oct"/></div>' +
        '</div>',
      confirmText: 'Add charge',
      onOpen: function (box) {
        box.querySelector('#cKind').addEventListener('change', function (e) {
          box.querySelector('#cLabel').value = { other: '', deposit: 'Deposit top-up' }[e.target.value];
        });
      },
      onConfirm: function (box) {
        var amt = Number(val(box, '#cAmt')) || 0;
        if (amt <= 0) { UI.toast('Enter the amount to bill', 'warn'); return false; }
        if (!val(box, '#cLabel')) { UI.toast('Give the charge a label', 'warn'); return false; }
        return save('add_charge', { tenantId: t.id, kind: val(box, '#cKind'), amount: amt, label: val(box, '#cLabel'),
          due: val(box, '#cDue'), detail: val(box, '#cDetail') }, UI.peso(amt) + ' billed to ' + t.name);
      }
    });
  }

  function openEditTenant(id) {
    var t = DB.tenant(id);
    if (!t) return;
    UI.modal({
      title: 'Edit ' + t.name,
      sub: 'Unit ' + t.unitNo + ' · ' + t.contractNo,
      wide: true,
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Full name</label><input class="input" id="eName" value="' + UI.esc(t.name) + '"/></div>' +
          '<div class="form-row"><label>Mobile number</label><input class="input" id="ePhone" value="' + UI.esc(t.phone) + '"/></div>' +
          '<div class="form-row"><label>Email</label><input class="input" id="eEmail" type="email" value="' + UI.esc(t.email) + '"/></div>' +
          '<div class="form-row"><label>Occupation</label><input class="input" id="eJob" value="' + UI.esc(t.occupation === '—' ? '' : t.occupation) + '"/></div>' +
          '<div class="form-row"><label>Occupants</label><input class="input" id="eOcc" type="number" min="1" value="' + t.occupants + '"/></div>' +
          '<div class="form-row"><label>Lease status</label><select class="select" id="eStatus">' +
            '<option value="current"' + (t.leaseStatus === 'current' ? ' selected' : '') + '>Active lease</option>' +
            '<option value="notice"' + (t.leaseStatus === 'notice' ? ' selected' : '') + '>On notice (moving out)</option></select></div>' +
          '<div class="form-row"><label>Monthly rent</label><input class="input" id="eRent" type="number" min="0" value="' + t.rent + '"/>' +
            '<span class="hint">Applies to rent charges created from now on</span></div>' +
          '<div class="form-row"><label>Deposit held</label><input class="input" id="eDep" type="number" min="0" value="' + t.deposit + '"/></div>' +
          '<div class="form-row"><label>Lease ends</label><input class="input" id="eEnd" type="date" value="' + (t.leaseEnd ? isoDate(t.leaseEnd) : '') + '"/></div>' +
          '<div class="form-row"><label>Emergency contact</label><input class="input" id="eEmName" value="' + UI.esc(t.emergencyName) + '"/></div>' +
          '<div class="form-row"><label>Relation</label><input class="input" id="eEmRel" value="' + UI.esc(t.emergencyRelation) + '"/></div>' +
          '<div class="form-row"><label>Emergency number</label><input class="input" id="eEmPhone" value="' + UI.esc(t.emergencyPhone) + '"/></div>' +
          (!t.hasLogin ? '<div class="form-row full"><label class="switch"><input type="checkbox" id="eLogin"/><span class="track"></span>' +
            '<span class="sw-text"><b>Create a tenant portal login</b><span>Uses the email above</span></span></label></div>' : '') +
        '</div>',
      confirmText: 'Save changes',
      onConfirm: function (box) {
        if (!val(box, '#eName')) { UI.toast('The name cannot be empty', 'warn'); return false; }
        var login = box.querySelector('#eLogin');
        return API.post('admin.php', 'update_tenant', {
          id: t.id, name: val(box, '#eName'), phone: val(box, '#ePhone'), email: val(box, '#eEmail'),
          occupation: val(box, '#eJob'), occupants: Number(val(box, '#eOcc')) || 1, leaseStatus: val(box, '#eStatus'),
          rent: Number(val(box, '#eRent')), deposit: Number(val(box, '#eDep')), leaseEnd: val(box, '#eEnd'),
          emergencyName: val(box, '#eEmName'), emergencyRelation: val(box, '#eEmRel'), emergencyPhone: val(box, '#eEmPhone'),
          createLogin: login ? login.checked : false
        }).then(function (r) {
          return afterMutation(val(box, '#eName') + ' updated').then(function () {
            if (r.tempPassword) setTimeout(function () { showCredentials('Portal login for ' + t.name, val(box, '#eEmail') || t.email, r.tempPassword); }, 50);
          });
        });
      }
    });
  }

  function openMoveOut(id) {
    var t = DB.tenant(id);
    if (!t) return;
    UI.modal({
      title: 'Move out ' + t.name + '?',
      sub: 'Ends the lease and frees Unit ' + t.unitNo,
      body:
        '<div class="form-row"><label>Move-out date</label><input class="input" id="mDate" type="date" value="' + isoDate() + '"/></div>' +
        '<p class="u-sm u-muted u-mt" style="line-height:1.6">The unit becomes vacant, future rent charges are cancelled, and the ' +
        'tenant can no longer sign in. Payment history is kept.' +
        (t.balance ? ' <b class="u-red">This tenant still owes ' + UI.peso(t.balance) + '.</b>' : '') + '</p>',
      foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" data-confirm>Move out</button>',
      onConfirm: function (box) {
        return save('move_out', { id: t.id, date: val(box, '#mDate') }, t.name + ' moved out · Unit ' + t.unitNo + ' is now vacant')
          .then(function () { if (global.Page && Page.clearSelection) Page.clearSelection(); });
      }
    });
  }

  function openMessage(tenantId, subject) {
    var t = DB.tenant(tenantId);
    if (!t) return;
    UI.modal({
      title: 'Message ' + t.name,
      sub: t.hasLogin ? 'Appears in the tenant portal notices' : 'This tenant has no portal login yet — they will see it once one is created',
      body:
        '<div class="form-grid">' +
          '<div class="form-row full"><label>Subject</label><input class="input" id="msgSub" value="' + UI.esc(subject || '') + '" placeholder="e.g. Water interruption tomorrow"/></div>' +
          '<div class="form-row full"><label>Message</label><textarea class="textarea" id="msgBody" placeholder="Type your message..."></textarea></div>' +
        '</div>',
      confirmText: 'Send message',
      onConfirm: function (box) {
        if (!val(box, '#msgBody')) { UI.toast('Write a message first', 'warn'); return false; }
        return save('message_tenant', { tenantId: t.id, subject: val(box, '#msgSub'), body: val(box, '#msgBody') },
          'Message sent to ' + t.name);
      }
    });
  }

  function sendReminder(tenantId) {
    var t = DB.tenant(tenantId);
    return save('send_reminder', { tenantId: tenantId }, 'Reminder sent to ' + (t ? t.name : 'tenant'))
      .catch(function (e) { UI.toast(e.message, 'warn'); });
  }

  function remindAll() {
    return save('remind_all', {}, function (r) { return 'Reminders sent to ' + r.count + ' tenant' + (r.count === 1 ? '' : 's'); })
      .catch(function (e) { UI.toast(e.message, 'warn'); });
  }

  function openActivity() {
    UI.modal({
      title: 'Activity log',
      sub: 'Who changed what, most recent first',
      wide: true,
      body: '<div id="actBody"><p class="u-sm u-muted">Loading…</p></div>',
      foot: '<button class="btn btn-primary" data-close>Close</button>',
      onOpen: function (box) {
        API.get('admin.php', 'activity').then(function (r) {
          box.querySelector('#actBody').innerHTML = r.rows.length ? '<div class="rows">' + r.rows.map(function (a) {
            return '<div class="row"><div class="row-main"><b>' + UI.esc(a.action) + '</b><span>' +
              UI.esc(a.user_name) + (a.detail ? ' &middot; ' + UI.esc(a.detail) : '') + '</span></div>' +
              '<div class="row-end"><span class="u-xs u-muted nowrap">' + UI.esc(DB.ago(DB.parse(a.created_at))) + '</span></div></div>';
          }).join('') + '</div>' : UI.emptyState('archive', 'Nothing logged yet', 'Changes will appear here.');
        }, function (e) { box.querySelector('#actBody').innerHTML = '<p class="u-red">' + UI.esc(e.message) + '</p>'; });
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
      onConfirm: function () { return API.logout(); }
    });
  }

  /* ============================================================
     Assistant — answers from the live records
     ============================================================ */
  var chatSeeded = false;

  function answer(q) {
    var s = DB.stats;
    var k = q.toLowerCase();

    if (/pending|confirm|verify/.test(k)) {
      var pend = DB.payments.filter(function (p) { return p.status === 'pending'; });
      return pend.length
        ? '<b>' + pend.length + ' payment' + (pend.length > 1 ? 's' : '') + '</b> sent from the tenant portal need confirming:<ul>' +
          pend.slice(0, 5).map(function (p) {
            return '<li>' + UI.esc(p.fullName) + ' — ' + UI.peso(p.amount) + ' via ' + UI.esc(p.method) + '</li>';
          }).join('') + '</ul>Open <b>Payment &amp; Balances</b> and click a pending row to confirm it.'
        : 'No payments are waiting for confirmation.';
    }
    if (/late|overdue|owe|balance|utang/.test(k)) {
      if (!s.overdueTenants.length) return 'Nobody owes anything right now. Everyone is paid up.';
      return '<b>' + s.overdueTenants.length + ' tenants</b> owe a combined <b>' + UI.peso(s.outstanding) + '</b>.<ul>' +
        s.overdueTenants.slice(0, 5).map(function (t) {
          return '<li>' + UI.esc(t.name) + ' — Unit ' + UI.esc(t.unitNo) + ', ' + UI.peso(t.balance) + ' (' + t.overdueDays + ' days)</li>';
        }).join('') + '</ul>' +
        'The longest outstanding is ' + s.overdueTenants[0].overdueDays + ' days.';
    }
    if (/vacant|empty|available|bakante/.test(k)) {
      var v = DB.units.filter(function (u) { return u.status === 'vacant'; });
      return 'There ' + (v.length === 1 ? 'is' : 'are') + ' <b>' + v.length + ' vacant unit' + (v.length === 1 ? '' : 's') +
        '</b> and ' + s.repair + ' under repair.<ul>' +
        v.map(function (u) {
          return '<li>Unit ' + UI.esc(u.no) + ' — ' + UI.esc(u.type) + ', ' + UI.peso(u.rent) + '/mo</li>';
        }).join('') + '</ul>That is ' + UI.peso(v.reduce(function (a, u) { return a + u.rent; }, 0)) +
        ' of rent not being earned each month.';
    }
    if (/urgent|repair|maintenance|fix|sira/.test(k)) {
      var open = DB.tickets.filter(function (t) { return t.status !== 'done'; });
      var urgent = open.filter(function (t) { return t.priority === 'urgent'; });
      return '<b>' + open.length + ' open requests</b>, ' + urgent.length + ' of them urgent.<ul>' +
        urgent.concat(open.filter(function (t) { return t.priority !== 'urgent'; }).slice(0, 2))
          .slice(0, 4).map(function (t) {
            return '<li>' + UI.esc(t.title) + ' — Unit ' + UI.esc(t.unitNo) + ', ' + t.ageDays + ' days old' +
              (t.assignee ? ' (' + UI.esc(t.assignee) + ')' : ', unassigned') + '</li>';
          }).join('') + '</ul>';
    }
    if (/collect|income|revenue|kita|rent this month|target/.test(k)) {
      var pct = s.expectedThisMonth ? Math.round(s.incomeThisMonth / s.expectedThisMonth * 100) : 0;
      return 'For ' + UI.fmtMonthYear(DB.today) + ' you have collected <b>' + UI.peso(s.incomeThisMonth) +
        '</b> of ' + UI.peso(s.expectedThisMonth) + ' billed — that is <b>' + pct + '%</b>. ' +
        'Last month you collected ' + UI.peso(s.incomeLastMonth) + '.';
    }
    if (/occupan|units|how many/.test(k)) {
      return '<b>' + s.occupied + ' of ' + s.totalUnits + ' units</b> are occupied (' + s.occupancyPct + '%), ' +
        'with ' + s.vacant + ' vacant and ' + s.repair + ' under repair across ' + s.buildingsCount + ' buildings.';
    }
    if (/partial|part pay|hulog/.test(k)) {
      return 'Record exactly what the tenant handed over. It is applied to the oldest unpaid charge first; the remainder ' +
        'stays as an outstanding balance in <b>Payment &amp; Balances → Outstanding</b>.';
    }
    if (/lease|expir|renew|contract/.test(k)) {
      var soon = DB.tenants.filter(function (t) {
        var d = t.leaseEnd ? UI.daysBetween(DB.today, t.leaseEnd) : -1;
        return d >= 0 && d <= 90;
      });
      return '<b>' + soon.length + ' lease' + (soon.length === 1 ? '' : 's') + '</b> end within the next 90 days.' +
        (soon.length ? '<ul>' + soon.map(function (t) {
          return '<li>' + UI.esc(t.name) + ' — Unit ' + UI.esc(t.unitNo) + ', ends ' + UI.fmtDate(t.leaseEnd) + '</li>';
        }).join('') + '</ul>Open the tenant in <b>Renter Information</b> to extend the lease or send a message.' : '');
    }
    if (/hello|hi|kumusta|hey/.test(k)) {
      return 'Kumusta! I can pull up collections, vacancies, overdue tenants, pending payments, or repair status. What would you like to know?';
    }
    return 'I can help with collections, outstanding balances, pending payments, vacancies, occupancy, leases, and maintenance. ' +
      'Try asking &ldquo;who is late on rent?&rdquo; or &ldquo;what repairs are urgent?&rdquo;';
  }

  function bubble(html, who) {
    var time = new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return '<div class="bubble ' + who + '">' + html + '<span class="stamp">' + time + '</span></div>';
  }

  function seedChat() {
    if (chatSeeded) return;
    chatSeeded = true;
    UI.fill('chatLog', bubble('Kumusta, ' + UI.esc(DB.me.name.split(' ')[0]) +
      '! I can see your live records. Ask me about rent, vacancies, or repairs.', 'bot'));
    UI.fill('chatChips',
      ['Who is late on rent?', 'Any payments to confirm?', 'What repairs are urgent?', 'How is collection this month?']
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
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    var b = document.getElementById('menuBtn');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function wire() {
    document.getElementById('menuBtn').addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    var scrim = document.getElementById('sidebarScrim');
    if (scrim) scrim.addEventListener('click', function () { setNav(false); });

    /* sidebar is re-rendered after edits, so delegate its clicks */
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

    document.getElementById('notifPopover').addEventListener('click', function (e) {
      if (e.target.closest('[data-act="read-all"]')) {
        API.post('admin.php', 'mark_notifications_read', {}).then(function () {
          DB.notifications.forEach(function (n) { n.unread = false; });
          DB.refresh();
          buildNotifications();
          UI.toast('All notifications marked as read');
        }, function (err) { UI.toast(err.message, 'warn'); });
        return;
      }
      if (e.target.closest('[data-act="activity"]')) { closePopovers(); openActivity(); return; }
      var item = e.target.closest('[data-nid]');
      if (item) {
        var link = item.dataset.link;
        API.post('admin.php', 'mark_notifications_read', { id: Number(item.dataset.nid) }).catch(function () {})
          .then(function () { if (link) location.href = link; else afterMutation(); });
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
      if (act === 'record-payment') openRecordPayment(a.dataset.tenant);
      if (act === 'add-tenant')     openAddTenant(a.dataset.unit);
      if (act === 'add-unit')       openAddUnit();
      if (act === 'new-ticket')     openNewTicket(a.dataset.unit);
      var ask = a.dataset.ask;
      if (act === 'ask' && ask)     askAssistant(ask);
    });

    /* Keyboard */
    var chord = null;
    var JUMP = { d: 'dashboard', u: 'units', r: 'renters', p: 'payments', e: 'reports',
                 m: 'maintenance', s: 'settings', h: 'help' };

    document.addEventListener('keydown', function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);

      if (e.key === 'Escape') {
        UI.closeModal(); UI.closeDrawer(); closePopovers(); closeChat();
        setNav(false);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!document.getElementById('modalRoot').hidden) return;

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
     Boot — load data first, then build the page
     ============================================================ */
  function showBootError(err) {
    document.body.classList.remove('booting');
    var main = document.querySelector('.content');
    if (main) {
      main.innerHTML = '<div class="card" style="max-width:560px;margin:60px auto"><div class="empty">' +
        '<div class="ico">' + icon('alert') + '</div><b>Could not load the console</b><p>' + UI.esc(err.message) + '</p>' +
        '<div class="u-mt"><button class="btn btn-primary btn-sm" onclick="location.reload()">Try again</button></div></div></div>';
    }
  }

  function init() {
    document.body.classList.add('booting');
    DB.load().then(function () {
      mountChrome();
      buildNotifications();
      buildUserMenu();
      wire();

      UI.resolveIcons(document);             // any <span data-icon="..."> in the page markup
      document.body.classList.remove('booting');
      if (global.Page && typeof Page.init === 'function') Page.init();
      UI.animateMeters(document);
    }).catch(function (err) {
      if (document.getElementById('modalRoot')) return UI.toast(err.message, 'warn');
      document.body.insertAdjacentHTML('beforeend', overlaysHtml());
      showBootError(err);
    });
  }

  global.Shell = {
    page: PAGE,
    openRecordPayment: openRecordPayment,
    openAddTenant: openAddTenant,
    openAddUnit: openAddUnit,
    openEditUnit: openEditUnit,
    openNewTicket: openNewTicket,
    openPayment: openPayment,
    openAddCharge: openAddCharge,
    openEditTenant: openEditTenant,
    openMoveOut: openMoveOut,
    openMessage: openMessage,
    openActivity: openActivity,
    showCredentials: showCredentials,
    sendReminder: sendReminder,
    remindAll: remindAll,
    askAssistant: askAssistant,
    afterMutation: afterMutation,
    save: save,
    isoDate: isoDate,
    buildNotifications: buildNotifications
  };

  document.addEventListener('DOMContentLoaded', init);

})(window);
