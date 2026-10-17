<?php
/* ============================================================
   admin.php — everything the admin console reads and writes.

   GET  admin.php                  full dataset for the console (window.DB)
   GET  admin.php?action=activity  recent activity log
   GET  admin.php?action=export    JSON backup download
   POST admin.php?action=<name>    one of the actions in $ACTIONS below
   ============================================================ */
require __DIR__ . '/lib.php';

$ME = require_role('admin');
$action = $_GET['action'] ?? 'bootstrap';

/* ============================================================
   Reads
   ============================================================ */
if ($action === 'bootstrap') {
    ensure_charges();
    admin_alerts();
    json_out(['ok' => true, 'data' => bootstrap($ME)]);
}

if ($action === 'activity') {
    $rows = all('SELECT user_name, action, detail, created_at FROM activity_log ORDER BY id DESC LIMIT 150');
    ok(['rows' => $rows]);
}

if ($action === 'export') {
    $tables = ['settings', 'buildings', 'unit_types', 'units', 'tenants', 'charges', 'payments', 'expenses',
               'categories', 'maintenance_requests', 'maintenance_media', 'staff', 'payment_methods',
               'messages', 'report_log'];
    $dump = ['exported_at' => now(), 'property' => setting('property_name')];
    foreach ($tables as $t) $dump[$t] = all("SELECT * FROM `$t`");
    $dump['users'] = all('SELECT id, role, tenant_id, name, username, email, is_active, last_login_at, created_at FROM users');
    log_activity($ME, 'Exported data', 'Full JSON backup');
    q("INSERT INTO settings (skey, svalue) VALUES ('last_export', ?) ON DUPLICATE KEY UPDATE svalue=VALUES(svalue)", [now()]);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="saraza-backup-' . date('Ymd-His') . '.json"');
    echo json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

/* ============================================================
   Writes
   ============================================================ */
require_post();

$ACTIONS = [
    'record_payment', 'confirm_payment', 'reject_payment', 'add_charge', 'void_charge',
    'add_tenant', 'update_tenant', 'move_out', 'reset_password', 'import_tenants',
    'add_unit', 'update_unit', 'delete_unit',
    'add_ticket', 'update_ticket',
    'send_reminder', 'remind_all', 'message_tenant', 'mark_notifications_read',
    'save_settings', 'save_methods', 'add_building', 'update_building',
    'add_staff', 'update_staff', 'delete_staff', 'add_expense', 'delete_expense',
    'clear_report_log', 'delete_property',
];
if (!in_array($action, $ACTIONS, true)) fail('Unknown action.', 404);

db()->beginTransaction();
$result = ('act_' . $action)($ME);
db()->commit();
ok($result ?: []);

/* ============================================================
   Bootstrap
   ============================================================ */
function bootstrap(array $me): array
{
    $today = today();

    $buildings = array_map(fn($b) => ['id' => $b['id'], 'name' => $b['name'], 'floors' => (int) $b['floors'],
        'address' => $b['address']], all('SELECT * FROM buildings ORDER BY id'));

    $types = array_map(fn($t) => ['key' => $t['tkey'], 'label' => $t['label'], 'beds' => (int) $t['beds'],
        'size' => (float) $t['size_sqm'], 'rent' => (float) $t['base_rent']], all('SELECT * FROM unit_types ORDER BY sort_order'));
    $typeOf = array_column($types, null, 'key');

    $tenantRows = all("SELECT * FROM tenants WHERE status <> 'moved_out' ORDER BY id");
    $logins = array_flip(array_column(all("SELECT tenant_id FROM users WHERE role='tenant' AND is_active=1"), 'tenant_id'));
    $unitTenant = [];
    $tenants = [];
    foreach ($tenantRows as $t) {
        $bal = tenant_balance($t['id']);
        $unit = $t['unit_id'] ? one('SELECT building_id FROM units WHERE id=?', [$t['unit_id']]) : null;
        $unitTenant[$t['unit_id']] = $t['id'];
        $status = $t['status'] === 'notice' ? 'notice' : ($bal['balance'] > 0 ? 'overdue' : 'current');
        $tenants[] = [
            'id' => $t['id'], 'name' => $t['name'], 'short' => short_name($t['name']), 'initials' => initials_of($t['name']),
            'unitId' => $t['unit_id'], 'unitNo' => $t['unit_id'] ?: '—', 'buildingId' => $unit['building_id'] ?? null,
            'phone' => $t['phone'], 'email' => $t['email'], 'occupation' => $t['occupation'] ?: '—',
            'moveIn' => $t['move_in'], 'leaseEnd' => $t['lease_end'], 'rent' => (float) $t['rent'],
            'deposit' => (float) $t['deposit'], 'advance' => (float) $t['advance'],
            'balance' => $bal['balance'], 'overdueDays' => $bal['overdueDays'], 'occupants' => (int) $t['occupants'],
            'emergency' => trim($t['emergency_name'] . ($t['emergency_relation'] ? ' (' . $t['emergency_relation'] . ')' : '') .
                               ($t['emergency_phone'] ? ' · ' . $t['emergency_phone'] : '')) ?: '—',
            'emergencyName' => $t['emergency_name'], 'emergencyRelation' => $t['emergency_relation'],
            'emergencyPhone' => $t['emergency_phone'], 'contractNo' => $t['contract_no'],
            'status' => $status, 'leaseStatus' => $t['status'], 'hasLogin' => isset($logins[$t['id']]),
        ];
    }

    $units = array_map(function ($u) use ($typeOf, $unitTenant) {
        $t = $typeOf[$u['type_key']] ?? ['label' => $u['type_key'], 'beds' => 0];
        return [
            'id' => $u['id'], 'no' => $u['id'], 'buildingId' => $u['building_id'], 'floor' => (int) $u['floor'],
            'typeKey' => $u['type_key'], 'type' => $t['label'], 'beds' => $t['beds'], 'size' => (float) $u['size_sqm'],
            'bathrooms' => (int) $u['bathrooms'], 'furnishing' => $u['furnishing'], 'rent' => (float) $u['rent'],
            'status' => $u['status'], 'notes' => $u['notes'], 'vacantSince' => $u['vacant_since'],
            'tenantId' => $unitTenant[$u['id']] ?? null,
        ];
    }, all('SELECT * FROM units ORDER BY building_id, floor, id'));

    $names = array_column(all('SELECT id, name FROM tenants'), 'name', 'id');
    $payments = array_map(fn($p) => [
        'id' => $p['id'], 'tenantId' => $p['tenant_id'], 'tenantName' => short_name($names[$p['tenant_id']] ?? '—'),
        'fullName' => $names[$p['tenant_id']] ?? '—', 'initials' => initials_of($names[$p['tenant_id']] ?? '?'),
        'unitNo' => $p['unit_id'] ?: '—', 'date' => $p['paid_on'], 'method' => $p['method'], 'covers' => $p['covers'],
        'amount' => (float) $p['amount'], 'status' => $p['status'], 'reference' => $p['reference'] ?: '—',
        'notes' => $p['notes'], 'proof' => $p['proof_path'] ? 'api/file.php?payment=' . rawurlencode($p['id']) : null,
        'recordedBy' => $p['recorded_by'], 'submittedBy' => $p['submitted_by'], 'createdAt' => $p['created_at'],
    ], all('SELECT * FROM payments ORDER BY paid_on DESC, created_at DESC, id DESC'));

    $charges = array_map(fn($c) => [
        'id' => (int) $c['id'], 'tenantId' => $c['tenant_id'], 'kind' => $c['kind'], 'label' => $c['label'],
        'detail' => $c['detail'], 'amount' => (float) $c['amount'], 'paid' => (float) $c['amount_paid'],
        'due' => $c['due_date'], 'status' => $c['status'],
    ], all("SELECT * FROM charges WHERE status <> 'paid' ORDER BY due_date, id"));

    $cats = categories();
    $catOf = array_column($cats, null, 'key');
    $media = [];
    foreach (all('SELECT * FROM maintenance_media ORDER BY id') as $m) {
        $media[$m['request_id']][] = ['kind' => $m['kind'], 'name' => $m['file_name'],
            'url' => $m['file_path'] ? 'api/file.php?media=' . $m['id'] : null];
    }
    $units_b = array_column($units, 'buildingId', 'id');
    $tickets = array_map(function ($r) use ($catOf, $names, $media, $units_b, $today) {
        $c = $catOf[$r['category']] ?? ['label' => $r['category'], 'icon' => 'wrench'];
        $tn = $r['tenant_id'] ? ($names[$r['tenant_id']] ?? null) : null;
        return [
            'id' => $r['id'], 'title' => $r['title'], 'unitId' => $r['unit_id'], 'unitNo' => $r['unit_id'],
            'buildingId' => $units_b[$r['unit_id']] ?? null, 'tenantId' => $r['tenant_id'],
            'tenantName' => $tn ? short_name($tn) : 'Common area', 'initials' => $tn ? initials_of($tn) : 'CA',
            'category' => $r['category'], 'categoryLabel' => $c['label'], 'categoryIcon' => $c['icon'],
            'priority' => $r['priority'], 'status' => $r['status'], 'created' => $r['created_at'],
            'ageDays' => max(0, days_between($r['created_at'], $r['resolved_at'] ?: $today)),
            'assignee' => $r['assignee'], 'cost' => (float) $r['cost'], 'notes' => $r['details'] ?: '',
            'adminNotes' => $r['admin_notes'] ?: '', 'resolution' => $r['resolution'],
            'scheduledFor' => $r['scheduled_for'], 'resolved' => $r['resolved_at'], 'rating' => $r['rating'] ? (int) $r['rating'] : null,
            'allowEntry' => (bool) $r['allow_entry'], 'followUps' => (int) $r['follow_ups'],
            'media' => $media[$r['id']] ?? [],
        ];
    }, all('SELECT * FROM maintenance_requests ORDER BY created_at DESC'));

    /* twelve-month money series (the console shows the last 6 by default) */
    $monthly = []; $expenseTrend = [];
    for ($i = 11; $i >= 0; $i--) {
        $start = date('Y-m-01', strtotime(date('Y-m-01') . " -$i months"));
        $end = date('Y-m-t', strtotime($start));
        $monthly[] = [
            'month' => date('M', strtotime($start)), 'start' => $start,
            'expected' => (float) val("SELECT COALESCE(SUM(amount),0) FROM charges WHERE due_date BETWEEN ? AND ?
                                       AND kind IN ('rent','utility','late_fee','other')", [$start, $end]),
            'collected' => (float) val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='cleared' AND paid_on BETWEEN ? AND ?",
                                       [$start, $end]),
        ];
        $expenseTrend[] = [
            'month' => date('M', strtotime($start)),
            'amount' => (float) val('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN ? AND ?', [$start, $end])
                      + (float) val("SELECT COALESCE(SUM(cost),0) FROM maintenance_requests WHERE status='done'
                                     AND DATE(resolved_at) BETWEEN ? AND ?", [$start, $end]),
        ];
    }

    $staff = array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'role' => $s['role'], 'email' => $s['email'],
        'phone' => $s['phone'], 'isCrew' => (bool) $s['is_crew'], 'lastActive' => $s['last_active'],
        'isMe' => (int) $s['user_id'] === (int) $me['id']], all('SELECT * FROM staff ORDER BY id'));

    $methods = payment_methods();
    $allMethods = array_map(fn($m) => ['key' => $m['mkey'], 'label' => $m['label'], 'icon' => $m['icon'],
        'detail' => $m['detail'], 'active' => (bool) $m['is_active']], all('SELECT * FROM payment_methods ORDER BY sort_order'));

    $s = settings_all();
    unset($s['_']);

    return [
        'today' => $today,
        'me' => ['id' => (int) $me['id'], 'name' => $me['name'], 'email' => $me['email'], 'username' => $me['username'],
                 'initials' => initials_of($me['name']), 'role' => 'Administrator'],
        'settings' => $s,
        'buildings' => $buildings,
        'unitTypes' => $types,
        'units' => $units,
        'tenants' => $tenants,
        'payments' => $payments,
        'charges' => $charges,
        'tickets' => $tickets,
        'categories' => array_values(array_filter($cats, fn($c) => true)),
        'crew' => array_column(array_filter($staff, fn($x) => $x['isCrew']), 'name'),
        'methods' => array_column($methods, 'label'),
        'methodList' => $allMethods,
        'monthly' => $monthly,
        'expenseTrend' => $expenseTrend,
        'expenses' => array_map(fn($e) => ['id' => (int) $e['id'], 'date' => $e['expense_date'], 'category' => $e['category'],
            'description' => $e['description'], 'amount' => (float) $e['amount']],
            all('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 60')),
        'staff' => $staff,
        'reports' => array_map(fn($r) => ['id' => (int) $r['id'], 'type' => $r['report_type'], 'name' => $r['name'],
            'period' => $r['period'], 'buildingId' => $r['building_id'], 'format' => $r['format'], 'rows' => (int) $r['rows_count'],
            'by' => $r['generated_by'], 'at' => $r['created_at']], all('SELECT * FROM report_log ORDER BY id DESC LIMIT 12')),
        'notifications' => notifications_for((int) $me['id']),
        'money' => [
            'collectedThisMonth' => $monthly[11]['collected'],
            'collectedLastMonth' => $monthly[10]['collected'],
            'expectedThisMonth'  => $monthly[11]['expected'],
            'expectedLastMonth'  => $monthly[10]['expected'],
            'target'             => (float) ($s['monthly_target'] ?? 0),
            'pendingCount'       => (int) val("SELECT COUNT(*) FROM payments WHERE status='pending'"),
            'pendingAmount'      => (float) val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='pending'"),
            'lastBackup'         => $s['last_export'] ?? null,
        ],
    ];
}

