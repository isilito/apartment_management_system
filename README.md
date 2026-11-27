# Saraza's Apartment — Property Management System

Admin console + tenant portal for a 20-unit apartment, backed by **PHP 8 + MySQL/MariaDB**.
Runs on a stock **XAMPP** install, or on **Vercel** with a hosted MySQL database.
No build step, no Composer, no npm.

> **Setting up the database?** Follow the step-by-step guide in
> [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md). It covers XAMPP, TiDB Cloud, and Aiven,
> with a health check and troubleshooting. A printable PDF version is in
> [`docs/expert-testing/`](docs/expert-testing/), together with the expert testing forms.

## Setup (XAMPP, about 5 minutes)

1. **Copy the folder** into `C:\xampp\htdocs\`, e.g. `C:\xampp\htdocs\saraza\`.
2. Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.
3. **Import the database.** Open <http://localhost/phpmyadmin> → **Import** → choose
   `database/saraza_apartment.sql` → **Go**. It creates the `saraza_apartment` database with
   all tables, the property (2 buildings, 20 units) and the admin login, with no tenants or
   records yet. (Re-importing wipes everything back to that clean start.)
4. Open <http://localhost/saraza/api/health.php>. It should say `"ok":true`.
5. Open <http://localhost/saraza/> and sign in.

If your MySQL user or password is not the XAMPP default (`root`, empty password), edit
`api/config.php`.

> The pages must be opened through `http://localhost/...`. Double-clicking an `.html` file
> (a `file://` address) cannot reach the PHP backend.

## Deploy to Vercel

