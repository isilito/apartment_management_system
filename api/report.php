<?php
/* ============================================================
   report.php — generates reports from live data.

   ?type=rent-roll|collections|aging|income|deposits|maintenance|occupancy|tenant
   &period=YYYY-MM | ytd | last6       (default: this month)
   &building=all|B1
   &format=csv|html                    (html opens a printable page)
   &tenant=T001                        (tenant statement only)
   ============================================================ */
require __DIR__ . '/lib.php';
require __DIR__ . '/print.php';

$ME = current_user();
if (!$ME || $ME['role'] !== 'admin') { http_response_code(403); exit('Admins only.'); }

$type = $_GET['type'] ?? 'rent-roll';
$format = ($_GET['format'] ?? 'csv') === 'html' ? 'html' : 'csv';
$building = $_GET['building'] ?? 'all';
if ($building !== 'all' && !val('SELECT 1 FROM buildings WHERE id=?', [$building])) $building = 'all';
$period = $_GET['period'] ?? date('Y-m');

if ($type === 'tenant') {
    $tid = $_GET['tenant'] ?? '';
    if (!val('SELECT 1 FROM tenants WHERE id=?', [$tid])) { http_response_code(404); exit('Choose a tenant.'); }
    header('Location: document.php?doc=statement&tenant=' . rawurlencode($tid));
    exit;
}

/* ---------- period window ---------- */
if ($period === 'ytd') {
    [$from, $to, $plabel] = [date('Y-01-01'), today(), 'Year to date ' . date('Y')];
} elseif ($period === 'last6') {
    [$from, $to, $plabel] = [date('Y-m-01', strtotime('-5 months')), today(), 'Last 6 months'];
} elseif (preg_match('/^\d{4}-\d{2}$/', $period)) {
    $from = $period . '-01';
    $to = date('Y-m-t', strtotime($from));
    $plabel = date('F Y', strtotime($from));
} else {
    [$from, $to, $plabel] = [date('Y-m-01'), date('Y-m-t'), date('F Y')];
    $period = date('Y-m');
}
$asOf = min($to, today());

$bClause = $building === 'all' ? '' : ' AND un.building_id = ' . db()->quote($building);
$bName = $building === 'all' ? 'All buildings' : val('SELECT name FROM buildings WHERE id=?', [$building]);

/* ---------- build rows ---------- */
$titles = [
    'rent-roll' => 'Rent roll', 'collections' => 'Collection summary', 'aging' => 'Balance aging',
    'income' => 'Income statement', 'deposits' => 'Deposit register', 'maintenance' => 'Maintenance spend',
    'occupancy' => 'Occupancy report',
];
if (!isset($titles[$type])) { http_response_code(404); exit('Unknown report.'); }

$cols = []; $rows = []; $totals = null; $num = [];

