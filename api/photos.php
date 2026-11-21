<?php
/* ============================================================
   photos.php — lists the real unit and building photos saved in
   assets/img/units/ so the pages know which ones exist.

   GET → { ok, listed, units: { "201": ["1.jpg", "2.jpg"] },
                       buildings: { "B1": "B1.jpg" } }

   Unit photos are public files anyway, so no sign-in is needed.
   XAMPP only: .vercelignore leaves it out of Vercel (the Hobby plan
   allows 12 functions). Without it, or when the folder is not
   readable, the browser checks for 1.jpg, 2.jpg … itself
   (assets/js/unit-photos.js).
   ============================================================ */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = dirname(__DIR__) . '/assets/img/units';
if (!is_dir($root)) {
    echo json_encode(['ok' => true, 'listed' => false]);
    exit;
}

$isImage = fn(string $f): bool => (bool) preg_match('/\.(jpe?g|png|webp)$/i', $f) && $f[0] !== '.';

$units = [];
$buildings = [];
foreach (scandir($root) as $dir) {
    if ($dir[0] === '.' || $dir === 'placeholders') continue;
    $path = $root . '/' . $dir;
    if (!is_dir($path) || !preg_match('/^[A-Za-z0-9_-]{1,12}$/', $dir)) continue;

    $files = array_values(array_filter(scandir($path), $isImage));
    natcasesort($files);
    $files = array_values($files);

    if ($dir === 'buildings') {
        foreach ($files as $f) $buildings[pathinfo($f, PATHINFO_FILENAME)] = $f;
    } elseif ($files) {
        $units[$dir] = array_slice($files, 0, 12);
    }
}

echo json_encode(['ok' => true, 'listed' => true, 'units' => (object) $units, 'buildings' => (object) $buildings]);
