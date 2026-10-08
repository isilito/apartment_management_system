<?php
/* ============================================================
   document.php?doc=lease|rules|deposit|statement — printable
   tenant documents generated from the live records.
   Tenants get their own; admins add &tenant=T001.
   ============================================================ */
require __DIR__ . '/lib.php';
require __DIR__ . '/print.php';

$u = current_user();
if (!$u) { header('Location: ../login.html'); exit; }
$tid = $u['role'] === 'tenant' ? $u['tenant_id'] : ($_GET['tenant'] ?? '');
$t = one('SELECT * FROM tenants WHERE id=?', [$tid]);
if (!$t) { http_response_code(404); exit('Tenant not found.'); }

$unit = $t['unit_id'] ? one('SELECT un.*, ut.label AS type_label, b.name AS building, b.address AS baddress FROM units un
          JOIN unit_types ut ON ut.tkey=un.type_key JOIN buildings b ON b.id=un.building_id WHERE un.id=?', [$t['unit_id']]) : null;
$lines = fn($k) => array_values(array_filter(array_map('trim', explode("\n", (string) setting($k, ''))), 'strlen'));
$owner = h(setting('owner_name'));
$doc = $_GET['doc'] ?? 'lease';

switch ($doc) {

case 'lease':
    $body = '<p>This lease is made between <b>' . $owner . '</b> (the Lessor) and <b>' . h($t['name']) . '</b> (the Lessee) for the unit described below.</p>' .
      '<h2>Premises</h2><dl>' .
      '<dt>Unit</dt><dd>' . h($t['unit_id'] ?: '—') . ($unit ? ' · ' . h($unit['type_label']) . ', ' . h((float) $unit['size_sqm']) . ' sqm' : '') . '</dd>' .
      '<dt>Building</dt><dd>' . h($unit['building'] ?? '—') . '</dd>' .
      '<dt>Address</dt><dd>' . h($unit['baddress'] ?? setting('address')) . '</dd>' .
      '<dt>Furnishing</dt><dd>' . h($unit['furnishing'] ?? '—') . '</dd></dl>' .
      '<h2>Terms</h2><dl>' .
      '<dt>Contract number</dt><dd>' . h($t['contract_no']) . '</dd>' .
      '<dt>Lease period</dt><dd>' . fdate($t['move_in']) . ' to ' . fdate($t['lease_end']) . '</dd>' .
      '<dt>Monthly rent</dt><dd>' . h(peso($t['rent'])) . ', due on day ' . h(setting('rent_due_day', 5)) . ' of each month</dd>' .
      '<dt>Grace period</dt><dd>' . h(setting('grace_days', 3)) . ' days</dd>' .
      '<dt>Security deposit</dt><dd>' . h(peso($t['deposit'])) . ' (refundable, less unpaid charges and damages)</dd>' .
      '<dt>Advance rent</dt><dd>' . h(peso($t['advance'])) . '</dd>' .
      '<dt>Occupants</dt><dd>' . (int) $t['occupants'] . '</dd></dl>' .
      '<h2>Included</h2><ul>' . implode('', array_map(fn($l) => '<li>' . h($l) . '</li>', $lines('inclusions'))) . '</ul>' .
      '<h2>Not included</h2><ul>' . implode('', array_map(fn($l) => '<li>' . h($l) . '</li>', $lines('exclusions'))) . '</ul>' .
      '<h2>House rules</h2><ol>' . implode('', array_map(fn($l) => '<li>' . h($l) . '</li>', $lines('house_rules'))) . '</ol>' .
      '<div class="sign"><div>' . h($t['name']) . ' · Lessee</div><div>' . $owner . ' · Lessor</div></div>';
    print_page('Lease contract', h($t['contract_no']), $body);

case 'rules':
    $body = '<p>These rules apply to every resident of ' . h(setting('property_name')) . '.</p><ol>' .
      implode('', array_map(fn($l) => '<li>' . h($l) . '</li>', $lines('house_rules'))) . '</ol>' .
      '<p class="sub">Questions? Call ' . h(setting('contact_phone')) . '.</p>';
    print_page('House rules', 'For ' . h($t['name']) . ' · Unit ' . h($t['unit_id'] ?: '—'), $body);

case 'deposit':
    $body = '<p>Received from <b>' . h($t['name']) . '</b> the amount of</p><p class="big">' . h(peso($t['deposit'])) . '</p>' .
      '<p>as security deposit for Unit ' . h($t['unit_id'] ?: '—') . ' under lease ' . h($t['contract_no']) . ', starting ' . fdate($t['move_in']) . '.</p>' .
      '<p>The deposit will be returned within 30 days after move-out, less any unpaid rent, utilities, or the cost of damage beyond normal wear.</p>' .
      '<div class="sign"><div>' . h($t['name']) . '</div><div>' . $owner . '</div></div>';
    print_page('Deposit acknowledgement', fdate($t['move_in']), $body);

case 'statement':
    $rows = all('SELECT * FROM charges WHERE tenant_id=? ORDER BY due_date, id', [$t['id']]);
    $pays = all("SELECT * FROM payments WHERE tenant_id=? AND status='cleared' ORDER BY paid_on, id", [$t['id']]);
    $billed = array_sum(array_map(fn($c) => (float) $c['amount'], $rows));
    $paid = array_sum(array_map(fn($p) => (float) $p['amount'], $pays));
    $bal = tenant_balance($t['id']);
    $body = '<dl><dt>Tenant</dt><dd>' . h($t['name']) . '</dd><dt>Unit</dt><dd>' . h($t['unit_id'] ?: '—') . '</dd>' .
      '<dt>Balance due today</dt><dd>' . h(peso($bal['balance'])) . '</dd></dl>' .
      '<h2>Charges</h2><div class="table-wrap"><table><thead><tr><th>Due</th><th>Charge</th><th>Status</th><th class="num">Amount</th><th class="num">Paid</th></tr></thead><tbody>' .
      implode('', array_map(fn($c) => '<tr><td>' . fdate($c['due_date']) . '</td><td>' . h($c['label']) . '<br><span class="sub">' . h($c['detail']) . '</span></td><td>' .
        h(ucfirst($c['status'])) . '</td><td class="num">' . h(peso($c['amount'])) . '</td><td class="num">' . h(peso($c['amount_paid'])) . '</td></tr>', $rows)) .
      '</tbody><tfoot><tr><td colspan="3">Total billed</td><td class="num">' . h(peso($billed)) . '</td><td></td></tr></tfoot></table></div>' .
      '<h2>Payments</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Receipt</th><th>For</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>' .
      implode('', array_map(fn($p) => '<tr><td>' . fdate($p['paid_on']) . '</td><td>' . h($p['id']) . '</td><td>' . h($p['covers']) . '</td><td>' . h($p['method']) .
        '</td><td class="num">' . h(peso($p['amount'])) . '</td></tr>', $pays)) .
      '</tbody><tfoot><tr><td colspan="4">Total paid</td><td class="num">' . h(peso($paid)) . '</td></tr></tfoot></table></div>';
    print_page('Statement of account', 'As of ' . fdate(today()), $body);

default:
    http_response_code(404);
    exit('Unknown document.');
}
