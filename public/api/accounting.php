<?php
/**
 * Rejoy Solar ERP - Accounting & Finance PHP API Handler
 * Mirrors server/services/accountingService.ts for production Hostinger PHP runtime.
 */

function accRound2($val) {
    return round(floatval($val), 2);
}

function accRandHex($bytes = 3) {
    return bin2hex(random_bytes($bytes));
}

function accRandDigits($digits = 4) {
    $min = (int)pow(10, $digits - 1);
    $max = (int)pow(10, $digits) - 1;
    return (string)random_int($min, $max);
}

function accTodaySql() {
    return date('Y-m-d');
}

function accToSqlDate($val) {
    if (empty($val)) return null;
    $s = trim((string)$val);
    if ($s === '') return null;
    if (strpos($s, 'T') !== false) return explode('T', $s)[0];
    return strlen($s) >= 10 ? substr($s, 0, 10) : $s;
}

function accAddColumnIfMissing($pdo, $table, $col, $def) {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `{$table}` LIKE ?");
        $stmt->execute([$col]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$def}");
        }
    } catch (Exception $e) {
        error_log("Notice adding {$table}.{$col}: " . $e->getMessage());
    }
}

function ensureAccountingTablesPhp($pdo) {
    static $accReady = false;
    if ($accReady) return;

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_accounts` (
        `id` VARCHAR(64) PRIMARY KEY,
        `code` VARCHAR(32) NOT NULL UNIQUE,
        `name` VARCHAR(255) NOT NULL,
        `account_type` VARCHAR(32) NOT NULL,
        `sub_type` VARCHAR(64) DEFAULT '',
        `parent_id` VARCHAR(64) DEFAULT NULL,
        `description` TEXT,
        `opening_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `current_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `is_system` TINYINT(1) NOT NULL DEFAULT 0,
        `is_active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_acc_type` (`account_type`),
        INDEX `idx_acc_active` (`is_active`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_journal_entries` (
        `id` VARCHAR(64) PRIMARY KEY,
        `entry_number` VARCHAR(64) NOT NULL UNIQUE,
        `entry_date` DATE NOT NULL,
        `reference_type` VARCHAR(64) DEFAULT '',
        `reference_id` VARCHAR(64) DEFAULT '',
        `reference_number` VARCHAR(64) DEFAULT '',
        `narration` TEXT NOT NULL,
        `total_debit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `total_credit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        `reversed_entry_id` VARCHAR(64) DEFAULT NULL,
        `posted_by` VARCHAR(255) DEFAULT '',
        `posted_at` VARCHAR(64) DEFAULT NULL,
        `created_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_je_date` (`entry_date`),
        INDEX `idx_je_status` (`status`),
        INDEX `idx_je_ref` (`reference_type`, `reference_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_journal_lines` (
        `id` VARCHAR(64) PRIMARY KEY,
        `journal_id` VARCHAR(64) NOT NULL,
        `line_order` INT NOT NULL DEFAULT 0,
        `account_id` VARCHAR(64) NOT NULL,
        `account_code` VARCHAR(32) DEFAULT '',
        `account_name` VARCHAR(255) DEFAULT '',
        `description` VARCHAR(500) DEFAULT '',
        `project_id` VARCHAR(64) DEFAULT '',
        `project_title` VARCHAR(255) DEFAULT '',
        `party_type` VARCHAR(32) DEFAULT 'NONE',
        `party_id` VARCHAR(64) DEFAULT '',
        `party_name` VARCHAR(255) DEFAULT '',
        `debit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `credit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        INDEX `idx_jl_journal` (`journal_id`),
        INDEX `idx_jl_account` (`account_id`),
        INDEX `idx_jl_project` (`project_id`),
        CONSTRAINT `fk_jl_journal` FOREIGN KEY (`journal_id`) REFERENCES `solar_acc_journal_entries` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_bank_accounts` (
        `id` VARCHAR(64) PRIMARY KEY,
        `account_name` VARCHAR(255) NOT NULL,
        `account_type` VARCHAR(16) NOT NULL DEFAULT 'BANK',
        `bank_name` VARCHAR(255) DEFAULT '',
        `account_number` VARCHAR(64) DEFAULT '',
        `ifsc_code` VARCHAR(32) DEFAULT '',
        `branch` VARCHAR(255) DEFAULT '',
        `coa_account_id` VARCHAR(64) DEFAULT '',
        `opening_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `current_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
        `is_active` TINYINT(1) NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_bank_transfers` (
        `id` VARCHAR(64) PRIMARY KEY,
        `transfer_number` VARCHAR(64) NOT NULL UNIQUE,
        `transfer_date` DATE NOT NULL,
        `from_account_id` VARCHAR(64) NOT NULL,
        `to_account_id` VARCHAR(64) NOT NULL,
        `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `mode` VARCHAR(64) DEFAULT 'Bank Transfer',
        `reference_no` VARCHAR(128) DEFAULT '',
        `notes` TEXT,
        `journal_entry_id` VARCHAR(64) DEFAULT '',
        `created_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_bt_date` (`transfer_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_bank_reconciliations` (
        `id` VARCHAR(64) PRIMARY KEY,
        `bank_account_id` VARCHAR(64) NOT NULL,
        `statement_date` DATE NOT NULL,
        `book_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `statement_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `cleared_txn_ids_json` LONGTEXT,
        `difference` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        `notes` TEXT,
        `reconciled_by` VARCHAR(255) DEFAULT '',
        `reconciled_at` VARCHAR(64) DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_br_bank` (`bank_account_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_vendor_bills` (
        `id` VARCHAR(64) PRIMARY KEY,
        `bill_number` VARCHAR(64) NOT NULL UNIQUE,
        `vendor_id` VARCHAR(64) NOT NULL,
        `vendor_name` VARCHAR(255) NOT NULL,
        `vendor_gst` VARCHAR(64) DEFAULT '',
        `po_id` VARCHAR(64) DEFAULT '',
        `po_number` VARCHAR(64) DEFAULT '',
        `project_id` VARCHAR(64) DEFAULT '',
        `project_title` VARCHAR(255) DEFAULT '',
        `bill_date` DATE NOT NULL,
        `due_date` DATE DEFAULT NULL,
        `category` VARCHAR(128) DEFAULT 'Material Purchase',
        `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `cgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `sgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `igst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `gst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tds_section` VARCHAR(32) DEFAULT '',
        `tds_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        `tds_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `paid_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `balance_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `itc_eligible` TINYINT(1) NOT NULL DEFAULT 1,
        `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        `expense_account_id` VARCHAR(64) DEFAULT '',
        `journal_entry_id` VARCHAR(64) DEFAULT '',
        `notes` TEXT,
        `items_json` LONGTEXT,
        `created_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_vb_vendor` (`vendor_id`),
        INDEX `idx_vb_status` (`status`),
        INDEX `idx_vb_due` (`due_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_vendor_payments` (
        `id` VARCHAR(64) PRIMARY KEY,
        `payment_number` VARCHAR(64) NOT NULL UNIQUE,
        `bill_id` VARCHAR(64) NOT NULL,
        `vendor_id` VARCHAR(64) NOT NULL,
        `vendor_name` VARCHAR(255) NOT NULL,
        `payment_date` DATE NOT NULL,
        `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tds_deducted` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `net_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `bank_account_id` VARCHAR(64) DEFAULT '',
        `payment_mode` VARCHAR(64) DEFAULT 'Bank NEFT/RTGS',
        `reference_no` VARCHAR(128) DEFAULT '',
        `notes` TEXT,
        `journal_entry_id` VARCHAR(64) DEFAULT '',
        `recorded_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_vp_bill` (`bill_id`),
        INDEX `idx_vp_vendor` (`vendor_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_tds_entries` (
        `id` VARCHAR(64) PRIMARY KEY,
        `section` VARCHAR(32) NOT NULL,
        `party_type` VARCHAR(32) DEFAULT 'VENDOR',
        `party_id` VARCHAR(64) DEFAULT '',
        `party_name` VARCHAR(255) NOT NULL,
        `pan_number` VARCHAR(32) DEFAULT '',
        `source_type` VARCHAR(32) NOT NULL,
        `source_id` VARCHAR(64) NOT NULL,
        `source_number` VARCHAR(64) DEFAULT '',
        `deduction_date` DATE NOT NULL,
        `gross_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tds_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        `tds_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `status` VARCHAR(32) NOT NULL DEFAULT 'DEDUCTED',
        `challan_no` VARCHAR(64) DEFAULT '',
        `bsr_code` VARCHAR(32) DEFAULT '',
        `deposit_date` DATE DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_tds_status` (`status`),
        INDEX `idx_tds_date` (`deduction_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_budgets` (
        `id` VARCHAR(64) PRIMARY KEY,
        `name` VARCHAR(255) NOT NULL,
        `fiscal_year` VARCHAR(32) NOT NULL,
        `period_type` VARCHAR(32) NOT NULL DEFAULT 'ANNUAL',
        `period_label` VARCHAR(64) NOT NULL,
        `department` VARCHAR(128) DEFAULT '',
        `category` VARCHAR(128) DEFAULT '',
        `project_id` VARCHAR(64) DEFAULT '',
        `project_title` VARCHAR(255) DEFAULT '',
        `account_id` VARCHAR(64) DEFAULT '',
        `allocated_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `notes` TEXT,
        `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        `created_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_budget_fy` (`fiscal_year`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_fixed_assets` (
        `id` VARCHAR(64) PRIMARY KEY,
        `asset_code` VARCHAR(64) NOT NULL UNIQUE,
        `name` VARCHAR(255) NOT NULL,
        `category` VARCHAR(128) NOT NULL,
        `purchase_date` DATE NOT NULL,
        `vendor_name` VARCHAR(255) DEFAULT '',
        `purchase_cost` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `salvage_value` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `useful_life_years` INT NOT NULL DEFAULT 5,
        `depreciation_method` VARCHAR(16) NOT NULL DEFAULT 'SLM',
        `depreciation_rate` DECIMAL(6,2) NOT NULL DEFAULT 20.00,
        `accumulated_depreciation` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `book_value` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `last_depreciation_date` DATE DEFAULT NULL,
        `asset_account_id` VARCHAR(64) DEFAULT '',
        `dep_expense_account_id` VARCHAR(64) DEFAULT '',
        `location` VARCHAR(255) DEFAULT '',
        `custodian` VARCHAR(255) DEFAULT '',
        `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        `disposal_date` DATE DEFAULT NULL,
        `disposal_proceeds` DECIMAL(14,2) DEFAULT 0.00,
        `disposal_gain_loss` DECIMAL(14,2) DEFAULT 0.00,
        `disposal_journal_id` VARCHAR(64) DEFAULT NULL,
        `purchase_journal_id` VARCHAR(64) DEFAULT NULL,
        `payment_bank_account_id` VARCHAR(64) DEFAULT '',
        `notes` TEXT,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_fa_status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_asset_depreciation` (
        `id` VARCHAR(64) PRIMARY KEY,
        `asset_id` VARCHAR(64) NOT NULL,
        `period_label` VARCHAR(64) NOT NULL,
        `run_date` DATE NOT NULL,
        `opening_book_value` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `depreciation_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `closing_book_value` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `journal_entry_id` VARCHAR(64) DEFAULT '',
        `run_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_ad_asset` (`asset_id`),
        CONSTRAINT `fk_ad_asset` FOREIGN KEY (`asset_id`) REFERENCES `solar_acc_fixed_assets` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_settings` (
        `id` VARCHAR(64) PRIMARY KEY,
        `fiscal_year_start_month` INT NOT NULL DEFAULT 4,
        `active_fiscal_year` VARCHAR(32) NOT NULL DEFAULT '2026-27',
        `lock_date` DATE DEFAULT NULL,
        `currency` VARCHAR(16) NOT NULL DEFAULT 'INR',
        `approval_threshold` DECIMAL(14,2) NOT NULL DEFAULT 10000.00,
        `require_expense_approval` TINYINT(1) NOT NULL DEFAULT 1,
        `auto_post_erp_vouchers` TINYINT(1) NOT NULL DEFAULT 1,
        `journal_prefix` VARCHAR(16) NOT NULL DEFAULT 'JV-',
        `bill_prefix` VARCHAR(16) NOT NULL DEFAULT 'BILL-',
        `voucher_prefix` VARCHAR(16) NOT NULL DEFAULT 'VOU-',
        `default_cash_account_id` VARCHAR(64) DEFAULT 'acc-1010',
        `default_bank_account_id` VARCHAR(64) DEFAULT 'acc-1020',
        `default_ar_account_id` VARCHAR(64) DEFAULT 'acc-1100',
        `default_ap_account_id` VARCHAR(64) DEFAULT 'acc-2010',
        `default_sales_account_id` VARCHAR(64) DEFAULT 'acc-4010',
        `default_cogs_account_id` VARCHAR(64) DEFAULT 'acc-5010',
        `default_output_gst_account_id` VARCHAR(64) DEFAULT 'acc-2100',
        `default_input_gst_account_id` VARCHAR(64) DEFAULT 'acc-1150',
        `default_tds_account_id` VARCHAR(64) DEFAULT 'acc-2150',
        `default_payroll_account_id` VARCHAR(64) DEFAULT 'acc-5030',
        `default_dep_expense_account_id` VARCHAR(64) DEFAULT 'acc-5060',
        `default_disposal_gain_loss_account_id` VARCHAR(64) DEFAULT 'acc-4090',
        `updated_by` VARCHAR(255) DEFAULT '',
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_acc_audit_logs` (
        `id` VARCHAR(64) PRIMARY KEY,
        `actor_id` VARCHAR(64) NOT NULL,
        `actor_name` VARCHAR(255) NOT NULL,
        `actor_role` VARCHAR(64) NOT NULL,
        `module` VARCHAR(64) NOT NULL,
        `action` VARCHAR(64) NOT NULL,
        `entity_id` VARCHAR(64) DEFAULT '',
        `entity_ref` VARCHAR(128) DEFAULT '',
        `summary` TEXT NOT NULL,
        `details_json` LONGTEXT,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_acc_audit_module` (`module`),
        INDEX `idx_acc_audit_created` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    accAddColumnIfMissing($pdo, 'solar_acc_fixed_assets', 'payment_bank_account_id', "VARCHAR(64) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_payments', 'invoice_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_payments', 'invoice_number', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_payments', 'bank_account_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_payments', 'journal_entry_id', "VARCHAR(64) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_expenses', 'expense_type', "VARCHAR(32) DEFAULT 'DIRECT_EXPENSE'");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'status', "VARCHAR(32) DEFAULT 'PAID'");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'employee_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'employee_name', "VARCHAR(255) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'gst_amount', "DECIMAL(14,2) DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'itc_eligible', "TINYINT(1) DEFAULT 0");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'bank_account_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'expense_account_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'journal_entry_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'approved_at', "VARCHAR(64) DEFAULT NULL");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'rejection_reason', "TEXT");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'paid_at', "VARCHAR(64) DEFAULT NULL");
    accAddColumnIfMissing($pdo, 'solar_expenses', 'paid_by', "VARCHAR(255) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'cgst_amount', "DECIMAL(14,2) DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'sgst_amount', "DECIMAL(14,2) DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'igst_amount', "DECIMAL(14,2) DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'einvoice_irn', "VARCHAR(128) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'einvoice_ack_no', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'einvoice_ack_date', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'einvoice_status', "VARCHAR(32) DEFAULT 'NOT_GENERATED'");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'returned_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'refunded_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_sales_invoices', 'bank_account_id', "VARCHAR(64) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_vendor_sales_invoices', 'returned_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_vendor_sales_invoices', 'refunded_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_vendor_sales_invoices', 'bank_account_id', "VARCHAR(64) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_vendor_sales_payments', 'bank_account_id', "VARCHAR(64) DEFAULT ''");
    accAddColumnIfMissing($pdo, 'solar_vendor_sales_payments', 'journal_entry_id', "VARCHAR(64) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_purchase_orders', 'paid_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_purchase_orders', 'returned_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_purchase_orders', 'refunded_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_purchase_orders', 'balance_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_purchase_orders', 'bank_account_id', "VARCHAR(64) DEFAULT ''");

    accAddColumnIfMissing($pdo, 'solar_acc_vendor_bills', 'returned_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    accAddColumnIfMissing($pdo, 'solar_acc_vendor_bills', 'refunded_amount', "DECIMAL(14,2) NOT NULL DEFAULT 0.00");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_sales_returns` (
        `id` VARCHAR(64) PRIMARY KEY,
        `return_number` VARCHAR(64) NOT NULL UNIQUE,
        `return_date` DATE NOT NULL,
        `target_type` VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER_INVOICE',
        `invoice_id` VARCHAR(64) NOT NULL,
        `invoice_number` VARCHAR(64) DEFAULT '',
        `party_id` VARCHAR(64) DEFAULT '',
        `party_name` VARCHAR(255) NOT NULL,
        `project_id` VARCHAR(64) DEFAULT '',
        `project_title` VARCHAR(255) DEFAULT '',
        `reason` VARCHAR(500) DEFAULT '',
        `notes` TEXT,
        `warehouse_id` VARCHAR(64) DEFAULT '',
        `warehouse_name` VARCHAR(255) DEFAULT '',
        `restock_inventory` TINYINT(1) NOT NULL DEFAULT 1,
        `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `cgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `sgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `igst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `settlement_mode` VARCHAR(32) NOT NULL DEFAULT 'CREDIT_NOTE',
        `refund_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `bank_account_id` VARCHAR(64) DEFAULT '',
        `bank_account_name` VARCHAR(255) DEFAULT '',
        `credit_journal_entry_id` VARCHAR(64) DEFAULT '',
        `refund_journal_entry_id` VARCHAR(64) DEFAULT '',
        `status` VARCHAR(32) NOT NULL DEFAULT 'POSTED',
        `created_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_sr_invoice` (`target_type`, `invoice_id`),
        INDEX `idx_sr_date` (`return_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_sales_return_items` (
        `id` VARCHAR(64) PRIMARY KEY,
        `return_id` VARCHAR(64) NOT NULL,
        `line_order` INT NOT NULL DEFAULT 0,
        `product_id` VARCHAR(64) DEFAULT NULL,
        `description` VARCHAR(500) NOT NULL,
        `hsn_code` VARCHAR(32) DEFAULT '',
        `unit` VARCHAR(32) NOT NULL DEFAULT 'Nos',
        `original_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
        `quantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
        `rate` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `taxable_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        `cgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `sgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `igst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        INDEX `idx_sri_return` (`return_id`),
        CONSTRAINT `fk_sri_return` FOREIGN KEY (`return_id`) REFERENCES `solar_sales_returns` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_purchase_returns` (
        `id` VARCHAR(64) PRIMARY KEY,
        `return_number` VARCHAR(64) NOT NULL UNIQUE,
        `return_date` DATE NOT NULL,
        `purchase_order_id` VARCHAR(64) NOT NULL,
        `po_number` VARCHAR(64) DEFAULT '',
        `vendor_bill_id` VARCHAR(64) DEFAULT '',
        `vendor_id` VARCHAR(64) DEFAULT '',
        `vendor_name` VARCHAR(255) NOT NULL,
        `project_id` VARCHAR(64) DEFAULT '',
        `project_title` VARCHAR(255) DEFAULT '',
        `reason` VARCHAR(500) DEFAULT '',
        `notes` TEXT,
        `warehouse_id` VARCHAR(64) DEFAULT '',
        `warehouse_name` VARCHAR(255) DEFAULT '',
        `deduct_inventory` TINYINT(1) NOT NULL DEFAULT 1,
        `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `cgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `sgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `igst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `settlement_mode` VARCHAR(32) NOT NULL DEFAULT 'DEBIT_NOTE',
        `refund_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `bank_account_id` VARCHAR(64) DEFAULT '',
        `bank_account_name` VARCHAR(255) DEFAULT '',
        `debit_journal_entry_id` VARCHAR(64) DEFAULT '',
        `refund_journal_entry_id` VARCHAR(64) DEFAULT '',
        `status` VARCHAR(32) NOT NULL DEFAULT 'POSTED',
        `created_by` VARCHAR(255) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_pr_po` (`purchase_order_id`),
        INDEX `idx_pr_date` (`return_date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `solar_purchase_return_items` (
        `id` VARCHAR(64) PRIMARY KEY,
        `return_id` VARCHAR(64) NOT NULL,
        `line_order` INT NOT NULL DEFAULT 0,
        `product_id` VARCHAR(64) DEFAULT NULL,
        `description` VARCHAR(500) NOT NULL,
        `hsn_code` VARCHAR(32) DEFAULT '',
        `unit` VARCHAR(32) NOT NULL DEFAULT 'Nos',
        `original_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
        `quantity` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
        `rate` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `taxable_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        `cgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `sgst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `igst_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `tax_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        INDEX `idx_pri_return` (`return_id`),
        CONSTRAINT `fk_pri_return` FOREIGN KEY (`return_id`) REFERENCES `solar_purchase_returns` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $cnt = (int)$pdo->query('SELECT COUNT(*) FROM `solar_acc_accounts`')->fetchColumn();
    if ($cnt === 0) {
        $defaults = [
            ['acc-1010','1010','Cash in Hand (Petty Cash)','ASSET','Cash','Physical office & site petty cash register'],
            ['acc-1020','1020','Primary Current Bank Account','ASSET','Bank','Primary operating corporate bank account'],
            ['acc-1100','1100','Accounts Receivable (Sundry Debtors)','ASSET','Current Asset','Customer EPC milestone & sales receivables'],
            ['acc-1150','1150','Input GST Credit (ITC Receivable)','ASSET','Tax Asset','Eligible CGST/SGST/IGST Input Tax Credit on purchases'],
            ['acc-1200','1200','Solar Inventory & Stock-in-Hand','ASSET','Inventory','Modules, inverters, BOS & warehouse stock valuation'],
            ['acc-1500','1500','Fixed Assets - Plant, Tools & Vehicles','ASSET','Fixed Asset','Capitalized tools, site vehicles, office equipment'],
            ['acc-1590','1590','Accumulated Depreciation','ASSET','Contra Asset','Cumulative depreciation on capitalized fixed assets'],
            ['acc-2010','2010','Accounts Payable (Sundry Creditors)','LIABILITY','Current Liability','Vendor bills & supplier payables'],
            ['acc-2100','2100','Output GST Payable','LIABILITY','Tax Liability','CGST/SGST/IGST collected on sales invoices'],
            ['acc-2150','2150','TDS Payable','LIABILITY','Tax Liability','Tax deducted at source pending government challan deposit'],
            ['acc-2200','2200','Payroll & Salary Payable','LIABILITY','Current Liability','Accrued monthly employee salaries & reimbursements'],
            ['acc-2300','2300','Customer Advance & Booking Deposits','LIABILITY','Current Liability','Unbilled milestone advances received from customers'],
            ['acc-3010','3010','Share Capital / Owner Equity','EQUITY','Capital','Paid-up share capital and owner equity'],
            ['acc-3020','3020','Retained Earnings & Reserves','EQUITY','Reserves','Accumulated prior-period earnings'],
            ['acc-4010','4010','Solar EPC Installation Revenue','REVENUE','Operating Revenue','Revenue from rooftop & ground-mount EPC contracts'],
            ['acc-4020','4020','AMC & Service Maintenance Revenue','REVENUE','Operating Revenue','Annual maintenance contracts & paid service visits'],
            ['acc-4030','4030','Vendor Sales & Equipment Trading Revenue','REVENUE','Operating Revenue','B2B solar equipment sales to vendors/partners'],
            ['acc-4090','4090','Other Income / Asset Disposal Gain-Loss','REVENUE','Other Income','Miscellaneous income and fixed asset disposal variance'],
            ['acc-5010','5010','Cost of Solar Equipment & Materials (COGS)','EXPENSE','Direct Cost','PV panels, inverters, structures, cables & BOS procurement'],
            ['acc-5020','5020','Site Execution & Subcontractor Costs','EXPENSE','Direct Cost','Civil, mounting, electrical labor & net-metering permits'],
            ['acc-5030','5030','Salaries, Wages & Payroll Expense','EXPENSE','Operating Expense','Employee monthly salaries, overtime & incentives'],
            ['acc-5040','5040','Travel, Fuel & Field Operations Expense','EXPENSE','Operating Expense','Site travel, logistics, fuel & employee reimbursements'],
            ['acc-5050','5050','Office Rent, Utilities & Admin Overheads','EXPENSE','Operating Expense','Rent, electricity, software, marketing & general overheads'],
            ['acc-5060','5060','Depreciation & Amortization Expense','EXPENSE','Non-Cash Expense','SLM/WDV periodic fixed asset depreciation'],
            ['acc-5090','5090','Bank Charges & Loss on Asset Disposal','EXPENSE','Other Expense','Bank transaction fees & write-off losses'],
        ];
        $ins = $pdo->prepare("INSERT IGNORE INTO `solar_acc_accounts` (`id`,`code`,`name`,`account_type`,`sub_type`,`description`,`opening_balance`,`current_balance`,`is_system`,`is_active`) VALUES (?,?,?,?,?,?,0,0,1,1)");
        foreach ($defaults as $d) $ins->execute($d);
    }

    $bcnt = (int)$pdo->query('SELECT COUNT(*) FROM `solar_acc_bank_accounts`')->fetchColumn();
    if ($bcnt === 0) {
        $pdo->exec("INSERT IGNORE INTO `solar_acc_bank_accounts` (`id`,`account_name`,`account_type`,`bank_name`,`account_number`,`ifsc_code`,`branch`,`coa_account_id`,`opening_balance`,`current_balance`,`is_primary`,`is_active`) VALUES
            ('bank-cash-main','Office Petty Cash Register','CASH','Cash Drawer','CASH-01','','Head Office','acc-1010',0,0,0,1),
            ('bank-main-current','Primary Corporate Current Account','BANK','Operating Bank','REJOY-CORP-001','','Main Branch','acc-1020',0,0,1,1)");
    }

    $pdo->exec("INSERT IGNORE INTO `solar_acc_settings` (`id`,`fiscal_year_start_month`,`active_fiscal_year`,`currency`,`approval_threshold`) VALUES ('default', 4, '2026-27', 'INR', 10000.00)");
    $accReady = true;
}

function accRequireViewerPhp($actor) {
    $role = trim((string)($actor['role'] ?? ''));
    $acctType = strtoupper(trim((string)($actor['accountType'] ?? '')));
    if ($acctType === 'CUSTOMER' || strtoupper($role) === 'CUSTOMER') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied: Customer accounts cannot access internal accounting.']);
        exit;
    }
    $allowed = ['Admin', 'Super Admin', 'Accountant', 'Project Manager', 'Sales Manager', 'HR Manager'];
    if (!in_array($role, $allowed, true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied: Finance module privileges required.']);
        exit;
    }
}

function accRequireManagerPhp($actor) {
    $role = trim((string)($actor['role'] ?? ''));
    if (!in_array($role, ['Admin', 'Super Admin', 'Accountant'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied: Admin or Accountant authorization required.']);
        exit;
    }
}

function accGetSettingsRowPhp($pdo) {
    $row = $pdo->query("SELECT * FROM `solar_acc_settings` WHERE `id` = 'default' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    return $row ?: [
        'id' => 'default', 'fiscal_year_start_month' => 4, 'active_fiscal_year' => '2026-27',
        'lock_date' => null, 'currency' => 'INR', 'approval_threshold' => 10000,
        'require_expense_approval' => 1, 'auto_post_erp_vouchers' => 1,
        'journal_prefix' => 'JV-', 'bill_prefix' => 'BILL-', 'voucher_prefix' => 'VOU-',
        'default_cash_account_id' => 'acc-1010', 'default_bank_account_id' => 'acc-1020',
        'default_ar_account_id' => 'acc-1100', 'default_ap_account_id' => 'acc-2010',
        'default_sales_account_id' => 'acc-4010', 'default_cogs_account_id' => 'acc-5010',
        'default_output_gst_account_id' => 'acc-2100', 'default_input_gst_account_id' => 'acc-1150',
        'default_tds_account_id' => 'acc-2150', 'default_payroll_account_id' => 'acc-5030',
        'default_dep_expense_account_id' => 'acc-5060', 'default_disposal_gain_loss_account_id' => 'acc-4090'
    ];
}

function accAssertNotLockedPhp($pdo, $entryDate) {
    $settings = accGetSettingsRowPhp($pdo);
    $lockDate = accToSqlDate($settings['lock_date'] ?? null);
    if ($lockDate && $entryDate <= $lockDate) {
        throw new Exception("Accounting period is locked on or before {$lockDate}.");
    }
}

function accLogAuditPhp($pdo, $actor, $module, $action, $entityId, $entityRef, $summary, $details = null) {
    $id = 'audit-' . round(microtime(true) * 1000) . '-' . rand(100, 9999);
    $stmt = $pdo->prepare("INSERT INTO `solar_acc_audit_logs` (`id`,`actor_id`,`actor_name`,`actor_role`,`module`,`action`,`entity_id`,`entity_ref`,`summary`,`details_json`) VALUES (?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $id,
        (string)($actor['id'] ?? 'system'),
        (string)($actor['name'] ?? $actor['email'] ?? 'System'),
        (string)($actor['role'] ?? 'Admin'),
        $module, $action, $entityId, $entityRef, $summary,
        $details ? json_encode($details) : null
    ]);
}

function accRecalcBalancesPhp($pdo) {
    $accounts = $pdo->query('SELECT `id`, `account_type`, `opening_balance` FROM `solar_acc_accounts`')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $sums = $pdo->query("SELECT l.`account_id`, SUM(l.`debit`) AS sd, SUM(l.`credit`) AS sc FROM `solar_acc_journal_lines` l INNER JOIN `solar_acc_journal_entries` e ON e.`id` = l.`journal_id` WHERE e.`status` IN ('POSTED','REVERSED') GROUP BY l.`account_id`")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $map = [];
    foreach ($sums as $s) {
        $map[$s['account_id']] = ['d' => floatval($s['sd']), 'c' => floatval($s['sc'])];
    }
    $upd = $pdo->prepare('UPDATE `solar_acc_accounts` SET `current_balance` = ? WHERE `id` = ?');
    foreach ($accounts as $a) {
        $op = floatval($a['opening_balance']);
        $t = $map[$a['id']] ?? ['d' => 0, 'c' => 0];
        $isDr = ($a['account_type'] === 'ASSET' || $a['account_type'] === 'EXPENSE');
        $bal = $isDr ? accRound2($op + $t['d'] - $t['c']) : accRound2($op + $t['c'] - $t['d']);
        $upd->execute([$bal, $a['id']]);
    }
}

function accInsertJournalTxPhp($pdo, $params, $actor) {
    $settings = accGetSettingsRowPhp($pdo);
    $prefix = $settings['journal_prefix'] ?? 'JV-';
    $entryDate = accToSqlDate($params['entryDate'] ?? '') ?: accTodaySql();
    $status = ($params['status'] ?? 'POSTED') === 'DRAFT' ? 'DRAFT' : 'POSTED';
    if ($status === 'POSTED') accAssertNotLockedPhp($pdo, $entryDate);

    $lines = array_values(array_filter($params['lines'] ?? [], function ($l) {
        return !empty($l['accountId']) && (accRound2($l['debit'] ?? 0) > 0 || accRound2($l['credit'] ?? 0) > 0);
    }));
    if (count($lines) < 2) throw new Exception('A journal entry requires at least 2 valid debit/credit lines.');

    $td = 0; $tc = 0;
    foreach ($lines as $l) {
        $d = accRound2($l['debit'] ?? 0);
        $c = accRound2($l['credit'] ?? 0);
        if ($d < 0 || $c < 0) throw new Exception('Amounts cannot be negative.');
        if ($d > 0 && $c > 0) throw new Exception('Each line must be either Debit or Credit.');
        $td = accRound2($td + $d);
        $tc = accRound2($tc + $c);
    }
    if ($status === 'POSTED' && abs($td - $tc) >= 0.01) {
        throw new Exception("Double-entry imbalance: Debit {$td} != Credit {$tc}");
    }

    $accRows = $pdo->query('SELECT `id`, `code`, `name` FROM `solar_acc_accounts`')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $accMap = [];
    foreach ($accRows as $ar) $accMap[$ar['id']] = $ar;

    $id = 'je-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
    $entryNo = !empty($params['entryNumber']) ? $params['entryNumber'] : ($prefix . str_replace('-', '', $entryDate) . '-' . accRandDigits(4) . '-' . accRandHex(1));

    $stmt = $pdo->prepare("INSERT INTO `solar_acc_journal_entries` (`id`,`entry_number`,`entry_date`,`reference_type`,`reference_id`,`reference_number`,`narration`,`total_debit`,`total_credit`,`status`,`posted_by`,`posted_at`,`created_by`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $id, $entryNo, $entryDate,
        $params['referenceType'] ?? 'MANUAL', $params['referenceId'] ?? '', $params['referenceNumber'] ?? '',
        $params['narration'] ?? 'Accounting Journal Entry',
        $td, $tc, $status,
        $status === 'POSTED' ? ($actor['name'] ?? 'Admin') : '',
        $status === 'POSTED' ? gmdate('c') : null,
        $actor['name'] ?? 'Admin'
    ]);

    $lStmt = $pdo->prepare("INSERT INTO `solar_acc_journal_lines` (`id`,`journal_id`,`line_order`,`account_id`,`account_code`,`account_name`,`description`,`project_id`,`project_title`,`party_type`,`party_id`,`party_name`,`debit`,`credit`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $ord = 1;
    foreach ($lines as $l) {
        if (!isset($accMap[$l['accountId']])) throw new Exception('Invalid account ID: ' . $l['accountId']);
        $meta = $accMap[$l['accountId']];
        $lStmt->execute([
            'jl-' . round(microtime(true) * 1000) . '-' . $ord . '-' . rand(10, 999),
            $id, $ord++, $l['accountId'], $meta['code'], $meta['name'],
            $l['description'] ?? '', $l['projectId'] ?? '', $l['projectTitle'] ?? '',
            $l['partyType'] ?? 'NONE', $l['partyId'] ?? '', $l['partyName'] ?? '',
            accRound2($l['debit'] ?? 0), accRound2($l['credit'] ?? 0)
        ]);
    }
    if ($status === 'POSTED') accRecalcBalancesPhp($pdo);
    return $id;
}

function accGetWorkspacePhp($pdo) {
    ensureAccountingTablesPhp($pdo);
    $accounts = $pdo->query('SELECT * FROM `solar_acc_accounts` ORDER BY `code` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $entries = $pdo->query('SELECT * FROM `solar_acc_journal_entries` ORDER BY `entry_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $lines = $pdo->query('SELECT * FROM `solar_acc_journal_lines` ORDER BY `line_order` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $banks = $pdo->query('SELECT * FROM `solar_acc_bank_accounts` ORDER BY `is_primary` DESC, `account_type` ASC, `account_name` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $transfers = $pdo->query('SELECT * FROM `solar_acc_bank_transfers` ORDER BY `transfer_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $recons = $pdo->query('SELECT * FROM `solar_acc_bank_reconciliations` ORDER BY `statement_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $bills = $pdo->query('SELECT * FROM `solar_acc_vendor_bills` ORDER BY `bill_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $vPays = $pdo->query('SELECT * FROM `solar_acc_vendor_payments` ORDER BY `payment_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $tds = $pdo->query('SELECT * FROM `solar_acc_tds_entries` ORDER BY `deduction_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $budgets = $pdo->query('SELECT * FROM `solar_acc_budgets` ORDER BY `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $assets = $pdo->query('SELECT * FROM `solar_acc_fixed_assets` ORDER BY `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $depLogs = $pdo->query('SELECT * FROM `solar_acc_asset_depreciation` ORDER BY `run_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $sRow = accGetSettingsRowPhp($pdo);
    $audits = $pdo->query('SELECT * FROM `solar_acc_audit_logs` ORDER BY `created_at` DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $linesByJ = [];
    foreach ($lines as $l) {
        $linesByJ[$l['journal_id']][] = [
            'id' => $l['id'], 'journalId' => $l['journal_id'], 'lineOrder' => intval($l['line_order']),
            'accountId' => $l['account_id'], 'accountCode' => $l['account_code'] ?? '', 'accountName' => $l['account_name'] ?? '',
            'description' => $l['description'] ?? '', 'projectId' => $l['project_id'] ?? '', 'projectTitle' => $l['project_title'] ?? '',
            'partyType' => $l['party_type'] ?? 'NONE', 'partyId' => $l['party_id'] ?? '', 'partyName' => $l['party_name'] ?? '',
            'debit' => floatval($l['debit']), 'credit' => floatval($l['credit'])
        ];
    }
    $bankNames = [];
    foreach ($banks as $b) $bankNames[$b['id']] = $b['account_name'];
    $billNums = [];
    foreach ($bills as $vb) $billNums[$vb['id']] = $vb['bill_number'];
    $assetMeta = [];
    foreach ($assets as $a) $assetMeta[$a['id']] = ['code' => $a['asset_code'], 'name' => $a['name']];

    return [
        'accounts' => array_map(function ($a) {
            return [
                'id' => $a['id'], 'code' => $a['code'], 'name' => $a['name'], 'accountType' => $a['account_type'],
                'subType' => $a['sub_type'] ?? '', 'parentId' => $a['parent_id'] ?? null, 'description' => $a['description'] ?? '',
                'openingBalance' => floatval($a['opening_balance']), 'currentBalance' => floatval($a['current_balance']),
                'isSystem' => boolval($a['is_system']), 'isActive' => intval($a['is_active']) !== 0,
                'createdAt' => $a['created_at'], 'updatedAt' => $a['updated_at']
            ];
        }, $accounts),
        'journals' => array_map(function ($e) use ($linesByJ) {
            return [
                'id' => $e['id'], 'entryNumber' => $e['entry_number'], 'entryDate' => accToSqlDate($e['entry_date']) ?: '',
                'referenceType' => $e['reference_type'] ?? '', 'referenceId' => $e['reference_id'] ?? '', 'referenceNumber' => $e['reference_number'] ?? '',
                'narration' => $e['narration'] ?? '', 'totalDebit' => floatval($e['total_debit']), 'totalCredit' => floatval($e['total_credit']),
                'status' => $e['status'] ?? 'DRAFT', 'reversedEntryId' => $e['reversed_entry_id'] ?? null,
                'postedBy' => $e['posted_by'] ?? '', 'postedAt' => $e['posted_at'] ?? null, 'createdBy' => $e['created_by'] ?? '',
                'lines' => $linesByJ[$e['id']] ?? [], 'createdAt' => $e['created_at'], 'updatedAt' => $e['updated_at']
            ];
        }, $entries),
        'bankAccounts' => array_map(function ($b) {
            return [
                'id' => $b['id'], 'accountName' => $b['account_name'], 'accountType' => $b['account_type'],
                'bankName' => $b['bank_name'] ?? '', 'accountNumber' => $b['account_number'] ?? '',
                'ifscCode' => $b['ifsc_code'] ?? '', 'branch' => $b['branch'] ?? '', 'coaAccountId' => $b['coa_account_id'] ?? '',
                'openingBalance' => floatval($b['opening_balance']), 'currentBalance' => floatval($b['current_balance']),
                'isPrimary' => boolval($b['is_primary']), 'isActive' => intval($b['is_active']) !== 0,
                'createdAt' => $b['created_at'], 'updatedAt' => $b['updated_at']
            ];
        }, $banks),
        'bankTransfers' => array_map(function ($t) use ($bankNames) {
            return [
                'id' => $t['id'], 'transferNumber' => $t['transfer_number'], 'transferDate' => accToSqlDate($t['transfer_date']) ?: '',
                'fromAccountId' => $t['from_account_id'], 'fromAccountName' => $bankNames[$t['from_account_id']] ?? $t['from_account_id'],
                'toAccountId' => $t['to_account_id'], 'toAccountName' => $bankNames[$t['to_account_id']] ?? $t['to_account_id'],
                'amount' => floatval($t['amount']), 'mode' => $t['mode'] ?? 'Bank Transfer', 'referenceNo' => $t['reference_no'] ?? '',
                'notes' => $t['notes'] ?? '', 'journalEntryId' => $t['journal_entry_id'] ?? '', 'createdBy' => $t['created_by'] ?? '', 'createdAt' => $t['created_at']
            ];
        }, $transfers),
        'bankReconciliations' => array_map(function ($r) use ($bankNames) {
            $cl = json_decode($r['cleared_txn_ids_json'] ?? '[]', true);
            return [
                'id' => $r['id'], 'bankAccountId' => $r['bank_account_id'], 'bankAccountName' => $bankNames[$r['bank_account_id']] ?? '',
                'statementDate' => accToSqlDate($r['statement_date']) ?: '', 'bookBalance' => floatval($r['book_balance']),
                'statementBalance' => floatval($r['statement_balance']), 'clearedTxnIds' => is_array($cl) ? $cl : [],
                'difference' => floatval($r['difference']), 'status' => $r['status'] ?? 'DRAFT', 'notes' => $r['notes'] ?? '',
                'reconciledBy' => $r['reconciled_by'] ?? '', 'reconciledAt' => $r['reconciled_at'] ?? null, 'createdAt' => $r['created_at']
            ];
        }, $recons),
        'vendorBills' => array_map(function ($vb) {
            $it = json_decode($vb['items_json'] ?? '[]', true);
            return [
                'id' => $vb['id'], 'billNumber' => $vb['bill_number'], 'vendorId' => $vb['vendor_id'], 'vendorName' => $vb['vendor_name'],
                'vendorGst' => $vb['vendor_gst'] ?? '', 'poId' => $vb['po_id'] ?? '', 'poNumber' => $vb['po_number'] ?? '',
                'projectId' => $vb['project_id'] ?? '', 'projectTitle' => $vb['project_title'] ?? '',
                'billDate' => accToSqlDate($vb['bill_date']) ?: '', 'dueDate' => accToSqlDate($vb['due_date']) ?: '',
                'category' => $vb['category'] ?? 'Material Purchase', 'subtotal' => floatval($vb['subtotal']),
                'cgstAmount' => floatval($vb['cgst_amount']), 'sgstAmount' => floatval($vb['sgst_amount']), 'igstAmount' => floatval($vb['igst_amount']),
                'gstAmount' => floatval($vb['gst_amount']), 'tdsSection' => $vb['tds_section'] ?? '', 'tdsRate' => floatval($vb['tds_rate']),
                'tdsAmount' => floatval($vb['tds_amount']), 'totalAmount' => floatval($vb['total_amount']),
                'paidAmount' => floatval($vb['paid_amount']), 'returnedAmount' => floatval($vb['returned_amount'] ?? 0),
                'refundedAmount' => floatval($vb['refunded_amount'] ?? 0), 'balanceAmount' => floatval($vb['balance_amount']),
                'itcEligible' => intval($vb['itc_eligible']) !== 0, 'status' => $vb['status'] ?? 'OPEN',
                'expenseAccountId' => $vb['expense_account_id'] ?? '', 'journalEntryId' => $vb['journal_entry_id'] ?? '',
                'notes' => $vb['notes'] ?? '', 'items' => is_array($it) ? $it : [], 'createdBy' => $vb['created_by'] ?? '',
                'createdAt' => $vb['created_at'], 'updatedAt' => $vb['updated_at']
            ];
        }, $bills),
        'vendorPayments' => array_map(function ($vp) use ($billNums, $bankNames) {
            return [
                'id' => $vp['id'], 'paymentNumber' => $vp['payment_number'], 'billId' => $vp['bill_id'],
                'billNumber' => $billNums[$vp['bill_id']] ?? $vp['bill_id'], 'vendorId' => $vp['vendor_id'], 'vendorName' => $vp['vendor_name'],
                'paymentDate' => accToSqlDate($vp['payment_date']) ?: '', 'amount' => floatval($vp['amount']),
                'tdsDeducted' => floatval($vp['tds_deducted']), 'netPaid' => floatval($vp['net_paid']),
                'bankAccountId' => $vp['bank_account_id'] ?? '', 'bankAccountName' => $bankNames[$vp['bank_account_id']] ?? '',
                'paymentMode' => $vp['payment_mode'] ?? 'Bank NEFT/RTGS', 'referenceNo' => $vp['reference_no'] ?? '',
                'notes' => $vp['notes'] ?? '', 'journalEntryId' => $vp['journal_entry_id'] ?? '',
                'recordedBy' => $vp['recorded_by'] ?? '', 'createdAt' => $vp['created_at']
            ];
        }, $vPays),
        'tdsEntries' => array_map(function ($t) {
            return [
                'id' => $t['id'], 'section' => $t['section'], 'partyType' => $t['party_type'] ?? 'VENDOR',
                'partyId' => $t['party_id'] ?? '', 'partyName' => $t['party_name'], 'panNumber' => $t['pan_number'] ?? '',
                'sourceType' => $t['source_type'], 'sourceId' => $t['source_id'], 'sourceNumber' => $t['source_number'] ?? '',
                'deductionDate' => accToSqlDate($t['deduction_date']) ?: '', 'grossAmount' => floatval($t['gross_amount']),
                'tdsRate' => floatval($t['tds_rate']), 'tdsAmount' => floatval($t['tds_amount']),
                'status' => $t['status'] ?? 'DEDUCTED', 'challanNo' => $t['challan_no'] ?? '',
                'bsrCode' => $t['bsr_code'] ?? '', 'depositDate' => accToSqlDate($t['deposit_date']), 'createdAt' => $t['created_at']
            ];
        }, $tds),
        'budgets' => array_map(function ($b) {
            return [
                'id' => $b['id'], 'name' => $b['name'], 'fiscalYear' => $b['fiscal_year'], 'periodType' => $b['period_type'] ?? 'ANNUAL',
                'periodLabel' => $b['period_label'], 'department' => $b['department'] ?? '', 'category' => $b['category'] ?? '',
                'projectId' => $b['project_id'] ?? '', 'projectTitle' => $b['project_title'] ?? '', 'accountId' => $b['account_id'] ?? '',
                'allocatedAmount' => floatval($b['allocated_amount']), 'notes' => $b['notes'] ?? '', 'status' => $b['status'] ?? 'ACTIVE',
                'createdBy' => $b['created_by'] ?? '', 'createdAt' => $b['created_at'], 'updatedAt' => $b['updated_at']
            ];
        }, $budgets),
        'fixedAssets' => array_map(function ($f) {
            return [
                'id' => $f['id'], 'assetCode' => $f['asset_code'], 'name' => $f['name'], 'category' => $f['category'],
                'purchaseDate' => accToSqlDate($f['purchase_date']) ?: '', 'vendorName' => $f['vendor_name'] ?? '',
                'purchaseCost' => floatval($f['purchase_cost']), 'salvageValue' => floatval($f['salvage_value']),
                'usefulLifeYears' => intval($f['useful_life_years']), 'depreciationMethod' => $f['depreciation_method'] ?? 'SLM',
                'depreciationRate' => floatval($f['depreciation_rate']), 'accumulatedDepreciation' => floatval($f['accumulated_depreciation']),
                'bookValue' => floatval($f['book_value']), 'lastDepreciationDate' => accToSqlDate($f['last_depreciation_date']),
                'assetAccountId' => $f['asset_account_id'] ?? 'acc-1500', 'depExpenseAccountId' => $f['dep_expense_account_id'] ?? 'acc-5060',
                'location' => $f['location'] ?? '', 'custodian' => $f['custodian'] ?? '', 'status' => $f['status'] ?? 'ACTIVE',
                'disposalDate' => accToSqlDate($f['disposal_date']), 'disposalProceeds' => floatval($f['disposal_proceeds']),
                'disposalGainLoss' => floatval($f['disposal_gain_loss']), 'disposalJournalId' => $f['disposal_journal_id'] ?? null,
                'purchaseJournalId' => $f['purchase_journal_id'] ?? null, 'notes' => $f['notes'] ?? '',
                'createdAt' => $f['created_at'], 'updatedAt' => $f['updated_at']
            ];
        }, $assets),
        'assetDepreciationLogs' => array_map(function ($d) use ($assetMeta) {
            $m = $assetMeta[$d['asset_id']] ?? ['code' => '', 'name' => ''];
            return [
                'id' => $d['id'], 'assetId' => $d['asset_id'], 'assetCode' => $m['code'], 'assetName' => $m['name'],
                'periodLabel' => $d['period_label'], 'runDate' => accToSqlDate($d['run_date']) ?: '',
                'openingBookValue' => floatval($d['opening_book_value']), 'depreciationAmount' => floatval($d['depreciation_amount']),
                'closingBookValue' => floatval($d['closing_book_value']), 'journalEntryId' => $d['journal_entry_id'] ?? '',
                'runBy' => $d['run_by'] ?? '', 'createdAt' => $d['created_at']
            ];
        }, $depLogs),
        'settings' => [
            'id' => 'default',
            'fiscalYearStartMonth' => intval($sRow['fiscal_year_start_month'] ?? 4),
            'activeFiscalYear' => $sRow['active_fiscal_year'] ?? '2026-27',
            'lockDate' => accToSqlDate($sRow['lock_date'] ?? null),
            'currency' => $sRow['currency'] ?? 'INR',
            'approvalThreshold' => floatval($sRow['approval_threshold'] ?? 10000),
            'requireExpenseApproval' => intval($sRow['require_expense_approval'] ?? 1) !== 0,
            'autoPostErpVouchers' => intval($sRow['auto_post_erp_vouchers'] ?? 1) !== 0,
            'journalPrefix' => $sRow['journal_prefix'] ?? 'JV-',
            'billPrefix' => $sRow['bill_prefix'] ?? 'BILL-',
            'voucherPrefix' => $sRow['voucher_prefix'] ?? 'VOU-',
            'defaultCashAccountId' => $sRow['default_cash_account_id'] ?? 'acc-1010',
            'defaultBankAccountId' => $sRow['default_bank_account_id'] ?? 'acc-1020',
            'defaultArAccountId' => $sRow['default_ar_account_id'] ?? 'acc-1100',
            'defaultApAccountId' => $sRow['default_ap_account_id'] ?? 'acc-2010',
            'defaultSalesAccountId' => $sRow['default_sales_account_id'] ?? 'acc-4010',
            'defaultCogsAccountId' => $sRow['default_cogs_account_id'] ?? 'acc-5010',
            'defaultOutputGstAccountId' => $sRow['default_output_gst_account_id'] ?? 'acc-2100',
            'defaultInputGstAccountId' => $sRow['default_input_gst_account_id'] ?? 'acc-1150',
            'defaultTdsAccountId' => $sRow['default_tds_account_id'] ?? 'acc-2150',
            'defaultPayrollAccountId' => $sRow['default_payroll_account_id'] ?? 'acc-5030',
            'defaultDepExpenseAccountId' => $sRow['default_dep_expense_account_id'] ?? 'acc-5060',
            'defaultDisposalGainLossAccountId' => $sRow['default_disposal_gain_loss_account_id'] ?? 'acc-4090',
            'updatedBy' => $sRow['updated_by'] ?? '',
            'updatedAt' => $sRow['updated_at'] ?? ''
        ],
        'auditLogs' => array_map(function ($l) {
            $det = !empty($l['details_json']) ? json_decode($l['details_json'], true) : null;
            return [
                'id' => $l['id'], 'actorId' => $l['actor_id'], 'actorName' => $l['actor_name'], 'actorRole' => $l['actor_role'],
                'module' => $l['module'], 'action' => $l['action'], 'entityId' => $l['entity_id'] ?? '',
                'entityRef' => $l['entity_ref'] ?? '', 'summary' => $l['summary'], 'details' => $det, 'createdAt' => $l['created_at']
            ];
        }, $audits)
    ];
}

function accGetBankAccountsPhp($pdo) {
    ensureAccountingTablesPhp($pdo);
    $rows = $pdo->query('SELECT * FROM `solar_acc_bank_accounts` WHERE `is_active` = 1 ORDER BY `is_primary` DESC, `account_name` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    return array_map(function ($b) {
        return [
            'id' => $b['id'],
            'accountName' => $b['account_name'],
            'accountType' => $b['account_type'] ?: 'BANK',
            'bankName' => $b['bank_name'] ?? '',
            'accountNumber' => $b['account_number'] ?? '',
            'ifscCode' => $b['ifsc_code'] ?? '',
            'branch' => $b['branch'] ?? '',
            'coaAccountId' => $b['coa_account_id'] ?? '',
            'openingBalance' => floatval($b['opening_balance'] ?? 0),
            'currentBalance' => floatval($b['current_balance'] ?? 0),
            'isPrimary' => !empty($b['is_primary']),
            'isActive' => intval($b['is_active'] ?? 1) !== 0
        ];
    }, $rows);
}

function accResolveBankAccountTxPhp($pdo, $bankAccountId, $settings, $paymentMode = '') {
    $cleanId = trim((string)($bankAccountId ?? ''));
    if ($cleanId === '') {
        throw new Exception('Please select a Cash/Bank account for this transaction.');
    }
    $s = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
    $s->execute([$cleanId]);
    $bank = $s->fetch(PDO::FETCH_ASSOC);
    if (!$bank) {
        throw new Exception('Selected Cash/Bank account was not found.');
    }
    if (isset($bank['is_active']) && intval($bank['is_active']) === 0) {
        throw new Exception("Cash/Bank account \"{$bank['account_name']}\" is inactive.");
    }
    $isCash = ($bank['account_type'] === 'CASH') || (stripos((string)$paymentMode, 'cash') !== false);
    $coaId = !empty($bank['coa_account_id'])
        ? $bank['coa_account_id']
        : ($isCash ? ($settings['default_cash_account_id'] ?? 'acc-1010') : ($settings['default_bank_account_id'] ?? 'acc-1020'));
    return ['bank' => $bank, 'coaId' => $coaId];
}

function accResolveBankCoaTxPhp($pdo, $bankAccountId, $settings) {
    if (empty($bankAccountId)) return $settings['default_bank_account_id'] ?? 'acc-1020';
    $s = $pdo->prepare('SELECT `account_type`, `coa_account_id` FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
    $s->execute([$bankAccountId]);
    $b = $s->fetch(PDO::FETCH_ASSOC);
    if (!$b) return $settings['default_bank_account_id'] ?? 'acc-1020';
    return !empty($b['coa_account_id'])
        ? $b['coa_account_id']
        : ($b['account_type'] === 'CASH' ? ($settings['default_cash_account_id'] ?? 'acc-1010') : ($settings['default_bank_account_id'] ?? 'acc-1020'));
}

function accEnsureSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor) {
    $status = strtoupper(trim((string)($inv['payment_status'] ?? 'ISSUED')));
    if ($status === 'DRAFT' || $status === 'CANCELLED') return null;
    $total = accRound2($inv['total_amount'] ?? 0);
    if ($total <= 0) return null;

    $chk = $pdo->prepare("SELECT `id` FROM `solar_acc_journal_entries` WHERE `reference_type` = 'SALES_INVOICE' AND `reference_id` = ? AND `status` IN ('POSTED','REVERSED') LIMIT 1");
    $chk->execute([$inv['id']]);
    $exId = $chk->fetchColumn();
    if ($exId) return $exId;

    $gst = accRound2($inv['gst_amount'] ?? 0);
    $sub = accRound2($inv['subtotal'] ?? 0);
    $revAmount = accRound2(($total - $gst) > 0 ? ($total - $gst) : $sub);
    $lines = [
        [
            'accountId' => $settings['default_ar_account_id'] ?? 'acc-1100',
            'description' => "Sales Invoice {$inv['invoice_number']} - {$inv['customer_name']}",
            'projectId' => $inv['project_id'] ?? '',
            'projectTitle' => $inv['project_title'] ?? '',
            'partyType' => 'CUSTOMER',
            'partyId' => $inv['customer_id'] ?? '',
            'partyName' => $inv['customer_name'] ?? '',
            'debit' => $total,
            'credit' => 0
        ],
        [
            'accountId' => $settings['default_sales_account_id'] ?? 'acc-4010',
            'description' => "Solar EPC Revenue - {$inv['invoice_number']}",
            'projectId' => $inv['project_id'] ?? '',
            'projectTitle' => $inv['project_title'] ?? '',
            'partyType' => 'CUSTOMER',
            'partyId' => $inv['customer_id'] ?? '',
            'partyName' => $inv['customer_name'] ?? '',
            'debit' => 0,
            'credit' => $revAmount
        ]
    ];
    if (accRound2($total - $revAmount) > 0) {
        $lines[] = [
            'accountId' => $settings['default_output_gst_account_id'] ?? 'acc-2100',
            'description' => "Output GST - {$inv['invoice_number']}",
            'projectId' => $inv['project_id'] ?? '',
            'debit' => 0,
            'credit' => accRound2($total - $revAmount)
        ];
    }
    $lockDate = accToSqlDate($settings['lock_date'] ?? null);
    $entryDate = accToSqlDate($inv['invoice_date'] ?? '') ?: accTodaySql();
    if ($lockDate && $entryDate <= $lockDate) $entryDate = accTodaySql();
    return accInsertJournalTxPhp($pdo, [
        'entryDate' => $entryDate,
        'referenceType' => 'SALES_INVOICE',
        'referenceId' => $inv['id'],
        'referenceNumber' => $inv['invoice_number'],
        'narration' => "Sales Invoice {$inv['invoice_number']} ({$inv['customer_name']})",
        'status' => 'POSTED',
        'lines' => $lines
    ], $actor);
}

function accEnsureSalesInvoiceJournalPhp($pdo, $invoiceId, $actor = null) {
    ensureAccountingTablesPhp($pdo);
    $startedTx = !$pdo->inTransaction();
    if ($startedTx) $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $s = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1');
        $s->execute([$invoiceId]);
        $inv = $s->fetch(PDO::FETCH_ASSOC);
        if (!$inv) {
            if ($startedTx) $pdo->commit();
            return null;
        }
        $jeId = accEnsureSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);
        if ($startedTx) $pdo->commit();
        return $jeId;
    } catch (Exception $e) {
        if ($startedTx && $pdo->inTransaction()) $pdo->rollBack();
        return null;
    }
}

function accEnsureVendorSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor) {
    $status = strtoupper(trim((string)($inv['status'] ?? 'ISSUED')));
    if ($status === 'DRAFT' || $status === 'CANCELLED') return null;
    $total = accRound2($inv['total_amount'] ?? 0);
    if ($total <= 0) return null;

    $chk = $pdo->prepare("SELECT `id` FROM `solar_acc_journal_entries` WHERE `reference_type` = 'VENDOR_SALES_INVOICE' AND `reference_id` = ? AND `status` IN ('POSTED','REVERSED') LIMIT 1");
    $chk->execute([$inv['id']]);
    $exId = $chk->fetchColumn();
    if ($exId) return $exId;

    $tax = accRound2($inv['tax_amount'] ?? ($inv['gst_amount'] ?? 0));
    $revAmount = accRound2(($total - $tax) > 0 ? ($total - $tax) : floatval($inv['subtotal'] ?? $total));
    $lines = [
        [
            'accountId' => $settings['default_ar_account_id'] ?? 'acc-1100',
            'description' => "Vendor Sales Invoice {$inv['invoice_number']} - {$inv['vendor_name']}",
            'partyType' => 'VENDOR',
            'partyId' => $inv['vendor_id'] ?? '',
            'partyName' => $inv['vendor_name'] ?? '',
            'debit' => $total,
            'credit' => 0
        ],
        [
            'accountId' => 'acc-4030',
            'description' => "Vendor Equipment Sales - {$inv['invoice_number']}",
            'partyType' => 'VENDOR',
            'partyId' => $inv['vendor_id'] ?? '',
            'partyName' => $inv['vendor_name'] ?? '',
            'debit' => 0,
            'credit' => $revAmount
        ]
    ];
    if (accRound2($total - $revAmount) > 0) {
        $lines[] = [
            'accountId' => $settings['default_output_gst_account_id'] ?? 'acc-2100',
            'description' => "Output GST - {$inv['invoice_number']}",
            'partyType' => 'VENDOR',
            'partyId' => $inv['vendor_id'] ?? '',
            'partyName' => $inv['vendor_name'] ?? '',
            'debit' => 0,
            'credit' => accRound2($total - $revAmount)
        ];
    }
    $lockDate = accToSqlDate($settings['lock_date'] ?? null);
    $entryDate = accToSqlDate($inv['invoice_date'] ?? '') ?: accTodaySql();
    if ($lockDate && $entryDate <= $lockDate) $entryDate = accTodaySql();
    return accInsertJournalTxPhp($pdo, [
        'entryDate' => $entryDate,
        'referenceType' => 'VENDOR_SALES_INVOICE',
        'referenceId' => $inv['id'],
        'referenceNumber' => $inv['invoice_number'],
        'narration' => "Vendor Sales Invoice {$inv['invoice_number']} ({$inv['vendor_name']})",
        'status' => 'POSTED',
        'lines' => $lines
    ], $actor);
}

function accEnsureVendorSalesInvoiceJournalPhp($pdo, $invoiceId, $actor = null) {
    ensureAccountingTablesPhp($pdo);
    $startedTx = !$pdo->inTransaction();
    if ($startedTx) $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $s = $pdo->prepare('SELECT * FROM `solar_vendor_sales_invoices` WHERE `id` = ? LIMIT 1');
        $s->execute([$invoiceId]);
        $inv = $s->fetch(PDO::FETCH_ASSOC);
        if (!$inv) {
            if ($startedTx) $pdo->commit();
            return null;
        }
        $jeId = accEnsureVendorSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);
        if ($startedTx) $pdo->commit();
        return $jeId;
    } catch (Exception $e) {
        if ($startedTx && $pdo->inTransaction()) $pdo->rollBack();
        return null;
    }
}

function accEnsurePurchaseOrderBillTxPhp($pdo, $po, $settings, $actor) {
    $chk = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `po_id` = ? ORDER BY `created_at` ASC LIMIT 1');
    $chk->execute([$po['id']]);
    $ex = $chk->fetch(PDO::FETCH_ASSOC);
    if ($ex) return $ex;

    $totalAmount = accRound2($po['total_amount'] ?? 0);
    $subtotal = accRound2($po['subtotal'] ?? $totalAmount);
    $gstAmount = accRound2($po['gst_amount'] ?? 0);
    $cgstAmount = accRound2($gstAmount / 2);
    $sgstAmount = accRound2($gstAmount - $cgstAmount);
    $billDate = accToSqlDate($po['po_date'] ?? '') ?: accTodaySql();
    $dueDate = accToSqlDate($po['payment_due_date'] ?? ($po['expected_delivery_date'] ?? '')) ?: $billDate;
    $lockDate = accToSqlDate($settings['lock_date'] ?? null);
    $jeDate = ($lockDate && $billDate <= $lockDate) ? accTodaySql() : $billDate;

    $billId = 'vbill-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
    $billNumber = trim((string)($po['invoice_reference'] ?: ($po['po_number'] ?: $billId)));
    $dup = $pdo->prepare('SELECT `id` FROM `solar_acc_vendor_bills` WHERE `bill_number` = ? LIMIT 1');
    $dup->execute([$billNumber]);
    if ($dup->fetchColumn()) {
        $billNumber = $billNumber . '-' . accRandHex(2);
    }

    $paidAmount = accRound2($po['paid_amount'] ?? 0);
    $returnedAmount = accRound2($po['returned_amount'] ?? 0);
    $refundedAmount = accRound2($po['refunded_amount'] ?? 0);
    $netPaid = accRound2(max(0, $paidAmount - $refundedAmount));
    $balanceAmount = accRound2(max(0, $totalAmount - $returnedAmount - $netPaid));
    $status = ($balanceAmount <= 0.01 && $totalAmount > 0) ? 'PAID' : ($netPaid > 0.01 ? 'PARTIAL' : 'OPEN');

    $journalEntryId = '';
    if ($totalAmount > 0) {
        $expenseAccId = $settings['default_cogs_account_id'] ?? 'acc-5010';
        $jLines = [];
        if ($gstAmount > 0) {
            $jLines[] = [
                'accountId' => $expenseAccId,
                'description' => "PO {$po['po_number']} - Materials",
                'projectId' => $po['project_id'] ?? '',
                'projectTitle' => $po['project_title'] ?? '',
                'partyType' => 'VENDOR',
                'partyId' => $po['vendor_id'] ?? '',
                'partyName' => $po['vendor_name'] ?? '',
                'debit' => $subtotal,
                'credit' => 0
            ];
            $jLines[] = [
                'accountId' => $settings['default_input_gst_account_id'] ?? 'acc-1150',
                'description' => "Input GST ITC - PO {$po['po_number']}",
                'projectId' => $po['project_id'] ?? '',
                'projectTitle' => $po['project_title'] ?? '',
                'partyType' => 'VENDOR',
                'partyId' => $po['vendor_id'] ?? '',
                'partyName' => $po['vendor_name'] ?? '',
                'debit' => $gstAmount,
                'credit' => 0
            ];
        } else {
            $jLines[] = [
                'accountId' => $expenseAccId,
                'description' => "PO {$po['po_number']} - Materials",
                'projectId' => $po['project_id'] ?? '',
                'projectTitle' => $po['project_title'] ?? '',
                'partyType' => 'VENDOR',
                'partyId' => $po['vendor_id'] ?? '',
                'partyName' => $po['vendor_name'] ?? '',
                'debit' => $totalAmount,
                'credit' => 0
            ];
        }
        $jLines[] = [
            'accountId' => $settings['default_ap_account_id'] ?? 'acc-2010',
            'description' => "Payable to {$po['vendor_name']} - PO {$po['po_number']}",
            'projectId' => $po['project_id'] ?? '',
            'projectTitle' => $po['project_title'] ?? '',
            'partyType' => 'VENDOR',
            'partyId' => $po['vendor_id'] ?? '',
            'partyName' => $po['vendor_name'] ?? '',
            'debit' => 0,
            'credit' => $totalAmount
        ];

        $journalEntryId = accInsertJournalTxPhp($pdo, [
            'entryDate' => $jeDate,
            'referenceType' => 'VENDOR_BILL',
            'referenceId' => $billId,
            'referenceNumber' => $billNumber,
            'narration' => "Purchase Order {$po['po_number']} ({$po['vendor_name']})",
            'status' => 'POSTED',
            'lines' => $jLines
        ], $actor);
    }

    $pdo->prepare("INSERT INTO `solar_acc_vendor_bills`
        (`id`,`bill_number`,`vendor_id`,`vendor_name`,`vendor_gst`,`po_id`,`po_number`,`project_id`,`project_title`,`bill_date`,`due_date`,`category`,`subtotal`,`cgst_amount`,`sgst_amount`,`igst_amount`,`gst_amount`,`tds_section`,`tds_rate`,`tds_amount`,`total_amount`,`paid_amount`,`returned_amount`,`refunded_amount`,`balance_amount`,`itc_eligible`,`status`,`expense_account_id`,`journal_entry_id`,`notes`,`items_json`,`created_by`)
        VALUES (?,?,?,?,'',?,?,?,?,?,?,'Material Purchase',?,?,?,0,?,'',0,0,?,?,?,?,?,1,?,?,?,?,?,?)")
        ->execute([
            $billId, $billNumber, $po['vendor_id'] ?? '', $po['vendor_name'] ?? 'Vendor',
            $po['id'], $po['po_number'], $po['project_id'] ?? '', $po['project_title'] ?? '',
            $billDate, $dueDate, $subtotal, $cgstAmount, $sgstAmount, $gstAmount,
            $totalAmount, $paidAmount, $returnedAmount, $refundedAmount, $balanceAmount,
            $status, $settings['default_cogs_account_id'] ?? 'acc-5010', $journalEntryId, $po['notes'] ?? '',
            $po['items_json'] ?? '[]', $actor['name'] ?? 'Admin'
        ]);

    $res = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1');
    $res->execute([$billId]);
    return $res->fetch(PDO::FETCH_ASSOC);
}

function accAdjustProductStockTxPhp($pdo, $params) {
    $pid = trim((string)($params['productId'] ?? ''));
    $delta = floatval($params['deltaQty'] ?? 0);
    if ($pid === '' || !is_finite($delta) || $delta == 0.0) return;

    $ps = $pdo->prepare('SELECT * FROM `solar_products` WHERE `id` = ? FOR UPDATE');
    $ps->execute([$pid]);
    $prod = $ps->fetch(PDO::FETCH_ASSOC);
    if (!$prod) return;

    $cur = floatval($prod['current_stock'] ?? 0);
    if ($delta < 0 && ($cur + $delta) < -0.001) {
        throw new Exception("Insufficient stock for \"{$prod['name']}\": available {$cur}, requested deduction " . abs($delta) . '.');
    }

    $nextStock = round(max(0, $cur + $delta), 3);
    $whStocks = [];
    if (!empty($prod['warehouse_stocks_json'])) {
        $decoded = json_decode($prod['warehouse_stocks_json'], true);
        if (is_array($decoded)) $whStocks = $decoded;
    }
    $targetWhId = trim((string)($params['warehouseId'] ?? ($prod['warehouse_id'] ?? '')));
    $targetWhName = trim((string)($params['warehouseName'] ?? ($prod['warehouse_name'] ?? '')));
    if ($targetWhId !== '') {
        $prevWh = floatval($whStocks[$targetWhId] ?? 0);
        $whStocks[$targetWhId] = round(max(0, $prevWh + $delta), 3);
    }

    $pdo->prepare('UPDATE `solar_products` SET `current_stock` = ?, `warehouse_stocks_json` = ? WHERE `id` = ?')
        ->execute([$nextStock, json_encode($whStocks), $prod['id']]);

    $smId = 'sm-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
    $pdo->prepare("INSERT INTO `solar_stock_movements`
        (`id`,`product_id`,`product_name`,`sku`,`movement_type`,`quantity`,`balance_after`,`reference_number`,`reference_id`,`warehouse_id`,`warehouse_name`,`target_warehouse_id`,`target_warehouse_name`,`notes`,`timestamp`,`performed_by`)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'','',?,NOW(),?)")
        ->execute([
            $smId, $prod['id'], $prod['name'], $prod['sku'] ?? '', $params['movementType'],
            $delta, $nextStock, $params['referenceNumber'] ?? '', $params['referenceId'] ?? '',
            $targetWhId, $targetWhName, $params['notes'] ?? '', $params['actorName'] ?? 'Admin'
        ]);
}

function accRecordSalesInvoicePaymentPhp($pdo, $invoiceId, $payload, $actor) {
    ensureAccountingTablesPhp($pdo);
    $amt = accRound2($payload['amount'] ?? 0);
    if (!is_finite($amt) || $amt <= 0) {
        throw new Exception('Payment amount must be greater than zero.', 400);
    }
    $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $payDate = accToSqlDate($payload['paymentDate'] ?? ($payload['paidDate'] ?? '')) ?: accTodaySql();
        accAssertNotLockedPhp($pdo, $payDate);

        $is = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? FOR UPDATE');
        $is->execute([$invoiceId]);
        $inv = $is->fetch(PDO::FETCH_ASSOC);
        if (!$inv) throw new Exception('Sales invoice not found.', 404);
        $invStatus = strtoupper(trim((string)($inv['payment_status'] ?? 'ISSUED')));
        if ($invStatus === 'DRAFT' || $invStatus === 'CANCELLED') {
            throw new Exception("Cannot record payment against a {$invStatus} invoice.", 400);
        }

        $totalAmount = accRound2($inv['total_amount'] ?? 0);
        $paidAmount = accRound2($inv['paid_amount'] ?? 0);
        $returnedAmount = accRound2($inv['returned_amount'] ?? 0);
        $refundedAmount = accRound2($inv['refunded_amount'] ?? 0);
        $netPaid = accRound2(max(0, $paidAmount - $refundedAmount));
        $remaining = accRound2(max(0, $totalAmount - $returnedAmount - $netPaid));
        if ($amt > $remaining + 0.01) {
            throw new Exception("Payment amount (₹" . number_format($amt, 2, '.', '') . ") exceeds remaining balance due (₹" . number_format($remaining, 2, '.', '') . ").", 400);
        }

        $paymentMode = trim((string)($payload['paymentMode'] ?? 'Bank NEFT/RTGS')) ?: 'Bank NEFT/RTGS';
        $resolved = accResolveBankAccountTxPhp($pdo, $payload['bankAccountId'] ?? '', $settings, $paymentMode);
        $bank = $resolved['bank'];
        $coaId = $resolved['coaId'];

        accEnsureSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);

        $receiptId = 'pay-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
        $receiptNumber = trim((string)($payload['receiptNumber'] ?? ('RCPT-' . substr($payDate, 0, 4) . '-' . accRandDigits(4))));
        $referenceNo = trim((string)($payload['referenceNo'] ?? ($payload['transactionReference'] ?? '')));
        $notes = trim((string)($payload['notes'] ?? ''));

        $jeId = accInsertJournalTxPhp($pdo, [
            'entryDate' => $payDate,
            'referenceType' => 'CUSTOMER_RECEIPT',
            'referenceId' => $receiptId,
            'referenceNumber' => $receiptNumber,
            'narration' => "Receipt {$receiptNumber} from {$inv['customer_name']} against Invoice {$inv['invoice_number']} ({$bank['account_name']})",
            'status' => 'POSTED',
            'lines' => [
                [
                    'accountId' => $coaId,
                    'description' => "{$paymentMode} via {$bank['account_name']}" . ($referenceNo !== '' ? " ({$referenceNo})" : ''),
                    'projectId' => $inv['project_id'] ?? '',
                    'projectTitle' => $inv['project_title'] ?? '',
                    'partyType' => 'CUSTOMER',
                    'partyId' => $inv['customer_id'] ?? '',
                    'partyName' => $inv['customer_name'] ?? '',
                    'debit' => $amt,
                    'credit' => 0
                ],
                [
                    'accountId' => $settings['default_ar_account_id'] ?? 'acc-1100',
                    'description' => "Receivable settlement - {$inv['invoice_number']}",
                    'projectId' => $inv['project_id'] ?? '',
                    'projectTitle' => $inv['project_title'] ?? '',
                    'partyType' => 'CUSTOMER',
                    'partyId' => $inv['customer_id'] ?? '',
                    'partyName' => $inv['customer_name'] ?? '',
                    'debit' => 0,
                    'credit' => $amt
                ]
            ]
        ], $actor);

        $pdo->prepare("INSERT INTO `solar_payments`
            (`id`,`receipt_number`,`project_id`,`customer_id`,`customer_name`,`milestone`,`amount`,`status`,`due_date`,`paid_date`,`payment_mode`,`transaction_reference`,`notes`,`invoice_id`,`invoice_number`,`bank_account_id`,`journal_entry_id`,`tally_sync_status`)
            VALUES (?,?,?,?,?,?,?,'PAID',?,?,?,?,?,?,?,?,?,'NOT SYNCED')")
            ->execute([
                $receiptId, $receiptNumber, $inv['project_id'] ?? '', $inv['customer_id'] ?? '',
                $inv['customer_name'] ?? 'Solar Customer', "Against Invoice {$inv['invoice_number']}",
                $amt, $payDate, $payDate, $paymentMode, $referenceNo, $notes,
                $inv['id'], $inv['invoice_number'], $bank['id'], $jeId
            ]);

        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')
            ->execute([$amt, $bank['id']]);

        $nextPaid = accRound2($paidAmount + $amt);
        $nextNetPaid = accRound2(max(0, $nextPaid - $refundedAmount));
        $nextBalance = accRound2(max(0, $totalAmount - $returnedAmount - $nextNetPaid));
        $nextStatus = $nextBalance <= 0.01 ? 'PAID' : 'PARTIAL';

        $pdo->prepare('UPDATE `solar_sales_invoices` SET `paid_amount` = ?, `balance_amount` = ?, `payment_status` = ?, `bank_account_id` = ? WHERE `id` = ?')
            ->execute([$nextPaid, $nextBalance, $nextStatus, $bank['id'], $inv['id']]);

        if (!empty($inv['project_id'])) {
            try { $pdo->prepare('UPDATE `solar_projects` SET `received_inflow` = NULL WHERE `id` = ?')->execute([$inv['project_id']]); } catch (Exception $e) {}
        }

        accLogAuditPhp($pdo, $actor, 'CUSTOMER_PAYMENTS', 'RECORD_INVOICE_PAYMENT', $receiptId, $receiptNumber, "Received ₹{$amt} for Invoice {$inv['invoice_number']} into {$bank['account_name']}");
        $pdo->commit();
        return [
            'invoiceId' => $inv['id'],
            'receiptId' => $receiptId,
            'receiptNumber' => $receiptNumber,
            'amount' => $amt,
            'bankAccountId' => $bank['id'],
            'bankAccountName' => $bank['account_name'],
            'paidAmount' => $nextPaid,
            'balanceAmount' => $nextBalance,
            'paymentStatus' => $nextStatus,
            'journalEntryId' => $jeId
        ];
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function accRecordVendorSalesInvoicePaymentPhp($pdo, $invoiceId, $payload, $actor) {
    ensureAccountingTablesPhp($pdo);
    $amt = accRound2($payload['amount'] ?? 0);
    if (!is_finite($amt) || $amt <= 0) {
        throw new Exception('Payment amount must be greater than zero.', 400);
    }
    $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $payDate = accToSqlDate($payload['paymentDate'] ?? '') ?: accTodaySql();
        accAssertNotLockedPhp($pdo, $payDate);

        $is = $pdo->prepare('SELECT * FROM `solar_vendor_sales_invoices` WHERE `id` = ? FOR UPDATE');
        $is->execute([$invoiceId]);
        $inv = $is->fetch(PDO::FETCH_ASSOC);
        if (!$inv) throw new Exception('Vendor sales invoice not found.', 404);
        if (strtoupper(trim((string)($inv['status'] ?? ''))) === 'DRAFT') {
            throw new Exception('Cannot record payment against a DRAFT invoice. Issue the invoice first.', 400);
        }

        $totalAmount = accRound2($inv['total_amount'] ?? 0);
        $currentPaid = accRound2($inv['paid_amount'] ?? 0);
        $returnedAmount = accRound2($inv['returned_amount'] ?? 0);
        $refundedAmount = accRound2($inv['refunded_amount'] ?? 0);
        $netPaid = accRound2(max(0, $currentPaid - $refundedAmount));
        $remaining = accRound2(max(0, $totalAmount - $returnedAmount - $netPaid));
        if ($amt > $remaining + 0.01) {
            throw new Exception("Payment amount (₹" . number_format($amt, 2, '.', '') . ") exceeds remaining balance due (₹" . number_format($remaining, 2, '.', '') . ").", 400);
        }

        $paymentMode = trim((string)($payload['paymentMode'] ?? 'Bank NEFT/RTGS')) ?: 'Bank NEFT/RTGS';
        $resolved = accResolveBankAccountTxPhp($pdo, $payload['bankAccountId'] ?? '', $settings, $paymentMode);
        $bank = $resolved['bank'];
        $coaId = $resolved['coaId'];

        accEnsureVendorSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);

        $paymentId = 'vsip-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
        $referenceNo = trim((string)($payload['referenceNo'] ?? ''));
        $notes = trim((string)($payload['notes'] ?? ''));
        $actorName = trim((string)($actor['name'] ?? ($actor['email'] ?? 'Admin'))) ?: 'Admin';

        $jeId = accInsertJournalTxPhp($pdo, [
            'entryDate' => $payDate,
            'referenceType' => 'VENDOR_SALES_RECEIPT',
            'referenceId' => $paymentId,
            'referenceNumber' => $inv['invoice_number'],
            'narration' => "Vendor Sales Receipt from {$inv['vendor_name']} for {$inv['invoice_number']} ({$bank['account_name']})",
            'status' => 'POSTED',
            'lines' => [
                [
                    'accountId' => $coaId,
                    'description' => "{$paymentMode} via {$bank['account_name']}" . ($referenceNo !== '' ? " ({$referenceNo})" : ''),
                    'partyType' => 'VENDOR',
                    'partyId' => $inv['vendor_id'] ?? '',
                    'partyName' => $inv['vendor_name'] ?? '',
                    'debit' => $amt,
                    'credit' => 0
                ],
                [
                    'accountId' => $settings['default_ar_account_id'] ?? 'acc-1100',
                    'description' => "Vendor Sales Receivable settlement - {$inv['invoice_number']}",
                    'partyType' => 'VENDOR',
                    'partyId' => $inv['vendor_id'] ?? '',
                    'partyName' => $inv['vendor_name'] ?? '',
                    'debit' => 0,
                    'credit' => $amt
                ]
            ]
        ], $actor);

        $pdo->prepare("INSERT INTO `solar_vendor_sales_payments`
            (`id`,`invoice_id`,`vendor_id`,`payment_date`,`amount`,`payment_mode`,`reference_no`,`notes`,`bank_account_id`,`journal_entry_id`,`recorded_by`)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$paymentId, $invoiceId, $inv['vendor_id'], $payDate, $amt, $paymentMode, $referenceNo, $notes, $bank['id'], $jeId, $actorName]);

        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')
            ->execute([$amt, $bank['id']]);

        $nextPaid = accRound2($currentPaid + $amt);
        $nextNetPaid = accRound2(max(0, $nextPaid - $refundedAmount));
        $nextBalance = accRound2(max(0, $totalAmount - $returnedAmount - $nextNetPaid));
        $dueDate = accToSqlDate($inv['due_date'] ?? null) ?: '';
        $today = accTodaySql();
        $nextStatus = ($nextBalance <= 0.01 && $totalAmount > 0)
            ? 'PAID'
            : ($nextNetPaid > 0.01 ? 'PARTIALLY_PAID' : ($dueDate && $dueDate < $today ? 'OVERDUE' : 'ISSUED'));

        $pdo->prepare('UPDATE `solar_vendor_sales_invoices` SET `paid_amount` = ?, `balance_amount` = ?, `status` = ?, `bank_account_id` = ?, `updated_by` = ? WHERE `id` = ?')
            ->execute([$nextPaid, $nextBalance, $nextStatus, $bank['id'], $actorName, $invoiceId]);

        accLogAuditPhp($pdo, $actor, 'VENDOR_SALES', 'RECORD_VSI_PAYMENT', $paymentId, $inv['invoice_number'], "Received ₹{$amt} for Vendor Sales Invoice {$inv['invoice_number']} into {$bank['account_name']}");
        $pdo->commit();
        return [
            'paymentId' => $paymentId,
            'bankAccountId' => $bank['id'],
            'bankAccountName' => $bank['account_name'],
            'journalEntryId' => $jeId,
            'nextPaid' => $nextPaid,
            'nextBalance' => $nextBalance,
            'nextStatus' => $nextStatus
        ];
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function accRecordPurchaseOrderPaymentPhp($pdo, $poId, $payload, $actor) {
    ensureAccountingTablesPhp($pdo);
    $amt = accRound2($payload['amount'] ?? 0);
    $tds = accRound2($payload['tdsDeducted'] ?? 0);
    if (!is_finite($amt) || $amt <= 0) {
        throw new Exception('Payment amount must be greater than zero.', 400);
    }
    if ($tds < 0 || $tds >= $amt) {
        throw new Exception('TDS deducted must be >= 0 and less than gross payment amount.', 400);
    }
    $netPaid = accRound2($amt - $tds);

    $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $payDate = accToSqlDate($payload['paymentDate'] ?? '') ?: accTodaySql();
        accAssertNotLockedPhp($pdo, $payDate);

        $ps = $pdo->prepare('SELECT * FROM `solar_purchase_orders` WHERE `id` = ? FOR UPDATE');
        $ps->execute([$poId]);
        $po = $ps->fetch(PDO::FETCH_ASSOC);
        if (!$po) throw new Exception('Purchase order not found.', 404);
        if (strtoupper(trim((string)($po['status'] ?? ''))) === 'CANCELLED') {
            throw new Exception('Cannot record payment for a cancelled purchase order.', 400);
        }

        $totalAmount = accRound2($po['total_amount'] ?? 0);
        $paidAmount = accRound2($po['paid_amount'] ?? 0);
        $returnedAmount = accRound2($po['returned_amount'] ?? 0);
        $refundedAmount = accRound2($po['refunded_amount'] ?? 0);
        $netAlreadyPaid = accRound2(max(0, $paidAmount - $refundedAmount));
        $remaining = accRound2(max(0, $totalAmount - $returnedAmount - $netAlreadyPaid));
        if ($amt > $remaining + 0.01) {
            throw new Exception("Payment amount (₹" . number_format($amt, 2, '.', '') . ") exceeds remaining PO payable balance (₹" . number_format($remaining, 2, '.', '') . ").", 400);
        }

        $paymentMode = trim((string)($payload['paymentMode'] ?? 'Bank NEFT/RTGS')) ?: 'Bank NEFT/RTGS';
        $resolved = accResolveBankAccountTxPhp($pdo, $payload['bankAccountId'] ?? '', $settings, $paymentMode);
        $bank = $resolved['bank'];
        $coaId = $resolved['coaId'];

        $bill = accEnsurePurchaseOrderBillTxPhp($pdo, $po, $settings, $actor);

        $payId = 'vpay-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
        $payNo = trim((string)($payload['paymentNumber'] ?? ('VPAY-' . substr($payDate, 0, 4) . '-' . accRandDigits(4))));
        $referenceNo = trim((string)($payload['referenceNo'] ?? ''));
        $notes = trim((string)($payload['notes'] ?? ''));

        $jLines = [
            [
                'accountId' => $settings['default_ap_account_id'] ?? 'acc-2010',
                'description' => "PO {$po['po_number']} payment to {$po['vendor_name']}",
                'projectId' => $po['project_id'] ?? '',
                'projectTitle' => $po['project_title'] ?? '',
                'partyType' => 'VENDOR',
                'partyId' => $po['vendor_id'] ?? '',
                'partyName' => $po['vendor_name'] ?? '',
                'debit' => $amt,
                'credit' => 0
            ],
            [
                'accountId' => $coaId,
                'description' => "Paid via {$bank['account_name']} ({$paymentMode})" . ($referenceNo !== '' ? " Ref: {$referenceNo}" : ''),
                'projectId' => $po['project_id'] ?? '',
                'projectTitle' => $po['project_title'] ?? '',
                'partyType' => 'VENDOR',
                'partyId' => $po['vendor_id'] ?? '',
                'partyName' => $po['vendor_name'] ?? '',
                'debit' => 0,
                'credit' => $netPaid
            ]
        ];
        if ($tds > 0) {
            $jLines[] = [
                'accountId' => $settings['default_tds_account_id'] ?? 'acc-2150',
                'description' => "TDS " . ($payload['tdsSection'] ?? '194C') . " deducted from {$po['vendor_name']}",
                'projectId' => $po['project_id'] ?? '',
                'projectTitle' => $po['project_title'] ?? '',
                'partyType' => 'VENDOR',
                'partyId' => $po['vendor_id'] ?? '',
                'partyName' => $po['vendor_name'] ?? '',
                'debit' => 0,
                'credit' => $tds
            ];
        }

        $jeId = accInsertJournalTxPhp($pdo, [
            'entryDate' => $payDate,
            'referenceType' => 'VENDOR_PAYMENT',
            'referenceId' => $payId,
            'referenceNumber' => $payNo,
            'narration' => "Vendor payment {$payNo} to {$po['vendor_name']} for PO {$po['po_number']} ({$bank['account_name']})",
            'status' => 'POSTED',
            'lines' => $jLines
        ], $actor);

        $pdo->prepare("INSERT INTO `solar_acc_vendor_payments`
            (`id`,`payment_number`,`bill_id`,`vendor_id`,`vendor_name`,`payment_date`,`amount`,`tds_deducted`,`net_paid`,`bank_account_id`,`payment_mode`,`reference_no`,`notes`,`journal_entry_id`,`recorded_by`)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$payId, $payNo, $bill['id'], $po['vendor_id'] ?? '', $po['vendor_name'] ?? 'Vendor', $payDate, $amt, $tds, $netPaid, $bank['id'], $paymentMode, $referenceNo, $notes, $jeId, $actor['name'] ?? 'Admin']);

        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')
            ->execute([$netPaid, $bank['id']]);

        $nextPaid = accRound2($paidAmount + $amt);
        $nextNetPaid = accRound2(max(0, $nextPaid - $refundedAmount));
        $nextBalance = accRound2(max(0, $totalAmount - $returnedAmount - $nextNetPaid));
        $nextBillStatus = $nextBalance <= 0.01 ? 'PAID' : 'PARTIAL';
        $nextPoPayStatus = $nextBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

        $pdo->prepare('UPDATE `solar_acc_vendor_bills` SET `paid_amount` = ?, `balance_amount` = ?, `status` = ? WHERE `id` = ?')
            ->execute([$nextPaid, $nextBalance, $nextBillStatus, $bill['id']]);
        $pdo->prepare('UPDATE `solar_purchase_orders` SET `paid_amount` = ?, `balance_amount` = ?, `payment_status` = ?, `bank_account_id` = ? WHERE `id` = ?')
            ->execute([$nextPaid, $nextBalance, $nextPoPayStatus, $bank['id'], $po['id']]);

        if ($tds > 0) {
            $vs = $pdo->prepare('SELECT `pan_number` FROM `solar_vendors` WHERE `id` = ? LIMIT 1');
            $vs->execute([$po['vendor_id'] ?? '']);
            $pan = $vs->fetchColumn() ?: '';
            $tdsRate = accRound2(($tds / max(1, $amt)) * 100);
            $pdo->prepare("INSERT INTO `solar_acc_tds_entries` (`id`,`section`,`party_type`,`party_id`,`party_name`,`pan_number`,`source_type`,`source_id`,`source_number`,`deduction_date`,`gross_amount`,`tds_rate`,`tds_amount`,`status`) VALUES (?,?,'VENDOR',?,?,?,'VENDOR_PAYMENT',?,?,?,?,?,?,'DEDUCTED')")
                ->execute(['tds-' . round(microtime(true) * 1000) . '-' . accRandHex(3), $payload['tdsSection'] ?? '194C', $po['vendor_id'] ?? '', $po['vendor_name'] ?? 'Vendor', $pan, $payId, $payNo, $payDate, $amt, $tdsRate, $tds]);
        }

        accLogAuditPhp($pdo, $actor, 'VENDOR_PAYMENTS', 'RECORD_PO_PAYMENT', $payId, $payNo, "Paid ₹{$netPaid} for PO {$po['po_number']} via {$bank['account_name']}");
        $pdo->commit();
        return [
            'purchaseOrderId' => $po['id'],
            'billId' => $bill['id'],
            'paymentId' => $payId,
            'paymentNumber' => $payNo,
            'amount' => $amt,
            'tdsDeducted' => $tds,
            'netPaid' => $netPaid,
            'bankAccountId' => $bank['id'],
            'bankAccountName' => $bank['account_name'],
            'paidAmount' => $nextPaid,
            'balanceAmount' => $nextBalance,
            'paymentStatus' => $nextPoPayStatus,
            'journalEntryId' => $jeId
        ];
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function accGetSalesReturnsPhp($pdo) {
    ensureAccountingTablesPhp($pdo);
    $rows = $pdo->query('SELECT * FROM `solar_sales_returns` ORDER BY `return_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (empty($rows)) return [];
    $itemRows = $pdo->query('SELECT * FROM `solar_sales_return_items` ORDER BY `line_order` ASC, `id` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $itemsByRet = [];
    foreach ($itemRows as $it) {
        $itemsByRet[$it['return_id']][] = [
            'id' => $it['id'],
            'productId' => $it['product_id'] ?: null,
            'description' => $it['description'],
            'hsnCode' => $it['hsn_code'] ?? '',
            'unit' => $it['unit'] ?? 'Nos',
            'originalQuantity' => floatval($it['original_quantity'] ?? 0),
            'quantity' => floatval($it['quantity'] ?? 0),
            'rate' => floatval($it['rate'] ?? 0),
            'taxableAmount' => floatval($it['taxable_amount'] ?? 0),
            'gstRate' => floatval($it['gst_rate'] ?? 0),
            'cgstAmount' => floatval($it['cgst_amount'] ?? 0),
            'sgstAmount' => floatval($it['sgst_amount'] ?? 0),
            'igstAmount' => floatval($it['igst_amount'] ?? 0),
            'taxAmount' => floatval($it['tax_amount'] ?? 0),
            'totalAmount' => floatval($it['total_amount'] ?? 0)
        ];
    }
    return array_map(function ($r) use ($itemsByRet) {
        return [
            'id' => $r['id'],
            'returnNumber' => $r['return_number'],
            'returnDate' => accToSqlDate($r['return_date']) ?: '',
            'targetType' => ($r['target_type'] === 'VENDOR_INVOICE') ? 'VENDOR_INVOICE' : 'CUSTOMER_INVOICE',
            'invoiceId' => $r['invoice_id'],
            'invoiceNumber' => $r['invoice_number'] ?? '',
            'partyId' => $r['party_id'] ?? '',
            'partyName' => $r['party_name'],
            'projectId' => $r['project_id'] ?? '',
            'projectTitle' => $r['project_title'] ?? '',
            'reason' => $r['reason'] ?? '',
            'notes' => $r['notes'] ?? '',
            'warehouseId' => $r['warehouse_id'] ?? '',
            'warehouseName' => $r['warehouse_name'] ?? '',
            'restockInventory' => !empty($r['restock_inventory']),
            'items' => $itemsByRet[$r['id']] ?? [],
            'subtotal' => floatval($r['subtotal'] ?? 0),
            'cgstAmount' => floatval($r['cgst_amount'] ?? 0),
            'sgstAmount' => floatval($r['sgst_amount'] ?? 0),
            'igstAmount' => floatval($r['igst_amount'] ?? 0),
            'taxAmount' => floatval($r['tax_amount'] ?? 0),
            'totalAmount' => floatval($r['total_amount'] ?? 0),
            'settlementMode' => ($r['settlement_mode'] === 'BANK_REFUND') ? 'BANK_REFUND' : 'CREDIT_NOTE',
            'refundAmount' => floatval($r['refund_amount'] ?? 0),
            'bankAccountId' => $r['bank_account_id'] ?? '',
            'bankAccountName' => $r['bank_account_name'] ?? '',
            'creditJournalEntryId' => $r['credit_journal_entry_id'] ?? '',
            'refundJournalEntryId' => $r['refund_journal_entry_id'] ?? '',
            'status' => $r['status'] ?? 'POSTED',
            'createdBy' => $r['created_by'] ?? '',
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at']
        ];
    }, $rows);
}

function accCreateSalesReturnPhp($pdo, $payload, $actor) {
    ensureAccountingTablesPhp($pdo);
    $targetType = (($payload['targetType'] ?? '') === 'VENDOR_INVOICE') ? 'VENDOR_INVOICE' : 'CUSTOMER_INVOICE';
    $invoiceId = trim((string)($payload['invoiceId'] ?? ''));
    if ($invoiceId === '') throw new Exception('Source invoice is required for a sales return.', 400);
    $rawItems = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $submittedItems = array_values(array_filter($rawItems, function ($it) { return floatval($it['quantity'] ?? 0) > 0; }));
    if (empty($submittedItems)) throw new Exception('Specify return quantity greater than 0 for at least one line item.', 400);

    $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $returnDate = accToSqlDate($payload['returnDate'] ?? '') ?: accTodaySql();
        accAssertNotLockedPhp($pdo, $returnDate);

        $inv = null;
        $origItems = [];
        $isInterState = false;
        $partyId = ''; $partyName = ''; $projectId = ''; $projectTitle = ''; $defaultWhId = '';

        if ($targetType === 'CUSTOMER_INVOICE') {
            $s = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? FOR UPDATE');
            $s->execute([$invoiceId]);
            $inv = $s->fetch(PDO::FETCH_ASSOC);
            if (!$inv) throw new Exception('Customer sales invoice not found.', 404);
            $st = strtoupper(trim((string)($inv['payment_status'] ?? 'ISSUED')));
            if ($st === 'DRAFT' || $st === 'CANCELLED') throw new Exception("Cannot process sales return against a {$st} invoice.", 400);
            $origItems = json_decode($inv['items_json'] ?? '[]', true) ?: [];
            $isInterState = floatval($inv['igst_amount'] ?? 0) > 0;
            $partyId = $inv['customer_id'] ?? '';
            $partyName = $inv['customer_name'] ?? 'Solar Customer';
            $projectId = $inv['project_id'] ?? '';
            $projectTitle = $inv['project_title'] ?? '';
            $defaultWhId = $inv['warehouse_id'] ?? '';
        } else {
            $s = $pdo->prepare('SELECT * FROM `solar_vendor_sales_invoices` WHERE `id` = ? FOR UPDATE');
            $s->execute([$invoiceId]);
            $inv = $s->fetch(PDO::FETCH_ASSOC);
            if (!$inv) throw new Exception('Vendor sales invoice not found.', 404);
            $st = strtoupper(trim((string)($inv['status'] ?? 'ISSUED')));
            if ($st === 'DRAFT' || $st === 'CANCELLED') throw new Exception("Cannot process sales return against a {$st} vendor sales invoice.", 400);
            $vsiStmt = $pdo->prepare('SELECT * FROM `solar_vendor_sales_invoice_items` WHERE `invoice_id` = ? ORDER BY `line_order` ASC');
            $vsiStmt->execute([$invoiceId]);
            $origItems = array_map(function ($r) {
                return [
                    'productId' => $r['product_id'] ?: null,
                    'description' => $r['description'],
                    'hsnCode' => $r['hsn_code'] ?? '',
                    'unit' => $r['unit'] ?? 'NOS',
                    'quantity' => floatval($r['quantity'] ?? 0),
                    'rate' => floatval($r['rate'] ?? 0),
                    'taxableAmount' => floatval($r['taxable_amount'] ?? 0),
                    'gstRate' => floatval($r['gst_rate'] ?? 0)
                ];
            }, $vsiStmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
            $isInterState = (($inv['supply_type'] ?? '') === 'INTER_STATE') || floatval($inv['igst_amount'] ?? 0) > 0;
            $partyId = $inv['vendor_id'] ?? '';
            $partyName = $inv['vendor_name'] ?? 'Vendor';
        }

        $prevStmt = $pdo->prepare("SELECT sri.`product_id`, sri.`description`, SUM(sri.`quantity`) AS prev_qty FROM `solar_sales_return_items` sri INNER JOIN `solar_sales_returns` sr ON sr.`id` = sri.`return_id` WHERE sr.`target_type` = ? AND sr.`invoice_id` = ? AND sr.`status` = 'POSTED' GROUP BY sri.`product_id`, sri.`description`");
        $prevStmt->execute([$targetType, $invoiceId]);
        $prevByKey = [];
        foreach ($prevStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $k = !empty($r['product_id']) ? ('pid:' . $r['product_id']) : ('desc:' . strtolower(trim((string)($r['description'] ?? ''))));
            $prevByKey[$k] = ($prevByKey[$k] ?? 0) + floatval($r['prev_qty'] ?? 0);
        }

        $subtotal = 0; $cgstTotal = 0; $sgstTotal = 0; $igstTotal = 0;
        $computedLines = [];
        foreach ($submittedItems as $subItem) {
            $reqPid = trim((string)($subItem['productId'] ?? ''));
            $reqDesc = trim((string)($subItem['description'] ?? ''));
            $qty = round(floatval($subItem['quantity'] ?? 0), 3);
            if (!is_finite($qty) || $qty <= 0) continue;

            $match = null;
            foreach ($origItems as $oi) {
                $oiPid = trim((string)($oi['productId'] ?? ''));
                $oiDesc = trim((string)($oi['description'] ?? ($oi['productName'] ?? ($oi['name'] ?? ''))));
                if (($reqPid !== '' && $oiPid === $reqPid) || ($reqDesc !== '' && strcasecmp($oiDesc, $reqDesc) === 0)) {
                    $match = $oi;
                    break;
                }
            }
            if (!$match) throw new Exception("Return item \"" . ($reqDesc ?: $reqPid) . "\" does not match any line item on invoice {$inv['invoice_number']}.", 400);

            $origQty = floatval($match['quantity'] ?? 0);
            $effPid = !empty($match['productId']) ? $match['productId'] : $reqPid;
            $matchDesc = trim((string)($match['description'] ?? ($match['productName'] ?? ($match['name'] ?? $reqDesc))));
            $itemKey = $effPid !== '' ? ('pid:' . $effPid) : ('desc:' . strtolower($matchDesc));
            $prevQty = $prevByKey[$itemKey] ?? 0;
            $maxRem = round(max(0, $origQty - $prevQty), 3);
            if ($qty > $maxRem + 0.001) {
                throw new Exception("Return quantity ({$qty}) for \"{$matchDesc}\" exceeds remaining returnable quantity ({$maxRem}).", 400);
            }
            $prevByKey[$itemKey] = $prevQty + $qty;

            $origRate = floatval($match['rate'] ?? ($match['unitPrice'] ?? 0));
            $origTaxable = floatval($match['taxableAmount'] ?? ($match['total'] ?? ($origQty * $origRate)));
            $effUnitRate = $origQty > 0 ? ($origTaxable / $origQty) : $origRate;
            $lineTaxable = accRound2($qty * $effUnitRate);
            $fallbackGst = floatval($inv['subtotal'] ?? 0) > 0 ? accRound2((floatval($inv['tax_amount'] ?? ($inv['gst_amount'] ?? 0)) / floatval($inv['subtotal'])) * 100) : 0;
            $gstRate = floatval($match['gstRate'] ?? ($match['taxRatePercent'] ?? $fallbackGst));
            $lineTax = accRound2(($lineTaxable * $gstRate) / 100);
            $lineIgst = $isInterState ? $lineTax : 0;
            $lineCgst = $isInterState ? 0 : accRound2($lineTax / 2);
            $lineSgst = $isInterState ? 0 : accRound2($lineTax - $lineCgst);
            $lineTotal = accRound2($lineTaxable + $lineTax);

            $subtotal = accRound2($subtotal + $lineTaxable);
            $cgstTotal = accRound2($cgstTotal + $lineCgst);
            $sgstTotal = accRound2($sgstTotal + $lineSgst);
            $igstTotal = accRound2($igstTotal + $lineIgst);

            $computedLines[] = [
                'productId' => $effPid ?: null,
                'description' => $matchDesc,
                'hsnCode' => (string)($match['hsnCode'] ?? ''),
                'unit' => (string)($match['unit'] ?? 'Nos'),
                'originalQuantity' => $origQty,
                'quantity' => $qty,
                'rate' => accRound2($effUnitRate),
                'taxableAmount' => $lineTaxable,
                'gstRate' => $gstRate,
                'cgstAmount' => $lineCgst,
                'sgstAmount' => $lineSgst,
                'igstAmount' => $lineIgst,
                'taxAmount' => $lineTax,
                'totalAmount' => $lineTotal
            ];
        }
        if (empty($computedLines)) throw new Exception('No valid returnable line items found.', 400);

        $taxAmount = accRound2($cgstTotal + $sgstTotal + $igstTotal);
        $totalAmount = accRound2($subtotal + $taxAmount);

        $invTotal = accRound2($inv['total_amount'] ?? 0);
        $invPaid = accRound2($inv['paid_amount'] ?? 0);
        $invReturned = accRound2($inv['returned_amount'] ?? 0);
        $invRefunded = accRound2($inv['refunded_amount'] ?? 0);
        $remRetVal = accRound2(max(0, $invTotal - $invReturned));
        if ($totalAmount > $remRetVal + 0.05) {
            throw new Exception("Return total (₹" . number_format($totalAmount, 2, '.', '') . ") exceeds remaining non-returned invoice value (₹" . number_format($remRetVal, 2, '.', '') . ").", 400);
        }

        $settlementMode = (($payload['settlementMode'] ?? '') === 'BANK_REFUND') ? 'BANK_REFUND' : 'CREDIT_NOTE';
        $refundAmount = $settlementMode === 'BANK_REFUND' ? accRound2($payload['refundAmount'] ?? $totalAmount) : 0;
        $netPaidSoFar = accRound2(max(0, $invPaid - $invRefunded));

        $bank = null; $bankCoaId = '';
        if ($settlementMode === 'BANK_REFUND') {
            if ($netPaidSoFar <= 0) throw new Exception('Cannot issue a Cash/Bank refund because no net payment has been received on this invoice. Use Credit Note adjustment instead.', 400);
            if (!is_finite($refundAmount) || $refundAmount <= 0) throw new Exception('Refund amount must be greater than zero for Bank Refund settlement.', 400);
            if ($refundAmount > $totalAmount + 0.01) throw new Exception("Refund amount cannot exceed Credit Note total.", 400);
            if ($refundAmount > $netPaidSoFar + 0.01) throw new Exception("Refund amount exceeds net paid amount available for refund.", 400);
            $resolved = accResolveBankAccountTxPhp($pdo, $payload['bankAccountId'] ?? '', $settings);
            $bank = $resolved['bank'];
            $bankCoaId = $resolved['coaId'];
        }

        if ($targetType === 'CUSTOMER_INVOICE') {
            accEnsureSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);
        } else {
            accEnsureVendorSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);
        }

        $id = 'sr-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
        $returnNumber = trim((string)($payload['returnNumber'] ?? ('CN-' . substr($returnDate, 0, 4) . '-' . accRandDigits(4))));
        $restockInventory = !isset($payload['restockInventory']) || (bool)$payload['restockInventory'];
        $warehouseId = trim((string)($payload['warehouseId'] ?? $defaultWhId));
        $warehouseName = trim((string)($payload['warehouseName'] ?? ''));
        $actorName = trim((string)($actor['name'] ?? ($actor['email'] ?? 'Admin'))) ?: 'Admin';
        $pType = $targetType === 'VENDOR_INVOICE' ? 'VENDOR' : 'CUSTOMER';
        $revAccId = $targetType === 'VENDOR_INVOICE' ? 'acc-4030' : ($settings['default_sales_account_id'] ?? 'acc-4010');

        $cnLines = [
            ['accountId' => $revAccId, 'description' => "Sales Return {$returnNumber} against {$inv['invoice_number']}", 'projectId' => $projectId, 'projectTitle' => $projectTitle, 'partyType' => $pType, 'partyId' => $partyId, 'partyName' => $partyName, 'debit' => $subtotal, 'credit' => 0]
        ];
        if ($taxAmount > 0) {
            $cnLines[] = ['accountId' => $settings['default_output_gst_account_id'] ?? 'acc-2100', 'description' => "Output GST Reversal - {$returnNumber}", 'projectId' => $projectId, 'projectTitle' => $projectTitle, 'partyType' => $pType, 'partyId' => $partyId, 'partyName' => $partyName, 'debit' => $taxAmount, 'credit' => 0];
        }
        $cnLines[] = ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'description' => "Credit Note {$returnNumber} - {$partyName}", 'projectId' => $projectId, 'projectTitle' => $projectTitle, 'partyType' => $pType, 'partyId' => $partyId, 'partyName' => $partyName, 'debit' => 0, 'credit' => $totalAmount];

        $creditJournalEntryId = accInsertJournalTxPhp($pdo, [
            'entryDate' => $returnDate,
            'referenceType' => 'SALES_RETURN',
            'referenceId' => $id,
            'referenceNumber' => $returnNumber,
            'narration' => "Sales Return {$returnNumber} against {$inv['invoice_number']} ({$partyName})",
            'status' => 'POSTED',
            'lines' => $cnLines
        ], $actor);

        $refundJournalEntryId = '';
        if ($settlementMode === 'BANK_REFUND' && $bank && $refundAmount > 0) {
            $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')
                ->execute([$refundAmount, $bank['id']]);
            $refundJournalEntryId = accInsertJournalTxPhp($pdo, [
                'entryDate' => $returnDate,
                'referenceType' => 'SALES_RETURN_REFUND',
                'referenceId' => $id,
                'referenceNumber' => $returnNumber,
                'narration' => "Sales Return Refund {$returnNumber} to {$partyName} via {$bank['account_name']}",
                'status' => 'POSTED',
                'lines' => [
                    ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'description' => "Customer Refund {$returnNumber} - {$partyName}", 'projectId' => $projectId, 'projectTitle' => $projectTitle, 'partyType' => $pType, 'partyId' => $partyId, 'partyName' => $partyName, 'debit' => $refundAmount, 'credit' => 0],
                    ['accountId' => $bankCoaId, 'description' => "Refund paid via {$bank['account_name']}", 'projectId' => $projectId, 'projectTitle' => $projectTitle, 'partyType' => $pType, 'partyId' => $partyId, 'partyName' => $partyName, 'debit' => 0, 'credit' => $refundAmount]
                ]
            ], $actor);
        }

        $pdo->prepare("INSERT INTO `solar_sales_returns`
            (`id`,`return_number`,`return_date`,`target_type`,`invoice_id`,`invoice_number`,`party_id`,`party_name`,`project_id`,`project_title`,`reason`,`notes`,`warehouse_id`,`warehouse_name`,`restock_inventory`,`subtotal`,`cgst_amount`,`sgst_amount`,`igst_amount`,`tax_amount`,`total_amount`,`settlement_mode`,`refund_amount`,`bank_account_id`,`bank_account_name`,`credit_journal_entry_id`,`refund_journal_entry_id`,`status`,`created_by`)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'POSTED',?)")
            ->execute([
                $id, $returnNumber, $returnDate, $targetType, $inv['id'], $inv['invoice_number'], $partyId, $partyName,
                $projectId, $projectTitle, trim((string)($payload['reason'] ?? '')), trim((string)($payload['notes'] ?? '')),
                $warehouseId, $warehouseName, $restockInventory ? 1 : 0, $subtotal, $cgstTotal, $sgstTotal, $igstTotal, $taxAmount, $totalAmount,
                $settlementMode, $refundAmount, $bank['id'] ?? '', $bank['account_name'] ?? '', $creditJournalEntryId, $refundJournalEntryId, $actorName
            ]);

        $iStmt = $pdo->prepare("INSERT INTO `solar_sales_return_items` (`id`,`return_id`,`line_order`,`product_id`,`description`,`hsn_code`,`unit`,`original_quantity`,`quantity`,`rate`,`taxable_amount`,`gst_rate`,`cgst_amount`,`sgst_amount`,`igst_amount`,`tax_amount`,`total_amount`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        foreach ($computedLines as $idx => $li) {
            $iStmt->execute([
                "sri-{$id}-{$idx}", $id, $idx, $li['productId'], $li['description'], $li['hsnCode'], $li['unit'],
                $li['originalQuantity'], $li['quantity'], $li['rate'], $li['taxableAmount'], $li['gstRate'],
                $li['cgstAmount'], $li['sgstAmount'], $li['igstAmount'], $li['taxAmount'], $li['totalAmount']
            ]);
            if ($restockInventory && !empty($li['productId'])) {
                accAdjustProductStockTxPhp($pdo, [
                    'productId' => $li['productId'],
                    'deltaQty' => $li['quantity'],
                    'warehouseId' => $warehouseId,
                    'warehouseName' => $warehouseName,
                    'movementType' => 'SALES_RETURN',
                    'referenceNumber' => $returnNumber,
                    'referenceId' => $id,
                    'notes' => "Sales Return {$returnNumber} against {$inv['invoice_number']}",
                    'actorName' => $actorName
                ]);
            }
        }

        $nextReturned = accRound2($invReturned + $totalAmount);
        $nextRefunded = accRound2($invRefunded + $refundAmount);
        $nextNetPaid = accRound2(max(0, $invPaid - $nextRefunded));
        $nextBalance = accRound2(max(0, $invTotal - $nextReturned - $nextNetPaid));
        if ($targetType === 'CUSTOMER_INVOICE') {
            $nextStatus = $nextBalance <= 0.01 ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIAL' : 'ISSUED');
            $pdo->prepare('UPDATE `solar_sales_invoices` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')
                ->execute([$nextReturned, $nextRefunded, $nextBalance, $nextStatus, $inv['id']]);
            if ($projectId !== '') {
                try { $pdo->prepare('UPDATE `solar_projects` SET `received_inflow` = NULL WHERE `id` = ?')->execute([$projectId]); } catch (Exception $e) {}
            }
        } else {
            $dueDate = accToSqlDate($inv['due_date'] ?? null) ?: '';
            $today = accTodaySql();
            $nextStatus = ($nextBalance <= 0.01 && $invTotal > 0) ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIALLY_PAID' : ($dueDate && $dueDate < $today ? 'OVERDUE' : 'ISSUED'));
            $pdo->prepare('UPDATE `solar_vendor_sales_invoices` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`status`=? WHERE `id`=?')
                ->execute([$nextReturned, $nextRefunded, $nextBalance, $nextStatus, $inv['id']]);
        }

        accLogAuditPhp($pdo, $actor, 'SALES_RETURNS', 'CREATE_SALES_RETURN', $id, $returnNumber, "Recorded Sales Return {$returnNumber} (₹{$totalAmount}) against {$inv['invoice_number']}");
        $pdo->commit();
        return ['id' => $id, 'returnNumber' => $returnNumber, 'totalAmount' => $totalAmount, 'refundAmount' => $refundAmount, 'creditJournalEntryId' => $creditJournalEntryId, 'refundJournalEntryId' => $refundJournalEntryId];
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function accDeleteSalesReturnPhp($pdo, $id, $actor) {
    ensureAccountingTablesPhp($pdo);
    $pdo->beginTransaction();
    try {
        $s = $pdo->prepare('SELECT * FROM `solar_sales_returns` WHERE `id` = ? FOR UPDATE');
        $s->execute([$id]);
        $sr = $s->fetch(PDO::FETCH_ASSOC);
        if (!$sr) throw new Exception('Sales return not found.', 404);
        accAssertNotLockedPhp($pdo, accToSqlDate($sr['return_date'] ?? '') ?: accTodaySql());

        $is = $pdo->prepare('SELECT * FROM `solar_sales_return_items` WHERE `return_id` = ?');
        $is->execute([$id]);
        $items = $is->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $actorName = trim((string)($actor['name'] ?? ($actor['email'] ?? 'Admin'))) ?: 'Admin';

        if (!empty($sr['restock_inventory'])) {
            foreach ($items as $li) {
                if (!empty($li['product_id'])) {
                    accAdjustProductStockTxPhp($pdo, [
                        'productId' => $li['product_id'],
                        'deltaQty' => -floatval($li['quantity'] ?? 0),
                        'warehouseId' => $sr['warehouse_id'] ?? '',
                        'warehouseName' => $sr['warehouse_name'] ?? '',
                        'movementType' => 'SALES_RETURN',
                        'referenceNumber' => 'REV-' . $sr['return_number'],
                        'referenceId' => $id . '-REV',
                        'notes' => "Reversed Sales Return {$sr['return_number']}",
                        'actorName' => $actorName
                    ]);
                }
            }
            $pdo->prepare('DELETE FROM `solar_stock_movements` WHERE `reference_id` IN (?, ?)')->execute([$id, $id . '-REV']);
        }

        if (!empty($sr['bank_account_id']) && floatval($sr['refund_amount'] ?? 0) > 0) {
            $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')
                ->execute([accRound2($sr['refund_amount']), $sr['bank_account_id']]);
        }

        $retAmt = accRound2($sr['total_amount'] ?? 0);
        $refAmt = accRound2($sr['refund_amount'] ?? 0);

        if ($sr['target_type'] === 'VENDOR_INVOICE') {
            $iv = $pdo->prepare('SELECT * FROM `solar_vendor_sales_invoices` WHERE `id` = ? FOR UPDATE');
            $iv->execute([$sr['invoice_id']]);
            $inv = $iv->fetch(PDO::FETCH_ASSOC);
            if ($inv) {
                $total = accRound2($inv['total_amount'] ?? 0);
                $paid = accRound2($inv['paid_amount'] ?? 0);
                $nextRet = accRound2(max(0, floatval($inv['returned_amount'] ?? 0) - $retAmt));
                $nextRef = accRound2(max(0, floatval($inv['refunded_amount'] ?? 0) - $refAmt));
                $nextNetPaid = accRound2(max(0, $paid - $nextRef));
                $nextBal = accRound2(max(0, $total - $nextRet - $nextNetPaid));
                $dueDate = accToSqlDate($inv['due_date'] ?? null) ?: '';
                $today = accTodaySql();
                $nextSt = ($nextBal <= 0.01 && $total > 0) ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIALLY_PAID' : ($dueDate && $dueDate < $today ? 'OVERDUE' : 'ISSUED'));
                $pdo->prepare('UPDATE `solar_vendor_sales_invoices` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`status`=? WHERE `id`=?')
                    ->execute([$nextRet, $nextRef, $nextBal, $nextSt, $inv['id']]);
            }
        } else {
            $iv = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? FOR UPDATE');
            $iv->execute([$sr['invoice_id']]);
            $inv = $iv->fetch(PDO::FETCH_ASSOC);
            if ($inv) {
                $total = accRound2($inv['total_amount'] ?? 0);
                $paid = accRound2($inv['paid_amount'] ?? 0);
                $nextRet = accRound2(max(0, floatval($inv['returned_amount'] ?? 0) - $retAmt));
                $nextRef = accRound2(max(0, floatval($inv['refunded_amount'] ?? 0) - $refAmt));
                $nextNetPaid = accRound2(max(0, $paid - $nextRef));
                $nextBal = accRound2(max(0, $total - $nextRet - $nextNetPaid));
                $nextSt = $nextBal <= 0.01 ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIAL' : 'ISSUED');
                $pdo->prepare('UPDATE `solar_sales_invoices` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')
                    ->execute([$nextRet, $nextRef, $nextBal, $nextSt, $inv['id']]);
            }
        }

        $jeIds = array_values(array_filter([$sr['credit_journal_entry_id'] ?? '', $sr['refund_journal_entry_id'] ?? '']));
        if (!empty($jeIds)) {
            $ph = implode(',', array_fill(0, count($jeIds), '?'));
            $pdo->prepare("DELETE FROM `solar_acc_journal_entries` WHERE `id` IN ({$ph})")->execute($jeIds);
            accRecalcBalancesPhp($pdo);
        }

        $pdo->prepare('DELETE FROM `solar_sales_returns` WHERE `id` = ?')->execute([$id]);
        accLogAuditPhp($pdo, $actor, 'SALES_RETURNS', 'DELETE_SALES_RETURN', $id, $sr['return_number'], "Deleted & reversed Sales Return {$sr['return_number']}");
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function accGetPurchaseReturnsPhp($pdo) {
    ensureAccountingTablesPhp($pdo);
    $rows = $pdo->query('SELECT * FROM `solar_purchase_returns` ORDER BY `return_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (empty($rows)) return [];
    $itemRows = $pdo->query('SELECT * FROM `solar_purchase_return_items` ORDER BY `line_order` ASC, `id` ASC')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $itemsByRet = [];
    foreach ($itemRows as $it) {
        $itemsByRet[$it['return_id']][] = [
            'id' => $it['id'],
            'productId' => $it['product_id'] ?: null,
            'description' => $it['description'],
            'hsnCode' => $it['hsn_code'] ?? '',
            'unit' => $it['unit'] ?? 'Nos',
            'originalQuantity' => floatval($it['original_quantity'] ?? 0),
            'quantity' => floatval($it['quantity'] ?? 0),
            'rate' => floatval($it['rate'] ?? 0),
            'taxableAmount' => floatval($it['taxable_amount'] ?? 0),
            'gstRate' => floatval($it['gst_rate'] ?? 0),
            'cgstAmount' => floatval($it['cgst_amount'] ?? 0),
            'sgstAmount' => floatval($it['sgst_amount'] ?? 0),
            'igstAmount' => floatval($it['igst_amount'] ?? 0),
            'taxAmount' => floatval($it['tax_amount'] ?? 0),
            'totalAmount' => floatval($it['total_amount'] ?? 0)
        ];
    }
    return array_map(function ($r) use ($itemsByRet) {
        return [
            'id' => $r['id'],
            'returnNumber' => $r['return_number'],
            'returnDate' => accToSqlDate($r['return_date']) ?: '',
            'purchaseOrderId' => $r['purchase_order_id'],
            'poNumber' => $r['po_number'] ?? '',
            'vendorBillId' => $r['vendor_bill_id'] ?? '',
            'vendorId' => $r['vendor_id'] ?? '',
            'vendorName' => $r['vendor_name'],
            'projectId' => $r['project_id'] ?? '',
            'projectTitle' => $r['project_title'] ?? '',
            'reason' => $r['reason'] ?? '',
            'notes' => $r['notes'] ?? '',
            'warehouseId' => $r['warehouse_id'] ?? '',
            'warehouseName' => $r['warehouse_name'] ?? '',
            'deductInventory' => !empty($r['deduct_inventory']),
            'items' => $itemsByRet[$r['id']] ?? [],
            'subtotal' => floatval($r['subtotal'] ?? 0),
            'cgstAmount' => floatval($r['cgst_amount'] ?? 0),
            'sgstAmount' => floatval($r['sgst_amount'] ?? 0),
            'igstAmount' => floatval($r['igst_amount'] ?? 0),
            'taxAmount' => floatval($r['tax_amount'] ?? 0),
            'totalAmount' => floatval($r['total_amount'] ?? 0),
            'settlementMode' => ($r['settlement_mode'] === 'VENDOR_REFUND') ? 'VENDOR_REFUND' : 'DEBIT_NOTE',
            'refundAmount' => floatval($r['refund_amount'] ?? 0),
            'bankAccountId' => $r['bank_account_id'] ?? '',
            'bankAccountName' => $r['bank_account_name'] ?? '',
            'debitJournalEntryId' => $r['debit_journal_entry_id'] ?? '',
            'refundJournalEntryId' => $r['refund_journal_entry_id'] ?? '',
            'status' => $r['status'] ?? 'POSTED',
            'createdBy' => $r['created_by'] ?? '',
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at']
        ];
    }, $rows);
}

function accCreatePurchaseReturnPhp($pdo, $payload, $actor) {
    ensureAccountingTablesPhp($pdo);
    $poId = trim((string)($payload['purchaseOrderId'] ?? ''));
    if ($poId === '') throw new Exception('Source Purchase Order is required.', 400);
    $rawItems = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $submittedItems = array_values(array_filter($rawItems, function ($it) { return floatval($it['quantity'] ?? 0) > 0; }));
    if (empty($submittedItems)) throw new Exception('Specify return quantity greater than 0 for at least one line item.', 400);

    $pdo->beginTransaction();
    try {
        $settings = accGetSettingsRowPhp($pdo);
        $returnDate = accToSqlDate($payload['returnDate'] ?? '') ?: accTodaySql();
        accAssertNotLockedPhp($pdo, $returnDate);

        $ps = $pdo->prepare('SELECT * FROM `solar_purchase_orders` WHERE `id` = ? FOR UPDATE');
        $ps->execute([$poId]);
        $po = $ps->fetch(PDO::FETCH_ASSOC);
        if (!$po) throw new Exception('Purchase order not found.', 404);
        $poSt = strtoupper(trim((string)($po['status'] ?? 'ISSUED')));
        if ($poSt === 'CANCELLED' || $poSt === 'DRAFT') throw new Exception("Cannot record purchase return against a {$poSt} purchase order.", 400);

        $origItems = json_decode($po['items_json'] ?? '[]', true) ?: [];
        $anyReceived = false;
        foreach ($origItems as $oi) {
            if (floatval($oi['receivedQuantity'] ?? 0) > 0) { $anyReceived = true; break; }
        }
        $poEffGst = floatval($po['subtotal'] ?? 0) > 0 ? accRound2((floatval($po['gst_amount'] ?? 0) / floatval($po['subtotal'])) * 100) : 18;

        $prevStmt = $pdo->prepare("SELECT pri.`product_id`, pri.`description`, SUM(pri.`quantity`) AS prev_qty FROM `solar_purchase_return_items` pri INNER JOIN `solar_purchase_returns` pr ON pr.`id` = pri.`return_id` WHERE pr.`purchase_order_id` = ? AND pr.`status` = 'POSTED' GROUP BY pri.`product_id`, pri.`description`");
        $prevStmt->execute([$poId]);
        $prevByKey = [];
        foreach ($prevStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $k = !empty($r['product_id']) ? ('pid:' . $r['product_id']) : ('desc:' . strtolower(trim((string)($r['description'] ?? ''))));
            $prevByKey[$k] = ($prevByKey[$k] ?? 0) + floatval($r['prev_qty'] ?? 0);
        }

        $subtotal = 0; $cgstTotal = 0; $sgstTotal = 0;
        $computedLines = [];
        foreach ($submittedItems as $subItem) {
            $reqPid = trim((string)($subItem['productId'] ?? ''));
            $reqDesc = trim((string)($subItem['description'] ?? ''));
            $qty = round(floatval($subItem['quantity'] ?? 0), 3);
            if (!is_finite($qty) || $qty <= 0) continue;

            $match = null;
            foreach ($origItems as $oi) {
                $oiPid = trim((string)($oi['productId'] ?? ''));
                $oiDesc = trim((string)($oi['productName'] ?? ($oi['description'] ?? ($oi['name'] ?? ''))));
                if (($reqPid !== '' && $oiPid === $reqPid) || ($reqDesc !== '' && strcasecmp($oiDesc, $reqDesc) === 0)) {
                    $match = $oi;
                    break;
                }
            }
            if (!$match) throw new Exception("Return item \"" . ($reqDesc ?: $reqPid) . "\" does not match any line item on PO {$po['po_number']}.", 400);

            $baseQty = $anyReceived ? floatval($match['receivedQuantity'] ?? 0) : floatval($match['orderedQuantity'] ?? ($match['quantity'] ?? 0));
            $effPid = !empty($match['productId']) ? $match['productId'] : $reqPid;
            $matchDesc = trim((string)($match['productName'] ?? ($match['description'] ?? ($match['name'] ?? $reqDesc))));
            $itemKey = $effPid !== '' ? ('pid:' . $effPid) : ('desc:' . strtolower($matchDesc));
            $prevQty = $prevByKey[$itemKey] ?? 0;
            $maxRem = round(max(0, $baseQty - $prevQty), 3);
            if ($qty > $maxRem + 0.001) {
                throw new Exception("Return quantity ({$qty}) for \"{$matchDesc}\" exceeds remaining returnable quantity ({$maxRem}).", 400);
            }
            $prevByKey[$itemKey] = $prevQty + $qty;

            $rate = accRound2($match['unitPrice'] ?? ($match['rate'] ?? 0));
            $lineTaxable = accRound2($qty * $rate);
            $gstRate = floatval($match['gstRate'] ?? ($match['taxRatePercent'] ?? $poEffGst));
            $lineTax = accRound2(($lineTaxable * $gstRate) / 100);
            $lineCgst = accRound2($lineTax / 2);
            $lineSgst = accRound2($lineTax - $lineCgst);
            $lineTotal = accRound2($lineTaxable + $lineTax);

            $subtotal = accRound2($subtotal + $lineTaxable);
            $cgstTotal = accRound2($cgstTotal + $lineCgst);
            $sgstTotal = accRound2($sgstTotal + $lineSgst);

            $computedLines[] = [
                'productId' => $effPid ?: null,
                'description' => $matchDesc,
                'hsnCode' => (string)($match['hsnCode'] ?? ''),
                'unit' => (string)($match['unit'] ?? 'Nos'),
                'originalQuantity' => $baseQty,
                'quantity' => $qty,
                'rate' => $rate,
                'taxableAmount' => $lineTaxable,
                'gstRate' => $gstRate,
                'cgstAmount' => $lineCgst,
                'sgstAmount' => $lineSgst,
                'igstAmount' => 0,
                'taxAmount' => $lineTax,
                'totalAmount' => $lineTotal
            ];
        }
        if (empty($computedLines)) throw new Exception('No valid returnable line items found.', 400);

        $taxAmount = accRound2($cgstTotal + $sgstTotal);
        $totalAmount = accRound2($subtotal + $taxAmount);

        $poTotal = accRound2($po['total_amount'] ?? 0);
        $poPaid = accRound2($po['paid_amount'] ?? 0);
        $poReturned = accRound2($po['returned_amount'] ?? 0);
        $poRefunded = accRound2($po['refunded_amount'] ?? 0);
        $remRetVal = accRound2(max(0, $poTotal - $poReturned));
        if ($totalAmount > $remRetVal + 0.05) {
            throw new Exception("Return total (₹" . number_format($totalAmount, 2, '.', '') . ") exceeds remaining non-returned PO value (₹" . number_format($remRetVal, 2, '.', '') . ").", 400);
        }

        $settlementMode = (($payload['settlementMode'] ?? '') === 'VENDOR_REFUND') ? 'VENDOR_REFUND' : 'DEBIT_NOTE';
        $refundAmount = $settlementMode === 'VENDOR_REFUND' ? accRound2($payload['refundAmount'] ?? $totalAmount) : 0;
        $netPaidSoFar = accRound2(max(0, $poPaid - $poRefunded));

        $bank = null; $bankCoaId = '';
        if ($settlementMode === 'VENDOR_REFUND') {
            if ($netPaidSoFar <= 0) throw new Exception('Cannot record a vendor refund because no net payment has been made on this PO. Use Debit Note adjustment instead.', 400);
            if (!is_finite($refundAmount) || $refundAmount <= 0) throw new Exception('Refund amount must be greater than zero for Vendor Refund settlement.', 400);
            if ($refundAmount > $totalAmount + 0.01) throw new Exception('Refund amount cannot exceed Debit Note total.', 400);
            if ($refundAmount > $netPaidSoFar + 0.01) throw new Exception('Refund amount exceeds net paid amount available for refund.', 400);
            $resolved = accResolveBankAccountTxPhp($pdo, $payload['bankAccountId'] ?? '', $settings);
            $bank = $resolved['bank'];
            $bankCoaId = $resolved['coaId'];
        }

        $bill = accEnsurePurchaseOrderBillTxPhp($pdo, $po, $settings, $actor);

        $id = 'pr-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
        $returnNumber = trim((string)($payload['returnNumber'] ?? ('DN-' . substr($returnDate, 0, 4) . '-' . accRandDigits(4))));
        $deductInventory = !isset($payload['deductInventory']) || (bool)$payload['deductInventory'];
        $warehouseId = trim((string)($payload['warehouseId'] ?? ($po['warehouse_id'] ?? '')));
        $warehouseName = trim((string)($payload['warehouseName'] ?? ($po['warehouse_name'] ?? '')));
        $actorName = trim((string)($actor['name'] ?? ($actor['email'] ?? 'Admin'))) ?: 'Admin';

        if ($deductInventory) {
            foreach ($computedLines as $li) {
                if (!empty($li['productId'])) {
                    accAdjustProductStockTxPhp($pdo, [
                        'productId' => $li['productId'],
                        'deltaQty' => -$li['quantity'],
                        'warehouseId' => $warehouseId,
                        'warehouseName' => $warehouseName,
                        'movementType' => 'PURCHASE_RETURN',
                        'referenceNumber' => $returnNumber,
                        'referenceId' => $id,
                        'notes' => "Purchase Return {$returnNumber} to {$po['vendor_name']} (PO {$po['po_number']})",
                        'actorName' => $actorName
                    ]);
                }
            }
        }

        $dnLines = [
            ['accountId' => $settings['default_ap_account_id'] ?? 'acc-2010', 'description' => "Debit Note {$returnNumber} - {$po['vendor_name']} (PO {$po['po_number']})", 'projectId' => $po['project_id'] ?? '', 'projectTitle' => $po['project_title'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $po['vendor_id'] ?? '', 'partyName' => $po['vendor_name'] ?? '', 'debit' => $totalAmount, 'credit' => 0],
            ['accountId' => $settings['default_cogs_account_id'] ?? 'acc-5010', 'description' => "Purchase Return {$returnNumber} - Material Credit", 'projectId' => $po['project_id'] ?? '', 'projectTitle' => $po['project_title'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $po['vendor_id'] ?? '', 'partyName' => $po['vendor_name'] ?? '', 'debit' => 0, 'credit' => $subtotal]
        ];
        if ($taxAmount > 0) {
            $dnLines[] = ['accountId' => $settings['default_input_gst_account_id'] ?? 'acc-1150', 'description' => "Input GST ITC Reversal - {$returnNumber}", 'projectId' => $po['project_id'] ?? '', 'projectTitle' => $po['project_title'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $po['vendor_id'] ?? '', 'partyName' => $po['vendor_name'] ?? '', 'debit' => 0, 'credit' => $taxAmount];
        }

        $debitJournalEntryId = accInsertJournalTxPhp($pdo, [
            'entryDate' => $returnDate,
            'referenceType' => 'PURCHASE_RETURN',
            'referenceId' => $id,
            'referenceNumber' => $returnNumber,
            'narration' => "Purchase Return {$returnNumber} against PO {$po['po_number']} ({$po['vendor_name']})",
            'status' => 'POSTED',
            'lines' => $dnLines
        ], $actor);

        $refundJournalEntryId = '';
        if ($settlementMode === 'VENDOR_REFUND' && $bank && $refundAmount > 0) {
            $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')
                ->execute([$refundAmount, $bank['id']]);
            $refundJournalEntryId = accInsertJournalTxPhp($pdo, [
                'entryDate' => $returnDate,
                'referenceType' => 'PURCHASE_RETURN_REFUND',
                'referenceId' => $id,
                'referenceNumber' => $returnNumber,
                'narration' => "Vendor Refund {$returnNumber} from {$po['vendor_name']} into {$bank['account_name']}",
                'status' => 'POSTED',
                'lines' => [
                    ['accountId' => $bankCoaId, 'description' => "Vendor refund received in {$bank['account_name']}", 'projectId' => $po['project_id'] ?? '', 'projectTitle' => $po['project_title'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $po['vendor_id'] ?? '', 'partyName' => $po['vendor_name'] ?? '', 'debit' => $refundAmount, 'credit' => 0],
                    ['accountId' => $settings['default_ap_account_id'] ?? 'acc-2010', 'description' => "Vendor refund adjustment {$returnNumber} - {$po['vendor_name']}", 'projectId' => $po['project_id'] ?? '', 'projectTitle' => $po['project_title'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $po['vendor_id'] ?? '', 'partyName' => $po['vendor_name'] ?? '', 'debit' => 0, 'credit' => $refundAmount]
                ]
            ], $actor);
        }

        $pdo->prepare("INSERT INTO `solar_purchase_returns`
            (`id`,`return_number`,`return_date`,`purchase_order_id`,`po_number`,`vendor_bill_id`,`vendor_id`,`vendor_name`,`project_id`,`project_title`,`reason`,`notes`,`warehouse_id`,`warehouse_name`,`deduct_inventory`,`subtotal`,`cgst_amount`,`sgst_amount`,`igst_amount`,`tax_amount`,`total_amount`,`settlement_mode`,`refund_amount`,`bank_account_id`,`bank_account_name`,`debit_journal_entry_id`,`refund_journal_entry_id`,`status`,`created_by`)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'POSTED',?)")
            ->execute([
                $id, $returnNumber, $returnDate, $po['id'], $po['po_number'], $bill['id'] ?? '', $po['vendor_id'] ?? '', $po['vendor_name'] ?? 'Vendor',
                $po['project_id'] ?? '', $po['project_title'] ?? '', trim((string)($payload['reason'] ?? '')), trim((string)($payload['notes'] ?? '')),
                $warehouseId, $warehouseName, $deductInventory ? 1 : 0, $subtotal, $cgstTotal, $sgstTotal, 0, $taxAmount, $totalAmount,
                $settlementMode, $refundAmount, $bank['id'] ?? '', $bank['account_name'] ?? '', $debitJournalEntryId, $refundJournalEntryId, $actorName
            ]);

        $iStmt = $pdo->prepare("INSERT INTO `solar_purchase_return_items` (`id`,`return_id`,`line_order`,`product_id`,`description`,`hsn_code`,`unit`,`original_quantity`,`quantity`,`rate`,`taxable_amount`,`gst_rate`,`cgst_amount`,`sgst_amount`,`igst_amount`,`tax_amount`,`total_amount`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        foreach ($computedLines as $idx => $li) {
            $iStmt->execute([
                "pri-{$id}-{$idx}", $id, $idx, $li['productId'], $li['description'], $li['hsnCode'], $li['unit'],
                $li['originalQuantity'], $li['quantity'], $li['rate'], $li['taxableAmount'], $li['gstRate'],
                $li['cgstAmount'], $li['sgstAmount'], $li['igstAmount'], $li['taxAmount'], $li['totalAmount']
            ]);
        }

        $nextReturned = accRound2($poReturned + $totalAmount);
        $nextRefunded = accRound2($poRefunded + $refundAmount);
        $nextNetPaid = accRound2(max(0, $poPaid - $nextRefunded));
        $nextBalance = accRound2(max(0, $poTotal - $nextReturned - $nextNetPaid));
        $nextPoPayStatus = ($nextBalance <= 0.01 && $poTotal > 0) ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIALLY_PAID' : 'PENDING');

        $pdo->prepare('UPDATE `solar_purchase_orders` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')
            ->execute([$nextReturned, $nextRefunded, $nextBalance, $nextPoPayStatus, $po['id']]);

        if ($bill) {
            $nextBillStatus = ($nextBalance <= 0.01 && floatval($bill['total_amount'] ?? 0) > 0) ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIAL' : 'OPEN');
            $pdo->prepare('UPDATE `solar_acc_vendor_bills` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`status`=? WHERE `id`=?')
                ->execute([$nextReturned, $nextRefunded, $nextBalance, $nextBillStatus, $bill['id']]);
        }

        accLogAuditPhp($pdo, $actor, 'PURCHASE_RETURNS', 'CREATE_PURCHASE_RETURN', $id, $returnNumber, "Recorded Purchase Return {$returnNumber} (₹{$totalAmount}) for PO {$po['po_number']}");
        $pdo->commit();
        return ['id' => $id, 'returnNumber' => $returnNumber, 'totalAmount' => $totalAmount, 'refundAmount' => $refundAmount, 'debitJournalEntryId' => $debitJournalEntryId, 'refundJournalEntryId' => $refundJournalEntryId];
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function accDeletePurchaseReturnPhp($pdo, $id, $actor) {
    ensureAccountingTablesPhp($pdo);
    $pdo->beginTransaction();
    try {
        $s = $pdo->prepare('SELECT * FROM `solar_purchase_returns` WHERE `id` = ? FOR UPDATE');
        $s->execute([$id]);
        $pr = $s->fetch(PDO::FETCH_ASSOC);
        if (!$pr) throw new Exception('Purchase return not found.', 404);
        accAssertNotLockedPhp($pdo, accToSqlDate($pr['return_date'] ?? '') ?: accTodaySql());

        $is = $pdo->prepare('SELECT * FROM `solar_purchase_return_items` WHERE `return_id` = ?');
        $is->execute([$id]);
        $items = $is->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $actorName = trim((string)($actor['name'] ?? ($actor['email'] ?? 'Admin'))) ?: 'Admin';

        if (!empty($pr['deduct_inventory'])) {
            foreach ($items as $li) {
                if (!empty($li['product_id'])) {
                    accAdjustProductStockTxPhp($pdo, [
                        'productId' => $li['product_id'],
                        'deltaQty' => floatval($li['quantity'] ?? 0),
                        'warehouseId' => $pr['warehouse_id'] ?? '',
                        'warehouseName' => $pr['warehouse_name'] ?? '',
                        'movementType' => 'PURCHASE_RETURN',
                        'referenceNumber' => 'REV-' . $pr['return_number'],
                        'referenceId' => $id . '-REV',
                        'notes' => "Reversed Purchase Return {$pr['return_number']}",
                        'actorName' => $actorName
                    ]);
                }
            }
            $pdo->prepare('DELETE FROM `solar_stock_movements` WHERE `reference_id` IN (?, ?)')->execute([$id, $id . '-REV']);
        }

        if (!empty($pr['bank_account_id']) && floatval($pr['refund_amount'] ?? 0) > 0) {
            $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')
                ->execute([accRound2($pr['refund_amount']), $pr['bank_account_id']]);
        }

        $retAmt = accRound2($pr['total_amount'] ?? 0);
        $refAmt = accRound2($pr['refund_amount'] ?? 0);

        $ps = $pdo->prepare('SELECT * FROM `solar_purchase_orders` WHERE `id` = ? FOR UPDATE');
        $ps->execute([$pr['purchase_order_id']]);
        $po = $ps->fetch(PDO::FETCH_ASSOC);
        if ($po) {
            $total = accRound2($po['total_amount'] ?? 0);
            $paid = accRound2($po['paid_amount'] ?? 0);
            $nextRet = accRound2(max(0, floatval($po['returned_amount'] ?? 0) - $retAmt));
            $nextRef = accRound2(max(0, floatval($po['refunded_amount'] ?? 0) - $refAmt));
            $nextNetPaid = accRound2(max(0, $paid - $nextRef));
            $nextBal = accRound2(max(0, $total - $nextRet - $nextNetPaid));
            $nextSt = ($nextBal <= 0.01 && $total > 0) ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIALLY_PAID' : 'PENDING');
            $pdo->prepare('UPDATE `solar_purchase_orders` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')
                ->execute([$nextRet, $nextRef, $nextBal, $nextSt, $po['id']]);
        }

        if (!empty($pr['vendor_bill_id'])) {
            $bs = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? FOR UPDATE');
            $bs->execute([$pr['vendor_bill_id']]);
            $bill = $bs->fetch(PDO::FETCH_ASSOC);
            if ($bill) {
                $total = accRound2($bill['total_amount'] ?? 0);
                $paid = accRound2($bill['paid_amount'] ?? 0);
                $nextRet = accRound2(max(0, floatval($bill['returned_amount'] ?? 0) - $retAmt));
                $nextRef = accRound2(max(0, floatval($bill['refunded_amount'] ?? 0) - $refAmt));
                $nextNetPaid = accRound2(max(0, $paid - $nextRef));
                $nextBal = accRound2(max(0, $total - $nextRet - $nextNetPaid));
                $nextBillSt = ($nextBal <= 0.01 && $total > 0) ? 'PAID' : ($nextNetPaid > 0.01 ? 'PARTIAL' : 'OPEN');
                $pdo->prepare('UPDATE `solar_acc_vendor_bills` SET `returned_amount`=?,`refunded_amount`=?,`balance_amount`=?,`status`=? WHERE `id`=?')
                    ->execute([$nextRet, $nextRef, $nextBal, $nextBillSt, $bill['id']]);
            }
        }

        $jeIds = array_values(array_filter([$pr['debit_journal_entry_id'] ?? '', $pr['refund_journal_entry_id'] ?? '']));
        if (!empty($jeIds)) {
            $ph = implode(',', array_fill(0, count($jeIds), '?'));
            $pdo->prepare("DELETE FROM `solar_acc_journal_entries` WHERE `id` IN ({$ph})")->execute($jeIds);
            accRecalcBalancesPhp($pdo);
        }

        $pdo->prepare('DELETE FROM `solar_purchase_returns` WHERE `id` = ?')->execute([$id]);
        accLogAuditPhp($pdo, $actor, 'PURCHASE_RETURNS', 'DELETE_PURCHASE_RETURN', $id, $pr['return_number'], "Deleted & reversed Purchase Return {$pr['return_number']}");
        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function handleAccountingRoutePhp($pdo, $cleanPath, $method, $body, $actor) {
    ensureAccountingTablesPhp($pdo);

    if ($cleanPath === '/accounting/bank-accounts' && $method === 'GET') {
        $role = trim((string)($actor['role'] ?? ''));
        $acctType = strtoupper(trim((string)($actor['accountType'] ?? '')));
        if ($acctType === 'CUSTOMER' || strtoupper($role) === 'CUSTOMER') {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied.']);
            exit;
        }
        echo json_encode(['success' => true, 'data' => accGetBankAccountsPhp($pdo)]);
        exit;
    }

    accRequireViewerPhp($actor);

    try {
        if ($cleanPath === '/accounting/workspace' && $method === 'GET') {
            echo json_encode(['success' => true, 'data' => accGetWorkspacePhp($pdo)]);
            exit;
        }

        if ($cleanPath === '/accounting/expenses' && $method === 'POST') {
            $amt = accRound2($body['amount'] ?? 0);
            if ($amt <= 0) throw new Exception('Expense amount must be positive.');
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $id = !empty($body['id']) ? $body['id'] : ('exp-' . round(microtime(true) * 1000) . '-' . accRandHex(3));
                $expDate = accToSqlDate($body['expenseDate'] ?? ($body['date'] ?? '')) ?: accTodaySql();

                $exStmt = $pdo->prepare('SELECT * FROM `solar_expenses` WHERE `id` = ? LIMIT 1');
                $exStmt->execute([$id]);
                $existing = $exStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing && ($existing['status'] === 'PAID' || !empty($existing['journal_entry_id']))) {
                    throw new Exception('Disbursed expenses posted to the General Ledger cannot be edited.');
                }

                $expNo = !empty($body['expenseNumber']) ? $body['expenseNumber'] : ($existing['expense_number'] ?? ('EXP-' . substr($expDate, 0, 4) . '-' . accRandDigits(4)));
                $gst = accRound2($body['gstAmount'] ?? 0);
                $itc = (!empty($body['itcEligible']) && $gst > 0) ? 1 : 0;
                $type = (($body['expenseType'] ?? '') === 'REIMBURSEMENT') ? 'REIMBURSEMENT' : 'DIRECT_EXPENSE';
                $needsApproval = !empty($settings['require_expense_approval']) && $amt >= floatval($settings['approval_threshold'] ?? 0);
                $status = (!empty($body['status']) && $body['status'] !== 'PAID') ? $body['status'] : '';
                if (!$status || ($existing && $existing['status'] === 'REJECTED')) {
                    $status = ($type === 'REIMBURSEMENT' || $needsApproval) ? 'PENDING_APPROVAL' : 'APPROVED';
                }
                $expAcc = $body['expenseAccountId'] ?? ($type === 'REIMBURSEMENT' ? 'acc-5040' : 'acc-5050');

                $stmt = $pdo->prepare("INSERT INTO `solar_expenses` (`id`,`expense_number`,`project_id`,`project_code`,`vendor_name`,`category`,`amount`,`expense_date`,`payment_mode`,`reference_no`,`notes`,`receipt_url`,`approved_by`,`expense_type`,`status`,`employee_id`,`employee_name`,`gst_amount`,`itc_eligible`,`bank_account_id`,`expense_account_id`,`rejection_reason`,`tally_sync_status`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'','NOT SYNCED') ON DUPLICATE KEY UPDATE `project_id`=VALUES(`project_id`),`project_code`=VALUES(`project_code`),`vendor_name`=VALUES(`vendor_name`),`category`=VALUES(`category`),`amount`=VALUES(`amount`),`expense_date`=VALUES(`expense_date`),`payment_mode`=VALUES(`payment_mode`),`reference_no`=VALUES(`reference_no`),`notes`=VALUES(`notes`),`receipt_url`=VALUES(`receipt_url`),`approved_by`=VALUES(`approved_by`),`expense_type`=VALUES(`expense_type`),`status`=VALUES(`status`),`employee_id`=VALUES(`employee_id`),`employee_name`=VALUES(`employee_name`),`gst_amount`=VALUES(`gst_amount`),`itc_eligible`=VALUES(`itc_eligible`),`expense_account_id`=VALUES(`expense_account_id`),`rejection_reason`=''");
                $stmt->execute([
                    $id, $expNo, $body['projectId'] ?? '', $body['projectCode'] ?? '', $body['vendorName'] ?? ($body['employeeName'] ?? 'General Expense'),
                    $body['category'] ?? 'Travel & Food', $amt, $expDate, $body['paymentMode'] ?? 'Bank Payment',
                    $body['referenceNo'] ?? '', $body['notes'] ?? '', $body['receiptUrl'] ?? '',
                    $status === 'APPROVED' ? ($actor['name'] ?? 'Auto-Approved') : '',
                    $type, $status, $body['employeeId'] ?? '', $body['employeeName'] ?? '',
                    $gst, $itc, $body['bankAccountId'] ?? '', $expAcc
                ]);
                accLogAuditPhp($pdo, $actor, 'EXPENSES', $existing ? 'UPDATE_EXPENSE' : 'SAVE_EXPENSE', $id, $expNo, ($existing ? 'Updated ' : 'Submitted ') . "{$type} {$expNo} for {$amt} ({$status})");
                $pdo->commit();
                http_response_code(201);
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'expenseNumber' => $expNo, 'status' => $status]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        accRequireManagerPhp($actor);

        // Accounts
        if ($cleanPath === '/accounting/accounts' && $method === 'POST') {
            $code = trim((string)($body['code'] ?? ''));
            $name = trim((string)($body['name'] ?? ''));
            $type = strtoupper(trim((string)($body['accountType'] ?? '')));
            if (!$code || !$name || !in_array($type, ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], true)) {
                throw new Exception('Account code, name, and valid account type are required.');
            }
            $id = !empty($body['id']) ? $body['id'] : ('acc-' . $code . '-' . round(microtime(true) * 1000));
            $dup = $pdo->prepare('SELECT `id` FROM `solar_acc_accounts` WHERE `code` = ? AND `id` <> ? LIMIT 1');
            $dup->execute([$code, $id]);
            if ($dup->fetch()) throw new Exception("Account code {$code} is already in use.");
            $op = accRound2($body['openingBalance'] ?? 0);
            $stmt = $pdo->prepare("INSERT INTO `solar_acc_accounts` (`id`,`code`,`name`,`account_type`,`sub_type`,`parent_id`,`description`,`opening_balance`,`current_balance`,`is_system`,`is_active`) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `code`=VALUES(`code`),`name`=VALUES(`name`),`account_type`=VALUES(`account_type`),`sub_type`=VALUES(`sub_type`),`parent_id`=VALUES(`parent_id`),`description`=VALUES(`description`),`opening_balance`=VALUES(`opening_balance`),`is_active`=VALUES(`is_active`)");
            $stmt->execute([$id, $code, $name, $type, $body['subType'] ?? '', $body['parentId'] ?? null, $body['description'] ?? '', $op, $op, !empty($body['isSystem']) ? 1 : 0, (isset($body['isActive']) && $body['isActive'] === false) ? 0 : 1]);
            accRecalcBalancesPhp($pdo);
            accLogAuditPhp($pdo, $actor, 'ACCOUNTS', 'SAVE_ACCOUNT', $id, $code, "Saved ledger account {$code} - {$name}");
            echo json_encode(['success' => true, 'data' => ['id' => $id, 'code' => $code, 'name' => $name]]);
            exit;
        }

        if (preg_match('#^/accounting/accounts/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $s = $pdo->prepare('SELECT * FROM `solar_acc_accounts` WHERE `id` = ? LIMIT 1');
            $s->execute([$id]);
            $acc = $s->fetch(PDO::FETCH_ASSOC);
            if (!$acc) throw new Exception('Account not found.');
            if (!empty($acc['is_system'])) throw new Exception('System control accounts cannot be deleted.');
            $u = $pdo->prepare('SELECT COUNT(*) FROM `solar_acc_journal_lines` WHERE `account_id` = ?');
            $u->execute([$id]);
            if ((int)$u->fetchColumn() > 0) throw new Exception('Cannot delete account with posted journal lines.');
            $pdo->prepare('DELETE FROM `solar_acc_accounts` WHERE `id` = ?')->execute([$id]);
            accLogAuditPhp($pdo, $actor, 'ACCOUNTS', 'DELETE_ACCOUNT', $id, $acc['code'], "Deleted account {$acc['code']}");
            echo json_encode(['success' => true, 'message' => 'Ledger account deleted.']);
            exit;
        }

        // Journals
        if ($cleanPath === '/accounting/journals' && $method === 'POST') {
            $pdo->beginTransaction();
            try {
                if (!empty($body['id'])) {
                    $s = $pdo->prepare('SELECT `status` FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1');
                    $s->execute([$body['id']]);
                    $ex = $s->fetch(PDO::FETCH_ASSOC);
                    if ($ex && $ex['status'] !== 'DRAFT') throw new Exception('Posted/reversed journals are immutable.');
                    $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$body['id']]);
                }
                $jid = accInsertJournalTxPhp($pdo, $body, $actor);
                accLogAuditPhp($pdo, $actor, 'LEDGER', 'SAVE_JOURNAL', $jid, $body['entryNumber'] ?? $jid, $body['narration'] ?? 'Journal entry');
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $jid]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/journals/([^/]+)/post$#', $cleanPath, $m) && $method === 'POST') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $s = $pdo->prepare('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1');
                $s->execute([$id]);
                $je = $s->fetch(PDO::FETCH_ASSOC);
                if (!$je || $je['status'] !== 'DRAFT') throw new Exception('Only DRAFT journals can be posted.');
                accAssertNotLockedPhp($pdo, accToSqlDate($je['entry_date']) ?: accTodaySql());
                $ls = $pdo->prepare('SELECT * FROM `solar_acc_journal_lines` WHERE `journal_id` = ?');
                $ls->execute([$id]);
                $lines = $ls->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $td = 0; $tc = 0;
                foreach ($lines as $l) { $td = accRound2($td + floatval($l['debit'])); $tc = accRound2($tc + floatval($l['credit'])); }
                if (count($lines) < 2 || abs($td - $tc) >= 0.01) throw new Exception('Journal entry must be balanced before posting.');
                $pdo->prepare('UPDATE `solar_acc_journal_entries` SET `status`=?,`total_debit`=?,`total_credit`=?,`posted_by`=?,`posted_at`=? WHERE `id`=?')->execute(['POSTED', $td, $tc, $actor['name'] ?? 'Admin', gmdate('c'), $id]);
                accRecalcBalancesPhp($pdo);
                accLogAuditPhp($pdo, $actor, 'LEDGER', 'POST_JOURNAL', $id, $je['entry_number'], "Posted {$je['entry_number']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'status' => 'POSTED']]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/journals/([^/]+)/reverse$#', $cleanPath, $m) && $method === 'POST') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $s = $pdo->prepare('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1');
                $s->execute([$id]);
                $je = $s->fetch(PDO::FETCH_ASSOC);
                if (!$je || $je['status'] !== 'POSTED') throw new Exception('Only POSTED journals can be reversed.');
                $revDate = accTodaySql();
                accAssertNotLockedPhp($pdo, $revDate);
                $reason = trim((string)($body['reason'] ?? ''));
                $reasonPart = $reason !== '' ? " ({$reason})" : '';
                $ls = $pdo->prepare('SELECT * FROM `solar_acc_journal_lines` WHERE `journal_id` = ? ORDER BY `line_order` ASC');
                $ls->execute([$id]);
                $lines = $ls->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $revLines = array_map(function ($l) use ($je) {
                    return [
                        'accountId' => $l['account_id'],
                        'description' => "Reversal of {$je['entry_number']}: " . ($l['description'] ?? ''),
                        'projectId' => $l['project_id'] ?? '',
                        'projectTitle' => $l['project_title'] ?? '',
                        'partyType' => $l['party_type'] ?? 'NONE',
                        'partyId' => $l['party_id'] ?? '',
                        'partyName' => $l['party_name'] ?? '',
                        'debit' => floatval($l['credit']),
                        'credit' => floatval($l['debit'])
                    ];
                }, $lines);
                $revId = accInsertJournalTxPhp($pdo, [
                    'entryNumber' => 'REV-' . $je['entry_number'] . '-' . rand(10, 99),
                    'entryDate' => $revDate,
                    'referenceType' => 'REVERSAL',
                    'referenceId' => $id,
                    'referenceNumber' => $je['entry_number'],
                    'narration' => "Reversal of {$je['entry_number']}{$reasonPart}: {$je['narration']}",
                    'status' => 'POSTED',
                    'lines' => $revLines
                ], $actor);
                $pdo->prepare('UPDATE `solar_acc_journal_entries` SET `status`=?,`reversed_entry_id`=? WHERE `id`=?')->execute(['REVERSED', $revId, $id]);
                accRecalcBalancesPhp($pdo);
                accLogAuditPhp($pdo, $actor, 'LEDGER', 'REVERSE_JOURNAL', $id, $je['entry_number'], "Reversed {$je['entry_number']} via {$revId}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['originalId' => $id, 'reversalJournalId' => $revId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/journals/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $s = $pdo->prepare('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1');
            $s->execute([$id]);
            $je = $s->fetch(PDO::FETCH_ASSOC);
            if (!$je || $je['status'] !== 'DRAFT') throw new Exception('Only DRAFT journals can be deleted.');
            $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Draft journal deleted.']);
            exit;
        }

        // Customer Receipts (Create & Edit)
        $isReceiptCreate = ($cleanPath === '/accounting/customer-receipts' && $method === 'POST');
        $isReceiptUpdate = (preg_match('#^/accounting/customer-receipts/([^/]+)$#', $cleanPath, $rm) && $method === 'PUT');
        if ($isReceiptCreate || $isReceiptUpdate) {
            if ($isReceiptUpdate) $body['id'] = urldecode($rm[1]);
            $amt = accRound2($body['amount'] ?? 0);
            if ($amt <= 0) throw new Exception('Receipt amount must be positive.');
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $paidDate = accToSqlDate($body['paidDate'] ?? ($body['receiptDate'] ?? '')) ?: accTodaySql();
                $dueDate = accToSqlDate($body['dueDate'] ?? '') ?: $paidDate;
                $status = (($body['status'] ?? '') === 'PENDING') ? 'PENDING' : 'PAID';
                $id = !empty($body['id']) ? $body['id'] : ('pay-' . round(microtime(true) * 1000) . '-' . accRandHex(3));

                $exStmt = $pdo->prepare('SELECT * FROM `solar_payments` WHERE `id` = ? LIMIT 1');
                $exStmt->execute([$id]);
                $existing = $exStmt->fetch(PDO::FETCH_ASSOC);

                if ($existing && $existing['status'] === 'PAID') {
                    $oldDate = accToSqlDate($existing['paid_date'] ?? ($existing['due_date'] ?? '')) ?: accTodaySql();
                    accAssertNotLockedPhp($pdo, $oldDate);
                    $oldAmt = accRound2(floatval($existing['amount'] ?? 0));
                    if (!empty($existing['bank_account_id'])) {
                        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$oldAmt, $existing['bank_account_id']]);
                    }
                    if (!empty($existing['invoice_id'])) {
                        $ois = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1');
                        $ois->execute([$existing['invoice_id']]);
                        $oldInv = $ois->fetch(PDO::FETCH_ASSOC);
                        if ($oldInv) {
                            $revPaid = accRound2(max(0, floatval($oldInv['paid_amount']) - $oldAmt));
                            $tot = accRound2(floatval($oldInv['total_amount']));
                            $ret = accRound2(floatval($oldInv['returned_amount'] ?? 0));
                            $ref = accRound2(floatval($oldInv['refunded_amount'] ?? 0));
                            $revNetPaid = accRound2(max(0, $revPaid - $ref));
                            $revBal = accRound2(max(0, $tot - $ret - $revNetPaid));
                            $revStat = $revBal <= 0.01 ? 'PAID' : ($revNetPaid > 0.01 ? 'PARTIAL' : 'ISSUED');
                            $pdo->prepare('UPDATE `solar_sales_invoices` SET `paid_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')->execute([$revPaid, $revBal, $revStat, $oldInv['id']]);
                        }
                    }
                    if (!empty($existing['journal_entry_id'])) {
                        $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$existing['journal_entry_id']]);
                        accRecalcBalancesPhp($pdo);
                    }
                }

                if ($status === 'PAID') accAssertNotLockedPhp($pdo, $paidDate);
                $rcptNo = !empty($body['receiptNumber']) ? $body['receiptNumber'] : ($existing['receipt_number'] ?? ('RCPT-' . substr($paidDate, 0, 4) . '-' . accRandDigits(4)));

                $selectedBankId = trim((string)($body['bankAccountId'] ?? ''));
                $bankCoa = $settings['default_bank_account_id'] ?? 'acc-1020';
                if ($status === 'PAID') {
                    $resolvedBank = accResolveBankAccountTxPhp($pdo, $selectedBankId ?: 'bank-main-current', $settings, $body['paymentMode'] ?? '');
                    $selectedBankId = $resolvedBank['bank']['id'];
                    $bankCoa = $resolvedBank['coaId'];
                } elseif (stripos($body['paymentMode'] ?? '', 'cash') !== false) {
                    $bankCoa = $settings['default_cash_account_id'] ?? 'acc-1010';
                }

                $invNo = $body['invoiceNumber'] ?? '';
                $custId = $body['customerId'] ?? '';
                $custName = $body['customerName'] ?? 'Solar Customer';
                $projId = $body['projectId'] ?? '';

                if (!empty($body['invoiceId'])) {
                    $is = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1');
                    $is->execute([$body['invoiceId']]);
                    $inv = $is->fetch(PDO::FETCH_ASSOC);
                    if ($inv) {
                        $invNo = $inv['invoice_number'];
                        if (!$custId) $custId = $inv['customer_id'];
                        if ($custName === 'Solar Customer') $custName = $inv['customer_name'];
                        if (!$projId) $projId = $inv['project_id'];
                        if ($status === 'PAID') {
                            accEnsureSalesInvoiceJournalTxPhp($pdo, $inv, $settings, $actor);
                            $newPaid = accRound2(floatval($inv['paid_amount']) + $amt);
                            $tot = accRound2(floatval($inv['total_amount']));
                            $ret = accRound2(floatval($inv['returned_amount'] ?? 0));
                            $ref = accRound2(floatval($inv['refunded_amount'] ?? 0));
                            $netPaid = accRound2(max(0, $newPaid - $ref));
                            $newBal = accRound2(max(0, $tot - $ret - $netPaid));
                            $invStat = $newBal <= 0.01 ? 'PAID' : 'PARTIAL';
                            $pdo->prepare('UPDATE `solar_sales_invoices` SET `paid_amount`=?,`balance_amount`=?,`payment_status`=?,`bank_account_id`=? WHERE `id`=?')->execute([$newPaid, $newBal, $invStat, $selectedBankId, $inv['id']]);
                        }
                    }
                }

                $jeId = '';
                if ($status === 'PAID') {
                    if ($selectedBankId !== '') {
                        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')->execute([$amt, $selectedBankId]);
                    }
                    $jeId = accInsertJournalTxPhp($pdo, [
                        'entryDate' => $paidDate, 'referenceType' => 'CUSTOMER_RECEIPT', 'referenceId' => $id, 'referenceNumber' => $rcptNo,
                        'narration' => "Customer receipt {$rcptNo} from {$custName}", 'status' => 'POSTED',
                        'lines' => [
                            ['accountId' => $bankCoa, 'description' => $body['paymentMode'] ?? 'Receipt', 'projectId' => $projId, 'partyType' => 'CUSTOMER', 'partyId' => $custId, 'partyName' => $custName, 'debit' => $amt, 'credit' => 0],
                            ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'description' => "Receivable settlement - {$custName}", 'projectId' => $projId, 'partyType' => 'CUSTOMER', 'partyId' => $custId, 'partyName' => $custName, 'debit' => 0, 'credit' => $amt]
                        ]
                    ], $actor);
                }

                $pdo->prepare("INSERT INTO `solar_payments` (`id`,`receipt_number`,`project_id`,`customer_id`,`customer_name`,`milestone`,`amount`,`status`,`due_date`,`paid_date`,`payment_mode`,`transaction_reference`,`notes`,`invoice_id`,`invoice_number`,`bank_account_id`,`journal_entry_id`,`tally_sync_status`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'NOT SYNCED') ON DUPLICATE KEY UPDATE `project_id`=VALUES(`project_id`),`customer_id`=VALUES(`customer_id`),`customer_name`=VALUES(`customer_name`),`milestone`=VALUES(`milestone`),`amount`=VALUES(`amount`),`status`=VALUES(`status`),`due_date`=VALUES(`due_date`),`paid_date`=VALUES(`paid_date`),`payment_mode`=VALUES(`payment_mode`),`transaction_reference`=VALUES(`transaction_reference`),`notes`=VALUES(`notes`),`invoice_id`=VALUES(`invoice_id`),`invoice_number`=VALUES(`invoice_number`),`bank_account_id`=VALUES(`bank_account_id`),`journal_entry_id`=VALUES(`journal_entry_id`)")
                    ->execute([$id, $rcptNo, $projId, $custId, $custName, $body['milestone'] ?? 'Project Milestone', $amt, $status, $dueDate, $status === 'PAID' ? $paidDate : null, $body['paymentMode'] ?? 'Bank NEFT/RTGS', $body['transactionReference'] ?? '', $body['notes'] ?? '', $body['invoiceId'] ?? '', $invNo, $selectedBankId, $jeId]);
                if (!empty($projId)) {
                    $pdo->prepare('UPDATE `solar_projects` SET `received_inflow` = NULL WHERE `id` = ?')->execute([$projId]);
                }
                accLogAuditPhp($pdo, $actor, 'CUSTOMER_PAYMENTS', $existing ? 'UPDATE_RECEIPT' : 'RECORD_RECEIPT', $id, $rcptNo, ($existing ? 'Updated ' : 'Recorded ') . "receipt {$rcptNo} from {$custName} for {$amt}");
                $pdo->commit();
                if ($isReceiptCreate) http_response_code(201);
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'receiptNumber' => $rcptNo, 'amount' => $amt, 'status' => $status, 'journalEntryId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/customer-receipts/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $rs = $pdo->prepare('SELECT * FROM `solar_payments` WHERE `id` = ? LIMIT 1');
                $rs->execute([$id]);
                $receipt = $rs->fetch(PDO::FETCH_ASSOC);
                if (!$receipt) throw new Exception('Customer receipt not found.');
                if ($receipt['status'] === 'PAID') {
                    $payDate = accToSqlDate($receipt['paid_date'] ?? ($receipt['due_date'] ?? '')) ?: accTodaySql();
                    accAssertNotLockedPhp($pdo, $payDate);
                    $amt = accRound2(floatval($receipt['amount'] ?? 0));
                    if (!empty($receipt['bank_account_id'])) {
                        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$amt, $receipt['bank_account_id']]);
                    }
                    if (!empty($receipt['invoice_id'])) {
                        $is = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1');
                        $is->execute([$receipt['invoice_id']]);
                        $inv = $is->fetch(PDO::FETCH_ASSOC);
                        if ($inv) {
                            $newPaid = accRound2(max(0, floatval($inv['paid_amount']) - $amt));
                            $tot = accRound2(floatval($inv['total_amount']));
                            $ret = accRound2(floatval($inv['returned_amount'] ?? 0));
                            $ref = accRound2(floatval($inv['refunded_amount'] ?? 0));
                            $netPaid = accRound2(max(0, $newPaid - $ref));
                            $newBal = accRound2(max(0, $tot - $ret - $netPaid));
                            $invStat = $newBal <= 0.01 ? 'PAID' : ($netPaid > 0.01 ? 'PARTIAL' : 'ISSUED');
                            $pdo->prepare('UPDATE `solar_sales_invoices` SET `paid_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')->execute([$newPaid, $newBal, $invStat, $inv['id']]);
                        }
                    }
                    if (!empty($receipt['journal_entry_id'])) {
                        $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$receipt['journal_entry_id']]);
                        accRecalcBalancesPhp($pdo);
                    }
                }
                $pdo->prepare('DELETE FROM `solar_payments` WHERE `id` = ?')->execute([$id]);
                if (!empty($receipt['project_id'])) {
                    $pdo->prepare('UPDATE `solar_projects` SET `received_inflow` = NULL WHERE `id` = ?')->execute([$receipt['project_id']]);
                }
                accLogAuditPhp($pdo, $actor, 'CUSTOMER_PAYMENTS', 'DELETE_RECEIPT', $id, $receipt['receipt_number'] ?? $id, "Deleted customer receipt {$receipt['receipt_number']} ({$receipt['customer_name']})");
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Customer receipt deleted.']);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        // Vendor Bills
        if ($cleanPath === '/accounting/vendor-bills' && $method === 'POST') {
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $id = !empty($body['id']) ? $body['id'] : ('vbill-' . round(microtime(true) * 1000) . '-' . accRandHex(3));
                $billDate = accToSqlDate($body['billDate'] ?? '') ?: accTodaySql();
                $dueDate = accToSqlDate($body['dueDate'] ?? '') ?: $billDate;
                $items = is_array($body['items'] ?? null) ? $body['items'] : [];
                $subtotal = accRound2($body['subtotal'] ?? 0);
                $gst = accRound2($body['gstAmount'] ?? 0);
                if (count($items) > 0) {
                    $subtotal = 0; $gst = 0;
                    foreach ($items as $it) {
                        $tx = floatval($it['taxableAmount'] ?? (floatval($it['quantity'] ?? 1) * floatval($it['rate'] ?? 0)));
                        $subtotal += $tx;
                        $gst += floatval($it['gstAmount'] ?? ($tx * floatval($it['gstRate'] ?? 0) / 100));
                    }
                    $subtotal = accRound2($subtotal); $gst = accRound2($gst);
                }
                $igst = accRound2($body['igstAmount'] ?? 0);
                $cgst = accRound2($body['cgstAmount'] ?? ($igst > 0 ? 0 : $gst / 2));
                $sgst = accRound2($body['sgstAmount'] ?? ($igst > 0 ? 0 : $gst / 2));
                $totGst = accRound2($cgst + $sgst + $igst) ?: $gst;
                $totalAmt = accRound2($subtotal + $totGst);
                if ($totalAmt <= 0) throw new Exception('Vendor bill total must be positive.');
                $tdsRate = accRound2($body['tdsRate'] ?? 0);
                $tdsAmt = accRound2($body['tdsAmount'] ?? ($subtotal * $tdsRate / 100));
                $status = (($body['status'] ?? '') === 'DRAFT') ? 'DRAFT' : 'OPEN';
                $expAcc = $body['expenseAccountId'] ?? ($settings['default_cogs_account_id'] ?? 'acc-5010');
                $itc = (!isset($body['itcEligible']) || $body['itcEligible']) ? 1 : 0;

                $ex = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1');
                $ex->execute([$id]);
                $existing = $ex->fetch(PDO::FETCH_ASSOC);
                $billNo = trim((string)($body['billNumber'] ?? ($existing['bill_number'] ?? (($settings['bill_prefix'] ?? 'BILL-') . substr($billDate, 0, 4) . '-' . accRandDigits(4)))));

                if ($existing) {
                    if (floatval($existing['paid_amount'] ?? 0) > 0) {
                        throw new Exception('Vendor bills with recorded payments cannot be edited. Reverse the vendor payment first.');
                    }
                    $vpc = $pdo->prepare('SELECT COUNT(*) FROM `solar_acc_vendor_payments` WHERE `bill_id` = ?');
                    $vpc->execute([$id]);
                    if ((int)$vpc->fetchColumn() > 0) {
                        throw new Exception('Vendor bills with payment history cannot be edited.');
                    }
                    if (!empty($existing['journal_entry_id'])) {
                        $oldBillDate = accToSqlDate($existing['bill_date'] ?? '') ?: accTodaySql();
                        accAssertNotLockedPhp($pdo, $oldBillDate);
                        $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$existing['journal_entry_id']]);
                        accRecalcBalancesPhp($pdo);
                    }
                }

                $jeId = '';
                if ($status !== 'DRAFT') {
                    accAssertNotLockedPhp($pdo, $billDate);
                    $lines = [];
                    if ($itc && $totGst > 0) {
                        $lines[] = ['accountId' => $expAcc, 'description' => "Bill {$billNo}", 'projectId' => $body['projectId'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $body['vendorId'] ?? '', 'partyName' => $body['vendorName'] ?? '', 'debit' => $subtotal, 'credit' => 0];
                        $lines[] = ['accountId' => $settings['default_input_gst_account_id'] ?? 'acc-1150', 'description' => "Input GST ITC - {$billNo}", 'projectId' => $body['projectId'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $body['vendorId'] ?? '', 'partyName' => $body['vendorName'] ?? '', 'debit' => $totGst, 'credit' => 0];
                    } else {
                        $lines[] = ['accountId' => $expAcc, 'description' => "Bill {$billNo} (incl. GST)", 'projectId' => $body['projectId'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $body['vendorId'] ?? '', 'partyName' => $body['vendorName'] ?? '', 'debit' => $totalAmt, 'credit' => 0];
                    }
                    $lines[] = ['accountId' => $settings['default_ap_account_id'] ?? 'acc-2010', 'description' => "Payable to " . ($body['vendorName'] ?? 'Vendor'), 'projectId' => $body['projectId'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $body['vendorId'] ?? '', 'partyName' => $body['vendorName'] ?? '', 'debit' => 0, 'credit' => $totalAmt];
                    $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $billDate, 'referenceType' => 'VENDOR_BILL', 'referenceId' => $id, 'referenceNumber' => $billNo, 'narration' => "Vendor Bill {$billNo} - " . ($body['vendorName'] ?? ''), 'status' => 'POSTED', 'lines' => $lines], $actor);
                }

                $paid = 0;
                $bal = accRound2($totalAmt);
                $pdo->prepare("INSERT INTO `solar_acc_vendor_bills` (`id`,`bill_number`,`vendor_id`,`vendor_name`,`vendor_gst`,`po_id`,`po_number`,`project_id`,`project_title`,`bill_date`,`due_date`,`category`,`subtotal`,`cgst_amount`,`sgst_amount`,`igst_amount`,`gst_amount`,`tds_section`,`tds_rate`,`tds_amount`,`total_amount`,`paid_amount`,`balance_amount`,`itc_eligible`,`status`,`expense_account_id`,`journal_entry_id`,`notes`,`items_json`,`created_by`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `bill_number`=VALUES(`bill_number`),`vendor_id`=VALUES(`vendor_id`),`vendor_name`=VALUES(`vendor_name`),`vendor_gst`=VALUES(`vendor_gst`),`po_id`=VALUES(`po_id`),`po_number`=VALUES(`po_number`),`project_id`=VALUES(`project_id`),`project_title`=VALUES(`project_title`),`bill_date`=VALUES(`bill_date`),`due_date`=VALUES(`due_date`),`category`=VALUES(`category`),`subtotal`=VALUES(`subtotal`),`cgst_amount`=VALUES(`cgst_amount`),`sgst_amount`=VALUES(`sgst_amount`),`igst_amount`=VALUES(`igst_amount`),`gst_amount`=VALUES(`gst_amount`),`tds_section`=VALUES(`tds_section`),`tds_rate`=VALUES(`tds_rate`),`tds_amount`=VALUES(`tds_amount`),`total_amount`=VALUES(`total_amount`),`balance_amount`=VALUES(`balance_amount`),`itc_eligible`=VALUES(`itc_eligible`),`status`=VALUES(`status`),`expense_account_id`=VALUES(`expense_account_id`),`journal_entry_id`=VALUES(`journal_entry_id`),`notes`=VALUES(`notes`),`items_json`=VALUES(`items_json`)")
                    ->execute([$id, $billNo, $body['vendorId'] ?? '', $body['vendorName'] ?? 'Vendor', $body['vendorGst'] ?? '', $body['poId'] ?? '', $body['poNumber'] ?? '', $body['projectId'] ?? '', $body['projectTitle'] ?? '', $billDate, $dueDate, $body['category'] ?? 'Material Purchase', $subtotal, $cgst, $sgst, $igst, $totGst, $body['tdsSection'] ?? '', $tdsRate, $tdsAmt, $totalAmt, $paid, $bal, $itc, $status, $expAcc, $jeId, $body['notes'] ?? '', json_encode($items), $actor['name'] ?? 'Admin']);
                accLogAuditPhp($pdo, $actor, 'VENDOR_PAYMENTS', $existing ? 'UPDATE_VENDOR_BILL' : 'SAVE_VENDOR_BILL', $id, $billNo, ($existing ? 'Updated ' : 'Saved ') . "Vendor Bill {$billNo}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'billNumber' => $billNo, 'totalAmount' => $totalAmt, 'balanceAmount' => $bal, 'status' => $status, 'journalEntryId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/vendor-bills/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $s = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1');
                $s->execute([$id]);
                $bill = $s->fetch(PDO::FETCH_ASSOC);
                if (!$bill) throw new Exception('Vendor bill not found.');
                if (floatval($bill['paid_amount']) > 0) throw new Exception('Cannot delete a vendor bill with payments recorded. Reverse vendor payments first.');
                $vpc = $pdo->prepare('SELECT COUNT(*) FROM `solar_acc_vendor_payments` WHERE `bill_id` = ?');
                $vpc->execute([$id]);
                if ((int)$vpc->fetchColumn() > 0) throw new Exception('Cannot delete a vendor bill referenced by vendor payments.');
                if (!empty($bill['journal_entry_id'])) {
                    accAssertNotLockedPhp($pdo, accToSqlDate($bill['bill_date'] ?? '') ?: accTodaySql());
                    $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$bill['journal_entry_id']]);
                    accRecalcBalancesPhp($pdo);
                }
                $pdo->prepare('DELETE FROM `solar_acc_vendor_bills` WHERE `id` = ?')->execute([$id]);
                accLogAuditPhp($pdo, $actor, 'VENDOR_PAYMENTS', 'DELETE_VENDOR_BILL', $id, $bill['bill_number'], "Deleted unpaid vendor bill {$bill['bill_number']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Unpaid vendor bill deleted.']);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if ($cleanPath === '/accounting/vendor-payments' && $method === 'POST') {
            $amt = accRound2($body['amount'] ?? 0);
            $tds = accRound2($body['tdsDeducted'] ?? 0);
            if ($amt <= 0 || $tds < 0 || $tds >= $amt) throw new Exception('Invalid payment or TDS amount.');
            $net = accRound2($amt - $tds);

            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $payDate = accToSqlDate($body['paymentDate'] ?? '') ?: accTodaySql();
                accAssertNotLockedPhp($pdo, $payDate);
                $bs = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1');
                $bs->execute([$body['billId'] ?? '']);
                $bill = $bs->fetch(PDO::FETCH_ASSOC);
                if (!$bill || $bill['status'] === 'DRAFT') throw new Exception('Valid open vendor bill required.');
                if ($amt > accRound2(floatval($bill['balance_amount']) + 0.01)) throw new Exception('Payment exceeds bill balance.');

                $bks = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                $bks->execute([$body['bankAccountId'] ?? '']);
                $bank = $bks->fetch(PDO::FETCH_ASSOC);
                if (!$bank) throw new Exception('Valid bank/cash account required.');
                $bankCoa = $bank['coa_account_id'] ?: ($bank['account_type'] === 'CASH' ? 'acc-1010' : 'acc-1020');

                $payId = 'vpay-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
                $payNo = !empty($body['paymentNumber']) ? $body['paymentNumber'] : ('VPAY-' . substr($payDate, 0, 4) . '-' . accRandDigits(4));

                $lines = [
                    ['accountId' => $settings['default_ap_account_id'] ?? 'acc-2010', 'description' => "Settlement {$bill['bill_number']}", 'projectId' => $bill['project_id'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $bill['vendor_id'], 'partyName' => $bill['vendor_name'], 'debit' => $amt, 'credit' => 0],
                    ['accountId' => $bankCoa, 'description' => "Paid via {$bank['account_name']}", 'projectId' => $bill['project_id'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $bill['vendor_id'], 'partyName' => $bill['vendor_name'], 'debit' => 0, 'credit' => $net]
                ];
                if ($tds > 0) {
                    $lines[] = ['accountId' => $settings['default_tds_account_id'] ?? 'acc-2150', 'description' => "TDS deducted - {$bill['vendor_name']}", 'projectId' => $bill['project_id'] ?? '', 'partyType' => 'VENDOR', 'partyId' => $bill['vendor_id'], 'partyName' => $bill['vendor_name'], 'debit' => 0, 'credit' => $tds];
                }
                $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $payDate, 'referenceType' => 'VENDOR_PAYMENT', 'referenceId' => $payId, 'referenceNumber' => $payNo, 'narration' => "Vendor payment {$payNo} to {$bill['vendor_name']}", 'status' => 'POSTED', 'lines' => $lines], $actor);

                $pdo->prepare("INSERT INTO `solar_acc_vendor_payments` (`id`,`payment_number`,`bill_id`,`vendor_id`,`vendor_name`,`payment_date`,`amount`,`tds_deducted`,`net_paid`,`bank_account_id`,`payment_mode`,`reference_no`,`notes`,`journal_entry_id`,`recorded_by`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                    ->execute([$payId, $payNo, $bill['id'], $bill['vendor_id'], $bill['vendor_name'], $payDate, $amt, $tds, $net, $bank['id'], $body['paymentMode'] ?? 'Bank NEFT/RTGS', $body['referenceNo'] ?? '', $body['notes'] ?? '', $jeId, $actor['name'] ?? 'Admin']);
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$net, $bank['id']]);
                $newPaid = accRound2(floatval($bill['paid_amount']) + $amt);
                $retAmt = accRound2(floatval($bill['returned_amount'] ?? 0));
                $refAmt = accRound2(floatval($bill['refunded_amount'] ?? 0));
                $netBillPaid = accRound2(max(0, $newPaid - $refAmt));
                $newBal = accRound2(max(0, floatval($bill['total_amount']) - $retAmt - $netBillPaid));
                $newStatus = $newBal <= 0.01 ? 'PAID' : 'PARTIAL';
                $pdo->prepare('UPDATE `solar_acc_vendor_bills` SET `paid_amount`=?,`balance_amount`=?,`status`=? WHERE `id`=?')->execute([$newPaid, $newBal, $newStatus, $bill['id']]);
                if (!empty($bill['po_id'])) {
                    $pdo->prepare('UPDATE `solar_purchase_orders` SET `paid_amount`=?,`balance_amount`=?,`payment_status`=?,`bank_account_id`=? WHERE `id`=?')->execute([$newPaid, $newBal, $newStatus === 'PAID' ? 'PAID' : 'PARTIALLY_PAID', $bank['id'], $bill['po_id']]);
                }
                if ($tds > 0) {
                    $vs = $pdo->prepare('SELECT `pan_number` FROM `solar_vendors` WHERE `id` = ? LIMIT 1');
                    $vs->execute([$bill['vendor_id']]);
                    $pan = $vs->fetchColumn() ?: '';
                    $rate = accRound2(($tds / max(1, $amt)) * 100);
                    $pdo->prepare("INSERT INTO `solar_acc_tds_entries` (`id`,`section`,`party_type`,`party_id`,`party_name`,`pan_number`,`source_type`,`source_id`,`source_number`,`deduction_date`,`gross_amount`,`tds_rate`,`tds_amount`,`status`) VALUES (?,?,'VENDOR',?,?,?,'VENDOR_PAYMENT',?,?,?,?,?,?,'DEDUCTED')")
                        ->execute(['tds-' . round(microtime(true) * 1000) . '-' . accRandHex(3), $body['tdsSection'] ?? ($bill['tds_section'] ?: '194C'), $bill['vendor_id'], $bill['vendor_name'], $pan, $payId, $payNo, $payDate, $amt, $rate, $tds]);
                }
                accLogAuditPhp($pdo, $actor, 'VENDOR_PAYMENTS', 'RECORD_VENDOR_PAYMENT', $payId, $payNo, "Paid {$net} (TDS {$tds}) to {$bill['vendor_name']}");
                $pdo->commit();
                http_response_code(201);
                echo json_encode(['success' => true, 'data' => ['id' => $payId, 'paymentNumber' => $payNo, 'journalEntryId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/vendor-payments/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $vps = $pdo->prepare('SELECT * FROM `solar_acc_vendor_payments` WHERE `id` = ? LIMIT 1');
                $vps->execute([$id]);
                $vp = $vps->fetch(PDO::FETCH_ASSOC);
                if (!$vp) throw new Exception('Vendor payment not found.');
                accAssertNotLockedPhp($pdo, accToSqlDate($vp['payment_date'] ?? '') ?: accTodaySql());

                $tdss = $pdo->prepare("SELECT * FROM `solar_acc_tds_entries` WHERE `source_type`='VENDOR_PAYMENT' AND `source_id`=?");
                $tdss->execute([$id]);
                foreach ($tdss->fetchAll(PDO::FETCH_ASSOC) ?: [] as $t) {
                    if ($t['status'] === 'DEPOSITED') {
                        throw new Exception('Cannot reverse vendor payment because deducted TDS has already been deposited via challan.');
                    }
                }
                $pdo->prepare("DELETE FROM `solar_acc_tds_entries` WHERE `source_type`='VENDOR_PAYMENT' AND `source_id`=?")->execute([$id]);

                if (!empty($vp['bank_account_id'])) {
                    $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')->execute([accRound2(floatval($vp['net_paid'] ?? 0)), $vp['bank_account_id']]);
                }

                $bs = $pdo->prepare('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1');
                $bs->execute([$vp['bill_id']]);
                $bill = $bs->fetch(PDO::FETCH_ASSOC);
                if ($bill) {
                    $newPaid = accRound2(max(0, floatval($bill['paid_amount']) - floatval($vp['amount'])));
                    $retAmt = accRound2(floatval($bill['returned_amount'] ?? 0));
                    $refAmt = accRound2(floatval($bill['refunded_amount'] ?? 0));
                    $netBillPaid = accRound2(max(0, $newPaid - $refAmt));
                    $newBal = accRound2(max(0, floatval($bill['total_amount']) - $retAmt - $netBillPaid));
                    $newStatus = $newBal <= 0.01 ? 'PAID' : ($netBillPaid > 0.01 ? 'PARTIAL' : 'OPEN');
                    $pdo->prepare('UPDATE `solar_acc_vendor_bills` SET `paid_amount`=?,`balance_amount`=?,`status`=? WHERE `id`=?')->execute([$newPaid, $newBal, $newStatus, $bill['id']]);
                    if (!empty($bill['po_id'])) {
                        $poPayStatus = $newStatus === 'PAID' ? 'PAID' : ($newStatus === 'PARTIAL' ? 'PARTIALLY_PAID' : 'PENDING');
                        $pdo->prepare('UPDATE `solar_purchase_orders` SET `paid_amount`=?,`balance_amount`=?,`payment_status`=? WHERE `id`=?')->execute([$newPaid, $newBal, $poPayStatus, $bill['po_id']]);
                    }
                }

                if (!empty($vp['journal_entry_id'])) {
                    $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$vp['journal_entry_id']]);
                    accRecalcBalancesPhp($pdo);
                }

                $pdo->prepare('DELETE FROM `solar_acc_vendor_payments` WHERE `id` = ?')->execute([$id]);
                accLogAuditPhp($pdo, $actor, 'VENDOR_PAYMENTS', 'DELETE_VENDOR_PAYMENT', $id, $vp['payment_number'], "Reversed vendor payment {$vp['payment_number']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Vendor payment reversed and deleted.']);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        // Bank accounts, transfers, reconciliations
        if ($cleanPath === '/accounting/bank-accounts' && $method === 'POST') {
            $name = trim((string)($body['accountName'] ?? ''));
            if (!$name) throw new Exception('Account name is required.');
            $id = !empty($body['id']) ? $body['id'] : ('bank-' . round(microtime(true) * 1000) . '-' . accRandHex(3));
            $type = (($body['accountType'] ?? '') === 'CASH') ? 'CASH' : 'BANK';
            $op = accRound2($body['openingBalance'] ?? 0);
            $exStmt = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
            $exStmt->execute([$id]);
            $ex = $exStmt->fetch(PDO::FETCH_ASSOC);
            $cur = $ex ? accRound2(floatval($ex['current_balance']) + ($op - accRound2(floatval($ex['opening_balance'])))) : $op;
            $coaId = $body['coaAccountId'] ?? ($type === 'CASH' ? 'acc-1010' : 'acc-1020');

            if (!$ex && !empty($body['createCoaLedger'])) {
                $code = '10' . accRandDigits(2);
                $newCoaId = 'acc-' . $code . '-' . round(microtime(true) * 1000);
                $pdo->prepare("INSERT INTO `solar_acc_accounts` (`id`,`code`,`name`,`account_type`,`sub_type`,`opening_balance`,`current_balance`,`is_system`,`is_active`) VALUES (?,?,?,'ASSET',?,?,?,0,1)")
                    ->execute([$newCoaId, $code, $name, $type === 'CASH' ? 'Cash' : 'Bank', $op, $op]);
                $coaId = $newCoaId;
            }

            if (!empty($body['isPrimary'])) $pdo->exec('UPDATE `solar_acc_bank_accounts` SET `is_primary` = 0');
            $pdo->prepare("INSERT INTO `solar_acc_bank_accounts` (`id`,`account_name`,`account_type`,`bank_name`,`account_number`,`ifsc_code`,`branch`,`coa_account_id`,`opening_balance`,`current_balance`,`is_primary`,`is_active`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `account_name`=VALUES(`account_name`),`account_type`=VALUES(`account_type`),`bank_name`=VALUES(`bank_name`),`account_number`=VALUES(`account_number`),`ifsc_code`=VALUES(`ifsc_code`),`branch`=VALUES(`branch`),`coa_account_id`=VALUES(`coa_account_id`),`opening_balance`=VALUES(`opening_balance`),`current_balance`=VALUES(`current_balance`),`is_primary`=VALUES(`is_primary`),`is_active`=VALUES(`is_active`)")
                ->execute([$id, $name, $type, $body['bankName'] ?? '', $body['accountNumber'] ?? '', $body['ifscCode'] ?? '', $body['branch'] ?? '', $coaId, $op, $cur, !empty($body['isPrimary']) ? 1 : 0, (isset($body['isActive']) && $body['isActive'] === false) ? 0 : 1]);
            accLogAuditPhp($pdo, $actor, 'CASH_BANK', $ex ? 'UPDATE_BANK_ACCOUNT' : 'CREATE_BANK_ACCOUNT', $id, $name, "Saved {$type} account {$name}");
            echo json_encode(['success' => true, 'data' => ['id' => $id, 'accountName' => $name, 'currentBalance' => $cur]]);
            exit;
        }

        if (preg_match('#^/accounting/bank-accounts/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $bs = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
            $bs->execute([$id]);
            $bank = $bs->fetch(PDO::FETCH_ASSOC);
            if (!$bank) throw new Exception('Cash/Bank register not found.');
            if (!empty($bank['is_primary'])) throw new Exception('Cannot delete the primary Cash/Bank account. Assign another primary account or deactivate it instead.');

            $checks = [
                ['solar_payments', 'bank_account_id = ?', [$id]],
                ['solar_acc_vendor_payments', 'bank_account_id = ?', [$id]],
                ['solar_acc_bank_transfers', 'from_account_id = ? OR to_account_id = ?', [$id, $id]],
                ['solar_acc_bank_reconciliations', 'bank_account_id = ?', [$id]],
                ['solar_expenses', 'bank_account_id = ?', [$id]],
                ['solar_acc_fixed_assets', 'payment_bank_account_id = ?', [$id]],
                ['solar_sales_returns', 'bank_account_id = ?', [$id]],
                ['solar_purchase_returns', 'bank_account_id = ?', [$id]],
                ['solar_vendor_sales_payments', 'bank_account_id = ?', [$id]],
            ];
            foreach ($checks as $chk) {
                $cs = $pdo->prepare("SELECT COUNT(*) FROM `{$chk[0]}` WHERE {$chk[1]}");
                $cs->execute($chk[2]);
                if ((int)$cs->fetchColumn() > 0) {
                    throw new Exception('Cannot delete a Cash/Bank register with linked transactions or reconciliations. Deactivate it instead.');
                }
            }
            $pdo->prepare('DELETE FROM `solar_acc_bank_accounts` WHERE `id` = ?')->execute([$id]);
            accLogAuditPhp($pdo, $actor, 'CASH_BANK', 'DELETE_BANK_ACCOUNT', $id, $bank['account_name'], "Deleted {$bank['account_type']} account {$bank['account_name']}");
            echo json_encode(['success' => true, 'message' => 'Cash/Bank register deleted.']);
            exit;
        }

        if ($cleanPath === '/accounting/bank-transfers' && $method === 'POST') {
            $amt = accRound2($body['amount'] ?? 0);
            if ($amt <= 0 || empty($body['fromAccountId']) || empty($body['toAccountId']) || $body['fromAccountId'] === $body['toAccountId']) {
                throw new Exception('Valid source, destination, and positive amount required.');
            }
            $pdo->beginTransaction();
            try {
                $tDate = accToSqlDate($body['transferDate'] ?? '') ?: accTodaySql();
                accAssertNotLockedPhp($pdo, $tDate);
                $fs = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                $fs->execute([$body['fromAccountId']]);
                $fromAcc = $fs->fetch(PDO::FETCH_ASSOC);
                $ts = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                $ts->execute([$body['toAccountId']]);
                $toAcc = $ts->fetch(PDO::FETCH_ASSOC);
                if (!$fromAcc || !$toAcc) throw new Exception('Invalid bank accounts.');

                $id = 'xfer-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
                $tNo = 'TRF-' . substr($tDate, 0, 4) . '-' . accRandDigits(4);
                $fCoa = $fromAcc['coa_account_id'] ?: ($fromAcc['account_type'] === 'CASH' ? 'acc-1010' : 'acc-1020');
                $tCoa = $toAcc['coa_account_id'] ?: ($toAcc['account_type'] === 'CASH' ? 'acc-1010' : 'acc-1020');
                $jeId = '';
                if ($fCoa !== $tCoa) {
                    $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $tDate, 'referenceType' => 'CONTRA_TRANSFER', 'referenceId' => $id, 'referenceNumber' => $tNo, 'narration' => "Contra transfer {$fromAcc['account_name']} -> {$toAcc['account_name']}", 'status' => 'POSTED', 'lines' => [['accountId' => $tCoa, 'debit' => $amt, 'credit' => 0], ['accountId' => $fCoa, 'debit' => 0, 'credit' => $amt]]], $actor);
                }
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$amt, $fromAcc['id']]);
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')->execute([$amt, $toAcc['id']]);
                $pdo->prepare("INSERT INTO `solar_acc_bank_transfers` (`id`,`transfer_number`,`transfer_date`,`from_account_id`,`to_account_id`,`amount`,`mode`,`reference_no`,`notes`,`journal_entry_id`,`created_by`) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
                    ->execute([$id, $tNo, $tDate, $fromAcc['id'], $toAcc['id'], $amt, $body['mode'] ?? 'Bank Transfer', $body['referenceNo'] ?? '', $body['notes'] ?? '', $jeId, $actor['name'] ?? 'Admin']);
                accLogAuditPhp($pdo, $actor, 'CASH_BANK', 'CONTRA_TRANSFER', $id, $tNo, "Transferred {$amt}");
                $pdo->commit();
                http_response_code(201);
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'transferNumber' => $tNo]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/bank-transfers/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $ts = $pdo->prepare('SELECT * FROM `solar_acc_bank_transfers` WHERE `id` = ? LIMIT 1');
                $ts->execute([$id]);
                $tr = $ts->fetch(PDO::FETCH_ASSOC);
                if (!$tr) throw new Exception('Bank transfer not found.');
                accAssertNotLockedPhp($pdo, accToSqlDate($tr['transfer_date'] ?? '') ?: accTodaySql());
                $amt = accRound2(floatval($tr['amount'] ?? 0));
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')->execute([$amt, $tr['from_account_id']]);
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$amt, $tr['to_account_id']]);
                if (!empty($tr['journal_entry_id'])) {
                    $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$tr['journal_entry_id']]);
                    accRecalcBalancesPhp($pdo);
                }
                $pdo->prepare('DELETE FROM `solar_acc_bank_transfers` WHERE `id` = ?')->execute([$id]);
                accLogAuditPhp($pdo, $actor, 'CASH_BANK', 'DELETE_BANK_TRANSFER', $id, $tr['transfer_number'], "Reversed contra transfer {$tr['transfer_number']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Contra transfer reversed and deleted.']);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if ($cleanPath === '/accounting/bank-reconciliations' && $method === 'POST') {
            $id = !empty($body['id']) ? $body['id'] : ('brec-' . round(microtime(true) * 1000) . '-' . accRandHex(3));
            $stDate = accToSqlDate($body['statementDate'] ?? '') ?: accTodaySql();
            $bk = accRound2($body['bookBalance'] ?? 0);
            $st = accRound2($body['statementBalance'] ?? 0);
            $diff = accRound2($st - $bk);
            $stat = (($body['status'] ?? '') === 'RECONCILED') ? 'RECONCILED' : 'DRAFT';
            $pdo->prepare("INSERT INTO `solar_acc_bank_reconciliations` (`id`,`bank_account_id`,`statement_date`,`book_balance`,`statement_balance`,`cleared_txn_ids_json`,`difference`,`status`,`notes`,`reconciled_by`,`reconciled_at`) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `bank_account_id`=VALUES(`bank_account_id`),`statement_date`=VALUES(`statement_date`),`book_balance`=VALUES(`book_balance`),`statement_balance`=VALUES(`statement_balance`),`cleared_txn_ids_json`=VALUES(`cleared_txn_ids_json`),`difference`=VALUES(`difference`),`status`=VALUES(`status`),`notes`=VALUES(`notes`),`reconciled_by`=VALUES(`reconciled_by`),`reconciled_at`=VALUES(`reconciled_at`)")
                ->execute([$id, $body['bankAccountId'] ?? '', $stDate, $bk, $st, json_encode($body['clearedTxnIds'] ?? []), $diff, $stat, $body['notes'] ?? '', $stat === 'RECONCILED' ? ($actor['name'] ?? 'Admin') : '', $stat === 'RECONCILED' ? gmdate('c') : null]);
            accLogAuditPhp($pdo, $actor, 'CASH_BANK', 'BANK_RECONCILIATION', $id, $stDate, "Saved bank reconciliation ({$stat}) diff {$diff}");
            echo json_encode(['success' => true, 'data' => ['id' => $id, 'difference' => $diff, 'status' => $stat]]);
            exit;
        }

        if (preg_match('#^/accounting/bank-reconciliations/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $rs = $pdo->prepare('SELECT * FROM `solar_acc_bank_reconciliations` WHERE `id` = ? LIMIT 1');
            $rs->execute([$id]);
            $rec = $rs->fetch(PDO::FETCH_ASSOC);
            if (!$rec) throw new Exception('Bank reconciliation record not found.');
            if ($rec['status'] === 'RECONCILED') throw new Exception('Completed bank reconciliations cannot be deleted.');
            $pdo->prepare('DELETE FROM `solar_acc_bank_reconciliations` WHERE `id` = ?')->execute([$id]);
            accLogAuditPhp($pdo, $actor, 'CASH_BANK', 'DELETE_BANK_RECONCILIATION', $id, accToSqlDate($rec['statement_date'] ?? '') ?: $id, "Deleted draft bank reconciliation {$id}");
            echo json_encode(['success' => true, 'message' => 'Draft bank reconciliation deleted.']);
            exit;
        }

        // Expense delete / approve / pay
        if (preg_match('#^/accounting/expenses/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $es = $pdo->prepare('SELECT * FROM `solar_expenses` WHERE `id` = ? LIMIT 1');
            $es->execute([$id]);
            $exp = $es->fetch(PDO::FETCH_ASSOC);
            if (!$exp) throw new Exception('Expense record not found.');
            if ($exp['status'] === 'PAID' || !empty($exp['journal_entry_id'])) throw new Exception('Paid expenses posted to the General Ledger cannot be deleted.');
            accAssertNotLockedPhp($pdo, accToSqlDate($exp['expense_date'] ?? '') ?: accTodaySql());
            $pdo->prepare('DELETE FROM `solar_expenses` WHERE `id` = ?')->execute([$id]);
            accLogAuditPhp($pdo, $actor, 'EXPENSES', 'DELETE_EXPENSE', $id, $exp['expense_number'] ?? $id, "Deleted unpaid expense {$exp['expense_number']}");
            echo json_encode(['success' => true, 'message' => 'Expense deleted.']);
            exit;
        }

        if (preg_match('#^/accounting/expenses/([^/]+)/approve$#', $cleanPath, $m) && $method === 'POST') {
            $id = urldecode($m[1]);
            $es = $pdo->prepare('SELECT * FROM `solar_expenses` WHERE `id` = ? LIMIT 1');
            $es->execute([$id]);
            $exp = $es->fetch(PDO::FETCH_ASSOC);
            if (!$exp) throw new Exception('Expense record not found.');
            if ($exp['status'] === 'PAID') throw new Exception('Paid expenses cannot be rejected.');
            $dec = (($body['decision'] ?? '') === 'REJECTED') ? 'REJECTED' : 'APPROVED';
            $pdo->prepare('UPDATE `solar_expenses` SET `status`=?,`approved_by`=?,`approved_at`=?,`rejection_reason`=? WHERE `id`=?')
                ->execute([$dec, $actor['name'] ?? 'Admin', gmdate('c'), $dec === 'REJECTED' ? ($body['reason'] ?? 'Rejected by Finance') : '', $id]);
            accLogAuditPhp($pdo, $actor, 'EXPENSES', $dec === 'APPROVED' ? 'APPROVE_EXPENSE' : 'REJECT_EXPENSE', $id, $exp['expense_number'], "{$dec} expense {$exp['expense_number']}");
            echo json_encode(['success' => true, 'data' => ['id' => $id, 'status' => $dec]]);
            exit;
        }

        if (preg_match('#^/accounting/expenses/([^/]+)/pay$#', $cleanPath, $m) && $method === 'POST') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $es = $pdo->prepare('SELECT * FROM `solar_expenses` WHERE `id` = ? LIMIT 1');
                $es->execute([$id]);
                $exp = $es->fetch(PDO::FETCH_ASSOC);
                if (!$exp) throw new Exception('Expense not found.');
                if ($exp['status'] === 'PAID' && !empty($exp['journal_entry_id'])) throw new Exception('Expense already paid.');
                if ($exp['status'] === 'REJECTED') throw new Exception('Rejected expenses cannot be disbursed.');
                $payDate = accToSqlDate($body['paidDate'] ?? '') ?: (accToSqlDate($exp['expense_date']) ?: accTodaySql());
                accAssertNotLockedPhp($pdo, $payDate);
                $bankId = $body['bankAccountId'] ?: ($exp['bank_account_id'] ?: 'bank-main-current');
                $bs = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                $bs->execute([$bankId]);
                $bank = $bs->fetch(PDO::FETCH_ASSOC);
                if (!$bank) throw new Exception('Valid bank/cash account required.');
                $amt = accRound2(floatval($exp['amount']));
                $gst = accRound2(floatval($exp['gst_amount'] ?? 0));
                $itc = !empty($exp['itc_eligible']) && $gst > 0 && $gst < $amt;
                $netExp = $itc ? accRound2($amt - $gst) : $amt;
                $bankCoa = $bank['coa_account_id'] ?: ($bank['account_type'] === 'CASH' ? 'acc-1010' : 'acc-1020');
                $lines = [['accountId' => $exp['expense_account_id'] ?: 'acc-5040', 'description' => $exp['category'], 'projectId' => $exp['project_id'] ?? '', 'debit' => $netExp, 'credit' => 0]];
                if ($itc) $lines[] = ['accountId' => $settings['default_input_gst_account_id'] ?? 'acc-1150', 'description' => 'Input GST Credit', 'debit' => $gst, 'credit' => 0];
                $lines[] = ['accountId' => $bankCoa, 'description' => "Paid via {$bank['account_name']}", 'debit' => 0, 'credit' => $amt];
                $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $payDate, 'referenceType' => 'EXPENSE_PAYMENT', 'referenceId' => $exp['id'], 'referenceNumber' => $exp['expense_number'], 'narration' => "Expense {$exp['expense_number']} ({$exp['category']})", 'status' => 'POSTED', 'lines' => $lines], $actor);
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$amt, $bank['id']]);
                $actorName = $actor['name'] ?? 'Admin';
                $pdo->prepare('UPDATE `solar_expenses` SET `status`=?,`bank_account_id`=?,`journal_entry_id`=?,`paid_at`=?,`paid_by`=?,`approved_by`=COALESCE(NULLIF(`approved_by`,""),?) WHERE `id`=?')->execute(['PAID', $bank['id'], $jeId, gmdate('c'), $actorName, $actorName, $id]);
                accLogAuditPhp($pdo, $actor, 'EXPENSES', 'PAY_EXPENSE', $id, $exp['expense_number'], "Paid {$amt} via {$bank['account_name']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'status' => 'PAID', 'journalEntryId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        // TDS Deposit
        if (preg_match('#^/accounting/tds/([^/]+)/deposit$#', $cleanPath, $m) && $method === 'POST') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $ts = $pdo->prepare('SELECT * FROM `solar_acc_tds_entries` WHERE `id` = ? LIMIT 1');
                $ts->execute([$id]);
                $tds = $ts->fetch(PDO::FETCH_ASSOC);
                if (!$tds || $tds['status'] === 'DEPOSITED') throw new Exception('Pending TDS entry not found.');
                $dDate = accToSqlDate($body['depositDate'] ?? '') ?: accTodaySql();
                accAssertNotLockedPhp($pdo, $dDate);
                $bs = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                $bs->execute([$body['bankAccountId'] ?? 'bank-main-current']);
                $bank = $bs->fetch(PDO::FETCH_ASSOC);
                if (!$bank) throw new Exception('Bank account required.');
                $amt = accRound2(floatval($tds['tds_amount']));
                $bankCoa = $bank['coa_account_id'] ?: 'acc-1020';
                $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $dDate, 'referenceType' => 'TDS_CHALLAN', 'referenceId' => $id, 'referenceNumber' => $body['challanNo'] ?? $tds['source_number'], 'narration' => "TDS Challan deposit ({$tds['section']})", 'status' => 'POSTED', 'lines' => [['accountId' => $settings['default_tds_account_id'] ?? 'acc-2150', 'debit' => $amt, 'credit' => 0], ['accountId' => $bankCoa, 'debit' => 0, 'credit' => $amt]]], $actor);
                $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$amt, $bank['id']]);
                $pdo->prepare('UPDATE `solar_acc_tds_entries` SET `status`=?,`challan_no`=?,`bsr_code`=?,`deposit_date`=? WHERE `id`=?')->execute(['DEPOSITED', $body['challanNo'] ?? '', $body['bsrCode'] ?? '', $dDate, $id]);
                accLogAuditPhp($pdo, $actor, 'GST_TAX', 'DEPOSIT_TDS', $id, $body['challanNo'] ?? $id, "Deposited TDS Sec {$tds['section']} {$amt}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'status' => 'DEPOSITED', 'journalEntryId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        // E-Invoice IRN
        if (preg_match('#^/accounting/einvoice/([^/]+)/generate$#', $cleanPath, $m) && $method === 'POST') {
            $invId = urldecode($m[1]);
            $is = $pdo->prepare('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1');
            $is->execute([$invId]);
            $inv = $is->fetch(PDO::FETCH_ASSOC);
            if (!$inv) throw new Exception('Sales invoice not found.');
            if (strlen(trim((string)($inv['customer_gst'] ?? ''))) < 15) throw new Exception('Valid 15-character Buyer GSTIN required.');
            $irn = hash('sha256', $inv['invoice_number'] . '|' . $inv['customer_gst'] . '|' . $inv['total_amount'] . '|' . $inv['invoice_date']);
            $ackNo = '1126' . random_int(1000000000, 9999999999);
            $ackDate = date('Y-m-d H:i:s');
            $pdo->prepare('UPDATE `solar_sales_invoices` SET `einvoice_irn`=?,`einvoice_ack_no`=?,`einvoice_ack_date`=?,`einvoice_status`=? WHERE `id`=?')->execute([$irn, $ackNo, $ackDate, 'GENERATED', $invId]);
            accLogAuditPhp($pdo, $actor, 'GST_TAX', 'GENERATE_EINVOICE', $invId, $inv['invoice_number'], "Generated E-Invoice IRN for {$inv['invoice_number']}");
            echo json_encode(['success' => true, 'data' => ['invoiceId' => $invId, 'einvoiceIrn' => $irn, 'einvoiceAckNo' => $ackNo, 'einvoiceAckDate' => $ackDate, 'einvoiceStatus' => 'GENERATED']]);
            exit;
        }

        // Budgets
        if ($cleanPath === '/accounting/budgets' && $method === 'POST') {
            $id = !empty($body['id']) ? $body['id'] : ('bud-' . round(microtime(true) * 1000) . '-' . accRandHex(3));
            $amt = accRound2($body['allocatedAmount'] ?? 0);
            if (empty($body['name']) || $amt <= 0) throw new Exception('Budget name and positive amount required.');
            $pdo->prepare("INSERT INTO `solar_acc_budgets` (`id`,`name`,`fiscal_year`,`period_type`,`period_label`,`department`,`category`,`project_id`,`project_title`,`account_id`,`allocated_amount`,`notes`,`status`,`created_by`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`fiscal_year`=VALUES(`fiscal_year`),`period_type`=VALUES(`period_type`),`period_label`=VALUES(`period_label`),`department`=VALUES(`department`),`category`=VALUES(`category`),`project_id`=VALUES(`project_id`),`project_title`=VALUES(`project_title`),`account_id`=VALUES(`account_id`),`allocated_amount`=VALUES(`allocated_amount`),`notes`=VALUES(`notes`),`status`=VALUES(`status`)")
                ->execute([$id, $body['name'], $body['fiscalYear'] ?? '2026-27', $body['periodType'] ?? 'ANNUAL', $body['periodLabel'] ?? 'FY 2026-27', $body['department'] ?? '', $body['category'] ?? '', $body['projectId'] ?? '', $body['projectTitle'] ?? '', $body['accountId'] ?? '', $amt, $body['notes'] ?? '', $body['status'] ?? 'ACTIVE', $actor['name'] ?? 'Admin']);
            accLogAuditPhp($pdo, $actor, 'BUDGETS', 'SAVE_BUDGET', $id, $body['name'], "Saved budget {$body['name']}");
            echo json_encode(['success' => true, 'data' => ['id' => $id, 'allocatedAmount' => $amt]]);
            exit;
        }

        if (preg_match('#^/accounting/budgets/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $budId = urldecode($m[1]);
            $pdo->prepare('DELETE FROM `solar_acc_budgets` WHERE `id` = ?')->execute([$budId]);
            accLogAuditPhp($pdo, $actor, 'BUDGETS', 'DELETE_BUDGET', $budId, $budId, "Deleted budget {$budId}");
            echo json_encode(['success' => true, 'message' => 'Budget deleted.']);
            exit;
        }

        // Fixed Assets
        if ($cleanPath === '/accounting/assets' && $method === 'POST') {
            $cost = accRound2($body['purchaseCost'] ?? 0);
            $salv = accRound2($body['salvageValue'] ?? 0);
            $life = max(1, intval($body['usefulLifeYears'] ?? 5));
            if (empty($body['name']) || $cost <= 0 || $salv >= $cost) throw new Exception('Valid asset name, positive cost, and salvage < cost required.');
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $id = !empty($body['id']) ? $body['id'] : ('asset-' . round(microtime(true) * 1000) . '-' . accRandHex(3));
                $pDate = accToSqlDate($body['purchaseDate'] ?? '') ?: accTodaySql();
                $meth = (($body['depreciationMethod'] ?? '') === 'WDV') ? 'WDV' : 'SLM';
                $rate = accRound2($body['depreciationRate'] ?? ($meth === 'SLM' ? (100 / $life) : min(60, 200 / $life)));

                $es = $pdo->prepare('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1');
                $es->execute([$id]);
                $ex = $es->fetch(PDO::FETCH_ASSOC);
                $code = !empty($body['assetCode']) ? $body['assetCode'] : ($ex['asset_code'] ?? ('AST-' . substr($pDate, 0, 4) . '-' . accRandDigits(3)));
                $assetAcc = $body['assetAccountId'] ?? ($ex['asset_account_id'] ?? 'acc-1500');
                $depAcc = $body['depExpenseAccountId'] ?? ($ex['dep_expense_account_id'] ?? ($settings['default_dep_expense_account_id'] ?? 'acc-5060'));
                $pjId = $ex['purchase_journal_id'] ?? null;
                $payBankId = $ex['payment_bank_account_id'] ?? '';

                if (!$ex && !empty($body['postPurchaseJournal']) && !empty($body['paymentBankAccountId'])) {
                    accAssertNotLockedPhp($pdo, $pDate);
                    $bs = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                    $bs->execute([$body['paymentBankAccountId']]);
                    $bank = $bs->fetch(PDO::FETCH_ASSOC);
                    if (!$bank) throw new Exception('Bank account not found.');
                    $payBankId = $bank['id'];
                    $pjId = accInsertJournalTxPhp($pdo, ['entryDate' => $pDate, 'referenceType' => 'ASSET_PURCHASE', 'referenceId' => $id, 'referenceNumber' => $code, 'narration' => "Capitalization of {$code} - {$body['name']}", 'status' => 'POSTED', 'lines' => [['accountId' => $assetAcc, 'debit' => $cost, 'credit' => 0], ['accountId' => $bank['coa_account_id'] ?: 'acc-1020', 'debit' => 0, 'credit' => $cost]]], $actor);
                    $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?')->execute([$cost, $bank['id']]);
                }

                $accDep = $ex ? floatval($ex['accumulated_depreciation']) : accRound2($body['accumulatedDepreciation'] ?? 0);
                $bv = $ex ? floatval($ex['book_value']) : accRound2(max($salv, $cost - $accDep));
                $pdo->prepare("INSERT INTO `solar_acc_fixed_assets` (`id`,`asset_code`,`name`,`category`,`purchase_date`,`vendor_name`,`purchase_cost`,`salvage_value`,`useful_life_years`,`depreciation_method`,`depreciation_rate`,`accumulated_depreciation`,`book_value`,`asset_account_id`,`dep_expense_account_id`,`location`,`custodian`,`status`,`purchase_journal_id`,`payment_bank_account_id`,`notes`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`category`=VALUES(`category`),`vendor_name`=VALUES(`vendor_name`),`location`=VALUES(`location`),`custodian`=VALUES(`custodian`),`notes`=VALUES(`notes`)")
                    ->execute([$id, $code, $body['name'], $body['category'] ?? 'Solar Equipment & Tools', $pDate, $body['vendorName'] ?? '', $cost, $salv, $life, $meth, $rate, $accDep, $bv, $assetAcc, $depAcc, $body['location'] ?? '', $body['custodian'] ?? '', $pjId, $payBankId, $body['notes'] ?? '']);
                accLogAuditPhp($pdo, $actor, 'ASSETS', $ex ? 'UPDATE_ASSET' : 'CREATE_ASSET', $id, $code, "Saved fixed asset {$code}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $id, 'assetCode' => $code, 'bookValue' => $bv]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/assets/([^/]+)$#', $cleanPath, $m) && $method === 'DELETE') {
            $id = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $as = $pdo->prepare('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1');
                $as->execute([$id]);
                $asset = $as->fetch(PDO::FETCH_ASSOC);
                if (!$asset) throw new Exception('Fixed asset not found.');
                if ($asset['status'] === 'DISPOSED') throw new Exception('Disposed assets cannot be deleted.');
                $dc = $pdo->prepare('SELECT COUNT(*) FROM `solar_acc_asset_depreciation` WHERE `asset_id` = ?');
                $dc->execute([$id]);
                if ((int)$dc->fetchColumn() > 0 || floatval($asset['accumulated_depreciation'] ?? 0) > 0) {
                    throw new Exception('Fixed assets with depreciation history cannot be deleted.');
                }
                accAssertNotLockedPhp($pdo, accToSqlDate($asset['purchase_date'] ?? '') ?: accTodaySql());
                if (!empty($asset['purchase_journal_id'])) {
                    if (!empty($asset['payment_bank_account_id'])) {
                        $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')->execute([accRound2(floatval($asset['purchase_cost'] ?? 0)), $asset['payment_bank_account_id']]);
                    }
                    $pdo->prepare('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?')->execute([$asset['purchase_journal_id']]);
                    accRecalcBalancesPhp($pdo);
                }
                $pdo->prepare('DELETE FROM `solar_acc_fixed_assets` WHERE `id` = ?')->execute([$id]);
                accLogAuditPhp($pdo, $actor, 'ASSETS', 'DELETE_ASSET', $id, $asset['asset_code'], "Deleted fixed asset {$asset['asset_code']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Fixed asset deleted.']);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/assets/([^/]+)/depreciate$#', $cleanPath, $m) && $method === 'POST') {
            $assetId = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $as = $pdo->prepare('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1');
                $as->execute([$assetId]);
                $asset = $as->fetch(PDO::FETCH_ASSOC);
                if (!$asset || $asset['status'] !== 'ACTIVE') throw new Exception('Active asset not found.');
                $runDate = accToSqlDate($body['runDate'] ?? '') ?: accTodaySql();
                accAssertNotLockedPhp($pdo, $runDate);
                $openBv = accRound2(floatval($asset['book_value']));
                $salv = accRound2(floatval($asset['salvage_value']));
                $maxDep = accRound2(max(0, $openBv - $salv));
                if ($maxDep <= 0) throw new Exception('Asset already at salvage value.');
                $months = max(1, min(12, intval($body['months'] ?? 1)));
                if (!empty($body['customAmount']) && floatval($body['customAmount']) > 0) {
                    $calc = accRound2($body['customAmount']);
                } elseif ($asset['depreciation_method'] === 'WDV') {
                    $calc = accRound2(($openBv * floatval($asset['depreciation_rate'] ?: 20) / 100) * $months / 12);
                } else {
                    $calc = accRound2(((floatval($asset['purchase_cost']) - $salv) / max(1, intval($asset['useful_life_years']))) * $months / 12);
                }
                $depAmt = accRound2(min($maxDep, $calc));
                if ($depAmt <= 0) throw new Exception('Zero depreciation amount.');
                $closeBv = accRound2($openBv - $depAmt);
                $newAccum = accRound2(floatval($asset['accumulated_depreciation']) + $depAmt);
                $label = $body['periodLabel'] ?? (substr($runDate, 0, 7) . " ({$months}m)");

                $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $runDate, 'referenceType' => 'ASSET_DEPRECIATION', 'referenceId' => $assetId, 'referenceNumber' => $asset['asset_code'], 'narration' => "Depreciation on {$asset['asset_code']} ({$label})", 'status' => 'POSTED', 'lines' => [['accountId' => $asset['dep_expense_account_id'] ?: 'acc-5060', 'debit' => $depAmt, 'credit' => 0], ['accountId' => 'acc-1590', 'debit' => 0, 'credit' => $depAmt]]], $actor);
                $logId = 'adep-' . round(microtime(true) * 1000) . '-' . accRandHex(3);
                $pdo->prepare("INSERT INTO `solar_acc_asset_depreciation` (`id`,`asset_id`,`period_label`,`run_date`,`opening_book_value`,`depreciation_amount`,`closing_book_value`,`journal_entry_id`,`run_by`) VALUES (?,?,?,?,?,?,?,?,?)")->execute([$logId, $assetId, $label, $runDate, $openBv, $depAmt, $closeBv, $jeId, $actor['name'] ?? 'Admin']);
                $pdo->prepare('UPDATE `solar_acc_fixed_assets` SET `accumulated_depreciation`=?,`book_value`=?,`last_depreciation_date`=? WHERE `id`=?')->execute([$newAccum, $closeBv, $runDate, $assetId]);
                accLogAuditPhp($pdo, $actor, 'ASSETS', 'RUN_DEPRECIATION', $assetId, $asset['asset_code'], "Posted {$depAmt} depreciation on {$asset['asset_code']}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $logId, 'depreciationAmount' => $depAmt, 'closingBookValue' => $closeBv, 'journalEntryId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        if (preg_match('#^/accounting/assets/([^/]+)/dispose$#', $cleanPath, $m) && $method === 'POST') {
            $assetId = urldecode($m[1]);
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $as = $pdo->prepare('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1');
                $as->execute([$assetId]);
                $asset = $as->fetch(PDO::FETCH_ASSOC);
                if (!$asset || $asset['status'] === 'DISPOSED') throw new Exception('Active asset not found.');
                $dDate = accToSqlDate($body['disposalDate'] ?? '') ?: accTodaySql();
                accAssertNotLockedPhp($pdo, $dDate);
                $proceeds = accRound2($body['disposalProceeds'] ?? 0);
                if ($proceeds < 0) throw new Exception('Disposal proceeds cannot be negative.');
                $cost = accRound2(floatval($asset['purchase_cost']));
                $accum = accRound2(floatval($asset['accumulated_depreciation']));
                $bv = accRound2(floatval($asset['book_value']));
                $gl = accRound2($proceeds - $bv);

                $lines = [];
                if ($proceeds > 0) {
                    $bs = $pdo->prepare('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1');
                    $bs->execute([$body['bankAccountId'] ?? 'bank-main-current']);
                    $bank = $bs->fetch(PDO::FETCH_ASSOC);
                    if (!$bank) throw new Exception('Bank account required for disposal proceeds.');
                    $lines[] = ['accountId' => $bank['coa_account_id'] ?: 'acc-1020', 'debit' => $proceeds, 'credit' => 0];
                    $pdo->prepare('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?')->execute([$proceeds, $bank['id']]);
                }
                if ($accum > 0) $lines[] = ['accountId' => 'acc-1590', 'debit' => $accum, 'credit' => 0];
                if ($gl < 0) $lines[] = ['accountId' => 'acc-5090', 'debit' => accRound2(abs($gl)), 'credit' => 0];
                elseif ($gl > 0) $lines[] = ['accountId' => $settings['default_disposal_gain_loss_account_id'] ?? 'acc-4090', 'debit' => 0, 'credit' => $gl];
                $lines[] = ['accountId' => $asset['asset_account_id'] ?: 'acc-1500', 'debit' => 0, 'credit' => $cost];

                $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $dDate, 'referenceType' => 'ASSET_DISPOSAL', 'referenceId' => $assetId, 'referenceNumber' => $asset['asset_code'], 'narration' => "Disposal of {$asset['asset_code']}", 'status' => 'POSTED', 'lines' => $lines], $actor);
                $pdo->prepare('UPDATE `solar_acc_fixed_assets` SET `status`=?,`book_value`=0,`disposal_date`=?,`disposal_proceeds`=?,`disposal_gain_loss`=?,`disposal_journal_id`=? WHERE `id`=?')->execute(['DISPOSED', $dDate, $proceeds, $gl, $jeId, $assetId]);
                accLogAuditPhp($pdo, $actor, 'ASSETS', 'DISPOSE_ASSET', $assetId, $asset['asset_code'], "Disposed {$asset['asset_code']} for {$proceeds}");
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['assetId' => $assetId, 'disposalProceeds' => $proceeds, 'disposalGainLoss' => $gl, 'disposalJournalId' => $jeId]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        // Settings
        if ($cleanPath === '/accounting/settings' && ($method === 'PUT' || $method === 'POST')) {
            $pdo->prepare("UPDATE `solar_acc_settings` SET `fiscal_year_start_month`=?,`active_fiscal_year`=?,`lock_date`=?,`currency`=?,`approval_threshold`=?,`require_expense_approval`=?,`auto_post_erp_vouchers`=?,`journal_prefix`=?,`bill_prefix`=?,`voucher_prefix`=?,`default_cash_account_id`=?,`default_bank_account_id`=?,`default_ar_account_id`=?,`default_ap_account_id`=?,`default_sales_account_id`=?,`default_cogs_account_id`=?,`default_output_gst_account_id`=?,`default_input_gst_account_id`=?,`default_tds_account_id`=?,`default_payroll_account_id`=?,`default_dep_expense_account_id`=?,`default_disposal_gain_loss_account_id`=?,`updated_by`=? WHERE `id`='default'")
                ->execute([
                    intval($body['fiscalYearStartMonth'] ?? 4), $body['activeFiscalYear'] ?? '2026-27', accToSqlDate($body['lockDate'] ?? null),
                    $body['currency'] ?? 'INR', accRound2($body['approvalThreshold'] ?? 10000),
                    (isset($body['requireExpenseApproval']) && $body['requireExpenseApproval'] === false) ? 0 : 1,
                    (isset($body['autoPostErpVouchers']) && $body['autoPostErpVouchers'] === false) ? 0 : 1,
                    $body['journalPrefix'] ?? 'JV-', $body['billPrefix'] ?? 'BILL-', $body['voucherPrefix'] ?? 'VOU-',
                    $body['defaultCashAccountId'] ?? 'acc-1010', $body['defaultBankAccountId'] ?? 'acc-1020', $body['defaultArAccountId'] ?? 'acc-1100',
                    $body['defaultApAccountId'] ?? 'acc-2010', $body['defaultSalesAccountId'] ?? 'acc-4010', $body['defaultCogsAccountId'] ?? 'acc-5010',
                    $body['defaultOutputGstAccountId'] ?? 'acc-2100', $body['defaultInputGstAccountId'] ?? 'acc-1150', $body['defaultTdsAccountId'] ?? 'acc-2150',
                    $body['defaultPayrollAccountId'] ?? 'acc-5030', $body['defaultDepExpenseAccountId'] ?? 'acc-5060', $body['defaultDisposalGainLossAccountId'] ?? 'acc-4090',
                    $actor['name'] ?? 'Admin'
                ]);
            $ws = accGetWorkspacePhp($pdo);
            echo json_encode(['success' => true, 'data' => $ws['settings']]);
            exit;
        }

        // Sync ERP Vouchers
        if ($cleanPath === '/accounting/sync-erp-vouchers' && $method === 'POST') {
            $pdo->beginTransaction();
            try {
                $settings = accGetSettingsRowPhp($pdo);
                $lock = accToSqlDate($settings['lock_date'] ?? null);
                $safeD = function ($d) use ($lock) {
                    $s = accToSqlDate($d) ?: accTodaySql();
                    return ($lock && $s <= $lock) ? accTodaySql() : $s;
                };
                $refs = $pdo->query("SELECT `reference_type`, `reference_id` FROM `solar_acc_journal_entries` WHERE `status` IN ('POSTED','REVERSED')")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $posted = [];
                foreach ($refs as $r) $posted[$r['reference_type'] . ':' . $r['reference_id']] = true;

                $bd = ['salesInvoices' => 0, 'vendorSalesInvoices' => 0, 'customerReceipts' => 0, 'vendorSalesReceipts' => 0, 'expenses' => 0, 'payslips' => 0];
                $invs = $pdo->query("SELECT * FROM `solar_sales_invoices` WHERE `payment_status` NOT IN ('DRAFT','CANCELLED')")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($invs as $inv) {
                    if (isset($posted['SALES_INVOICE:' . $inv['id']])) continue;
                    $tot = accRound2(floatval($inv['total_amount']));
                    $gst = accRound2(floatval($inv['gst_amount']));
                    if ($tot <= 0) continue;
                    $rev = accRound2(($tot - $gst) > 0 ? ($tot - $gst) : floatval($inv['subtotal']));
                    $lines = [
                        ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'debit' => $tot, 'credit' => 0, 'projectId' => $inv['project_id'] ?? '', 'partyType' => 'CUSTOMER', 'partyId' => $inv['customer_id'], 'partyName' => $inv['customer_name']],
                        ['accountId' => $settings['default_sales_account_id'] ?? 'acc-4010', 'debit' => 0, 'credit' => $rev, 'projectId' => $inv['project_id'] ?? '']
                    ];
                    if ($gst > 0) $lines[] = ['accountId' => $settings['default_output_gst_account_id'] ?? 'acc-2100', 'debit' => 0, 'credit' => accRound2($tot - $rev)];
                    accInsertJournalTxPhp($pdo, ['entryDate' => $safeD($inv['invoice_date']), 'referenceType' => 'SALES_INVOICE', 'referenceId' => $inv['id'], 'referenceNumber' => $inv['invoice_number'], 'narration' => "Sales Invoice {$inv['invoice_number']}", 'status' => 'POSTED', 'lines' => $lines], $actor);
                    $bd['salesInvoices']++;
                }

                $vsinvs = $pdo->query("SELECT * FROM `solar_vendor_sales_invoices` WHERE `status` NOT IN ('DRAFT','CANCELLED')")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($vsinvs as $vsi) {
                    if (isset($posted['VENDOR_SALES_INVOICE:' . $vsi['id']])) continue;
                    $tot = accRound2(floatval($vsi['total_amount']));
                    $tax = accRound2(floatval($vsi['tax_amount']));
                    if ($tot <= 0) continue;
                    $rev = accRound2(($tot - $tax) > 0 ? ($tot - $tax) : floatval($vsi['subtotal']));
                    $lines = [
                        ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'debit' => $tot, 'credit' => 0, 'partyType' => 'VENDOR', 'partyId' => $vsi['vendor_id'], 'partyName' => $vsi['vendor_name']],
                        ['accountId' => 'acc-4030', 'debit' => 0, 'credit' => $rev, 'partyType' => 'VENDOR', 'partyId' => $vsi['vendor_id'], 'partyName' => $vsi['vendor_name']]
                    ];
                    if (accRound2($tot - $rev) > 0) $lines[] = ['accountId' => $settings['default_output_gst_account_id'] ?? 'acc-2100', 'debit' => 0, 'credit' => accRound2($tot - $rev)];
                    accInsertJournalTxPhp($pdo, ['entryDate' => $safeD($vsi['invoice_date']), 'referenceType' => 'VENDOR_SALES_INVOICE', 'referenceId' => $vsi['id'], 'referenceNumber' => $vsi['invoice_number'], 'narration' => "Vendor Sales Invoice {$vsi['invoice_number']} ({$vsi['vendor_name']})", 'status' => 'POSTED', 'lines' => $lines], $actor);
                    $bd['vendorSalesInvoices']++;
                }

                $pays = $pdo->query("SELECT * FROM `solar_payments` WHERE `status`='PAID' AND (`journal_entry_id` IS NULL OR `journal_entry_id`='')")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($pays as $p) {
                    if (isset($posted['CUSTOMER_RECEIPT:' . $p['id']])) continue;
                    $amt = accRound2(floatval($p['amount']));
                    if ($amt <= 0) continue;
                    $bankCoa = !empty($p['bank_account_id'])
                        ? accResolveBankCoaTxPhp($pdo, $p['bank_account_id'], $settings)
                        : (stripos($p['payment_mode'] ?? '', 'cash') !== false ? ($settings['default_cash_account_id'] ?? 'acc-1010') : ($settings['default_bank_account_id'] ?? 'acc-1020'));
                    $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $safeD($p['paid_date'] ?: $p['due_date']), 'referenceType' => 'CUSTOMER_RECEIPT', 'referenceId' => $p['id'], 'referenceNumber' => $p['receipt_number'], 'narration' => "Receipt {$p['receipt_number']}", 'status' => 'POSTED', 'lines' => [['accountId' => $bankCoa, 'debit' => $amt, 'credit' => 0, 'projectId' => $p['project_id'] ?? '', 'partyType' => 'CUSTOMER', 'partyId' => $p['customer_id'] ?? '', 'partyName' => $p['customer_name'] ?? ''], ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'debit' => 0, 'credit' => $amt, 'projectId' => $p['project_id'] ?? '', 'partyType' => 'CUSTOMER', 'partyId' => $p['customer_id'] ?? '', 'partyName' => $p['customer_name'] ?? '']]], $actor);
                    $pdo->prepare('UPDATE `solar_payments` SET `journal_entry_id`=? WHERE `id`=?')->execute([$jeId, $p['id']]);
                    $bd['customerReceipts']++;
                }

                $vsiPays = $pdo->query("SELECT p.*, v.`invoice_number`, v.`vendor_name` FROM `solar_vendor_sales_payments` p LEFT JOIN `solar_vendor_sales_invoices` v ON v.`id` = p.`invoice_id` WHERE (p.`journal_entry_id` IS NULL OR p.`journal_entry_id` = '')")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($vsiPays as $vp) {
                    if (isset($posted['VENDOR_SALES_RECEIPT:' . $vp['id']])) continue;
                    $amt = accRound2(floatval($vp['amount']));
                    if ($amt <= 0) continue;
                    $bankCoa = !empty($vp['bank_account_id'])
                        ? accResolveBankCoaTxPhp($pdo, $vp['bank_account_id'], $settings)
                        : (stripos($vp['payment_mode'] ?? '', 'cash') !== false ? ($settings['default_cash_account_id'] ?? 'acc-1010') : ($settings['default_bank_account_id'] ?? 'acc-1020'));
                    $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $safeD($vp['payment_date']), 'referenceType' => 'VENDOR_SALES_RECEIPT', 'referenceId' => $vp['id'], 'referenceNumber' => $vp['invoice_number'] ?? $vp['id'], 'narration' => "Vendor Sales Receipt for " . ($vp['invoice_number'] ?? $vp['invoice_id']), 'status' => 'POSTED', 'lines' => [['accountId' => $bankCoa, 'debit' => $amt, 'credit' => 0, 'partyType' => 'VENDOR', 'partyId' => $vp['vendor_id'] ?? '', 'partyName' => $vp['vendor_name'] ?? ''], ['accountId' => $settings['default_ar_account_id'] ?? 'acc-1100', 'debit' => 0, 'credit' => $amt, 'partyType' => 'VENDOR', 'partyId' => $vp['vendor_id'] ?? '', 'partyName' => $vp['vendor_name'] ?? '']]], $actor);
                    $pdo->prepare('UPDATE `solar_vendor_sales_payments` SET `journal_entry_id`=? WHERE `id`=?')->execute([$jeId, $vp['id']]);
                    $bd['vendorSalesReceipts']++;
                }

                $exps = $pdo->query("SELECT * FROM `solar_expenses` WHERE (`status` IS NULL OR `status`='' OR `status`='PAID') AND (`journal_entry_id` IS NULL OR `journal_entry_id`='')")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($exps as $ex) {
                    if (isset($posted['EXPENSE_PAYMENT:' . $ex['id']])) continue;
                    $amt = accRound2(floatval($ex['amount']));
                    if ($amt <= 0) continue;
                    $bankCoa = stripos($ex['payment_mode'] ?? '', 'cash') !== false ? ($settings['default_cash_account_id'] ?? 'acc-1010') : ($settings['default_bank_account_id'] ?? 'acc-1020');
                    $jeId = accInsertJournalTxPhp($pdo, ['entryDate' => $safeD($ex['expense_date']), 'referenceType' => 'EXPENSE_PAYMENT', 'referenceId' => $ex['id'], 'referenceNumber' => $ex['expense_number'], 'narration' => "Expense {$ex['expense_number']}", 'status' => 'POSTED', 'lines' => [['accountId' => $ex['expense_account_id'] ?: 'acc-5040', 'debit' => $amt, 'credit' => 0, 'projectId' => $ex['project_id'] ?? ''], ['accountId' => $bankCoa, 'debit' => 0, 'credit' => $amt]]], $actor);
                    $pdo->prepare('UPDATE `solar_expenses` SET `status`=?,`journal_entry_id`=? WHERE `id`=?')->execute(['PAID', $jeId, $ex['id']]);
                    $bd['expenses']++;
                }

                $pss = $pdo->query("SELECT * FROM `solar_payslips` WHERE `status`='PAID'")->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($pss as $ps) {
                    if (isset($posted['PAYROLL:' . $ps['id']])) continue;
                    $net = accRound2(floatval($ps['net_salary']));
                    if ($net <= 0) continue;
                    accInsertJournalTxPhp($pdo, ['entryDate' => $safeD($ps['payment_date'] ?: $ps['created_at']), 'referenceType' => 'PAYROLL', 'referenceId' => $ps['id'], 'referenceNumber' => $ps['month'] . '-' . $ps['year'], 'narration' => "Payroll {$ps['employee_name']}", 'status' => 'POSTED', 'lines' => [['accountId' => $settings['default_payroll_account_id'] ?? 'acc-5030', 'debit' => $net, 'credit' => 0], ['accountId' => $settings['default_bank_account_id'] ?? 'acc-1020', 'debit' => 0, 'credit' => $net]]], $actor);
                    $bd['payslips']++;
                }

                $cnt = $bd['salesInvoices'] + $bd['vendorSalesInvoices'] + $bd['customerReceipts'] + $bd['vendorSalesReceipts'] + $bd['expenses'] + $bd['payslips'];
                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['syncedCount' => $cnt, 'breakdown' => $bd]]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            exit;
        }

        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Accounting API endpoint not found']);
        exit;
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => $e->getMessage(), 'error' => $e->getMessage()]);
        exit;
    }
}
