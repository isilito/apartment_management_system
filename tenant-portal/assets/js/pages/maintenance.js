/* ============================================================
   pages/maintenance.js — submit a request, then track its status
   Deep link: maintenance.html?request=REQ-1042 opens that request.
   ============================================================ */
(function (global) {

  var state = { tab: 'open' };

  function listFor(tab) {
    if (tab === 'open') return DB.requests.filter(function (r) { return r.status !== 'done'; });
    if (tab === 'done') return DB.requests.filter(function (r) { return r.status === 'done'; });
    return DB.requests.slice();
  }

  /* ---------- category shortcuts ---------- */
  function renderCategories() {
    UI.fill('categoryPicker', DB.categories.map(function (c) {
      return '<button class="quick-card" data-shell-act="new-request" data-category="' + c.key + '">' +
        '<span class="q-ico stat-icon i-teal">' + icon(c.icon) + '</span>' +
        '<span><b>' + UI.esc(c.label) + '</b></span></button>';
    }).join(''));
  }

  /* ---------- request cards ---------- */
  function card(r) {
    var cat = DB.category(r.category);
    var tone = r.status === 'done' ? 'i-green' : 'i-amber';

    return '<article class="card req-card p-' + r.priority + '" data-request="' + r.id + '" tabindex="0">' +
      '<span class="rq-ico stat-icon ' + tone + '">' + icon(cat.icon) + '</span>' +
      '<div class="rq-body">' +
        '<div class="rq-top">' +
          '<span class="rq-id">' + UI.esc(r.id) + '</span>' +
          UI.statusBadge(r.status) +
          (r.priority === 'urgent' || r.priority === 'high' ? UI.statusBadge(r.priority) : '') +
        '</div>' +
        '<h4>' + UI.esc(r.title) + '</h4>' +
        '<p>' + UI.esc(r.detail) + '</p>' +
        (r.media.length ? '<div class="media-strip">' + r.media.map(mediaChip).join('') + '</div>' : '') +
        '<div class="rq-foot">' +
          '<span>' + icon('calendar') + 'Sent ' + UI.relative(r.submitted) + '</span>' +
          '<span>' + icon(cat.icon) + UI.esc(cat.label) + '</span>' +
          (r.assignee ? '<span>' + icon('user') + UI.esc(r.assignee) + '</span>' : '') +
          (r.scheduledFor ? '<span>' + icon('clock') + 'Visit ' + UI.fmtDate(r.scheduledFor) + '</span>' : '') +
          (r.resolved ? '<span>' + icon('check') + 'Fixed ' + UI.fmtDate(r.resolved) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="rq-end">' +
        '<button class="btn btn-outline btn-sm" data-track="' + r.id + '">Track' + icon('chevRight') + '</button>' +
      '</div>' +
    '</article>';
  }

  function renderList() {
    var list = listFor(state.tab);

    if (!list.length) {
      UI.fill('requestList', UI.card(UI.emptyState(
        state.tab === 'done' ? 'archive' : 'check',
        state.tab === 'done' ? 'Nothing resolved yet' : 'No open requests',
        state.tab === 'done'
          ? 'Requests you have closed will be listed here.'
          : 'Everything in your unit is working. Report a problem any time.',
        '<button class="btn btn-primary btn-sm" data-shell-act="new-request">' +
        icon('plus') + 'Submit new request</button>')));
      return;
    }

    UI.fill('requestList', '<div class="req-list">' + list.map(card).join('') + '</div>');
  }

  function mediaChip(m) {
    var inner = icon(m.kind === 'video' ? 'play' : 'eye') + UI.esc(m.name);
    return m.url ? '<a class="media-chip" href="' + m.url + '" target="_blank" rel="noopener">' + inner + '</a>'
                 : '<span class="media-chip">' + inner + '</span>';
  }

  /* ---------- status tracker ---------- */
  function openTracker(id) {
    var r = DB.request(id);
    if (!r) return;
    var cat = DB.category(r.category);

    /* the first not-done step is the one in flight */
    var currentIdx = r.timeline.findIndex(function (s) { return !s.done; });

    var steps = r.timeline.map(function (s, i) {
      var cls = s.done ? 'done' : (i === currentIdx ? 'current' : 'pending');
      return '<div class="track-step ' + cls + '">' +
        '<b>' + UI.esc(s.label) + '</b>' +
        (s.note ? '<span>' + UI.esc(s.note) + '</span>' : '') +
        '<i>' + (s.when ? UI.fmtDate(s.when) : 'Not yet') + '</i>' +
      '</div>';
    }).join('');

    UI.modal({
      title: r.title,
      sub: r.id + ' · ' + cat.label + ' · sent ' + UI.relative(r.submitted),
      wide: true,
      body:
        '<div class="u-row u-wrap u-mb" style="gap:8px">' +
          UI.statusBadge(r.status) + UI.statusBadge(r.priority) +
          (r.assignee ? UI.badge(r.assignee, 'outline') : UI.badge('Not assigned yet', 'outline')) +
          (r.scheduledFor ? UI.badge('Visit ' + UI.fmtDate(r.scheduledFor), 'teal') : '') +
        '</div>' +

        '<p class="u-sm" style="line-height:1.65;color:var(--ink-2)">' + UI.esc(r.detail) + '</p>' +

        (r.media.length
          ? '<h4 class="u-b u-mt-lg u-mb" style="font-size:12.5px;letter-spacing:.06em;' +
            'text-transform:uppercase;color:var(--muted-2)">What you sent</h4>' +
            '<div class="media-strip">' + r.media.map(mediaChip).join('') + '</div>'
          : '') +

        '<h4 class="u-b u-mt-lg u-mb" style="font-size:12.5px;letter-spacing:.06em;' +
        'text-transform:uppercase;color:var(--muted-2)">Progress</h4>' +
        '<div class="track">' + steps + '</div>' +

        (r.status === 'done'
          ? '<div class="u-rule"></div><div class="u-row u-wrap" style="gap:10px">' +
            '<span class="u-sm u-muted">' + (r.rating ? 'You rated this repair' : 'How did the repair go?') + '</span>' +
            '<span class="stars" id="stars">' + [1, 2, 3, 4, 5].map(function (n) {
              return '<button type="button" data-star="' + n + '" class="' + (r.rating >= n ? 'on' : '') +
                '" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '">&#9733;</button>';
            }).join('') + '</span></div>'
          : '') +
        (r.followUps && r.status !== 'done'
          ? '<p class="u-xs u-muted u-mt">You followed up ' + r.followUps + ' time' + (r.followUps > 1 ? 's' : '') + '.</p>' : ''),

      foot: '<button class="btn btn-ghost" data-close>Close</button>' +
            (r.status === 'done'
              ? '<button class="btn btn-outline" data-act="reopen">Report it again</button>'
              : '<button class="btn btn-outline" data-act="nudge">' + icon('bell') + 'Follow up</button>') +
            '<button class="btn btn-primary" data-confirm>Got it</button>',

      onConfirm: function () {},
      onOpen: function (box) {
        box.addEventListener('click', function (e) {
          var star = e.target.closest('[data-star]');
          if (star) {
            var n = Number(star.dataset.star);
            Shell.save('rate_request', { id: r.id, rating: n }, 'Thanks — you rated this ' + n + '/5')
              .then(function () { UI.closeModal(); }, function (err) { UI.toast(err.message, 'warn'); });
            return;
          }
          var a = e.target.closest('[data-act]');
          if (!a) return;
          if (a.dataset.act === 'nudge') {
            a.disabled = true;
            Shell.save('follow_up', { id: r.id }, 'Follow-up sent — the office has been notified about ' + r.id)
              .then(function () { UI.closeModal(); }, function (err) { a.disabled = false; UI.toast(err.message, 'warn'); });
          }
          if (a.dataset.act === 'reopen') {
            UI.closeModal();
            Shell.openNewRequest(r.category);
          }
        });
      }
    });
  }

  function refresh() {
    var open = listFor('open');
    var done = listFor('done');

    /* average turnaround on the requests that actually closed */
    var closed = done.filter(function (r) { return r.resolved; });
    var avg = closed.length
      ? Math.round(closed.reduce(function (s, r) {
          return s + (r.resolved - r.submitted) / 86400000;
        }, 0) / closed.length)
      : null;

    UI.bind({
      openCount: open.length + ' open',
      doneCount: done.length + ' resolved',
      avgTime:   avg ? 'Usually fixed in ' + avg + ' days' : 'No history yet',
      tabOpen:   open.length,
      tabDone:   done.length,
      tabAll:    DB.requests.length
    });

    renderCategories();
    renderList();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();

    UI.wireTabs(document, function (tab) { state.tab = tab; renderList(); });

    document.querySelector('.content').addEventListener('click', function (e) {
      var t = e.target.closest('[data-track]');
      if (t) { openTracker(t.dataset.track); return; }

      /* clicking the card body (but not a shortcut button) also tracks */
      var c = e.target.closest('[data-request]');
      if (c && !e.target.closest('button')) openTracker(c.dataset.request);
    });

    document.querySelector('.content').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var c = e.target.closest('[data-request]');
      if (c) openTracker(c.dataset.request);
    });

    /* ?request=REQ-1042 — the client-side equivalent of $_GET['request'] */
    var deep = UI.query('request');
    if (deep) {
      state.tab = 'all';
      document.querySelectorAll('.tabs button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.tab === 'all');
      });
      renderList();
      setTimeout(function () { openTracker(deep); }, 80);
    }
  }

  global.Page = { init: init, refresh: refresh };

})(window);
