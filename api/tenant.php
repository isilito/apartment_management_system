<?php
/* ============================================================
   tenant.php — the signed-in tenant's slice of the data.

   GET  tenant.php                  this tenant's dataset (window.DB)
   POST tenant.php?action=<name>    submit_payment, new_request, follow_up,
                                    rate_request, send_message,
                                    mark_notices_read, update_contact
   ============================================================ */
require __DIR__ . '/lib.php';

$ME = require_role('tenant');
$T = one('SELECT * FROM tenants WHERE id=?', [$ME['tenant_id']]);
if (!$T || $T['status'] === 'moved_out') fail('This tenant account is no longer active.', 403);

$action = $_GET['action'] ?? 'bootstrap';

if ($action === 'bootstrap') {
    ensure_charges();
    json_out(['ok' => true, 'data' => tenant_bootstrap($ME, $T)]);
}

require_post();
$ACTIONS = ['submit_payment', 'new_request', 'follow_up', 'rate_request', 'send_message', 'mark_notices_read', 'update_contact'];
if (!in_array($action, $ACTIONS, true)) fail('Unknown action.', 404);

db()->beginTransaction();
$result = ('act_' . $action)($ME, $T);
db()->commit();
ok($result ?: []);

/* ============================================================
   Bootstrap
   ============================================================ */
