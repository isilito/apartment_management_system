/* ============================================================
   api.js — talks to the PHP backend in /api.

   API.get('admin.php')                      → data
   API.post('admin.php', 'record_payment', {...})
   API.upload('tenant.php', 'new_request', formData)

   Every call resolves with the JSON body, or rejects with an Error
   whose message is safe to show the user. A 401 (session ended)
   sends the browser to the login page.
   ============================================================ */
(function (global) {

  /* admin pages live at the root, the tenant portal one folder down */
  var inPortal = /\/tenant-portal\//.test(location.pathname);
  var BASE = inPortal ? '../api/' : 'api/';
  var LOGIN = inPortal ? '../login.html' : 'login.html';

  function toLogin(reason) {
    var back = encodeURIComponent(location.pathname.split('/').slice(-2).join('/') + location.search);
    location.replace(LOGIN + '?' + (inPortal ? 'role=tenant&' : '') + 'next=' + back +
                     (reason ? '&reason=' + encodeURIComponent(reason) : ''));
  }

  function handler(file) { return function (res) { return handle(res, file); }; }

  function handle(res, file) {
    return res.text().then(function (txt) {
      var body;
      try { body = JSON.parse(txt); }
      catch (e) {
        throw new Error(res.ok ? 'The server sent an unexpected reply.'
          : 'The server is not responding (' + res.status + '). Is Apache/PHP running?');
      }
      /* a 401 from the login form itself just means a wrong password */
      if (res.status === 401 && file !== 'auth.php') { toLogin('expired'); throw new Error(body.error || 'Please sign in again.'); }
      if (!res.ok || body.ok === false) throw new Error(body.error || 'Something went wrong.');
      return body;
    });
  }

  function network(err) {
    if (err instanceof TypeError) {
      throw new Error('Could not reach the server. Open the site through http://localhost/ with Apache running.');
    }
    throw err;
  }

  function url(file, action, params) {
    var u = BASE + file + (action ? '?action=' + encodeURIComponent(action) : '');
    if (params) {
      Object.keys(params).forEach(function (k) {
        u += (u.indexOf('?') > -1 ? '&' : '?') + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      });
    }
    return u;
  }

  global.API = {
    base: BASE,
    loginPage: LOGIN,
    url: url,
    toLogin: toLogin,

    get: function (file, action, params) {
      return fetch(url(file, action, params), { credentials: 'same-origin', cache: 'no-store' })
        .catch(network).then(handler(file));
    },

    post: function (file, action, data) {
      return fetch(url(file, action), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify(data || {})
      }).catch(network).then(handler(file));
    },

    upload: function (file, action, formData) {
      return fetch(url(file, action), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' },
        body: formData
      }).catch(network).then(handler(file));
    },

    logout: function () {
      return API.post('auth.php', 'logout').catch(function () {}).then(function () {
        location.replace(LOGIN + (inPortal ? '?role=tenant' : ''));
      });
    },

    /* Builds a CSV in the browser and downloads it. rows: array of arrays. */
    downloadCsv: function (filename, rows) {
      var csv = rows.map(function (r) {
        return r.map(function (v) {
          v = v == null ? '' : String(v);
          return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        }).join(',');
      }).join('\r\n');
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };

})(window);
