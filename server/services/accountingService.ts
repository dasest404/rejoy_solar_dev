import crypto from 'crypto';
import type mysql from 'mysql2/promise';

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

const toSqlDate = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  if (s.includes('T')) return s.split('T')[0];
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const todaySql = (): string => new Date().toISOString().slice(0, 10);

const DEFAULT_COA = [
  { id: 'acc-1010', code: '1010', name: 'Cash in Hand (Petty Cash)', account_type: 'ASSET', sub_type: 'Cash', is_system: 1, description: 'Physical office & site petty cash register' },
  { id: 'acc-1020', code: '1020', name: 'Primary Current Bank Account', account_type: 'ASSET', sub_type: 'Bank', is_system: 1, description: 'Primary operating corporate bank account' },
  { id: 'acc-1100', code: '1100', name: 'Accounts Receivable (Sundry Debtors)', account_type: 'ASSET', sub_type: 'Current Asset', is_system: 1, description: 'Customer EPC milestone & sales receivables' },
  { id: 'acc-1150', code: '1150', name: 'Input GST Credit (ITC Receivable)', account_type: 'ASSET', sub_type: 'Tax Asset', is_system: 1, description: 'Eligible CGST/SGST/IGST Input Tax Credit on purchases' },
  { id: 'acc-1200', code: '1200', name: 'Solar Inventory & Stock-in-Hand', account_type: 'ASSET', sub_type: 'Inventory', is_system: 1, description: 'Modules, inverters, BOS & warehouse stock valuation' },
  { id: 'acc-1500', code: '1500', name: 'Fixed Assets - Plant, Tools & Vehicles', account_type: 'ASSET', sub_type: 'Fixed Asset', is_system: 1, description: 'Capitalized tools, site vehicles, office equipment' },
  { id: 'acc-1590', code: '1590', name: 'Accumulated Depreciation', account_type: 'ASSET', sub_type: 'Contra Asset', is_system: 1, description: 'Cumulative depreciation on capitalized fixed assets' },
  { id: 'acc-2010', code: '2010', name: 'Accounts Payable (Sundry Creditors)', account_type: 'LIABILITY', sub_type: 'Current Liability', is_system: 1, description: 'Vendor bills & supplier payables' },
  { id: 'acc-2100', code: '2100', name: 'Output GST Payable', account_type: 'LIABILITY', sub_type: 'Tax Liability', is_system: 1, description: 'CGST/SGST/IGST collected on sales invoices' },
  { id: 'acc-2150', code: '2150', name: 'TDS Payable', account_type: 'LIABILITY', sub_type: 'Tax Liability', is_system: 1, description: 'Tax deducted at source pending government challan deposit' },
  { id: 'acc-2200', code: '2200', name: 'Payroll & Salary Payable', account_type: 'LIABILITY', sub_type: 'Current Liability', is_system: 1, description: 'Accrued monthly employee salaries & reimbursements' },
  { id: 'acc-2300', code: '2300', name: 'Customer Advance & Booking Deposits', account_type: 'LIABILITY', sub_type: 'Current Liability', is_system: 1, description: 'Unbilled milestone advances received from customers' },
  { id: 'acc-3010', code: '3010', name: 'Share Capital / Owner Equity', account_type: 'EQUITY', sub_type: 'Capital', is_system: 1, description: 'Paid-up share capital and owner equity' },
  { id: 'acc-3020', code: '3020', name: 'Retained Earnings & Reserves', account_type: 'EQUITY', sub_type: 'Reserves', is_system: 1, description: 'Accumulated prior-period earnings' },
  { id: 'acc-4010', code: '4010', name: 'Solar EPC Installation Revenue', account_type: 'REVENUE', sub_type: 'Operating Revenue', is_system: 1, description: 'Revenue from rooftop & ground-mount EPC contracts' },
  { id: 'acc-4020', code: '4020', name: 'AMC & Service Maintenance Revenue', account_type: 'REVENUE', sub_type: 'Operating Revenue', is_system: 1, description: 'Annual maintenance contracts & paid service visits' },
  { id: 'acc-4030', code: '4030', name: 'Vendor Sales & Equipment Trading Revenue', account_type: 'REVENUE', sub_type: 'Operating Revenue', is_system: 1, description: 'B2B solar equipment sales to vendors/partners' },
  { id: 'acc-4090', code: '4090', name: 'Other Income / Asset Disposal Gain-Loss', account_type: 'REVENUE', sub_type: 'Other Income', is_system: 1, description: 'Miscellaneous income and fixed asset disposal variance' },
  { id: 'acc-5010', code: '5010', name: 'Cost of Solar Equipment & Materials (COGS)', account_type: 'EXPENSE', sub_type: 'Direct Cost', is_system: 1, description: 'PV panels, inverters, structures, cables & BOS procurement' },
  { id: 'acc-5020', code: '5020', name: 'Site Execution & Subcontractor Costs', account_type: 'EXPENSE', sub_type: 'Direct Cost', is_system: 1, description: 'Civil, mounting, electrical labor & net-metering permits' },
  { id: 'acc-5030', code: '5030', name: 'Salaries, Wages & Payroll Expense', account_type: 'EXPENSE', sub_type: 'Operating Expense', is_system: 1, description: 'Employee monthly salaries, overtime & incentives' },
  { id: 'acc-5040', code: '5040', name: 'Travel, Fuel & Field Operations Expense', account_type: 'EXPENSE', sub_type: 'Operating Expense', is_system: 1, description: 'Site travel, logistics, fuel & employee reimbursements' },
  { id: 'acc-5050', code: '5050', name: 'Office Rent, Utilities & Admin Overheads', account_type: 'EXPENSE', sub_type: 'Operating Expense', is_system: 1, description: 'Rent, electricity, software, marketing & general overheads' },
  { id: 'acc-5060', code: '5060', name: 'Depreciation & Amortization Expense', account_type: 'EXPENSE', sub_type: 'Non-Cash Expense', is_system: 1, description: 'SLM/WDV periodic fixed asset depreciation' },
  { id: 'acc-5090', code: '5090', name: 'Bank Charges & Loss on Asset Disposal', account_type: 'EXPENSE', sub_type: 'Other Expense', is_system: 1, description: 'Bank transaction fees & write-off losses' }
];

class AccountingService {
  private schemaReady = false;

  private async addColumnIfMissing(
    pool: mysql.Pool,
    table: string,
    column: string,
    definition: string
  ): Promise<void> {
    try {
      const [cols]: any = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
      if (!Array.isArray(cols) || cols.length === 0) {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      }
    } catch (err: any) {
      console.warn(`[Accounting Schema] Notice adding ${table}.${column}:`, err?.message || err);
    }
  }