switch ($type) {
case 'rent-roll':
    $cols = ['Unit', 'Building', 'Type', 'Tenant', 'Phone', 'Lease ends', 'Rent', 'Balance', 'Status'];
    $num = [6, 7];
    foreach (all("SELECT un.*, b.name AS bname, ut.label AS tlabel, t.id AS tid, t.name AS tname, t.phone, t.lease_end, t.rent AS trent
                  FROM units un JOIN buildings b ON b.id=un.building_id JOIN unit_types ut ON ut.tkey=un.type_key
                  LEFT JOIN tenants t ON t.unit_id=un.id AND t.status<>'moved_out' WHERE 1=1 $bClause
                  ORDER BY un.building_id, un.floor, un.id") as $r) {
        $bal = $r['tid'] ? tenant_balance($r['tid'])['balance'] : 0;
        $rows[] = [$r['id'], $r['bname'], $r['tlabel'], $r['tname'] ?: '—', $r['phone'] ?: '', $r['lease_end'] ? fdate($r['lease_end']) : '—',
                   (float) ($r['trent'] ?: $r['rent']), $bal, ucfirst($r['status'])];
    }
    $totals = ['Total', '', '', count(array_filter($rows, fn($r) => $r[3] !== '—')) . ' tenants', '', '',
               array_sum(array_column($rows, 6)), array_sum(array_column($rows, 7)), ''];
    break;

case 'collections':
    $cols = ['Unit', 'Tenant', 'Billed', 'Collected', 'Outstanding', 'Collection rate'];
    $num = [2, 3, 4, 5];
    foreach (all("SELECT t.id, t.name, t.unit_id FROM tenants t JOIN units un ON un.id=t.unit_id
                  WHERE t.status<>'moved_out' $bClause ORDER BY t.unit_id") as $t) {
        $billed = (float) val('SELECT COALESCE(SUM(amount),0) FROM charges WHERE tenant_id=? AND due_date BETWEEN ? AND ?', [$t['id'], $from, $to]);
        $paid = (float) val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE tenant_id=? AND status='cleared' AND paid_on BETWEEN ? AND ?", [$t['id'], $from, $to]);
        $out = (float) val("SELECT COALESCE(SUM(amount-amount_paid),0) FROM charges WHERE tenant_id=? AND status<>'paid' AND due_date BETWEEN ? AND ?", [$t['id'], $from, $asOf]);
        $rows[] = [$t['unit_id'], $t['name'], $billed, $paid, $out, $billed > 0 ? round(min($paid, $billed) / $billed * 100) . '%' : '—'];
    }
    $b = array_sum(array_column($rows, 2)); $c = array_sum(array_column($rows, 3));
    $totals = ['Total', count($rows) . ' tenants', $b, $c, array_sum(array_column($rows, 4)), $b > 0 ? round(min($c, $b) / $b * 100) . '%' : '—'];
    break;

case 'aging':
    $cols = ['Unit', 'Tenant', 'Phone', '0–30 days', '31–60 days', '61–90 days', '90+ days', 'Total'];
    $num = [3, 4, 5, 6, 7];
    foreach (all("SELECT t.id, t.name, t.phone, t.unit_id FROM tenants t JOIN units un ON un.id=t.unit_id
                  WHERE t.status<>'moved_out' $bClause ORDER BY t.unit_id") as $t) {
        $buckets = [0, 0, 0, 0];
        foreach (all("SELECT due_date, amount-amount_paid AS owed FROM charges WHERE tenant_id=? AND status<>'paid' AND due_date <= ?", [$t['id'], $asOf]) as $c) {
            $d = days_between($c['due_date'], $asOf);
            $buckets[$d <= 30 ? 0 : ($d <= 60 ? 1 : ($d <= 90 ? 2 : 3))] += (float) $c['owed'];
        }
        if (array_sum($buckets) <= 0) continue;
        $rows[] = array_merge([$t['unit_id'], $t['name'], $t['phone']], $buckets, [array_sum($buckets)]);
    }
    $totals = ['Total', count($rows) . ' tenants', '', array_sum(array_column($rows, 3)), array_sum(array_column($rows, 4)),
               array_sum(array_column($rows, 5)), array_sum(array_column($rows, 6)), array_sum(array_column($rows, 7))];
    break;

case 'income':
    $cols = ['Month', 'Rent & utilities collected', 'Operating expenses', 'Repair costs', 'Net income'];
    $num = [1, 2, 3, 4];
    $m = date('Y-m-01', strtotime($from));
    while ($m <= $to) {
        $e = date('Y-m-t', strtotime($m));
        $inc = (float) val("SELECT COALESCE(SUM(p.amount),0) FROM payments p LEFT JOIN units un ON un.id=p.unit_id
                            WHERE p.status='cleared' AND p.paid_on BETWEEN ? AND ? $bClause", [$m, $e]);
        $exp = $building === 'all' ? (float) val('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN ? AND ?', [$m, $e]) : 0;
        $rep = (float) val("SELECT COALESCE(SUM(r.cost),0) FROM maintenance_requests r JOIN units un ON un.id=r.unit_id
                            WHERE r.status='done' AND DATE(r.resolved_at) BETWEEN ? AND ? $bClause", [$m, $e]);
        $rows[] = [date('F Y', strtotime($m)), $inc, $exp, $rep, $inc - $exp - $rep];
        $m = date('Y-m-01', strtotime($m . ' +1 month'));
    }
    $totals = ['Total', array_sum(array_column($rows, 1)), array_sum(array_column($rows, 2)), array_sum(array_column($rows, 3)), array_sum(array_column($rows, 4))];
    break;

case 'deposits':
    $cols = ['Unit', 'Tenant', 'Move-in', 'Lease ends', 'Monthly rent', 'Deposit held', 'Advance held'];
    $num = [4, 5, 6];
    foreach (all("SELECT t.* FROM tenants t JOIN units un ON un.id=t.unit_id WHERE t.status<>'moved_out' $bClause ORDER BY t.unit_id") as $t) {
        $rows[] = [$t['unit_id'], $t['name'], fdate($t['move_in']), fdate($t['lease_end']), (float) $t['rent'], (float) $t['deposit'], (float) $t['advance']];
    }
    $totals = ['Total', count($rows) . ' leases', '', '', array_sum(array_column($rows, 4)), array_sum(array_column($rows, 5)), array_sum(array_column($rows, 6))];
    break;

case 'maintenance':
    $cols = ['Request', 'Unit', 'Category', 'Priority', 'Status', 'Reported', 'Resolved', 'Assigned to', 'Cost'];
    $num = [8];
    foreach (all("SELECT r.*, c.label AS clabel FROM maintenance_requests r JOIN units un ON un.id=r.unit_id JOIN categories c ON c.ckey=r.category
                  WHERE (DATE(r.created_at) BETWEEN ? AND ? OR DATE(r.resolved_at) BETWEEN ? AND ?) $bClause
                  ORDER BY r.created_at", [$from, $to, $from, $to]) as $r) {
        $rows[] = [$r['id'] . ' · ' . $r['title'], $r['unit_id'], $r['clabel'], ucfirst($r['priority']),
                   ['new' => 'New', 'scheduled' => 'Scheduled', 'in-progress' => 'In progress', 'done' => 'Resolved'][$r['status']],
                   fdate($r['created_at']), $r['resolved_at'] ? fdate($r['resolved_at']) : '—', $r['assignee'] ?: 'Unassigned', (float) $r['cost']];
    }
    $totals = ['Total', count($rows) . ' requests', '', '', '', '', '', '', array_sum(array_column($rows, 8))];
    break;

case 'occupancy':
    $cols = ['Unit', 'Building', 'Type', 'Status', 'Tenant', 'Lease ends', 'Days to lease end', 'Vacant since', 'Rent'];
    $num = [6, 8];
    foreach (all("SELECT un.*, b.name AS bname, ut.label AS tlabel, t.name AS tname, t.lease_end FROM units un
                  JOIN buildings b ON b.id=un.building_id JOIN unit_types ut ON ut.tkey=un.type_key
                  LEFT JOIN tenants t ON t.unit_id=un.id AND t.status<>'moved_out' WHERE 1=1 $bClause
                  ORDER BY un.building_id, un.id") as $r) {
        $rows[] = [$r['id'], $r['bname'], $r['tlabel'], ucfirst($r['status']), $r['tname'] ?: '—',
                   $r['lease_end'] ? fdate($r['lease_end']) : '—', $r['lease_end'] ? days_between(today(), $r['lease_end']) : '',
                   $r['vacant_since'] ? fdate($r['vacant_since']) : '—', (float) $r['rent']];
    }
    $occ = count(array_filter($rows, fn($r) => $r[3] === 'Occupied'));
    $totals = ['Total', count($rows) . ' units', '', $occ . ' occupied (' . (count($rows) ? round($occ / count($rows) * 100) : 0) . '%)', '', '', '', '', array_sum(array_column($rows, 8))];
    break;
}

$name = $titles[$type] . ' — ' . $plabel;
q('INSERT INTO report_log (report_type, name, period, building_id, format, rows_count, generated_by, created_at) VALUES (?,?,?,?,?,?,?,?)',
  [$type, $name, $period, $building === 'all' ? null : $building, strtoupper($format), count($rows), $ME['name'], now()]);
log_activity($ME, 'Generated report', $name . ' (' . strtoupper($format) . ')');

/* ---------- output ---------- */
if ($format === 'csv') {
    $file = preg_replace('/[^a-z0-9]+/', '-', strtolower($titles[$type] . '-' . $plabel)) . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $file . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");           // BOM so Excel reads the peso sign and accents correctly
    fputcsv($out, [$name . ' · ' . $bName]);
    fputcsv($out, $cols);
    foreach ($rows as $r) fputcsv($out, $r);
    if ($totals) fputcsv($out, $totals);
    fclose($out);
    exit;
}

$fmt = function ($v, $i) use ($num) {
    if (in_array($i, $num, true) && is_numeric($v)) return h($i === 6 && $GLOBALS['type'] === 'occupancy' ? (string) $v : peso($v));
    return h($v);
};
$th = implode('', array_map(fn($c, $i) => '<th' . (in_array($i, $num, true) ? ' class="num"' : '') . '>' . h($c) . '</th>', $cols, array_keys($cols)));
$tb = implode('', array_map(fn($r) => '<tr>' . implode('', array_map(fn($v, $i) => '<td' . (in_array($i, $num, true) ? ' class="num"' : '') . '>' . $fmt($v, $i) . '</td>', $r, array_keys($r))) . '</tr>', $rows));
$tf = $totals ? '<tfoot><tr>' . implode('', array_map(fn($v, $i) => '<td' . (in_array($i, $num, true) ? ' class="num"' : '') . '>' . $fmt($v, $i) . '</td>', $totals, array_keys($totals))) . '</tr></tfoot>' : '';
$body = '<p class="sub">' . h($bName) . ' · ' . count($rows) . ' rows</p>' .
        ($rows ? '<div class="table-wrap"><table><thead><tr>' . $th . '</tr></thead><tbody>' . $tb . '</tbody>' . $tf . '</table></div>'
               : '<p>Nothing to report for this period.</p>');
print_page(h($titles[$type]), h($plabel), $body);