function tenant_bootstrap(array $me, array $t): array
{
    $today = today();
    $u = $t['unit_id'] ? one('SELECT u.*, ut.label AS type_label, ut.beds, b.name AS building, b.address AS baddress
                              FROM units u JOIN unit_types ut ON ut.tkey=u.type_key JOIN buildings b ON b.id=u.building_id
                              WHERE u.id=?', [$t['unit_id']]) : null;

    $pendingFor = [];
    foreach (all("SELECT charge_id FROM payments WHERE tenant_id=? AND status='pending' AND charge_id IS NOT NULL", [$t['id']]) as $p) {
        $pendingFor[(int) $p['charge_id']] = true;
    }

    /* utilities run on each tenant's own meters, so they are never billed here */
    $charges = array_map(function ($c) use ($today, $pendingFor) {
        $remaining = round((float) $c['amount'] - (float) $c['amount_paid'], 2);
        $status = $c['status'] === 'paid' ? 'paid'
                : (isset($pendingFor[(int) $c['id']]) ? 'pending' : ($c['due_date'] < $today ? 'overdue' : 'upcoming'));
        return [
            'id' => 'CHG-' . $c['id'], 'chargeId' => (int) $c['id'], 'label' => $c['label'], 'detail' => $c['detail'],
            'amount' => $c['status'] === 'paid' ? (float) $c['amount'] : $remaining, 'total' => (float) $c['amount'],
            'partial' => $c['status'] === 'partial', 'due' => $c['due_date'], 'status' => $status,
            'kind' => $c['kind'], 'paidOn' => $c['paid_on'],
        ];
    }, all("SELECT * FROM charges WHERE tenant_id=? AND kind <> 'utility' AND (status <> 'paid' OR paid_on >= ?) ORDER BY due_date DESC, id DESC",
           [$t['id'], date('Y-m-d', strtotime('-75 days'))]));

    $payments = array_map(fn($p) => [
        'id' => $p['id'], 'date' => $p['paid_on'], 'amount' => (float) $p['amount'], 'method' => $p['method'],
        'covers' => $p['covers'], 'status' => $p['status'], 'ref' => $p['reference'] ?: '—', 'note' => $p['notes'],
        'receivedBy' => $p['status'] !== 'cleared' ? '—'
                        : ($p['recorded_by'] && $p['recorded_by'] !== $t['name'] ? $p['recorded_by'] : setting('owner_name')),
        'proof' => $p['proof_path'] ? '../api/file.php?payment=' . rawurlencode($p['id']) : null,
    ], all('SELECT * FROM payments WHERE tenant_id=? ORDER BY paid_on DESC, created_at DESC', [$t['id']]));

    /* consecutive rent charges paid within the grace period, most recent first */
    $grace = (int) setting('grace_days', 3);
    $streak = 0;
    foreach (all("SELECT due_date, status, paid_on FROM charges WHERE tenant_id=? AND kind='rent' AND due_date <= ?
                  ORDER BY due_date DESC", [$t['id'], $today]) as $c) {
        if ($c['status'] === 'paid' && $c['paid_on'] && days_between($c['due_date'], $c['paid_on']) <= $grace) $streak++;
        else break;
    }

    $media = [];
    foreach (all('SELECT m.* FROM maintenance_media m JOIN maintenance_requests r ON r.id=m.request_id WHERE r.tenant_id=?', [$t['id']]) as $m) {
        $media[$m['request_id']][] = ['kind' => $m['kind'], 'name' => $m['file_name'],
            'url' => $m['file_path'] ? '../api/file.php?media=' . $m['id'] : null];
    }
    $requests = array_map(fn($r) => [
        'id' => $r['id'], 'title' => $r['title'], 'detail' => $r['details'] ?: 'No extra detail given.',
        'category' => $r['category'], 'priority' => $r['priority'], 'status' => $r['status'],
        'submitted' => $r['created_at'], 'assignee' => $r['assignee'], 'scheduledFor' => $r['scheduled_for'],
        'resolved' => $r['resolved_at'], 'rating' => $r['rating'] ? (int) $r['rating'] : null,
        'followUps' => (int) $r['follow_ups'], 'media' => $media[$r['id']] ?? [], 'timeline' => request_timeline($r),
    ], all('SELECT * FROM maintenance_requests WHERE tenant_id=? ORDER BY created_at DESC', [$t['id']]));

    $caretaker = one("SELECT name, phone FROM staff WHERE role='Caretaker' ORDER BY id LIMIT 1");
    $contacts = [
        ['role' => 'Administrator', 'name' => setting('owner_name', 'Property office'), 'phone' => setting('contact_phone', ''),
         'note' => 'Rent, contracts, and billing', 'icon' => 'user'],
    ];
    if ($caretaker) $contacts[] = ['role' => 'Caretaker', 'name' => $caretaker['name'], 'phone' => $caretaker['phone'],
                                   'note' => 'Repairs and building access', 'icon' => 'wrench'];
    $contacts[] = ['role' => 'Emergency', 'name' => setting('emergency_name', 'Barangay hall'), 'phone' => setting('emergency_phone', '911'),
                   'note' => 'Fire, medical, security', 'icon' => 'shield'];

    $lines = fn($k) => array_values(array_filter(array_map('trim', explode("\n", (string) setting($k, ''))), 'strlen'));

    $docs = [
        ['id' => 'lease', 'name' => 'Lease contract', 'type' => 'Printable', 'size' => $t['contract_no'], 'date' => $t['move_in']],
        ['id' => 'rules', 'name' => 'House rules', 'type' => 'Printable', 'size' => count($lines('house_rules')) . ' rules', 'date' => $t['move_in']],
        ['id' => 'deposit', 'name' => 'Deposit acknowledgement receipt', 'type' => 'Printable', 'size' => peso($t['deposit']), 'date' => $t['move_in']],
        ['id' => 'statement', 'name' => 'Statement of account', 'type' => 'Printable', 'size' => 'Up to today', 'date' => $today],
    ];
    foreach ($docs as &$d) $d['url'] = '../api/document.php?doc=' . $d['id'];
    unset($d);

    return [
        'today' => $today,
        'settings' => ['propertyName' => setting('property_name'), 'ownerName' => setting('owner_name'),
                       'receiptNote' => setting('receipt_note', '')],
        'tenant' => [
            'id' => $t['id'], 'name' => $t['name'], 'initials' => initials_of($t['name']), 'phone' => $t['phone'],
            'email' => $t['email'], 'occupation' => $t['occupation'], 'occupants' => (int) $t['occupants'],
            'emergency' => ['name' => $t['emergency_name'] ?: '—', 'relation' => $t['emergency_relation'] ?: '—',
                            'phone' => $t['emergency_phone'] ?: '—'],
            'leaseStatus' => $t['status'],
        ],
        'rental' => [
            'unitNo' => $t['unit_id'] ?: '—', 'building' => $u['building'] ?? '—',
            'address' => $u['baddress'] ?? setting('address', ''), 'floor' => (int) ($u['floor'] ?? 0),
            'type' => $u['type_label'] ?? '—', 'size' => (float) ($u['size_sqm'] ?? 0), 'bedrooms' => (int) ($u['beds'] ?? 0),
            'bathrooms' => (int) ($u['bathrooms'] ?? 1), 'furnishing' => $u['furnishing'] ?? '—',
            'rent' => (float) $t['rent'], 'deposit' => (float) $t['deposit'], 'advance' => (float) $t['advance'],
            'dueDay' => (int) setting('rent_due_day', 5), 'graceDays' => $grace,
            'moveIn' => $t['move_in'], 'leaseStart' => $t['move_in'], 'leaseEnd' => $t['lease_end'], 'contractNo' => $t['contract_no'],
            'inclusions' => $lines('inclusions'), 'exclusions' => $lines('exclusions'), 'rules' => $lines('house_rules'),
            'documents' => $docs,
        ],
        'contacts' => $contacts,
        'charges' => $charges,
        'payments' => $payments,
        'methods' => payment_methods(),
        'categories' => categories(),
        'requests' => $requests,
        'notices' => notifications_for((int) $me['id']),
        'onTimeStreak' => $streak,
    ];
}

/* ============================================================
   Actions
   ============================================================ */
function act_submit_payment(array $me, array $t): array
{
    $amount = round(num_in('amount'), 2);
    if ($amount <= 0) fail('Enter the amount you paid.');
    $m = one('SELECT * FROM payment_methods WHERE mkey=? AND is_active=1', [str_in('method', 16, true, 'Payment method')]);
    if (!$m) fail('Choose a payment method.');
    $ref = str_in('reference', 80);
    if ($ref === '' && $m['mkey'] !== 'cash') fail('Add the reference number from your receipt.');

    $chargeId = (int) preg_replace('/\D/', '', (string) (input()['chargeId'] ?? ''));
    $charge = $chargeId ? one('SELECT * FROM charges WHERE id=? AND tenant_id=?', [$chargeId, $t['id']]) : null;
    if ($chargeId && !$charge) fail('That charge could not be found.');
    if ($charge && $charge['kind'] !== 'rent') fail('Only rent can be paid through the portal.');
    if ($charge && $charge['status'] === 'paid') fail('That charge is already paid.');
    if ($charge && val("SELECT 1 FROM payments WHERE charge_id=? AND status='pending'", [$charge['id']])) {
        fail('You already sent a payment for this charge. It is waiting for confirmation.');
    }

    $proof = null;
    $files = files_list('proof');
    if ($files) $proof = save_upload($files[0], 'proofs', ['image/', 'application/pdf'])['path'];

    $id = next_code('payments', 'PMT-', 1001);
    q("INSERT INTO payments (id, tenant_id, unit_id, charge_id, paid_on, method, covers, amount, reference, status,
        proof_path, submitted_by, recorded_by, applied, created_at)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?, 'tenant', ?, 0, ?)",
      [$id, $t['id'], $t['unit_id'], $charge['id'] ?? null, date_in('date', today()), $m['label'],
       $charge ? $charge['label'] : 'Payment', $amount, $ref, $proof, $t['name'], now()]);

    notify_admins('notif_payment', 'teal', 'receipt', 'Payment waiting for confirmation',
        $t['name'] . ' (Unit ' . $t['unit_id'] . ') sent ' . peso($amount) . ' via ' . $m['label'] .
        ($charge ? ' for ' . $charge['label'] : '') . '.', 'payments.html?receipt=' . $id);
    log_activity($me, 'Submitted payment', $id . ' · ' . peso($amount));
    return ['id' => $id];
}

