<?php
/* ============================================================
   lib.php — shared plumbing for every endpoint:
   database access, JSON in/out, sessions, roles, settings,
   notifications, and the billing engine (rent charges, late
   fees, applying payments to charges).
   ============================================================ */

declare(strict_types=1);

$CONFIG = require __DIR__ . '/config.php';
date_default_timezone_set($CONFIG['timezone']);

ini_set('display_errors', '0');
error_reporting(E_ALL);

set_exception_handler(function (Throwable $e) {
    error_log('[saraza] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $msg = $e instanceof PDOException
        ? 'Database error. Check that MySQL is running and the saraza_apartment database is imported.'
        : 'Server error: ' . $e->getMessage();
    json_out(['ok' => false, 'error' => $msg], 500);
});

/* ---------------- Session ---------------- */
session_name('SARAZASESS');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

/* ---------------- Database ---------------- */
function db(): PDO
{
    static $pdo = null;
    global $CONFIG;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $CONFIG['db_host'], $CONFIG['db_port'], $CONFIG['db_name']);
        $pdo = new PDO($dsn, $CONFIG['db_user'], $CONFIG['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $pdo->exec("SET time_zone = '+08:00'");
    }
    return $pdo;
}

function q(string $sql, array $p = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($p);
    return $st;
}
function all(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }
function one(string $sql, array $p = []): ?array { $r = q($sql, $p)->fetch(); return $r === false ? null : $r; }
function val(string $sql, array $p = []) { $r = q($sql, $p)->fetchColumn(); return $r === false ? null : $r; }

/* ---------------- JSON in / out ---------------- */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $msg, int $code = 400): void { json_out(['ok' => false, 'error' => $msg], $code); }

function ok(array $extra = []): void { json_out(['ok' => true] + $extra); }

/** Request body: JSON or multipart form fields. */
function input(): array
{
    static $in = null;
    if ($in !== null) return $in;
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== false) {
        $in = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
    } else {
        $in = $_POST;
    }
    return $in;
}

function str_in(string $k, int $max = 255, bool $required = false, string $label = ''): string
{
    $v = trim((string) (input()[$k] ?? ''));
    if ($required && $v === '') fail(($label ?: ucfirst($k)) . ' is required.');
    return mb_substr($v, 0, $max);
}
function num_in(string $k, float $default = 0): float
{
    $v = input()[$k] ?? null;
    return is_numeric($v) ? (float) $v : $default;
}
function int_in(string $k, int $default = 0): int
{
    $v = input()[$k] ?? null;
    return is_numeric($v) ? (int) $v : $default;
}
function date_in(string $k, ?string $default = null): ?string
{
    $v = trim((string) (input()[$k] ?? ''));
    if ($v === '') return $default;
    $d = DateTime::createFromFormat('Y-m-d', $v);
    if (!$d || $d->format('Y-m-d') !== $v) fail('Invalid date for ' . $k . '.');
    return $v;
}
function enum_in(string $k, array $allowed, ?string $default = null): string
{
    $v = (string) (input()[$k] ?? '');
    if (in_array($v, $allowed, true)) return $v;
    if ($default !== null) return $default;
    fail('Invalid value for ' . $k . '.');
    return '';
}

/** Mutating requests must come from our own fetch() calls. */
function require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Use POST for this action.', 405);
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') fail('Bad request origin.', 403);
}

function peso($n): string { return '₱' . number_format((float) $n, ((float) $n == floor((float) $n)) ? 0 : 2); }

/* ---------------- Dates ---------------- */
function today(): string { return date('Y-m-d'); }
function now(): string { return date('Y-m-d H:i:s'); }
function days_between(string $a, string $b): int
{
    return (int) round((strtotime(substr($b, 0, 10)) - strtotime(substr($a, 0, 10))) / 86400);
}

/* ---------------- Settings ---------------- */
function settings_all(): array
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (all('SELECT skey, svalue FROM settings') as $r) $cache[$r['skey']] = $r['svalue'];
    }
    return $cache;
}
function setting(string $k, $default = null) { $s = settings_all(); return $s[$k] ?? $default; }

