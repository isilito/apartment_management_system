/* ============================================================
   pages/renters.js — data for renters.html
   Deep link: renters.html?tenant=T006 preselects that renter.
   ============================================================ */
(function (global) {

  var state = { q: '', tab: 'all', selected: null };

  function list() {
    var q = state.q.trim().toLowerCase();
    return DB.tenants.filter(function (t) {
      if (state.tab === 'overdue' && t.status !== 'overdue') return false;
      if (state.tab === 'current' && t.status !== 'current') return false;
      if (state.tab === 'notice'  && t.status !== 'notice')  return false;
      if (!q) return true;
      return (t.name + ' ' + t.unitNo + ' ' + t.phone + ' ' + t.email).toLowerCase().indexOf(q) > -1;
    });
  }

  function renterCard(t) {
    var sel = state.selected === t.id ? ' style="border-color:var(--teal);box-shadow:var(--sh-2)"' : '';
    return '<article class="card renter-card" data-tenant="' + t.id + '" tabindex="0"' + sel + '>' +
      UI.avatar(t.initials, 'avatar-lg') +
      '<div class="rc-meta">' +
        '<b>' + UI.esc(t.name) + '</b>' +
        '<span>Unit ' + UI.esc(t.unitNo) + ' &middot; ' + UI.esc(DB.building(t.buildingId).name) + '</span>' +
        '<div class="renter-contact">' +
          '<div>' + icon('phone') + UI.esc(t.phone || '—') + '</div>' +
          '<div>' + icon('calendar') + 'Since ' + UI.fmtDate(t.moveIn) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:right;flex:none">' + UI.statusBadge(t.status) +
        (t.balance ? '<div class="u-sm u-b u-red" style="margin-top:8px">' + UI.peso(t.balance) + '</div>'
                   : '<div class="u-xs u-muted" style="margin-top:8px">' + UI.peso(t.rent) + '/mo</div>') +
      '</div>' +
    '</article>';
  }

  var LABEL = 'font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2)';

  function profileHtml() {
    var t = state.selected ? DB.tenant(state.selected) : null;
    if (!t) {
      return UI.card(UI.emptyState('idCard', 'Pick a renter',
        'Select anyone on the left to see their lease, contact details, and payment history.'));
    }

    var u = DB.unit(t.unitId) || { type: '—' };
    var pays = DB.payments.filter(function (p) { return p.tenantId === t.id; }).slice(0, 5);
    var open = DB.chargesOf(t.id);
    var paid = DB.payments.filter(function (p) { return p.tenantId === t.id && p.status === 'cleared'; })
                          .reduce(function (s, p) { return s + p.amount; }, 0);
    var months = Math.max(1, Math.round(UI.daysBetween(t.moveIn, DB.today) / 30));

    return UI.card(
      '<div class="profile-head">' + UI.avatar(t.initials, 'avatar-xl') +
        '<h3>' + UI.esc(t.name) + '</h3>' +
        '<p>Unit ' + UI.esc(t.unitNo) + ' &middot; ' + UI.esc(u.type) + '</p>' +
        '<div class="u-mt">' + UI.statusBadge(t.status) + '</div>' +
      '</div>' +
      '<div class="profile-stats">' +
        '<div><b>' + months + '</b><span>months here</span></div>' +
        '<div><b>' + UI.pesoK(paid) + '</b><span>total paid</span></div>' +
        '<div><b>' + t.occupants + '</b><span>occupants</span></div>' +
      '</div>' +
      '<div class="card-body">' +
        '<h4 class="u-b u-mb" style="' + LABEL + '">Contact</h4>' +
        '<div class="renter-contact">' +
          '<div>' + icon('phone') + UI.esc(t.phone || '—') + '</div>' +
          '<div>' + icon('mail') + UI.esc(t.email || '—') + '</div>' +
          '<div>' + icon('user') + UI.esc(t.occupation) + '</div>' +
          '<div>' + icon('shield') + 'Emergency: ' + UI.esc(t.emergency) + '</div>' +
          '<div>' + icon('lock') + (t.hasLogin ? 'Tenant portal: active' : 'No tenant portal login') + '</div>' +
        '</div>' +

        '<div class="u-rule"></div>' +
        '<h4 class="u-b u-mb" style="' + LABEL + '">Lease</h4>' +
        '<dl class="kv">' +
          '<dt>Monthly rent</dt><dd>' + UI.peso(t.rent) + '</dd>' +
          '<dt>Deposit held</dt><dd>' + UI.peso(t.deposit) + '</dd>' +
          '<dt>Move-in</dt><dd>' + UI.fmtDate(t.moveIn) + '</dd>' +
          '<dt>Lease ends</dt><dd>' + (t.leaseEnd ? UI.fmtDate(t.leaseEnd) : '—') + '</dd>' +
          '<dt>Contract</dt><dd>' + UI.esc(t.contractNo || '—') + '</dd>' +
          '<dt>Balance</dt><dd class="' + (t.balance ? 'u-red' : 'u-green') + '">' +
            (t.balance ? UI.peso(t.balance) + ' (' + t.overdueDays + 'd late)' : 'Fully paid') + '</dd>' +
        '</dl>' +

        (open.length ? '<div class="u-rule"></div>' +
          '<h4 class="u-b u-mb" style="' + LABEL + '">Open charges</h4>' +
          '<div class="rows">' + open.map(function (c) {
            var late = c.due < DB.today;
            return '<div class="row"><div class="row-main"><b>' + UI.esc(c.label) + '</b>' +
              '<span>Due ' + UI.fmtDate(c.due) + (c.paid ? ' &middot; ' + UI.peso(c.paid) + ' paid' : '') + '</span></div>' +
              '<div class="row-end"><b' + (late ? ' class="u-red"' : '') + '>' + UI.peso(c.amount - c.paid) + '</b>' +
              '<button class="link" data-void="' + c.id + '">Waive</button></div></div>';
          }).join('') + '</div>' : '') +

        (pays.length ? '<div class="u-rule"></div>' +
          '<h4 class="u-b u-mb" style="' + LABEL + '">Payment history</h4>' +
          '<div class="timeline">' + pays.map(function (p, i) {
            return '<div class="tl-item' + (i ? ' muted' : '') + '" data-payment="' + p.id + '" style="cursor:pointer"><b>' +
              UI.peso(p.amount) + ' ' + (p.status !== 'cleared' ? UI.statusBadge(p.status) : '') + '</b>' +
              '<span>' + UI.esc(p.covers) + ' &middot; ' + UI.esc(p.method) + '</span>' +
              '<i>' + UI.fmtDate(p.date) + '</i></div>';
          }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="card-foot profile-actions">' +
        '<button class="btn btn-outline btn-sm" data-act="edit">' + icon('edit') + 'Edit</button>' +
        '<button class="btn btn-outline btn-sm" data-act="bill">' + icon('receipt') + 'Add charge</button>' +
        '<button class="btn btn-outline btn-sm" data-act="message">' + icon('message') + 'Message</button>' +
        (t.balance ? '<button class="btn btn-outline btn-sm" data-act="remind">' + icon('bell') + 'Remind</button>' : '') +
        '<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="' +
          API.url('document.php', null, { doc: 'statement', tenant: t.id }) + '">' + icon('file') + 'Statement</a>' +
        '<button class="btn btn-primary btn-sm" data-act="collect">' + icon('peso') + 'Record payment</button>' +
      '</div>' +
      '<div class="card-foot profile-actions" style="border-top:1px solid var(--line-soft)">' +
        (t.hasLogin ? '<button class="btn btn-ghost btn-sm" data-act="reset">' + icon('lock') + 'Reset portal password</button>' : '') +
        '<button class="btn btn-ghost btn-sm u-red" data-act="moveout">' + icon('logout') + 'Move out</button>' +
      '</div>');
  }

  function renderList() {
    var rows = list();
    UI.fill('renterList', rows.length
      ? '<div class="renter-grid">' + rows.map(renterCard).join('') + '</div>'
      : UI.card(UI.emptyState('users', 'No renters found', 'Nothing matches that search in this tab.')));
  }

  function renderProfile() { UI.fill('renterProfile', profileHtml()); }

  function refresh() {
    var all = DB.tenants;
    var overdue = all.filter(function (t) { return t.status === 'overdue'; }).length;
    var notice  = all.filter(function (t) { return t.status === 'notice'; }).length;

    UI.bind({
      total:        all.length + ' renters',
      withBalance:  overdue + ' with a balance',
      onNotice:     notice + ' on notice',
      countAll:     all.length,
      countCurrent: all.filter(function (t) { return t.status === 'current'; }).length,
      countOverdue: overdue,
      countNotice:  notice
    });

    renderList();
    renderProfile();
  }

  function scrollToProfile() {
    /* on phones the profile sits under the list */
    if (window.innerWidth > 1100) return;
    var p = document.getElementById('renterProfile');
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function voidCharge(id, btn) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Confirm waive'; return; }
    Shell.save('void_charge', { id: id }, 'Charge waived').catch(function (e) { UI.toast(e.message, 'warn'); });
  }

  function resetPassword(t) {
    UI.modal({
      title: 'Reset ' + t.name + "'s password?",
      sub: 'A new temporary password replaces the current one',
      body: '<p class="u-sm u-muted" style="line-height:1.6">The tenant will need the new password to sign in to the portal.</p>',
      confirmText: 'Reset password',
      onConfirm: function () {
        return API.post('admin.php', 'reset_password', { id: t.id }).then(function (r) {
          setTimeout(function () { Shell.showCredentials('New password for ' + t.name, r.email, r.tempPassword); }, 50);
        });
      }
    });
  }

  function exportCsv() {
    var rows = list();
    API.downloadCsv('renters-' + Shell.isoDate() + '.csv',
      [['ID', 'Name', 'Unit', 'Phone', 'Email', 'Occupation', 'Occupants', 'Move-in', 'Lease ends', 'Rent', 'Deposit', 'Balance', 'Status']]
      .concat(rows.map(function (t) {
        return [t.id, t.name, t.unitNo, t.phone, t.email, t.occupation, t.occupants, Shell.isoDate(t.moveIn),
                t.leaseEnd ? Shell.isoDate(t.leaseEnd) : '', t.rent, t.deposit, t.balance, t.status];
      })));
    UI.toast('Exported ' + rows.length + ' renter records');
  }

  function init() {
    /* ?tenant=T006 — the client-side equivalent of $_GET['tenant'] */
    var deep = UI.query('tenant');
    if (deep && DB.tenant(deep)) state.selected = deep;

    refresh();

    document.getElementById('rq').addEventListener('input', function (e) {
      state.q = e.target.value;
      renderList();
    });

    UI.wireTabs(document, function (tab) { state.tab = tab; renderList(); });

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var c = e.target.closest('[data-tenant]');
      if (c) { state.selected = c.dataset.tenant; renderList(); renderProfile(); scrollToProfile(); return; }

      var pay = e.target.closest('[data-payment]');
      if (pay) { Shell.openPayment(pay.dataset.payment); return; }

      var v = e.target.closest('[data-void]');
      if (v) { voidCharge(Number(v.dataset.void), v); return; }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      var t = state.selected ? DB.tenant(state.selected) : null;
      if (a.dataset.act === 'export')        exportCsv();
      if (!t) return;
      if (a.dataset.act === 'message')  Shell.openMessage(t.id);
      if (a.dataset.act === 'collect')  Shell.openRecordPayment(t.id);
      if (a.dataset.act === 'edit')     Shell.openEditTenant(t.id);
      if (a.dataset.act === 'bill')     Shell.openAddCharge(t.id);
      if (a.dataset.act === 'remind')   Shell.sendReminder(t.id);
      if (a.dataset.act === 'moveout')  Shell.openMoveOut(t.id);
      if (a.dataset.act === 'reset')    resetPassword(t);
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var c = e.target.closest('[data-tenant]');
      if (c) { state.selected = c.dataset.tenant; renderList(); renderProfile(); }
    });
  }

  global.Page = {
    init: init, refresh: refresh,
    clearSelection: function () { state.selected = null; renderList(); renderProfile(); }
  };

})(window);
