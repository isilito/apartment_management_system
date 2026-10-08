/* ============================================================
   pages/dashboard.js — the tenant's home screen
   ============================================================ */
(function (global) {

  function greeting() {
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
    return part + ', ' + UI.esc(DB.tenant.name.split(' ')[0]);
  }

  /* A ring showing how close the next due date is */
  function dueRing() {
    var s = DB.stats;
    if (!s.nextCharge) {
      return Charts.donut([{ label: 'Clear', value: 1, color: Charts.colors.green }],
                          '0', 'nothing due', 168);
    }
    var days = s.nextDueInDays;
    var span = 30;                                   // a month-long runway
    var elapsed = Math.max(0, Math.min(span, span - days));
    var tone = days < 0 ? Charts.colors.red
             : (days <= 3 ? Charts.colors.amber : Charts.colors.teal);

    return Charts.donut(
      [{ label: 'Elapsed', value: elapsed, color: tone },
       { label: 'Remaining', value: Math.max(0, span - elapsed), color: '#EEF2F5' }],
      days < 0 ? Math.abs(days) + 'd' : days + 'd',
      days < 0 ? 'overdue' : 'until due',
      168
    );
  }

  function renderUpcoming() {
    var unpaid = DB.charges.filter(function (c) { return c.status !== 'paid'; })
                           .sort(function (a, b) { return a.due - b.due; });

    if (!unpaid.length) {
      UI.fill('upcomingCharges',
        '<div class="u-row" style="gap:10px;padding:8px 0">' +
          '<span class="badge badge-green">' + icon('check') + 'All settled</span>' +
          '<span class="u-sm u-muted">Nothing is due right now.</span></div>');
      return;
    }

    UI.fill('upcomingCharges', unpaid.map(function (c) {
      var days = DB.daysFrom(c.due);
      var tone = c.status === 'pending' ? 'teal' : (days < 0 ? 'red' : (days <= 3 ? 'amber' : 'slate'));
      var when = c.status === 'pending' ? 'Awaiting confirmation'
               : (days < 0 ? Math.abs(days) + ' days late' : (days === 0 ? 'Due today' : 'in ' + days + ' days'));
      return '<div class="row">' +
        '<div class="row-main"><b>' + UI.esc(c.label) + '</b>' +
          '<span>' + UI.fmtDate(c.due) + ' &middot; ' + UI.esc(c.detail) + '</span></div>' +
        '<div class="row-end"><b>' + UI.peso(c.amount) + '</b>' +
          UI.badge(when, tone) + '</div></div>';
    }).join(''));
  }

  function renderOpenRequests() {
    var open = DB.requests.filter(function (r) { return r.status !== 'done'; });

    if (!open.length) {
      UI.fill('openRequests', UI.emptyState('check', 'Nothing needs fixing',
        'You have no open maintenance requests.',
        '<button class="btn btn-outline btn-sm" data-shell-act="new-request">' +
        icon('plus') + 'Report a problem</button>'));
      return;
    }

    UI.fill('openRequests', '<div class="req-list">' + open.map(function (r) {
      var cat = DB.category(r.category);
      return '<article class="card req-card p-' + r.priority + '" data-request="' + r.id + '" tabindex="0">' +
        '<span class="rq-ico stat-icon i-amber">' + icon(cat.icon) + '</span>' +
        '<div class="rq-body">' +
          '<div class="rq-top"><span class="rq-id">' + UI.esc(r.id) + '</span>' +
            UI.statusBadge(r.status) + '</div>' +
          '<h4>' + UI.esc(r.title) + '</h4>' +
          '<p>' + UI.esc(r.detail) + '</p>' +
          '<div class="rq-foot">' +
            '<span>' + icon('calendar') + 'Sent ' + UI.relative(r.submitted) + '</span>' +
            (r.assignee ? '<span>' + icon('user') + UI.esc(r.assignee) + '</span>' : '') +
            (r.scheduledFor ? '<span>' + icon('clock') + 'Visit ' + UI.fmtDate(r.scheduledFor) + '</span>' : '') +
            (r.media.length ? '<span>' + icon('eye') + r.media.length + ' attachment' +
              (r.media.length > 1 ? 's' : '') + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="rq-end">' + UI.statusBadge(r.priority) + '</div>' +
      '</article>';
    }).join('') + '</div>');
  }

  /* Six months of rent, derived from the receipts on file */
  function renderPayRecord() {
    var out = [];
    for (var back = 5; back >= 0; back--) {
      var m = new Date(DB.today.getFullYear(), DB.today.getMonth() - back, 1);
      var paid = DB.payments.some(function (p) {
        return p.status === 'cleared' &&
               p.covers.toLowerCase().indexOf('rent') > -1 &&
               p.date.getFullYear() === m.getFullYear() &&
               p.date.getMonth() === m.getMonth();
      });
      out.push('<div class="bc-dot' + (paid ? ' paid' : '') + '">' +
        '<i>' + icon(paid ? 'check' : 'clock') + '</i>' +
        '<span>' + UI.MONTHS[m.getMonth()] + '</span></div>');
    }
    UI.fill('payRecord', out.join(''));
  }

  function renderRecentPayments() {
    if (!DB.payments.length) { UI.fill('recentPayments', '<p class="u-sm u-muted">No payments yet.</p>'); return; }
    UI.fill('recentPayments', DB.payments.slice(0, 4).map(function (p) {
      return '<div class="row" data-receipt="' + p.id + '" style="cursor:pointer"><div class="row-main"><b>' + UI.peso(p.amount) + '</b>' +
        '<span>' + UI.esc(p.covers) + ' &middot; ' + UI.esc(p.method) + '</span></div>' +
        '<div class="row-end"><span class="u-xs u-muted">' + UI.fmtDate(p.date) + '</span>' +
        '<div style="margin-top:4px">' + UI.statusBadge(p.status) + '</div></div></div>';
    }).join(''));
  }

  function refresh() {
    var s = DB.stats;
    var owed = s.totalDue;

    UI.bind({
      greeting:     greeting(),
      today:        UI.fmtDateLong(DB.today),
      unitLine:     'Unit ' + DB.rental.unitNo + ' · ' + DB.rental.building,
      tenure:       s.monthsStayed + ' months here',

      balanceLabel: s.overdueCount ? 'Overdue balance' : 'Total coming up',
      balanceAmount: UI.peso(owed),
      balanceNote:  s.overdueCount
                      ? s.overdueCount + ' charge' + (s.overdueCount > 1 ? 's are' : ' is') + ' past due'
                      : (s.nextCharge
                          ? 'Nothing overdue — next payment in ' + s.nextDueInDays + ' days'
                          : 'You are fully paid up'),
      nextDueDate:  s.nextCharge ? UI.fmtDate(s.nextCharge.due) : '—',
      paidThisYear: UI.peso(s.paidThisYear),
      onTimeStreak: s.onTimeStreak + ' in a row',

      openRequestsNote: s.openRequests
                          ? s.openRequests + ' open right now'
                          : 'Nothing open',

      noticeTitle:  DB.notices[0] ? UI.esc(DB.notices[0].title) : '',
      noticeBody:   DB.notices[0] ? UI.esc(DB.notices[0].body) : ''
    });

    var notice = document.getElementById('topNotice');
    if (notice) notice.hidden = !(DB.notices[0] && DB.notices[0].unread);

    UI.fill('dueRing', dueRing());
    renderUpcoming();
    renderPayRecord();
    renderOpenRequests();
    renderRecentPayments();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();

    document.querySelector('.content').addEventListener('click', function (e) {
      var r = e.target.closest('[data-request]');
      if (r) location.href = 'maintenance.html?request=' + r.dataset.request;
      var p = e.target.closest('[data-receipt]');
      if (p) location.href = 'payments.html?receipt=' + p.dataset.receipt;
    });

    document.querySelector('.content').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var r = e.target.closest('[data-request]');
      if (r) location.href = 'maintenance.html?request=' + r.dataset.request;
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