/** Turns conditions into one-time bell alerts (respects Settings → Notifications). */
function admin_alerts(): void
{
    $grace = (int) setting('grace_days', 3);
    foreach (all("SELECT id, name, unit_id FROM tenants WHERE status IN ('current','notice')") as $t) {
        $b = tenant_balance($t['id']);
        if ($b['balance'] > 0 && $b['overdueDays'] > $grace) {
            $oldest = val("SELECT MIN(due_date) FROM charges WHERE tenant_id=? AND status<>'paid'", [$t['id']]);
            notify_admins('notif_overdue', 'amber', 'clock', $t['name'] . ' is ' . $b['overdueDays'] . ' days late',
                peso($b['balance']) . ' outstanding for Unit ' . $t['unit_id'] . '.', 'renters.html?tenant=' . $t['id'],
                'overdue:' . $t['id'] . ':' . $oldest);
        }
    }
    foreach (all("SELECT id, title, unit_id, created_at FROM maintenance_requests
                  WHERE priority='urgent' AND status='new' AND (assignee IS NULL OR assignee='') AND created_at < ?",
                 [date('Y-m-d H:i:s', time() - 86400)]) as $r) {
        notify_admins('notif_urgent', 'red', 'alert', 'Urgent repair unassigned — Unit ' . $r['unit_id'],
            $r['title'] . ' has waited ' . days_between($r['created_at'], today()) . ' days.',
            'maintenance.html?ticket=' . $r['id'], 'urgent:' . $r['id']);
    }
    foreach (all("SELECT id, name, unit_id, lease_end FROM tenants WHERE status IN ('current','notice')
                  AND lease_end BETWEEN ? AND ?", [today(), date('Y-m-d', strtotime('+60 days'))]) as $t) {
        notify_admins('notif_lease', 'teal', 'idCard', 'Lease ends in ' . days_between(today(), $t['lease_end']) . ' days',
            $t['name'] . ' (Unit ' . $t['unit_id'] . ') — lease ends ' . date('d M Y', strtotime($t['lease_end'])) . '.',
            'renters.html?tenant=' . $t['id'], 'lease:' . $t['id'] . ':' . $t['lease_end']);
    }
}

/* ============================================================
   Helpers
   ============================================================ */
function tenant_or_fail(string $id): array
{
    $t = one("SELECT * FROM tenants WHERE id=? AND status <> 'moved_out'", [$id]);
    if (!$t) fail('That tenant could not be found.');
    return $t;
}

function method_or_fail(string $label): string
{
    if (!val('SELECT 1 FROM payment_methods WHERE label=?', [$label])) fail('Choose a valid payment method.');
    return $label;
}

function temp_password(): string
{
    $words = ['Mabini', 'Rizal', 'Bonifacio', 'Luna', 'Silang', 'Jacinto', 'Aguinaldo', 'Tandang'];
    return $words[random_int(0, count($words) - 1)] . random_int(1000, 9999);
}

/** Shared by add_tenant and the CSV import. Returns [tenantId, tempPassword|null]. */
function create_tenant(array $d, array $me): array
{
    $u = one('SELECT * FROM units WHERE id=?', [$d['unit_id']]);
    if (!$u) fail('Unit ' . $d['unit_id'] . ' does not exist.');
    if ($u['status'] !== 'vacant') fail('Unit ' . $u['id'] . ' is not vacant.');
    if (val("SELECT 1 FROM tenants WHERE unit_id=? AND status<>'moved_out'", [$u['id']])) fail('Unit ' . $u['id'] . ' already has a tenant.');

    $email = strtolower(trim($d['email']));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address for ' . $d['name'] . '.');
    if ($d['login'] && $email === '') fail('An email is needed so ' . $d['name'] . ' can sign in to the tenant portal.');
    if ($email !== '' && val('SELECT 1 FROM users WHERE email=?', [$email])) fail('The email ' . $email . ' is already used by another account.');

    $id = next_code('tenants', 'T', 1, 3);
    $rent = $d['rent'] > 0 ? $d['rent'] : (float) $u['rent'];
    $deposit = $d['deposit'] >= 0 ? $d['deposit'] : $rent * (int) setting('deposit_months', 2);
    $leaseEnd = date('Y-m-d', strtotime($d['move_in'] . ' +' . $d['lease_months'] . ' months -1 day'));

    q("INSERT INTO tenants (id, unit_id, name, phone, email, occupation, occupants, emergency_name, emergency_relation,
        emergency_phone, contract_no, move_in, lease_end, rent, deposit, advance, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'current', ?)",
      [$id, $u['id'], $d['name'], $d['phone'], $email, $d['occupation'], $d['occupants'], $d['emergency_name'],
       $d['emergency_relation'], $d['emergency_phone'], 'LSE-' . date('Y', strtotime($d['move_in'])) . '-' . substr($id, 1),
       $d['move_in'], $leaseEnd, $rent, $deposit, $rent * (int) setting('advance_months', 1), now()]);
    q("UPDATE units SET status='occupied', vacant_since=NULL WHERE id=?", [$u['id']]);

    if (!empty($d['bill_deposit']) && $deposit > 0) {
        q("INSERT INTO charges (tenant_id, kind, label, detail, period, amount, amount_paid, due_date, status, created_at)
           VALUES (?, 'deposit', 'Security deposit', ?, NULL, ?, 0, ?, 'unpaid', ?)",
          [$id, 'Refundable deposit for Unit ' . $u['id'], $deposit, $d['move_in'], now()]);
    }

    $pass = null;
    if ($d['login']) {
        $pass = $d['password'] !== '' ? $d['password'] : temp_password();
        q("INSERT INTO users (role, tenant_id, name, email, password_hash, is_active, created_at)
           VALUES ('tenant', ?, ?, ?, ?, 1, ?)", [$id, $d['name'], $email, password_hash($pass, PASSWORD_DEFAULT), now()]);
        notify_tenant($id, 'teal', 'home', 'Welcome to ' . setting('property_name', 'the apartment'),
            'Your lease for Unit ' . $u['id'] . ' starts ' . date('d M Y', strtotime($d['move_in'])) . '.', 'rental.html');
    }
    log_activity($me, 'Added tenant', $d['name'] . ' → Unit ' . $u['id']);
    return [$id, $pass];
}

/* ============================================================
   Payments & charges
   ============================================================ */
function act_record_payment(array $me): array
{
    $t = tenant_or_fail(str_in('tenantId', 8, true, 'Tenant'));
    $amount = round(num_in('amount'), 2);
    if ($amount <= 0) fail('Enter an amount greater than zero.');
    $method = method_or_fail(str_in('method', 40, true, 'Method'));
    $id = next_code('payments', 'PMT-', 1001);

    q("INSERT INTO payments (id, tenant_id, unit_id, charge_id, paid_on, method, covers, amount, reference, notes, status,
        submitted_by, recorded_by, applied, created_at, cleared_at)
       VALUES (?,?,?,NULL,?,?,?,?,?,?, 'cleared', 'admin', ?, 0, ?, ?)",
      [$id, $t['id'], $t['unit_id'], date_in('date', today()), $method, str_in('covers', 120) ?: 'Rent',
       $amount, str_in('reference', 80), str_in('notes', 255), $me['name'], now(), now()]);
    apply_payment($id);

    if (setting('notify_tenant_on_clear', '1') === '1') {
        notify_tenant($t['id'], 'green', 'check', 'Payment received — ' . peso($amount),
            'Thank you. Receipt ' . $id . ' is in your Payment History.', 'payments.html?receipt=' . $id);
    }
    log_activity($me, 'Recorded payment', $id . ' · ' . peso($amount) . ' from ' . $t['name']);
    return ['id' => $id, 'balance' => tenant_balance($t['id'])['balance']];
}

