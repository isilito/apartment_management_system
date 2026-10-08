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
      incomeDelta:      icon(s.incomeDelta < 0 ? 'trendDown' : 'trendUp') + Math.abs(s.incomeDelta) + '%',
      incomeBar:        pct(s.incomeThisMonth, s.incomeTarget),
      incomeNote:       pct(s.incomeThisMonth, s.incomeTarget) +
                        '% of the ' + UI.peso(s.incomeTarget) + ' monthly target',

      outstanding:      UI.peso(s.outstanding),
      outstandingCount: s.overdueTenants.length + ' tenants',
      outstandingBar:   pct(s.outstanding, s.expectedThisMonth),
      outstandingNote:  s.overdueTenants.length
                          ? 'Longest unpaid: ' + s.overdueTenants[0].overdueDays + ' days'
                          : 'Everyone is paid up',

      repairs:          String(s.openRepairs),
      repairsUrgent:    s.urgentRepairs + ' urgent',
      repairsBar:       Math.min(100, s.openRepairs / 12 * 100),
      repairsNote:      s.openRepairs ? 'Oldest request is ' + s.oldestRepairDays + ' days old' : 'No open requests',

      monthYear:        UI.fmtMonthYear(DB.today),
      collected:        UI.peso(s.incomeThisMonth),
      collectedOf:      'of ' + UI.peso(s.expectedThisMonth),
      collectedBar:     pct(s.incomeThisMonth, s.expectedThisMonth),
      collectedPct:     pct(s.incomeThisMonth, s.expectedThisMonth) + '% collected',
      outstandingLabel: UI.peso(s.outstanding) + ' outstanding',
      remindAllLabel:   s.overdueTenants.length
                          ? 'Send reminder to all ' + s.overdueTenants.length + ' tenants'
                          : 'No reminders needed',
      pendingNote:      s.pendingCount
                          ? s.pendingCount + ' portal payment' + (s.pendingCount > 1 ? 's' : '') + ' (' +
                            UI.peso(s.pendingAmount) + ') waiting for you to confirm'
                          : ''
    };
  }

  function pct(a, b) { return b ? Math.min(100, Math.round(a / b * 100)) : 0; }

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
    if (!DB.stats.overdueTenants.length) {
      UI.fill('overdueRows', '<p class="u-sm u-muted" style="padding:10px 0">Nobody is behind on rent.</p>');
      return;
    }
    UI.fill('overdueRows', DB.stats.overdueTenants.slice(0, 4).map(function (t) {
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
      var u = DB.unit(p.unitNo);
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
          UI.personCell(p.initials, p.fullName),
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
    var pn = document.getElementById('pendingNotice');
    if (pn) pn.hidden = !DB.stats.pendingCount;
    UI.animateMeters(document);
  }

  function init() {
    els.filter = document.getElementById('unitFilter');

    /* building options come from the data, not hardcoded markup */
    els.filter.innerHTML = '<option value="all">All buildings</option>' +
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
        Shell.sendReminder(el.dataset.remind);
        return;
      }
      if ((el = e.target.closest('[data-payment]'))) {
        Shell.openPayment(el.dataset.payment);
        return;
      }
      if (e.target.closest('[data-act="remind-all"]')) {
        if (DB.stats.overdueTenants.length) Shell.remindAll();
      }
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
