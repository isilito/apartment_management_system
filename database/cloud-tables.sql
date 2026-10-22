-- ============================================================
--  Adds the two tables the Vercel deployment needs to a database
--  that was imported before they existed. Safe to run twice.
--  (A fresh import of saraza_apartment.sql already includes them.)
-- ============================================================

CREATE TABLE IF NOT EXISTS `sessions` (
  `id`         VARCHAR(128) NOT NULL PRIMARY KEY,
  `data`       MEDIUMBLOB NOT NULL,
  `expires_at` INT UNSIGNED NOT NULL,
  KEY `idx_sess_exp` (`expires_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `uploads` (
  `path`       VARCHAR(255) NOT NULL PRIMARY KEY,
  `mime`       VARCHAR(100) NOT NULL,
  `size`       INT UNSIGNED NOT NULL,
  `data`       LONGBLOB NOT NULL,
  `created_at` DATETIME NOT NULL
) ENGINE=InnoDB;