function act_confirm_payment(array $me): array
{
    $p = one('SELECT * FROM payments WHERE id=?', [str_in('id', 12, true)]);
    if (!$p) fail('Payment not found.');
    if ($p['status'] !== 'pending') fail('Only pending payments can be confirmed.');
    q("UPDATE payments SET status='cleared', cleared_at=?, recorded_by=? WHERE id=?", [now(), $me['name'], $p['id']]);
    apply_payment($p['id']);
    if (setting('notify_tenant_on_clear', '1') === '1') {
        notify_tenant($p['tenant_id'], 'green', 'check', 'Payment confirmed — ' . peso($p['amount']),
            $p['covers'] . ' is now marked paid. Receipt ' . $p['id'] . '.', 'payments.html?receipt=' . $p['id']);
    }
    log_activity($me, 'Confirmed payment', $p['id'] . ' · ' . peso($p['amount']));
    return ['id' => $p['id']];
}

function act_reject_payment(array $me): array
{
    $p = one('SELECT * FROM payments WHERE id=?', [str_in('id', 12, true)]);
    if (!$p) fail('Payment not found.');
    if ($p['status'] !== 'pending') fail('Only pending payments can be rejected.');
    $reason = str_in('reason', 200) ?: 'The payment could not be matched to our records.';
    q("UPDATE payments SET status='rejected', notes=? WHERE id=?", [$reason, $p['id']]);
    notify_tenant($p['tenant_id'], 'red', 'alert', 'Payment not confirmed — ' . peso($p['amount']),
        $reason . ' Please check the reference number or contact the office.', 'payments.html');
    log_activity($me, 'Rejected payment', $p['id'] . ' · ' . $reason);
    return ['id' => $p['id']];
}

