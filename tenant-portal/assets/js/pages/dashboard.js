/* ============================================================
   pages/dashboard.js — the tenant's home screen

   Written for someone who opens it once a month: the first thing
   on screen says how much to pay and by when, in one sentence.
   ============================================================ */
(function (global) {

  function greeting() {
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
    return part + ', ' + UI.esc(DB.tenant.name.split(' ')[0]);
  }

  function lateWords(days) {
    if (days < 0) return Math.abs(days) + ' day' + (days === -1 ? '' : 's') + ' late';
    if (days === 0) return 'due today';
    if (days === 1) return 'due tomorrow';
    return 'due in ' + days + ' days';
  }

  /* Bills split into "pay now" (due today or late) and "coming up".
     A bill with a payment already being checked is neither. */
  function buckets() {
    var unpaid = DB.charges.filter(function (c) { return c.status !== 'paid'; })
                           .sort(function (a, b) { return a.due - b.due; });
    var now = [], later = [], checking = [];
    unpaid.forEach(function (c) {
      if (c.status === 'pending') checking.push(c);
      else if (DB.daysFrom(c.due) <= 0) now.push(c);
      else later.push(c);
    });
    return { now: now, later: later, checking: checking, all: unpaid };
  }

  function andList(parts) {
    return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  function sum(list) { return list.reduce(function (s, c) { return s + c.amount; }, 0); }

  function balanceText(b) {
    if (b.now.length) {
      return {
        label: 'You need to pay now',
        amount: UI.peso(sum(b.now)),
        note: andList(b.now.map(function (c) {
          return UI.esc(c.label) + ' (' + lateWords(DB.daysFrom(c.due)) + ')';
        })) + '.' +
          (b.checking.length ? ' We are also checking ' + b.checking.length + ' payment' +
            (b.checking.length > 1 ? 's' : '') + ' you sent.' : ''),
        pay: 'Pay ' + UI.peso(sum(b.now))
      };
    }
    /* A payment the office has not confirmed yet does not settle the bill:
       show the amount still open (the admin sees the same balance). */
    if (b.checking.length) {
      var nx = b.later[0];
      return {
        label: 'Waiting for the office to confirm',
        amount: UI.peso(sum(b.checking)),
        note: 'You sent a payment for ' + andList(b.checking.map(function (c) {
                return UI.esc(c.label) + (DB.daysFrom(c.due) < 0 ? ' (' + lateWords(DB.daysFrom(c.due)) + ')' : '');
              })) + '. It stays open until the office confirms it, and you will get a notification when it clears.' +
              (nx ? ' Your next bill is ' + UI.esc(nx.label) + ' for ' + UI.peso(nx.amount) + ', due on ' +
                    UI.fmtDate(nx.due) + '.' : ''),
        pay: nx ? 'Pay early' : 'Pay a bill'
      };
    }
    if (b.later.length) {
      var n = b.later[0];
      return {
        label: 'Nothing to pay right now',
        amount: UI.peso(0),
        note: 'Your next bill is ' + UI.esc(n.label) + ' for ' + UI.peso(n.amount) + ', due on ' +
              UI.fmtDate(n.due) + ' (in ' + DB.daysFrom(n.due) + ' days).',
        pay: 'Pay early'
      };
    }
    return { label: 'You are all paid up', amount: UI.peso(0), note: 'Thank you. There is nothing to pay right now.', pay: 'Pay a bill' };
  }

  function renderBills(b) {
    if (!b.all.length) {
      UI.fill('upcomingCharges',
        '<div class="u-row" style="gap:10px;padding:8px 0">' +
          '<span class="badge badge-green">' + icon('check') + 'All paid</span>' +
          '<span class="u-sm u-muted">You have no bills right now.</span></div>');
      return;
    }

    UI.fill('upcomingCharges', b.all.map(function (c) {
      var days = DB.daysFrom(c.due);
      var tone = c.status === 'pending' ? 'teal' : (days < 0 ? 'red' : (days <= 3 ? 'amber' : 'slate'));
      var when = c.status === 'pending' ? 'We are checking your payment'
               : (days < 0 ? Math.abs(days) + ' days late' : (days === 0 ? 'Due today' : 'Due in ' + days + ' days'));
      return '<div class="row">' +
        '<div class="row-main"><b>' + UI.esc(c.label) + '</b>' +
          '<span>Due ' + UI.fmtDate(c.due) + ' &middot; ' + UI.esc(c.detail) + '</span></div>' +
        '<div class="row-end"><b>' + UI.peso(c.amount) + '</b>' +
          UI.badge(when, tone) + '</div></div>';
    }).join(''));
  }

  function renderOpenRequests() {
    var open = DB.requests.filter(function (r) { return r.status !== 'done'; });

    if (!open.length) {
      UI.fill('openRequests', UI.emptyState('check', 'Nothing needs fixing',
        'If something in your unit breaks, report it here and add a photo.',
        '<button class="btn btn-outline btn-sm" data-shell-act="new-request">' +
        icon('plus') + 'Report something broken</button>'));
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
            (r.assignee ? '<span>' + icon('user') + UI.esc(r.assignee) + ' is handling it</span>' : '') +
            (r.scheduledFor ? '<span>' + icon('clock') + 'Visit on ' + UI.fmtDate(r.scheduledFor) + '</span>' : '') +
            (r.media.length ? '<span>' + icon('eye') + r.media.length + ' photo' +
              (r.media.length > 1 ? 's' : '') + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('') + '</div>');
  }

  /* Six months of rent, derived from the receipts on file */
  function renderPayRecord() {
    var out = [];
    for (var back = 5; back >= 0; back--) {
      var m = new Date(DB.today.getFullYear(), DB.today.getMonth() - back, 1);
      var inMonth = function (d) { return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); };
      /* the month's rent charge decides it; older months (no longer sent with the
         charges) fall back to a cleared rent payment, ignoring late fees */
      var charge = DB.charges.filter(function (c) { return c.kind === 'rent' && inMonth(c.due); })[0];
      var paid = charge ? charge.status === 'paid' : DB.payments.some(function (p) {
        var covers = p.covers.toLowerCase();
        return p.status === 'cleared' && covers.indexOf('rent') > -1 &&
               covers.indexOf('late fee') === -1 && inMonth(p.date);
      });
      out.push('<div class="bc-dot' + (paid ? ' paid' : '') + '" title="' + UI.MONTHS[m.getMonth()] +
        (paid ? ': paid' : ': not paid yet') + '">' +
        '<i>' + icon(paid ? 'check' : 'clock') + '</i>' +
        '<span>' + UI.MONTHS[m.getMonth()] + '</span></div>');
    }
    UI.fill('payRecord', out.join(''));
  }

  function renderRecentPayments() {
    if (!DB.payments.length) { UI.fill('recentPayments', '<p class="u-sm u-muted">No payments yet.</p>'); return; }
    UI.fill('recentPayments', DB.payments.slice(0, 12).map(function (p) {
      return '<div class="row" data-receipt="' + p.id + '" style="cursor:pointer" tabindex="0"><div class="row-main"><b>' + UI.peso(p.amount) + '</b>' +
        '<span>' + UI.esc(p.covers) + ' &middot; ' + UI.esc(p.method) + '</span></div>' +
        '<div class="row-end"><span class="u-xs u-muted">' + UI.fmtDate(p.date) + '</span>' +
        '<div style="margin-top:4px">' + UI.statusBadge(p.status) + '</div></div></div>';
    }).join(''));
  }

  /* Key facts about the tenant's own unit */
  function renderHome() {
    var r = DB.rental;
    var facts = [
      { v: r.size + ' sqm',  l: 'Floor area' },
      { v: 'Floor ' + r.floor, l: 'Location' },
      { v: r.furnishing,     l: 'Furnishing' },
      { v: r.leaseEnd ? UI.fmtDate(r.leaseEnd) : '—', l: 'Lease ends' }
    ];
    UI.fill('homeFacts', facts.map(function (f) {
      return '<div><b>' + UI.esc(f.v) + '</b><span>' + UI.esc(f.l) + '</span></div>';
    }).join(''));
  }

  function refresh() {
    var s = DB.stats;
    var b = buckets();
    var bal = balanceText(b);
    var r = DB.rental;
    var next = b.later[0];

    UI.bind({
      greeting:     greeting(),
      lead:         b.now.length
                      ? 'You have ' + b.now.length + ' bill' + (b.now.length > 1 ? 's' : '') + ' to pay. Everything else is below.'
                      : b.checking.length
                      ? 'The office is checking the payment you sent. Everything about your unit is below.'
                      : 'You are up to date. Here is everything about your unit.',
      today:        UI.fmtDateLong(DB.today),
      tenure:       'Living here for ' + s.monthsStayed + ' month' + (s.monthsStayed === 1 ? '' : 's'),

      balanceLabel: bal.label,
      balanceAmount: bal.amount,
      balanceNote:  bal.note,
      payLabel:     bal.pay,
      nextDueDate:  next ? UI.peso(next.amount) + ' on ' + UI.fmtDate(next.due) : 'None yet',
      nextDueLabel: next ? 'Next bill: ' + UI.esc(next.label) : 'Next bill',
      paidThisYear: UI.peso(s.paidThisYear),

      homeTitle:    'Unit ' + UI.esc(r.unitNo) + ' &middot; ' + UI.esc(r.building),
      homeSub:      UI.esc(r.type) + ' &middot; ' + r.size + ' sqm &middot; ' + UI.peso(r.rent) + ' a month, due every ' +
                    r.dueDay + (r.dueDay === 1 ? 'st' : r.dueDay === 2 ? 'nd' : r.dueDay === 3 ? 'rd' : 'th'),

      openRequestsNote: s.openRequests
                          ? s.openRequests + ' repair' + (s.openRequests > 1 ? 's' : '') + ' in progress'
                          : 'Nothing open right now',

      noticeTitle:  DB.notices[0] ? UI.esc(DB.notices[0].title) : '',
      noticeBody:   DB.notices[0] ? UI.esc(DB.notices[0].body) : ''
    });

    var notice = document.getElementById('topNotice');
    if (notice) notice.hidden = !(DB.notices[0] && DB.notices[0].unread);

    renderHome();
    renderBills(b);
    renderPayRecord();
    renderOpenRequests();
    renderRecentPayments();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var r = e.target.closest('[data-request]');
      if (r) location.href = 'maintenance.html?request=' + r.dataset.request;
      var p = e.target.closest('[data-receipt]');
      if (p) location.href = 'payments.html?receipt=' + p.dataset.receipt;
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var r = e.target.closest('[data-request]');
      if (r) location.href = 'maintenance.html?request=' + r.dataset.request;
      var p = e.target.closest('[data-receipt]');
      if (p) location.href = 'payments.html?receipt=' + p.dataset.receipt;
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