function act_new_request(array $me, array $t): array
{
    if (!$t['unit_id']) fail('You have no unit on file.');
    $title = str_in('title', 160, true, 'Problem title');
    $cat = str_in('category', 16, true, 'Category');
    if (!val('SELECT 1 FROM categories WHERE ckey=?', [$cat])) fail('Choose a category.');
    $files = files_list('media');
    if (count($files) > 5) fail('Attach up to 5 photos or videos.');

    $id = next_code('maintenance_requests', 'MR-', 2041);
    q("INSERT INTO maintenance_requests (id, unit_id, tenant_id, title, details, category, priority, status, allow_entry, created_at)
       VALUES (?,?,?,?,?,?,?, 'new', ?, ?)",
      [$id, $t['unit_id'], $t['id'], $title, str_in('details', 2000), $cat,
       enum_in('priority', ['urgent', 'high', 'normal', 'low'], 'normal'), !empty(input()['allowEntry']) && input()['allowEntry'] !== '0' ? 1 : 0, now()]);

    foreach ($files as $f) {
        $saved = save_upload($f, 'requests', ['image/', 'video/']);
        q('INSERT INTO maintenance_media (request_id, kind, file_name, file_path, created_at) VALUES (?,?,?,?,?)',
          [$id, $saved['kind'], $saved['name'], $saved['path'], now()]);
    }

    $pri = enum_in('priority', ['urgent', 'high', 'normal', 'low'], 'normal');
    notify_admins('notif_maintenance', $pri === 'urgent' ? 'red' : 'amber', 'wrench',
        'New ' . ($pri === 'urgent' ? 'urgent ' : '') . 'request — Unit ' . $t['unit_id'],
        $title . ($files ? ' · ' . count($files) . ' attachment' . (count($files) > 1 ? 's' : '') : ''), 'maintenance.html?ticket=' . $id);
    log_activity($me, 'Submitted request', $id . ' · ' . $title);
    return ['id' => $id];
}

