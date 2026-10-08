<?php
/* ============================================================
   auth.php — sign in, sign out, who am I, change password.

   POST ?action=login            { role, login, password }
   POST ?action=logout
   GET  ?action=me
   POST ?action=change_password  { current, next }
   ============================================================ */
require __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

switch ($action) {

case 'login':
    require_post();
    $role  = enum_in('role', ['admin', 'tenant']);
    $login = str_in('login', 160, true, 'Email or username');
    $pass  = (string) (input()['password'] ?? '');
    if ($pass === '') fail('Enter your password.');

    /* simple brute-force brake: 5 misses locks this browser session for 60 seconds */
    $tries = $_SESSION['login_fail'] ?? ['n' => 0, 't' => 0];
    if ($tries['n'] >= 5 && time() - $tries['t'] < 60) {
        fail('Too many attempts. Wait a minute and try again.', 429);
    }

    $u = one('SELECT * FROM users WHERE role = ? AND is_active = 1 AND (email = ? OR username = ?)',
             [$role, $login, $login]);

    if (!$u || !password_verify($pass, $u['password_hash'])) {
        $_SESSION['login_fail'] = ['n' => $tries['n'] + 1, 't' => time()];
        fail('Wrong email or password.', 401);
    }

    if ($role === 'tenant') {
        $t = one('SELECT status FROM tenants WHERE id = ?', [$u['tenant_id']]);
        if (!$t || $t['status'] === 'moved_out') fail('This tenant account is no longer active.', 403);
    }

    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $u['id'];
    $_SESSION['last_seen'] = time();
    unset($_SESSION['login_fail']);

    if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
        q('UPDATE users SET password_hash=? WHERE id=?', [password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
    }
    q('UPDATE users SET last_login_at = ? WHERE id = ?', [now(), $u['id']]);
    q('UPDATE staff SET last_active = ? WHERE user_id = ?', [now(), $u['id']]);
    log_activity($u, 'Signed in', $role === 'admin' ? 'Admin console' : 'Tenant portal');

    ok([
        'role'     => $u['role'],
        'name'     => $u['name'],
        'redirect' => $role === 'admin' ? 'dashboard.html' : 'tenant-portal/dashboard.html',
    ]);

case 'logout':
    require_post();
    $u = current_user();
    if ($u) log_activity($u, 'Signed out');
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    ok();

case 'me':
    $u = current_user();
    if (!$u) json_out(['ok' => true, 'user' => null]);
    ok(['user' => ['id' => (int) $u['id'], 'role' => $u['role'], 'name' => $u['name'], 'email' => $u['email'],
                   'username' => $u['username'], 'tenantId' => $u['tenant_id']]]);

case 'change_password':
    require_post();
    $u = current_user();
    if (!$u) fail('Your session has ended. Please sign in again.', 401);
    $cur  = (string) (input()['current'] ?? '');
    $next = (string) (input()['next'] ?? '');
    $hash = val('SELECT password_hash FROM users WHERE id=?', [$u['id']]);
    if (!password_verify($cur, $hash)) fail('Your current password is not correct.');
    if (strlen($next) < 8) fail('Use at least 8 characters for the new password.');
    if ($next === $cur) fail('The new password must be different from the current one.');
    q('UPDATE users SET password_hash=? WHERE id=?', [password_hash($next, PASSWORD_DEFAULT), $u['id']]);
    log_activity($u, 'Changed password');
    ok();

default:
    fail('Unknown action.', 404);
}
