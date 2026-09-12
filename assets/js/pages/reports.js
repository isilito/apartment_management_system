/* ============================================================
   pages/reports.js — data for reports.html
   ============================================================ */
(function (global) {

  var REPORTS = [
    { id: 'rent-roll',   title: 'Rent roll',          desc: 'Every unit, tenant, rent, and balance as of today.',     icon: 'layers',   tone: 'teal' },
    { id: 'collections', title: 'Collection summary', desc: 'Collected vs. expected rent with a per-unit breakdown.', icon: 'peso',     tone: 'green' },
    { id: 'aging',       title: 'Balance aging',      desc: 'Who owes what, bucketed by how late they are.',          icon: 'clock',    tone: 'amber' },
    { id: 'income',      title: 'Income statement',   desc: 'Rent income less maintenance and operating costs.',      icon: 'chart',    tone: 'teal' },
    { id: 'deposits',    title: 'Deposit register',   desc: 'Security deposits held, applied, and refunded.',         icon: 'shield',   tone: 'teal' },
    { id: 'maintenance', title: 'Maintenance spend',  desc: 'Repair cost per unit, category, and crew member.',       icon: 'wrench',   tone: 'red' },
    { id: 'occupancy',   title: 'Occupancy report',   desc: 'Vacancy days, turnover, and lease expirations.',         icon: 'doorOpen', tone: 'teal' },
    { id: 'tenant',      title: 'Tenant statement',   desc: 'A single renter’s full ledger, ready to print.',    icon: 'receipt',  tone: 'green' }
  ];

  var RECENT = [
    { name: 'Rent roll — September 2026',       by: 'Aling Nena', when: 'Today, 8:42 AM', size: '48 rows',  fmt: 'PDF' },
    { name: 'Collection summary — August 2026', by: 'Aling Nena', when: '2 Sep 2026',     size: '12 pages', fmt: 'PDF' },
    { name: 'Balance aging — August 2026',      by: 'Aling Nena', when: '2 Sep 2026',     size: '9 rows',   fmt: 'XLSX' },
    { name: 'Maintenance spend — Q2 2026',      by: 'Aling Nena', when: '14 Jul 2026',    size: '31 rows',  fmt: 'XLSX' }
  ];

  var STEPS = {
    'rent-roll': 'rent roll', 'collections': 'collection summary', 'aging': 'aging report',
    'income': 'income statement', 'deposits': 'deposit register', 'maintenance': 'maintenance spend report',
    'occupancy': 'occupancy report', 'tenant': 'tenant statement'
  };

  function renderLibrary() {
    UI.fill('reportGrid', REPORTS.map(function (r) {
      return '<article class="card report-card" data-report="' + r.id + '" tabindex="0">' +
        '<span class="r-ico stat-icon i-' + r.tone + '">' + icon(r.icon) + '</span>' +
        '<b>' + UI.esc(r.title) + '</b><p>' + UI.esc(r.desc) + '</p>' +
        '<span class="r-link">Generate' + icon('arrowRight') + '</span></article>';
    }).join(''));
  }

  function renderRecent() {
    UI.fill('recentReportRows', UI.tbody(RECENT.map(function (r) {
      return {
        cells: [
          '<span class="u-row" style="gap:10px">' +
            '<span class="stat-icon i-teal" style="width:30px;height:30px;border-radius:8px">' + icon('file') + '</span>' +
            '<span class="strong">' + UI.esc(r.name) + '</span></span>',
          '<span class="muted">' + UI.esc(r.by) + '</span>',
          '<span class="nowrap muted">' + UI.esc(r.when) + '</span>',
          '<span class="muted">' + UI.esc(r.size) + '</span>',
          UI.badge(r.fmt, 'outline'),
          '<div class="row-actions">' +
            '<button class="icon-btn sm bare" data-act="view" title="Preview">' + icon('eye') + '</button>' +
            '<button class="icon-btn sm bare" data-act="dl" title="Download">' + icon('download') + '</button></div>'
        ]
      };
    }), ['', '', '', '', '', 'num']));
  }

  function preview(id) {
    var r = REPORTS.filter(function (x) { return x.id === id; })[0];
    if (!r) return;

    UI.modal({
      title: r.title,
      sub: r.desc,
      wide: true,
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Period</label>' +
            '<select class="select"><option>September 2026</option><option>August 2026</option>' +
            '<option>Q3 2026</option><option>Year to date</option></select></div>' +
          '<div class="form-row"><label>Building</label>' +
            '<select class="select"><option>All buildings</option>' +
              DB.buildings.map(function (b) { return '<option>' + UI.esc(b.name) + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="form-row"><label>Format</label>' +
            '<select class="select"><option>PDF</option><option>Excel (XLSX)</option><option>CSV</option></select></div>' +
          '<div class="form-row"><label>Delivery</label>' +
            '<select class="select"><option>Download now</option><option>Email to me</option></select></div>' +
          '<div class="form-row full"><label class="switch"><input type="checkbox" checked/><span class="track"></span>' +
            '<span class="sw-text"><b>Include unit-level detail</b>' +
            '<span>Adds a per-unit appendix to the summary pages</span></span></label></div>' +
        '</div>',
      confirmText: 'Generate report',
      onConfirm: function () { UI.toast(r.title + ' generated and downloaded'); }
    });
  }

  function refresh() {
    var ytdIncome = DB.monthly.reduce(function (a, m) { return a + m.collected; }, 0);
    var ytdExpense = DB.expenseTrend.reduce(function (a, m) { return a + m.amount; }, 0);
    var net = ytdIncome - ytdExpense;

    UI.bind({
      monthYear:     UI.fmtMonthYear(DB.today),
      ytdIncome:     UI.peso(ytdIncome),
      ytdIncomeNote: 'Across ' + DB.stats.occupied + ' occupied units',
      ytdExpense:    UI.peso(ytdExpense),
      net:           UI.peso(net),
      netNote:       Math.round(net / ytdIncome * 100) + '% margin over 6 months',
      avgRent:       UI.peso(Math.round(
                       DB.tenants.reduce(function (a, t) { return a + t.rent; }, 0) / DB.tenants.length))
    });

    UI.fill('incomeChart', Charts.groupedBars(DB.monthly,
      { width: Charts.widthOf('incomeChart') }));
    UI.fill('costChart', Charts.areaLine(
      DB.expenseTrend.map(function (e) { return { label: e.month, value: e.amount }; }),
      { color: Charts.colors.amber, height: 236, fmt: UI.pesoK,
        width: Charts.widthOf('costChart') }));

    renderLibrary();
    renderRecent();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();
    UI.wireSegment(document);
    UI.onResize(refresh);

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var r = e.target.closest('[data-report]');
      if (r) return preview(r.dataset.report);

      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'build')         preview('rent-roll');
      if (a.dataset.act === 'schedule')      UI.toast('Report scheduling opens here', 'info');
      if (a.dataset.act === 'view')          UI.toast('Opening report preview', 'info');
      if (a.dataset.act === 'dl')            UI.toast('Download started');
      if (a.dataset.act === 'clear-history') UI.toast('Report history cleared', 'warn');
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var r = e.target.closest('[data-report]');
      if (r) preview(r.dataset.report);
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
