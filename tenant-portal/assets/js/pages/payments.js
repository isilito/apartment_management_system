/* ============================================================
   pages/payments.js — balance & due dates, plus payment history
   Deep link: payments.html?receipt=RCP-2091 opens that receipt.
   ============================================================ */
(function (global) {

  var state = { tab: 'balance', year: 'all' };

  /* ---------- balance pane ---------- */
  function renderMethods() {
    UI.fill('methodList', DB.methods.map(function (m) {
      return '<div class="method-card">' +
        '<span class="m-ico">' + icon(m.icon) + '</span>' +
        '<div style="flex:1;min-width:0"><b>' + UI.esc(m.label) + '</b>' +
          '<span>' + UI.esc(m.detail) + '</span></div>' +
        '<button class="icon-btn sm bare" data-copy="' + UI.esc(m.detail) + '" title="Copy details" aria-label="Copy details">' +
          icon('file') + '</button></div>';
    }).join(''));
  }

  function renderCharges() {
    var sorted = DB.charges.slice().sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'paid' ? 1 : -1;
      return a.due - b.due;
    });

    UI.fill('chargeList', sorted.map(function (c) {
      var days = DB.daysFrom(c.due);
      var paid = c.status === 'paid';
      var pending = c.status === 'pending';
      var tone = paid ? 'i-green' : (pending ? 'i-teal' : (days < 0 ? 'i-red' : (days <= 3 ? 'i-amber' : 'i-teal')));
      var when = paid
        ? 'Paid ' + (c.paidOn ? UI.fmtDate(c.paidOn) : '')
        : (pending ? 'Payment sent — waiting for confirmation'
        : (days < 0 ? Math.abs(days) + ' days overdue'
                    : (days === 0 ? 'Due today' : 'Due in ' + days + ' days')) +
          (c.partial ? ' · ' + UI.peso(c.total - c.amount) + ' already paid' : ''));

      return '<div class="charge-row">' +
        '<span class="ch-ico stat-icon ' + tone + '">' +
          icon({ rent: 'home', utility: 'droplet', late_fee: 'clock', deposit: 'shield' }[c.kind] || 'receipt') + '</span>' +
        '<div class="ch-meta"><b>' + UI.esc(c.label) + '</b>' +
          '<span>' + UI.esc(c.detail) + ' &middot; ' + UI.fmtDate(c.due) + '</span></div>' +
        '<div class="ch-end">' +
          '<div><div class="ch-amt">' + UI.peso(c.amount) + '</div>' +
            '<div class="u-xs ' + (paid ? 'u-green' : (days < 0 ? 'u-red' : 'u-muted')) + '">' +
              UI.esc(when) + '</div></div>' +
          (paid ? UI.badge('Paid', 'green')
            : pending ? UI.badge('Pending', 'teal')
            : c.kind !== 'rent' ? UI.badge('Pay at office', 'slate')
            : '<button class="btn btn-primary btn-sm" data-shell-act="pay" data-charge="' +
              c.id + '">Pay</button>') +
        '</div></div>';
    }).join(''));
  }

  /* ---------- history pane ---------- */
  function years() {
    var set = {};
    DB.payments.forEach(function (p) { set[p.date.getFullYear()] = true; });
    return Object.keys(set).sort(function (a, b) { return b - a; });
  }

  function filtered() {
    return DB.payments.filter(function (p) {
      return state.year === 'all' || String(p.date.getFullYear()) === state.year;
    });
  }

  function renderHistory() {
    var list = filtered();

    if (!list.length) {
      UI.fill('paymentRows', '<tr><td colspan="7">' +
        UI.emptyState('receipt', 'No payments in this period',
          'Choose a different year to see more.') + '</td></tr>');
      return;
    }

    UI.fill('paymentRows', UI.tbody(list.map(function (p) {
      var m = DB.methods.filter(function (x) { return x.label === p.method; })[0];
      return {
        attrs: 'class="linked" data-receipt="' + p.id + '"',
        cells: [
          '<span class="strong nowrap">' + UI.esc(p.id) + '</span>',
          '<span class="nowrap">' + UI.fmtDate(p.date) + '</span>',
          UI.esc(p.covers),
          '<span class="u-row" style="gap:7px">' + icon(m ? m.icon : 'card') + UI.esc(p.method) + '</span>',
          '<span class="muted">' + UI.esc(p.ref) + '</span>',
          '<span class="strong">' + UI.peso(p.amount) + '</span>',
          UI.statusBadge(p.status)
        ]
      };
    }), ['', '', '', '', '', 'num', '']));
  }

  /* ---------- receipt ---------- */
  function openReceipt(id) {
    var p = DB.payment(id);
    if (!p) return;

    UI.modal({
      title: 'Receipt ' + p.id,
      sub: UI.fmtDate(p.date) + ' · ' + p.method,
      body:
        '<div class="u-row u-mb" style="gap:13px">' +
          '<span class="stat-icon i-green" style="width:48px;height:48px;border-radius:13px">' +
            icon('receipt') + '</span>' +
          '<div style="flex:1"><b style="font-size:20px;letter-spacing:-.02em">' + UI.peso(p.amount) + '</b>' +
            '<div class="u-xs u-muted">' + UI.esc(p.covers) + '</div></div>' +
          UI.statusBadge(p.status) + '</div>' +
        '<dl class="kv">' +
          '<dt>Paid by</dt><dd>' + UI.esc(DB.tenant.name) + '</dd>' +
          '<dt>Unit</dt><dd>' + UI.esc(DB.rental.unitNo) + ' · ' + UI.esc(DB.rental.building) + '</dd>' +
          '<dt>Date paid</dt><dd>' + UI.fmtDate(p.date) + '</dd>' +
          '<dt>Method</dt><dd>' + UI.esc(p.method) + '</dd>' +
          '<dt>Reference</dt><dd>' + UI.esc(p.ref) + '</dd>' +
          '<dt>Received by</dt><dd>' + UI.esc(p.receivedBy) + '</dd>' +
          (p.proof ? '<dt>Your proof</dt><dd><a href="' + p.proof + '" target="_blank" rel="noopener">View attachment</a></dd>' : '') +
          (p.status === 'rejected' && p.note ? '<dt>Why it was rejected</dt><dd class="u-red">' + UI.esc(p.note) + '</dd>' : '') +
        '</dl>' +
        (p.status === 'pending' ? '<p class="u-sm u-muted u-mt">The office checks your reference number, then confirms the payment. You will get a notice when it clears.</p>' : ''),
      foot: '<button class="btn btn-ghost" data-close>Close</button>' +
            '<button class="btn btn-primary" data-confirm>' + icon('print') + 'Open printable receipt</button>',
      onConfirm: function () { window.open(API.url('receipt.php', null, { id: p.id }), '_blank'); }
    });
  }

  function showPane(name) {
    document.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
  }

  function refresh() {
    var s = DB.stats;
    var r = DB.rental;

    UI.bind({
      unitLine:     'Unit ' + r.unitNo,
      rentLine:     UI.peso(r.rent) + ' per month',
      dueLine:      'Due on the ' + r.dueDay + 'th',

      balanceLabel: s.overdueCount ? 'Overdue balance' : 'Total coming up',
      balanceAmount: UI.peso(s.totalDue),
      balanceNote:  s.overdueCount
                      ? s.overdueCount + ' charge' + (s.overdueCount > 1 ? 's are' : ' is') + ' past due'
                      : (s.nextCharge
                          ? 'Next payment due in ' + s.nextDueInDays + ' days'
                          : 'You are fully paid up'),
      nextDue:      s.nextCharge ? UI.fmtDate(s.nextCharge.due) : '—',
      monthlyRent:  UI.peso(r.rent),
      graceInfo:    r.graceDays + ' days',

      tabHistory:   DB.payments.length,
      paidYear:     UI.peso(s.paidThisYear),
      paidYearNote: DB.payments.filter(function (p) {
                      return p.status === 'cleared' && p.date.getFullYear() === DB.today.getFullYear();
                    }).length + ' payments in ' + DB.today.getFullYear(),
      receiptCount: String(DB.payments.length),
      streak:       s.onTimeStreak,
      depositHeld:  UI.peso(r.deposit)
    });

    renderMethods();
    renderCharges();
    renderHistory();
    UI.resolveIcons(document);
    UI.animateMeters(document);
  }

  function init() {
    var yf = document.getElementById('yearFilter');
    yf.innerHTML = '<option value="all">All years</option>' +
      years().map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');

    refresh();

    UI.wireTabs(document, function (tab) { state.tab = tab; showPane(tab); });

    yf.addEventListener('change', function () { state.year = yf.value; renderHistory(); });

    document.querySelector('.content').addEventListener('click', function (e) {
      var rc = e.target.closest('[data-receipt]');
      if (rc && !e.target.closest('button')) { openReceipt(rc.dataset.receipt); return; }

      var cp = e.target.closest('[data-copy]');
      if (cp) {
        if (navigator.clipboard) navigator.clipboard.writeText(cp.dataset.copy);
        UI.toast('Payment details copied');
        return;
      }

      var a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'statement') {
        window.open(API.url('document.php', null, { doc: 'statement' }), '_blank');
      }
    });

    /* ?receipt=RCP-2091 — the client-side equivalent of $_GET['receipt'] */
    var deep = UI.query('receipt');
    if (deep) {
      state.tab = 'history';
      document.querySelectorAll('.tabs button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.tab === 'history');
      });
      showPane('history');
      setTimeout(function () { openReceipt(deep); }, 80);
    }
  }

  global.Page = { init: init, refresh: refresh };

})(window);
