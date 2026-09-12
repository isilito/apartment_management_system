/* ============================================================
   pages/units.js — data for units.html
   Deep link: units.html?unit=B1-2A opens that unit's drawer.
   ============================================================ */
(function (global) {

  var state = { q: '', building: 'all', status: 'all', type: 'all', mode: 'grid' };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DB.units.filter(function (u) {
      if (state.building !== 'all' && u.buildingId !== state.building) return false;
      if (state.status !== 'all' && u.status !== state.status) return false;
      if (state.type !== 'all' && u.typeKey !== state.type) return false;
      if (!q) return true;
      var t = DB.tenantOfUnit(u.id);
      return (u.no + ' ' + u.type + ' ' + (t ? t.name : 'vacant')).toLowerCase().indexOf(q) > -1;
    });
  }

  function unitCard(u) {
    var t = DB.tenantOfUnit(u.id);
    var body;

    if (t) {
      body = '<div class="uc-body">' + UI.avatar(t.initials) +
             '<div style="min-width:0"><b style="font-size:13.5px;display:block">' + UI.esc(t.name) + '</b>' +
             '<span class="u-xs u-muted">Since ' + UI.fmtDate(t.moveIn) + '</span></div></div>';
    } else if (u.status === 'repair') {
      body = '<div class="uc-vacant"><span class="ph">' + icon('wrench') + '</span>' +
             '<span>Under repair &middot; not rentable</span></div>';
    } else {
      body = '<div class="uc-vacant"><span class="ph">' + icon('doorOpen') + '</span>' +
             '<span>Available to rent now</span></div>';
    }

    return '<article class="unit-card" data-unit="' + u.id + '" tabindex="0">' +
      '<div class="uc-top"><div><div class="uc-no">' + UI.esc(u.no) + '</div>' +
        '<div class="uc-type">' + UI.esc(u.type) + ' &middot; ' + u.size + ' sqm</div></div>' +
        UI.statusBadge(u.status) + '</div>' +
      body +
      '<div class="uc-foot"><div class="uc-rent">' + UI.peso(u.rent) + '<span> /mo</span></div>' +
        '<span class="u-xs u-muted">' + UI.esc(DB.building(u.buildingId).name) + '</span></div>' +
    '</article>';
  }

  function unitTable(list) {
    var rows = list.map(function (u) {
      var t = DB.tenantOfUnit(u.id);
      return {
        attrs: 'class="linked" data-unit="' + u.id + '"',
        cells: [
          '<span class="strong">' + UI.esc(u.no) + '</span>',
          '<span class="muted">' + UI.esc(DB.building(u.buildingId).name) + '</span>',
          UI.esc(u.type),
          t ? UI.personCell(t.initials, t.name, t.phone) : '<span class="muted">&mdash;</span>',
          '<span class="strong">' + UI.peso(u.rent) + '</span>',
          t && t.balance ? '<span class="strong u-red">' + UI.peso(t.balance) + '</span>'
                         : '<span class="muted">&mdash;</span>',
          UI.statusBadge(u.status)
        ]
      };
    });
    return UI.card(UI.table([
      { label: 'Unit' }, { label: 'Building' }, { label: 'Type' }, { label: 'Tenant' },
      { label: 'Rent', cls: 'num' }, { label: 'Balance', cls: 'num' }, { label: 'Status' }
    ], rows, 900));
  }

  function renderBuildings() {
    UI.fill('buildingStrip', DB.buildings.map(function (b) {
      var us = DB.units.filter(function (u) { return u.buildingId === b.id; });
      var occ = us.filter(function (u) { return u.status === 'occupied'; }).length;
      return UI.card('<div class="bld"><span class="b-ico">' + icon('building') + '</span>' +
        '<div style="flex:1;min-width:0"><b>' + UI.esc(b.name) + '</b>' +
        '<span>' + occ + ' of ' + us.length + ' units occupied</span></div>' +
        '<b class="u-teal" style="font-size:16px">' + Math.round(occ / us.length * 100) + '%</b></div>');
    }).join(''));
  }

  function renderList() {
    var list = filtered();
    if (!list.length) {
      UI.fill('unitList', UI.card(UI.emptyState('doorOpen', 'No units match those filters',
        'Try clearing the search box or switching back to all buildings.',
        '<button class="btn btn-outline btn-sm" data-act="clear">Clear filters</button>')));
      return;
    }
    UI.fill('unitList', state.mode === 'grid'
      ? '<div class="unit-grid">' + list.map(unitCard).join('') + '</div>'
      : unitTable(list));
  }

  function openUnit(id) {
    var u = DB.unit(id);
    if (!u) return;
    var t = DB.tenantOfUnit(id);
    var b = DB.building(u.buildingId);
    var tix = DB.tickets.filter(function (x) { return x.unitId === id; });
    var pays = DB.payments.filter(function (p) { return t && p.tenantId === t.id; }).slice(0, 5);

    var head = '<div><div class="u-row" style="gap:12px">' +
        '<span class="stat-icon i-teal" style="width:44px;height:44px">' + icon('doorOpen') + '</span>' +
        '<div><h3 style="font-size:19px;font-weight:800;letter-spacing:-.02em">Unit ' + UI.esc(u.no) + '</h3>' +
        '<p class="u-sm u-muted">' + UI.esc(b.name) + ' &middot; Floor ' + u.floor + ' &middot; ' + UI.esc(u.type) + '</p></div>' +
      '</div></div>';

    var body =
      '<div class="u-row u-mb" style="gap:8px">' + UI.statusBadge(u.status) +
        UI.badge(UI.peso(u.rent) + ' / month', 'teal') + UI.badge(u.size + ' sqm', 'outline') + '</div>' +

      (t ?
        UI.card('<div class="card-pad">' +
          '<div class="u-row" style="gap:13px">' + UI.avatar(t.initials, 'avatar-lg') +
            '<div style="flex:1;min-width:0"><b style="font-size:15px">' + UI.esc(t.name) + '</b>' +
            '<div class="u-xs u-muted">' + UI.esc(t.occupation) + ' &middot; ' + t.occupants +
            ' occupant' + (t.occupants > 1 ? 's' : '') + '</div></div>' +
            UI.statusBadge(t.status) + '</div>' +
          '<div class="renter-contact">' +
            '<div>' + icon('phone') + UI.esc(t.phone) + '</div>' +
            '<div>' + icon('mail') + UI.esc(t.email) + '</div>' +
          '</div></div>')
        : UI.card(UI.emptyState('doorOpen', 'This unit is empty',
            u.status === 'repair' ? 'It is flagged for repair and is not listed for rent.'
                                  : 'Ready for a new tenant — assign one to start the lease.',
            u.status === 'repair' ? '' :
              '<button class="btn btn-primary btn-sm" data-act="assign">' + icon('plus') + 'Assign tenant</button>'))) +

      '<h4 class="u-b u-mt-lg u-mb">Lease &amp; terms</h4>' +
      UI.card('<div class="card-pad"><dl class="kv">' +
        '<dt>Monthly rent</dt><dd>' + UI.peso(u.rent) + '</dd>' +
        (t ? '<dt>Security deposit</dt><dd>' + UI.peso(t.deposit) + '</dd>' +
             '<dt>Move-in date</dt><dd>' + UI.fmtDate(t.moveIn) + '</dd>' +
             '<dt>Lease ends</dt><dd>' + UI.fmtDate(t.leaseEnd) + '</dd>' +
             '<dt>Outstanding</dt><dd class="' + (t.balance ? 'u-red' : 'u-green') + '">' +
               (t.balance ? UI.peso(t.balance) : 'Fully paid') + '</dd>'
           : '<dt>Suggested deposit</dt><dd>' + UI.peso(u.rent * 2) + '</dd>' +
             '<dt>Last occupied</dt><dd>&mdash;</dd>') +
      '</dl></div>') +

      (pays.length ? '<h4 class="u-b u-mt-lg u-mb">Recent payments</h4>' +
        UI.card('<div class="card-pad"><div class="rows">' + pays.map(function (p) {
          return '<div class="row"><div class="row-main"><b>' + UI.esc(p.covers) + '</b>' +
            '<span>' + UI.fmtDate(p.date) + ' &middot; ' + UI.esc(p.method) + '</span></div>' +
            '<div class="row-end"><b>' + UI.peso(p.amount) + '</b></div></div>';
        }).join('') + '</div></div>') : '') +

      (tix.length ? '<h4 class="u-b u-mt-lg u-mb">Maintenance history</h4>' +
        UI.card('<div class="card-pad"><div class="rows">' + tix.map(function (x) {
          return '<div class="row"><div class="row-main"><b>' + UI.esc(x.title) + '</b>' +
            '<span>' + UI.esc(x.categoryLabel) + ' &middot; ' + UI.relative(x.created) + '</span></div>' +
            '<div class="row-end">' + UI.statusBadge(x.status) + '</div></div>';
        }).join('') + '</div></div>') : '');

    UI.drawer({
      head: head,
      body: body,
      foot: '<button class="btn btn-outline" data-close>Close</button>' +
            '<button class="btn btn-primary" style="flex:1" data-act="edit-unit">' + icon('edit') + 'Edit unit</button>',
      onOpen: function (r) {
        r.addEventListener('click', function (e) {
          var a = e.target.closest('[data-act]');
          if (!a) return;
          if (a.dataset.act === 'assign') { UI.closeDrawer(); Shell.openAddTenant(u.no); }
          if (a.dataset.act === 'edit-unit') UI.toast('Unit editor opens here once the backend is wired', 'info');
        });
      }
    });
  }

  function refresh() {
    UI.bind({
      unitCount:     DB.stats.totalUnits + ' units',
      occupiedCount: DB.stats.occupied + ' occupied',
      vacantCount:   DB.stats.vacant + ' vacant',
      repairCount:   DB.stats.repair + ' under repair'
    });
    renderBuildings();
    renderList();
  }

  function init() {
    /* option lists come from the data */
    document.getElementById('ub').innerHTML = '<option value="all">All buildings</option>' +
      DB.buildings.map(function (b) { return '<option value="' + b.id + '">' + UI.esc(b.name) + '</option>'; }).join('');
    document.getElementById('ut').innerHTML = '<option value="all">All types</option>' +
      DB.unitTypes.map(function (t) { return '<option value="' + t.key + '">' + UI.esc(t.label) + '</option>'; }).join('');

    refresh();

    document.getElementById('uq').addEventListener('input', function (e) { state.q = e.target.value; renderList(); });
    document.getElementById('ub').addEventListener('change', function (e) { state.building = e.target.value; renderList(); });
    document.getElementById('us').addEventListener('change', function (e) { state.status = e.target.value; renderList(); });
    document.getElementById('ut').addEventListener('change', function (e) { state.type = e.target.value; renderList(); });

    UI.wireSegment(document, function (val) { state.mode = val; renderList(); });

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var u = e.target.closest('[data-unit]');
      if (u) return openUnit(u.dataset.unit);

      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'clear') {
        state.q = ''; state.building = 'all'; state.status = 'all'; state.type = 'all';
        document.getElementById('uq').value = '';
        document.getElementById('ub').value = 'all';
        document.getElementById('us').value = 'all';
        document.getElementById('ut').value = 'all';
        renderList();
      }
      if (a.dataset.act === 'export') UI.toast('Exported ' + filtered().length + ' units to CSV');
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var u = e.target.closest('[data-unit]');
      if (u) openUnit(u.dataset.unit);
    });

    /* ?unit=B1-2A — the client-side equivalent of $_GET['unit'] */
    var deep = UI.query('unit');
    if (deep) setTimeout(function () { openUnit(deep); }, 80);
  }

  global.Page = { init: init, refresh: refresh, openUnit: openUnit };

})(window);
