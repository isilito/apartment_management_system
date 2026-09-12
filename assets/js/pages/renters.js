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
          '<div>' + icon('phone') + UI.esc(t.phone) + '</div>' +
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

    var u = DB.unit(t.unitId);
    var pays = DB.payments.filter(function (p) { return p.tenantId === t.id; }).slice(0, 4);
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
          '<div>' + icon('phone') + UI.esc(t.phone) + '</div>' +
          '<div>' + icon('mail') + UI.esc(t.email) + '</div>' +
          '<div>' + icon('user') + UI.esc(t.occupation) + '</div>' +
          '<div>' + icon('shield') + 'Emergency: ' + UI.esc(t.emergency) + '</div>' +
        '</div>' +

        '<div class="u-rule"></div>' +
        '<h4 class="u-b u-mb" style="' + LABEL + '">Lease</h4>' +
        '<dl class="kv">' +
          '<dt>Monthly rent</dt><dd>' + UI.peso(t.rent) + '</dd>' +
          '<dt>Deposit held</dt><dd>' + UI.peso(t.deposit) + '</dd>' +
          '<dt>Move-in</dt><dd>' + UI.fmtDate(t.moveIn) + '</dd>' +
          '<dt>Lease ends</dt><dd>' + UI.fmtDate(t.leaseEnd) + '</dd>' +
          '<dt>Balance</dt><dd class="' + (t.balance ? 'u-red' : 'u-green') + '">' +
            (t.balance ? UI.peso(t.balance) + ' (' + t.overdueDays + 'd late)' : 'Fully paid') + '</dd>' +
        '</dl>' +

        (pays.length ? '<div class="u-rule"></div>' +
          '<h4 class="u-b u-mb" style="' + LABEL + '">Payment history</h4>' +
          '<div class="timeline">' + pays.map(function (p, i) {
            return '<div class="tl-item' + (i ? ' muted' : '') + '"><b>' + UI.peso(p.amount) + '</b>' +
              '<span>' + UI.esc(p.covers) + ' &middot; ' + UI.esc(p.method) + '</span>' +
              '<i>' + UI.fmtDate(p.date) + '</i></div>';
          }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="card-foot">' +
        '<button class="btn btn-outline btn-sm" data-act="message">' + icon('message') + 'Message</button>' +
        '<button class="btn btn-primary btn-sm" style="flex:1" data-act="collect">' + icon('peso') + 'Record payment</button>' +
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
      if (c) { state.selected = c.dataset.tenant; renderList(); renderProfile(); return; }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      var t = state.selected ? DB.tenant(state.selected) : null;
      if (a.dataset.act === 'export')        UI.toast('Exported ' + list().length + ' renter records');
      if (a.dataset.act === 'message' && t)  UI.toast('Opening message thread with ' + t.name, 'info');
      if (a.dataset.act === 'collect' && t)  Shell.openRecordPayment(t.id);
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var c = e.target.closest('[data-tenant]');
      if (c) { state.selected = c.dataset.tenant; renderList(); renderProfile(); }
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