  public async ensureAccountingSchema(pool: mysql.Pool): Promise<void> {
    if (this.schemaReady) return;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_accounts\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`code\` VARCHAR(32) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`account_type\` VARCHAR(32) NOT NULL,
        \`sub_type\` VARCHAR(64) DEFAULT '',
        \`parent_id\` VARCHAR(64) DEFAULT NULL,
        \`description\` TEXT,
        \`opening_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`current_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`is_system\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_acc_type\` (\`account_type\`),
        INDEX \`idx_acc_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_journal_entries\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`entry_number\` VARCHAR(64) NOT NULL UNIQUE,
        \`entry_date\` DATE NOT NULL,
        \`reference_type\` VARCHAR(64) DEFAULT '',
        \`reference_id\` VARCHAR(64) DEFAULT '',
        \`reference_number\` VARCHAR(64) DEFAULT '',
        \`narration\` TEXT NOT NULL,
        \`total_debit\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`total_credit\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        \`reversed_entry_id\` VARCHAR(64) DEFAULT NULL,
        \`posted_by\` VARCHAR(255) DEFAULT '',
        \`posted_at\` VARCHAR(64) DEFAULT NULL,
        \`created_by\` VARCHAR(255) DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_je_date\` (\`entry_date\`),
        INDEX \`idx_je_status\` (\`status\`),
        INDEX \`idx_je_ref\` (\`reference_type\`, \`reference_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_journal_lines\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`journal_id\` VARCHAR(64) NOT NULL,
        \`line_order\` INT NOT NULL DEFAULT 0,
        \`account_id\` VARCHAR(64) NOT NULL,
        \`account_code\` VARCHAR(32) DEFAULT '',
        \`account_name\` VARCHAR(255) DEFAULT '',
        \`description\` VARCHAR(500) DEFAULT '',
        \`project_id\` VARCHAR(64) DEFAULT '',
        \`project_title\` VARCHAR(255) DEFAULT '',
        \`party_type\` VARCHAR(32) DEFAULT 'NONE',
        \`party_id\` VARCHAR(64) DEFAULT '',
        \`party_name\` VARCHAR(255) DEFAULT '',
        \`debit\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`credit\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        INDEX \`idx_jl_journal\` (\`journal_id\`),
        INDEX \`idx_jl_account\` (\`account_id\`),
        INDEX \`idx_jl_project\` (\`project_id\`),
        CONSTRAINT \`fk_jl_journal\` FOREIGN KEY (\`journal_id\`) REFERENCES \`solar_acc_journal_entries\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_bank_accounts\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`account_name\` VARCHAR(255) NOT NULL,
        \`account_type\` VARCHAR(16) NOT NULL DEFAULT 'BANK',
        \`bank_name\` VARCHAR(255) DEFAULT '',
        \`account_number\` VARCHAR(64) DEFAULT '',
        \`ifsc_code\` VARCHAR(32) DEFAULT '',
        \`branch\` VARCHAR(255) DEFAULT '',
        \`coa_account_id\` VARCHAR(64) DEFAULT '',
        \`opening_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`current_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`is_primary\` TINYINT(1) NOT NULL DEFAULT 0,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_bank_transfers\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`transfer_number\` VARCHAR(64) NOT NULL UNIQUE,
        \`transfer_date\` DATE NOT NULL,
        \`from_account_id\` VARCHAR(64) NOT NULL,
        \`to_account_id\` VARCHAR(64) NOT NULL,
        \`amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`mode\` VARCHAR(64) DEFAULT 'Bank Transfer',
        \`reference_no\` VARCHAR(128) DEFAULT '',
        \`notes\` TEXT,
        \`journal_entry_id\` VARCHAR(64) DEFAULT '',
        \`created_by\` VARCHAR(255) DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_bt_date\` (\`transfer_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_bank_reconciliations\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`bank_account_id\` VARCHAR(64) NOT NULL,
        \`statement_date\` DATE NOT NULL,
        \`book_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`statement_balance\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`cleared_txn_ids_json\` LONGTEXT,
        \`difference\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
        \`notes\` TEXT,
        \`reconciled_by\` VARCHAR(255) DEFAULT '',
        \`reconciled_at\` VARCHAR(64) DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_br_bank\` (\`bank_account_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_vendor_bills\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`bill_number\` VARCHAR(64) NOT NULL UNIQUE,
        \`vendor_id\` VARCHAR(64) NOT NULL,
        \`vendor_name\` VARCHAR(255) NOT NULL,
        \`vendor_gst\` VARCHAR(64) DEFAULT '',
        \`po_id\` VARCHAR(64) DEFAULT '',
        \`po_number\` VARCHAR(64) DEFAULT '',
        \`project_id\` VARCHAR(64) DEFAULT '',
        \`project_title\` VARCHAR(255) DEFAULT '',
        \`bill_date\` DATE NOT NULL,
        \`due_date\` DATE DEFAULT NULL,
        \`category\` VARCHAR(128) DEFAULT 'Material Purchase',
        \`subtotal\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`cgst_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`sgst_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`igst_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`gst_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`tds_section\` VARCHAR(32) DEFAULT '',
        \`tds_rate\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`tds_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`total_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`paid_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`balance_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`itc_eligible\` TINYINT(1) NOT NULL DEFAULT 1,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        \`expense_account_id\` VARCHAR(64) DEFAULT '',
        \`journal_entry_id\` VARCHAR(64) DEFAULT '',
        \`notes\` TEXT,
        \`items_json\` LONGTEXT,
        \`created_by\` VARCHAR(255) DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_vb_vendor\` (\`vendor_id\`),
        INDEX \`idx_vb_status\` (\`status\`),
        INDEX \`idx_vb_due\` (\`due_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_vendor_payments\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`payment_number\` VARCHAR(64) NOT NULL UNIQUE,
        \`bill_id\` VARCHAR(64) NOT NULL,
        \`vendor_id\` VARCHAR(64) NOT NULL,
        \`vendor_name\` VARCHAR(255) NOT NULL,
        \`payment_date\` DATE NOT NULL,
        \`amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`tds_deducted\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`net_paid\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`bank_account_id\` VARCHAR(64) DEFAULT '',
        \`payment_mode\` VARCHAR(64) DEFAULT 'Bank NEFT/RTGS',
        \`reference_no\` VARCHAR(128) DEFAULT '',
        \`notes\` TEXT,
        \`journal_entry_id\` VARCHAR(64) DEFAULT '',
        \`recorded_by\` VARCHAR(255) DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_vp_bill\` (\`bill_id\`),
        INDEX \`idx_vp_vendor\` (\`vendor_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_tds_entries\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`section\` VARCHAR(32) NOT NULL,
        \`party_type\` VARCHAR(32) DEFAULT 'VENDOR',
        \`party_id\` VARCHAR(64) DEFAULT '',
        \`party_name\` VARCHAR(255) NOT NULL,
        \`pan_number\` VARCHAR(32) DEFAULT '',
        \`source_type\` VARCHAR(32) NOT NULL,
        \`source_id\` VARCHAR(64) NOT NULL,
        \`source_number\` VARCHAR(64) DEFAULT '',
        \`deduction_date\` DATE NOT NULL,
        \`gross_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`tds_rate\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        \`tds_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'DEDUCTED',
        \`challan_no\` VARCHAR(64) DEFAULT '',
        \`bsr_code\` VARCHAR(32) DEFAULT '',
        \`deposit_date\` DATE DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_tds_status\` (\`status\`),
        INDEX \`idx_tds_date\` (\`deduction_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_budgets\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`fiscal_year\` VARCHAR(32) NOT NULL,
        \`period_type\` VARCHAR(32) NOT NULL DEFAULT 'ANNUAL',
        \`period_label\` VARCHAR(64) NOT NULL,
        \`department\` VARCHAR(128) DEFAULT '',
        \`category\` VARCHAR(128) DEFAULT '',
        \`project_id\` VARCHAR(64) DEFAULT '',
        \`project_title\` VARCHAR(255) DEFAULT '',
        \`account_id\` VARCHAR(64) DEFAULT '',
        \`allocated_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`notes\` TEXT,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        \`created_by\` VARCHAR(255) DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_budget_fy\` (\`fiscal_year\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_fixed_assets\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`asset_code\` VARCHAR(64) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`category\` VARCHAR(128) NOT NULL,
        \`purchase_date\` DATE NOT NULL,
        \`vendor_name\` VARCHAR(255) DEFAULT '',
        \`purchase_cost\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`salvage_value\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`useful_life_years\` INT NOT NULL DEFAULT 5,
        \`depreciation_method\` VARCHAR(16) NOT NULL DEFAULT 'SLM',
        \`depreciation_rate\` DECIMAL(6,2) NOT NULL DEFAULT 20.00,
        \`accumulated_depreciation\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`book_value\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`last_depreciation_date\` DATE DEFAULT NULL,
        \`asset_account_id\` VARCHAR(64) DEFAULT '',
        \`dep_expense_account_id\` VARCHAR(64) DEFAULT '',
        \`location\` VARCHAR(255) DEFAULT '',
        \`custodian\` VARCHAR(255) DEFAULT '',
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        \`disposal_date\` DATE DEFAULT NULL,
        \`disposal_proceeds\` DECIMAL(14,2) DEFAULT 0.00,
        \`disposal_gain_loss\` DECIMAL(14,2) DEFAULT 0.00,
        \`disposal_journal_id\` VARCHAR(64) DEFAULT NULL,
        \`purchase_journal_id\` VARCHAR(64) DEFAULT NULL,
        \`notes\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_fa_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_asset_depreciation\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`asset_id\` VARCHAR(64) NOT NULL,
        \`period_label\` VARCHAR(64) NOT NULL,
        \`run_date\` DATE NOT NULL,
        \`opening_book_value\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`depreciation_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`closing_book_value\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`journal_entry_id\` VARCHAR(64) DEFAULT '',
        \`run_by\` VARCHAR(255) DEFAULT '',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_ad_asset\` (\`asset_id\`),
        CONSTRAINT \`fk_ad_asset\` FOREIGN KEY (\`asset_id\`) REFERENCES \`solar_acc_fixed_assets\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_settings\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`fiscal_year_start_month\` INT NOT NULL DEFAULT 4,
        \`active_fiscal_year\` VARCHAR(32) NOT NULL DEFAULT '2026-27',
        \`lock_date\` DATE DEFAULT NULL,
        \`currency\` VARCHAR(16) NOT NULL DEFAULT 'INR',
        \`approval_threshold\` DECIMAL(14,2) NOT NULL DEFAULT 10000.00,
        \`require_expense_approval\` TINYINT(1) NOT NULL DEFAULT 1,
        \`auto_post_erp_vouchers\` TINYINT(1) NOT NULL DEFAULT 1,
        \`journal_prefix\` VARCHAR(16) NOT NULL DEFAULT 'JV-',
        \`bill_prefix\` VARCHAR(16) NOT NULL DEFAULT 'BILL-',
        \`voucher_prefix\` VARCHAR(16) NOT NULL DEFAULT 'VOU-',
        \`default_cash_account_id\` VARCHAR(64) DEFAULT 'acc-1010',
        \`default_bank_account_id\` VARCHAR(64) DEFAULT 'acc-1020',
        \`default_ar_account_id\` VARCHAR(64) DEFAULT 'acc-1100',
        \`default_ap_account_id\` VARCHAR(64) DEFAULT 'acc-2010',
        \`default_sales_account_id\` VARCHAR(64) DEFAULT 'acc-4010',
        \`default_cogs_account_id\` VARCHAR(64) DEFAULT 'acc-5010',
        \`default_output_gst_account_id\` VARCHAR(64) DEFAULT 'acc-2100',
        \`default_input_gst_account_id\` VARCHAR(64) DEFAULT 'acc-1150',
        \`default_tds_account_id\` VARCHAR(64) DEFAULT 'acc-2150',
        \`default_payroll_account_id\` VARCHAR(64) DEFAULT 'acc-5030',
        \`default_dep_expense_account_id\` VARCHAR(64) DEFAULT 'acc-5060',
        \`default_disposal_gain_loss_account_id\` VARCHAR(64) DEFAULT 'acc-4090',
        \`updated_by\` VARCHAR(255) DEFAULT '',
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`solar_acc_audit_logs\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`actor_id\` VARCHAR(64) NOT NULL,
        \`actor_name\` VARCHAR(255) NOT NULL,
        \`actor_role\` VARCHAR(64) NOT NULL,
        \`module\` VARCHAR(64) NOT NULL,
        \`action\` VARCHAR(64) NOT NULL,
        \`entity_id\` VARCHAR(64) DEFAULT '',
        \`entity_ref\` VARCHAR(128) DEFAULT '',
        \`summary\` TEXT NOT NULL,
        \`details_json\` LONGTEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_acc_audit_module\` (\`module\`),
        INDEX \`idx_acc_audit_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Safe column extensions on existing ERP tables
    await this.addColumnIfMissing(pool, 'solar_payments', 'invoice_id', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_payments', 'invoice_number', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_payments', 'bank_account_id', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_payments', 'journal_entry_id', "VARCHAR(64) DEFAULT ''");

    await this.addColumnIfMissing(pool, 'solar_expenses', 'expense_type', "VARCHAR(32) DEFAULT 'DIRECT_EXPENSE'");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'status', "VARCHAR(32) DEFAULT 'PAID'");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'employee_id', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'employee_name', "VARCHAR(255) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'gst_amount', 'DECIMAL(14,2) DEFAULT 0.00');
    await this.addColumnIfMissing(pool, 'solar_expenses', 'itc_eligible', 'TINYINT(1) DEFAULT 0');
    await this.addColumnIfMissing(pool, 'solar_expenses', 'bank_account_id', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'expense_account_id', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'journal_entry_id', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_expenses', 'approved_at', 'VARCHAR(64) DEFAULT NULL');
    await this.addColumnIfMissing(pool, 'solar_expenses', 'rejection_reason', 'TEXT');
    await this.addColumnIfMissing(pool, 'solar_expenses', 'paid_at', 'VARCHAR(64) DEFAULT NULL');
    await this.addColumnIfMissing(pool, 'solar_expenses', 'paid_by', "VARCHAR(255) DEFAULT ''");

    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'cgst_amount', 'DECIMAL(14,2) DEFAULT 0.00');
    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'sgst_amount', 'DECIMAL(14,2) DEFAULT 0.00');
    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'igst_amount', 'DECIMAL(14,2) DEFAULT 0.00');
    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'einvoice_irn', "VARCHAR(128) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'einvoice_ack_no', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'einvoice_ack_date', "VARCHAR(64) DEFAULT ''");
    await this.addColumnIfMissing(pool, 'solar_sales_invoices', 'einvoice_status', "VARCHAR(32) DEFAULT 'NOT_GENERATED'");

    // Seed default Chart of Accounts if empty
    const [accCountRows]: any = await pool.query('SELECT COUNT(*) AS cnt FROM `solar_acc_accounts`');
    if (Number(accCountRows?.[0]?.cnt || 0) === 0) {
      for (const acc of DEFAULT_COA) {
        await pool.query(
          `INSERT IGNORE INTO \`solar_acc_accounts\` (\`id\`, \`code\`, \`name\`, \`account_type\`, \`sub_type\`, \`description\`, \`opening_balance\`, \`current_balance\`, \`is_system\`, \`is_active\`)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 1)`,
          [acc.id, acc.code, acc.name, acc.account_type, acc.sub_type, acc.description, acc.is_system]
        );
      }
    }

    // Seed default Cash & Primary Bank accounts if empty
    const [bankCountRows]: any = await pool.query('SELECT COUNT(*) AS cnt FROM `solar_acc_bank_accounts`');
    if (Number(bankCountRows?.[0]?.cnt || 0) === 0) {
      await pool.query(
        `INSERT IGNORE INTO \`solar_acc_bank_accounts\` (\`id\`, \`account_name\`, \`account_type\`, \`bank_name\`, \`account_number\`, \`ifsc_code\`, \`branch\`, \`coa_account_id\`, \`opening_balance\`, \`current_balance\`, \`is_primary\`, \`is_active\`)
         VALUES
         ('bank-cash-main', 'Office Petty Cash Register', 'CASH', 'Cash Drawer', 'CASH-01', '', 'Head Office', 'acc-1010', 0, 0, 0, 1),
         ('bank-main-current', 'Primary Corporate Current Account', 'BANK', 'Operating Bank', 'REJOY-CORP-001', '', 'Main Branch', 'acc-1020', 0, 0, 1, 1)`
      );
    }

    // Seed default accounting settings row
    await pool.query(
      `INSERT IGNORE INTO \`solar_acc_settings\` (\`id\`, \`fiscal_year_start_month\`, \`active_fiscal_year\`, \`currency\`, \`approval_threshold\`)
       VALUES ('default', 4, '2026-27', 'INR', 10000.00)`
    );

    this.schemaReady = true;
  }

  private async logAudit(
    conn: mysql.Pool | mysql.PoolConnection,
    actor: any,
    moduleName: string,
    action: string,
    entityId: string,
    entityRef: string,
    summary: string,
    details?: any
  ): Promise<void> {
    const id = `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await conn.query(
      `INSERT INTO \`solar_acc_audit_logs\` (\`id\`, \`actor_id\`, \`actor_name\`, \`actor_role\`, \`module\`, \`action\`, \`entity_id\`, \`entity_ref\`, \`summary\`, \`details_json\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(actor?.id || 'system'),
        String(actor?.name || actor?.email || 'System'),
        String(actor?.role || 'Admin'),
        moduleName,
        action,
        entityId,
        entityRef,
        summary,
        details ? JSON.stringify(details) : null
      ]
    );
  }

  private async getSettingsRow(conn: mysql.Pool | mysql.PoolConnection): Promise<any> {
    const [rows]: any = await conn.query("SELECT * FROM `solar_acc_settings` WHERE `id` = 'default' LIMIT 1");
    return rows?.[0] || {
      id: 'default',
      fiscal_year_start_month: 4,
      active_fiscal_year: '2026-27',
      lock_date: null,
      currency: 'INR',
      approval_threshold: 10000,
      require_expense_approval: 1,
      auto_post_erp_vouchers: 1,
      journal_prefix: 'JV-',
      bill_prefix: 'BILL-',
      voucher_prefix: 'VOU-',
      default_cash_account_id: 'acc-1010',
      default_bank_account_id: 'acc-1020',
      default_ar_account_id: 'acc-1100',
      default_ap_account_id: 'acc-2010',
      default_sales_account_id: 'acc-4010',
      default_cogs_account_id: 'acc-5010',
      default_output_gst_account_id: 'acc-2100',
      default_input_gst_account_id: 'acc-1150',
      default_tds_account_id: 'acc-2150',
      default_payroll_account_id: 'acc-5030',
      default_dep_expense_account_id: 'acc-5060',
      default_disposal_gain_loss_account_id: 'acc-4090'
    };
  }

  private async assertNotLockedDate(conn: mysql.Pool | mysql.PoolConnection, entryDate: string): Promise<void> {
    const settings = await this.getSettingsRow(conn);
    const lockDate = toSqlDate(settings.lock_date);
    if (lockDate && entryDate <= lockDate) {
      throw new Error(`Accounting period is locked on or before ${lockDate}. Choose a later date or unlock the period in Finance Settings.`);
    }
  }

  public async recalculateAccountBalances(conn: mysql.Pool | mysql.PoolConnection): Promise<void> {
    const [accounts]: any = await conn.query('SELECT `id`, `account_type`, `opening_balance` FROM `solar_acc_accounts`');
    const [sums]: any = await conn.query(`
      SELECT l.\`account_id\`, SUM(l.\`debit\`) AS sum_debit, SUM(l.\`credit\`) AS sum_credit
      FROM \`solar_acc_journal_lines\` l
      INNER JOIN \`solar_acc_journal_entries\` e ON e.\`id\` = l.\`journal_id\`
      WHERE e.\`status\` IN ('POSTED', 'REVERSED')
      GROUP BY l.\`account_id\`
    `);
    const sumMap = new Map<string, { debit: number; credit: number }>();
    for (const row of sums || []) {
      sumMap.set(row.account_id, {
        debit: Number(row.sum_debit) || 0,
        credit: Number(row.sum_credit) || 0
      });
    }
    for (const acc of accounts || []) {
      const opening = Number(acc.opening_balance) || 0;
      const totals = sumMap.get(acc.id) || { debit: 0, credit: 0 };
      const isDebitNormal = acc.account_type === 'ASSET' || acc.account_type === 'EXPENSE';
      const balance = isDebitNormal
        ? round2(opening + totals.debit - totals.credit)
        : round2(opening + totals.credit - totals.debit);
      await conn.query('UPDATE `solar_acc_accounts` SET `current_balance` = ? WHERE `id` = ?', [balance, acc.id]);
    }
  }

  private async insertAndPostJournalTx(
    conn: mysql.PoolConnection,
    params: {
      entryNumber?: string;
      entryDate: string;
      referenceType: string;
      referenceId: string;
      referenceNumber: string;
      narration: string;
      status?: 'DRAFT' | 'POSTED';
      lines: Array<{
        accountId: string;
        description?: string;
        projectId?: string;
        projectTitle?: string;
        partyType?: string;
        partyId?: string;
        partyName?: string;
        debit: number;
        credit: number;
      }>;
    },
    actor: any
  ): Promise<string> {
    const settings = await this.getSettingsRow(conn);
    const prefix = settings.journal_prefix || 'JV-';
    const entryDate = toSqlDate(params.entryDate) || todaySql();
    const status = params.status || 'POSTED';

    if (status === 'POSTED') {
      await this.assertNotLockedDate(conn, entryDate);
    }

    const cleanLines = (params.lines || []).filter(
      l => l.accountId && (round2(l.debit) > 0 || round2(l.credit) > 0)
    );
    if (cleanLines.length < 2) {
      throw new Error('A journal entry requires at least 2 valid debit/credit lines.');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of cleanLines) {
      const d = round2(l.debit);
      const c = round2(l.credit);
      if (d < 0 || c < 0) throw new Error('Debit and credit amounts must be non-negative.');
      if (d > 0 && c > 0) throw new Error('Each journal line must be either a Debit or a Credit, not both.');
      totalDebit = round2(totalDebit + d);
      totalCredit = round2(totalCredit + c);
    }

    if (status === 'POSTED' && Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new Error(`Double-entry imbalance: Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}).`);
    }

    const [accRows]: any = await conn.query('SELECT `id`, `code`, `name` FROM `solar_acc_accounts`');
    const accMap = new Map<string, { code: string; name: string }>();
    for (const r of accRows || []) {
      accMap.set(r.id, { code: r.code, name: r.name });
    }

    const id = `je-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const entryNumber =
      params.entryNumber ||
      `${prefix}${entryDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    await conn.query(
      `INSERT INTO \`solar_acc_journal_entries\`
       (\`id\`, \`entry_number\`, \`entry_date\`, \`reference_type\`, \`reference_id\`, \`reference_number\`, \`narration\`, \`total_debit\`, \`total_credit\`, \`status\`, \`posted_by\`, \`posted_at\`, \`created_by\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entryNumber,
        entryDate,
        params.referenceType || 'MANUAL',
        params.referenceId || '',
        params.referenceNumber || '',
        params.narration || 'Accounting Journal Entry',
        totalDebit,
        totalCredit,
        status,
        status === 'POSTED' ? String(actor?.name || 'Admin') : '',
        status === 'POSTED' ? new Date().toISOString() : null,
        String(actor?.name || 'Admin')
      ]
    );

    let order = 1;
    for (const l of cleanLines) {
      const meta = accMap.get(l.accountId);
      if (!meta) {
        throw new Error(`Invalid Chart of Accounts ID referenced in journal line: ${l.accountId}`);
      }
      await conn.query(
        `INSERT INTO \`solar_acc_journal_lines\`
         (\`id\`, \`journal_id\`, \`line_order\`, \`account_id\`, \`account_code\`, \`account_name\`, \`description\`, \`project_id\`, \`project_title\`, \`party_type\`, \`party_id\`, \`party_name\`, \`debit\`, \`credit\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `jl-${Date.now()}-${order}-${Math.floor(Math.random() * 1000)}`,
          id,
          order++,
          l.accountId,
          meta.code,
          meta.name,
          l.description || '',
          l.projectId || '',
          l.projectTitle || '',
          l.partyType || 'NONE',
          l.partyId || '',
          l.partyName || '',
          round2(l.debit),
          round2(l.credit)
        ]
      );
    }

    if (status === 'POSTED') {
      await this.recalculateAccountBalances(conn);
    }

    return id;
  }

  public async getWorkspace(pool: mysql.Pool): Promise<any> {
    await this.ensureAccountingSchema(pool);

    const [
      [accounts],
      [entries],
      [lines],
      [bankAccounts],
      [bankTransfers],
      [bankReconciliations],
      [vendorBills],
      [vendorPayments],
      [tdsEntries],
      [budgets],
      [fixedAssets],
      [depLogs],
      [settingsRows],
      [auditLogs]
    ]: any = await Promise.all([
      pool.query('SELECT * FROM `solar_acc_accounts` ORDER BY `code` ASC'),
      pool.query('SELECT * FROM `solar_acc_journal_entries` ORDER BY `entry_date` DESC, `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_journal_lines` ORDER BY `line_order` ASC'),
      pool.query('SELECT * FROM `solar_acc_bank_accounts` ORDER BY `is_primary` DESC, `account_type` ASC, `account_name` ASC'),
      pool.query('SELECT * FROM `solar_acc_bank_transfers` ORDER BY `transfer_date` DESC, `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_bank_reconciliations` ORDER BY `statement_date` DESC, `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_vendor_bills` ORDER BY `bill_date` DESC, `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_vendor_payments` ORDER BY `payment_date` DESC, `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_tds_entries` ORDER BY `deduction_date` DESC, `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_budgets` ORDER BY `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_fixed_assets` ORDER BY `created_at` DESC'),
      pool.query('SELECT * FROM `solar_acc_asset_depreciation` ORDER BY `run_date` DESC, `created_at` DESC'),
      pool.query("SELECT * FROM `solar_acc_settings` WHERE `id` = 'default' LIMIT 1"),
      pool.query('SELECT * FROM `solar_acc_audit_logs` ORDER BY `created_at` DESC LIMIT 200')
    ]);

    const linesByJournal = new Map<string, any[]>();
    for (const l of lines || []) {
      const arr = linesByJournal.get(l.journal_id) || [];
      arr.push({
        id: l.id,
        journalId: l.journal_id,
        lineOrder: Number(l.line_order) || 0,
        accountId: l.account_id,
        accountCode: l.account_code || '',
        accountName: l.account_name || '',
        description: l.description || '',
        projectId: l.project_id || '',
        projectTitle: l.project_title || '',
        partyType: l.party_type || 'NONE',
        partyId: l.party_id || '',
        partyName: l.party_name || '',
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0
      });
      linesByJournal.set(l.journal_id, arr);
    }

    const bankNameMap = new Map<string, string>();
    for (const b of bankAccounts || []) bankNameMap.set(b.id, b.account_name);
    const billNumMap = new Map<string, string>();
    for (const vb of vendorBills || []) billNumMap.set(vb.id, vb.bill_number);
    const assetMetaMap = new Map<string, { code: string; name: string }>();
    for (const a of fixedAssets || []) assetMetaMap.set(a.id, { code: a.asset_code, name: a.name });

    const sRow = settingsRows?.[0] || {};

    return {
      accounts: (accounts || []).map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        accountType: a.account_type,
        subType: a.sub_type || '',
        parentId: a.parent_id || null,
        description: a.description || '',
        openingBalance: Number(a.opening_balance) || 0,
        currentBalance: Number(a.current_balance) || 0,
        isSystem: Boolean(a.is_system),
        isActive: a.is_active !== 0,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      })),
      journals: (entries || []).map((e: any) => ({
        id: e.id,
        entryNumber: e.entry_number,
        entryDate: toSqlDate(e.entry_date) || '',
        referenceType: e.reference_type || '',
        referenceId: e.reference_id || '',
        referenceNumber: e.reference_number || '',
        narration: e.narration || '',
        totalDebit: Number(e.total_debit) || 0,
        totalCredit: Number(e.total_credit) || 0,
        status: e.status || 'DRAFT',
        reversedEntryId: e.reversed_entry_id || null,
        postedBy: e.posted_by || '',
        postedAt: e.posted_at || null,
        createdBy: e.created_by || '',
        lines: linesByJournal.get(e.id) || [],
        createdAt: e.created_at,
        updatedAt: e.updated_at
      })),
      bankAccounts: (bankAccounts || []).map((b: any) => ({
        id: b.id,
        accountName: b.account_name,
        accountType: b.account_type,
        bankName: b.bank_name || '',
        accountNumber: b.account_number || '',
        ifscCode: b.ifsc_code || '',
        branch: b.branch || '',
        coaAccountId: b.coa_account_id || '',
        openingBalance: Number(b.opening_balance) || 0,
        currentBalance: Number(b.current_balance) || 0,
        isPrimary: Boolean(b.is_primary),
        isActive: b.is_active !== 0,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      })),
      bankTransfers: (bankTransfers || []).map((t: any) => ({
        id: t.id,
        transferNumber: t.transfer_number,
        transferDate: toSqlDate(t.transfer_date) || '',
        fromAccountId: t.from_account_id,
        fromAccountName: bankNameMap.get(t.from_account_id) || t.from_account_id,
        toAccountId: t.to_account_id,
        toAccountName: bankNameMap.get(t.to_account_id) || t.to_account_id,
        amount: Number(t.amount) || 0,
        mode: t.mode || 'Bank Transfer',
        referenceNo: t.reference_no || '',
        notes: t.notes || '',
        journalEntryId: t.journal_entry_id || '',
        createdBy: t.created_by || '',
        createdAt: t.created_at
      })),
      bankReconciliations: (bankReconciliations || []).map((r: any) => {
        let clearedTxnIds: string[] = [];
        try {
          if (r.cleared_txn_ids_json) clearedTxnIds = JSON.parse(r.cleared_txn_ids_json);
        } catch {}
        return {
          id: r.id,
          bankAccountId: r.bank_account_id,
          bankAccountName: bankNameMap.get(r.bank_account_id) || '',
          statementDate: toSqlDate(r.statement_date) || '',
          bookBalance: Number(r.book_balance) || 0,
          statementBalance: Number(r.statement_balance) || 0,
          clearedTxnIds,
          difference: Number(r.difference) || 0,
          status: r.status || 'DRAFT',
          notes: r.notes || '',
          reconciledBy: r.reconciled_by || '',
          reconciledAt: r.reconciled_at || undefined,
          createdAt: r.created_at
        };
      }),
      vendorBills: (vendorBills || []).map((vb: any) => {
        let items: any[] = [];
        try {
          if (vb.items_json) items = JSON.parse(vb.items_json);
        } catch {}
        return {
          id: vb.id,
          billNumber: vb.bill_number,
          vendorId: vb.vendor_id,
          vendorName: vb.vendor_name,
          vendorGst: vb.vendor_gst || '',
          poId: vb.po_id || '',
          poNumber: vb.po_number || '',
          projectId: vb.project_id || '',
          projectTitle: vb.project_title || '',
          billDate: toSqlDate(vb.bill_date) || '',
          dueDate: toSqlDate(vb.due_date) || '',
          category: vb.category || 'Material Purchase',
          subtotal: Number(vb.subtotal) || 0,
          cgstAmount: Number(vb.cgst_amount) || 0,
          sgstAmount: Number(vb.sgst_amount) || 0,
          igstAmount: Number(vb.igst_amount) || 0,
          gstAmount: Number(vb.gst_amount) || 0,
          tdsSection: vb.tds_section || '',
          tdsRate: Number(vb.tds_rate) || 0,
          tdsAmount: Number(vb.tds_amount) || 0,
          totalAmount: Number(vb.total_amount) || 0,
          paidAmount: Number(vb.paid_amount) || 0,
          balanceAmount: Number(vb.balance_amount) || 0,
          itcEligible: vb.itc_eligible !== 0,
          status: vb.status || 'OPEN',
          expenseAccountId: vb.expense_account_id || '',
          journalEntryId: vb.journal_entry_id || '',
          notes: vb.notes || '',
          items,
          createdBy: vb.created_by || '',
          createdAt: vb.created_at,
          updatedAt: vb.updated_at
        };
      }),
      vendorPayments: (vendorPayments || []).map((vp: any) => ({
        id: vp.id,
        paymentNumber: vp.payment_number,
        billId: vp.bill_id,
        billNumber: billNumMap.get(vp.bill_id) || vp.bill_id,
        vendorId: vp.vendor_id,
        vendorName: vp.vendor_name,
        paymentDate: toSqlDate(vp.payment_date) || '',
        amount: Number(vp.amount) || 0,
        tdsDeducted: Number(vp.tds_deducted) || 0,
        netPaid: Number(vp.net_paid) || 0,
        bankAccountId: vp.bank_account_id || '',
        bankAccountName: bankNameMap.get(vp.bank_account_id) || '',
        paymentMode: vp.payment_mode || 'Bank NEFT/RTGS',
        referenceNo: vp.reference_no || '',
        notes: vp.notes || '',
        journalEntryId: vp.journal_entry_id || '',
        recordedBy: vp.recorded_by || '',
        createdAt: vp.created_at
      })),
      tdsEntries: (tdsEntries || []).map((t: any) => ({
        id: t.id,
        section: t.section,
        partyType: t.party_type || 'VENDOR',
        partyId: t.party_id || '',
        partyName: t.party_name,
        panNumber: t.pan_number || '',
        sourceType: t.source_type,
        sourceId: t.source_id,
        sourceNumber: t.source_number || '',
        deductionDate: toSqlDate(t.deduction_date) || '',
        grossAmount: Number(t.gross_amount) || 0,
        tdsRate: Number(t.tds_rate) || 0,
        tdsAmount: Number(t.tds_amount) || 0,
        status: t.status || 'DEDUCTED',
        challanNo: t.challan_no || '',
        bsrCode: t.bsr_code || '',
        depositDate: toSqlDate(t.deposit_date),
        createdAt: t.created_at
      })),
      budgets: (budgets || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        fiscalYear: b.fiscal_year,
        periodType: b.period_type || 'ANNUAL',
        periodLabel: b.period_label,
        department: b.department || '',
        category: b.category || '',
        projectId: b.project_id || '',
        projectTitle: b.project_title || '',
        accountId: b.account_id || '',
        allocatedAmount: Number(b.allocated_amount) || 0,
        notes: b.notes || '',
        status: b.status || 'ACTIVE',
        createdBy: b.created_by || '',
        createdAt: b.created_at,
        updatedAt: b.updated_at
      })),
      fixedAssets: (fixedAssets || []).map((f: any) => ({
        id: f.id,
        assetCode: f.asset_code,
        name: f.name,
        category: f.category,
        purchaseDate: toSqlDate(f.purchase_date) || '',
        vendorName: f.vendor_name || '',
        purchaseCost: Number(f.purchase_cost) || 0,
        salvageValue: Number(f.salvage_value) || 0,
        usefulLifeYears: Number(f.useful_life_years) || 5,
        depreciationMethod: f.depreciation_method || 'SLM',
        depreciationRate: Number(f.depreciation_rate) || 0,
        accumulatedDepreciation: Number(f.accumulated_depreciation) || 0,
        bookValue: Number(f.book_value) || 0,
        lastDepreciationDate: toSqlDate(f.last_depreciation_date),
        assetAccountId: f.asset_account_id || 'acc-1500',
        depExpenseAccountId: f.dep_expense_account_id || 'acc-5060',
        location: f.location || '',
        custodian: f.custodian || '',
        status: f.status || 'ACTIVE',
        disposalDate: toSqlDate(f.disposal_date),
        disposalProceeds: Number(f.disposal_proceeds) || 0,
        disposalGainLoss: Number(f.disposal_gain_loss) || 0,
        disposalJournalId: f.disposal_journal_id || null,
        purchaseJournalId: f.purchase_journal_id || null,
        notes: f.notes || '',
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      assetDepreciationLogs: (depLogs || []).map((d: any) => {
        const meta = assetMetaMap.get(d.asset_id);
        return {
          id: d.id,
          assetId: d.asset_id,
          assetCode: meta?.code || '',
          assetName: meta?.name || '',
          periodLabel: d.period_label,
          runDate: toSqlDate(d.run_date) || '',
          openingBookValue: Number(d.opening_book_value) || 0,
          depreciationAmount: Number(d.depreciation_amount) || 0,
          closingBookValue: Number(d.closing_book_value) || 0,
          journalEntryId: d.journal_entry_id || '',
          runBy: d.run_by || '',
          createdAt: d.created_at
        };
      }),
      settings: {
        id: 'default',
        fiscalYearStartMonth: Number(sRow.fiscal_year_start_month) || 4,
        activeFiscalYear: sRow.active_fiscal_year || '2026-27',
        lockDate: toSqlDate(sRow.lock_date),
        currency: sRow.currency || 'INR',
        approvalThreshold: Number(sRow.approval_threshold ?? 10000),
        requireExpenseApproval: sRow.require_expense_approval !== 0,
        autoPostErpVouchers: sRow.auto_post_erp_vouchers !== 0,
        journalPrefix: sRow.journal_prefix || 'JV-',
        billPrefix: sRow.bill_prefix || 'BILL-',
        voucherPrefix: sRow.voucher_prefix || 'VOU-',
        defaultCashAccountId: sRow.default_cash_account_id || 'acc-1010',
        defaultBankAccountId: sRow.default_bank_account_id || 'acc-1020',
        defaultArAccountId: sRow.default_ar_account_id || 'acc-1100',
        defaultApAccountId: sRow.default_ap_account_id || 'acc-2010',
        defaultSalesAccountId: sRow.default_sales_account_id || 'acc-4010',
        defaultCogsAccountId: sRow.default_cogs_account_id || 'acc-5010',
        defaultOutputGstAccountId: sRow.default_output_gst_account_id || 'acc-2100',
        defaultInputGstAccountId: sRow.default_input_gst_account_id || 'acc-1150',
        defaultTdsAccountId: sRow.default_tds_account_id || 'acc-2150',
        defaultPayrollAccountId: sRow.default_payroll_account_id || 'acc-5030',
        defaultDepExpenseAccountId: sRow.default_dep_expense_account_id || 'acc-5060',
        defaultDisposalGainLossAccountId: sRow.default_disposal_gain_loss_account_id || 'acc-4090',
        updatedBy: sRow.updated_by || '',
        updatedAt: sRow.updated_at || ''
      },
      auditLogs: (auditLogs || []).map((l: any) => {
        let details: any = undefined;
        try {
          if (l.details_json) details = JSON.parse(l.details_json);
        } catch {}
        return {
          id: l.id,
          actorId: l.actor_id,
          actorName: l.actor_name,
          actorRole: l.actor_role,
          module: l.module,
          action: l.action,
          entityId: l.entity_id || '',
          entityRef: l.entity_ref || '',
          summary: l.summary,
          details,
          createdAt: l.created_at
        };
      })
    };
  }

  public async saveAccount(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const code = String(data.code || '').trim();
    const name = String(data.name || '').trim();
    const accountType = String(data.accountType || '').toUpperCase();
    if (!code || !name || !['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(accountType)) {
      throw new Error('Account code, name, and valid account type are required.');
    }

    const id = data.id || `acc-${code}-${Date.now()}`;
    const [dup]: any = await pool.query('SELECT `id` FROM `solar_acc_accounts` WHERE `code` = ? AND `id` <> ? LIMIT 1', [code, id]);
    if (dup?.length > 0) {
      throw new Error(`Account code "${code}" is already in use.`);
    }

    const opening = round2(data.openingBalance || 0);
    await pool.query(
      `INSERT INTO \`solar_acc_accounts\` (\`id\`, \`code\`, \`name\`, \`account_type\`, \`sub_type\`, \`parent_id\`, \`description\`, \`opening_balance\`, \`current_balance\`, \`is_system\`, \`is_active\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`code\` = VALUES(\`code\`),
         \`name\` = VALUES(\`name\`),
         \`account_type\` = VALUES(\`account_type\`),
         \`sub_type\` = VALUES(\`sub_type\`),
         \`parent_id\` = VALUES(\`parent_id\`),
         \`description\` = VALUES(\`description\`),
         \`opening_balance\` = VALUES(\`opening_balance\`),
         \`is_active\` = VALUES(\`is_active\`)`,
      [
        id,
        code,
        name,
        accountType,
        data.subType || '',
        data.parentId || null,
        data.description || '',
        opening,
        opening,
        data.isSystem ? 1 : 0,
        data.isActive === false ? 0 : 1
      ]
    );
    await this.recalculateAccountBalances(pool);
    await this.logAudit(pool, actor, 'ACCOUNTS', data.id ? 'UPDATE_ACCOUNT' : 'CREATE_ACCOUNT', id, code, `${data.id ? 'Updated' : 'Created'} ledger account ${code} - ${name}`);
    const [rows]: any = await pool.query('SELECT * FROM `solar_acc_accounts` WHERE `id` = ? LIMIT 1', [id]);
    return rows?.[0];
  }

  public async deleteAccount(pool: mysql.Pool, id: string, actor: any): Promise<void> {
    await this.ensureAccountingSchema(pool);
    const [rows]: any = await pool.query('SELECT * FROM `solar_acc_accounts` WHERE `id` = ? LIMIT 1', [id]);
    const acc = rows?.[0];
    if (!acc) throw new Error('Account not found.');
    if (acc.is_system) throw new Error('System control accounts cannot be deleted. You can deactivate non-core accounts instead.');
    const [used]: any = await pool.query('SELECT COUNT(*) AS cnt FROM `solar_acc_journal_lines` WHERE `account_id` = ?', [id]);
    if (Number(used?.[0]?.cnt || 0) > 0) {
      throw new Error('Cannot delete an account with posted journal transactions. Mark it inactive instead.');
    }
    await pool.query('DELETE FROM `solar_acc_accounts` WHERE `id` = ?', [id]);
    await this.logAudit(pool, actor, 'ACCOUNTS', 'DELETE_ACCOUNT', id, acc.code, `Deleted account ${acc.code} - ${acc.name}`);
  }

  public async saveJournalEntry(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const status: 'DRAFT' | 'POSTED' = data.status === 'POSTED' ? 'POSTED' : 'DRAFT';
      const entryDate = toSqlDate(data.entryDate) || todaySql();
      if (status === 'POSTED') {
        await this.assertNotLockedDate(conn, entryDate);
      }

      const lines = Array.isArray(data.lines) ? data.lines : [];
      const cleanLines = lines.filter((l: any) => l.accountId && (round2(l.debit) > 0 || round2(l.credit) > 0));
      if (cleanLines.length < 2) {
        throw new Error('Journal entry requires at least 2 lines.');
      }
      let totalDebit = 0;
      let totalCredit = 0;
      for (const l of cleanLines) {
        const d = round2(l.debit);
        const c = round2(l.credit);
        if (d < 0 || c < 0) throw new Error('Amounts must be non-negative.');
        if (d > 0 && c > 0) throw new Error('Each line can only have a Debit OR a Credit.');
        totalDebit = round2(totalDebit + d);
        totalCredit = round2(totalCredit + c);
      }
      if (status === 'POSTED' && Math.abs(totalDebit - totalCredit) >= 0.01) {
        throw new Error(`Journal is out of balance: Debit ₹${totalDebit.toFixed(2)} vs Credit ₹${totalCredit.toFixed(2)}.`);
      }

      if (data.id) {
        const [existing]: any = await conn.query('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1', [data.id]);
        if (existing?.[0] && existing[0].status !== 'DRAFT') {
          throw new Error('Posted or reversed journal entries are immutable. Use Reverse Journal Entry to correct.');
        }
        await conn.query('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?', [data.id]);
      }

      const id = await this.insertAndPostJournalTx(
        conn,
        {
          entryNumber: data.entryNumber,
          entryDate,
          referenceType: data.referenceType || 'MANUAL',
          referenceId: data.referenceId || '',
          referenceNumber: data.referenceNumber || '',
          narration: data.narration || 'Manual Journal Voucher',
          status,
          lines: cleanLines
        },
        actor
      );

      await this.logAudit(
        conn,
        actor,
        'LEDGER',
        status === 'POSTED' ? 'POST_JOURNAL' : 'SAVE_DRAFT_JOURNAL',
        id,
        data.entryNumber || id,
        `${status === 'POSTED' ? 'Posted' : 'Saved draft'} journal voucher (₹${totalDebit.toFixed(2)}): ${data.narration || ''}`
      );
      await conn.commit();
      return { id, status, totalDebit, totalCredit };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async postJournalEntry(pool: mysql.Pool, id: string, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows]: any = await conn.query('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1', [id]);
      const je = rows?.[0];
      if (!je) throw new Error('Journal entry not found.');
      if (je.status !== 'DRAFT') throw new Error(`Only DRAFT entries can be posted (current: ${je.status}).`);
      await this.assertNotLockedDate(conn, toSqlDate(je.entry_date) || todaySql());

      const [lines]: any = await conn.query('SELECT * FROM `solar_acc_journal_lines` WHERE `journal_id` = ?', [id]);
      if (!lines || lines.length < 2) throw new Error('Journal entry must have at least 2 lines.');
      let td = 0;
      let tc = 0;
      for (const l of lines) {
        td = round2(td + Number(l.debit || 0));
        tc = round2(tc + Number(l.credit || 0));
      }
      if (Math.abs(td - tc) >= 0.01) {
        throw new Error(`Cannot post unbalanced journal (Debit ${td} != Credit ${tc}).`);
      }

      await conn.query(
        'UPDATE `solar_acc_journal_entries` SET `status` = ?, `total_debit` = ?, `total_credit` = ?, `posted_by` = ?, `posted_at` = ? WHERE `id` = ?',
        ['POSTED', td, tc, String(actor?.name || 'Admin'), new Date().toISOString(), id]
      );
      await this.recalculateAccountBalances(conn);
      await this.logAudit(conn, actor, 'LEDGER', 'POST_JOURNAL', id, je.entry_number, `Posted journal ${je.entry_number} (₹${td.toFixed(2)})`);
      await conn.commit();
      return { id, status: 'POSTED' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async reverseJournalEntry(pool: mysql.Pool, id: string, actor: any, reason?: string): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows]: any = await conn.query('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1', [id]);
      const je = rows?.[0];
      if (!je) throw new Error('Journal entry not found.');
      if (je.status !== 'POSTED') throw new Error('Only POSTED journal entries can be reversed.');

      const revDate = todaySql();
      await this.assertNotLockedDate(conn, revDate);

      const [lines]: any = await conn.query('SELECT * FROM `solar_acc_journal_lines` WHERE `journal_id` = ? ORDER BY `line_order` ASC', [id]);
      const reversedLines = (lines || []).map((l: any) => ({
        accountId: l.account_id,
        description: `Reversal of ${je.entry_number}: ${l.description || ''}`,
        projectId: l.project_id || '',
        projectTitle: l.project_title || '',
        partyType: l.party_type || 'NONE',
        partyId: l.party_id || '',
        partyName: l.party_name || '',
        debit: Number(l.credit) || 0,
        credit: Number(l.debit) || 0
      }));

      const revId = await this.insertAndPostJournalTx(
        conn,
        {
          entryNumber: `REV-${je.entry_number}-${Math.floor(10 + Math.random() * 89)}`,
          entryDate: revDate,
          referenceType: 'REVERSAL',
          referenceId: id,
          referenceNumber: je.entry_number,
          narration: `Reversal of ${je.entry_number}${reason ? ` (${reason})` : ''}: ${je.narration}`,
          status: 'POSTED',
          lines: reversedLines
        },
        actor
      );

      await conn.query('UPDATE `solar_acc_journal_entries` SET `status` = ?, `reversed_entry_id` = ? WHERE `id` = ?', ['REVERSED', revId, id]);
      await this.recalculateAccountBalances(conn);
      await this.logAudit(conn, actor, 'LEDGER', 'REVERSE_JOURNAL', id, je.entry_number, `Reversed journal ${je.entry_number} via ${revId}`);
      await conn.commit();
      return { originalId: id, reversalJournalId: revId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async deleteJournalEntry(pool: mysql.Pool, id: string, actor: any): Promise<void> {
    await this.ensureAccountingSchema(pool);
    const [rows]: any = await pool.query('SELECT * FROM `solar_acc_journal_entries` WHERE `id` = ? LIMIT 1', [id]);
    const je = rows?.[0];
    if (!je) throw new Error('Journal entry not found.');
    if (je.status !== 'DRAFT') {
      throw new Error('Posted or reversed journal entries cannot be deleted for audit compliance. Use Reverse instead.');
    }
    await pool.query('DELETE FROM `solar_acc_journal_entries` WHERE `id` = ?', [id]);
    await this.logAudit(pool, actor, 'LEDGER', 'DELETE_DRAFT_JOURNAL', id, je.entry_number, `Deleted draft journal ${je.entry_number}`);
  }

  public async recordCustomerReceipt(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const amount = round2(data.amount || 0);
    if (amount <= 0) throw new Error('Receipt amount must be greater than zero.');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const paidDate = toSqlDate(data.paidDate || data.receiptDate) || todaySql();
      const dueDate = toSqlDate(data.dueDate) || paidDate;
      const status = data.status === 'PENDING' ? 'PENDING' : 'PAID';
      if (status === 'PAID') {
        await this.assertNotLockedDate(conn, paidDate);
      }

      const id = data.id || `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const receiptNumber = data.receiptNumber || `RCPT-${paidDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 8999)}`;

      let bankCoaId = settings.default_bank_account_id || 'acc-1020';
      if (data.bankAccountId) {
        const [bRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [data.bankAccountId]);
        if (bRows?.[0]) {
          bankCoaId = bRows[0].coa_account_id || (bRows[0].account_type === 'CASH' ? settings.default_cash_account_id : settings.default_bank_account_id);
        }
      } else if (String(data.paymentMode || '').toLowerCase().includes('cash')) {
        bankCoaId = settings.default_cash_account_id || 'acc-1010';
      }

      let invoiceNumber = data.invoiceNumber || '';
      let customerId = data.customerId || '';
      let customerName = data.customerName || 'Solar Customer';
      let projectId = data.projectId || '';

      if (data.invoiceId) {
        const [invRows]: any = await conn.query('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1', [data.invoiceId]);
        const inv = invRows?.[0];
        if (inv) {
          invoiceNumber = inv.invoice_number;
          customerId = customerId || inv.customer_id;
          customerName = customerName === 'Solar Customer' ? inv.customer_name : customerName;
          projectId = projectId || inv.project_id;
          if (status === 'PAID') {
            const newPaid = round2(Number(inv.paid_amount || 0) + amount);
            const total = round2(Number(inv.total_amount || 0));
            const newBal = round2(Math.max(0, total - newPaid));
            const newInvStatus = newBal <= 0.01 ? 'PAID' : 'PARTIAL';
            await conn.query(
              'UPDATE `solar_sales_invoices` SET `paid_amount` = ?, `balance_amount` = ?, `payment_status` = ? WHERE `id` = ?',
              [newPaid, newBal, newInvStatus, inv.id]
            );
          }
        }
      }

      let journalEntryId = '';
      if (status === 'PAID') {
        if (data.bankAccountId) {
          await conn.query(
            'UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?',
            [amount, data.bankAccountId]
          );
        }
        journalEntryId = await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: paidDate,
            referenceType: 'CUSTOMER_RECEIPT',
            referenceId: id,
            referenceNumber: receiptNumber,
            narration: `Customer receipt ${receiptNumber} from ${customerName}${invoiceNumber ? ` against Invoice ${invoiceNumber}` : ''}`,
            status: 'POSTED',
            lines: [
              {
                accountId: bankCoaId,
                description: `${data.paymentMode || 'Bank Receipt'} (${data.transactionReference || receiptNumber})`,
                projectId,
                partyType: 'CUSTOMER',
                partyId: customerId,
                partyName: customerName,
                debit: amount,
                credit: 0
              },
              {
                accountId: settings.default_ar_account_id || 'acc-1100',
                description: `Receivable settlement - ${customerName}`,
                projectId,
                partyType: 'CUSTOMER',
                partyId: customerId,
                partyName: customerName,
                debit: 0,
                credit: amount
              }
            ]
          },
          actor
        );
      }

      await conn.query(
        `INSERT INTO \`solar_payments\`
         (\`id\`, \`receipt_number\`, \`project_id\`, \`customer_id\`, \`customer_name\`, \`milestone\`, \`amount\`, \`status\`, \`due_date\`, \`paid_date\`, \`payment_mode\`, \`transaction_reference\`, \`notes\`, \`invoice_id\`, \`invoice_number\`, \`bank_account_id\`, \`journal_entry_id\`, \`tally_sync_status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT SYNCED')
         ON DUPLICATE KEY UPDATE
           \`status\` = VALUES(\`status\`), \`paid_date\` = VALUES(\`paid_date\`), \`bank_account_id\` = VALUES(\`bank_account_id\`), \`journal_entry_id\` = VALUES(\`journal_entry_id\`)`,
        [
          id,
          receiptNumber,
          projectId,
          customerId,
          customerName,
          data.milestone || (invoiceNumber ? `Against ${invoiceNumber}` : 'Project Milestone'),
          amount,
          status,
          dueDate,
          status === 'PAID' ? paidDate : null,
          data.paymentMode || 'Bank NEFT/RTGS',
          data.transactionReference || '',
          data.notes || '',
          data.invoiceId || '',
          invoiceNumber,
          data.bankAccountId || '',
          journalEntryId
        ]
      );

      await this.logAudit(
        conn,
        actor,
        'CUSTOMER_PAYMENTS',
        'RECORD_RECEIPT',
        id,
        receiptNumber,
        `Recorded receipt ${receiptNumber} from ${customerName} for ₹${amount.toFixed(2)}`
      );

      await conn.commit();
      return { id, receiptNumber, amount, status, journalEntryId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async saveVendorBill(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const id = data.id || `vbill-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const billDate = toSqlDate(data.billDate) || todaySql();
      const dueDate = toSqlDate(data.dueDate) || billDate;
      const billNumber = String(data.billNumber || `${settings.bill_prefix || 'BILL-'}${billDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 8999)}`).trim();

      const items = Array.isArray(data.items) ? data.items : [];
      let subtotal = round2(data.subtotal || 0);
      let gstAmount = round2(data.gstAmount || 0);
      if (items.length > 0) {
        subtotal = round2(items.reduce((s: number, it: any) => s + Number(it.taxableAmount ?? (Number(it.quantity || 1) * Number(it.rate || 0))), 0));
        gstAmount = round2(items.reduce((s: number, it: any) => s + Number(it.gstAmount ?? (Number(it.taxableAmount || 0) * Number(it.gstRate || 0)) / 100), 0));
      }
      const cgstAmount = round2(data.cgstAmount ?? (data.igstAmount > 0 ? 0 : gstAmount / 2));
      const sgstAmount = round2(data.sgstAmount ?? (data.igstAmount > 0 ? 0 : gstAmount / 2));
      const igstAmount = round2(data.igstAmount ?? 0);
      const totalGst = round2(cgstAmount + sgstAmount + igstAmount) || gstAmount;
      const totalAmount = round2(subtotal + totalGst);
      if (totalAmount <= 0) throw new Error('Vendor bill total amount must be greater than zero.');

      const tdsRate = round2(data.tdsRate || 0);
      const tdsAmount = round2(data.tdsAmount ?? (subtotal * tdsRate) / 100);
      const status = data.status === 'DRAFT' ? 'DRAFT' : 'OPEN';
      const expenseAccId = data.expenseAccountId || settings.default_cogs_account_id || 'acc-5010';
      const itcEligible = data.itcEligible !== false;

      const [existingRows]: any = await conn.query('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1', [id]);
      const existing = existingRows?.[0];
      let journalEntryId = existing?.journal_entry_id || '';

      if (status !== 'DRAFT' && !journalEntryId) {
        await this.assertNotLockedDate(conn, billDate);
        const jLines: any[] = [];
        if (itcEligible && totalGst > 0) {
          jLines.push({
            accountId: expenseAccId,
            description: `Vendor Bill ${billNumber} (${data.category || 'Material Purchase'})`,
            projectId: data.projectId || '',
            projectTitle: data.projectTitle || '',
            partyType: 'VENDOR',
            partyId: data.vendorId,
            partyName: data.vendorName,
            debit: subtotal,
            credit: 0
          });
          jLines.push({
            accountId: settings.default_input_gst_account_id || 'acc-1150',
            description: `Input GST ITC - Bill ${billNumber}`,
            projectId: data.projectId || '',
            projectTitle: data.projectTitle || '',
            partyType: 'VENDOR',
            partyId: data.vendorId,
            partyName: data.vendorName,
            debit: totalGst,
            credit: 0
          });
        } else {
          jLines.push({
            accountId: expenseAccId,
            description: `Vendor Bill ${billNumber} (incl. GST)`,
            projectId: data.projectId || '',
            projectTitle: data.projectTitle || '',
            partyType: 'VENDOR',
            partyId: data.vendorId,
            partyName: data.vendorName,
            debit: totalAmount,
            credit: 0
          });
        }
        jLines.push({
          accountId: settings.default_ap_account_id || 'acc-2010',
          description: `Payable to ${data.vendorName} - Bill ${billNumber}`,
          projectId: data.projectId || '',
          projectTitle: data.projectTitle || '',
          partyType: 'VENDOR',
          partyId: data.vendorId,
          partyName: data.vendorName,
          debit: 0,
          credit: totalAmount
        });

        journalEntryId = await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: billDate,
            referenceType: 'VENDOR_BILL',
            referenceId: id,
            referenceNumber: billNumber,
            narration: `Vendor Bill ${billNumber} from ${data.vendorName}${data.poNumber ? ` (PO ${data.poNumber})` : ''}`,
            status: 'POSTED',
            lines: jLines
          },
          actor
        );
      }

      const paidAmount = round2(existing?.paid_amount || 0);
      const balanceAmount = round2(Math.max(0, totalAmount - paidAmount));

      await conn.query(
        `INSERT INTO \`solar_acc_vendor_bills\`
         (\`id\`, \`bill_number\`, \`vendor_id\`, \`vendor_name\`, \`vendor_gst\`, \`po_id\`, \`po_number\`, \`project_id\`, \`project_title\`, \`bill_date\`, \`due_date\`, \`category\`, \`subtotal\`, \`cgst_amount\`, \`sgst_amount\`, \`igst_amount\`, \`gst_amount\`, \`tds_section\`, \`tds_rate\`, \`tds_amount\`, \`total_amount\`, \`paid_amount\`, \`balance_amount\`, \`itc_eligible\`, \`status\`, \`expense_account_id\`, \`journal_entry_id\`, \`notes\`, \`items_json\`, \`created_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`vendor_id\` = VALUES(\`vendor_id\`), \`vendor_name\` = VALUES(\`vendor_name\`), \`vendor_gst\` = VALUES(\`vendor_gst\`),
           \`bill_date\` = VALUES(\`bill_date\`), \`due_date\` = VALUES(\`due_date\`), \`category\` = VALUES(\`category\`),
           \`subtotal\` = VALUES(\`subtotal\`), \`cgst_amount\` = VALUES(\`cgst_amount\`), \`sgst_amount\` = VALUES(\`sgst_amount\`), \`igst_amount\` = VALUES(\`igst_amount\`), \`gst_amount\` = VALUES(\`gst_amount\`),
           \`tds_section\` = VALUES(\`tds_section\`), \`tds_rate\` = VALUES(\`tds_rate\`), \`tds_amount\` = VALUES(\`tds_amount\`),
           \`total_amount\` = VALUES(\`total_amount\`), \`balance_amount\` = VALUES(\`balance_amount\`), \`itc_eligible\` = VALUES(\`itc_eligible\`),
           \`status\` = VALUES(\`status\`), \`expense_account_id\` = VALUES(\`expense_account_id\`), \`journal_entry_id\` = VALUES(\`journal_entry_id\`),
           \`notes\` = VALUES(\`notes\`), \`items_json\` = VALUES(\`items_json\`)`,
        [
          id, billNumber, data.vendorId || '', data.vendorName || 'Vendor', data.vendorGst || '',
          data.poId || '', data.poNumber || '', data.projectId || '', data.projectTitle || '',
          billDate, dueDate, data.category || 'Material Purchase',
          subtotal, cgstAmount, sgstAmount, igstAmount, totalGst,
          data.tdsSection || '', tdsRate, tdsAmount, totalAmount, paidAmount, balanceAmount,
          itcEligible ? 1 : 0, status, expenseAccId, journalEntryId, data.notes || '', JSON.stringify(items),
          String(actor?.name || 'Admin')
        ]
      );

      await this.logAudit(conn, actor, 'VENDOR_PAYMENTS', 'SAVE_VENDOR_BILL', id, billNumber, `Saved Vendor Bill ${billNumber} (${data.vendorName}) for ₹${totalAmount.toFixed(2)}`);
      await conn.commit();
      return { id, billNumber, totalAmount, balanceAmount, status, journalEntryId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async deleteVendorBill(pool: mysql.Pool, id: string, actor: any): Promise<void> {
    await this.ensureAccountingSchema(pool);
    const [rows]: any = await pool.query('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1', [id]);
    const bill = rows?.[0];
    if (!bill) throw new Error('Vendor bill not found.');
    if (bill.status !== 'DRAFT' || Number(bill.paid_amount) > 0) {
      throw new Error('Only unpaid DRAFT vendor bills can be deleted.');
    }
    await pool.query('DELETE FROM `solar_acc_vendor_bills` WHERE `id` = ?', [id]);
    await this.logAudit(pool, actor, 'VENDOR_PAYMENTS', 'DELETE_VENDOR_BILL', id, bill.bill_number, `Deleted draft vendor bill ${bill.bill_number}`);
  }

  public async recordVendorPayment(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const amount = round2(data.amount || 0);
    const tdsDeducted = round2(data.tdsDeducted || 0);
    if (amount <= 0) throw new Error('Gross payment amount must be greater than zero.');
    if (tdsDeducted < 0 || tdsDeducted >= amount) throw new Error('TDS deducted must be >= 0 and less than gross settlement.');
    const netPaid = round2(amount - tdsDeducted);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const payDate = toSqlDate(data.paymentDate) || todaySql();
      await this.assertNotLockedDate(conn, payDate);

      const [billRows]: any = await conn.query('SELECT * FROM `solar_acc_vendor_bills` WHERE `id` = ? LIMIT 1', [data.billId]);
      const bill = billRows?.[0];
      if (!bill) throw new Error('Vendor bill not found.');
      if (bill.status === 'DRAFT') throw new Error('Post/Open the vendor bill before recording payment.');
      if (amount > round2(Number(bill.balance_amount) + 0.01)) {
        throw new Error(`Payment ₹${amount.toFixed(2)} exceeds remaining bill balance ₹${Number(bill.balance_amount).toFixed(2)}.`);
      }

      const [bankRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [data.bankAccountId]);
      const bank = bankRows?.[0];
      if (!bank) throw new Error('Please select a valid Cash/Bank account.');

      const bankCoaId = bank.coa_account_id || (bank.account_type === 'CASH' ? settings.default_cash_account_id : settings.default_bank_account_id);
      const payId = `vpay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const paymentNumber = data.paymentNumber || `VPAY-${payDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 8999)}`;

      const jLines: any[] = [
        {
          accountId: settings.default_ap_account_id || 'acc-2010',
          description: `Settlement of Bill ${bill.bill_number} - ${bill.vendor_name}`,
          projectId: bill.project_id || '',
          projectTitle: bill.project_title || '',
          partyType: 'VENDOR',
          partyId: bill.vendor_id,
          partyName: bill.vendor_name,
          debit: amount,
          credit: 0
        },
        {
          accountId: bankCoaId,
          description: `Paid via ${bank.account_name} (${data.paymentMode || 'NEFT'})`,
          projectId: bill.project_id || '',
          projectTitle: bill.project_title || '',
          partyType: 'VENDOR',
          partyId: bill.vendor_id,
          partyName: bill.vendor_name,
          debit: 0,
          credit: netPaid
        }
      ];

      if (tdsDeducted > 0) {
        jLines.push({
          accountId: settings.default_tds_account_id || 'acc-2150',
          description: `TDS ${data.tdsSection || bill.tds_section || '194C'} deducted from ${bill.vendor_name}`,
          projectId: bill.project_id || '',
          projectTitle: bill.project_title || '',
          partyType: 'VENDOR',
          partyId: bill.vendor_id,
          partyName: bill.vendor_name,
          debit: 0,
          credit: tdsDeducted
        });
      }

      const journalEntryId = await this.insertAndPostJournalTx(
        conn,
        {
          entryDate: payDate,
          referenceType: 'VENDOR_PAYMENT',
          referenceId: payId,
          referenceNumber: paymentNumber,
          narration: `Vendor payment ${paymentNumber} to ${bill.vendor_name} for Bill ${bill.bill_number}`,
          status: 'POSTED',
          lines: jLines
        },
        actor
      );

      await conn.query(
        `INSERT INTO \`solar_acc_vendor_payments\`
         (\`id\`, \`payment_number\`, \`bill_id\`, \`vendor_id\`, \`vendor_name\`, \`payment_date\`, \`amount\`, \`tds_deducted\`, \`net_paid\`, \`bank_account_id\`, \`payment_mode\`, \`reference_no\`, \`notes\`, \`journal_entry_id\`, \`recorded_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId, paymentNumber, bill.id, bill.vendor_id, bill.vendor_name, payDate,
          amount, tdsDeducted, netPaid, bank.id, data.paymentMode || 'Bank NEFT/RTGS',
          data.referenceNo || '', data.notes || '', journalEntryId, String(actor?.name || 'Admin')
        ]
      );

      await conn.query(
        'UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?',
        [netPaid, bank.id]
      );

      const newPaid = round2(Number(bill.paid_amount || 0) + amount);
      const newBal = round2(Math.max(0, Number(bill.total_amount || 0) - newPaid));
      const newStatus = newBal <= 0.01 ? 'PAID' : 'PARTIAL';
      await conn.query(
        'UPDATE `solar_acc_vendor_bills` SET `paid_amount` = ?, `balance_amount` = ?, `status` = ? WHERE `id` = ?',
        [newPaid, newBal, newStatus, bill.id]
      );

      if (bill.po_id) {
        const poPayStatus = newStatus === 'PAID' ? 'PAID' : 'PARTIALLY_PAID';
        await conn.query('UPDATE `solar_purchase_orders` SET `payment_status` = ? WHERE `id` = ?', [poPayStatus, bill.po_id]);
      }

      if (tdsDeducted > 0) {
        const [vRows]: any = await conn.query('SELECT `pan_number` FROM `solar_vendors` WHERE `id` = ? LIMIT 1', [bill.vendor_id]);
        const pan = vRows?.[0]?.pan_number || '';
        const tdsRate = round2((tdsDeducted / Math.max(1, amount)) * 100);
        await conn.query(
          `INSERT INTO \`solar_acc_tds_entries\`
           (\`id\`, \`section\`, \`party_type\`, \`party_id\`, \`party_name\`, \`pan_number\`, \`source_type\`, \`source_id\`, \`source_number\`, \`deduction_date\`, \`gross_amount\`, \`tds_rate\`, \`tds_amount\`, \`status\`)
           VALUES (?, ?, 'VENDOR', ?, ?, ?, 'VENDOR_PAYMENT', ?, ?, ?, ?, ?, ?, 'DEDUCTED')`,
          [
            `tds-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            data.tdsSection || bill.tds_section || '194C',
            bill.vendor_id,
            bill.vendor_name,
            pan,
            payId,
            paymentNumber,
            payDate,
            amount,
            tdsRate,
            tdsDeducted
          ]
        );
      }

      await this.logAudit(
        conn,
        actor,
        'VENDOR_PAYMENTS',
        'RECORD_VENDOR_PAYMENT',
        payId,
        paymentNumber,
        `Paid ₹${netPaid.toFixed(2)} (TDS ₹${tdsDeducted.toFixed(2)}) to ${bill.vendor_name} for Bill ${bill.bill_number}`
      );
      await conn.commit();
      return { id: payId, paymentNumber, amount, tdsDeducted, netPaid, billStatus: newStatus, journalEntryId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async saveBankAccount(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const id = data.id || `bank-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const accountName = String(data.accountName || '').trim();
    if (!accountName) throw new Error('Account name is required.');

    const opening = round2(data.openingBalance || 0);
    const accountType = data.accountType === 'CASH' ? 'CASH' : 'BANK';
    let coaAccountId = data.coaAccountId || (accountType === 'CASH' ? 'acc-1010' : 'acc-1020');

    const [existing]: any = await pool.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [id]);
    const currentBalance = existing?.[0] ? Number(existing[0].current_balance) : opening;

    if (!existing?.[0] && data.createCoaLedger) {
      const code = `10${Math.floor(30 + Math.random() * 69)}`;
      const coaId = `acc-${code}-${Date.now()}`;
      await this.saveAccount(pool, {
        id: coaId,
        code,
        name: accountName,
        accountType: 'ASSET',
        subType: accountType === 'CASH' ? 'Cash' : 'Bank',
        openingBalance: opening,
        isSystem: false,
        isActive: true
      }, actor);
      coaAccountId = coaId;
    }

    if (data.isPrimary) {
      await pool.query('UPDATE `solar_acc_bank_accounts` SET `is_primary` = 0');
    }

    await pool.query(
      `INSERT INTO \`solar_acc_bank_accounts\`
       (\`id\`, \`account_name\`, \`account_type\`, \`bank_name\`, \`account_number\`, \`ifsc_code\`, \`branch\`, \`coa_account_id\`, \`opening_balance\`, \`current_balance\`, \`is_primary\`, \`is_active\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`account_name\` = VALUES(\`account_name\`), \`account_type\` = VALUES(\`account_type\`),
         \`bank_name\` = VALUES(\`bank_name\`), \`account_number\` = VALUES(\`account_number\`),
         \`ifsc_code\` = VALUES(\`ifsc_code\`), \`branch\` = VALUES(\`branch\`),
         \`coa_account_id\` = VALUES(\`coa_account_id\`), \`is_primary\` = VALUES(\`is_primary\`), \`is_active\` = VALUES(\`is_active\`)`,
      [
        id, accountName, accountType, data.bankName || '', data.accountNumber || '',
        data.ifscCode || '', data.branch || '', coaAccountId, opening, currentBalance,
        data.isPrimary ? 1 : 0, data.isActive === false ? 0 : 1
      ]
    );
    await this.logAudit(pool, actor, 'CASH_BANK', existing?.[0] ? 'UPDATE_BANK_ACCOUNT' : 'CREATE_BANK_ACCOUNT', id, accountName, `Saved ${accountType} account: ${accountName}`);
    return { id, accountName, currentBalance };
  }

  public async recordBankTransfer(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const amount = round2(data.amount || 0);
    if (amount <= 0) throw new Error('Transfer amount must be positive.');
    if (!data.fromAccountId || !data.toAccountId || data.fromAccountId === data.toAccountId) {
      throw new Error('Source and destination accounts must be different.');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const transferDate = toSqlDate(data.transferDate) || todaySql();
      await this.assertNotLockedDate(conn, transferDate);

      const [fromRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [data.fromAccountId]);
      const [toRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [data.toAccountId]);
      const fromAcc = fromRows?.[0];
      const toAcc = toRows?.[0];
      if (!fromAcc || !toAcc) throw new Error('Invalid source or destination cash/bank account.');

      const id = `xfer-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const transferNumber = `TRF-${transferDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 8999)}`;

      const fromCoa = fromAcc.coa_account_id || (fromAcc.account_type === 'CASH' ? 'acc-1010' : 'acc-1020');
      const toCoa = toAcc.coa_account_id || (toAcc.account_type === 'CASH' ? 'acc-1010' : 'acc-1020');

      let journalEntryId = '';
      if (fromCoa !== toCoa) {
        journalEntryId = await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: transferDate,
            referenceType: 'CONTRA_TRANSFER',
            referenceId: id,
            referenceNumber: transferNumber,
            narration: `Contra Transfer ${transferNumber}: ${fromAcc.account_name} -> ${toAcc.account_name}`,
            status: 'POSTED',
            lines: [
              { accountId: toCoa, description: `Transfer in from ${fromAcc.account_name}`, debit: amount, credit: 0 },
              { accountId: fromCoa, description: `Transfer out to ${toAcc.account_name}`, debit: 0, credit: amount }
            ]
          },
          actor
        );
      }

      await conn.query(
        'UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?',
        [amount, fromAcc.id]
      );
      await conn.query(
        'UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?',
        [amount, toAcc.id]
      );

      await conn.query(
        `INSERT INTO \`solar_acc_bank_transfers\`
         (\`id\`, \`transfer_number\`, \`transfer_date\`, \`from_account_id\`, \`to_account_id\`, \`amount\`, \`mode\`, \`reference_no\`, \`notes\`, \`journal_entry_id\`, \`created_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, transferNumber, transferDate, fromAcc.id, toAcc.id, amount,
          data.mode || 'Bank Transfer', data.referenceNo || '', data.notes || '', journalEntryId,
          String(actor?.name || 'Admin')
        ]
      );

      await this.logAudit(
        conn,
        actor,
        'CASH_BANK',
        'CONTRA_TRANSFER',
        id,
        transferNumber,
        `Transferred ₹${amount.toFixed(2)} from ${fromAcc.account_name} to ${toAcc.account_name}`
      );
      await conn.commit();
      return { id, transferNumber, amount, journalEntryId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async saveBankReconciliation(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const id = data.id || `brec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const statementDate = toSqlDate(data.statementDate) || todaySql();
    const bookBalance = round2(data.bookBalance || 0);
    const statementBalance = round2(data.statementBalance || 0);
    const difference = round2(statementBalance - bookBalance);
    const status = data.status === 'RECONCILED' ? 'RECONCILED' : 'DRAFT';
    const clearedTxnIds = Array.isArray(data.clearedTxnIds) ? data.clearedTxnIds : [];

    await pool.query(
      `INSERT INTO \`solar_acc_bank_reconciliations\`
       (\`id\`, \`bank_account_id\`, \`statement_date\`, \`book_balance\`, \`statement_balance\`, \`cleared_txn_ids_json\`, \`difference\`, \`status\`, \`notes\`, \`reconciled_by\`, \`reconciled_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`statement_date\` = VALUES(\`statement_date\`), \`book_balance\` = VALUES(\`book_balance\`),
         \`statement_balance\` = VALUES(\`statement_balance\`), \`cleared_txn_ids_json\` = VALUES(\`cleared_txn_ids_json\`),
         \`difference\` = VALUES(\`difference\`), \`status\` = VALUES(\`status\`),
         \`notes\` = VALUES(\`notes\`), \`reconciled_by\` = VALUES(\`reconciled_by\`), \`reconciled_at\` = VALUES(\`reconciled_at\`)`,
      [
        id,
        data.bankAccountId,
        statementDate,
        bookBalance,
        statementBalance,
        JSON.stringify(clearedTxnIds),
        difference,
        status,
        data.notes || '',
        status === 'RECONCILED' ? String(actor?.name || 'Admin') : '',
        status === 'RECONCILED' ? new Date().toISOString() : null
      ]
    );
    await this.logAudit(pool, actor, 'CASH_BANK', 'BANK_RECONCILIATION', id, statementDate, `Saved bank reconciliation (${status}) diff ₹${difference.toFixed(2)}`);
    return { id, difference, status };
  }

  public async saveExpenseWithWorkflow(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const amount = round2(data.amount || 0);
    if (amount <= 0) throw new Error('Expense amount must be positive.');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const id = data.id || `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const expDate = toSqlDate(data.expenseDate || data.date) || todaySql();
      const expNo = data.expenseNumber || `EXP-${expDate.slice(0, 4)}-${Math.floor(1000 + Math.random() * 8999)}`;
      const gstAmount = round2(data.gstAmount || 0);
      const itcEligible = Boolean(data.itcEligible && gstAmount > 0);
      const expenseType = data.expenseType === 'REIMBURSEMENT' ? 'REIMBURSEMENT' : 'DIRECT_EXPENSE';

      let status = data.status || 'PENDING_APPROVAL';
      const needsApproval = Boolean(settings.require_expense_approval) && amount >= Number(settings.approval_threshold || 0);
      if (!data.status) {
        status = (expenseType === 'REIMBURSEMENT' || needsApproval) ? 'PENDING_APPROVAL' : 'APPROVED';
      }

      const expenseAccountId = data.expenseAccountId || (expenseType === 'REIMBURSEMENT' ? 'acc-5040' : 'acc-5050');

      await conn.query(
        `INSERT INTO \`solar_expenses\`
         (\`id\`, \`expense_number\`, \`project_id\`, \`project_code\`, \`vendor_name\`, \`category\`, \`amount\`, \`expense_date\`, \`payment_mode\`, \`reference_no\`, \`notes\`, \`receipt_url\`, \`approved_by\`, \`expense_type\`, \`status\`, \`employee_id\`, \`employee_name\`, \`gst_amount\`, \`itc_eligible\`, \`bank_account_id\`, \`expense_account_id\`, \`tally_sync_status\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT SYNCED')
         ON DUPLICATE KEY UPDATE
           \`project_id\` = VALUES(\`project_id\`), \`vendor_name\` = VALUES(\`vendor_name\`), \`category\` = VALUES(\`category\`),
           \`amount\` = VALUES(\`amount\`), \`expense_date\` = VALUES(\`expense_date\`), \`payment_mode\` = VALUES(\`payment_mode\`),
           \`reference_no\` = VALUES(\`reference_no\`), \`notes\` = VALUES(\`notes\`), \`expense_type\` = VALUES(\`expense_type\`),
           \`employee_id\` = VALUES(\`employee_id\`), \`employee_name\` = VALUES(\`employee_name\`),
           \`gst_amount\` = VALUES(\`gst_amount\`), \`itc_eligible\` = VALUES(\`itc_eligible\`), \`expense_account_id\` = VALUES(\`expense_account_id\`)`,
        [
          id, expNo, data.projectId || '', data.projectCode || '', data.vendorName || data.employeeName || 'General Expense',
          data.category || 'Travel & Food', amount, expDate, data.paymentMode || 'Bank Payment',
          data.referenceNo || '', data.notes || '', data.receiptUrl || '',
          status === 'APPROVED' ? String(actor?.name || 'Auto-Approved') : '',
          expenseType, status, data.employeeId || '', data.employeeName || '',
          gstAmount, itcEligible ? 1 : 0, data.bankAccountId || '', expenseAccountId
        ]
      );

      await this.logAudit(conn, actor, 'EXPENSES', 'SAVE_EXPENSE', id, expNo, `Submitted ${expenseType} ${expNo} for ₹${amount.toFixed(2)} (${status})`);
      await conn.commit();
      return { id, expenseNumber: expNo, status };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async approveOrRejectExpense(pool: mysql.Pool, id: string, decision: 'APPROVED' | 'REJECTED', reason: string, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const [rows]: any = await pool.query('SELECT * FROM `solar_expenses` WHERE `id` = ? LIMIT 1', [id]);
    const exp = rows?.[0];
    if (!exp) throw new Error('Expense record not found.');
    if (exp.status === 'PAID') throw new Error('Paid expenses cannot be rejected.');

    const nowIso = new Date().toISOString();
    await pool.query(
      'UPDATE `solar_expenses` SET `status` = ?, `approved_by` = ?, `approved_at` = ?, `rejection_reason` = ? WHERE `id` = ?',
      [decision, String(actor?.name || 'Admin'), nowIso, decision === 'REJECTED' ? (reason || 'Rejected by Finance') : '', id]
    );
    await this.logAudit(pool, actor, 'EXPENSES', decision === 'APPROVED' ? 'APPROVE_EXPENSE' : 'REJECT_EXPENSE', id, exp.expense_number, `${decision} expense ${exp.expense_number}${reason ? `: ${reason}` : ''}`);
    return { id, status: decision };
  }

  public async payExpense(pool: mysql.Pool, id: string, payload: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const [rows]: any = await conn.query('SELECT * FROM `solar_expenses` WHERE `id` = ? LIMIT 1', [id]);
      const exp = rows?.[0];
      if (!exp) throw new Error('Expense record not found.');
      if (exp.status === 'PAID' && exp.journal_entry_id) {
        throw new Error('This expense has already been paid and posted to the ledger.');
      }
      if (exp.status === 'REJECTED') {
        throw new Error('Rejected expenses cannot be disbursed.');
      }

      const payDate = toSqlDate(payload.paidDate) || toSqlDate(exp.expense_date) || todaySql();
      await this.assertNotLockedDate(conn, payDate);

      const bankId = payload.bankAccountId || exp.bank_account_id || 'bank-main-current';
      const [bankRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [bankId]);
      const bank = bankRows?.[0];
      if (!bank) throw new Error('Valid payment Cash/Bank account is required.');

      const amount = round2(Number(exp.amount || 0));
      const gst = round2(Number(exp.gst_amount || 0));
      const itc = Boolean(exp.itc_eligible && gst > 0 && gst < amount);
      const netExp = itc ? round2(amount - gst) : amount;
      const expAccId = exp.expense_account_id || settings.default_cogs_account_id || 'acc-5040';
      const bankCoaId = bank.coa_account_id || (bank.account_type === 'CASH' ? settings.default_cash_account_id : settings.default_bank_account_id);

      const jLines: any[] = [
        {
          accountId: expAccId,
          description: `${exp.category} - ${exp.vendor_name || exp.employee_name}`,
          projectId: exp.project_id || '',
          partyType: exp.employee_id ? 'EMPLOYEE' : 'VENDOR',
          partyId: exp.employee_id || '',
          partyName: exp.employee_name || exp.vendor_name || '',
          debit: netExp,
          credit: 0
        }
      ];
      if (itc) {
        jLines.push({
          accountId: settings.default_input_gst_account_id || 'acc-1150',
          description: `Input GST Credit - ${exp.expense_number}`,
          projectId: exp.project_id || '',
          debit: gst,
          credit: 0
        });
      }
      jLines.push({
        accountId: bankCoaId,
        description: `Disbursed via ${bank.account_name}`,
        projectId: exp.project_id || '',
        debit: 0,
        credit: amount
      });

      const journalEntryId = await this.insertAndPostJournalTx(
        conn,
        {
          entryDate: payDate,
          referenceType: 'EXPENSE_PAYMENT',
          referenceId: exp.id,
          referenceNumber: exp.expense_number,
          narration: `Expense disbursement ${exp.expense_number} (${exp.category})`,
          status: 'POSTED',
          lines: jLines
        },
        actor
      );

      await conn.query(
        'UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?',
        [amount, bank.id]
      );
      await conn.query(
        'UPDATE `solar_expenses` SET `status` = ?, `bank_account_id` = ?, `journal_entry_id` = ?, `paid_at` = ?, `paid_by` = ?, `approved_by` = COALESCE(NULLIF(`approved_by`, ""), ?) WHERE `id` = ?',
        ['PAID', bank.id, journalEntryId, new Date().toISOString(), String(actor?.name || 'Admin'), String(actor?.name || 'Admin'), id]
      );

      await this.logAudit(conn, actor, 'EXPENSES', 'PAY_EXPENSE', id, exp.expense_number, `Disbursed ₹${amount.toFixed(2)} for ${exp.expense_number} via ${bank.account_name}`);
      await conn.commit();
      return { id, status: 'PAID', journalEntryId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async depositTdsEntry(pool: mysql.Pool, id: string, payload: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const [rows]: any = await conn.query('SELECT * FROM `solar_acc_tds_entries` WHERE `id` = ? LIMIT 1', [id]);
      const tds = rows?.[0];
      if (!tds) throw new Error('TDS entry not found.');
      if (tds.status === 'DEPOSITED') throw new Error('TDS challan is already deposited.');

      const depositDate = toSqlDate(payload.depositDate) || todaySql();
      await this.assertNotLockedDate(conn, depositDate);

      const bankId = payload.bankAccountId || 'bank-main-current';
      const [bankRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [bankId]);
      const bank = bankRows?.[0];
      if (!bank) throw new Error('Select a valid Cash/Bank account for TDS challan payment.');

      const amount = round2(Number(tds.tds_amount || 0));
      const bankCoaId = bank.coa_account_id || settings.default_bank_account_id || 'acc-1020';

      const jeId = await this.insertAndPostJournalTx(
        conn,
        {
          entryDate: depositDate,
          referenceType: 'TDS_CHALLAN',
          referenceId: tds.id,
          referenceNumber: payload.challanNo || tds.source_number,
          narration: `TDS Sec ${tds.section} Challan Deposit (${payload.challanNo || 'Challan'}) for ${tds.party_name}`,
          status: 'POSTED',
          lines: [
            { accountId: settings.default_tds_account_id || 'acc-2150', description: `TDS Sec ${tds.section} remittance`, debit: amount, credit: 0 },
            { accountId: bankCoaId, description: `Challan ${payload.challanNo || ''} via ${bank.account_name}`, debit: 0, credit: amount }
          ]
        },
        actor
      );

      await conn.query('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?', [amount, bank.id]);
      await conn.query(
        'UPDATE `solar_acc_tds_entries` SET `status` = ?, `challan_no` = ?, `bsr_code` = ?, `deposit_date` = ? WHERE `id` = ?',
        ['DEPOSITED', payload.challanNo || '', payload.bsrCode || '', depositDate, id]
      );
      await this.logAudit(conn, actor, 'GST_TAX', 'DEPOSIT_TDS', id, payload.challanNo || tds.id, `Deposited TDS Sec ${tds.section} ₹${amount.toFixed(2)}`);
      await conn.commit();
      return { id, status: 'DEPOSITED', journalEntryId: jeId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async generateEinvoiceIrn(pool: mysql.Pool, invoiceId: string, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const [rows]: any = await pool.query('SELECT * FROM `solar_sales_invoices` WHERE `id` = ? LIMIT 1', [invoiceId]);
    const inv = rows?.[0];
    if (!inv) throw new Error('Sales invoice not found.');
    if (!inv.customer_gst || String(inv.customer_gst).trim().length < 15) {
      throw new Error('Valid 15-character Buyer GSTIN is mandatory for B2B E-Invoice IRN generation.');
    }

    const seed = `${inv.invoice_number}|${inv.customer_gst}|${inv.total_amount}|${inv.invoice_date}`;
    const irn = crypto.createHash('sha256').update(seed).digest('hex');
    const ackNo = `1126${Math.floor(1000000000 + Math.random() * 8999999999)}`;
    const ackDate = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await pool.query(
      'UPDATE `solar_sales_invoices` SET `einvoice_irn` = ?, `einvoice_ack_no` = ?, `einvoice_ack_date` = ?, `einvoice_status` = ? WHERE `id` = ?',
      [irn, ackNo, ackDate, 'GENERATED', invoiceId]
    );
    await this.logAudit(pool, actor, 'GST_TAX', 'GENERATE_EINVOICE', invoiceId, inv.invoice_number, `Generated IRN ${irn.slice(0, 16)}... for ${inv.invoice_number}`);
    return { invoiceId, einvoiceIrn: irn, einvoiceAckNo: ackNo, einvoiceAckDate: ackDate, einvoiceStatus: 'GENERATED' };
  }

  public async saveBudget(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const id = data.id || `bud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const allocatedAmount = round2(data.allocatedAmount || 0);
    if (!data.name || allocatedAmount <= 0) throw new Error('Budget name and positive allocation amount are required.');

    await pool.query(
      `INSERT INTO \`solar_acc_budgets\`
       (\`id\`, \`name\`, \`fiscal_year\`, \`period_type\`, \`period_label\`, \`department\`, \`category\`, \`project_id\`, \`project_title\`, \`account_id\`, \`allocated_amount\`, \`notes\`, \`status\`, \`created_by\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`name\` = VALUES(\`name\`), \`fiscal_year\` = VALUES(\`fiscal_year\`), \`period_type\` = VALUES(\`period_type\`),
         \`period_label\` = VALUES(\`period_label\`), \`department\` = VALUES(\`department\`), \`category\` = VALUES(\`category\`),
         \`project_id\` = VALUES(\`project_id\`), \`project_title\` = VALUES(\`project_title\`), \`account_id\` = VALUES(\`account_id\`),
         \`allocated_amount\` = VALUES(\`allocated_amount\`), \`notes\` = VALUES(\`notes\`), \`status\` = VALUES(\`status\`)`,
      [
        id, data.name, data.fiscalYear || '2026-27', data.periodType || 'ANNUAL', data.periodLabel || 'FY 2026-27',
        data.department || '', data.category || '', data.projectId || '', data.projectTitle || '',
        data.accountId || '', allocatedAmount, data.notes || '', data.status || 'ACTIVE', String(actor?.name || 'Admin')
      ]
    );
    await this.logAudit(pool, actor, 'BUDGETS', data.id ? 'UPDATE_BUDGET' : 'CREATE_BUDGET', id, data.name, `Saved budget "${data.name}" for ₹${allocatedAmount.toFixed(2)}`);
    return { id, allocatedAmount };
  }

  public async deleteBudget(pool: mysql.Pool, id: string, actor: any): Promise<void> {
    await this.ensureAccountingSchema(pool);
    await pool.query('DELETE FROM `solar_acc_budgets` WHERE `id` = ?', [id]);
    await this.logAudit(pool, actor, 'BUDGETS', 'DELETE_BUDGET', id, id, `Deleted budget ${id}`);
  }

  public async saveFixedAsset(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const id = data.id || `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const purchaseCost = round2(data.purchaseCost || 0);
      const salvageValue = round2(data.salvageValue || 0);
      const life = Math.max(1, Number(data.usefulLifeYears) || 5);
      if (!data.name || purchaseCost <= 0) throw new Error('Asset name and positive purchase cost are required.');
      if (salvageValue >= purchaseCost) throw new Error('Salvage value must be less than purchase cost.');

      const method = data.depreciationMethod === 'WDV' ? 'WDV' : 'SLM';
      const depRate = round2(data.depreciationRate || (method === 'SLM' ? (100 / life) : Math.min(60, (200 / life))));
      const purchaseDate = toSqlDate(data.purchaseDate) || todaySql();
      const assetCode = data.assetCode || `AST-${purchaseDate.slice(0, 4)}-${Math.floor(100 + Math.random() * 899)}`;
      const assetAccountId = data.assetAccountId || 'acc-1500';
      const depExpenseAccountId = data.depExpenseAccountId || settings.default_dep_expense_account_id || 'acc-5060';

      const [existingRows]: any = await conn.query('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1', [id]);
      const existing = existingRows?.[0];
      let purchaseJournalId = existing?.purchase_journal_id || null;

      if (!existing && data.postPurchaseJournal && data.paymentBankAccountId) {
        await this.assertNotLockedDate(conn, purchaseDate);
        const [bankRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [data.paymentBankAccountId]);
        const bank = bankRows?.[0];
        if (!bank) throw new Error('Selected payment bank account not found.');
        const bankCoa = bank.coa_account_id || settings.default_bank_account_id || 'acc-1020';

        purchaseJournalId = await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: purchaseDate,
            referenceType: 'ASSET_PURCHASE',
            referenceId: id,
            referenceNumber: assetCode,
            narration: `Capitalization of Fixed Asset ${assetCode} - ${data.name}`,
            status: 'POSTED',
            lines: [
              { accountId: assetAccountId, description: `Asset Acquisition: ${data.name}`, debit: purchaseCost, credit: 0 },
              { accountId: bankCoa, description: `Paid via ${bank.account_name}`, debit: 0, credit: purchaseCost }
            ]
          },
          actor
        );
        await conn.query('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` - ?, 2) WHERE `id` = ?', [purchaseCost, bank.id]);
      }

      const accDep = existing ? Number(existing.accumulated_depreciation) : round2(data.accumulatedDepreciation || 0);
      const bookValue = existing ? Number(existing.book_value) : round2(Math.max(salvageValue, purchaseCost - accDep));

      await conn.query(
        `INSERT INTO \`solar_acc_fixed_assets\`
         (\`id\`, \`asset_code\`, \`name\`, \`category\`, \`purchase_date\`, \`vendor_name\`, \`purchase_cost\`, \`salvage_value\`, \`useful_life_years\`, \`depreciation_method\`, \`depreciation_rate\`, \`accumulated_depreciation\`, \`book_value\`, \`asset_account_id\`, \`dep_expense_account_id\`, \`location\`, \`custodian\`, \`status\`, \`purchase_journal_id\`, \`notes\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
         ON DUPLICATE KEY UPDATE
           \`name\` = VALUES(\`name\`), \`category\` = VALUES(\`category\`), \`vendor_name\` = VALUES(\`vendor_name\`),
           \`location\` = VALUES(\`location\`), \`custodian\` = VALUES(\`custodian\`), \`notes\` = VALUES(\`notes\`)`,
        [
          id, assetCode, data.name, data.category || 'Solar Equipment & Tools', purchaseDate,
          data.vendorName || '', purchaseCost, salvageValue, life, method, depRate, accDep, bookValue,
          assetAccountId, depExpenseAccountId, data.location || '', data.custodian || '', purchaseJournalId, data.notes || ''
        ]
      );

      await this.logAudit(conn, actor, 'ASSETS', existing ? 'UPDATE_ASSET' : 'CREATE_ASSET', id, assetCode, `Saved fixed asset ${assetCode} - ${data.name} (₹${purchaseCost.toFixed(2)})`);
      await conn.commit();
      return { id, assetCode, bookValue };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async runAssetDepreciation(pool: mysql.Pool, assetId: string, payload: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const [rows]: any = await conn.query('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1', [assetId]);
      const asset = rows?.[0];
      if (!asset) throw new Error('Fixed asset not found.');
      if (asset.status !== 'ACTIVE') throw new Error('Cannot depreciate a disposed asset.');

      const runDate = toSqlDate(payload.runDate) || todaySql();
      await this.assertNotLockedDate(conn, runDate);

      const openingBv = round2(Number(asset.book_value));
      const salvage = round2(Number(asset.salvage_value));
      const maxDepreciable = round2(Math.max(0, openingBv - salvage));
      if (maxDepreciable <= 0) {
        throw new Error('Asset has already depreciated down to its salvage value.');
      }

      const months = Math.max(1, Math.min(12, Number(payload.months) || 1));
      let calculatedDep = 0;
      if (payload.customAmount && Number(payload.customAmount) > 0) {
        calculatedDep = round2(payload.customAmount);
      } else if (asset.depreciation_method === 'WDV') {
        const annual = (openingBv * Number(asset.depreciation_rate || 20)) / 100;
        calculatedDep = round2((annual * months) / 12);
      } else {
        const annual = (Number(asset.purchase_cost) - salvage) / Math.max(1, Number(asset.useful_life_years));
        calculatedDep = round2((annual * months) / 12);
      }

      const depAmount = round2(Math.min(maxDepreciable, calculatedDep));
      if (depAmount <= 0) throw new Error('Calculated depreciation is zero.');

      const closingBv = round2(openingBv - depAmount);
      const newAccum = round2(Number(asset.accumulated_depreciation) + depAmount);
      const periodLabel = payload.periodLabel || `${runDate.slice(0, 7)} (${months}m)`;

      const journalEntryId = await this.insertAndPostJournalTx(
        conn,
        {
          entryDate: runDate,
          referenceType: 'ASSET_DEPRECIATION',
          referenceId: asset.id,
          referenceNumber: asset.asset_code,
          narration: `Depreciation (${asset.depreciation_method}) for ${asset.asset_code} - ${asset.name} (${periodLabel})`,
          status: 'POSTED',
          lines: [
            {
              accountId: asset.dep_expense_account_id || settings.default_dep_expense_account_id || 'acc-5060',
              description: `Depreciation Expense - ${asset.name}`,
              debit: depAmount,
              credit: 0
            },
            {
              accountId: 'acc-1590',
              description: `Accumulated Depreciation - ${asset.asset_code}`,
              debit: 0,
              credit: depAmount
            }
          ]
        },
        actor
      );

      const logId = `adep-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await conn.query(
        `INSERT INTO \`solar_acc_asset_depreciation\`
         (\`id\`, \`asset_id\`, \`period_label\`, \`run_date\`, \`opening_book_value\`, \`depreciation_amount\`, \`closing_book_value\`, \`journal_entry_id\`, \`run_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, asset.id, periodLabel, runDate, openingBv, depAmount, closingBv, journalEntryId, String(actor?.name || 'Admin')]
      );

      await conn.query(
        'UPDATE `solar_acc_fixed_assets` SET `accumulated_depreciation` = ?, `book_value` = ?, `last_depreciation_date` = ? WHERE `id` = ?',
        [newAccum, closingBv, runDate, asset.id]
      );

      await this.logAudit(conn, actor, 'ASSETS', 'RUN_DEPRECIATION', asset.id, asset.asset_code, `Posted ₹${depAmount.toFixed(2)} depreciation on ${asset.asset_code} (${periodLabel})`);
      await conn.commit();
      return { id: logId, depreciationAmount: depAmount, closingBookValue: closingBv, journalEntryId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async disposeAsset(pool: mysql.Pool, assetId: string, payload: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const [rows]: any = await conn.query('SELECT * FROM `solar_acc_fixed_assets` WHERE `id` = ? LIMIT 1', [assetId]);
      const asset = rows?.[0];
      if (!asset) throw new Error('Fixed asset not found.');
      if (asset.status === 'DISPOSED') throw new Error('Asset has already been disposed.');

      const disposalDate = toSqlDate(payload.disposalDate) || todaySql();
      await this.assertNotLockedDate(conn, disposalDate);

      const proceeds = round2(payload.disposalProceeds || 0);
      if (proceeds < 0) throw new Error('Disposal proceeds cannot be negative.');
      const cost = round2(Number(asset.purchase_cost));
      const accumDep = round2(Number(asset.accumulated_depreciation));
      const bookValue = round2(Number(asset.book_value));
      const gainLoss = round2(proceeds - bookValue); // positive = gain, negative = loss

      const lines: any[] = [];
      if (proceeds > 0) {
        const bankId = payload.bankAccountId || 'bank-main-current';
        const [bankRows]: any = await conn.query('SELECT * FROM `solar_acc_bank_accounts` WHERE `id` = ? LIMIT 1', [bankId]);
        const bank = bankRows?.[0];
        if (!bank) throw new Error('Valid bank account required to receive disposal proceeds.');
        const bankCoa = bank.coa_account_id || settings.default_bank_account_id || 'acc-1020';
        lines.push({ accountId: bankCoa, description: `Disposal proceeds for ${asset.asset_code}`, debit: proceeds, credit: 0 });
        await conn.query('UPDATE `solar_acc_bank_accounts` SET `current_balance` = ROUND(`current_balance` + ?, 2) WHERE `id` = ?', [proceeds, bank.id]);
      }

      if (accumDep > 0) {
        lines.push({ accountId: 'acc-1590', description: `Write off accumulated depreciation - ${asset.asset_code}`, debit: accumDep, credit: 0 });
      }

      if (gainLoss < 0) {
        lines.push({
          accountId: 'acc-5090',
          description: `Loss on disposal of ${asset.asset_code}`,
          debit: round2(Math.abs(gainLoss)),
          credit: 0
        });
      } else if (gainLoss > 0) {
        lines.push({
          accountId: settings.default_disposal_gain_loss_account_id || 'acc-4090',
          description: `Gain on disposal of ${asset.asset_code}`,
          debit: 0,
          credit: gainLoss
        });
      }

      lines.push({
        accountId: asset.asset_account_id || 'acc-1500',
        description: `Derecognize gross cost of ${asset.asset_code}`,
        debit: 0,
        credit: cost
      });

      const disposalJournalId = await this.insertAndPostJournalTx(
        conn,
        {
          entryDate: disposalDate,
          referenceType: 'ASSET_DISPOSAL',
          referenceId: asset.id,
          referenceNumber: asset.asset_code,
          narration: `Disposal of Asset ${asset.asset_code} - ${asset.name} (${gainLoss >= 0 ? 'Gain' : 'Loss'} ₹${Math.abs(gainLoss).toFixed(2)})`,
          status: 'POSTED',
          lines
        },
        actor
      );

      await conn.query(
        'UPDATE `solar_acc_fixed_assets` SET `status` = ?, `book_value` = 0, `disposal_date` = ?, `disposal_proceeds` = ?, `disposal_gain_loss` = ?, `disposal_journal_id` = ? WHERE `id` = ?',
        ['DISPOSED', disposalDate, proceeds, gainLoss, disposalJournalId, asset.id]
      );

      await this.logAudit(conn, actor, 'ASSETS', 'DISPOSE_ASSET', asset.id, asset.asset_code, `Disposed ${asset.asset_code} for ₹${proceeds.toFixed(2)} (${gainLoss >= 0 ? 'Gain' : 'Loss'} ₹${Math.abs(gainLoss).toFixed(2)})`);
      await conn.commit();
      return { assetId: asset.id, disposalProceeds: proceeds, disposalGainLoss: gainLoss, disposalJournalId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async updateSettings(pool: mysql.Pool, data: any, actor: any): Promise<any> {
    await this.ensureAccountingSchema(pool);
    await pool.query(
      `UPDATE \`solar_acc_settings\` SET
        \`fiscal_year_start_month\` = ?, \`active_fiscal_year\` = ?, \`lock_date\` = ?,
        \`currency\` = ?, \`approval_threshold\` = ?, \`require_expense_approval\` = ?,
        \`auto_post_erp_vouchers\` = ?, \`journal_prefix\` = ?, \`bill_prefix\` = ?, \`voucher_prefix\` = ?,
        \`default_cash_account_id\` = ?, \`default_bank_account_id\` = ?, \`default_ar_account_id\` = ?,
        \`default_ap_account_id\` = ?, \`default_sales_account_id\` = ?, \`default_cogs_account_id\` = ?,
        \`default_output_gst_account_id\` = ?, \`default_input_gst_account_id\` = ?, \`default_tds_account_id\` = ?,
        \`default_payroll_account_id\` = ?, \`default_dep_expense_account_id\` = ?, \`default_disposal_gain_loss_account_id\` = ?,
        \`updated_by\` = ?
       WHERE \`id\` = 'default'`,
      [
        Number(data.fiscalYearStartMonth) || 4,
        data.activeFiscalYear || '2026-27',
        toSqlDate(data.lockDate),
        data.currency || 'INR',
        round2(data.approvalThreshold ?? 10000),
        data.requireExpenseApproval === false ? 0 : 1,
        data.autoPostErpVouchers === false ? 0 : 1,
        data.journalPrefix || 'JV-',
        data.billPrefix || 'BILL-',
        data.voucherPrefix || 'VOU-',
        data.defaultCashAccountId || 'acc-1010',
        data.defaultBankAccountId || 'acc-1020',
        data.defaultArAccountId || 'acc-1100',
        data.defaultApAccountId || 'acc-2010',
        data.defaultSalesAccountId || 'acc-4010',
        data.defaultCogsAccountId || 'acc-5010',
        data.defaultOutputGstAccountId || 'acc-2100',
        data.defaultInputGstAccountId || 'acc-1150',
        data.defaultTdsAccountId || 'acc-2150',
        data.defaultPayrollAccountId || 'acc-5030',
        data.defaultDepExpenseAccountId || 'acc-5060',
        data.defaultDisposalGain_lossAccountId || data.defaultDisposalGainLossAccountId || 'acc-4090',
        String(actor?.name || 'Admin')
      ]
    );
    await this.logAudit(pool, actor, 'SETTINGS', 'UPDATE_SETTINGS', 'default', data.activeFiscalYear || '2026-27', 'Updated Accounting & Finance settings');
    const ws = await this.getWorkspace(pool);
    return ws.settings;
  }

  public async syncErpVouchers(pool: mysql.Pool, actor: any): Promise<{ syncedCount: number; breakdown: Record<string, number> }> {
    await this.ensureAccountingSchema(pool);
    const conn = await pool.getConnection();
    const breakdown = { salesInvoices: 0, customerReceipts: 0, expenses: 0, payslips: 0 };
    try {
      await conn.beginTransaction();
      const settings = await this.getSettingsRow(conn);
      const lockDate = toSqlDate(settings.lock_date);
      const safeDate = (d: any): string => {
        const sql = toSqlDate(d) || todaySql();
        if (lockDate && sql <= lockDate) return todaySql();
        return sql;
      };

      const [existingRefs]: any = await conn.query(
        "SELECT `reference_type`, `reference_id` FROM `solar_acc_journal_entries` WHERE `status` IN ('POSTED', 'REVERSED')"
      );
      const postedKeys = new Set<string>(
        (existingRefs || []).map((r: any) => `${r.reference_type}:${r.reference_id}`)
      );

      // 1. Sales Invoices (non-DRAFT, non-CANCELLED)
      const [invoices]: any = await conn.query(
        "SELECT * FROM `solar_sales_invoices` WHERE `payment_status` NOT IN ('DRAFT', 'CANCELLED')"
      );
      for (const inv of invoices || []) {
        if (postedKeys.has(`SALES_INVOICE:${inv.id}`)) continue;
        const total = round2(Number(inv.total_amount || 0));
        const sub = round2(Number(inv.subtotal || 0));
        const gst = round2(Number(inv.gst_amount || 0));
        if (total <= 0) continue;
        const revAmount = round2(total - gst > 0 ? total - gst : sub);
        const lines: any[] = [
          {
            accountId: settings.default_ar_account_id || 'acc-1100',
            description: `Sales Invoice ${inv.invoice_number} - ${inv.customer_name}`,
            projectId: inv.project_id || '',
            projectTitle: inv.project_title || '',
            partyType: 'CUSTOMER',
            partyId: inv.customer_id,
            partyName: inv.customer_name,
            debit: total,
            credit: 0
          },
          {
            accountId: settings.default_sales_account_id || 'acc-4010',
            description: `Solar EPC Revenue - ${inv.invoice_number}`,
            projectId: inv.project_id || '',
            projectTitle: inv.project_title || '',
            partyType: 'CUSTOMER',
            partyId: inv.customer_id,
            partyName: inv.customer_name,
            debit: 0,
            credit: revAmount
          }
        ];
        if (gst > 0) {
          lines.push({
            accountId: settings.default_output_gst_account_id || 'acc-2100',
            description: `Output GST - ${inv.invoice_number}`,
            projectId: inv.project_id || '',
            debit: 0,
            credit: round2(total - revAmount)
          });
        }
        await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: safeDate(inv.invoice_date),
            referenceType: 'SALES_INVOICE',
            referenceId: inv.id,
            referenceNumber: inv.invoice_number,
            narration: `Sales Invoice ${inv.invoice_number} (${inv.customer_name})`,
            status: 'POSTED',
            lines
          },
          actor
        );
        postedKeys.add(`SALES_INVOICE:${inv.id}`);
        breakdown.salesInvoices++;
      }

      // 2. Customer Receipts (PAID without journal_entry_id)
      const [payments]: any = await conn.query(
        "SELECT * FROM `solar_payments` WHERE `status` = 'PAID' AND (`journal_entry_id` IS NULL OR `journal_entry_id` = '')"
      );
      for (const p of payments || []) {
        if (postedKeys.has(`CUSTOMER_RECEIPT:${p.id}`)) continue;
        const amt = round2(Number(p.amount || 0));
        if (amt <= 0) continue;
        const isCash = String(p.payment_mode || '').toLowerCase().includes('cash');
        const bankCoa = isCash ? (settings.default_cash_account_id || 'acc-1010') : (settings.default_bank_account_id || 'acc-1020');
        const jeId = await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: safeDate(p.paid_date || p.due_date),
            referenceType: 'CUSTOMER_RECEIPT',
            referenceId: p.id,
            referenceNumber: p.receipt_number,
            narration: `Receipt ${p.receipt_number} from ${p.customer_name}`,
            status: 'POSTED',
            lines: [
              { accountId: bankCoa, description: p.payment_mode || 'Receipt', projectId: p.project_id || '', partyType: 'CUSTOMER', partyId: p.customer_id || '', partyName: p.customer_name, debit: amt, credit: 0 },
              { accountId: settings.default_ar_account_id || 'acc-1100', description: p.milestone || 'Customer Receipt', projectId: p.project_id || '', partyType: 'CUSTOMER', partyId: p.customer_id || '', partyName: p.customer_name, debit: 0, credit: amt }
            ]
          },
          actor
        );
        await conn.query('UPDATE `solar_payments` SET `journal_entry_id` = ? WHERE `id` = ?', [jeId, p.id]);
        postedKeys.add(`CUSTOMER_RECEIPT:${p.id}`);
        breakdown.customerReceipts++;
      }

      // 3. Legacy/PAID Expenses without journal_entry_id
      const [expenses]: any = await conn.query(
        "SELECT * FROM `solar_expenses` WHERE (`status` IS NULL OR `status` = '' OR `status` = 'PAID') AND (`journal_entry_id` IS NULL OR `journal_entry_id` = '')"
      );
      for (const ex of expenses || []) {
        if (postedKeys.has(`EXPENSE_PAYMENT:${ex.id}`)) continue;
        const amt = round2(Number(ex.amount || 0));
        if (amt <= 0) continue;
        const isCash = String(ex.payment_mode || '').toLowerCase().includes('cash');
        const bankCoa = isCash ? (settings.default_cash_account_id || 'acc-1010') : (settings.default_bank_account_id || 'acc-1020');
        const jeId = await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: safeDate(ex.expense_date),
            referenceType: 'EXPENSE_PAYMENT',
            referenceId: ex.id,
            referenceNumber: ex.expense_number,
            narration: `Expense ${ex.expense_number} - ${ex.vendor_name} (${ex.category})`,
            status: 'POSTED',
            lines: [
              { accountId: ex.expense_account_id || settings.default_cogs_account_id || 'acc-5040', description: ex.category, projectId: ex.project_id || '', partyType: 'VENDOR', partyName: ex.vendor_name, debit: amt, credit: 0 },
              { accountId: bankCoa, description: ex.payment_mode || 'Bank Payment', projectId: ex.project_id || '', debit: 0, credit: amt }
            ]
          },
          actor
        );
        await conn.query('UPDATE `solar_expenses` SET `status` = ?, `journal_entry_id` = ? WHERE `id` = ?', ['PAID', jeId, ex.id]);
        postedKeys.add(`EXPENSE_PAYMENT:${ex.id}`);
        breakdown.expenses++;
      }

      // 4. Paid Payslips
      const [payslips]: any = await conn.query("SELECT * FROM `solar_payslips` WHERE `status` = 'PAID'");
      for (const ps of payslips || []) {
        if (postedKeys.has(`PAYROLL:${ps.id}`)) continue;
        const net = round2(Number(ps.net_salary || 0));
        if (net <= 0) continue;
        await this.insertAndPostJournalTx(
          conn,
          {
            entryDate: safeDate(ps.payment_date || ps.created_at),
            referenceType: 'PAYROLL',
            referenceId: ps.id,
            referenceNumber: `${ps.month}-${ps.year}`,
            narration: `Payroll disbursement for ${ps.employee_name} (${ps.month} ${ps.year})`,
            status: 'POSTED',
            lines: [
              { accountId: settings.default_payroll_account_id || 'acc-5030', description: `Salary Expense - ${ps.employee_name}`, partyType: 'EMPLOYEE', partyId: ps.employee_id, partyName: ps.employee_name, debit: net, credit: 0 },
              { accountId: settings.default_bank_account_id || 'acc-1020', description: `Salary Paid - ${ps.employee_name}`, partyType: 'EMPLOYEE', partyId: ps.employee_id, partyName: ps.employee_name, debit: 0, credit: net }
            ]
          },
          actor
        );
        postedKeys.add(`PAYROLL:${ps.id}`);
        breakdown.payslips++;
      }

      const syncedCount = breakdown.salesInvoices + breakdown.customerReceipts + breakdown.expenses + breakdown.payslips;
      await this.logAudit(conn, actor, 'LEDGER', 'SYNC_ERP_VOUCHERS', 'erp-sync', `${syncedCount} vouchers`, `Synced ${syncedCount} ERP vouchers into General Ledger`, breakdown);
      await conn.commit();
      return { syncedCount, breakdown };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const accountingService = new AccountingService();