function act_add_charge(array $me): array
{
    $t = tenant_or_fail(str_in('tenantId', 8, true, 'Tenant'));
    /* no utility billing: every unit has its own water and electric meters */
    $kind = enum_in('kind', ['other', 'deposit']);
    $amount = round(num_in('amount'), 2);
    if ($amount <= 0) fail('Enter an amount greater than zero.');
    $label = str_in('label', 120) ?: 'Other charge';
    $due = date_in('due', today());
    q("INSERT INTO charges (tenant_id, kind, label, detail, period, amount, amount_paid, due_date, status, created_at)
       VALUES (?,?,?,?,NULL,?,0,?, 'unpaid', ?)", [$t['id'], $kind, $label, str_in('detail', 200), $amount, $due, now()]);
    notify_tenant($t['id'], 'teal', 'receipt', 'New charge: ' . $label, peso($amount) . ' due ' . date('d M Y', strtotime($due)) . '.', 'payments.html');
    log_activity($me, 'Added charge', $label . ' · ' . peso($amount) . ' for ' . $t['name']);
    return ['id' => (int) db()->lastInsertId()];
}

function act_void_charge(array $me): array
{
    $c = one('SELECT * FROM charges WHERE id=?', [int_in('id')]);
    if (!$c) fail('Charge not found.');
    if ($c['status'] === 'paid') fail('That charge is already paid.');
    if ((float) $c['amount_paid'] > 0) {
        q("UPDATE charges SET amount=amount_paid, status='paid', paid_on=? WHERE id=?", [today(), $c['id']]);
    } else {
        q('DELETE FROM charges WHERE id=?', [$c['id']]);
    }
    log_activity($me, 'Waived charge', $c['label'] . ' · ' . peso((float) $c['amount'] - (float) $c['amount_paid']));
    return [];
}

/* ============================================================
   Tenants
   ============================================================ */
function act_add_tenant(array $me): array
{
    $d = [
        'name' => str_in('name', 120, true, 'Full name'),
        'phone' => str_in('phone', 40), 'email' => str_in('email', 160), 'occupation' => str_in('occupation', 80),
        'unit_id' => str_in('unitId', 12, true, 'Unit'), 'occupants' => max(1, min(10, int_in('occupants', 1))),
        'move_in' => date_in('moveIn', today()), 'lease_months' => max(1, min(60, int_in('leaseMonths', 12))),
        'rent' => num_in('rent'), 'deposit' => num_in('deposit', -1),
        'emergency_name' => str_in('emergencyName', 120), 'emergency_relation' => str_in('emergencyRelation', 40),
        'emergency_phone' => str_in('emergencyPhone', 40),
        'login' => !empty(input()['createLogin']), 'password' => str_in('password', 80),
        'bill_deposit' => !empty(input()['billDeposit']),
    ];
    if ($d['password'] !== '' && strlen($d['password']) < 8) fail('The portal password needs at least 8 characters.');
    [$id, $pass] = create_tenant($d, $me);
    ensure_charges();
    return ['id' => $id, 'tempPassword' => $pass, 'email' => strtolower($d['email'])];
}

function act_update_tenant(array $me): array
{
    $t = tenant_or_fail(str_in('id', 8, true));
    $in = input();
    $f = [
        'name' => str_in('name', 120) ?: $t['name'],
        'phone' => array_key_exists('phone', $in) ? str_in('phone', 40) : $t['phone'],
        'email' => array_key_exists('email', $in) ? strtolower(str_in('email', 160)) : $t['email'],
        'occupation' => array_key_exists('occupation', $in) ? str_in('occupation', 80) : $t['occupation'],
        'occupants' => array_key_exists('occupants', $in) ? max(1, int_in('occupants', 1)) : (int) $t['occupants'],
        'emergency_name' => array_key_exists('emergencyName', $in) ? str_in('emergencyName', 120) : $t['emergency_name'],
        'emergency_relation' => array_key_exists('emergencyRelation', $in) ? str_in('emergencyRelation', 40) : $t['emergency_relation'],
        'emergency_phone' => array_key_exists('emergencyPhone', $in) ? str_in('emergencyPhone', 40) : $t['emergency_phone'],
        'rent' => num_in('rent', (float) $t['rent']),
        'deposit' => num_in('deposit', (float) $t['deposit']),
        'lease_end' => date_in('leaseEnd', $t['lease_end']),
        'status' => enum_in('leaseStatus', ['current', 'notice'], $t['status']),
    ];
    if ($f['email'] !== '' && !filter_var($f['email'], FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
    if ($f['email'] !== '' && val("SELECT 1 FROM users WHERE email=? AND (tenant_id IS NULL OR tenant_id<>?)", [$f['email'], $t['id']])) {
        fail('That email is already used by another account.');
    }
    if ($f['rent'] <= 0) fail('Rent must be greater than zero.');

    q('UPDATE tenants SET name=?, phone=?, email=?, occupation=?, occupants=?, emergency_name=?, emergency_relation=?,
       emergency_phone=?, rent=?, deposit=?, lease_end=?, status=? WHERE id=?',
      [$f['name'], $f['phone'], $f['email'], $f['occupation'], $f['occupants'], $f['emergency_name'], $f['emergency_relation'],
       $f['emergency_phone'], $f['rent'], $f['deposit'], $f['lease_end'], $f['status'], $t['id']]);
    if ($f['email'] !== '') q("UPDATE users SET name=?, email=? WHERE tenant_id=?", [$f['name'], $f['email'], $t['id']]);

    $created = null;
    if (!empty($in['createLogin']) && !val('SELECT 1 FROM users WHERE tenant_id=?', [$t['id']])) {
        if ($f['email'] === '') fail('Add an email first so the tenant can sign in.');
        $created = temp_password();
        q("INSERT INTO users (role, tenant_id, name, email, password_hash, is_active, created_at) VALUES ('tenant',?,?,?,?,1,?)",
          [$t['id'], $f['name'], $f['email'], password_hash($created, PASSWORD_DEFAULT), now()]);
    }
    if ($f['status'] === 'notice' && $t['status'] !== 'notice') {
        notify_tenant($t['id'], 'amber', 'idCard', 'Move-out notice recorded',
            'Your lease ends ' . date('d M Y', strtotime($f['lease_end'])) . '.', 'rental.html');
    }
    log_activity($me, 'Updated tenant', $f['name']);
    return ['id' => $t['id'], 'tempPassword' => $created];
}

function act_move_out(array $me): array
{
    $t = tenant_or_fail(str_in('id', 8, true));
    $date = date_in('date', today());
    q("UPDATE tenants SET status='moved_out', moved_out=?, unit_id=NULL WHERE id=?", [$date, $t['id']]);
    if ($t['unit_id']) q("UPDATE units SET status='vacant', vacant_since=? WHERE id=?", [$date, $t['unit_id']]);
    q("DELETE FROM charges WHERE tenant_id=? AND status='unpaid' AND amount_paid=0 AND due_date > ? AND kind IN ('rent','late_fee')",
      [$t['id'], $date]);
    q('UPDATE users SET is_active=0 WHERE tenant_id=?', [$t['id']]);
    notify_admins('notif_vacant', 'teal', 'doorOpen', 'Unit ' . $t['unit_id'] . ' is now vacant',
        $t['name'] . ' moved out on ' . date('d M Y', strtotime($date)) . '.', 'units.html?unit=' . $t['unit_id']);
    log_activity($me, 'Moved out tenant', $t['name'] . ' from Unit ' . $t['unit_id']);
    return [];
}

function act_reset_password(array $me): array
{
    $t = tenant_or_fail(str_in('id', 8, true));
    if (!val('SELECT 1 FROM users WHERE tenant_id=?', [$t['id']])) fail('This tenant has no portal account yet.');
    $pass = temp_password();
    q('UPDATE users SET password_hash=?, is_active=1 WHERE tenant_id=?', [password_hash($pass, PASSWORD_DEFAULT), $t['id']]);
    log_activity($me, 'Reset tenant password', $t['name']);
    return ['tempPassword' => $pass, 'email' => val('SELECT email FROM users WHERE tenant_id=?', [$t['id']])];
}

function act_import_tenants(array $me): array
{
    $files = files_list('file');
    if (!$files) fail('Choose a CSV file to import.');
    $fh = fopen($files[0]['tmp_name'], 'r');
    if (!$fh) fail('Could not read the file.');
    $head = array_map(fn($h) => strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h))), fgetcsv($fh) ?: []);
    $need = ['name', 'unit'];
    foreach ($need as $n) if (!in_array($n, $head, true)) fail('The CSV needs a header row with at least: name, unit.');

    $added = []; $skipped = [];
    $line = 1;
    while (($row = fgetcsv($fh)) !== false) {
        $line++;
        if (count(array_filter($row, fn($v) => trim((string) $v) !== '')) === 0) continue;
        $r = array_combine($head, array_pad(array_slice($row, 0, count($head)), count($head), ''));
        $d = [
            'name' => trim($r['name'] ?? ''), 'phone' => trim($r['phone'] ?? ''), 'email' => trim($r['email'] ?? ''),
            'occupation' => trim($r['occupation'] ?? ''), 'unit_id' => strtoupper(trim($r['unit'] ?? '')),
            'occupants' => max(1, (int) ($r['occupants'] ?? 1)),
            'move_in' => preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($r['move_in'] ?? '')) ? trim($r['move_in']) : today(),
            'lease_months' => max(1, (int) ($r['lease_months'] ?? 12) ?: 12),
            'rent' => (float) ($r['rent'] ?? 0), 'deposit' => isset($r['deposit']) && $r['deposit'] !== '' ? (float) $r['deposit'] : -1,
            'emergency_name' => trim($r['emergency_name'] ?? ''), 'emergency_relation' => '', 'emergency_phone' => trim($r['emergency_phone'] ?? ''),
            'login' => trim($r['email'] ?? '') !== '', 'password' => '', 'bill_deposit' => false,
        ];
        if ($d['name'] === '') { $skipped[] = "Line $line: missing name"; continue; }
        try {
            /* create_tenant() calls fail() on bad rows; catch by checking first */
            $u = one('SELECT status FROM units WHERE id=?', [$d['unit_id']]);
            if (!$u) { $skipped[] = "Line $line: unit {$d['unit_id']} not found"; continue; }
            if ($u['status'] !== 'vacant') { $skipped[] = "Line $line: unit {$d['unit_id']} is not vacant"; continue; }
            if ($d['email'] !== '' && (!filter_var($d['email'], FILTER_VALIDATE_EMAIL) || val('SELECT 1 FROM users WHERE email=?', [strtolower($d['email'])]))) {
                $skipped[] = "Line $line: email {$d['email']} is invalid or already used"; continue;
            }
            [$id, $pass] = create_tenant($d, $me);
            $added[] = ['id' => $id, 'name' => $d['name'], 'unit' => $d['unit_id'], 'email' => strtolower($d['email']), 'tempPassword' => $pass];
        } catch (Throwable $e) {
            $skipped[] = "Line $line: " . $e->getMessage();
        }
    }
    fclose($fh);
    ensure_charges();
    log_activity($me, 'Imported tenants', count($added) . ' added, ' . count($skipped) . ' skipped');
    return ['added' => $added, 'skipped' => $skipped];
}

