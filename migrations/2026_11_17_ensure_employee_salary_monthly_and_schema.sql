-- Migration: 2026_11_17_ensure_employee_salary_monthly_and_schema.sql
-- Purpose: Permanently resolve SQLSTATE[42S22] Unknown column 'salary_monthly' in 'INSERT INTO'
--          on solar_employees / solar_employee, backfill any legacy 'salary' values,
--          refresh the solar_employees compatibility view, and ensure solar_employee_documents schema.
-- Safe & Idempotent: Can be executed repeatedly on production MySQL / MariaDB without data loss.

-- 1. Determine whether solar_employee exists as a BASE TABLE and/or solar_employees as BASE TABLE / VIEW
SET @emp_base_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'solar_employee'
    AND TABLE_TYPE = 'BASE TABLE'
);

SET @emps_base_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'solar_employees'
    AND TABLE_TYPE = 'BASE TABLE'
);

SET @emps_view_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'solar_employees'
    AND TABLE_TYPE = 'VIEW'
);

-- 2. If neither table exists yet, create solar_employees cleanly
SET @sql_create_emps = IF(@emp_base_exists = 0 AND @emps_base_exists = 0 AND @emps_view_exists = 0,
  'CREATE TABLE IF NOT EXISTS `solar_employees` (
    `id` VARCHAR(64) PRIMARY KEY,
    `employee_code` VARCHAR(32) NOT NULL UNIQUE,
    `name` VARCHAR(255) NOT NULL,
    `photo_url` TEXT DEFAULT NULL,
    `documents_json` LONGTEXT DEFAULT NULL,
    `department` VARCHAR(64) NOT NULL DEFAULT ''Operations'',
    `designation` VARCHAR(128) NOT NULL DEFAULT ''Solar Engineer'',
    `phone` VARCHAR(32) NOT NULL DEFAULT '''',
    `email` VARCHAR(191) NOT NULL DEFAULT '''',
    `joining_date` DATE DEFAULT NULL,
    `salary_monthly` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(32) DEFAULT ''ACTIVE'',
    `current_site_location` VARCHAR(255) DEFAULT '''',
    `login_enabled` TINYINT(1) DEFAULT 1,
    `auth_uid` VARCHAR(64) DEFAULT NULL,
    `system_role` VARCHAR(64) DEFAULT ''Site Survey Engineer'',
    `assigned_role` VARCHAR(64) DEFAULT NULL,
    `is_field_worker` TINYINT(1) DEFAULT 0,
    `account_status` VARCHAR(32) DEFAULT ''ACTIVE'',
    `account_created_at` VARCHAR(64) DEFAULT NULL,
    `account_created_by` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql_create_emps;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add salary_monthly & any missing columns on solar_employee (if it is a BASE TABLE)
SET @target_emp_tbl = IF(@emp_base_exists > 0, 'solar_employee', IF(@emps_base_exists > 0, 'solar_employees', 'solar_employees'));

SET @has_salary_monthly = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'salary_monthly'
);
SET @sql_add_salary = IF(@has_salary_monthly = 0,
  CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `salary_monthly` DECIMAL(12,2) NOT NULL DEFAULT 0.00;'),
  'SELECT 1;'
);
PREPARE stmt FROM @sql_add_salary;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Backfill salary_monthly from legacy 'salary' column if it exists
SET @has_legacy_salary = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'salary'
);
SET @sql_backfill_salary = IF(@has_legacy_salary > 0,
  CONCAT('UPDATE `', @target_emp_tbl, '` SET `salary_monthly` = COALESCE(`salary`, 0.00) WHERE (`salary_monthly` IS NULL OR `salary_monthly` = 0) AND `salary` IS NOT NULL AND `salary` > 0;'),
  'SELECT 1;'
);
PREPARE stmt FROM @sql_backfill_salary;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Ensure all other required employee columns exist on target base table
SET @has_photo_url = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'photo_url');
SET @sql_stmt = IF(@has_photo_url = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `photo_url` TEXT DEFAULT NULL;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_docs_json = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'documents_json');
SET @sql_stmt = IF(@has_docs_json = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `documents_json` LONGTEXT DEFAULT NULL;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_joining_date = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'joining_date');
SET @sql_stmt = IF(@has_joining_date = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `joining_date` DATE DEFAULT NULL;'), CONCAT('ALTER TABLE `', @target_emp_tbl, '` MODIFY COLUMN `joining_date` DATE DEFAULT NULL;'));
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_site_loc = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'current_site_location');
SET @sql_stmt = IF(@has_site_loc = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `current_site_location` VARCHAR(255) DEFAULT '''';'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_login = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'login_enabled');
SET @sql_stmt = IF(@has_login = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `login_enabled` TINYINT(1) DEFAULT 1;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_auth_uid = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'auth_uid');
SET @sql_stmt = IF(@has_auth_uid = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `auth_uid` VARCHAR(64) DEFAULT NULL;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_sys_role = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'system_role');
SET @sql_stmt = IF(@has_sys_role = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `system_role` VARCHAR(64) DEFAULT ''Site Survey Engineer'';'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_assigned_role = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'assigned_role');
SET @sql_stmt = IF(@has_assigned_role = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `assigned_role` VARCHAR(64) DEFAULT NULL;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fw = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'is_field_worker');
SET @sql_stmt = IF(@has_fw = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `is_field_worker` TINYINT(1) DEFAULT 0;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_acc_status = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'account_status');
SET @sql_stmt = IF(@has_acc_status = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `account_status` VARCHAR(32) DEFAULT ''ACTIVE'';'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_acc_at = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'account_created_at');
SET @sql_stmt = IF(@has_acc_at = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `account_created_at` VARCHAR(64) DEFAULT NULL;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_acc_by = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'account_created_by');
SET @sql_stmt = IF(@has_acc_by = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `account_created_by` VARCHAR(255) DEFAULT NULL;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_updated_at = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @target_emp_tbl AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@has_updated_at = 0, CONCAT('ALTER TABLE `', @target_emp_tbl, '` ADD COLUMN `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;'), 'SELECT 1;');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. If solar_employees is a VIEW over solar_employee, refresh the view so salary_monthly and all new columns are exposed
SET @sql_refresh_view = IF(@emp_base_exists > 0 AND @emps_view_exists > 0,
  'CREATE OR REPLACE SQL SECURITY INVOKER VIEW `solar_employees` AS SELECT * FROM `solar_employee`;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql_refresh_view;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Ensure solar_employee_documents exists
CREATE TABLE IF NOT EXISTS `solar_employee_documents` (
  `id` VARCHAR(64) PRIMARY KEY,
  `employee_id` VARCHAR(64) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(128) NOT NULL,
  `file_size` BIGINT DEFAULT 0,
  `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` VARCHAR(255) DEFAULT 'HR Administrator',
  `notes` TEXT,
  INDEX `idx_emp_docs_empid` (`employee_id`),
  INDEX `idx_emp_docs_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
