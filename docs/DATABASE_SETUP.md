# Database setup tutorial

The app stores everything in one MySQL/MariaDB database called `saraza_apartment`.
There are two ways to run it. Pick the one you need:

| You want to… | Follow |
|---|---|
| Run it on your own PC | [Part A: Local database (XAMPP)](#part-a--local-database-xampp) (about 5 minutes) |
| Put it online with Vercel | [Part B: Cloud database for Vercel](#part-b--cloud-database-for-vercel) (about 15 minutes) |

Both parts use the same file: **`database/saraza_apartment.sql`**. It creates the database,
all 20 tables, the property (2 buildings, 20 units) and the admin login. There are no tenants
or records yet: it is a clean start.

> ⚠️ Importing the file **deletes and recreates** the `saraza_apartment` database. Running it again
> wipes every tenant, payment and repair, so never do it on a database with real records you
> want to keep. See [Back up first](#back-up-before-re-importing).

---

## Part A: Local database (XAMPP)

### 1. Start MySQL

Open the **XAMPP Control Panel** and click **Start** next to **Apache** and **MySQL**.
Both rows should turn green.

### 2. Import the SQL file

**Option 1: phpMyAdmin (easiest)**

1. Go to <http://localhost/phpmyadmin>.
2. Click the **Import** tab at the top. Don't select a database first; the file creates its own.
3. Under *File to import*, click **Choose File** and pick `database/saraza_apartment.sql`.
4. Leave the other options at their defaults and click **Import** (or **Go**) at the bottom.
5. You should see *"Import has been successfully finished"*, and `saraza_apartment` appears in
   the left sidebar with 20 tables.

**Option 2: command line**

In PowerShell or Command Prompt, from the project folder:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -e "source database/saraza_apartment.sql"
```

(Add `-p` if your root user has a password.)

### 3. Check the connection settings

The defaults in `api/config.php` match a fresh XAMPP install:

```php
'db_host' => '127.0.0.1',  'db_port' => 3306,
'db_name' => 'saraza_apartment',
'db_user' => 'root',       'db_pass' => '',
```

If you changed your MySQL password or port, edit those values.

### 4. Test it

Open <http://localhost/saraza/api/health.php> (change `saraza` to your folder name). You should see:

```json
{"ok":true,"database":"connected","tables":20,"session_store":"files","upload_store":"disk"}
```

Then open <http://localhost/saraza/> and sign in as `josephine.saraza@gmail.com` / `admin123`.
If something is wrong, the health check tells you what. See [Troubleshooting](#troubleshooting).

---

## Part B: Cloud database for Vercel

Vercel runs the PHP code but **has no database of its own**, so you need a hosted MySQL.
The app works with any MySQL-compatible host that accepts TLS connections from the internet.
Two hosts with free tiers are covered here:

| | TiDB Cloud Starter (recommended) | Aiven for MySQL |
|---|---|---|
| Free tier | Yes, no card needed | Yes (1 free service) |
| Singapore region | Yes (AWS `ap-southeast-1`) | Free plan has limited regions |
| Port | `4000` | Random, e.g. `12691` |
| Needs `SARAZA_DB_SSL_CA_PEM` | No | **Yes** |

Vercel runs this project's functions in Singapore (`"regions": ["sin1"]` in `vercel.json`).
A database in the same region keeps pages fast. If yours is elsewhere, change `regions` to the
nearest [Vercel region](https://vercel.com/docs/edge-network/regions).

### B1. Create the database server

<details open>
<summary><b>TiDB Cloud Starter</b></summary>

1. Sign up at <https://tidbcloud.com>.
2. Click **Create Cluster** and choose **Starter** (older screens call it **Serverless**).
3. Cloud provider **AWS**, region **Singapore (ap-southeast-1)**. Give it a name such as
   `saraza` and click **Create**. It is ready in under a minute.
4. Open the cluster and click **Connect** (top right).
   - *Connection type*: **Public**
   - *Connect with*: **General** (or **MySQL CLI**)
   - Click **Generate Password** and **copy it now**. It is shown only once.
5. Note the four values the dialog shows:

   | Shown as | Example | Goes into |
   |---|---|---|
   | HOST | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` | `SARAZA_DB_HOST` |
   | PORT | `4000` | `SARAZA_DB_PORT` |
   | USERNAME | `3xYzAbCd1234567.root` (keep the prefix!) | `SARAZA_DB_USER` |
   | PASSWORD | the generated password | `SARAZA_DB_PASS` |

TiDB's certificate is publicly trusted, so you don't need a CA file.
</details>

<details>
<summary><b>Aiven for MySQL</b></summary>

1. Sign up at <https://console.aiven.io>.
2. **Create service** → **MySQL** → plan **Free** → pick the region closest to Singapore that
   the free plan offers → **Create service**. Wait until the status says **Running** (a few minutes).
3. On the service's **Overview** page, under *Connection information*, note:

   | Shown as | Example | Goes into |
   |---|---|---|
   | Host | `mysql-saraza-yourname.aivencloud.com` | `SARAZA_DB_HOST` |
   | Port | `12691` | `SARAZA_DB_PORT` |
   | User | `avnadmin` | `SARAZA_DB_USER` |
   | Password | click the eye icon to show it | `SARAZA_DB_PASS` |

4. Next to **CA certificate**, click **Download** and save it as `ca.pem`. Aiven uses its own
   certificate authority, so the app needs this file's contents (step B3).
5. Leave *Allowed IP addresses* at `0.0.0.0/0`. Vercel doesn't use fixed IP addresses.
</details>

### B2. Import the SQL file into the cloud database

The simplest tool is the MySQL client that comes with XAMPP. Open **PowerShell** in the
project folder and run the command for your host. Replace the `HOST`, `PORT`, and `USER`
placeholders with your own values. It asks for the password.

**TiDB Cloud:**

```powershell
C:\xampp\mysql\bin\mysql.exe --host=HOST --port=4000 --user=USER --password `
  --ssl --ssl-verify-server-cert --tls-version=TLSv1.2 -e "source database/saraza_apartment.sql"
```

**Aiven** (point `--ssl-ca` at the `ca.pem` you downloaded):

```powershell
C:\xampp\mysql\bin\mysql.exe --host=HOST --port=PORT --user=avnadmin --password `
  --ssl-ca=C:\Users\YOU\Downloads\ca.pem --ssl-verify-server-cert `
  -e "source database/saraza_apartment.sql"
```

> `--tls-version=TLSv1.2` is needed with XAMPP's MySQL client: it fails TiDB's TLS 1.3 handshake
> with `SEC_E_DECRYPT_FAILURE`. The connection is still encrypted and the certificate is still checked.
>
> In Command Prompt (cmd.exe), put everything on one line and drop the backtick (`` ` ``).
> On macOS/Linux, use the `mysql` client and `\` for line breaks.

The import takes 10–60 seconds and prints nothing when it succeeds. To check it:

```powershell
C:\xampp\mysql\bin\mysql.exe --host=HOST --port=PORT --user=USER --password --ssl --tls-version=TLSv1.2 `
  -e "SELECT COUNT(*) AS units FROM saraza_apartment.units"
```

It should print `20`.

**Prefer a GUI?** In MySQL Workbench, DBeaver, or HeidiSQL, create a connection with the same
host, port, user, and password (turn on SSL/TLS), then open `database/saraza_apartment.sql` and
run the whole script.

<details>
<summary><b>My host doesn't let me create databases</b></summary>

Some hosts give you one fixed database (for example `defaultdb`) and refuse `CREATE DATABASE`.
In that case:

1. Make a copy of `database/saraza_apartment.sql`.
2. In the copy, delete these three lines near the top:
   ```sql
   DROP DATABASE IF EXISTS `saraza_apartment`;
   CREATE DATABASE `saraza_apartment` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE `saraza_apartment`;
   ```
3. Import the copy into the database you were given (add `--database=defaultdb` to the command).
4. In step B3, set `SARAZA_DB_NAME` to that database's name.
</details>

<details>
<summary><b>I already have a database from an older version of the app</b></summary>

Don't re-import (that would wipe your data). Run `database/cloud-tables.sql` instead.
It only adds the two tables Vercel needs (`sessions` and `uploads`) and is safe to run twice:

```powershell
C:\xampp\mysql\bin\mysql.exe --host=HOST --port=PORT --user=USER --password --ssl `
  --database=saraza_apartment -e "source database/cloud-tables.sql"
```
</details>

### B3. Add the connection to Vercel

In Vercel, open your project → **Settings** → **Environment Variables** and add these
(`.env.example` in the project root has the same list):

| Key | Value |
|---|---|
| `SARAZA_DB_HOST` | host from B1 |
| `SARAZA_DB_PORT` | `4000` (TiDB) or Aiven's port |
| `SARAZA_DB_NAME` | `saraza_apartment` |
| `SARAZA_DB_USER` | user from B1 (TiDB: include the `xxxx.` prefix) |
| `SARAZA_DB_PASS` | password from B1 |
| `SARAZA_DB_SSL` | `1` |
| `SARAZA_DB_SSL_CA_PEM` | **Aiven only:** open `ca.pem` in Notepad and paste all of it, including the `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines |

Leave the environments as **Production, Preview, and Development**.

Environment variables only apply to **new** deployments. After adding or changing them, go to
**Deployments** → the latest one → **⋯** → **Redeploy**.

### B4. Test it

Open `https://YOUR-PROJECT.vercel.app/api/health.php`. You should see:

```json
{"ok":true,"database":"connected","tables":20,"session_store":"db","upload_store":"db"}
```

`"session_store":"db"` and `"upload_store":"db"` confirm that the app detected Vercel and is
keeping sign-ins and uploaded files in the database (Vercel's disk is read-only).

Then open the site, sign in as `josephine.saraza@gmail.com` / `admin123`, and **change the
password right away** (Settings → Security). The starting password is public in this repo.

---

## Troubleshooting

Start with `/api/health.php`. It names the problem without showing your password or host.

| `problem` says | What to do |
|---|---|
| **Access denied** | Wrong user or password. On TiDB the user must include the prefix (`3xYz….root`). If you lost the password, generate a new one in the Connect dialog and update `SARAZA_DB_PASS`. |
| **Database not found** | The import didn't run or went into a different database. Re-run B2, or set `SARAZA_DB_NAME` to the name you used. |
| **Cannot reach the database server** | Check `SARAZA_DB_HOST` and `SARAZA_DB_PORT` for typos and extra spaces. Make sure the cluster is running (free tiers can pause) and allows connections from `0.0.0.0/0`. On XAMPP, make sure MySQL is started. |
| **TLS problem** | Set `SARAZA_DB_SSL` to `1`. On Aiven, paste the full CA into `SARAZA_DB_SSL_CA_PEM`. |
| **Missing tables: sessions, uploads** | Your database predates the Vercel version. Run `database/cloud-tables.sql` (see B2). |
| **Missing tables: …** (others) | The import stopped partway. Re-run B2 and watch for an error message. |
| **No admin account** | The `users` table is empty or the admin is disabled. Re-import, or re-enable the admin in the `users` table. |
| **Database connection failed** | Something else. In Vercel, open **Logs** and look for a line starting with `[saraza] health:`. |

Other common problems:

- **I changed an environment variable but nothing changed.** Redeploy. Variables only apply to new deployments.
- **The import command says `'<' operator is reserved`.** PowerShell doesn't support `< file`.
  Use `-e "source database/saraza_apartment.sql"` as shown above.
- **The import command says `TLS/SSL error ... SEC_E_DECRYPT_FAILURE`.** Add `--tls-version=TLSv1.2`
  to the command. XAMPP's MySQL client on Windows can't complete TiDB's TLS 1.3 handshake.
- **Pages take many seconds when XAMPP uses the cloud database.** That's expected: each page runs many
  small queries, and each one travels to Singapore and back. On Vercel the app and the database are in
  the same region, so it's fast. For work on your PC, use the local XAMPP database.
- **The import fails with `Unknown collation` or `utf8mb4_unicode_ci`.** The server is too old.
  Use MySQL 5.7+, MariaDB 10.3+, or TiDB.
- **Signing in works, but I'm signed out on the next click (Vercel).** The `sessions` table is
  missing. The health check shows this; run `database/cloud-tables.sql`.
- **Uploads fail with "too large" on Vercel.** That's expected above 4 MB per file. Vercel
  rejects request bodies over 4.5 MB.

---

## Back up before re-importing

Before re-importing or making big changes, save a copy of the current data:

```powershell
# local XAMPP
C:\xampp\mysql\bin\mysqldump.exe -u root saraza_apartment > backup.sql

# cloud (add --ssl-ca=... for Aiven)
C:\xampp\mysql\bin\mysqldump.exe --host=HOST --port=PORT --user=USER --password --ssl `
  --single-transaction saraza_apartment > backup.sql
```

To restore, import `backup.sql` the same way as in A2/B2 (add `--database=saraza_apartment`).
Don't commit backups to Git: they contain tenants' personal details and password hashes.

Admins can also download a JSON export from **Settings → Data & backup → Export everything** inside the app.

---

## What's in the database

| Group | Tables |
|---|---|
| Property | `buildings`, `unit_types`, `units` |
| People and logins | `tenants`, `users`, `staff` |
| Money | `charges`, `payments`, `payment_methods`, `expenses`, `categories` |
| Maintenance | `maintenance_requests`, `maintenance_media` |
| Messages | `notifications`, `messages` |
| Records | `activity_log`, `report_log`, `settings` |
| Vercel only | `sessions` (sign-ins), `uploads` (payment proofs, request photos) |

Times are stored in Philippine time (`+08:00`). The app sets this on every connection, so the
database server's own time zone doesn't matter.