/* ============================================================
   Units
   ============================================================ */
function unit_fields(?array $cur): array
{
    $type = str_in('typeKey', 16) ?: ($cur['type_key'] ?? '');
    if (!val('SELECT 1 FROM unit_types WHERE tkey=?', [$type])) fail('Choose a unit type.');
    $rent = num_in('rent', (float) ($cur['rent'] ?? 0));
    if ($rent <= 0) fail('Monthly rent must be greater than zero.');
    return [
        'type_key' => $type, 'rent' => $rent,
        'size_sqm' => num_in('size', (float) ($cur['size_sqm'] ?? (float) val('SELECT size_sqm FROM unit_types WHERE tkey=?', [$type]))),
        'bathrooms' => max(0, int_in('bathrooms', (int) ($cur['bathrooms'] ?? 1))),
        'furnishing' => str_in('furnishing', 40) ?: ($cur['furnishing'] ?? 'Unfurnished'),
        'notes' => array_key_exists('notes', input()) ? str_in('notes', 500) : ($cur['notes'] ?? ''),
    ];
}

function act_add_unit(array $me): array
{
    $id = strtoupper(str_in('id', 12, true, 'Unit number'));
    if (!preg_match('/^[A-Z0-9-]{1,12}$/', $id)) fail('Use letters, numbers, or dashes for the unit number (e.g. 305 or A205).');
    if (val('SELECT 1 FROM units WHERE id=?', [$id])) fail('Unit ' . $id . ' already exists.');
    $b = one('SELECT * FROM buildings WHERE id=?', [str_in('buildingId', 8, true, 'Building')]);
    if (!$b) fail('Choose a building.');
    $floor = max(1, int_in('floor', 1));
    if ($floor > (int) $b['floors']) q('UPDATE buildings SET floors=? WHERE id=?', [$floor, $b['id']]);
    $f = unit_fields(null);
    q("INSERT INTO units (id, building_id, floor, type_key, size_sqm, bathrooms, furnishing, rent, status, notes, vacant_since)
       VALUES (?,?,?,?,?,?,?,?, 'vacant', ?, ?)",
      [$id, $b['id'], $floor, $f['type_key'], $f['size_sqm'], $f['bathrooms'], $f['furnishing'], $f['rent'], $f['notes'], today()]);
    log_activity($me, 'Added unit', 'Unit ' . $id . ' in ' . $b['name']);
    return ['id' => $id];
}

