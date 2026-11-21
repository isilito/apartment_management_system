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
      greeting:         greeting(),
      today:            UI.fmtDateLong(DB.today),
      unitCount:        s.totalUnits + ' units',
      buildingCount:    s.buildingsCount + ' buildings',

      occupied:         s.occupied + ' / ' + s.totalUnits,
      occupancyPct:     s.occupancyPct + '%',
      occupancyBar:     s.occupancyPct,
      occupancyNote:    s.vacant + ' empty · ' + s.repair + ' being repaired',
      occupancySub:     'Where all ' + s.totalUnits + ' units stand today',

      income:           UI.peso(s.incomeThisMonth),
      incomeDelta:      s.incomeLastMonth
                          ? icon(s.incomeDelta < 0 ? 'trendDown' : 'trendUp') + Math.abs(s.incomeDelta) + '% vs last month'
                          : '',
      incomeBar:        pct(s.incomeThisMonth, s.incomeTarget),
      incomeNote:       pct(s.incomeThisMonth, s.incomeTarget) +
                        '% of the ' + UI.peso(s.incomeTarget) + ' you expect each month' +
                        (s.earlierDated ? ' · ' + UI.peso(s.earlierDated) +
                          ' confirmed this month counts under its earlier date paid' : ''),

      outstanding:      UI.peso(s.outstanding),
      outstandingCount: plural(s.overdueTenants.length, 'tenant'),
      outstandingBar:   pct(s.outstanding, s.expectedThisMonth),
      outstandingNote:  s.overdueTenants.length
                          ? 'The latest payer is ' + s.overdueTenants[0].overdueDays + ' days late'
                          : 'Everyone is paid up',

      repairs:          String(s.openRepairs),
      repairsUrgent:    s.urgentRepairs + ' urgent',
      repairsBar:       Math.min(100, s.openRepairs / 12 * 100),
      repairsNote:      s.openRepairs ? 'The oldest was reported ' + s.oldestRepairDays + ' days ago' : 'Nothing needs fixing',

      monthYear:        UI.fmtMonthYear(DB.today),
      collected:        UI.peso(s.incomeThisMonth),
      collectedOf:      'of ' + UI.peso(s.expectedThisMonth),
      collectedBar:     pct(s.incomeThisMonth, s.expectedThisMonth),
      collectedPct:     pct(s.incomeThisMonth, s.expectedThisMonth) + '% received',
      outstandingLabel: UI.peso(s.outstanding) + ' still unpaid',
      emptySub:         s.vacant
                          ? plural(s.vacant, 'unit') + ' ready for a new tenant' + (s.repair ? ', ' + s.repair + ' being repaired' : '')
                          : (s.repair ? s.repair + ' being repaired' : 'Every unit has a tenant'),
      remindAllLabel:   s.overdueTenants.length
                          ? 'Remind all ' + s.overdueTenants.length + ' late tenants'
                          : 'No reminders needed',
      pendingNote:      s.pendingCount
                          ? s.pendingCount + ' portal payment' + (s.pendingCount > 1 ? 's' : '') + ' (' +
                            UI.peso(s.pendingAmount) + ') waiting for you to confirm'
                          : ''
    };
  }

  function pct(a, b) { return b ? Math.min(100, Math.round(a / b * 100)) : 0; }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  function greeting() {
    var h = new Date().getHours();
    var me = (DB.me && DB.me.name) || '';
    return (h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening')) +
      (me ? ', ' + UI.esc(me.split(' ')[0]) : '');
  }

  /* ---------- "What needs your attention": plain sentences, most urgent first ---------- */
  function todoItems() {
    var s = DB.stats, out = [];

    if (s.pendingCount) out.push({
      tone: 'teal', ico: 'receipt',
      text: '<b>' + plural(s.pendingCount, 'payment') + ' from tenants ' + (s.pendingCount === 1 ? 'is' : 'are') +
            ' waiting for you to check</b> (' + UI.peso(s.pendingAmount) + '). Confirm them once the money is in your account.',
      btn: 'Check payments', href: 'payments.html?status=pending'
    });

    if (s.overdueTenants.length) {
      var worst = s.overdueTenants[0];
      out.push({
        tone: 'red', ico: 'clock',
        text: '<b>' + plural(s.overdueTenants.length, 'tenant') + ' owe' + (s.overdueTenants.length === 1 ? 's' : '') +
              ' rent</b>, ' + UI.peso(s.outstanding) + ' in total. ' + UI.esc(worst.name) + ' (Unit ' +
              UI.esc(worst.unitNo) + ') is the furthest behind at ' + worst.overdueDays + ' days.',
        btn: 'See who owes', href: 'payments.html?tab=outstanding'
      });
    }

    var urgent = DB.tickets.filter(function (t) { return t.status !== 'done' && t.priority === 'urgent'; });
    var fresh  = DB.tickets.filter(function (t) { return t.status === 'new'; });
    if (urgent.length) out.push({
      tone: 'red', ico: 'wrench',
      text: '<b>' + plural(urgent.length, 'urgent repair') + ' still open:</b> ' +
            urgent.slice(0, 2).map(function (t) { return UI.esc(t.title) + ' (Unit ' + UI.esc(t.unitId) + ')'; }).join(', ') +
            (urgent.length > 2 ? ' and more' : '') + '.',
      btn: 'Open repairs', href: 'maintenance.html'
    });
    if (fresh.length) out.push({
      tone: 'amber', ico: 'wrench',
      text: '<b>' + plural(fresh.length, 'new repair request') + '</b> ' + (fresh.length === 1 ? 'has' : 'have') +
            ' nobody assigned yet. Pick a crew member and a visit date.',
      btn: 'Assign repairs', href: 'maintenance.html'
    });

    var soon = DB.tenants.filter(function (t) {
      var d = t.leaseEnd ? Math.round((t.leaseEnd - DB.today) / 86400000) : 999;
      return t.status !== 'moved_out' && d >= -30 && d <= 60;
    }).sort(function (a, b) { return a.leaseEnd - b.leaseEnd; });
    if (soon.length) out.push({
      tone: 'amber', ico: 'calendar',
      text: '<b>' + plural(soon.length, 'lease') + (soon.length === 1 ? ' is' : ' are') + ' ending or just ended.</b> ' +
            UI.esc(soon[0].name) + ' (Unit ' + UI.esc(soon[0].unitNo) + ') ' +
            (soon[0].leaseEnd < DB.today ? 'ended on ' : 'ends on ') + UI.fmtDate(soon[0].leaseEnd) +
            '. Ask if they will renew.',
      btn: 'Open tenant', href: 'renters.html?tenant=' + encodeURIComponent(soon[0].id)
    });

    if (s.vacant) {
      var empty = DB.units.filter(function (u) { return u.status === 'vacant'; });
      var lost = empty.reduce(function (n, u) { return n + u.rent; }, 0);
      out.push({
        tone: 'slate', ico: 'doorOpen',
        text: '<b>' + plural(s.vacant, 'unit is', 'units are') + ' empty:</b> ' +
              empty.map(function (u) { return UI.esc(u.no); }).join(', ') + '. Renting ' +
              (s.vacant === 1 ? 'it' : 'them') + ' out adds ' + UI.peso(lost) + ' a month.',
        btn: 'See empty units', href: 'units.html?status=vacant'
      });
    }
    return out;
  }

  function renderTodo() {
    var items = todoItems();
    if (!items.length) {
      UI.fill('todoList', '<div class="todo-item"><span class="todo-ico i-green">' + icon('check') + '</span>' +
        '<p><b>You are all caught up.</b> Nobody owes rent, no repairs are waiting and every unit has a tenant.</p></div>');
      return;
    }
    UI.fill('todoList', items.map(function (it, i) {
      return '<div class="todo-item">' +
        '<span class="todo-no">' + (i + 1) + '</span>' +
        '<span class="todo-ico i-' + it.tone + '">' + icon(it.ico) + '</span>' +
        '<p>' + it.text + '</p>' +
        '<a class="btn btn-outline btn-sm" href="' + it.href + '">' + it.btn + icon('arrowRight') + '</a>' +
      '</div>';
    }).join(''));
  }

  /* Units nobody lives in, with their photo */
  function renderEmptyUnits() {
    var list = DB.units.filter(function (u) { return u.status !== 'occupied'; })
      .sort(function (a, b) { return (a.status === 'vacant' ? 0 : 1) - (b.status === 'vacant' ? 0 : 1); });
    if (!list.length) {
      UI.fill('emptyUnits', '<p class="u-sm u-muted" style="padding:6px 0">Every unit has a tenant.</p>');
      return;
    }
    UI.fill('emptyUnits', list.slice(0, 4).map(function (u) {
      return '<a class="photo-row" href="units.html?unit=' + encodeURIComponent(u.id) + '">' +
        '<span class="pr-img">' + UnitPhotos.cover(u) + '</span>' +
        '<span class="pr-main"><b>Unit ' + UI.esc(u.no) + '</b>' +
          '<span>' + UI.esc(u.type) + ' &middot; ' + (u.status === 'repair' ? 'being repaired' : 'ready to rent') + '</span></span>' +
        '<span class="pr-end">' + UI.peso(u.rent) + '<span>a month</span></span>' +
      '</a>';
    }).join(''));
    UnitPhotos.hydrate(document.getElementById('emptyUnits'));
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
      { label: 'Available',    value: s.vacant,   color: Charts.colors.ring },
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
    var pending = {};
    DB.payments.forEach(function (p) {
      if (p.status === 'pending') pending[p.tenantId] = (pending[p.tenantId] || 0) + p.amount;
    });
    UI.fill('overdueRows', DB.stats.overdueTenants.slice(0, 4).map(function (t) {
      return '<div class="row">' + UI.avatar(t.initials, 'avatar-sm') +
        '<div class="row-main"><b>' + UI.esc(t.name) + '</b>' +
          '<span>Unit ' + UI.esc(t.unitNo) + ' &middot; ' + t.overdueDays + ' days late' +
            (pending[t.id] ? ' &middot; ' + UI.peso(pending[t.id]) + ' waiting for you to confirm' : '') + '</span></div>' +
        '<div class="row-end"><b class="u-red">' + UI.peso(t.balance) + '</b>' +
          '<button class="link" data-remind="' + t.id + '">Remind</button></div></div>';
    }).join(''));
  }

  function lastActivity(p) {
    return Math.max(p.createdAt ? p.createdAt.getTime() : 0, p.clearedAt ? p.clearedAt.getTime() : 0);
  }

  function renderPayments(buildingId) {
    var list = DB.payments.filter(function (p) {
      if (buildingId === 'all' || !buildingId) return true;
      var u = DB.unit(p.unitNo);
      return u && u.buildingId === buildingId;
    }).sort(function (a, b) {
      return lastActivity(b) - lastActivity(a);   // a backdated entry still surfaces here
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
    renderTodo();
    renderEmptyUnits();
    var db = document.getElementById('incomeDeltaBadge');
    if (db) {
      db.hidden = !DB.stats.incomeLastMonth;
      db.className = 'badge ' + (DB.stats.incomeDelta < 0 ? 'badge-amber' : 'badge-green');
    }
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
    Shell.startLiveUpdates();

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