function own_request(array $t): array
{
    $r = one('SELECT * FROM maintenance_requests WHERE id=? AND tenant_id=?', [str_in('id', 12, true), $t['id']]);
    if (!$r) fail('Request not found.');
    return $r;
}

function act_follow_up(array $me, array $t): array
{
    $r = own_request($t);
    if ($r['status'] === 'done') fail('This request is already resolved.');
    q('UPDATE maintenance_requests SET follow_ups = follow_ups + 1 WHERE id=?', [$r['id']]);
    notify_admins('notif_maintenance', 'amber', 'bell', 'Follow-up on ' . $r['id'],
        $t['name'] . ' (Unit ' . $t['unit_id'] . ') is asking about: ' . $r['title'], 'maintenance.html?ticket=' . $r['id']);
    return [];
}

function act_rate_request(array $me, array $t): array
{
    $r = own_request($t);
    if ($r['status'] !== 'done') fail('You can rate a repair once it is resolved.');
    $rating = max(1, min(5, int_in('rating', 5)));
    q('UPDATE maintenance_requests SET rating=? WHERE id=?', [$rating, $r['id']]);
    return ['rating' => $rating];
}

function act_send_message(array $me, array $t): array
{
    $topic = str_in('topic', 160) ?: 'Question';
    $body = str_in('body', 2000, true, 'Message');
    q("INSERT INTO messages (tenant_id, direction, subject, body, created_at) VALUES (?, 'to_admin', ?, ?, ?)",
      [$t['id'], $topic, $body, now()]);
    notify_admins('', 'teal', 'message', 'Message from ' . $t['name'] . ' — ' . $topic,
        mb_substr($body, 0, 400), 'renters.html?tenant=' . $t['id']);
    log_activity($me, 'Sent message', $topic);
    return [];
}

function act_mark_notices_read(array $me, array $t): array
{
    $id = int_in('id');
    if ($id) q('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [$id, $me['id']]);
    else q('UPDATE notifications SET is_read=1 WHERE user_id=?', [$me['id']]);
    return [];
}

function act_update_contact(array $me, array $t): array
{
    $phone = str_in('phone', 40, true, 'Mobile number');
    q('UPDATE tenants SET phone=?, emergency_name=?, emergency_relation=?, emergency_phone=? WHERE id=?',
      [$phone, str_in('emergencyName', 120), str_in('emergencyRelation', 40), str_in('emergencyPhone', 40), $t['id']]);
    notify_admins('', 'teal', 'user', $t['name'] . ' updated their contact details', 'Unit ' . $t['unit_id'], 'renters.html?tenant=' . $t['id']);
    return [];
}
