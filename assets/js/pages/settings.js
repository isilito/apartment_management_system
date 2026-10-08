/* ============================================================
   pages/settings.js — data for settings.html
   Every [data-setting="key"] field is filled from DB.settings and
   saved back with admin.php?action=save_settings. Each card with
   data-form saves only its own fields.
   ============================================================ */
(function (global) {

  var ROLES = ['Administrator', 'Caretaker', 'Maintenance', 'Contractor'];

  function roleTone(role) {
    if (role === 'Owner') return 'teal';
    if (role === 'Administrator') return 'green';
    return 'slate';
  }

  /* ---------- settings fields ---------- */
  function fillSettings(scope) {
    (scope || document).querySelectorAll('[data-setting]').forEach(function (el) {
      var v = DB.settings[el.dataset.setting];
      if (el.type === 'checkbox') el.checked = v === '1';
      else el.value = v == null ? '' : v;
    });
  }

  function collect(card) {
    var out = {};
    card.querySelectorAll('[data-setting]').forEach(function (el) {
      out[el.dataset.setting] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value.trim();
    });
    return out;
  }

  function saveCard(card, btn) {
    btn.disabled = true;
    Shell.save('save_settings', { values: collect(card) }, 'Settings saved').then(function () {
      btn.disabled = false;
    }, function (e) { btn.disabled = false; UI.toast(e.message, 'warn'); });
  }

  /* ---------- buildings ---------- */
  function renderBuildings() {
    UI.fill('buildingRows', DB.buildings.length ? DB.buildings.map(function (b) {
      var n = DB.units.filter(function (u) { return u.buildingId === b.id; }).length;
      return '<div class="row">' +
        '<span class="stat-icon i-teal" style="width:34px;height:34px;border-radius:9px">' + icon('building') + '</span>' +
        '<div class="row-main"><b>' + UI.esc(b.name) + '</b>' +
          '<span>' + UI.esc(b.address || 'No address') + ' &middot; ' + n + ' units &middot; ' + b.floors + ' floors</span></div>' +
        '<div class="row-end"><button class="icon-btn sm bare" data-building="' + b.id + '" title="Edit">' + icon('edit') + '</button></div></div>';
    }).join('') : '<p class="u-sm u-muted">No buildings yet.</p>');
  }

  function openBuilding(id) {
    var b = id ? DB.building(id) : { name: '', floors: 1, address: DB.settings.address || '' };
    UI.modal({
      title: id ? 'Edit ' + b.name : 'Add a building',
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Name</label><input class="input" id="bName" value="' + UI.esc(b.name) + '" placeholder="e.g. Malinta Building"/></div>' +
          '<div class="form-row"><label>Floors</label><input class="input" id="bFloors" type="number" min="1" value="' + b.floors + '"/></div>' +
          '<div class="form-row full"><label>Address</label><input class="input" id="bAddr" value="' + UI.esc(b.address) + '"/></div>' +
        '</div>',
      confirmText: id ? 'Save building' : 'Add building',
      onConfirm: function (box) {
        var name = box.querySelector('#bName').value.trim();
        if (!name) { UI.toast('Name the building', 'warn'); return false; }
        return Shell.save(id ? 'update_building' : 'add_building', {
          id: id, name: name, floors: Number(box.querySelector('#bFloors').value) || 1,
          address: box.querySelector('#bAddr').value.trim()
        }, name + (id ? ' updated' : ' added'));
      }
    });
  }

  /* ---------- staff ---------- */
  function renderUsers() {
    UI.fill('userRows', UI.tbody(DB.staff.map(function (u) {
      return {
        cells: [
          UI.personCell(u.name.replace(/^Engr\.\s*/, '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(),
                        u.name + (u.isMe ? ' (you)' : ''), u.isCrew ? 'Can be assigned repairs' : ''),
          UI.badge(u.role, roleTone(u.role)),
          '<span class="muted">' + UI.esc([u.email, u.phone].filter(Boolean).join(' · ') || '—') + '</span>',
          '<span class="muted nowrap">' + (u.lastActive ? UI.esc(DB.ago(u.lastActive)) : '—') + '</span>',
          '<div class="row-actions">' +
            '<button class="icon-btn sm bare" data-staff="' + u.id + '" title="Edit">' + icon('edit') + '</button>' +
            (u.role !== 'Owner' && !u.isMe
              ? '<button class="icon-btn sm bare" data-remove="' + u.id + '" title="Remove">' + icon('trash') + '</button>' : '') +
          '</div>'
        ]
      };
    }), ['', '', '', '', 'num']));
  }

  function openStaff(id) {
    var s = id ? DB.staff.filter(function (x) { return x.id === id; })[0] : { name: '', role: 'Maintenance', email: '', phone: '' };
    var owner = s.role === 'Owner';
    UI.modal({
      title: id ? 'Edit ' + s.name : 'Add a person',
      sub: id ? '' : 'Administrators get a sign-in to this console; everyone else is a contact you can assign repairs to',
      body:
        '<div class="form-grid">' +
          '<div class="form-row"><label>Name</label><input class="input" id="sName" value="' + UI.esc(s.name) + '"/></div>' +
          '<div class="form-row"><label>Role</label><select class="select" id="sRole"' + (owner || id && s.role === 'Administrator' ? ' disabled' : '') + '>' +
            (owner ? '<option>Owner</option>' : ROLES.map(function (r) {
              return '<option' + (s.role === r ? ' selected' : '') + '>' + r + '</option>';
            }).join('')) + '</select></div>' +
          '<div class="form-row"><label>Email</label><input class="input" id="sEmail" type="email" value="' + UI.esc(s.email) + '"' + (owner ? ' disabled' : '') + '/></div>' +
          '<div class="form-row"><label>Phone</label><input class="input" id="sPhone" value="' + UI.esc(s.phone) + '"/></div>' +
        '</div>',
      confirmText: id ? 'Save' : 'Add person',
      onConfirm: function (box) {
        var name = box.querySelector('#sName').value.trim();
        if (!name) { UI.toast('Enter a name', 'warn'); return false; }
        var data = { id: id, name: name, role: box.querySelector('#sRole').value, phone: box.querySelector('#sPhone').value.trim() };
        if (!owner) data.email = box.querySelector('#sEmail').value.trim();
        return API.post('admin.php', id ? 'update_staff' : 'add_staff', data).then(function (r) {
          return Shell.afterMutation(name + (id ? ' updated' : ' added')).then(function () {
            if (r.tempPassword) setTimeout(function () {
              Shell.showCredentials('Console login for ' + name, r.email, r.tempPassword,
                'They sign in on the login page with the Admin option. This password is shown only once.');
            }, 50);
          });
        });
      }
    });
  }

  /* ---------- payment methods ---------- */
  function renderMethods() {
    UI.fill('methodRows', DB.methodList.map(function (m) {
      return '<div class="set-row" data-method="' + m.key + '">' +
        '<div class="sr-label"><b>' + UI.esc(m.label) + '</b>' +
          '<input class="input u-mt" data-detail style="width:100%;max-width:420px" value="' + UI.esc(m.detail) + '" placeholder="Account name and number"/></div>' +
        '<div class="sr-control"><label class="switch"><input type="checkbox" data-active' + (m.active ? ' checked' : '') + '/>' +
          '<span class="track"></span></label></div></div>';
    }).join(''));
  }

  function saveMethods(btn) {
    var list = [];
    document.querySelectorAll('[data-method]').forEach(function (row) {
      list.push({ key: row.dataset.method, detail: row.querySelector('[data-detail]').value,
                  active: row.querySelector('[data-active]').checked });
    });
    btn.disabled = true;
    Shell.save('save_methods', { methods: list }, 'Payment methods saved')
      .catch(function (e) { UI.toast(e.message, 'warn'); })
      .then(function () { btn.disabled = false; });
  }

  /* ---------- security / data ---------- */
  function changePassword(btn) {
    var cur = document.getElementById('pwCur').value;
    var nw = document.getElementById('pwNew').value;
    if (nw.length < 8) { UI.toast('Use at least 8 characters for the new password', 'warn'); return; }
    if (nw !== document.getElementById('pwNew2').value) { UI.toast('The new passwords do not match', 'warn'); return; }
    btn.disabled = true;
    API.post('auth.php', 'change_password', { current: cur, next: nw }).then(function () {
      ['pwCur', 'pwNew', 'pwNew2'].forEach(function (id) { document.getElementById(id).value = ''; });
      UI.toast('Password updated');
    }, function (e) { UI.toast(e.message, 'warn'); }).then(function () { btn.disabled = false; });
  }

  function importCsv(file) {
    var fd = new FormData();
    fd.append('file', file);
    UI.toast('Importing ' + file.name + '…', 'info');
    API.upload('admin.php', 'import_tenants', fd).then(function (r) {
      return Shell.afterMutation().then(function () {
        UI.modal({
          title: 'Import finished',
          sub: r.added.length + ' added · ' + r.skipped.length + ' skipped',
          wide: true,
          body:
            (r.added.length ? '<h4 class="u-b u-mb">Added</h4><div class="rows">' + r.added.map(function (a) {
              return '<div class="row"><div class="row-main"><b>' + UI.esc(a.name) + ' — Unit ' + UI.esc(a.unit) + '</b>' +
                '<span>' + (a.tempPassword ? 'Portal login: ' + UI.esc(a.email) + ' / ' + UI.esc(a.tempPassword) : 'No email, so no portal login') +
                '</span></div></div>';
            }).join('') + '</div>' : '') +
            (r.skipped.length ? '<h4 class="u-b u-mt-lg u-mb">Skipped</h4><ul class="u-sm" style="line-height:1.7;padding-left:18px">' +
              r.skipped.map(function (s) { return '<li>' + UI.esc(s) + '</li>'; }).join('') + '</ul>' : ''),
          foot: '<button class="btn btn-primary" data-close>Done</button>'
        });
      });
    }, function (e) { UI.toast(e.message, 'warn'); });
  }

  function confirmDelete() {
    UI.modal({
      title: 'Delete all property data?',
      sub: 'All ' + DB.stats.totalUnits + ' units, ' + DB.tenants.length + ' tenant records, and every payment will be permanently removed.',
      body: '<p class="u-sm" style="line-height:1.65;color:var(--ink-2)">This cannot be undone. ' +
            'Type <b>DELETE</b> and enter your password to confirm.</p>' +
            '<input class="input u-mt" id="delWord" style="width:100%" placeholder="Type DELETE" />' +
            '<input class="input u-mt" id="delPw" type="password" style="width:100%" placeholder="Your password" />',
      foot: '<button class="btn btn-ghost" data-close>Cancel</button>' +
            '<button class="btn btn-danger" data-confirm>Delete permanently</button>',
      onConfirm: function (box) {
        if (box.querySelector('#delWord').value !== 'DELETE') { UI.toast('Type DELETE to confirm', 'warn'); return false; }
        return Shell.save('delete_property', { confirm: 'DELETE', password: box.querySelector('#delPw').value },
          'All property data deleted', 'info');
      }
    });
  }

  function showSection(name) {
    document.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
    document.querySelectorAll('[data-sec]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.sec === name);
    });
  }

  function refresh() {
    UI.bind({
      propName: UI.esc(DB.settings.property_name || ''),
      signedInAs: 'Signed in as ' + UI.esc(DB.me.name) + ' (' + UI.esc(DB.me.username || DB.me.email) + ')',
      lastBackup: DB.settings.last_export ? 'Exported ' + UI.esc(DB.ago(DB.parse(DB.settings.last_export))) : 'Never exported from here'
    });
    fillSettings();
    renderBuildings();
    renderUsers();
    renderMethods();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();
    document.getElementById('exportLink').href = API.url('admin.php', 'export');

    document.querySelector('.settings-nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sec]');
      if (b) showSection(b.dataset.sec);
    });

    document.getElementById('importFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importCsv(e.target.files[0]);
      e.target.value = '';
    });

    document.querySelector('.content').addEventListener('click', function (e) {
      var el;
      if ((el = e.target.closest('[data-building]'))) return openBuilding(el.dataset.building);
      if ((el = e.target.closest('[data-staff]'))) return openStaff(Number(el.dataset.staff));
      if ((el = e.target.closest('[data-remove]'))) {
        if (!el.dataset.armed) { el.dataset.armed = '1'; el.classList.add('u-red'); UI.toast('Click the bin again to remove', 'info'); return; }
        return Shell.save('delete_staff', { id: Number(el.dataset.remove) }, 'Removed').catch(function (er) { UI.toast(er.message, 'warn'); });
      }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      var act = a.dataset.act;
      var card = a.closest('[data-form]');
      if (act === 'save' && card)   saveCard(card, a);
      if (act === 'discard' && card) { fillSettings(card); UI.toast('Changes discarded', 'info'); }
      if (act === 'save-methods')   saveMethods(a);
      if (act === 'invite')         openStaff(null);
      if (act === 'add-building')   openBuilding(null);
      if (act === 'password')       changePassword(a);
      if (act === 'log')            Shell.openActivity();
      if (act === 'import')         document.getElementById('importFile').click();
      if (act === 'delete')         confirmDelete();
    });

    /* ?section=billing deep link */
    var deep = UI.query('section');
    if (deep && document.querySelector('[data-pane="' + deep + '"]')) showSection(deep);
  }

  global.Page = { init: init, refresh: refresh };

})(window);
