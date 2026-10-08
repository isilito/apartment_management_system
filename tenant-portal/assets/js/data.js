/* ============================================================
   data.js — the signed-in tenant's records, loaded from
   api/tenant.php. The server only ever returns this tenant's own
   unit, charges, payments, requests, and notices.

   DB.load()   fills window.DB (dates become Date objects)
   DB.reload() re-fetches after a change
   ============================================================ */
(function (global) {

  function parse(s) {
    if (!s) return null;
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return new Date(s);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  function dates(list, keys) {
    (list || []).forEach(function (o) { keys.forEach(function (k) { if (o[k]) o[k] = parse(o[k]); }); });
  }
  function ago(d) {
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
    var days = Math.round(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return UI.fmtDate(d);
  }

  /* whole days from today to a date (negative = in the past) */
  function daysFrom(date) {
    var a = new Date(DB.today.getFullYear(), DB.today.getMonth(), DB.today.getDate());
    var b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((b - a) / 86400000);
  }

  function hydrate(d) {
    d.today = parse(d.today);
    ['moveIn', 'leaseStart', 'leaseEnd'].forEach(function (k) { d.rental[k] = parse(d.rental[k]); });
    dates(d.rental.documents, ['date']);
    dates(d.charges, ['due', 'paidOn']);
    dates(d.payments, ['date']);
    dates(d.requests, ['submitted', 'scheduledFor', 'resolved']);
    d.requests.forEach(function (r) { dates(r.timeline, ['when']); });
    dates(d.notices, ['at']);
    return d;
  }

  function derive() {
    var charges = DB.charges, today = DB.today;
    var unpaid = charges.filter(function (c) { return c.status !== 'paid'; });
    var overdue = unpaid.filter(function (c) { return daysFrom(c.due) < 0; });
    var next = unpaid.slice().sort(function (a, b) { return a.due - b.due; })[0] || null;
    var open = DB.requests.filter(function (r) { return r.status !== 'done'; });
    var cleared = DB.payments.filter(function (p) { return p.status === 'cleared'; });

    DB.notices.forEach(function (n) { n.when = ago(n.at); });

    return {
      totalDue:     unpaid.reduce(function (s, c) { return s + c.amount; }, 0),
      overdueTotal: overdue.reduce(function (s, c) { return s + c.amount; }, 0),
      overdueCount: overdue.length,
      pendingCount: DB.payments.filter(function (p) { return p.status === 'pending'; }).length,
      nextCharge:   next,
      nextDueInDays: next ? daysFrom(next.due) : null,
      openRequests: open.length,
      openList:     open,
      paidThisYear: cleared.filter(function (p) { return p.date.getFullYear() === today.getFullYear(); })
                           .reduce(function (s, p) { return s + p.amount; }, 0),
      monthsStayed: Math.max(1, Math.round((today - DB.rental.moveIn) / 86400000 / 30.44)),
      leaseDaysLeft: DB.rental.leaseEnd ? daysFrom(DB.rental.leaseEnd) : null,
      unreadNotices: DB.notices.filter(function (n) { return n.unread; }).length,
      onTimeStreak: DB.onTimeStreak
    };
  }

  function by(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return undefined;
  }

  var DB = {
    load: function () {
      return API.get('tenant.php').then(function (res) {
        var d = hydrate(res.data);
        Object.keys(d).forEach(function (k) { DB[k] = d[k]; });
        DB.stats = derive();
        return DB;
      });
    },
    reload: function () { return DB.load(); },
    refresh: function () { DB.stats = derive(); },

    request: function (id) { return by(DB.requests, id); },
    payment: function (id) { return by(DB.payments, id); },
    charge:  function (id) { return by(DB.charges, id); },
    category: function (key) {
      return DB.categories.filter(function (c) { return c.key === key; })[0] || DB.categories[DB.categories.length - 1];
    },
    daysFrom: daysFrom,
    parse: parse,
    ago: ago
  };

  global.DB = DB;

})(window);
