<?php
/* ============================================================
   config.php — database and app settings.

   Defaults match a stock XAMPP install (MySQL/MariaDB on 3306,
   user "root", empty password). Change them here if yours differ.
   Environment variables override the defaults when present —
   that is how the Vercel deployment is configured (see README).
   ============================================================ */
if (get_included_files()[0] === __FILE__) { http_response_code(404); exit; }

return (function (): array {

    $env = function (string $k, $default = null) {
        $v = getenv($k);
        return $v === false || $v === '' ? $default : $v;
    };
    $flag = fn(string $k, bool $default) => filter_var($env($k, $default ? '1' : '0'), FILTER_VALIDATE_BOOLEAN);

    /* On Vercel the filesystem is read-only and every request may land on a
       fresh server, so sessions and uploads have to live in the database. */
    $onVercel = getenv('VERCEL') === '1';

    return [
        'db_host'    => $env('SARAZA_DB_HOST', '127.0.0.1'),
        'db_port'    => (int) $env('SARAZA_DB_PORT', 3306),
        'db_name'    => $env('SARAZA_DB_NAME', 'saraza_apartment'),
        'db_user'    => $env('SARAZA_DB_USER', 'root'),
        'db_pass'    => getenv('SARAZA_DB_PASS') !== false ? getenv('SARAZA_DB_PASS') : '',

        /* TLS to the database. Hosted MySQL (TiDB Cloud, Aiven, …) requires it.
           db_ssl_ca: path to a CA file; leave empty to use the system CA bundle.
           db_ssl_ca_pem: the CA certificate itself, for providers with a private CA (Aiven). */
        'db_ssl'        => $flag('SARAZA_DB_SSL', false),
        'db_ssl_ca'     => $env('SARAZA_DB_SSL_CA', ''),
        'db_ssl_ca_pem' => $env('SARAZA_DB_SSL_CA_PEM', ''),

        'timezone'   => 'Asia/Manila',

        /* "files" = PHP's default session files, "db" = the sessions table. */
        'session_store' => $env('SARAZA_SESSION_STORE', $onVercel ? 'db' : 'files'),

        /* Tenant photo/video uploads and payment proofs.
           "disk" = upload_dir (ships with an .htaccess that blocks direct access),
           "db"   = the uploads table. Either way files are served through
           api/file.php after a permission check. */
        'upload_store' => $env('SARAZA_UPLOAD_STORE', $onVercel ? 'db' : 'disk'),
        'upload_dir'   => __DIR__ . '/uploads',

        /* Vercel rejects request bodies over 4.5 MB, so one upload request
           (all attached files together) has to stay under that. */
        'max_upload_mb'  => (float) $env('SARAZA_MAX_UPLOAD_MB', $onVercel ? 4 : 25),
        'max_request_mb' => (float) $env('SARAZA_MAX_REQUEST_MB', $onVercel ? 4.4 : 120),
    ];

})();
