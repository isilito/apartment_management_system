/* ============================================================
   pages/dashboard.js — data for dashboard.html

   The page structure lives in the HTML. This file only fills the
   [data-bind] slots and the mount points, which is exactly what a
   PHP controller would hand to the template.
   ============================================================ */
(function (global) {

  var els = {};

  /* ---------- bindings for the static markup ---------- */
  function values() {
    var s = DB.stats;
    return {
      today:            UI.fmtDateLong(DB.today),
      unitCount:        s.totalUnits + ' units',
      buildingCount:    s.buildingsCount + ' buildings',

      occupied:         s.occupied + ' / ' + s.totalUnits,
      occupancyPct:     s.occupancyPct + '%',
      occupancyBar:     s.occupancyPct,
      occupancyNote:    s.vacant + ' vacant · ' + s.repair + ' under repair right now',
      occupancySub:     'Where all ' + s.totalUnits + ' units stand today',

      income:           UI.peso(s.incomeThisMonth),
      incomeDelta:      icon('trendUp') + s.incomeDelta + '%',
      incomeBar:        Math.round(s.incomeThisMonth / s.incomeTarget * 100),
      incomeNote:       Math.round(s.incomeThisMonth / s.incomeTarget * 100) +
                        '% of the ' + UI.peso(s.incomeTarget) + ' target',

      outstanding:      UI.peso(s.outstanding),
      outstandingCount: s.overdueTenants.length + ' tenants',
      outstandingBar:   Math.round(s.outstanding / s.expectedThisMonth * 100),
      outstandingNote:  Math.round(s.outstanding / s.expectedThisMonth * 100) + '% of rent still uncollected',

      repairs:          String(s.openRepairs),
      repairsUrgent:    s.urgentRepairs + ' urgent',
      repairsBar:       Math.min(100, s.openRepairs / 12 * 100),
      repairsNote:      'Oldest request is ' + s.oldestRepairDays + ' days old',

      monthYear:        UI.fmtMonthYear(DB.today),
      collected:        UI.peso(s.incomeThisMonth),
      collectedOf:      'of ' + UI.peso(s.expectedThisMonth),
      collectedBar:     Math.round(s.incomeThisMonth / s.expectedThisMonth * 100),
      collectedPct:     Math.round(s.incomeThisMonth / s.expectedThisMonth * 100) + '% collected',
      outstandingLabel: UI.peso(s.outstanding) + ' outstanding',
      remindAllLabel:   'Send reminder to all ' + s.overdueTenants.length + ' tenants'
    };
  }

  /* ---------- mount points ---------- */
  var chartRange = '6';

  function renderChart(months) {
    var data = months || (chartRange === '3' ? DB.monthly.slice(-3) : DB.monthly);
    UI.fill('rentChart', Charts.groupedBars(data, { width: Charts.widthOf('rentChart') }));
  }

  function renderOccupancy() {
    var s = DB.stats;
    var segs = [
      { label: 'Occupied',     value: s.occupied, color: Charts.colors.teal },
      { label: 'Vacant',       value: s.vacant,   color: Charts.colors.ring },
      { label: 'Under repair', value: s.repair,   color: Charts.colors.amber }
    ];
    UI.fill('occupancyDonut', Charts.donut(segs, s.occupancyPct + '%', 'occupied', 210));
    UI.fill('occupancyLegend', segs.map(function (g) {
      return '<div class="legend-item"><i class="dot-mark" style="background:' + g.color + '"></i>' +
        '<span class="lg-name">' + g.label + '</span>' +
        '<span class="lg-val">' + g.value + ' units</span>' +
        '<span class="lg-pct">' + (g.value / s.totalUnits * 100).toFixed(1) + '%</span></div>';
    }).join(''));
  }

  function renderOverdue() {
    UI.fill('overdueRows', DB.stats.overdueTenants.slice(0, 3).map(function (t) {
      return '<div class="row">' + UI.avatar(t.initials, 'avatar-sm') +
        '<div class="row-main"><b>' + UI.esc(t.name) + '</b>' +
          '<span>Unit ' + UI.esc(t.unitNo) + ' &middot; ' + t.overdueDays + ' days late</span></div>' +
        '<div class="row-end"><b class="u-red">' + UI.peso(t.balance) + '</b>' +
          '<button class="link" data-remind="' + t.id + '">Remind</button></div></div>';
    }).join(''));
  }

  function renderPayments(buildingId) {
    var list = DB.payments.filter(function (p) {
      if (buildingId === 'all' || !buildingId) return true;
      var u = DB.units.filter(function (x) { return x.no === p.unitNo; })[0];
      return u && u.buildingId === buildingId;
    }).slice(0, 5);

    if (!list.length) {
      UI.fill('recentPaymentRows',
        '<tr><td colspan="7">' + UI.emptyState('receipt', 'No payments yet',
          'Nothing recorded for this building this month.') + '</td></tr>');
      return;
    }

    UI.fill('recentPaymentRows', UI.tbody(list.map(function (p) {
      return {
        attrs: 'class="linked" data-payment="' + p.id + '"',
        cells: [
          UI.personCell(p.initials, p.tenantName),
          '<span class="strong">' + UI.esc(p.unitNo) + '</span>',
          '<span class="nowrap">' + UI.fmtDate(p.date) + '</span>',
          UI.esc(p.method),
          '<span class="muted">' + UI.esc(p.covers) + '</span>',
          '<span class="strong">' + UI.peso(p.amount) + '</span>',
          UI.statusBadge(p.status)
        ]
      };
    }), ['', '', '', '', '', 'num', '']));
  }

  /* ---------- lifecycle ---------- */
  function refresh() {
    UI.bind(values());
    UI.resolveIcons(document);
    renderChart();
    renderOccupancy();
    renderOverdue();
    renderPayments(els.filter ? els.filter.value : 'all');
    UI.animateMeters(document);
  }

  function init() {
    els.filter = document.getElementById('unitFilter');

    /* building options come from the data, not hardcoded markup */
    els.filter.innerHTML = '<option value="all">All units</option>' +
      DB.buildings.map(function (b) {
        return '<option value="' + b.id + '">' + UI.esc(b.name) + '</option>';
      }).join('');

    refresh();

    els.filter.addEventListener('change', function () { renderPayments(els.filter.value); });

    UI.wireSegment(document, function (val) {
      chartRange = val;
      renderChart();
    });

    /* Redraw at the new container width so axis labels never scale up */
    UI.onResize(function () { renderChart(); renderOccupancy(); });

    document.querySelector('.content').addEventListener('click', function (e) {
      var el;

      if ((el = e.target.closest('[data-remind]'))) {
        UI.toast('Reminder sent to ' + DB.tenant(el.dataset.remind).name);
        return;
      }
      if ((el = e.target.closest('[data-payment]'))) {
        Shell.openPayment(el.dataset.payment);
        return;
      }
      if (e.target.closest('[data-act="remind-all"]')) {
        UI.toast('SMS reminders queued for ' + DB.stats.overdueTenants.length + ' tenants');
      }
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
