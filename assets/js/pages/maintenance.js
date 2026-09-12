/* ============================================================
   pages/maintenance.js — data for maintenance.html
   Deep link: maintenance.html?ticket=MR-2041 opens that request.
   ============================================================ */
(function (global) {

  var state = { mode: 'board', q: '', priority: 'all', category: 'all' };

  var COLUMNS = [
    { key: 'new',         label: 'New',         mount: 'col-new' },
    { key: 'scheduled',   label: 'Scheduled',   mount: 'col-scheduled' },
    { key: 'in-progress', label: 'In progress', mount: 'col-in-progress' },
    { key: 'done',        label: 'Resolved',    mount: 'col-done' }
  ];

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DB.tickets.filter(function (t) {
      if (state.priority !== 'all' && t.priority !== state.priority) return false;
      if (state.category !== 'all' && t.category !== state.category) return false;
      if (!q) return true;
      return (t.title + ' ' + t.unitNo + ' ' + t.tenantName + ' ' + t.id).toLowerCase().indexOf(q) > -1;
    });
  }

  function initialsOf(name) {
    return name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2);
  }

  function ticketCard(t) {
    return '<article class="ticket p-' + t.priority + '" data-ticket="' + t.id + '" tabindex="0">' +
      '<div class="ticket-top"><span class="ticket-id">' + UI.esc(t.id) + '</span>' +
        UI.statusBadge(t.priority) + '</div>' +
      '<b>' + UI.esc(t.title) + '</b>' +
      '<div class="t-meta">' +
        '<span class="u-row" style="gap:5px">' + icon('doorOpen') + 'Unit ' + UI.esc(t.unitNo) + '</span>' +
        '<span>&middot;</span><span>' + UI.relative(t.created) + '</span>' +
        (t.assignee ? '<span class="u-end">' + UI.avatar(initialsOf(t.assignee), 'avatar-sm') + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  function renderBoard() {
    var list = filtered();
    var counts = {};

    COLUMNS.forEach(function (c) {
      var items = list.filter(function (t) { return t.status === c.key; });
      counts[c.key] = items.length;
      UI.fill(c.mount, items.length
        ? items.map(ticketCard).join('')
        : '<p class="u-xs u-muted" style="padding:12px 6px;text-align:center">Nothing here</p>');
    });

    UI.bind({
      colNew:        counts['new'],
      colScheduled:  counts.scheduled,
      colInProgress: counts['in-progress'],
      colDone:       counts.done
    });
  }

  function renderList() {
    var list = filtered();

    if (!list.length) {
      UI.fill('ticketRows', '<tr><td colspan="8">' +
        UI.emptyState('wrench', 'No requests match', 'Try a different priority or category.') + '</td></tr>');
      return;
    }

    UI.fill('ticketRows', UI.tbody(list.map(function (t) {
      return {
        attrs: 'class="linked" data-ticket="' + t.id + '"',
        cells: [
          '<span class="muted nowrap">' + UI.esc(t.id) + '</span>',
          '<span class="strong">' + UI.esc(t.title) + '</span>',
          '<span class="strong">' + UI.esc(t.unitNo) + '</span>',
          '<span class="u-row" style="gap:7px">' + icon(t.categoryIcon) + UI.esc(t.categoryLabel) + '</span>',
          UI.statusBadge(t.priority),
          '<span class="nowrap muted">' + UI.relative(t.created) + '</span>',
          t.assignee ? UI.esc(t.assignee) : '<span class="muted">Unassigned</span>',
          UI.statusBadge(t.status)
        ]
      };
    })));
  }

  function openTicket(id) {
    var t = DB.ticket(id);
    if (!t) return;
    var u = DB.unit(t.unitId);
    var tenant = t.tenantId ? DB.tenant(t.tenantId) : null;

    var head = '<div><div class="u-row" style="gap:12px">' +
      '<span class="stat-icon i-amber" style="width:44px;height:44px">' + icon(t.categoryIcon) + '</span>' +
      '<div><h3 style="font-size:17px;font-weight:700;letter-spacing:-.015em;line-height:1.35">' +
        UI.esc(t.title) + '</h3>' +
      '<p class="u-sm u-muted">' + UI.esc(t.id) + ' &middot; ' + UI.esc(t.categoryLabel) + '</p></div></div></div>';

    var body =
      '<div class="u-row u-wrap u-mb" style="gap:8px">' + UI.statusBadge(t.status) + UI.statusBadge(t.priority) +
        UI.badge('Unit ' + t.unitNo, 'outline') + UI.badge(t.ageDays + ' days old', 'outline') + '</div>' +

      UI.card('<div class="card-pad"><dl class="kv">' +
        '<dt>Reported</dt><dd>' + UI.fmtDate(t.created) + '</dd>' +
        '<dt>Location</dt><dd>' + UI.esc(DB.building(t.buildingId).name) + ' &middot; Unit ' + UI.esc(u.no) + '</dd>' +
        '<dt>Reported by</dt><dd>' + UI.esc(tenant ? tenant.name : 'Caretaker') + '</dd>' +
        '<dt>Assigned to</dt><dd>' + UI.esc(t.assignee || 'Unassigned') + '</dd>' +
        (t.cost ? '<dt>Cost</dt><dd>' + UI.peso(t.cost) + '</dd>' : '') +
      '</dl></div>') +

      '<h4 class="u-b u-mt-lg u-mb">Notes</h4>' +
      UI.card('<div class="card-pad"><p class="u-sm" style="line-height:1.65;color:var(--ink-2)">' +
        UI.esc(t.notes) + '</p></div>') +

      '<h4 class="u-b u-mt-lg u-mb">Update status</h4>' +
      '<div class="u-row u-wrap" style="gap:8px">' + COLUMNS.map(function (c) {
        return '<button class="btn btn-' + (t.status === c.key ? 'primary' : 'outline') + ' btn-sm" ' +
               'data-move="' + c.key + '">' + c.label + '</button>';
      }).join('') + '</div>' +

      '<h4 class="u-b u-mt-lg u-mb">Assign a crew member</h4>' +
      '<select class="select" id="assignee" style="width:100%">' +
        '<option value="">Unassigned</option>' +
        DB.crew.map(function (c) {
          return '<option' + (t.assignee === c ? ' selected' : '') + '>' + c + '</option>';
        }).join('') + '</select>';

    UI.drawer({
      head: head,
      body: body,
      foot: '<button class="btn btn-outline" data-close>Close</button>' +
            '<button class="btn btn-primary" style="flex:1" data-act="save">Save changes</button>',
      onOpen: function (r) {
        r.addEventListener('click', function (e) {
          var mv = e.target.closest('[data-move]');
          if (mv) {
            t.status = mv.dataset.move;
            UI.closeDrawer();
            Shell.afterMutation(t.id + ' moved to ' +
              COLUMNS.filter(function (c) { return c.key === t.status; })[0].label);
            return;
          }
          if (e.target.closest('[data-act="save"]')) {
            t.assignee = r.querySelector('#assignee').value || null;
            UI.closeDrawer();
            Shell.afterMutation('Request updated');
          }
        });
      }
    });
  }

  function refresh() {
    var s = DB.stats;
    var open = DB.tickets.filter(function (t) { return t.status !== 'done'; });
    var avgAge = Math.round(open.reduce(function (a, t) { return a + t.ageDays; }, 0) / Math.max(1, open.length));
    var spend = DB.tickets.reduce(function (a, t) { return a + t.cost; }, 0);

    UI.bind({
      openCount:   s.openRepairs + ' open',
      urgentCount: s.urgentRepairs + ' urgent',
      oldest:      'Oldest ' + s.oldestRepairDays + ' days',

      kpiOpen:     String(s.openRepairs),
      kpiOpenNote: DB.tickets.filter(function (t) { return t.status === 'new'; }).length + ' new · ' +
                   DB.tickets.filter(function (t) { return t.status === 'scheduled'; }).length + ' scheduled',
      kpiUrgent:   String(s.urgentRepairs),
      kpiAge:      avgAge + ' days',
      kpiSpend:    UI.peso(spend)
    });

    UI.resolveIcons(document);
    renderBoard();
    renderList();
  }

  function showPane(name) {
    document.querySelectorAll('[data-pane]').forEach(function (p) {
      p.hidden = p.dataset.pane !== name;
    });
  }

  function init() {
    document.getElementById('mc').innerHTML = '<option value="all">All categories</option>' +
      DB.categories.map(function (c) {
        return '<option value="' + c.key + '">' + UI.esc(c.label) + '</option>';
      }).join('');

    refresh();

    document.getElementById('mq').addEventListener('input', function (e) {
      state.q = e.target.value; renderBoard(); renderList();
    });
    document.getElementById('mp').addEventListener('change', function (e) {
      state.priority = e.target.value; renderBoard(); renderList();
    });
    document.getElementById('mc').addEventListener('change', function (e) {
      state.category = e.target.value; renderBoard(); renderList();
    });

    UI.wireSegment(document, function (v) { state.mode = v; showPane(v); });

    var content = document.querySelector('.content');
    content.addEventListener('click', function (e) {
      var tk = e.target.closest('[data-ticket]');
      if (tk) return openTicket(tk.dataset.ticket);

      var a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'crew') UI.toast('Crew management opens here', 'info');
    });

    content.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var tk = e.target.closest('[data-ticket]');
      if (tk) openTicket(tk.dataset.ticket);
    });

    /* ?ticket=MR-2041 — the client-side equivalent of $_GET['ticket'] */
    var deep = UI.query('ticket');
    if (deep) setTimeout(function () { openTicket(deep); }, 80);
  }

  global.Page = { init: init, refresh: refresh, openTicket: openTicket };

})(window);