/* ---------------- Auth ---------------- */
function current_user(): ?array
{
    if (empty($_SESSION['uid'])) return null;

    /* idle timeout, configurable in Settings → Security (minutes, 0 = never) */
    $limit = (int) setting('session_timeout', 30);
    if ($limit > 0 && !empty($_SESSION['last_seen']) && time() - $_SESSION['last_seen'] > $limit * 60) {
        session_unset();
        return null;
    }
    $_SESSION['last_seen'] = time();

    $u = one('SELECT id, role, tenant_id, name, email, username FROM users WHERE id = ? AND is_active = 1',
        [$_SESSION['uid']]);
    return $u;
}

function require_role(string $role): array
{
    $u = current_user();
    if (!$u) fail('Your session has ended. Please sign in again.', 401);
    if ($u['role'] !== $role) fail('You do not have access to this area.', 403);
    return $u;
}

function initials_of(string $name): string
{
    $n = preg_replace('/^(Mr\.|Mrs\.|Ms\.|Engr\.|Dr\.)\s+/i', '', trim($name));
    $p = preg_split('/\s+/', $n);
    $a = mb_substr($p[0] ?? '', 0, 1);
    $b = count($p) > 1 ? mb_substr($p[count($p) - 1], 0, 1) : '';
    return mb_strtoupper($a . $b);
}
function short_name(string $name): string
{
    $p = preg_split('/\s+/', trim($name));
    if (count($p) < 2) return $name;
    return mb_substr($p[0], 0, 1) . '. ' . implode(' ', array_slice($p, 1));
}

/* ---------------- IDs ---------------- */
/** Next human-readable code, e.g. next_code('payments','PMT-',1001) => PMT-1137 */
function next_code(string $table, string $prefix, int $start, int $pad = 0): string
{
    $len = strlen($prefix) + 1;
    $max = (int) val("SELECT MAX(CAST(SUBSTRING(id, $len) AS UNSIGNED)) FROM `$table` WHERE id LIKE ?", [$prefix . '%']);
    $n = max($start, $max + 1);
    return $prefix . ($pad ? str_pad((string) $n, $pad, '0', STR_PAD_LEFT) : (string) $n);
}

/* ---------------- Activity log + notifications ---------------- */
function log_activity(?array $user, string $action, string $detail = ''): void
{
    q('INSERT INTO activity_log (user_id, user_name, action, detail, created_at) VALUES (?,?,?,?,?)',
        [$user['id'] ?? null, $user['name'] ?? 'System', $action, mb_substr($detail, 0, 500), now()]);
}

