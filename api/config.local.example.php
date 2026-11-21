<?php
/* ============================================================
   config.local.example.php — template for local secrets (XAMPP).

   1. Copy this file to config.local.php (same folder).
   2. Paste your Gemini API key below.
   config.local.php is ignored by Git and blocked from the web,
   so the key never ends up on GitHub. Any setting from
   config.php can be overridden here; empty values are ignored.
   On Vercel, use environment variables instead (GEMINI_API_KEY).
   ============================================================ */
if (get_included_files()[0] === __FILE__) { http_response_code(404); exit; }

return [
    'gemini_api_key' => '',                       // e.g. 'AIza...'
    // 'gemini_model' => 'gemini-3.5-flash-lite',
    // 'db_pass'      => '',
];
