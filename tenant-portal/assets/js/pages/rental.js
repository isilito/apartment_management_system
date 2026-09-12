/* ============================================================
   pages/rental.js — My Rental Info (unit & lease details)
   ============================================================ */
(function (global) {

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function renderSpecs() {
    var r = DB.rental;
    var specs = [
      { v: r.type,                     l: 'Unit type' },
      { v: r.size + ' sqm',            l: 'Floor area' },
      { v: 'Floor ' + r.floor,         l: 'Location' },
      { v: r.bedrooms + ' bedroom',    l: 'Sleeping' },
      { v: r.bathrooms + ' bathroom',  l: 'Bathroom' },
      { v: r.furnishing,               l: 'Furnishing' }
    ];
    UI.fill('specGrid', specs.map(function (s) {
      return '<div class="spec"><b>' + UI.esc(s.v) + '</b><span>' + UI.esc(s.l) + '</span></div>';
    }).join(''));
  }

  function renderInclusions() {
    var r = DB.rental;
    UI.fill('inclusionList',
      r.inclusions.map(function (i) {
        return '<div class="yes">' + icon('check') + '<span>' + UI.esc(i) + '</span></div>';
      }).join('') +
      r.exclusions.map(function (i) {
        return '<div class="no">' + icon('close') + '<span>' + UI.esc(i) + '</span></div>';
      }).join(''));
  }

  function renderRules() {
    UI.fill('ruleList', DB.rental.rules.map(function (r) {
      return '<li><span>' + UI.esc(r) + '</span></li>';
    }).join(''));
  }

  function renderDocs() {
    UI.fill('docList', DB.rental.documents.map(function (d) {
      return '<div class="doc-row">' +
        '<span class="d-ico">' + icon('file') + '</span>' +
        '<div class="d-meta"><b>' + UI.esc(d.name) + '</b>' +
          '<span>' + UI.esc(d.type) + ' &middot; ' + UI.esc(d.size) + ' &middot; ' + UI.fmtDate(d.date) + '</span></div>' +
        '<button class="icon-btn sm bare" data-doc="' + UI.esc(d.name) + '" title="Download">' +
          icon('download') + '</button></div>';
    }).join(''));
  }

  function renderContacts() {
    UI.fill('contactList', DB.contacts.map(function (c) {
      return '<div class="contact-row">' +
        '<span class="c-ico">' + icon(c.icon) + '</span>' +
        '<div class="c-meta"><b>' + UI.esc(c.name) + '</b>' +
          '<span>' + UI.esc(c.role) + ' &middot; ' + UI.esc(c.note) + '</span></div>' +
        '<a class="btn btn-outline btn-sm" href="tel:' + UI.esc(c.phone.replace(/\s/g, '')) + '">' +
          icon('phone') + UI.esc(c.phone) + '</a></div>';
    }).join(''));
  }

  function refresh() {
    var r = DB.rental;
    var t = DB.tenant;
    var total = r.leaseEnd - r.leaseStart;
    var done = DB.today - r.leaseStart;
    var pct = Math.max(0, Math.min(100, done / total * 100));
    var daysLeft = DB.daysFrom(r.leaseEnd);
    var monthsLeft = Math.round(daysLeft / 30.44);

    UI.bind({
      contractNo:   r.contractNo,
      address:      r.address,
      unitNo:       r.unitNo,
      unitTitle:    r.type + ' · Unit ' + r.unitNo,
      unitSub:      r.building + ' · Floor ' + r.floor + ' · ' + r.size + ' sqm · ' + r.furnishing,
      rent:         UI.peso(r.rent),
      dueDay:       ordinal(r.dueDay),
      deposit:      UI.peso(r.deposit),

      kvContract:   r.contractNo,
      kvStart:      UI.fmtDate(r.leaseStart),
      kvEnd:        UI.fmtDate(r.leaseEnd),
      kvRent:       UI.peso(r.rent) + ' / month',
      kvDeposit:    UI.peso(r.deposit) + ' (2 months)',
      kvAdvance:    UI.peso(r.advance) + ' (1 month)',
      kvDue:        ordinal(r.dueDay) + ' of every month',
      kvGrace:      r.graceDays + ' days after the due date',

      leaseProgress: pct,
      leaseFrom:     'Started ' + UI.fmtDate(r.leaseStart),
      leaseLeft:     monthsLeft + ' months left',

      occupants:     t.occupants + ' (including you)',
      emergencyName: t.emergency.name + ' · ' + t.emergency.relation,
      emergencyPhone: t.emergency.phone
    });

    UI.fill('leaseBadge', daysLeft < 60
      ? UI.badge('Ends in ' + daysLeft + ' days', 'amber')
      : UI.badge('Active', 'green'));

    renderSpecs();
    renderInclusions();
    renderRules();
    renderDocs();
    renderContacts();
    UI.resolveIcons(document);
  }

  function init() {
    refresh();

    document.querySelector('.content').addEventListener('click', function (e) {
      var doc = e.target.closest('[data-doc]');
      if (doc) { UI.toast('Downloading ' + doc.dataset.doc); return; }

      var a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'print') window.print();
      if (a.dataset.act === 'ask') {
        UI.modal({
          title: 'Ask about your lease',
          sub: 'This goes straight to Aling Nena',
          body:
            '<div class="form-grid">' +
              '<div class="form-row full"><label>What do you need help with?</label>' +
                '<select class="select">' +
                  '<option>Renewing my lease</option>' +
                  '<option>Ending my lease early</option>' +
                  '<option>Getting my deposit back</option>' +
                  '<option>Adding an occupant</option>' +
                  '<option>Something else</option>' +
                '</select></div>' +
              '<div class="form-row full"><label>Your message</label>' +
                '<textarea class="textarea" id="leaseMsg" ' +
                  'placeholder="Type your question here..."></textarea></div>' +
            '</div>',
          confirmText: 'Send message',
          onConfirm: function (box) {
            if (!box.querySelector('#leaseMsg').value.trim()) {
              UI.toast('Write your question first', 'warn');
              return false;
            }
            UI.toast('Message sent to Aling Nena');
          }
        });
      }
    });
  }

  global.Page = { init: init, refresh: refresh };

})(window);
