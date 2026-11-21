<?php
/* ============================================================
   health.php — "is the database set up?" check.

   GET /api/health.php
     200 { ok: true,  database: "connected", ... }
     503 { ok: false, problem: "...", hint: "..." }

   Used after setting up the database (docs/DATABASE_SETUP.md).
   It never prints host names, users, or passwords: connection
   errors are reduced to a short hint.
   ============================================================ */
define('SARAZA_NO_SESSION', true);
require __DIR__ . '/lib.php';

const REQUIRED_TABLES = [
    'settings', 'buildings', 'unit_types', 'units', 'tenants', 'users', 'staff',
    'payment_methods', 'charges', 'payments', 'expenses', 'categories',
    'maintenance_requests', 'maintenance_media', 'notifications', 'messages',
    'activity_log', 'report_log', 'sessions', 'uploads',
];

function health_fail(string $problem, string $hint): void
{
    json_out(['ok' => false, 'problem' => $problem, 'hint' => $hint], 503);
}

try {
    db();
} catch (RuntimeException $e) {
    if ($e instanceof PDOException) {
        $code = preg_match('/\[(\d{4})\]/', $e->getMessage(), $m) ? (int) $m[1] : 0;
        $msg  = strtolower($e->getMessage());
        switch (true) {
        case $code === 1045:
            health_fail('Access denied', 'Check SARAZA_DB_USER and SARAZA_DB_PASS (TiDB Cloud users look like "xxxx.root").');
        case $code === 1049:
            health_fail('Database not found', 'Import database/saraza_apartment.sql, or set SARAZA_DB_NAME to the database you imported into.');
        case $code === 1044:
            health_fail('No access to the database', 'The user exists but cannot open SARAZA_DB_NAME. Grant it access or use the provider\'s admin user.');
        case str_contains($msg, 'ssl') || str_contains($msg, 'tls') || str_contains($msg, 'certificate')
            || str_contains($msg, 'insecure transport') || $code === 3159 || $code === 2026:
            health_fail('TLS problem', 'Set SARAZA_DB_SSL=1. If the provider has its own CA (e.g. Aiven), paste it into SARAZA_DB_SSL_CA_PEM.');
        case in_array($code, [2002, 2003, 2005, 2006, 2013], true):
            health_fail('Cannot reach the database server', 'Check SARAZA_DB_HOST and SARAZA_DB_PORT, and that the provider allows connections from anywhere (0.0.0.0/0).');
        default:
            error_log('[saraza] health: ' . $e->getMessage());
            health_fail('Database connection failed', 'See the function logs in Vercel (Project → Logs) for the exact error.');
        }
    }
    health_fail('TLS problem', $e->getMessage());
}

$present = array_column(all(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()'
), 't');
$present = array_map('strtolower', $present);
$missing = array_values(array_diff(REQUIRED_TABLES, $present));

if ($missing) {
    $onlyCloud = !array_diff($missing, ['sessions', 'uploads']);
    health_fail('Missing tables: ' . implode(', ', $missing),
        $onlyCloud ? 'Run database/cloud-tables.sql.' : 'Import database/saraza_apartment.sql into this database.');
}

$admins = (int) val("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1");
if ($admins === 0) {
    health_fail('No admin account', 'The users table has no active admin. Re-import database/saraza_apartment.sql.');
}

global $CONFIG;
json_out([
    'ok'            => true,
    'database'      => 'connected',
    'tables'        => count(REQUIRED_TABLES),
    'session_store' => $CONFIG['session_store'],
    'upload_store'  => $CONFIG['upload_store'],
]);