function act_update_unit(array $me): array
{
    $u = one('SELECT * FROM units WHERE id=?', [str_in('id', 12, true)]);
    if (!$u) fail('Unit not found.');
    $f = unit_fields($u);
    $status = $u['status'];
    if (isset(input()['status']) && $u['status'] !== 'occupied') {
        $status = enum_in('status', ['vacant', 'repair']);
    }
    q('UPDATE units SET type_key=?, size_sqm=?, bathrooms=?, furnishing=?, rent=?, notes=?, status=? WHERE id=?',
      [$f['type_key'], $f['size_sqm'], $f['bathrooms'], $f['furnishing'], $f['rent'], $f['notes'], $status, $u['id']]);
    log_activity($me, 'Updated unit', 'Unit ' . $u['id']);
    return ['id' => $u['id']];
}

function act_delete_unit(array $me): array
{
    $u = one('SELECT * FROM units WHERE id=?', [str_in('id', 12, true)]);
    if (!$u) fail('Unit not found.');
    if ($u['status'] === 'occupied') fail('Move the tenant out before deleting this unit.');
    if (val('SELECT 1 FROM payments WHERE unit_id=?', [$u['id']])) fail('This unit has payment history, so it cannot be deleted. Mark it under repair instead.');
    q('DELETE FROM units WHERE id=?', [$u['id']]);
    log_activity($me, 'Deleted unit', 'Unit ' . $u['id']);
    return [];
}

/* ============================================================
   Maintenance
   ============================================================ */
function act_add_ticket(array $me): array
{
    $title = str_in('title', 160, true, 'Problem');
    $u = one('SELECT * FROM units WHERE id=?', [str_in('unitId', 12, true, 'Unit')]);
    if (!$u) fail('Choose a unit.');
    $cat = str_in('category', 16, true, 'Category');
    if (!val('SELECT 1 FROM categories WHERE ckey=?', [$cat])) fail('Choose a category.');
    $assignee = str_in('assignee', 120) ?: null;
    $tenant = val("SELECT id FROM tenants WHERE unit_id=? AND status<>'moved_out'", [$u['id']]);
    $id = next_code('maintenance_requests', 'MR-', 2041);
    q("INSERT INTO maintenance_requests (id, unit_id, tenant_id, title, details, category, priority, status, assignee,
        scheduled_for, admin_notes, created_at, received_at, assigned_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [$id, $u['id'], $tenant ?: null, $title, str_in('details', 2000), $cat,
       enum_in('priority', ['urgent', 'high', 'normal', 'low'], 'normal'), $assignee ? 'scheduled' : 'new', $assignee,
       date_in('scheduledFor'), 'Logged by ' . $me['name'] . '.', now(), now(), $assignee ? now() : null]);
    if ($tenant) {
        notify_tenant($tenant, 'teal', 'wrench', 'Repair logged for your unit', $title . ' (' . $id . ')', 'maintenance.html?request=' . $id);
    }
    log_activity($me, 'Logged request', $id . ' · ' . $title);
    return ['id' => $id];
}

