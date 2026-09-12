/* ============================================================
   data.js — the signed-in tenant's records.

   The admin console holds every unit; this portal holds exactly one
   tenant's slice of it. Swap this file for authenticated API calls
   (or a PHP session lookup) and nothing else needs to change.

   "Today" is pinned to 11 September 2026 to match the admin console.
   ============================================================ */
(function (global) {

  var TODAY = new Date(2026, 8, 11);

  function d(y, m, day) { return new Date(y, m - 1, day); }
  function daysFrom(date) { return Math.round((date - TODAY) / 86400000); }

  /* ---------------- Who is signed in ---------------- */
  var tenant = {
    id: 'T001',
    name: 'Jose Ramirez',
    initials: 'JR',
    phone: '+63 917 428 6610',
    email: 'jose.ramirez@gmail.com',
    occupation: 'Call-center agent',
    occupants: 2,
    emergency: { name: 'Marites Ramirez', relation: 'Sister', phone: '+63 918 330 7745' }
  };

  /* ---------------- The unit and lease ---------------- */
  var rental = {
    unitNo: '2A',
    building: 'Main Building',
    address: '142 Mabini St., Brgy. San Roque, Marikina City',
    floor: 2,
    type: '1-Bedroom',
    size: 26,
    bedrooms: 1,
    bathrooms: 1,
    furnishing: 'Semi-furnished',
    rent: 7200,
    deposit: 14400,
    advance: 7200,
    dueDay: 5,
    graceDays: 3,
    moveIn: d(2025, 3, 1),
    leaseStart: d(2025, 3, 1),
    leaseEnd: d(2027, 2, 28),
    contractNo: 'LSE-2025-014',
    inclusions: ['Own water meter', 'Own electric sub-meter', 'Wi-Fi ready', 'Shared laundry area'],
    exclusions: ['Water and electricity billed separately', 'Parking not included'],
    rules: [
      'Quiet hours are 10:00 PM to 6:00 AM.',
      'Visitors staying overnight must be logged with the caretaker.',
      'No pets without written approval from the owner.',
      'Garbage is collected Monday, Wednesday, and Friday mornings.',
      'Give 30 days written notice before moving out.'
    ],
    documents: [
      { name: 'Lease contract (signed)', type: 'PDF', size: '1.2 MB', date: d(2025, 3, 1) },
      { name: 'House rules', type: 'PDF', size: '240 KB', date: d(2025, 3, 1) },
      { name: 'Deposit acknowledgement receipt', type: 'PDF', size: '180 KB', date: d(2025, 3, 1) },
      { name: 'Unit turnover checklist', type: 'PDF', size: '410 KB', date: d(2025, 3, 2) }
    ]
  };

  /* ---------------- Property contacts ---------------- */
  var contacts = [
    { role: 'Administrator', name: 'Aling Nena',  phone: '+63 917 555 0142', note: 'Rent, contracts, and billing', icon: 'user' },
    { role: 'Caretaker',     name: 'Mang Tonyo',  phone: '+63 920 118 4432', note: 'Repairs and building access',  icon: 'wrench' },
    { role: 'Emergency',     name: 'Barangay San Roque', phone: '161',       note: 'Fire, medical, security',      icon: 'shield' }
  ];

  /* ---------------- Charges: balance & due dates ---------------- */
  var charges = [
    { id: 'CHG-3081', label: 'October rent',              detail: 'Monthly rent for Unit 2A',
      amount: 7200, due: d(2026, 10, 5), status: 'upcoming', kind: 'rent' },
    { id: 'CHG-3074', label: 'Water & electricity',       detail: 'August meter reading',
      amount: 1720, due: d(2026, 9, 20), status: 'upcoming', kind: 'utility' },
    { id: 'CHG-3066', label: 'September rent',            detail: 'Monthly rent for Unit 2A',
      amount: 7200, due: d(2026, 9, 5), status: 'paid', kind: 'rent', paidOn: d(2026, 9, 10) }
  ];

  /* ---------------- Payment history ---------------- */
  var payments = [
    { id: 'RCP-2091', date: d(2026, 9, 10), amount: 7200, method: 'GCash',         covers: 'September rent',            status: 'cleared', ref: '9174 2866 10' },
    { id: 'RCP-2072', date: d(2026, 8, 18), amount: 1650, method: 'Cash',          covers: 'Water & electricity (Jul)', status: 'cleared', ref: '—' },
    { id: 'RCP-2068', date: d(2026, 8,  5), amount: 7200, method: 'GCash',         covers: 'August rent',               status: 'cleared', ref: '9174 2866 05' },
    { id: 'RCP-2051', date: d(2026, 7, 19), amount: 1580, method: 'Bank transfer', covers: 'Water & electricity (Jun)', status: 'cleared', ref: 'BPI 88213' },
    { id: 'RCP-2047', date: d(2026, 7,  4), amount: 7200, method: 'GCash',         covers: 'July rent',                 status: 'cleared', ref: '9174 2866 04' },
    { id: 'RCP-2030', date: d(2026, 6, 20), amount: 1720, method: 'Cash',          covers: 'Water & electricity (May)', status: 'cleared', ref: '—' },
    { id: 'RCP-2026', date: d(2026, 6,  5), amount: 7200, method: 'Maya',          covers: 'June rent',                 status: 'cleared', ref: 'MY 40921' },
    { id: 'RCP-2009', date: d(2026, 5,  4), amount: 7200, method: 'GCash',         covers: 'May rent',                  status: 'cleared', ref: '9174 2866 02' },
    { id: 'RCP-1994', date: d(2026, 4,  3), amount: 7200, method: 'GCash',         covers: 'April rent',                status: 'cleared', ref: '9174 2866 01' },
    { id: 'RCP-1977', date: d(2026, 3,  5), amount: 7200, method: 'Bank transfer', covers: 'March rent',                status: 'cleared', ref: 'BPI 81004' }
  ];

  var methods = [
    { key: 'gcash',    label: 'GCash',         icon: 'smartphone', detail: '0917 555 0142 · Saraza Apartment' },
    { key: 'maya',     label: 'Maya',          icon: 'wallet',     detail: '0917 555 0142 · Saraza Apartment' },
    { key: 'bank',     label: 'Bank transfer', icon: 'bank',       detail: 'BPI 1234-5678-90 · L. Saraza' },
    { key: 'cash',     label: 'Cash',          icon: 'cash',       detail: 'Hand to Aling Nena, get a receipt' }
  ];

  /* ---------------- Maintenance requests ---------------- */
  var CATS = [
    { key: 'plumbing',   label: 'Plumbing',        icon: 'droplet' },
    { key: 'electrical', label: 'Electrical',      icon: 'bolt' },
    { key: 'appliance',  label: 'Appliance',       icon: 'wrench' },
    { key: 'structural', label: 'Structural',      icon: 'building' },
    { key: 'pest',       label: 'Pest control',    icon: 'bug' },
    { key: 'paint',      label: 'Paint & finish',  icon: 'paint' },
    { key: 'other',      label: 'Something else',  icon: 'more' }
  ];

  var requests = [
    {
      id: 'REQ-1042',
      title: 'Leaking kitchen faucet',
      detail: 'Water keeps dripping from the base of the faucet even when fully closed. ' +
              'It has soaked the cabinet underneath twice this week.',
      category: 'plumbing', priority: 'normal', status: 'in-progress',
      submitted: d(2026, 9, 8), assignee: 'Mang Tonyo',
      media: [{ kind: 'photo', name: 'faucet-drip.jpg' }, { kind: 'photo', name: 'cabinet-wet.jpg' }],
      timeline: [
        { label: 'Request submitted',      when: d(2026, 9,  8), note: 'You sent this request with 2 photos.', done: true },
        { label: 'Received by admin',      when: d(2026, 9,  8), note: 'Aling Nena acknowledged the request.',  done: true },
        { label: 'Assigned to Mang Tonyo', when: d(2026, 9,  9), note: 'Caretaker scheduled a visit.',          done: true },
        { label: 'Repair in progress',     when: d(2026, 9, 11), note: 'Replacement cartridge being fitted.',   done: true },
        { label: 'Marked resolved',        when: null,           note: 'Waiting for the repair to finish.',     done: false }
      ]
    },
    {
      id: 'REQ-1039',
      title: 'Aircon not cooling properly',
      detail: 'The unit runs but the air stays warm. There is also a rattling sound after about ten minutes.',
      category: 'appliance', priority: 'high', status: 'scheduled',
      submitted: d(2026, 9, 5), assignee: 'Kuya Benjie',
      scheduledFor: d(2026, 9, 14),
      media: [{ kind: 'photo', name: 'aircon-unit.jpg' }, { kind: 'video', name: 'rattle-sound.mp4' }],
      timeline: [
        { label: 'Request submitted', when: d(2026, 9,  5), note: 'You sent this request with 1 photo and 1 video.', done: true },
        { label: 'Received by admin', when: d(2026, 9,  6), note: 'Marked as high priority.',                        done: true },
        { label: 'Technician booked', when: d(2026, 9,  9), note: 'Visit set for 14 Sep, 9:00 AM – 12:00 NN.',       done: true },
        { label: 'Repair in progress',when: null,           note: 'Starts on the scheduled date.',                   done: false },
        { label: 'Marked resolved',   when: null,           note: '',                                                done: false }
      ]
    },
    {
      id: 'REQ-1031',
      title: 'Hallway light bulb busted',
      detail: 'The bulb outside unit 2A has been out for three nights. The stairs are dark.',
      category: 'electrical', priority: 'normal', status: 'done',
      submitted: d(2026, 9, 2), assignee: 'Mang Tonyo', resolved: d(2026, 9, 9),
      media: [{ kind: 'photo', name: 'dark-hallway.jpg' }],
      rating: 5,
      timeline: [
        { label: 'Request submitted', when: d(2026, 9, 2), note: 'You sent this request with 1 photo.', done: true },
        { label: 'Received by admin', when: d(2026, 9, 2), note: '',                                    done: true },
        { label: 'Assigned',          when: d(2026, 9, 4), note: 'Mang Tonyo picked up the request.',   done: true },
        { label: 'Repair in progress',when: d(2026, 9, 8), note: '',                                    done: true },
        { label: 'Marked resolved',   when: d(2026, 9, 9), note: 'LED bulb replaced. You rated this 5/5.', done: true }
      ]
    },
    {
      id: 'REQ-1024',
      title: 'Door lock sticking, hard to turn',
      detail: 'The key needs a lot of force. Worried it will snap inside the lock.',
      category: 'structural', priority: 'normal', status: 'done',
      submitted: d(2026, 8, 19), assignee: 'Mang Tonyo', resolved: d(2026, 8, 22),
      media: [],
      rating: 4,
      timeline: [
        { label: 'Request submitted', when: d(2026, 8, 19), note: '',                             done: true },
        { label: 'Received by admin', when: d(2026, 8, 19), note: '',                             done: true },
        { label: 'Assigned',          when: d(2026, 8, 20), note: '',                             done: true },
        { label: 'Repair in progress',when: d(2026, 8, 22), note: '',                             done: true },
        { label: 'Marked resolved',   when: d(2026, 8, 22), note: 'Lock cylinder lubricated and realigned.', done: true }
      ]
    }
  ];

  /* ---------------- Notices from the landlord ---------------- */
  var notices = [
    { tone: 'amber', icon: 'droplet', title: 'Water interruption on 16 Sep',
      body: 'Maynilad line maintenance, 9:00 AM to 3:00 PM. Please store water in advance.', when: '2 days ago', unread: true },
    { tone: 'teal',  icon: 'calendar', title: 'Rent due on 5 October',
      body: 'A reminder will be sent three days before the due date.', when: '4 days ago', unread: true },
    { tone: 'green', icon: 'check',   title: 'September rent received',
      body: 'Thank you. Receipt RCP-2091 is available in Payment History.', when: '1 day ago', unread: false }
  ];

  /* ---------------- Derived figures ---------------- */
  function derive() {
    var unpaid = charges.filter(function (c) { return c.status !== 'paid'; });
    var overdue = unpaid.filter(function (c) { return daysFrom(c.due) < 0; });
    var next = unpaid.slice().sort(function (a, b) { return a.due - b.due; })[0] || null;
    var open = requests.filter(function (r) { return r.status !== 'done'; });

    var paidThisYear = payments
      .filter(function (p) { return p.date.getFullYear() === TODAY.getFullYear(); })
      .reduce(function (s, p) { return s + p.amount; }, 0);

    var monthsStayed = Math.max(1, Math.round((TODAY - rental.moveIn) / 86400000 / 30.44));

    return {
      totalDue:     unpaid.reduce(function (s, c) { return s + c.amount; }, 0),
      overdueTotal: overdue.reduce(function (s, c) { return s + c.amount; }, 0),
      overdueCount: overdue.length,
      nextCharge:   next,
      nextDueInDays: next ? daysFrom(next.due) : null,
      openRequests: open.length,
      openList:     open,
      paidThisYear: paidThisYear,
      monthsStayed: monthsStayed,
      leaseDaysLeft: daysFrom(rental.leaseEnd),
      unreadNotices: notices.filter(function (n) { return n.unread; }).length,
      onTimeStreak: 9
    };
  }

  global.DB = {
    today: TODAY,
    tenant: tenant,
    rental: rental,
    contacts: contacts,
    charges: charges,
    payments: payments,
    methods: methods,
    categories: CATS,
    requests: requests,
    notices: notices,
    stats: derive(),

    request: function (id) {
      return requests.filter(function (r) { return r.id === id; })[0];
    },
    payment: function (id) {
      return payments.filter(function (p) { return p.id === id; })[0];
    },
    category: function (key) {
      return CATS.filter(function (c) { return c.key === key; })[0] || CATS[CATS.length - 1];
    },
    daysFrom: daysFrom,
    refresh: function () { this.stats = derive(); }
  };

})(window);
