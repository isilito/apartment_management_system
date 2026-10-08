/* ============================================================
   data.js — the admin console's data, loaded from api/admin.php.

   DB.load()   fetches everything once and fills window.DB in the
               shape the pages use (dates become Date objects).
   DB.reload() re-fetches after a change; Shell.afterMutation() calls it.
   DB.stats    figures derived from the loaded records.
   ============================================================ */
(function (global) {

  /* 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS' → local Date (no UTC shift) */
  function parse(s) {
    if (!s) return null;
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return new Date(s);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }

  function dates(list, keys) {
    (list || []).forEach(function (o) { keys.forEach(function (k) { if (o[k]) o[k] = parse(o[k]); }); });
  }

  /* "20 minutes ago", "Yesterday", "3 days ago" */
  function ago(d) {
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
    var days = Math.round(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return String(d.getDate()).padStart(2, '0') + ' ' +
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
  }

  function hydrate(d) {
    d.today = parse(d.today);
    dates(d.tenants, ['moveIn', 'leaseEnd']);
    dates(d.units, ['vacantSince']);
    dates(d.payments, ['date', 'createdAt']);
    dates(d.charges, ['due']);
    dates(d.tickets, ['created', 'resolved', 'scheduledFor']);
    dates(d.notifications, ['at']);
    dates(d.reports, ['at']);
    dates(d.staff, ['lastActive']);
    dates(d.expenses, ['date']);
    d.notifications.forEach(function (n) { n.when = ago(n.at); });
    d.monthly12 = d.monthly;
    d.monthly = d.monthly.slice(-6);
    d.expenseTrend12 = d.expenseTrend;
    d.expenseTrend = d.expenseTrend.slice(-6);
    return d;
  }

  function derive(D) {
    var units = D.units, tenants = D.tenants, tickets = D.tickets, m = D.money;
    var count = function (st) { return units.filter(function (u) { return u.status === st; }).length; };
    var occupied = count('occupied');
    var overdue = tenants.filter(function (t) { return t.balance > 0; })
                         .sort(function (a, b) { return b.overdueDays - a.overdueDays || b.balance - a.balance; });
    var open = tickets.filter(function (t) { return t.status !== 'done'; });

    return {
      totalUnits: units.length,
      occupied: occupied,
      vacant: count('vacant'),
      repair: count('repair'),
      occupancyPct: units.length ? +(occupied / units.length * 100).toFixed(1) : 0,
      buildingsCount: D.buildings.length,

      incomeThisMonth: m.collectedThisMonth,
      incomeLastMonth: m.collectedLastMonth,
      incomeTarget: m.target || m.expectedThisMonth || 1,
      incomeDelta: m.collectedLastMonth
        ? +((m.collectedThisMonth - m.collectedLastMonth) / m.collectedLastMonth * 100).toFixed(1) : 0,
      expectedThisMonth: m.expectedThisMonth || 0,
      pendingCount: m.pendingCount,
      pendingAmount: m.pendingAmount,

      outstanding: overdue.reduce(function (s, t) { return s + t.balance; }, 0),
      overdueTenants: overdue,

      openRepairs: open.length,
      urgentRepairs: open.filter(function (t) { return t.priority === 'urgent'; }).length,
      oldestRepairDays: open.length ? Math.max.apply(null, open.map(function (t) { return t.ageDays; })) : 0,

      tenantCount: tenants.length,
      unreadNotifications: D.notifications.filter(function (n) { return n.unread; }).length
    };
  }

  function by(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return undefined;
  }

  var DB = {
    loaded: false,

    load: function () {
      return API.get('admin.php').then(function (res) {
        var d = hydrate(res.data);
        Object.keys(d).forEach(function (k) { DB[k] = d[k]; });
        DB.stats = derive(DB);
        DB.loaded = true;
        return DB;
      });
    },
    reload: function () { return DB.load(); },
    refresh: function () { DB.stats = derive(DB); },

    unit: function (id) { return by(DB.units, id); },
    tenant: function (id) { return by(DB.tenants, id); },
    ticket: function (id) { return by(DB.tickets, id); },
    payment: function (id) { return by(DB.payments, id); },
    building: function (id) { return by(DB.buildings, id) || { id: id, name: '—', address: '', floors: 0 }; },
    tenantOfUnit: function (id) {
      var u = DB.unit(id);
      return u && u.tenantId ? DB.tenant(u.tenantId) : null;
    },
    chargesOf: function (tenantId) {
      return DB.charges.filter(function (c) { return c.tenantId === tenantId; });
    },
    parse: parse,
    ago: ago
  };

  global.DB = DB;

})(window);