function act_update_ticket(array $me): array
{
    $r = one('SELECT * FROM maintenance_requests WHERE id=?', [str_in('id', 12, true)]);
    if (!$r) fail('Request not found.');
    $in = input();
    $status = isset($in['status']) ? enum_in('status', ['new', 'scheduled', 'in-progress', 'done']) : $r['status'];
    $priority = isset($in['priority']) ? enum_in('priority', ['urgent', 'high', 'normal', 'low']) : $r['priority'];
    $assignee = array_key_exists('assignee', $in) ? (str_in('assignee', 120) ?: null) : $r['assignee'];
    $sched = array_key_exists('scheduledFor', $in) ? date_in('scheduledFor') : $r['scheduled_for'];
    $cost = isset($in['cost']) ? max(0, num_in('cost')) : (float) $r['cost'];
    $notes = array_key_exists('adminNotes', $in) ? str_in('adminNotes', 2000) : $r['admin_notes'];
    $resolution = array_key_exists('resolution', $in) ? str_in('resolution', 255) : $r['resolution'];

    $n = now();
    $received = $r['received_at'] ?: $n;
    $assigned = $assignee ? ($r['assigned_at'] && $assignee === $r['assignee'] ? $r['assigned_at'] : $n) : null;
    $started = in_array($status, ['in-progress', 'done'], true) ? ($r['started_at'] ?: $n) : null;
    $resolved = $status === 'done' ? ($r['resolved_at'] ?: $n) : null;
    if ($status === 'done' && $resolution === '') $resolution = 'Fixed' . ($assignee ? ' by ' . $assignee : '') . '.';

    q('UPDATE maintenance_requests SET status=?, priority=?, assignee=?, scheduled_for=?, cost=?, admin_notes=?, resolution=?,
       received_at=?, assigned_at=?, started_at=?, resolved_at=? WHERE id=?',
      [$status, $priority, $assignee, $sched, $cost, $notes, $resolution, $received, $assigned, $started, $resolved, $r['id']]);

    if ($r['tenant_id'] && ($status !== $r['status'] || $assignee !== $r['assignee'] || $sched !== $r['scheduled_for'])) {
        $label = ['new' => 'received', 'scheduled' => 'scheduled', 'in-progress' => 'in progress', 'done' => 'resolved'][$status];
        $body = $r['title'] . ($assignee ? ' · ' . $assignee : '') . ($sched && $status === 'scheduled' ? ' · visit ' . date('d M', strtotime($sched)) : '');
        notify_tenant($r['tenant_id'], $status === 'done' ? 'green' : 'teal', $status === 'done' ? 'check' : 'wrench',
            'Your request is ' . $label, $body, 'maintenance.html?request=' . $r['id']);
    }
    log_activity($me, 'Updated request', $r['id'] . ' → ' . $status . ($assignee ? ' (' . $assignee . ')' : ''));
    return ['id' => $r['id']];
}

/* ============================================================
   Communication
   ============================================================ */
function remind(array $t): bool
{
    $b = tenant_balance($t['id']);
    if ($b['balance'] <= 0) return false;
    notify_tenant($t['id'], 'red', 'clock', 'Reminder: ' . peso($b['balance']) . ' is due',
        'Your balance is ' . $b['overdueDays'] . ' days past due. Please settle it or contact the office.', 'payments.html');
    return true;
}

function act_send_reminder(array $me): array
{
    $t = tenant_or_fail(str_in('tenantId', 8, true));
    if (!remind($t)) fail($t['name'] . ' has no outstanding balance.');
    log_activity($me, 'Sent reminder', $t['name']);
    return [];
}

function act_remind_all(array $me): array
{
    $n = 0;
    foreach (all("SELECT * FROM tenants WHERE status IN ('current','notice')") as $t) if (remind($t)) $n++;
    log_activity($me, 'Sent reminders', $n . ' tenants');
    return ['count' => $n];
}

function act_message_tenant(array $me): array
{
    $t = tenant_or_fail(str_in('tenantId', 8, true));
    $subject = str_in('subject', 160) ?: 'Message from the office';
    $body = str_in('body', 2000, true, 'Message');
    q("INSERT INTO messages (tenant_id, direction, subject, body, created_at) VALUES (?, 'to_tenant', ?, ?, ?)",
      [$t['id'], $subject, $body, now()]);
    notify_tenant($t['id'], 'teal', 'message', $subject, $body);
    log_activity($me, 'Messaged tenant', $t['name'] . ' · ' . $subject);
    return [];
}

