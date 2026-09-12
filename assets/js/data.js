/* ============================================================
   data.js — demo dataset for the Saraza Apartment admin console.
   Everything the UI renders comes from here, so swapping in a real
   API later means replacing this one file.

   Fixed "today" keeps the demo figures stable and matched to the
   reference design (Friday, 11 September 2026).
   ============================================================ */
(function (global) {

  var TODAY = new Date(2026, 8, 11); // 11 Sep 2026

  /* ---------------- Buildings ---------------- */
  var buildings = [
    { id: 'B1', name: 'Main Building',  floors: 4, address: '142 Mabini St., Brgy. San Roque' },
    { id: 'B2', name: 'Annex A',        floors: 3, address: '144 Mabini St., Brgy. San Roque' },
    { id: 'B3', name: 'Annex B',        floors: 2, address: '146 Mabini St., Brgy. San Roque' }
  ];

  /* ---------------- Name pool ---------------- */
  var FIRST = ['Jose','Maria','Ramon','Liza','Andres','Corazon','Ernesto','Divina','Rogelio','Marites',
               'Benjamin','Aurora','Teodoro','Lolita','Ricardo','Imelda','Danilo','Editha','Manuel','Perla',
               'Alfredo','Remedios','Nestor','Josefina','Rodel','Cristina','Bienvenido','Nenita','Arturo','Luzviminda',
               'Edgar','Rosalinda','Wilfredo','Anabelle','Noel','Gina','Rolando','Melinda','Joel','Charito',
               'Mark','Jenny','Paolo','Karla'];
  var LAST  = ['Ramirez','Lopez','Santos','Reyes','Aquino','Dela Cruz','Santiago','Villanueva','Mercado','Bautista',
               'Fernandez','Garcia','Torres','Navarro','Domingo','Rivera','Castillo','Pascual','Salazar','Gutierrez',
               'Mendoza','Flores','Agustin','Bernardo','Del Rosario','Ocampo','Valdez','Soriano','Cabrera','Yulo',
               'Panganiban','Alcantara','Marquez','Estrada','Rosales','Lim','Tan','Chua','Velasco','Ignacio',
               'Roxas','Padilla','Trinidad','Gomez'];

  var UNIT_TYPES = [
    { key: 'studio',  label: 'Studio',      beds: 0, size: 18, rent: 6500 },
    { key: '1br',     label: '1-Bedroom',   beds: 1, size: 26, rent: 7200 },
    { key: '2br',     label: '2-Bedroom',   beds: 2, size: 38, rent: 9800 },
    { key: 'bedspace',label: 'Bedspace',    beds: 0, size: 12, rent: 3800 }
  ];

  /* Small deterministic PRNG so the demo looks the same every load */
  var seed = 20260911;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function intBetween(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  function initialsOf(name) {
    var p = name.replace(/^(Mr\.|Mrs\.|Ms\.)\s+/, '').split(' ');
    return ((p[0] || '')[0] + (p[p.length - 1] || '')[0]).toUpperCase();
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

  /* ---------------- Units ----------------
     48 units across 3 buildings. 42 occupied, 4 vacant, 2 under repair
     — matching the occupancy donut in the reference design.        */
  var units = [];
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var plan = [
    { b: 'B1', floors: 4, perFloor: 6 },  // 24
    { b: 'B2', floors: 3, perFloor: 5 },  // 15
    { b: 'B3', floors: 3, perFloor: 3 }   //  9  => 48
  ];

  plan.forEach(function (p) {
    for (var f = 1; f <= p.floors; f++) {
      for (var i = 0; i < p.perFloor; i++) {
        var t = UNIT_TYPES[(f + i) % UNIT_TYPES.length];
        units.push({
          id: p.b + '-' + f + LETTERS[i],
          no: f + LETTERS[i],
          buildingId: p.b,
          floor: f,
          typeKey: t.key,
          type: t.label,
          beds: t.beds,
          size: t.size,
          rent: t.rent + (f - 1) * 200,
          status: 'occupied',
          tenantId: null
        });
      }
    }
  });

  /* Mark 4 vacant + 2 under repair at fixed positions */
  ['B1-2C', 'B2-1D', 'B2-3B', 'B3-2C'].forEach(function (id) {
    var u = units.filter(function (x) { return x.id === id; })[0];
    if (u) u.status = 'vacant';
  });
  ['B1-4E', 'B3-1A'].forEach(function (id) {
    var u = units.filter(function (x) { return x.id === id; })[0];
    if (u) u.status = 'repair';
  });

  /* ---------------- Tenants ---------------- */
  /* Named tenants that appear in the reference design, pinned to units */
  var pinned = [
    { unit: 'B1-2A', name: 'J. Ramirez',      full: 'Jose Ramirez',        balance: 0 },
    { unit: 'B1-2B', name: 'K. Lopez',        full: 'Karla Lopez',         balance: 0 },
    { unit: 'B1-1C', name: 'A. Santos',       full: 'Andres Santos',       balance: 0 },
    { unit: 'B1-3D', name: 'M. Reyes',        full: 'Marites Reyes',       balance: 0 },
    { unit: 'B1-4A', name: 'T. Aquino',       full: 'Teodoro Aquino',      balance: 0 },
    { unit: 'B1-4B', name: 'Mrs. Dela Cruz',  full: 'Corazon Dela Cruz',   balance: 8400,  overdueDays: 12 },
    { unit: 'B1-3A', name: 'R. Santiago',     full: 'Rogelio Santiago',    balance: 7600,  overdueDays: 8 },
    { unit: 'B1-1B', name: 'P. Villanueva',   full: 'Perla Villanueva',    balance: 6900,  overdueDays: 5 },
    { unit: 'B2-2A', name: 'E. Mercado',      full: 'Ernesto Mercado',     balance: 6500,  overdueDays: 4 },
    { unit: 'B2-1A', name: 'D. Bautista',     full: 'Divina Bautista',     balance: 4900,  overdueDays: 3 },
    { unit: 'B3-2A', name: 'N. Fernandez',    full: 'Nestor Fernandez',    balance: 3900,  overdueDays: 2 }
  ];

  var tenants = [];
  var tid = 1;
  var occupiedUnits = units.filter(function (u) { return u.status === 'occupied'; });

  function makeTenant(unit, full, balance, overdueDays) {
    var moveIn = addMonths(TODAY, -intBetween(2, 46));
    var t = {
      id: 'T' + String(tid++).padStart(3, '0'),
      name: full,
      short: full.split(' ')[0][0] + '. ' + full.split(' ').slice(1).join(' '),
      initials: initialsOf(full),
      unitId: unit.id,
      unitNo: unit.no,
      buildingId: unit.buildingId,
      phone: '+63 9' + intBetween(10, 99) + ' ' + intBetween(100, 999) + ' ' + intBetween(1000, 9999),
      email: full.toLowerCase().replace(/[^a-z]+/g, '.') + '@gmail.com',
      occupation: pick(['Teacher', 'Nurse', 'Call-center agent', 'Sari-sari store owner', 'Driver',
                        'Office staff', 'Freelancer', 'Student', 'Security guard', 'Barista']),
      moveIn: moveIn,
      leaseEnd: addMonths(moveIn, 12 * Math.ceil((TODAY - moveIn) / (1000 * 60 * 60 * 24 * 365) + 0.35)),
      rent: unit.rent,
      deposit: unit.rent * 2,
      balance: balance || 0,
      overdueDays: overdueDays || 0,
      occupants: intBetween(1, 4),
      emergency: pick(FIRST) + ' ' + full.split(' ').slice(-1)[0],
      status: balance ? 'overdue' : 'current'
    };
    unit.tenantId = t.id;
    tenants.push(t);
    return t;
  }

  /* pinned first */
  pinned.forEach(function (p) {
    var u = units.filter(function (x) { return x.id === p.unit; })[0];
    if (u && u.status === 'occupied') makeTenant(u, p.full, p.balance, p.overdueDays);
  });

  /* fill the rest */
  occupiedUnits.forEach(function (u) {
    if (u.tenantId) return;
    makeTenant(u, pick(FIRST) + ' ' + pick(LAST), 0, 0);
  });

  /* Two tenants on notice (lease ending) — for the renters view */
  tenants[14].status = 'notice';
  tenants[22].status = 'notice';

  /* ---------------- Payments ledger ---------------- */
  var METHODS = ['GCash', 'Bank transfer', 'Cash', 'Maya'];
  var payments = [];
  var pid = 1;

  /* The 5 rows shown in the reference design, most recent first */
  var recent = [
    { unit: 'B1-2A', date: new Date(2026, 8, 10), method: 'GCash',         covers: 'September rent',     amount: 7200,  status: 'cleared' },
    { unit: 'B1-2B', date: new Date(2026, 8,  9), method: 'Bank transfer', covers: 'September rent',     amount: 6800,  status: 'cleared' },
    { unit: 'B1-1C', date: new Date(2026, 8,  8), method: 'Cash',          covers: 'September rent',     amount: 6500,  status: 'cleared' },
    { unit: 'B1-3D', date: new Date(2026, 8,  7), method: 'GCash',         covers: 'Aug balance + Sep',  amount: 11300, status: 'pending' },
    { unit: 'B1-4A', date: new Date(2026, 8,  5), method: 'Bank transfer', covers: 'September rent',     amount: 7900,  status: 'cleared' }
  ];

  function unitOf(id) { return units.filter(function (u) { return u.id === id; })[0]; }
  function tenantOfUnit(id) { var u = unitOf(id); return tenants.filter(function (t) { return t.id === u.tenantId; })[0]; }

  recent.forEach(function (r) {
    var t = tenantOfUnit(r.unit);
    payments.push({
      id: 'PMT-' + String(1000 + pid++),
      tenantId: t.id, tenantName: t.short, initials: t.initials,
      unitNo: t.unitNo, date: r.date, method: r.method,
      covers: r.covers, amount: r.amount, status: r.status
    });
  });

  /* Backfill ~7 months of history so charts and the ledger have depth */
  for (var m = 0; m < 7; m++) {
    var month = addMonths(TODAY, -m);
    tenants.forEach(function (t, idx) {
      if (m === 0 && idx < 5) return;           // already added above
      if (m === 0 && t.balance > 0) return;     // still unpaid this month
      if (rnd() < 0.06) return;                 // an occasional skipped month
      var day = intBetween(1, m === 0 ? 10 : 26);
      payments.push({
        id: 'PMT-' + String(1000 + pid++),
        tenantId: t.id, tenantName: t.short, initials: t.initials,
        unitNo: t.unitNo,
        date: new Date(month.getFullYear(), month.getMonth(), day),
        method: pick(METHODS),
        covers: month.toLocaleDateString('en-PH', { month: 'long' }) + ' rent',
        amount: t.rent,
        status: rnd() < 0.05 ? 'pending' : 'cleared'
      });
    });
  }
  payments.sort(function (a, b) { return b.date - a.date; });

  /* ---------------- Maintenance tickets ---------------- */
  var CATS = [
    { key: 'plumbing',   label: 'Plumbing',    icon: 'droplet' },
    { key: 'electrical', label: 'Electrical',  icon: 'bolt' },
    { key: 'appliance',  label: 'Appliance',   icon: 'wrench' },
    { key: 'structural', label: 'Structural',  icon: 'building' },
    { key: 'pest',       label: 'Pest control',icon: 'bug' },
    { key: 'paint',      label: 'Paint & finish', icon: 'paint' }
  ];

  var CREW = ['Mang Tonyo', 'Kuya Benjie', 'Aling Rosa', 'Engr. Palad'];

  var ticketSeed = [
    { title: 'No water pressure in the bathroom',        unit: 'B1-4B', cat: 'plumbing',   pri: 'urgent', st: 'new',         age: 9 },
    { title: 'Circuit breaker keeps tripping at night',  unit: 'B1-3A', cat: 'electrical', pri: 'urgent', st: 'new',         age: 6 },
    { title: 'Aircon not cooling, leaking water',        unit: 'B2-2A', cat: 'appliance',  pri: 'high',   st: 'scheduled',   age: 5 },
    { title: 'Ceiling leak above the kitchen sink',      unit: 'B1-1B', cat: 'structural', pri: 'high',   st: 'in-progress', age: 4 },
    { title: 'Clogged floor drain in the shared bath',   unit: 'B3-2A', cat: 'plumbing',   pri: 'normal', st: 'in-progress', age: 3 },
    { title: 'Door lock sticking, hard to turn',         unit: 'B2-1A', cat: 'structural', pri: 'normal', st: 'scheduled',   age: 2 },
    { title: 'Cockroaches in the hallway near 2F',       unit: 'B1-2A', cat: 'pest',       pri: 'normal', st: 'new',         age: 1 },
    { title: 'Repaint peeling wall in the stairwell',    unit: 'B1-4E', cat: 'paint',      pri: 'low',    st: 'done',        age: 12 },
    { title: 'Replace busted hallway light bulbs',       unit: 'B2-3B', cat: 'electrical', pri: 'low',    st: 'done',        age: 15 },
    { title: 'Fix loose window screen',                  unit: 'B1-2B', cat: 'structural', pri: 'low',    st: 'done',        age: 18 },
    { title: 'Water heater not turning on',              unit: 'B1-1C', cat: 'appliance',  pri: 'normal', st: 'done',        age: 21 }
  ];

  var tickets = ticketSeed.map(function (s, i) {
    var u = unitOf(s.unit);
    var t = u && u.tenantId ? tenants.filter(function (x) { return x.id === u.tenantId; })[0] : null;
    var cat = CATS.filter(function (c) { return c.key === s.cat; })[0];
    return {
      id: 'MR-' + String(2041 + i),
      title: s.title,
      unitId: s.unit,
      unitNo: u ? u.no : '—',
      buildingId: u ? u.buildingId : 'B1',
      tenantId: t ? t.id : null,
      tenantName: t ? t.short : 'Common area',
      initials: t ? t.initials : 'CA',
      category: cat.key,
      categoryLabel: cat.label,
      categoryIcon: cat.icon,
      priority: s.pri,
      status: s.st,
      created: addDays(TODAY, -s.age),
      ageDays: s.age,
      assignee: s.st === 'new' ? null : pick(CREW),
      cost: s.st === 'done' ? intBetween(4, 32) * 100 : 0,
      notes: 'Reported by ' + (t ? t.name : 'the caretaker') + '. Awaiting scheduling confirmation.'
    };
  });

  /* ---------------- Monthly series (rent collected vs expected) ---------------- */
  var monthly = [
    { month: 'Apr', expected: 316000, collected: 251000 },
    { month: 'May', expected: 318000, collected: 272000 },
    { month: 'Jun', expected: 318000, collected: 243000 },
    { month: 'Jul', expected: 320000, collected: 289000 },
    { month: 'Aug', expected: 320500, collected: 255000 },
    { month: 'Sep', expected: 322700, collected: 284500 }
  ];

  var occupancyTrend = [
    { month: 'Apr', pct: 81.3 }, { month: 'May', pct: 83.3 }, { month: 'Jun', pct: 85.4 },
    { month: 'Jul', pct: 85.4 }, { month: 'Aug', pct: 87.5 }, { month: 'Sep', pct: 87.5 }
  ];

  var expenseTrend = [
    { month: 'Apr', amount: 42600 }, { month: 'May', amount: 38900 }, { month: 'Jun', amount: 51200 },
    { month: 'Jul', amount: 36400 }, { month: 'Aug', amount: 44800 }, { month: 'Sep', amount: 29700 }
  ];

  /* ---------------- Notifications ---------------- */
  var notifications = [
    { tone: 'red',   icon: 'alert',   title: '2 urgent repairs unassigned',  body: 'Unit 4B and 3A have been waiting 9 and 6 days.', when: '20 minutes ago', unread: true },
    { tone: 'amber', icon: 'clock',   title: 'Mrs. Dela Cruz is 12 days late', body: '₱8,400 outstanding for Unit 4B.', when: '2 hours ago', unread: true },
    { tone: 'green', icon: 'peso',    title: 'Payment received — ₱7,200',    body: 'J. Ramirez paid September rent via GCash.', when: 'Yesterday', unread: true },
    { tone: 'teal',  icon: 'idCard',  title: 'Lease ends in 30 days',        body: 'Two tenants have leases expiring next month.', when: '2 days ago', unread: false },
    { tone: 'teal',  icon: 'doorOpen',title: 'Unit 2C is now vacant',        body: 'Turnover cleaning scheduled for 14 Sep.', when: '4 days ago', unread: false }
  ];

  /* ---------------- Derived aggregates ---------------- */
  function derive() {
    var occupied = units.filter(function (u) { return u.status === 'occupied'; }).length;
    var vacant   = units.filter(function (u) { return u.status === 'vacant'; }).length;
    var repair   = units.filter(function (u) { return u.status === 'repair'; }).length;
    var overdue  = tenants.filter(function (t) { return t.balance > 0; });
    var openTix  = tickets.filter(function (t) { return t.status !== 'done'; });

    return {
      totalUnits: units.length,
      occupied: occupied,
      vacant: vacant,
      repair: repair,
      occupancyPct: +(occupied / units.length * 100).toFixed(1),
      buildingsCount: buildings.length,

      incomeThisMonth: 284500,
      incomeTarget: 310000,
      incomeDelta: 12.4,

      expectedThisMonth: 322700,
      outstanding: overdue.reduce(function (s, t) { return s + t.balance; }, 0),
      overdueTenants: overdue.sort(function (a, b) { return b.overdueDays - a.overdueDays; }),

      openRepairs: openTix.length,
      urgentRepairs: openTix.filter(function (t) { return t.priority === 'urgent'; }).length,
      oldestRepairDays: Math.max.apply(null, openTix.map(function (t) { return t.ageDays; })),

      tenantCount: tenants.length,
      unreadNotifications: notifications.filter(function (n) { return n.unread; }).length
    };
  }

  global.DB = {
    today: TODAY,
    buildings: buildings,
    unitTypes: UNIT_TYPES,
    units: units,
    tenants: tenants,
    payments: payments,
    tickets: tickets,
    categories: CATS,
    crew: CREW,
    methods: METHODS,
    monthly: monthly,
    occupancyTrend: occupancyTrend,
    expenseTrend: expenseTrend,
    notifications: notifications,
    stats: derive(),

    unit: function (id) { return units.filter(function (u) { return u.id === id; })[0]; },
    tenant: function (id) { return tenants.filter(function (t) { return t.id === id; })[0]; },
    ticket: function (id) { return tickets.filter(function (t) { return t.id === id; })[0]; },
    building: function (id) { return buildings.filter(function (b) { return b.id === id; })[0]; },
    tenantOfUnit: function (id) {
      var u = this.unit(id);
      return u && u.tenantId ? this.tenant(u.tenantId) : null;
    },
    refresh: function () { this.stats = derive(); }
  };

})(window);
