-- ============================================================
--  Saraza's Apartment — Property Management System
--  MySQL / MariaDB / TiDB database: schema + starting data
--
--  Import in phpMyAdmin (Import tab) or from a shell:
--     mysql -u root < saraza_apartment.sql
--  Importing DELETES and recreates the saraza_apartment database.
--
--  This is a clean start: no tenants, payments, repairs or notices.
--  It sets up only
--     - the administrator login (below)
--     - the property: 2 buildings, 20 units, all available to rent
--     - default settings, house rules, repair categories, payment methods
--
--  Administrator login:
--     josephine.saraza@gmail.com  /  admin123   (Josephine Saraza)
--  Change this password in Settings right after the first sign-in.
--
--  To finish setting up, sign in and open Settings to add
--     - the office phone number
--     - the GCash / Maya / bank details, then turn those methods on
--  Tenants are added from the Tenants page; each gets their own login.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+08:00';
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS `saraza_apartment`;
CREATE DATABASE `saraza_apartment` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `saraza_apartment`;

-- ---------------- Settings ----------------
CREATE TABLE `settings` (
  `skey`   VARCHAR(64) NOT NULL PRIMARY KEY,
  `svalue` TEXT NULL
) ENGINE=InnoDB;

-- ---------------- Property ----------------
CREATE TABLE `buildings` (
  `id`      VARCHAR(8)   NOT NULL PRIMARY KEY,
  `name`    VARCHAR(80)  NOT NULL,
  `floors`  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `address` VARCHAR(200) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE `unit_types` (
  `tkey`      VARCHAR(16) NOT NULL PRIMARY KEY,
  `label`     VARCHAR(40) NOT NULL,
  `beds`      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `size_sqm`  DECIMAL(6,1) NOT NULL DEFAULT 0,
  `base_rent` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `sort_order` TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE `units` (
  `id`          VARCHAR(12) NOT NULL PRIMARY KEY,          -- the unit number, e.g. 201 or A103
  `building_id` VARCHAR(8)  NOT NULL,
  `floor`       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `type_key`    VARCHAR(16) NOT NULL,
  `size_sqm`    DECIMAL(6,1) NOT NULL DEFAULT 0,
  `bathrooms`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `furnishing`  VARCHAR(40) NOT NULL DEFAULT 'Unfurnished',
  `rent`        DECIMAL(10,2) NOT NULL,
  `status`      ENUM('occupied','vacant','repair') NOT NULL DEFAULT 'vacant',
  `notes`       VARCHAR(500) NOT NULL DEFAULT '',
  `vacant_since` DATE NULL,
  CONSTRAINT `fk_units_building` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_units_type` FOREIGN KEY (`type_key`) REFERENCES `unit_types`(`tkey`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------- People ----------------
CREATE TABLE `tenants` (
  `id`                 VARCHAR(8)   NOT NULL PRIMARY KEY,   -- T001
  `unit_id`            VARCHAR(12)  NULL,
  `name`               VARCHAR(120) NOT NULL,
  `phone`              VARCHAR(40)  NOT NULL DEFAULT '',
  `email`              VARCHAR(160) NOT NULL DEFAULT '',
  `occupation`         VARCHAR(80)  NOT NULL DEFAULT '',
  `occupants`          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `emergency_name`     VARCHAR(120) NOT NULL DEFAULT '',
  `emergency_relation` VARCHAR(40)  NOT NULL DEFAULT '',
  `emergency_phone`    VARCHAR(40)  NOT NULL DEFAULT '',
  `contract_no`        VARCHAR(20)  NOT NULL DEFAULT '',
  `move_in`            DATE NOT NULL,
  `lease_end`          DATE NULL,
  `moved_out`          DATE NULL,
  `rent`               DECIMAL(10,2) NOT NULL,
  `deposit`            DECIMAL(10,2) NOT NULL DEFAULT 0,
  `advance`            DECIMAL(10,2) NOT NULL DEFAULT 0,
  `status`             ENUM('current','notice','moved_out') NOT NULL DEFAULT 'current',
  `created_at`         DATETIME NOT NULL,
  KEY `idx_tenant_unit` (`unit_id`),
  CONSTRAINT `fk_tenant_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `role`          ENUM('admin','tenant') NOT NULL,
  `tenant_id`     VARCHAR(8)   NULL,
  `name`          VARCHAR(120) NOT NULL,
  `username`      VARCHAR(60)  NULL UNIQUE,
  `email`         VARCHAR(160) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL,
  `created_at`    DATETIME NOT NULL,
  CONSTRAINT `fk_user_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `staff` (
  `id`        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`   INT UNSIGNED NULL,
  `name`      VARCHAR(120) NOT NULL,
  `role`      ENUM('Owner','Administrator','Caretaker','Maintenance','Contractor') NOT NULL,
  `email`     VARCHAR(160) NOT NULL DEFAULT '',
  `phone`     VARCHAR(40)  NOT NULL DEFAULT '',
  `is_crew`   TINYINT(1) NOT NULL DEFAULT 0,             -- can be assigned repairs
  `last_active` DATETIME NULL,
  CONSTRAINT `fk_staff_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------- Money ----------------
CREATE TABLE `payment_methods` (
  `mkey`       VARCHAR(16) NOT NULL PRIMARY KEY,
  `label`      VARCHAR(40) NOT NULL,
  `icon`       VARCHAR(24) NOT NULL,
  `detail`     VARCHAR(160) NOT NULL DEFAULT '',
  `sort_order` TINYINT NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- What a tenant owes: monthly rent, utilities, late fees, other.
CREATE TABLE `charges` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`   VARCHAR(8)   NOT NULL,
  `kind`        ENUM('rent','utility','late_fee','deposit','other') NOT NULL,
  `label`       VARCHAR(120) NOT NULL,
  `detail`      VARCHAR(200) NOT NULL DEFAULT '',
  `period`      DATE NULL,                 -- first day of the month billed (rent / late fees)
  `amount`      DECIMAL(10,2) NOT NULL,
  `amount_paid` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `due_date`    DATE NOT NULL,
  `status`      ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `paid_on`     DATE NULL,
  `created_at`  DATETIME NOT NULL,
  UNIQUE KEY `uq_charge_period` (`tenant_id`, `kind`, `period`),
  KEY `idx_charge_due` (`due_date`),
  CONSTRAINT `fk_charge_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3001;

-- What a tenant paid. Tenant-submitted payments start as pending until the admin confirms them.
CREATE TABLE `payments` (
  `id`           VARCHAR(12)  NOT NULL PRIMARY KEY,         -- PMT-1001
  `tenant_id`    VARCHAR(8)   NOT NULL,
  `unit_id`      VARCHAR(12)  NULL,
  `charge_id`    INT UNSIGNED NULL,
  `paid_on`      DATE NOT NULL,
  `method`       VARCHAR(40)  NOT NULL,
  `covers`       VARCHAR(120) NOT NULL DEFAULT '',
  `amount`       DECIMAL(10,2) NOT NULL,
  `reference`    VARCHAR(80)  NOT NULL DEFAULT '',
  `notes`        VARCHAR(255) NOT NULL DEFAULT '',
  `status`       ENUM('pending','cleared','rejected') NOT NULL DEFAULT 'cleared',
  `proof_path`   VARCHAR(255) NULL,
  `submitted_by` ENUM('admin','tenant') NOT NULL DEFAULT 'admin',
  `recorded_by`  VARCHAR(120) NOT NULL DEFAULT '',
  `applied`      TINYINT(1) NOT NULL DEFAULT 0,
  `unapplied`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL,
  `cleared_at`   DATETIME NULL,
  KEY `idx_pay_tenant` (`tenant_id`),
  KEY `idx_pay_date` (`paid_on`),
  CONSTRAINT `fk_pay_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `expenses` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `expense_date` DATE NOT NULL,
  `category`     VARCHAR(60)  NOT NULL,
  `description`  VARCHAR(200) NOT NULL DEFAULT '',
  `amount`       DECIMAL(10,2) NOT NULL,
  `created_at`   DATETIME NOT NULL
) ENGINE=InnoDB;

-- ---------------- Maintenance ----------------
CREATE TABLE `categories` (
  `ckey`       VARCHAR(16) NOT NULL PRIMARY KEY,
  `label`      VARCHAR(40) NOT NULL,
  `icon`       VARCHAR(24) NOT NULL,
  `sort_order` TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE `maintenance_requests` (
  `id`            VARCHAR(12) NOT NULL PRIMARY KEY,          -- MR-2041
  `unit_id`       VARCHAR(12) NOT NULL,
  `tenant_id`     VARCHAR(8)  NULL,                          -- NULL = common area / caretaker
  `title`         VARCHAR(160) NOT NULL,
  `details`       TEXT NULL,
  `category`      VARCHAR(16) NOT NULL,
  `priority`      ENUM('urgent','high','normal','low') NOT NULL DEFAULT 'normal',
  `status`        ENUM('new','scheduled','in-progress','done') NOT NULL DEFAULT 'new',
  `assignee`      VARCHAR(120) NULL,
  `scheduled_for` DATE NULL,
  `cost`          DECIMAL(10,2) NOT NULL DEFAULT 0,
  `allow_entry`   TINYINT(1) NOT NULL DEFAULT 0,
  `admin_notes`   TEXT NULL,
  `resolution`    VARCHAR(255) NOT NULL DEFAULT '',
  `rating`        TINYINT UNSIGNED NULL,
  `follow_ups`    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL,
  `received_at`   DATETIME NULL,
  `assigned_at`   DATETIME NULL,
  `started_at`    DATETIME NULL,
  `resolved_at`   DATETIME NULL,
  KEY `idx_req_status` (`status`),
  CONSTRAINT `fk_req_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_req_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_req_cat` FOREIGN KEY (`category`) REFERENCES `categories`(`ckey`) ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `maintenance_media` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `request_id` VARCHAR(12)  NOT NULL,
  `kind`       ENUM('photo','video') NOT NULL,
  `file_name`  VARCHAR(160) NOT NULL,
  `file_path`  VARCHAR(255) NULL,          -- NULL for demo rows with no file on disk
  `created_at` DATETIME NOT NULL,
  CONSTRAINT `fk_media_req` FOREIGN KEY (`request_id`) REFERENCES `maintenance_requests`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- Communication ----------------
CREATE TABLE `notifications` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT UNSIGNED NOT NULL,
  `tone`       ENUM('red','amber','green','teal') NOT NULL DEFAULT 'teal',
  `icon`       VARCHAR(24) NOT NULL DEFAULT 'bell',
  `title`      VARCHAR(160) NOT NULL,
  `body`       VARCHAR(500) NOT NULL DEFAULT '',
  `link`       VARCHAR(160) NOT NULL DEFAULT '',
  `dedupe_key` VARCHAR(100) NULL,
  `is_read`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  UNIQUE KEY `uq_notif_dedupe` (`dedupe_key`),
  KEY `idx_notif_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `messages` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`   VARCHAR(8)  NOT NULL,
  `direction`   ENUM('to_admin','to_tenant') NOT NULL,
  `subject`     VARCHAR(160) NOT NULL,
  `body`        TEXT NOT NULL,
  `created_at`  DATETIME NOT NULL,
  CONSTRAINT `fk_msg_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------- Audit ----------------
CREATE TABLE `activity_log` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT UNSIGNED NULL,
  `user_name`  VARCHAR(120) NOT NULL,
  `action`     VARCHAR(80)  NOT NULL,
  `detail`     VARCHAR(500) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL,
  KEY `idx_log_time` (`created_at`)
) ENGINE=InnoDB;

CREATE TABLE `report_log` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `report_type` VARCHAR(32)  NOT NULL,
  `name`        VARCHAR(160) NOT NULL,
  `period`      VARCHAR(20)  NOT NULL,
  `building_id` VARCHAR(8)   NULL,
  `format`      VARCHAR(8)   NOT NULL,
  `rows_count`  INT UNSIGNED NOT NULL DEFAULT 0,
  `generated_by` VARCHAR(120) NOT NULL,
  `created_at`  DATETIME NOT NULL
) ENGINE=InnoDB;

-- ---------------- Cloud hosting (Vercel) ----------------
-- Used when SARAZA_SESSION_STORE=db / SARAZA_UPLOAD_STORE=db (the defaults on Vercel),
-- where the server keeps no files between requests. Unused on XAMPP.
CREATE TABLE `sessions` (
  `id`         VARCHAR(128) NOT NULL PRIMARY KEY,
  `data`       MEDIUMBLOB NOT NULL,
  `expires_at` INT UNSIGNED NOT NULL,
  KEY `idx_sess_exp` (`expires_at`)
) ENGINE=InnoDB;

CREATE TABLE `uploads` (
  `path`       VARCHAR(255) NOT NULL PRIMARY KEY,   -- matches payments.proof_path / maintenance_media.file_path
  `mime`       VARCHAR(100) NOT NULL,
  `size`       INT UNSIGNED NOT NULL,
  `data`       LONGBLOB NOT NULL,
  `created_at` DATETIME NOT NULL
) ENGINE=InnoDB;


-- ============================================================
--  Starting data
-- ============================================================

INSERT INTO `settings` (`skey`, `svalue`) VALUES
  ('property_name', 'Saraza''s Apartment'),
  ('owner_name', 'Josephine Saraza'),
  ('contact_phone', ''),
  ('contact_email', 'josephine.saraza@gmail.com'),
  ('address', '4109 Jose St., GTDL, Valenzuela City'),
  ('currency', 'PHP'),
  ('timezone', 'Asia/Manila'),
  ('receipt_note', 'Thank you for paying on time. Please keep this receipt for your records.'),
  ('rent_due_day', '5'),
  ('grace_days', '3'),
  ('late_fee', 'flat200'),
  ('deposit_months', '2'),
  ('advance_months', '1'),
  ('monthly_target', '141600'),
  ('notify_tenant_on_clear', '1'),
  ('notif_payment', '1'),
  ('notif_overdue', '1'),
  ('notif_maintenance', '1'),
  ('notif_urgent', '1'),
  ('notif_lease', '1'),
  ('notif_vacant', '1'),
  ('session_timeout', '30'),
  ('emergency_name', 'Valenzuela City Emergency Hotline'),
  ('emergency_phone', '911'),
  ('house_rules', 'Quiet hours are 10:00 PM to 6:00 AM.
Visitors staying overnight must be logged with the caretaker.
No pets without written approval from the owner.
Garbage is collected Monday, Wednesday, and Friday mornings.
Give 30 days written notice before moving out.'),
  ('inclusions', 'Own water meter
Own electric sub-meter
Wi-Fi ready
Shared laundry area'),
  ('exclusions', 'Water and electricity billed separately
Parking not included');

INSERT INTO `buildings` (`id`, `name`, `floors`, `address`) VALUES
  ('B1', 'Jose St. Building', 2, '4109 Jose St., GTDL, Valenzuela City'),
  ('B2', 'Jacinto St. Building', 2, '311 Jacinto St., Canumay, Valenzuela City');

INSERT INTO `unit_types` (`tkey`, `label`, `beds`, `size_sqm`, `base_rent`, `sort_order`) VALUES
  ('studio', 'Studio', 0, 18, 6500, 1),
  ('1br', '1-Bedroom', 1, 26, 7200, 2),
  ('2br', '2-Bedroom', 2, 38, 9800, 3),
  ('bedspace', 'Bedspace', 0, 12, 3800, 4);

INSERT INTO `units` (`id`, `building_id`, `floor`, `type_key`, `size_sqm`, `bathrooms`, `furnishing`, `rent`, `status`, `notes`, `vacant_since`) VALUES
  ('101', 'B1', 1, 'studio', 18, 1, 'Semi-furnished', 6500, 'vacant', '', NULL),
  ('102', 'B1', 1, '1br', 26, 1, 'Semi-furnished', 7000, 'vacant', '', NULL),
  ('103', 'B1', 1, '2br', 38, 2, 'Unfurnished', 9500, 'vacant', '', NULL),
  ('104', 'B1', 1, 'bedspace', 12, 1, 'Fully furnished', 3800, 'vacant', '', NULL),
  ('105', 'B1', 1, '2br', 38, 2, 'Unfurnished', 10000, 'vacant', '', NULL),
  ('201', 'B1', 2, '1br', 26, 1, 'Semi-furnished', 7200, 'vacant', '', NULL),
  ('202', 'B1', 2, 'studio', 18, 1, 'Semi-furnished', 6700, 'vacant', '', NULL),
  ('203', 'B1', 2, '2br', 38, 2, 'Unfurnished', 9800, 'vacant', '', NULL),
  ('204', 'B1', 2, '1br', 26, 1, 'Semi-furnished', 7200, 'vacant', '', NULL),
  ('205', 'B1', 2, '1br', 26, 1, 'Semi-furnished', 7400, 'vacant', '', NULL),
  ('J101', 'B2', 1, '1br', 26, 1, 'Semi-furnished', 6800, 'vacant', '', NULL),
  ('J102', 'B2', 1, 'studio', 18, 1, 'Semi-furnished', 6200, 'vacant', '', NULL),
  ('J103', 'B2', 1, '2br', 38, 2, 'Unfurnished', 9200, 'vacant', '', NULL),
  ('J104', 'B2', 1, 'bedspace', 12, 1, 'Fully furnished', 3600, 'vacant', '', NULL),
  ('J105', 'B2', 1, 'studio', 18, 1, 'Semi-furnished', 6900, 'vacant', '', NULL),
  ('J201', 'B2', 2, '1br', 26, 1, 'Semi-furnished', 7000, 'vacant', '', NULL),
  ('J202', 'B2', 2, '2br', 38, 2, 'Unfurnished', 9400, 'vacant', '', NULL),
  ('J203', 'B2', 2, 'studio', 18, 1, 'Semi-furnished', 6400, 'vacant', '', NULL),
  ('J204', 'B2', 2, '1br', 26, 1, 'Semi-furnished', 7000, 'vacant', '', NULL),
  ('J205', 'B2', 2, 'bedspace', 12, 1, 'Fully furnished', 4000, 'vacant', '', NULL);

INSERT INTO `users` (`id`, `role`, `tenant_id`, `name`, `username`, `email`, `password_hash`, `is_active`, `last_login_at`, `created_at`) VALUES
  (1, 'admin', NULL, 'Josephine Saraza', NULL, 'josephine.saraza@gmail.com', '$2y$12$RYQ0YZ3tt70ace3zcjLYn.oHzq92PTpsFsyC4Bv/jOJeESp3R1A7K', 1, NULL, NOW());

INSERT INTO `staff` (`id`, `user_id`, `name`, `role`, `email`, `phone`, `is_crew`, `last_active`) VALUES
  (1, 1, 'Josephine Saraza', 'Owner', 'josephine.saraza@gmail.com', '', 0, NULL);

-- Cash is on from the start. GCash, Maya and bank transfer stay off until
-- their account details are filled in under Settings -> Payment methods.
INSERT INTO `payment_methods` (`mkey`, `label`, `icon`, `detail`, `sort_order`, `is_active`) VALUES
  ('gcash', 'GCash', 'smartphone', '', 1, 0),
  ('maya', 'Maya', 'wallet', '', 2, 0),
  ('bank', 'Bank transfer', 'bank', '', 3, 0),
  ('cash', 'Cash', 'cash', 'Pay at the office and ask for a receipt', 4, 1);

INSERT INTO `categories` (`ckey`, `label`, `icon`, `sort_order`) VALUES
  ('plumbing', 'Plumbing', 'droplet', 1),
  ('electrical', 'Electrical', 'bolt', 2),
  ('appliance', 'Appliance', 'wrench', 3),
  ('structural', 'Structural', 'building', 4),
  ('pest', 'Pest control', 'bug', 5),
  ('paint', 'Paint & finish', 'paint', 6),
  ('other', 'Something else', 'more', 7);

SET FOREIGN_KEY_CHECKS = 1;
