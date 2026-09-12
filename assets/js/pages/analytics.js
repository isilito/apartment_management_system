/* ============================================================
   pages/analytics.js — data for analytics.html
   ============================================================ */
(function (global) {

  function tenureBuckets() {
    var b = [
      { label: 'Under 6 months', min: 0,  max: 6,   n: 0 },
      { label: '6 – 12 months',  min: 6,  max: 12,  n: 0 },
      { label: '1 – 2 years',    min: 12, max: 24,  n: 0 },
      { label: '2 – 3 years',    min: 24, max: 36,  n: 0 },
      { label: 'Over 3 years',   min: 36, max: 999, n: 0 }
    ];
    DB.tenants.forEach(function (t) {
      var m = UI.daysBetween(t.moveIn, DB.today) / 30.4;
      b.forEach(function (x) { if (m >= x.min && m < x.max) x.n++; });
    });
    return b;
  }

  function renderBuildings() {
    UI.fill('buildingRows', UI.tbody(DB.buildings.map(function (b) {
      var us = DB.units.filter(function (u) { return u.buildingId === b.id; });
      var occ = us.filter(function (u) { return u.status === 'occupied'; });
      var pct = Math.round(occ.length / us.length * 100);
      var tix = DB.tickets.filter(function (t) { return t.buildingId === b.id && t.status !== 'done'; }).length;
      return {
        cells: [
          '<span class="u-row" style="gap:10px">' +
            '<span class="stat-icon i-teal" style="width:30px;height:30px;border-radius:8px">' + icon('building') + '</span>' +
            '<span class="strong">' + UI.esc(b.name) + '</span></span>',
          String(us.length),
          String(occ.length),
          '<div style="min-width:120px">' + UI.meter(pct, pct > 90 ? 'green' : (pct > 75 ? 'teal' : 'amber')) +
            '<span class="u-xs u-muted">' + pct + '%</span></div>',
          '<span class="strong">' + UI.peso(us.reduce(function (a, u) { return a + u.rent; }, 0)) + '</span>',
          tix ? UI.badge(String(tix), tix > 2 ? 'red' : 'amber') : '<span class="muted">&mdash;</span>'
        ]
      };
    }), ['', 'num', 'num', '', 'num', 'num']));
  }

  function renderLeases() {
    var upcoming = DB.tenants.filter(function (t) {
      var d = UI.daysBetween(DB.today, t.leaseEnd);
      return d >= 0 && d <= 120;
    }).sort(function (a, b) { return a.leaseEnd - b.leaseEnd; }).slice(0, 8);

    if (!upcoming.length) {
      UI.fill('leaseRows', '<tr><td colspan="6">' +
        UI.emptyState('calendar', 'No leases ending soon',
          'Nothing expires in the next four months.') + '</td></tr>');
      return;
    }

    UI.fill('leaseRows', UI.tbody(upcoming.map(function (t) {
      var d = UI.daysBetween(DB.today, t.leaseEnd);
      return {
        attrs: 'class="linked" data-tenant="' + t.id + '"',
        cells: [
          UI.personCell(t.initials, t.name, t.phone),
          '<span class="strong">' + UI.esc(t.unitNo) + '</span>',
          '<span class="nowrap">' + UI.fmtDate(t.leaseEnd) + '</span>',
          UI.badge(d + ' days', d < 30 ? 'red' : (d < 60 ? 'amber' : 'slate')),
          UI.peso(t.rent),
          UI.statusBadge(t.status)
        ]
      };
    }), ['', '', '', 'num', 'num', '']));
  }

  function refresh() {
    var s = DB.stats;
    var avgTenure = Math.round(DB.tenants.reduce(function (a, t) {
      return a + UI.daysBetween(t.moveIn, DB.today) / 30.4;
    }, 0) / DB.tenants.length);

    UI.bind({
      unitCount:      s.totalUnits + ' units',
      buildingCount:  s.buildingsCount + ' buildings',
      occupancy:      s.occupancyPct + '%',
      tenancy:        avgTenure + ' months',
      tenancyNote:    'Across all ' + DB.tenants.length + ' active renters',
      vacancyLoss:    UI.peso(DB.units.filter(function (u) { return u.status !== 'occupied'; })
                        .reduce(function (a, u) { return a + u.rent; }, 0)),
      repairsPerUnit: (DB.tickets.length / DB.units.length).toFixed(2)
    });

    UI.fill('occupancySpark', Charts.sparkline(
      DB.occupancyTrend.map(function (o) { return o.pct; }), '#0B6E8C'));

    UI.fill('occupancyChart', Charts.areaLine(
      DB.occupancyTrend.map(function (o) { return { label: o.month, value: o.pct }; }),
      { color: Charts.colors.teal, height: 260, width: Charts.widthOf('occupancyChart'),
        fmt: function (v) { return v.toFixed(0) + '%'; } }));

    UI.fill('tenureChart', Charts.rankList(tenureBuckets().map(function (b) {
      return { label: b.label, value: b.n, display: b.n + ' renter' + (b.n === 1 ? '' : 's') };
    })));

    UI.fill('categoryChart', Charts.rankList(DB.categories.map(function (c) {
      var tix = DB.tickets.filter(function (t) { return t.category === c.key; });
      var cost = tix.reduce(function (a, t) { return a + t.cost; }, 0);
      return { label: c.label, value: tix.length, display: tix.length + ' · ' + UI.peso(cost), tone: 'amber' };
    }).sort(function (a, b) { return b.value - a.value; })));

    UI.fill('typeChart', Charts.rankList(DB.unitTypes.map(function (t) {
      var us = DB.units.filter(function (u) { return u.typeKey === t.key; });
      var occ = us.filter(function (u) { return u.status === 'occupied'; }).length;
      var pct = us.length ? Math.round(occ / us.length * 100) : 0;
      return { label: t.label, sub: us.length + ' units', value: pct, display: pct + '% filled', tone: 'teal' };
    })));

    renderBuildings();
    renderLeases();
    UI.resolveIcons(document);
    UI.animateMeters(document);
  }

  function init() {
    refresh();
    UI.onResize(refresh);

    UI.wireSegment(document, function (v) {
      UI.toast('Showing the last ' + v + ' months', 'info');
    });

    document.querySelector('.content').addEventListener('click', function (e) {
      var t = e.target.closest('[data-tenant]');
      if (t) { location.href = 'renters.html?tenant=' + t.dataset.tenant; return; }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'export')   UI.toast('Analytics data exported to CSV');
      if (a.dataset.act === 'renewals') UI.toast('Renewal notices drafted for review', 'info');
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