/** In-app notification. A dedupe key makes repeat alerts (e.g. "lease expiring") fire once. */
function notify(int $userId, string $tone, string $icon, string $title, string $body = '',
                string $link = '', ?string $dedupe = null): void
{
    q('INSERT IGNORE INTO notifications (user_id, tone, icon, title, body, link, dedupe_key, is_read, created_at)
       VALUES (?,?,?,?,?,?,?,0,?)', [$userId, $tone, $icon, $title, $body, $link, $dedupe, now()]);
}

/** Admin alerts respect the toggles in Settings → Notifications. */
function notify_admins(string $pref, string $tone, string $icon, string $title, string $body = '',
                       string $link = '', ?string $dedupe = null): void
{
    if ($pref !== '' && setting($pref, '1') !== '1') return;
    foreach (all("SELECT id FROM users WHERE role='admin' AND is_active=1") as $a) {
        notify((int) $a['id'], $tone, $icon, $title, $body, $link, $dedupe ? $dedupe . ':' . $a['id'] : null);
    }
}

function notify_tenant(string $tenantId, string $tone, string $icon, string $title, string $body = '',
                       string $link = '', ?string $dedupe = null): void
{
    foreach (all("SELECT id FROM users WHERE role='tenant' AND tenant_id=? AND is_active=1", [$tenantId]) as $u) {
        notify((int) $u['id'], $tone, $icon, $title, $body, $link, $dedupe);
    }
}

/* ---------------- Billing engine ---------------- */
function month_label(string $date): string { return date('F', strtotime($date)); }

function late_fee_amount(float $rent): float
{
    switch (setting('late_fee', 'none')) {
        case 'flat200': return 200;
        case 'pct2':    return round($rent * 0.02);
        case 'pct5':    return round($rent * 0.05);
        default:        return 0;
    }
}

/**
 * Keeps the books current every time someone opens the app:
 *  - creates each active lease's monthly rent charge, up to a month ahead
 *  - adds a late fee once an unpaid rent charge passes the grace period
 */
function ensure_charges(): void
{
    $dueDay  = max(1, min(28, (int) setting('rent_due_day', 5)));
    $grace   = (int) setting('grace_days', 3);
    $horizon = date('Y-m-d', strtotime(today() . ' +31 days'));

    $tenants = all("SELECT t.id, t.rent, t.move_in, t.lease_end, t.unit_id
                    FROM tenants t WHERE t.status IN ('current','notice') AND t.unit_id IS NOT NULL");

    foreach ($tenants as $t) {
        $last = val("SELECT MAX(period) FROM charges WHERE tenant_id=? AND kind='rent'", [$t['id']]);
        $period = $last
            ? date('Y-m-01', strtotime($last . ' +1 month'))
            : date('Y-m-01', strtotime($t['move_in']));

        for ($guard = 0; $guard < 36; $guard++) {
            $due = date('Y-m-', strtotime($period)) . str_pad((string) $dueDay, 2, '0', STR_PAD_LEFT);
            if ($due > $horizon) break;
            if ($t['lease_end'] && $period > $t['lease_end']) break;
            if ($due >= $t['move_in']) {
                q("INSERT IGNORE INTO charges (tenant_id, kind, label, detail, period, amount, amount_paid, due_date, status, created_at)
                   VALUES (?, 'rent', ?, ?, ?, ?, 0, ?, 'unpaid', ?)",
                  [$t['id'], month_label($period) . ' rent', 'Monthly rent for Unit ' . $t['unit_id'],
                   $period, $t['rent'], $due, now()]);
            }
            $period = date('Y-m-01', strtotime($period . ' +1 month'));
        }
    }

    /* late fees */
    $cutoff = date('Y-m-d', strtotime(today() . " -$grace days"));
    $late = all("SELECT c.tenant_id, c.period, c.amount, t.rent FROM charges c JOIN tenants t ON t.id = c.tenant_id
                 WHERE c.kind='rent' AND c.status <> 'paid' AND c.due_date < ? AND t.status IN ('current','notice')
                 AND NOT EXISTS (SELECT 1 FROM charges f WHERE f.tenant_id=c.tenant_id AND f.kind='late_fee' AND f.period=c.period)",
                [$cutoff]);
    foreach ($late as $c) {
        $fee = late_fee_amount((float) $c['rent']);
        if ($fee <= 0) continue;
        q("INSERT IGNORE INTO charges (tenant_id, kind, label, detail, period, amount, amount_paid, due_date, status, created_at)
           VALUES (?, 'late_fee', ?, ?, ?, ?, 0, ?, 'unpaid', ?)",
          [$c['tenant_id'], 'Late fee — ' . month_label($c['period']) . ' rent',
           'Charged after the ' . $grace . '-day grace period', $c['period'], $fee, today(), now()]);
    }
}

/**
 * Allocates a cleared payment to the tenant's charges. A specific charge (if the
 * tenant picked one) is paid first, then the oldest unpaid charges in due-date order.
 */
function apply_payment(string $paymentId): void
{
    $p = one('SELECT * FROM payments WHERE id=?', [$paymentId]);
    if (!$p || $p['status'] !== 'cleared' || (int) $p['applied']) return;

    $left = (float) $p['amount'];
    $order = all("SELECT id, amount, amount_paid FROM charges WHERE tenant_id=? AND status <> 'paid'
                  ORDER BY (id = ?) DESC, due_date, id", [$p['tenant_id'], (int) ($p['charge_id'] ?? 0)]);

    foreach ($order as $c) {
        if ($left <= 0) break;
        $owed = (float) $c['amount'] - (float) $c['amount_paid'];
        $pay = min($owed, $left);
        $left -= $pay;
        $paid = (float) $c['amount_paid'] + $pay;
        $status = $paid + 0.001 >= (float) $c['amount'] ? 'paid' : 'partial';
        q('UPDATE charges SET amount_paid=?, status=?, paid_on=? WHERE id=?',
          [$paid, $status, $status === 'paid' ? $p['paid_on'] : null, $c['id']]);
    }
    q('UPDATE payments SET applied=1, unapplied=? WHERE id=?', [max(0, $left), $paymentId]);
}

/** Outstanding balance on charges already due, and how late the oldest one is. */
function tenant_balance(string $tenantId): array
{
    $r = one("SELECT COALESCE(SUM(amount - amount_paid),0) AS bal, MIN(due_date) AS oldest
              FROM charges WHERE tenant_id=? AND status <> 'paid' AND due_date <= ?", [$tenantId, today()]);
    $bal = round((float) $r['bal'], 2);
    return ['balance' => $bal, 'overdueDays' => $bal > 0 && $r['oldest'] ? max(0, days_between($r['oldest'], today())) : 0];
}

/* ---------------- Uploads ---------------- */
function save_upload(array $file, string $sub, array $allowPrefixes): array
{
    global $CONFIG;
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('Upload failed for ' . ($file['name'] ?? 'file') . '.');
    if ($file['size'] > $CONFIG['max_upload_mb'] * 1024 * 1024) fail($file['name'] . ' is larger than ' . $CONFIG['max_upload_mb'] . ' MB.');

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
    $okType = false;
    foreach ($allowPrefixes as $pre) if (strpos($mime, $pre) === 0) $okType = true;
    if (!$okType) fail($file['name'] . ' is not an accepted file type.');

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $ext = preg_replace('/[^a-z0-9]/', '', $ext) ?: 'bin';
    $dir = $CONFIG['upload_dir'] . '/' . $sub;
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) fail('Could not store ' . $file['name'] . '.');

    return [
        'path' => $sub . '/' . $name,
        'name' => mb_substr(basename($file['name']), 0, 160),
        'kind' => strpos($mime, 'video/') === 0 ? 'video' : 'photo',
        'mime' => $mime,
    ];
}

/** Normalises $_FILES['x'] (single or multiple) into a list. */
function files_list(string $key): array
{
    if (empty($_FILES[$key])) return [];
    $f = $_FILES[$key];
    if (!is_array($f['name'])) return $f['error'] === UPLOAD_ERR_NO_FILE ? [] : [$f];
    $out = [];
    foreach ($f['name'] as $i => $n) {
        if ($f['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        $out[] = ['name' => $n, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i],
                  'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    }
    return $out;
}

/* ---------------- Shared lookups ---------------- */
function categories(): array
{
    return array_map(fn($c) => ['key' => $c['ckey'], 'label' => $c['label'], 'icon' => $c['icon']],
        all('SELECT ckey, label, icon FROM categories ORDER BY sort_order'));
}

function payment_methods(): array
{
    return array_map(fn($m) => ['key' => $m['mkey'], 'label' => $m['label'], 'icon' => $m['icon'], 'detail' => $m['detail']],
        all('SELECT mkey, label, icon, detail FROM payment_methods WHERE is_active=1 ORDER BY sort_order'));
}

/** Notification rows shaped for the bell menu. */
function notifications_for(int $userId, int $limit = 30): array
{
    $rows = all('SELECT id, tone, icon, title, body, link, is_read, created_at FROM notifications
                 WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT ' . (int) $limit, [$userId]);
    return array_map(fn($n) => [
        'id' => (int) $n['id'], 'tone' => $n['tone'], 'icon' => $n['icon'], 'title' => $n['title'],
        'body' => $n['body'], 'link' => $n['link'], 'unread' => !(int) $n['is_read'], 'at' => $n['created_at'],
    ], $rows);
}

/** Five-step progress tracker shown to tenants for each request. */
function request_timeline(array $r): array
{
    $assignee = $r['assignee'] ?: null;
    $steps = [
        ['label' => 'Request submitted', 'when' => $r['created_at'], 'note' => '', 'done' => true],
        ['label' => 'Received by admin', 'when' => $r['received_at'],
         'note' => $r['received_at'] ? 'Acknowledged by the property office.' : 'Usually within a few hours.',
         'done' => (bool) $r['received_at']],
        ['label' => $assignee ? 'Assigned to ' . $assignee : 'Assigned', 'when' => $r['assigned_at'],
         'note' => $r['scheduled_for'] ? 'Visit set for ' . date('d M Y', strtotime($r['scheduled_for'])) . '.' : '',
         'done' => (bool) $r['assigned_at']],
        ['label' => 'Repair in progress', 'when' => $r['started_at'], 'note' => '', 'done' => (bool) $r['started_at']],
        ['label' => 'Marked resolved', 'when' => $r['resolved_at'],
         'note' => $r['resolved_at'] ? trim(($r['resolution'] ?? '') . ($r['rating'] ? ' You rated this ' . $r['rating'] . '/5.' : '')) : '',
         'done' => (bool) $r['resolved_at']],
    ];
    return $steps;
}
