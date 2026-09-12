/* ============================================================
   pages/settings.js — data for settings.html
   All six sections are real markup in the page; this file fills
   the data-driven lists and handles section switching.
   ============================================================ */
(function (global) {

  var STAFF = [
    { name: 'Aling Nena',  role: 'Administrator', email: 'nena@sarazaapartment.ph',   last: 'Online now',  init: 'AN' },
    { name: 'Mang Tonyo',  role: 'Caretaker',     email: 'tonyo@sarazaapartment.ph',  last: '2 hours ago', init: 'MT' },
    { name: 'Liza Saraza', role: 'Owner',         email: 'liza@sarazaapartment.ph',   last: 'Yesterday',   init: 'LS' },
    { name: 'Kuya Benjie', role: 'Maintenance',   email: 'benjie@sarazaapartment.ph', last: '3 days ago',  init: 'KB' }
  ];

  function roleTone(role) {
    if (role === 'Owner') return 'teal';
    if (role === 'Administrator') return 'green';
    return 'slate';
  }

  function renderBuildings() {
    UI.fill('buildingRows', DB.buildings.map(function (b) {
      var n = DB.units.filter(function (u) { return u.buildingId === b.id; }).length;
      return '<div class="row">' +
        '<span class="stat-icon i-teal" style="width:34px;height:34px;border-radius:9px">' + icon('building') + '</span>' +
        '<div class="row-main"><b>' + UI.esc(b.name) + '</b>' +
          '<span>' + UI.esc(b.address) + ' &middot; ' + n + ' units &middot; ' + b.floors + ' floors</span></div>' +
        '<div class="row-end"><button class="icon-btn sm bare">' + icon('edit') + '</button></div></div>';
    }).join(''));
  }

  function renderUsers() {
    UI.fill('userRows', UI.tbody(STAFF.map(function (u) {
      return {
        cells: [
          UI.personCell(u.init, u.name),
          UI.badge(u.role, roleTone(u.role)),
          '<span class="muted">' + UI.esc(u.email) + '</span>',
          '<span class="muted nowrap">' + UI.esc(u.last) + '</span>',
          '<div class="row-actions">' +
            '<button class="icon-btn sm bare">' + icon('edit') + '</button>' +
            '<button class="icon-btn sm bare">' + icon('more') + '</button></div>'
        ]
      };
    }), ['', '', '', '', 'num']));
  }

  function renderMethods() {
    UI.fill('methodBadges', DB.methods.map(function (m) {
      return UI.badge(m, 'teal');
    }).join(''));
  }

  function showSection(name) {
    document.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
    document.querySelectorAll('[data-sec]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.sec === name);
    });
  }

  function confirmDelete() {
    UI.modal({
      title: 'Delete this property?',
      sub: 'All ' + DB.stats.totalUnits + ' units, ' + DB.tenants.length +
           ' tenant records, and every payment will be permanently removed.',
      body: '<p class="u-sm" style="line-height:1.65;color:var(--ink-2)">This cannot be undone. ' +
            'Type <b>DELETE</b> below to confirm you understand.</p>' +
            '<input class="input u-mt" style="width:100%" placeholder="Type DELETE" />',
      foot: '<button class="btn btn-ghost" data-close>Cancel</button>' +
            '<button class="btn btn-danger" data-confirm>Delete permanently</button>',
      onConfirm: function () { UI.toast('Deletion cancelled — this is a demo', 'warn'); }
    });
  }

  function refresh() {
    renderBuildings();
    renderUsers();
    renderMethods();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();

    document.querySelector('.settings-nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sec]');
      if (b) showSection(b.dataset.sec);
    });

    document.querySelector('.content').addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]');
      if (!a) return;
      var act = a.dataset.act;
      if (act === 'save')         UI.toast('Settings saved');
      if (act === 'invite')       UI.toast('Invitation form opens here', 'info');
      if (act === 'add-building') UI.toast('Add-building form opens here', 'info');
      if (act === 'export-all')   UI.toast('Preparing a full export archive…', 'info');
      if (act === 'import')       UI.toast('Choose a CSV file to import', 'info');
      if (act === 'delete')       confirmDelete();
    });

    /* ?section=billing deep link */
    var deep = UI.query('section');
    if (deep && document.querySelector('[data-pane="' + deep + '"]')) showSection(deep);
  }

  global.Page = { init: init, refresh: refresh };

})(window);
