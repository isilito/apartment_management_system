<?php
/* ============================================================
   print.php — shared layout for printable pages (receipts,
   lease documents, reports). Included, never requested directly.
   Use the browser's Print → "Save as PDF" to get a PDF.
   ============================================================ */

function h($s): string { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
function fdate(?string $d): string { return $d ? date('d M Y', strtotime($d)) : '—'; }

function print_page(string $title, string $subtitle, string $body): void
{
    $prop = h(setting('property_name', "Saraza's Apartment"));
    $addr = h(setting('address', ''));
    $phone = h(setting('contact_phone', ''));
    header('Content-Type: text/html; charset=utf-8');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$title} — {$prop}</title>
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:Lexend,-apple-system,"Segoe UI",Roboto,sans-serif;color:#10202A;background:#F5F7F9;font-size:13.5px;line-height:1.55}
  .sheet{max-width:880px;margin:24px auto;background:#fff;border:1px solid #E4EAEE;border-radius:14px;padding:36px 40px}
  .bar{max-width:880px;margin:18px auto 0;display:flex;gap:10px;justify-content:flex-end;padding:0 16px}
  .bar button{font:inherit;border:1px solid #0B6E8C;background:#0B6E8C;color:#fff;border-radius:9px;padding:9px 16px;cursor:pointer;font-weight:600}
  .bar button.ghost{background:#fff;color:#0B6E8C}
  header.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #08475C;padding-bottom:16px;margin-bottom:22px}
  .brand{display:flex;gap:12px;align-items:center}
  .mark{width:42px;height:42px;border-radius:11px;background:#08475C;color:#fff;display:grid;place-items:center;font-weight:800;font-size:19px}
  .brand b{display:block;font-size:16px}.brand span{color:#6B7C86;font-size:12px}
  h1{font-size:21px;margin:0 0 2px;letter-spacing:-.02em}
  .sub{color:#6B7C86;margin:0}
  .right{text-align:right}
  table{width:100%;border-collapse:collapse;margin:10px 0 18px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #EEF2F5;vertical-align:top}
  th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#93A3AC;font-weight:600;background:#F7F9FA}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tfoot td{font-weight:700;border-top:2px solid #E4EAEE}
  dl{display:grid;grid-template-columns:200px 1fr;gap:8px 16px;margin:0 0 18px}
  dt{color:#6B7C86}dd{margin:0;font-weight:500}
  h2{font-size:14px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#08475C}
  ol li,ul li{margin-bottom:6px}
  .big{font-size:28px;font-weight:800;letter-spacing:-.02em}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:600;background:#E4F4EC;color:#0E7A55}
  .badge.amber{background:#FCF0DE;color:#A15C07}.badge.red{background:#FBE9E7;color:#B23225}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
  .sign div{border-top:1px solid #10202A;padding-top:6px;color:#6B7C86;font-size:12px}
  footer{margin-top:28px;color:#93A3AC;font-size:11.5px;border-top:1px solid #EEF2F5;padding-top:12px}
  @media (max-width:640px){.sheet{margin:12px;padding:22px 18px}dl{grid-template-columns:1fr}header.top{flex-direction:column}.right{text-align:left}
    .table-wrap{overflow-x:auto}}
  @media print{body{background:#fff}.bar{display:none}.sheet{border:0;margin:0;max-width:none;padding:0}}
</style></head>
<body>
<div class="bar"><button class="ghost" onclick="history.length>1?history.back():window.close()">Close</button>
<button onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">
<header class="top">
  <div class="brand"><div class="mark">S</div><div><b>{$prop}</b><span>{$addr}<br>{$phone}</span></div></div>
  <div class="right"><h1>{$title}</h1><p class="sub">{$subtitle}</p></div>
</header>
{$body}
<footer>Generated {$GLOBALS['__printed']} · {$prop}</footer>
</div>
</body></html>
HTML;
    exit;
}
$GLOBALS['__printed'] = date('d M Y, g:i A');
