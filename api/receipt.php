<?php
/* ============================================================
   receipt.php?id=PMT-1001 — printable payment receipt.
   Admins can open any receipt; tenants only their own.
   ============================================================ */
require __DIR__ . '/lib.php';
require __DIR__ . '/print.php';

$u = current_user();
if (!$u) { header('Location: ../login.html'); exit; }

$p = one('SELECT p.*, t.name AS tenant_name FROM payments p JOIN tenants t ON t.id=p.tenant_id WHERE p.id=?', [$_GET['id'] ?? '']);
if (!$p || ($u['role'] === 'tenant' && $p['tenant_id'] !== $u['tenant_id'])) {
    http_response_code(404); exit('Receipt not found.');
}
$b = val('SELECT b.name FROM units un JOIN buildings b ON b.id=un.building_id WHERE un.id=?', [$p['unit_id']]);
$tone = ['cleared' => '', 'pending' => 'amber', 'rejected' => 'red'][$p['status']];
$label = ['cleared' => 'Paid', 'pending' => 'Awaiting confirmation', 'rejected' => 'Not confirmed'][$p['status']];
$bal = tenant_balance($p['tenant_id']);

$body = '<p class="big">' . h(peso($p['amount'])) . '</p><p><span class="badge ' . $tone . '">' . h($label) . '</span></p>' .
  '<dl>' .
  '<dt>Receipt number</dt><dd>' . h($p['id']) . '</dd>' .
  '<dt>Received from</dt><dd>' . h($p['tenant_name']) . '</dd>' .
  '<dt>Unit</dt><dd>' . h($p['unit_id'] ?: '—') . ($b ? ' · ' . h($b) : '') . '</dd>' .
  '<dt>For</dt><dd>' . h($p['covers']) . '</dd>' .
  '<dt>Date paid</dt><dd>' . fdate($p['paid_on']) . '</dd>' .
  '<dt>Method</dt><dd>' . h($p['method']) . '</dd>' .
  '<dt>Reference</dt><dd>' . h($p['reference'] ?: '—') . '</dd>' .
  '<dt>Received by</dt><dd>' . h($p['status'] === 'cleared' ? ($p['submitted_by'] === 'admin' || $p['recorded_by'] !== $p['tenant_name'] ? $p['recorded_by'] : setting('owner_name')) : '—') . '</dd>' .
  '<dt>Balance after this payment</dt><dd>' . ($bal['balance'] > 0 ? h(peso($bal['balance'])) : 'None — fully paid') . '</dd>' .
  ($p['notes'] ? '<dt>Notes</dt><dd>' . h($p['notes']) . '</dd>' : '') .
  '</dl>' .
  '<p class="sub">' . h(setting('receipt_note', '')) . '</p>' .
  '<div class="sign"><div>Tenant</div><div>' . h(setting('owner_name')) . ' · Property management</div></div>';

print_page('Official receipt', h($p['id']) . ' · ' . fdate($p['paid_on']), $body);
