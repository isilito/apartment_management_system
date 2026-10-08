<?php
/* ============================================================
   config.php — database and app settings.

   Defaults match a stock XAMPP install (MySQL/MariaDB on 3306,
   user "root", empty password). Change them here if yours differ.
   Environment variables override the defaults when present.
   ============================================================ */
return [
    'db_host'    => getenv('SARAZA_DB_HOST') ?: '127.0.0.1',
    'db_port'    => (int) (getenv('SARAZA_DB_PORT') ?: 3306),
    'db_name'    => getenv('SARAZA_DB_NAME') ?: 'saraza_apartment',
    'db_user'    => getenv('SARAZA_DB_USER') ?: 'root',
    'db_pass'    => getenv('SARAZA_DB_PASS') !== false ? getenv('SARAZA_DB_PASS') : '',

    'timezone'   => 'Asia/Manila',

    /* Tenant photo/video uploads and payment proofs land here.
       The folder ships with an .htaccess that blocks direct access;
       files are served through api/file.php after a permission check. */
    'upload_dir' => __DIR__ . '/uploads',
    'max_upload_mb' => 25,
];