Vercel serves the HTML/CSS/JS as static files and runs each `api/*.php` file as a serverless
function through the community [`vercel-php`](https://github.com/vercel-community/php) runtime
(PHP 8.5, set in `vercel.json`). Vercel has no database of its own, so you need a hosted MySQL.
[`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md) walks through steps 1, 2, and 4 in detail.

1. **Create a MySQL database** with any hosted MySQL-compatible provider, for example
   TiDB Cloud Starter (formerly Serverless) or Aiven for MySQL (both have free tiers). Pick a region near
   Singapore if you can; `vercel.json` runs the functions in `sin1` (Singapore). If your
   database is elsewhere, change `regions` to the closest
   [Vercel region](https://vercel.com/docs/edge-network/regions).
2. **Import `database/saraza_apartment.sql`** with the provider's console or the `mysql` client.
   It creates a database called `saraza_apartment`. If your provider does not let you create
   databases, delete the `DROP DATABASE` / `CREATE DATABASE` / `USE` lines near the top, import it
   into the database they give you, and set `SARAZA_DB_NAME` to that name.
   *Already have a database from an older version?* Run `database/cloud-tables.sql` instead.
   It only adds the `sessions` and `uploads` tables.
3. **Push this folder to GitHub** and import the repository at <https://vercel.com/new>.
   Framework preset **Other**; leave the build command and output directory empty.
4. **Add the environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `SARAZA_DB_HOST` | database host name |
   | `SARAZA_DB_PORT` | usually `3306` (TiDB Cloud: `4000`) |
   | `SARAZA_DB_NAME` | `saraza_apartment` (or the name from step 2) |
   | `SARAZA_DB_USER` | database user |
   | `SARAZA_DB_PASS` | database password |
   | `SARAZA_DB_SSL` | `1`. Hosted databases require TLS |
   | `SARAZA_DB_SSL_CA_PEM` | *only if the provider uses its own CA (e.g. Aiven)*: paste the CA certificate |
   | `GEMINI_API_KEY` | *optional*: turns on the AI assistant (see below) |

   `.env.example` lists the same variables.
5. **Deploy**, then open `https://<your-project>.vercel.app/api/health.php`. It should say
   `"ok":true`; if not, it says what to fix. Then sign in and **change the admin password**
   (Settings → Security).

If the build fails with a Node.js version error, set Project → Settings → General →
Node.js Version to **22.x**.

How it differs from XAMPP (all automatic when Vercel's `VERCEL=1` variable is present):

- **Sessions and uploads live in the database** (`sessions` and `uploads` tables), because each
  request may run on a different server and the filesystem is read-only.
- **Uploads are limited to 4 MB per file and 4.4 MB per request.** Vercel rejects request
  bodies over 4.5 MB. The tenant portal checks this before sending.
- `.vercelignore` keeps `database/`, `docs/`, and this README off the site, and
  `api/php.ini` holds the PHP settings (XAMPP ignores it).
- **The Hobby plan allows at most 12 functions per deployment**, and every `api/*.php` file
  (including `config.php` and `lib.php`) counts as one. There are exactly 12 now, so a new
  endpoint must replace one or be added to `.vercelignore`, or the deploy fails at
  "Deploying outputs…".

## AI assistant (Gemini)

The **Saraza Assistant** chat (bottom-right button in the admin console) answers questions about
the live records, such as "who is late on rent?", "ilang unit ang bakante?", or "summarize this
month's collections". It works in two modes:

- **Without a key** it answers the common questions (overdue tenants, vacancies, pending payments,
  repairs, collections, leases) from built-in rules.
- **With a Google Gemini API key** it understands free-form questions and follow-ups in English,
  Tagalog, or Taglish. The chat header then reads "AI assistant · powered by Gemini".

**Setup**

1. Create a free API key at <https://aistudio.google.com/apikey>.
2. Give it to the app. Never paste the key into the code or commit it to Git.
   - **XAMPP:** copy `api/config.local.example.php` to `api/config.local.php` and paste the key into
     `'gemini_api_key' => '...'`. That file is git-ignored and blocked from the web.
   - **Vercel:** add the environment variable `GEMINI_API_KEY`, then redeploy.
3. Open the chat. If the key is wrong or Gemini is unavailable, the assistant says why and gives
   its built-in answer instead.

The model is `gemini-3.5-flash-lite` by default; set `GEMINI_MODEL` (or `gemini_model` in
`config.local.php`) to use another. The key stays on the server: the browser calls
`api/assistant.php`, which is admin-only and limited to 20 questions per minute.

**Privacy:** each question sends Google a snapshot of the records the admin can see: unit, tenant
name, balance, payment and repair details (no emails or phone numbers). Mention this in your data
privacy notice, and use a paid Gemini plan for real tenant data, because Google may use free-tier
prompts to improve its products.

## Logins

| Who | Sign in with | Password |
|---|---|---|
| Admin — **Josephine Saraza** | `josephine.saraza@gmail.com` | `admin123` (change it on first sign-in) |
| Tenants | their email | the temporary password shown when the admin creates their login |

There is no self sign-up and no Google login: **only the admin creates tenant accounts** (Add tenant,
or Edit → "Create a tenant portal login", or CSV import). Each new tenant gets a one-time temporary
password shown on screen. Change the admin password under **Settings → Security** before real use.

## Starting data

The database starts clean: no tenants, payments, repairs, expenses or notices. It holds only:

- **20 units** at two properties, all available to rent:
  - **Jose St. Building** — 4109 Jose St., GTDL, Valenzuela City — 10 units (101–105, 201–205)
  - **Jacinto St. Building** — 311 Jacinto St., Canumay, Valenzuela City — 10 units (J101–J105, J201–J205)
- The admin login above, default settings, house rules and repair categories.
- Payment methods: **Cash** is on. GCash, Maya and bank transfer are off until their account
  details are entered under **Settings → Payment methods**.

First steps for the owner: change the password, add the office phone number and payment details
in Settings, check each unit's rent, then add tenants. The app creates each month's rent charges
automatically from each tenant's move-in date.

## What works

**Admin console** (`dashboard.html` … `settings.html`)
- Dashboard opens with **What needs your attention**: a numbered list in plain sentences
  (payments to check, who owes rent, urgent and unassigned repairs, leases ending, empty units),
  each with one button that goes straight to it
- Dashboard with live occupancy, collections, balances, repairs, and charts; it refreshes itself
  within 15 seconds of a change. "Income this month" follows each payment's date paid, so confirming
  a payment dated last month updates last month's total (the dashboard notes this when it happens)
- Units: unit cards, building summary, add, edit, mark under repair, delete (if no history);
  per-unit drawer
- Tenants: add (with portal login), edit, add charges (utilities, etc.), waive charges,
  message, rent reminders, move-out, reset portal password, printable statement
- Payments: record cash/GCash/bank payments, **confirm or reject** payments tenants send from
  the portal (with their proof screenshot), printable receipts, CSV export
- Automatic late fees after the grace period (configurable)
- Maintenance board: status, crew assignment, visit date, cost, notes, priority; tenant photos/videos
- Reports: rent roll, collections, aging, income statement, deposits, maintenance, occupancy,
  tenant statement — as a printable page (Print → Save as PDF) or a CSV for Excel
- Settings: property profile, buildings, house rules, billing rules, payment-method details,
  staff & crew (extra admin logins), notification preferences, password, auto sign-out,
  activity log, JSON export, CSV tenant import, delete-all
- Bell notifications, global search, AI assistant (Gemini, with built-in answers as a fallback)

**Tenant portal** (`tenant-portal/`)
- Home says in one sentence what to pay now and when the next bill is, beside the unit's key facts
- My Unit: unit details, lease, house rules, contacts
- Balance and due dates, payment history, printable receipts and statement of account
- Pay a charge: choose method, enter reference, upload proof → admin confirms
- Maintenance requests with up to 5 photos/videos, 5-step status tracker, follow-ups, 1–5 rating
- Lease details, house rules, printable lease/deposit documents, contacts, message the office,
  update contact details, change password

**Mobile**: every page works down to phone width. Below 1024px the sidebar becomes a
hamburger menu; on phones, dialogs open as bottom sheets and tables scroll sideways.

## Structure

```
login.html                 Sign-in for admins and tenants (index.html redirects here)
*.html                     Admin console pages
tenant-portal/*.html       Tenant portal pages

api/                       PHP backend (JSON)
  config.php               Database settings (environment variables override them)
  php.ini                  PHP settings for Vercel
  lib.php                  DB, sessions, auth, billing engine, notifications
  auth.php                 login / logout / me / change_password
  admin.php                Admin data + every admin action
  tenant.php               Tenant data + tenant actions
  report.php               Reports (CSV or printable)
  receipt.php              Printable receipt
  document.php             Lease, house rules, deposit receipt, statement
  file.php                 Serves uploads after a permission check
  health.php               Database check: connection, tables, admin account (no login needed)
  assistant.php            AI assistant: forwards questions to Google Gemini (admin only)
  config.local.example.php Template for local secrets such as the Gemini key (copy to config.local.php)
  uploads/                 Proofs of payment and request photos (direct access blocked)

database/saraza_apartment.sql   Schema + starting data (clean, no tenants)
database/cloud-tables.sql       Adds the Vercel tables to an older database

vercel.json                Vercel functions (PHP runtime), region, headers
.vercelignore              Files kept off the Vercel deployment
.env.example               The environment variables Vercel needs

docs/DATABASE_SETUP.md     Database setup tutorial (XAMPP, TiDB Cloud, Aiven)
docs/expert-testing/       Printable kit: setup tutorial PDF, expert tester profile and
                           evaluation and assessment forms (HTML sources and build script in source/)
docs/                      Test cases (PDF) and the dashboard design mock-up

assets/css/units.css       Unit cards and building tiles (admin Units page and dashboard)
assets/js/api.js           fetch wrapper (sends you to login when the session ends)
assets/js/data.js          Loads api/admin.php into window.DB
assets/js/shell.js         Sidebar, topbar, shared dialogs
assets/js/pages/*.js       One file per page
```

The menu uses short names: Dashboard, Units, Tenants, Payments, Reports, Repairs (admin) and
Home, Payments, Repairs, My Unit (tenant portal). The test-case PDFs in `docs/` still use the
older long names (Unit & Tenant Management, Renter Information, Payment & Balances, Reports &
Analytics, Maintenance Requests, My Rental Info).

The tenant portal keeps its own copies of `base.css`, `components.css`, `ui.js`, `icons.js`,
`charts.js`, and `api.js`. If you change one, copy it to the other folder too.

## Security notes

- Passwords are stored with `password_hash` (bcrypt); sessions use HttpOnly, SameSite cookies.
- Every API call checks the role; tenants can only read their own records and files.
- Write requests require a custom header, which blocks cross-site form posts.
- Five wrong passwords in a row pause sign-in for a minute.
- `.htaccess` files block direct access to `api/uploads/`, `database/`, and the PHP includes.
  If you deploy beyond your own PC, also use HTTPS and change the admin password.
- On Vercel, `.vercelignore` does that job: the SQL dump is never uploaded, and `config.php`,
  `lib.php`, and `print.php` answer 404 when requested directly.

## Keyboard (admin)

`/` search · `G` then `D/U/R/P/E/M/S/H` jump to a page · `N` record payment · `Esc` close
