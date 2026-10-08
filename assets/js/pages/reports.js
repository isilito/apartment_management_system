/* ============================================================
   pages/reports.js — data for reports.html
   Reports are built by api/report.php from the live records:
   CSV downloads open in Excel, "Printable" opens a page you can
   print or save as PDF.
   ============================================================ */
(function (global) {

  var REPORTS = [
    { id: 'rent-roll',   title: 'Rent roll',          desc: 'Every unit, tenant, rent, and balance as of today.',     icon: 'layers',   tone: 'teal' },
    { id: 'collections', title: 'Collection summary', desc: 'Billed vs. collected for each tenant in the period.',    icon: 'peso',     tone: 'green' },
    { id: 'aging',       title: 'Balance aging',      desc: 'Who owes what, bucketed by how late they are.',          icon: 'clock',    tone: 'amber' },
    { id: 'income',      title: 'Income statement',   desc: 'Money collected less operating and repair costs.',       icon: 'chart',    tone: 'teal' },
    { id: 'deposits',    title: 'Deposit register',   desc: 'Security deposits and advance rent held per lease.',     icon: 'shield',   tone: 'teal' },
    { id: 'maintenance', title: 'Maintenance spend',  desc: 'Every request in the period with its cost and crew.',    icon: 'wrench',   tone: 'red' },
    { id: 'occupancy',   title: 'Occupancy report',   desc: 'Unit status, vacancy dates, and lease expirations.',     icon: 'doorOpen', tone: 'teal' },
    { id: 'tenant',      title: 'Tenant statement',   desc: 'A single renter’s full ledger, ready to print.',         icon: 'receipt',  tone: 'green' }
  ];

  var range = '6';

  function periodOptions() {
    var out = [];
    for (var i = 0; i < 12; i++) {
      var d = new Date(DB.today.getFullYear(), DB.today.getMonth() - i, 1);
      out.push({ v: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: UI.fmtMonthYear(d) });
    }
    out.splice(1, 0, { v: 'ytd', l: 'Year to date' }, { v: 'last6', l: 'Last 6 months' });
    return out;
  }

  function renderLibrary() {
    UI.fill('reportGrid', REPORTS.map(function (r) {
      return '<article class="card report-card" data-report="' + r.id + '" tabindex="0">' +
        '<span class="r-ico stat-icon i-' + r.tone + '">' + icon(r.icon) + '</span>' +
        '<b>' + UI.esc(r.title) + '</b><p>' + UI.esc(r.desc) + '</p>' +
        '<span class="r-link">Generate' + icon('arrowRight') + '</span></article>';
    }).join(''));
  }

  function reportUrl(type, period, building, format) {
    var p = { type: type, period: period, format: format };
    if (building && building !== 'all') p.building = building;
    return API.url('report.php', null, p);
  }

  function renderRecent() {
    if (!DB.reports.length) {
      UI.fill('recentReportRows', '<tr><td colspan="6">' +
        UI.emptyState('file', 'No reports yet', 'Generate one from the library above.') + '</td></tr>');
      return;
    }
    UI.fill('recentReportRows', UI.tbody(DB.reports.map(function (r) {
      var fmt = r.format === 'CSV' ? 'csv' : 'html';
      var url = r.type === 'tenant' ? null : reportUrl(r.type, r.period, r.buildingId, fmt);
      return {
        cells: [
          '<span class="u-row" style="gap:10px">' +
            '<span class="stat-icon i-teal" style="width:30px;height:30px;border-radius:8px">' + icon('file') + '</span>' +
            '<span class="strong">' + UI.esc(r.name) + '</span></span>',
          '<span class="muted">' + UI.esc(r.by) + '</span>',
          '<span class="nowrap muted">' + UI.esc(DB.ago(r.at)) + '</span>',
          '<span class="muted">' + r.rows + ' rows</span>',
          UI.badge(r.format === 'HTML' ? 'Printable' : r.format, 'outline'),
          url ? '<div class="row-actions">' +
            '<a class="icon-btn sm bare" title="Open printable" target="_blank" rel="noopener" href="' +
              reportUrl(r.type, r.period, r.buildingId, 'html') + '">' + icon('eye') + '</a>' +
            '<a class="icon-btn sm bare" title="Download CSV" href="' + reportUrl(r.type, r.period, r.buildingId, 'csv') + '">' +
              icon('download') + '</a></div>' : ''
        ]
      };
    }), ['', '', '', '', '', 'num']));
  }

  function preview(id) {
    var r = REPORTS.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var tenantPick = id === 'tenant';

    UI.modal({
      title: r.title,
      sub: r.desc,
      wide: true,
      body:
        '<div class="form-grid">' +
          (tenantPick
            ? '<div class="form-row full"><label>Tenant</label><select class="select" id="rTenant">' +
                DB.tenants.map(function (t) {
                  return '<option value="' + t.id + '">' + UI.esc(t.name) + ' — Unit ' + UI.esc(t.unitNo) + '</option>';
                }).join('') + '</select></div>'
            : '<div class="form-row"><label>Period</label><select class="select" id="rPeriod">' +
                periodOptions().map(function (o) { return '<option value="' + o.v + '">' + UI.esc(o.l) + '</option>'; }).join('') +
              '</select></div>' +
              '<div class="form-row"><label>Building</label>' +
                '<select class="select" id="rBuilding"><option value="all">All buildings</option>' +
                  DB.buildings.map(function (b) { return '<option value="' + b.id + '">' + UI.esc(b.name) + '</option>'; }).join('') +
                '</select></div>' +
              '<div class="form-row full"><label>Format</label>' +
                '<select class="select" id="rFormat"><option value="html">Printable page (print or save as PDF)</option>' +
                '<option value="csv">CSV spreadsheet (opens in Excel)</option></select></div>') +
        '</div>',
      confirmText: 'Generate report',
      onConfirm: function (box) {
        var url;
        if (tenantPick) {
          url = API.url('document.php', null, { doc: 'statement', tenant: box.querySelector('#rTenant').value });
          window.open(url, '_blank');
          return;
        }
        var fmt = box.querySelector('#rFormat').value;
        url = reportUrl(id, box.querySelector('#rPeriod').value, box.querySelector('#rBuilding').value, fmt);
        if (fmt === 'csv') location.href = url; else window.open(url, '_blank');
        UI.toast(r.title + ' generated');
        /* the server logs it; refresh the history list shortly after */
        setTimeout(function () { Shell.afterMutation(); }, 1200);
      }
    });
  }

  function charts() {
    var months = range === '12' ? DB.monthly12 : DB.monthly;
    UI.fill('incomeChart', Charts.groupedBars(months, { width: Charts.widthOf('incomeChart') }));
    UI.fill('costChart', Charts.areaLine(
      (range === '12' ? DB.expenseTrend12 : DB.expenseTrend).map(function (e) { return { label: e.month, value: e.amount }; }),
      { color: Charts.colors.amber, height: 236, fmt: UI.pesoK, width: Charts.widthOf('costChart') }));
  }

  function refresh() {
    var income = DB.monthly.reduce(function (a, m) { return a + m.collected; }, 0);
    var expense = DB.expenseTrend.reduce(function (a, m) { return a + m.amount; }, 0);
    var net = income - expense;

    UI.bind({
      monthYear:     UI.fmtMonthYear(DB.today),
      ytdIncome:     UI.peso(income),
      ytdIncomeNote: 'Across ' + DB.stats.occupied + ' occupied units',
      ytdExpense:    UI.peso(expense),
      net:           UI.peso(net),
      netNote:       (income ? Math.round(net / income * 100) : 0) + '% margin over 6 months',
      avgRent:       UI.peso(DB.tenants.length ? Math.round(
                       DB.tenants.reduce(function (a, t) { return a + t.rent; }, 0) / DB.tenants.length) : 0)
    });

    charts();
    renderLibrary();
    renderRecent();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();
    UI.wireSegment(document, function (v) { range = v; charts(); });
    UI.onResize(charts);

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var r = e.target.closest('[data-report]');
      if (r) return preview(r.dataset.report);

      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'build') preview('rent-roll');
      if (a.dataset.act === 'expense') openExpense();
      if (a.dataset.act === 'clear-history') {
        if (!a.dataset.armed) { a.dataset.armed = '1'; a.textContent = 'Click again to clear'; return; }
        Shell.save('clear_report_log', {}, 'Report history cleared', 'info');
      }
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var r = e.target.closest('[data-report]');
      if (r) preview(r.dataset.report);
    });
  }

  function openExpense() {
    UI.modal({
      title: 'Log an expense',
      sub: 'Operating costs show up in the income statement and cost trend',
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Category</label><input class="input" id="xCat" list="xCats" placeholder="Utilities"/>' +
            '<datalist id="xCats"><option value="Utilities"><option value="Salaries"><option value="Supplies">' +
            '<option value="Services"><option value="Repairs"><option value="Insurance"><option value="Taxes"></datalist></div>' +
          '<div class="form-row"><label>Amount</label><input class="input" id="xAmt" type="number" min="0" step="0.01"/></div>' +
          '<div class="form-row"><label>Date</label><input class="input" id="xDate" type="date" value="' + Shell.isoDate() + '"/></div>' +
          '<div class="form-row"><label>Description</label><input class="input" id="xDesc" placeholder="e.g. Common-area electricity"/></div>' +
        '</div>',
      confirmText: 'Save expense',
      onConfirm: function (box) {
        var amt = Number(box.querySelector('#xAmt').value) || 0;
        if (!box.querySelector('#xCat').value.trim()) { UI.toast('Choose a category', 'warn'); return false; }
        if (amt <= 0) { UI.toast('Enter an amount', 'warn'); return false; }
        return Shell.save('add_expense', {
          category: box.querySelector('#xCat').value.trim(), amount: amt,
          date: box.querySelector('#xDate').value, description: box.querySelector('#xDesc').value.trim()
        }, UI.peso(amt) + ' expense saved');
      }
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
