# Saraza's Apartment — Property Management System

Admin console + tenant portal for a 20-unit apartment, backed by **PHP 8 + MySQL/MariaDB**.
Runs on a stock **XAMPP** install, or on **Vercel** with a hosted MySQL database.
No build step, no Composer, no npm.

## Setup (XAMPP, about 5 minutes)

1. **Copy the folder** into `C:\xampp\htdocs\`, e.g. `C:\xampp\htdocs\saraza\`.
2. Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.
3. **Import the database.** Open <http://localhost/phpmyadmin> → **Import** → choose
   `database/saraza_apartment.sql` → **Go**. It creates the `saraza_apartment` database with
   all tables and demo data. (Re-importing resets everything back to the demo data.)
4. Open <http://localhost/saraza/> and sign in.

If your MySQL user or password is not the XAMPP default (`root`, empty password), edit
`api/config.php`.

> The pages must be opened through `http://localhost/...`. Double-clicking an `.html` file
> (a `file://` address) cannot reach the PHP backend.

## Deploy to Vercel

Vercel serves the HTML/CSS/JS as static files and runs each `api/*.php` file as a serverless
function through the community [`vercel-php`](https://github.com/juicyfx/vercel-php) runtime
(PHP 8.5, set in `vercel.json`). Vercel has no database of its own, so you need a hosted MySQL.

1. **Create a MySQL database** with any hosted MySQL-compatible provider, for example
   TiDB Cloud Serverless or Aiven for MySQL (both have free tiers). Pick a region near
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

5. **Deploy**, open the site, sign in, and **change every demo password** (Settings → Security).

If the build fails with a Node.js version error, set Project → Settings → General →
Node.js Version to **22.x**.

How it differs from XAMPP (all automatic when Vercel's `VERCEL=1` variable is present):

- **Sessions and uploads live in the database** (`sessions` and `uploads` tables), because each
  request may run on a different server and the filesystem is read-only.
- **Uploads are limited to 4 MB per file and 4.4 MB per request.** Vercel rejects request
  bodies over 4.5 MB. The tenant portal checks this before sending.
- `.vercelignore` keeps `database/`, this README, and the design files off the site, and
  `api/php.ini` holds the PHP settings (XAMPP ignores it).

## Logins

| Who | Sign in with | Password |
|---|---|---|
| Admin — **Micheal Saraza** | `michael.saraza@gmail.com` | `admin123` |
| Tenant — Jose Ramirez, Unit 201 | `jose.ramirez@gmail.com` | `tenant123` |
| Any other demo tenant | their email (see Renter Information) | `tenant123` |

There is no self sign-up and no Google login: **only the admin creates tenant accounts** (Add tenant,
or Edit → "Create a tenant portal login", or CSV import). Each new tenant gets a one-time temporary
password shown on screen. Change the admin password under **Settings → Security** before real use.

## Demo data

- **20 units** at two properties:
  - **Jose St. Building** — 4109 Jose St., GTDL, Valenzuela City — 10 units (101–105, 201–205)
  - **Jacinto St. Building** — 311 Jacinto St., Canumay, Valenzuela City — 10 units (J101–J105, J201–J205)

  17 occupied, 2 vacant (J203, J205), 1 under repair (J104).
- **17 tenants** with leases, deposits, and emergency contacts; 7 have balances.
- 7 months of rent and utility charges, ~200 payments (2 waiting for confirmation),
  21 maintenance requests, operating expenses, notifications.
- Data is dated around **8 October 2026**. The app creates each month's rent charges
  automatically as time passes, so the books stay current whenever you open it.

## What works

**Admin console** (`dashboard.html` … `settings.html`)
- Dashboard with live occupancy, collections, balances, repairs, and charts
- Units: add, edit, mark under repair, delete (if no history); per-unit drawer
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
- Bell notifications, global search, built-in assistant

**Tenant portal** (`tenant-portal/`)
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
  uploads/                 Proofs of payment and request photos (direct access blocked)

database/saraza_apartment.sql   Schema + demo data
database/cloud-tables.sql       Adds the Vercel tables to an older database

vercel.json                Vercel functions (PHP runtime), region, headers
.vercelignore              Files kept off the Vercel deployment

assets/js/api.js           fetch wrapper (sends you to login when the session ends)
assets/js/data.js          Loads api/admin.php into window.DB
assets/js/shell.js         Sidebar, topbar, shared dialogs
assets/js/pages/*.js       One file per page
```

The tenant portal keeps its own copies of `base.css`, `components.css`, `ui.js`, `icons.js`,
`charts.js`, and `api.js`. If you change one, copy it to the other folder too.

## Security notes

- Passwords are stored with `password_hash` (bcrypt); sessions use HttpOnly, SameSite cookies.
- Every API call checks the role; tenants can only read their own records and files.
- Write requests require a custom header, which blocks cross-site form posts.
- Five wrong passwords in a row pause sign-in for a minute.
- `.htaccess` files block direct access to `api/uploads/`, `database/`, and the PHP includes.
  If you deploy beyond your own PC, also use HTTPS and change every demo password.
- On Vercel, `.vercelignore` does that job: the SQL dump is never uploaded, and `config.php`,
  `lib.php`, and `print.php` answer 404 when requested directly.

## Keyboard (admin)

`/` search · `G` then `D/U/R/P/E/M/S/H` jump to a page · `N` record payment · `Esc` close
