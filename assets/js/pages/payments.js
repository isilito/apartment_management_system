/* ============================================================
   pages/payments.js — data for payments.html
   Deep link: payments.html?receipt=PMT-1001 opens that receipt.
   ============================================================ */
(function (global) {

  var state = { q: '', method: 'all', status: 'all', limit: 12 };

  var METHOD_META = {
    'GCash':         { icon: 'smartphone', color: '#0B6E8C' },
    'Bank transfer': { icon: 'bank',       color: '#2E90AE' },
    'Cash':          { icon: 'cash',       color: '#0E7A55' },
    'Maya':          { icon: 'wallet',     color: '#A15C07' }
  };

  function ledger() {
    var q = state.q.trim().toLowerCase();
    return DB.payments.filter(function (p) {
      if (state.method !== 'all' && p.method !== state.method) return false;
      if (state.status !== 'all' && p.status !== state.status) return false;
      if (!q) return true;
      return (p.tenantName + ' ' + p.unitNo + ' ' + p.id + ' ' + p.covers).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ---------- panes ---------- */
  function renderLedger() {
    var all = ledger();
    var page = all.slice(0, state.limit);

    if (!all.length) {
      UI.fill('ledgerRows', '<tr><td colspan="7">' +
        UI.emptyState('receipt', 'No payments match',
          'Adjust the filters, or record a new payment to get started.') + '</td></tr>');
      UI.fill('ledgerFoot', '');
      return;
    }

    UI.fill('ledgerRows', UI.tbody(page.map(function (p) {
      var m = METHOD_META[p.method] || { icon: 'card' };
      return {
        attrs: 'class="linked" data-payment="' + p.id + '"',
        cells: [
          '<span class="muted nowrap">' + UI.esc(p.id) + '</span>',
          UI.personCell(p.initials, p.tenantName, 'Unit ' + p.unitNo),
          '<span class="nowrap">' + UI.fmtDate(p.date) + '</span>',
          '<span class="u-row" style="gap:7px">' + icon(m.icon) + UI.esc(p.method) + '</span>',
          '<span class="muted">' + UI.esc(p.covers) + '</span>',
          '<span class="strong">' + UI.peso(p.amount) + '</span>',
          UI.statusBadge(p.status)
        ]
      };
    }), ['', '', '', '', '', 'num', '']));

    UI.fill('ledgerFoot', all.length > state.limit
      ? '<button class="btn btn-ghost btn-sm" data-act="more">Show more (' +
        (all.length - state.limit) + ' remaining)</button>'
      : '<span class="u-sm u-muted">Showing all ' + all.length + ' payments</span>');
  }

  function renderOutstanding() {
    var owed = DB.stats.overdueTenants;

    if (!owed.length) {
      UI.fill('outstandingRows', '<tr><td colspan="6">' +
        UI.emptyState('check', 'Everyone is paid up', 'No outstanding balances this month.') + '</td></tr>');
      return;
    }

    UI.fill('outstandingRows', UI.tbody(owed.map(function (t) {
      var tone = t.overdueDays > 10 ? 'red' : (t.overdueDays > 5 ? 'amber' : 'slate');
      return {
        attrs: 'class="linked" data-tenant="' + t.id + '"',
        cells: [
          UI.personCell(t.initials, t.name, t.phone),
          '<span class="strong">' + UI.esc(t.unitNo) + '</span>',
          UI.peso(t.rent),
          '<span class="strong u-red">' + UI.peso(t.balance) + '</span>',
          UI.badge(t.overdueDays + ' days late', tone),
          '<div class="row-actions">' +
            '<button class="btn btn-ghost btn-sm" data-remind="' + t.id + '">' + icon('mail') + 'Remind</button>' +
            '<button class="btn btn-primary btn-sm" data-collect="' + t.id + '">Record</button></div>'
        ]
      };
    }), ['', '', 'num', 'num', '', 'num']));
  }

  function renderMethods() {
    var byMethod = {};
    DB.methods.forEach(function (m) { byMethod[m] = { count: 0, amount: 0 }; });
    DB.payments.forEach(function (p) {
      if (!byMethod[p.method]) byMethod[p.method] = { count: 0, amount: 0 };
      byMethod[p.method].count++;
      byMethod[p.method].amount += p.amount;
    });

    var parts = DB.methods.map(function (m) {
      return { label: m, value: byMethod[m].amount, color: METHOD_META[m].color };
    });
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0) || 1;

    UI.fill('methodBar', Charts.stackedBar(parts));
    UI.fill('methodLegend', parts.map(function (p) {
      return '<div class="legend-item"><i class="dot-mark" style="background:' + p.color + '"></i>' +
        '<span class="lg-name">' + p.label + '</span>' +
        '<span class="lg-val">' + UI.peso(p.value) + '</span>' +
        '<span class="lg-pct">' + Math.round(p.value / total * 100) + '%</span></div>';
    }).join(''));

    UI.fill('methodCounts', Charts.rankList(DB.methods.map(function (m) {
      return { label: m, value: byMethod[m].count, display: byMethod[m].count + ' payments' };
    })));
  }

  /* ---------- lifecycle ---------- */
  function refresh() {
    var s = DB.stats;
    var rate = Math.round(s.incomeThisMonth / s.expectedThisMonth * 100);
    var owed = s.overdueTenants;
    var total = owed.reduce(function (a, t) { return a + t.balance; }, 0);

    UI.bind({
      monthYear:        UI.fmtMonthYear(DB.today),
      paymentCount:     DB.payments.length + ' payments on record',

      collected:        UI.peso(s.incomeThisMonth),
      collectedBar:     rate,
      collectedNote:    UI.peso(s.expectedThisMonth) + ' expected',
      outstanding:      UI.peso(s.outstanding),
      outstandingBar:   100 - rate,
      outstandingNote:  owed.length + ' tenants owe rent',
      rate:             rate + '%',
      rateBar:          rate,
      deposits:         UI.peso(DB.tenants.reduce(function (a, t) { return a + t.deposit; }, 0)),
      depositsNote:     'Across ' + DB.tenants.length + ' active leases',

      countLedger:      DB.payments.length,
      countOutstanding: owed.length,
      countMethods:     DB.methods.length,
      outstandingSub:   owed.length + ' tenants owe a combined ' + UI.peso(total)
    });

    UI.resolveIcons(document);
    renderLedger();
    renderOutstanding();
    renderMethods();
    UI.animateMeters(document);
  }

  function showPane(name) {
    document.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
  }

  function init() {
    document.getElementById('pm').innerHTML = '<option value="all">All methods</option>' +
      DB.methods.map(function (m) { return '<option>' + UI.esc(m) + '</option>'; }).join('');

    refresh();

    UI.wireTabs(document, function (tab) { state.limit = 12; renderLedger(); showPane(tab); });

    document.getElementById('pq').addEventListener('input', function (e) {
      state.q = e.target.value; state.limit = 12; renderLedger();
    });
    document.getElementById('pm').addEventListener('change', function (e) {
      state.method = e.target.value; renderLedger();
    });
    document.getElementById('ps').addEventListener('change', function (e) {
      state.status = e.target.value; renderLedger();
    });

    document.querySelector('.content').addEventListener('click', function (e) {
      var el;

      if ((el = e.target.closest('[data-remind]'))) {
        UI.toast('Reminder sent to ' + DB.tenant(el.dataset.remind).name); return;
      }
      if ((el = e.target.closest('[data-collect]'))) {
        Shell.openRecordPayment(el.dataset.collect); return;
      }
      if ((el = e.target.closest('[data-payment]'))) {
        Shell.openPayment(el.dataset.payment); return;
      }
      if ((el = e.target.closest('[data-tenant]')) && !e.target.closest('button')) {
        location.href = 'renters.html?tenant=' + el.dataset.tenant; return;
      }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'more')       { state.limit += 12; renderLedger(); }
      if (a.dataset.act === 'export')     UI.toast('Exported ' + ledger().length + ' payment records');
      if (a.dataset.act === 'statement')  UI.toast('Building the ' + UI.fmtMonthYear(DB.today) + ' statement…', 'info');
      if (a.dataset.act === 'remind-all') UI.toast('SMS reminders queued for ' + DB.stats.overdueTenants.length + ' tenants');
    });

    /* ?receipt=PMT-1001 — the client-side equivalent of $_GET['receipt'] */
    var deep = UI.query('receipt');
    if (deep) setTimeout(function () { Shell.openPayment(deep); }, 80);
  }

  global.Page = { init: init, refresh: refresh };

})(window);