function act_mark_notifications_read(array $me): array
{
    $id = int_in('id');
    if ($id) q('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [$id, $me['id']]);
    else q('UPDATE notifications SET is_read=1 WHERE user_id=?', [$me['id']]);
    return [];
}

/* ============================================================
   Settings
   ============================================================ */
function act_save_settings(array $me): array
{
    $allowed = ['property_name', 'owner_name', 'contact_phone', 'contact_email', 'address', 'currency', 'timezone',
        'receipt_note', 'rent_due_day', 'grace_days', 'late_fee', 'deposit_months', 'advance_months', 'monthly_target',
        'notify_tenant_on_clear', 'notif_payment', 'notif_overdue', 'notif_maintenance', 'notif_urgent', 'notif_lease',
        'notif_vacant', 'session_timeout', 'emergency_name', 'emergency_phone', 'house_rules', 'inclusions', 'exclusions'];
    $vals = input()['values'] ?? [];
    if (!is_array($vals) || !$vals) fail('Nothing to save.');
    $saved = 0;
    foreach ($vals as $k => $v) {
        if (!in_array($k, $allowed, true)) continue;
        $v = mb_substr(trim((string) $v), 0, 4000);
        if (in_array($k, ['rent_due_day', 'grace_days', 'deposit_months', 'advance_months', 'monthly_target', 'session_timeout'], true)
            && !is_numeric($v)) fail('Enter a number for ' . str_replace('_', ' ', $k) . '.');
        if ($k === 'rent_due_day' && ((int) $v < 1 || (int) $v > 28)) fail('Rent due day must be between 1 and 28.');
        if ($k === 'late_fee' && !in_array($v, ['none', 'flat200', 'pct2', 'pct5'], true)) fail('Invalid late fee option.');
        q('INSERT INTO settings (skey, svalue) VALUES (?,?) ON DUPLICATE KEY UPDATE svalue=VALUES(svalue)', [$k, $v]);
        $saved++;
    }
    if (isset($vals['owner_name']) && trim((string) $vals['owner_name']) !== '') {
        q("UPDATE staff SET name=? WHERE role='Owner' AND user_id=?", [trim((string) $vals['owner_name']), $me['id']]);
        q('UPDATE users SET name=? WHERE id=?', [trim((string) $vals['owner_name']), $me['id']]);
    }
    log_activity($me, 'Changed settings', implode(', ', array_keys($vals)));
    return ['saved' => $saved];
}

function act_save_methods(array $me): array
{
    $list = input()['methods'] ?? [];
    if (!is_array($list)) fail('Nothing to save.');
    $active = 0;
    foreach ($list as $m) {
        if (!empty($m['active'])) $active++;
    }
    if ($active === 0) fail('Keep at least one payment method turned on.');
    foreach ($list as $m) {
        q('UPDATE payment_methods SET detail=?, is_active=? WHERE mkey=?',
          [mb_substr(trim((string) ($m['detail'] ?? '')), 0, 160), !empty($m['active']) ? 1 : 0, (string) ($m['key'] ?? '')]);
    }
    log_activity($me, 'Changed payment methods');
    return [];
}

function act_add_building(array $me): array
{
    $name = str_in('name', 80, true, 'Building name');
    $n = (int) val("SELECT MAX(CAST(SUBSTRING(id,2) AS UNSIGNED)) FROM buildings WHERE id LIKE 'B%'") + 1;
    q('INSERT INTO buildings (id, name, floors, address) VALUES (?,?,?,?)',
      ['B' . $n, $name, max(1, int_in('floors', 1)), str_in('address', 200)]);
    log_activity($me, 'Added building', $name);
    return ['id' => 'B' . $n];
}

function act_update_building(array $me): array
{
    $b = one('SELECT * FROM buildings WHERE id=?', [str_in('id', 8, true)]);
    if (!$b) fail('Building not found.');
    $floors = max(1, int_in('floors', (int) $b['floors']));
    $maxFloor = (int) val('SELECT COALESCE(MAX(floor),0) FROM units WHERE building_id=?', [$b['id']]);
    if ($floors < $maxFloor) fail('Units already exist on floor ' . $maxFloor . '.');
    q('UPDATE buildings SET name=?, floors=?, address=? WHERE id=?',
      [str_in('name', 80) ?: $b['name'], $floors, str_in('address', 200), $b['id']]);
    log_activity($me, 'Updated building', $b['name']);
    return [];
}

function act_add_staff(array $me): array
{
    $name = str_in('name', 120, true, 'Name');
    $role = enum_in('role', ['Administrator', 'Caretaker', 'Maintenance', 'Contractor']);
    $email = strtolower(str_in('email', 160));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
    $crew = $role !== 'Administrator' || !empty(input()['isCrew']);
    $userId = null; $pass = null;
    if ($role === 'Administrator') {
        if ($email === '') fail('An administrator needs an email to sign in.');
        if (val('SELECT 1 FROM users WHERE email=?', [$email])) fail('That email already has an account.');
        $pass = temp_password();
        q("INSERT INTO users (role, name, email, password_hash, is_active, created_at) VALUES ('admin',?,?,?,1,?)",
          [$name, $email, password_hash($pass, PASSWORD_DEFAULT), now()]);
        $userId = (int) db()->lastInsertId();
    }
    q('INSERT INTO staff (user_id, name, role, email, phone, is_crew) VALUES (?,?,?,?,?,?)',
      [$userId, $name, $role, $email, str_in('phone', 40), $crew ? 1 : 0]);
    log_activity($me, 'Added staff', $name . ' (' . $role . ')');
    return ['tempPassword' => $pass, 'email' => $email];
}

function act_update_staff(array $me): array
{
    $s = one('SELECT * FROM staff WHERE id=?', [int_in('id')]);
    if (!$s) fail('Person not found.');
    $role = $s['role'] === 'Owner' ? 'Owner' : enum_in('role', ['Administrator', 'Caretaker', 'Maintenance', 'Contractor'], $s['role']);
    $email = array_key_exists('email', input()) ? strtolower(str_in('email', 160)) : $s['email'];
    q('UPDATE staff SET name=?, role=?, email=?, phone=?, is_crew=? WHERE id=?',
      [str_in('name', 120) ?: $s['name'], $role, $email, str_in('phone', 40),
       $role === 'Owner' ? (int) $s['is_crew'] : (!empty(input()['isCrew']) || $role !== 'Administrator' ? 1 : 0), $s['id']]);
    if ($s['user_id']) q('UPDATE users SET name=? WHERE id=?', [str_in('name', 120) ?: $s['name'], $s['user_id']]);
    log_activity($me, 'Updated staff', $s['name']);
    return [];
}

function act_delete_staff(array $me): array
{
    $s = one('SELECT * FROM staff WHERE id=?', [int_in('id')]);
    if (!$s) fail('Person not found.');
    if ($s['role'] === 'Owner') fail('The owner cannot be removed.');
    if ((int) $s['user_id'] === (int) $me['id']) fail('You cannot remove yourself.');
    if ($s['user_id']) q('UPDATE users SET is_active=0 WHERE id=?', [$s['user_id']]);
    q('DELETE FROM staff WHERE id=?', [$s['id']]);
    log_activity($me, 'Removed staff', $s['name']);
    return [];
}

function act_add_expense(array $me): array
{
    $amount = round(num_in('amount'), 2);
    if ($amount <= 0) fail('Enter an amount greater than zero.');
    q('INSERT INTO expenses (expense_date, category, description, amount, created_at) VALUES (?,?,?,?,?)',
      [date_in('date', today()), str_in('category', 60, true, 'Category'), str_in('description', 200), $amount, now()]);
    log_activity($me, 'Added expense', str_in('category', 60) . ' · ' . peso($amount));
    return [];
}

function act_delete_expense(array $me): array
{
    q('DELETE FROM expenses WHERE id=?', [int_in('id')]);
    log_activity($me, 'Deleted expense', '#' . int_in('id'));
    return [];
}

function act_clear_report_log(array $me): array
{
    q('DELETE FROM report_log');
    log_activity($me, 'Cleared report history');
    return [];
}

function act_delete_property(array $me): array
{
    if (str_in('confirm', 10) !== 'DELETE') fail('Type DELETE to confirm.');
    $hash = val('SELECT password_hash FROM users WHERE id=?', [$me['id']]);
    if (!password_verify((string) (input()['password'] ?? ''), $hash)) fail('Your password is not correct.');
    foreach (['maintenance_media', 'maintenance_requests', 'payments', 'charges', 'messages', 'report_log', 'expenses'] as $t) {
        q("DELETE FROM `$t`");
    }
    q("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role='tenant')");
    q("DELETE FROM users WHERE role='tenant'");
    q('DELETE FROM tenants');
    q('DELETE FROM units');
    q('DELETE FROM buildings');
    log_activity($me, 'Deleted property data', 'All units, tenants, payments and requests removed');
    return [];
}
