<?php
/* ============================================================
   file.php — serves uploaded files after a permission check.
     ?payment=PMT-1001   proof of payment
     ?media=12           maintenance photo / video
   ============================================================ */
require __DIR__ . '/lib.php';

$u = current_user();
if (!$u) { http_response_code(401); exit('Please sign in.'); }

if (isset($_GET['payment'])) {
    $row = one('SELECT tenant_id, proof_path AS path FROM payments WHERE id=?', [$_GET['payment']]);
} elseif (isset($_GET['media'])) {
    $row = one('SELECT r.tenant_id, m.file_path AS path FROM maintenance_media m
                JOIN maintenance_requests r ON r.id=m.request_id WHERE m.id=?', [(int) $_GET['media']]);
} else {
    $row = null;
}

if (!$row || !$row['path'] || ($u['role'] === 'tenant' && $row['tenant_id'] !== $u['tenant_id'])) {
    http_response_code(404); exit('File not found.');
}

if ($CONFIG['upload_store'] === 'db') {
    $blob = one('SELECT mime, data FROM uploads WHERE path=?', [$row['path']]);
    if (!$blob) { http_response_code(404); exit('File not found.'); }
    $mime = $blob['mime'] ?: 'application/octet-stream';
    $data = $blob['data'];
} else {
    $base = realpath($CONFIG['upload_dir']);
    $full = realpath($CONFIG['upload_dir'] . '/' . $row['path']);
    if (!$base || !$full || strpos($full, $base) !== 0 || !is_file($full)) { http_response_code(404); exit('File not found.'); }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($full) ?: 'application/octet-stream';
    $data = file_get_contents($full);
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($data));
header('Content-Disposition: inline; filename="' . basename($row['path']) . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=3600');
echo $data;
