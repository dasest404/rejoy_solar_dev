import assert from 'assert';
import { accountingService } from '/app/applet/server/services/accountingService';

const DEFAULT_COA = [
  { id: 'acc-1010', code: '1010', name: 'Cash in Hand', account_type: 'ASSET', opening_balance: 0, current_balance: 0 },
  { id: 'acc-1020', code: '1020', name: 'Primary Bank', account_type: 'ASSET', opening_balance: 0, current_balance: 0 },
  { id: 'acc-1100', code: '1100', name: 'Accounts Receivable', account_type: 'ASSET', opening_balance: 0, current_balance: 0 },
  { id: 'acc-1150', code: '1150', name: 'Input GST ITC', account_type: 'ASSET', opening_balance: 0, current_balance: 0 },
  { id: 'acc-2010', code: '2010', name: 'Accounts Payable', account_type: 'LIABILITY', opening_balance: 0, current_balance: 0 },
  { id: 'acc-2100', code: '2100', name: 'Output GST Payable', account_type: 'LIABILITY', opening_balance: 0, current_balance: 0 },
  { id: 'acc-4010', code: '4010', name: 'Solar EPC Revenue', account_type: 'REVENUE', opening_balance: 0, current_balance: 0 },
  { id: 'acc-4030', code: '4030', name: 'Vendor Sales Revenue', account_type: 'REVENUE', opening_balance: 0, current_balance: 0 },
  { id: 'acc-5010', code: '5010', name: 'COGS', account_type: 'EXPENSE', opening_balance: 0, current_balance: 0 },
  { id: 'acc-5030', code: '5030', name: 'Payroll Expense', account_type: 'EXPENSE', opening_balance: 0, current_balance: 0 },
  { id: 'acc-5040', code: '5040', name: 'Operations Expense', account_type: 'EXPENSE', opening_balance: 0, current_balance: 0 }
];

const SCHEMA_COLUMNS: Record<string, string[]> = {
  solar_sales_invoices: ['id', 'invoice_number', 'invoice_date', 'customer_id', 'customer_name', 'project_id', 'project_title', 'subtotal', 'gst_amount', 'total_amount', 'payment_status', 'journal_entry_id'],
  solar_vendor_sales_invoices: ['id', 'invoice_number', 'invoice_date', 'vendor_id', 'vendor_name', 'subtotal', 'gst_amount', 'total_amount', 'payment_status', 'journal_entry_id'],
  solar_payments: ['id', 'receipt_number', 'project_id', 'customer_id', 'customer_name', 'milestone', 'amount', 'status', 'due_date', 'paid_date', 'payment_mode', 'bank_account_id', 'journal_entry_id'],
  solar_vendor_sales_payments: ['id', 'invoice_id', 'vendor_id', 'payment_date', 'amount', 'payment_mode', 'bank_account_id', 'journal_entry_id'],
  solar_expenses: ['id', 'expense_number', 'expense_date', 'vendor_name', 'category', 'amount', 'status', 'payment_mode', 'bank_account_id', 'expense_account_id', 'project_id', 'journal_entry_id'],
  solar_payslips: ['id', 'employee_id', 'employee_name', 'month', 'year', 'net_salary', 'payment_status', 'payment_mode', 'payment_date', 'journal_entry_id', 'created_at']
};

function createMockDb() {
  const db: Record<string, any[]> = {
    solar_acc_accounts: [...DEFAULT_COA.map(a => ({ ...a }))],
    solar_acc_bank_accounts: [
      { id: 'bank-cash-main', account_name: 'Petty Cash', account_type: 'CASH', coa_account_id: 'acc-1010', opening_balance: 0, current_balance: 0, is_primary: 0, is_active: 1 },
      { id: 'bank-main-current', account_name: 'Primary Bank', account_type: 'BANK', coa_account_id: 'acc-1020', opening_balance: 0, current_balance: 0, is_primary: 1, is_active: 1 }
    ],
    solar_acc_settings: [
      {
        id: 'default', fiscal_year_start_month: 4, active_fiscal_year: '2026-27', lock_date: null, currency: 'INR',
        approval_threshold: 10000, require_expense_approval: 1, auto_post_erp_vouchers: 1, journal_prefix: 'JV-',
        bill_prefix: 'BILL-', voucher_prefix: 'VOU-', default_cash_account_id: 'acc-1010', default_bank_account_id: 'acc-1020',
        default_ar_account_id: 'acc-1100', default_ap_account_id: 'acc-2010', default_sales_account_id: 'acc-4010',
        default_cogs_account_id: 'acc-5010', default_output_gst_account_id: 'acc-2100', default_input_gst_account_id: 'acc-1150',
        default_tds_account_id: 'acc-2150', default_payroll_account_id: 'acc-5030'
      }
    ],
    solar_acc_journal_entries: [],
    solar_acc_journal_lines: [],
    solar_acc_audit_logs: [],
    solar_sales_invoices: [{ id: 'inv-1', invoice_number: 'INV-1', invoice_date: '2026-11-10', customer_id: 'c1', customer_name: 'Client', project_id: 'p1', project_title: 'Proj', subtotal: 100000, gst_amount: 13800, total_amount: 113800, payment_status: 'ISSUED', journal_entry_id: '' }],
    solar_vendor_sales_invoices: [{ id: 'vsi-1', invoice_number: 'VSI-1', invoice_date: '2026-11-12', vendor_id: 'v1', vendor_name: 'Vendor', subtotal: 40000, gst_amount: 7200, total_amount: 47200, payment_status: 'UNPAID', journal_entry_id: '' }],
    solar_payments: [{ id: 'pay-1', receipt_number: 'R-1', project_id: 'p1', customer_id: 'c1', customer_name: 'Client', milestone: 'M1', amount: 56900, status: 'PAID', due_date: '2026-11-10', paid_date: '2026-11-12', payment_mode: 'Bank NEFT', bank_account_id: 'bank-main-current', journal_entry_id: '' }],
    solar_vendor_sales_payments: [{ id: 'vsp-1', invoice_id: 'vsi-1', vendor_id: 'v1', payment_date: '2026-11-13', amount: 20000, payment_mode: 'Bank NEFT', bank_account_id: 'bank-main-current', journal_entry_id: '' }],
    solar_expenses: [{ id: 'exp-1', expense_number: 'E-1', expense_date: '2026-11-14', vendor_name: 'Fuel', category: 'Travel', amount: 4500, status: 'PAID', payment_mode: 'Cash', bank_account_id: 'bank-cash-main', expense_account_id: 'acc-5040', project_id: 'p1', journal_entry_id: '' }],
    solar_payslips: [{ id: 'ps-1', employee_id: 'e1', employee_name: 'Rohan', month: 'October', year: 2026, net_salary: 42000, payment_status: 'PAID', payment_mode: 'Bank', payment_date: '2026-11-05', journal_entry_id: '', created_at: '2026-11-05' }]
  };

  async function runQuery(sql: string, params: any[] = []): Promise<any> {
    const trimmed = sql.trim();
    if (/FROM\s+`?solar_payslips`?/i.test(trimmed) && !/^SHOW\s+COLUMNS/i.test(trimmed)) {
      if (/`status`\s*=|\bstatus\s*=/i.test(trimmed)) throw new Error("Unknown column 'status' in 'WHERE'");
    }
    if (/^(CREATE|ALTER)\s+TABLE|^INSERT\s+IGNORE\s+INTO/i.test(trimmed)) return [{ affectedRows: 0 }, []];
    if (/^SHOW\s+COLUMNS\s+FROM\s+`?([a-z0-9_]+)`?/i.test(trimmed)) {
      const m = trimmed.match(/^SHOW\s+COLUMNS\s+FROM\s+`?([a-z0-9_]+)`?/i)!;
      return [(SCHEMA_COLUMNS[m[1]] || []).map(c => ({ Field: c })), []];
    }
    if (/^SELECT\s+COUNT\(\*\)\s+AS\s+cnt\s+FROM\s+`?([a-z0-9_]+)`?/i.test(trimmed)) {
      const m = trimmed.match(/FROM\s+`?([a-z0-9_]+)`?/i)!;
      return [[{ cnt: (db[m[1]] || []).length }], []];
    }
    if (/SELECT\s+`?id`?\s+FROM\s+`?solar_acc_journal_entries`?\s+WHERE\s+`?reference_type`?\s*=\s*'([^']+)'\s+AND\s+`?reference_id`?\s*=\s*\?/i.test(trimmed)) {
      const m = trimmed.match(/reference_type`?\s*=\s*'([^']+)'/i)!;
      const r = db.solar_acc_journal_entries.find(e => e.reference_type === m[1] && e.reference_id === params[0] && (e.status === 'POSTED' || e.status === 'REVERSED'));
      return [r ? [{ id: r.id }] : [], []];
    }
    if (/SELECT\s+`?reference_type`?,\s*`?reference_id`?\s+FROM\s+`?solar_acc_journal_entries`?/i.test(trimmed)) {
      return [db.solar_acc_journal_entries.filter(j => j.status === 'POSTED' || j.status === 'REVERSED').map(j => ({ reference_type: j.reference_type, reference_id: j.reference_id })), []];
    }
    if (/SELECT\s+\*\s+FROM\s+`?solar_acc_settings`?/i.test(trimmed)) return [db.solar_acc_settings, []];
    if (/SELECT\s+`?id`?,\s*`?code`?,\s*`?name`?\s+FROM\s+`?solar_acc_accounts`?/i.test(trimmed)) return [db.solar_acc_accounts.map(a => ({ id: a.id, code: a.code, name: a.name })), []];
    if (/SELECT\s+`?id`?,\s*`?account_type`?,\s*`?opening_balance`?\s+FROM\s+`?solar_acc_accounts`?/i.test(trimmed)) return [db.solar_acc_accounts.map(a => ({ id: a.id, account_type: a.account_type, opening_balance: a.opening_balance })), []];
    if (/SELECT\s+l\.`?account_id`?,\s*SUM\(l\.`?debit`?\)/i.test(trimmed)) return [[], []];
    if (/UPDATE\s+`?solar_acc_accounts`?\s+SET\s+`?current_balance`?/i.test(trimmed)) return [{ affectedRows: 1 }, []];
    if (/SELECT\s+[^;]*FROM\s+`?solar_acc_bank_accounts`?\s+WHERE/i.test(trimmed)) {
      const bank = db.solar_acc_bank_accounts.find(b => b.id === params[0]);
      return [bank ? [{ account_type: bank.account_type, coa_account_id: bank.coa_account_id }] : [], []];
    }
    if (/INSERT\s+INTO\s+`?solar_acc_journal_entries`?/i.test(trimmed)) {
      db.solar_acc_journal_entries.push({ id: params[0], entry_number: params[1], entry_date: params[2], reference_type: params[3], reference_id: params[4], reference_number: params[5], narration: params[6], total_debit: params[7], total_credit: params[8], status: params[9], reversed_entry_id: null, posted_by: params[10], posted_at: params[11], created_by: params[12] });
      return [{ affectedRows: 1 }, []];
    }
    if (/INSERT\s+INTO\s+`?solar_acc_journal_lines`?/i.test(trimmed)) {
      db.solar_acc_journal_lines.push({ id: params[0], journal_id: params[1], line_order: params[2], account_id: params[3], account_code: params[4], account_name: params[5], description: params[6], debit: params[12], credit: params[13] });
      return [{ affectedRows: 1 }, []];
    }
    if (/INSERT\s+INTO\s+`?solar_acc_audit_logs`?/i.test(trimmed)) return [{ affectedRows: 1 }, []];
    if (/SELECT\s+\*\s+FROM\s+`?solar_sales_invoices`?/i.test(trimmed)) return [db.solar_sales_invoices, []];
    if (/SELECT\s+\*\s+FROM\s+`?solar_vendor_sales_invoices`?/i.test(trimmed)) return [db.solar_vendor_sales_invoices, []];
    if (/SELECT\s+\*\s+FROM\s+`?solar_payments`?/i.test(trimmed)) return [db.solar_payments.filter(p => !p.journal_entry_id), []];
    if (/UPDATE\s+`?solar_payments`?/i.test(trimmed)) return [{ affectedRows: 1 }, []];
    if (/FROM\s+`?solar_vendor_sales_payments`?/i.test(trimmed)) return [db.solar_vendor_sales_payments, []];
    if (/UPDATE\s+`?solar_vendor_sales_payments`?/i.test(trimmed)) return [{ affectedRows: 1 }, []];
    if (/SELECT\s+\*\s+FROM\s+`?solar_expenses`?/i.test(trimmed)) return [db.solar_expenses, []];
    if (/UPDATE\s+`?solar_expenses`?/i.test(trimmed)) return [{ affectedRows: 1 }, []];
    if (/SELECT\s+\*\s+FROM\s+`?solar_payslips`?/i.test(trimmed)) return [db.solar_payslips, []];
    if (/UPDATE\s+`?solar_payslips`?/i.test(trimmed)) return [{ affectedRows: 1 }, []];
    if (/SELECT\s+\*\s+FROM\s+`?solar_acc_journal_entries`?\s+WHERE\s+`?id`?\s*=\s*\?/i.test(trimmed)) {
      const r = db.solar_acc_journal_entries.find(e => e.id === params[0]);
      return [r ? [r] : [], []];
    }
    if (/SELECT\s+`?id`?,\s*`?entry_number`?\s+FROM\s+`?solar_acc_journal_entries`?\s+WHERE\s+`?reference_type`?\s*=\s*'REVERSAL'/i.test(trimmed)) {
      const r = db.solar_acc_journal_entries.find(e => e.reference_type === 'REVERSAL' && e.reference_id === params[0]);
      return [r ? [{ id: r.id, entry_number: r.entry_number }] : [], []];
    }
    if (/SELECT\s+\*\s+FROM\s+`?solar_acc_journal_lines`?\s+WHERE\s+`?journal_id`?\s*=\s*\?/i.test(trimmed)) {
      return [db.solar_acc_journal_lines.filter(l => l.journal_id === params[0]), []];
    }
    if (/UPDATE\s+`?solar_acc_journal_entries`?\s+SET\s+`?status`?\s*=\s*'REVERSED'/i.test(trimmed)) {
      const je = db.solar_acc_journal_entries.find(e => e.id === params[1] && e.status === 'POSTED' && !e.reversed_entry_id);
      if (je) { je.status = 'REVERSED'; je.reversed_entry_id = params[0]; return [{ affectedRows: 1 }, []]; }
      return [{ affectedRows: 0 }, []];
    }
    throw new Error(`Unhandled SQL: ${trimmed}`);
  }

  let snap: string | null = null;
  const conn: any = {
    query: runQuery,
    beginTransaction: async () => { snap = JSON.stringify(db); },
    commit: async () => { snap = null; },
    rollback: async () => { if (snap) { Object.assign(db, JSON.parse(snap)); snap = null; } },
    release: () => {}
  };
  return { db, pool: { query: runQuery, getConnection: async () => conn } as any };
}

async function main() {
  const actor = { id: 'u1', name: 'Admin', role: 'Admin' };
  const { db, pool } = createMockDb();
  const s1 = await accountingService.syncErpVouchers(pool, actor);
  assert.strictEqual(s1.syncedCount, 6);
  const s2 = await accountingService.syncErpVouchers(pool, actor);
  assert.strictEqual(s2.syncedCount, 0);
  const jeId = db.solar_acc_journal_entries[0].id;
  const rev = await accountingService.reverseJournalEntry(pool, jeId, actor);
  let err1: any;
  try { await accountingService.reverseJournalEntry(pool, jeId, actor); } catch (e) { err1 = e; }
  assert.strictEqual(err1?.statusCode, 409);
  let err2: any;
  try { await accountingService.reverseJournalEntry(pool, rev.reversalJournalId, actor); } catch (e) { err2 = e; }
  assert.strictEqual(err2?.statusCode, 409);
  console.log('ALL FINAL BACKEND VERIFICATION CHECKS PASSED (INCLUDING REVERSAL GUARD)');
}

main().catch(e => { console.error(e); process.exit(1); });
