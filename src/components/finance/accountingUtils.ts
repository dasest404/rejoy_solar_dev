import {
  AccountType,
  ChartAccount,
  JournalEntry,
  BankAccount,
  VendorBill,
  BudgetRecord,
  FixedAsset,
  PaymentRecord,
  ExpenseRecord,
  SalesInvoice,
  VendorSalesInvoice,
  PurchaseOrder,
  BillOfMaterials,
  SolarProject
} from '../../types/solar';

export const round2 = (n: number): number => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const formatINR = (amount: number, showSign = false): string => {
  const num = round2(Number(amount || 0));
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (num < 0) return `-₹${formatted}`;
  if (showSign && num > 0) return `+₹${formatted}`;
  return `₹${formatted}`;
};

export const formatDateIN = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const clean = String(dateStr).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const isDebitNormalAccount = (type: AccountType): boolean =>
  type === 'ASSET' || type === 'EXPENSE';

export const getPostedJournals = (journals: JournalEntry[]): JournalEntry[] =>
  (journals || []).filter(j => j.status === 'POSTED');

// ========================
// GENERAL LEDGER
// ========================
export interface LedgerRow {
  lineId: string;
  journalId: string;
  entryNumber: string;
  entryDate: string;
  referenceNumber: string;
  narration: string;
  partyName: string;
  projectTitle: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceOrientation: 'Dr' | 'Cr';
}

export interface AccountLedgerResult {
  account: ChartAccount;
  openingBalance: number;
  openingOrientation: 'Dr' | 'Cr';
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingOrientation: 'Dr' | 'Cr';
}

export function buildAccountLedger(
  account: ChartAccount,
  journals: JournalEntry[],
  startDate?: string,
  endDate?: string
): AccountLedgerResult {
  const debitNormal = isDebitNormalAccount(account.accountType);
  const posted = getPostedJournals(journals)
    .slice()
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.entryNumber.localeCompare(b.entryNumber));

  // Track signed balance in normal orientation (+ means normal balance for the account)
  let signedOpening = round2(Number(account.openingBalance || 0));
  let runningSigned = signedOpening;
  let runningInitialized = false;
  const rows: LedgerRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  // Compute movement prior to startDate to roll forward opening balance
  for (const j of posted) {
    for (const line of j.lines || []) {
      if (line.accountId !== account.id) continue;
      const dr = round2(Number(line.debit || 0));
      const cr = round2(Number(line.credit || 0));
      const delta = debitNormal ? dr - cr : cr - dr;

      if (startDate && j.entryDate < startDate) {
        signedOpening = round2(signedOpening + delta);
        runningSigned = signedOpening;
        continue;
      }
      if (endDate && j.entryDate > endDate) {
        continue;
      }

      if (!runningInitialized) {
        runningSigned = signedOpening;
        runningInitialized = true;
      }
      totalDebit = round2(totalDebit + dr);
      totalCredit = round2(totalCredit + cr);
      const nextSigned = round2(runningSigned + delta);
      runningSigned = nextSigned;
      const orientation: 'Dr' | 'Cr' = debitNormal
        ? nextSigned >= 0 ? 'Dr' : 'Cr'
        : nextSigned >= 0 ? 'Cr' : 'Dr';

      rows.push({
        lineId: line.id,
        journalId: j.id,
        entryNumber: j.entryNumber,
        entryDate: j.entryDate,
        referenceNumber: j.referenceNumber || '',
        narration: line.description || j.narration || '',
        partyName: line.partyName || '',
        projectTitle: line.projectTitle || '',
        debit: dr,
        credit: cr,
        runningBalance: Math.abs(nextSigned),
        balanceOrientation: orientation
      });
    }
  }

  const closingSigned = rows.length > 0 ? runningSigned : signedOpening;

  const openingOrientation: 'Dr' | 'Cr' = debitNormal
    ? signedOpening >= 0 ? 'Dr' : 'Cr'
    : signedOpening >= 0 ? 'Cr' : 'Dr';

  const closingOrientation: 'Dr' | 'Cr' = debitNormal
    ? closingSigned >= 0 ? 'Dr' : 'Cr'
    : closingSigned >= 0 ? 'Cr' : 'Dr';

  return {
    account,
    openingBalance: Math.abs(signedOpening),
    openingOrientation,
    rows,
    totalDebit,
    totalCredit,
    closingBalance: Math.abs(closingSigned),
    closingOrientation
  };
}

// ========================
// TRIAL BALANCE
// ========================
export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  subType: string;
  openingSigned: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
}

export function buildTrialBalance(
  accounts: ChartAccount[],
  journals: JournalEntry[],
  asOfDate?: string
): TrialBalanceResult {
  const posted = getPostedJournals(journals).filter(j => !asOfDate || j.entryDate <= asOfDate);

  const movMap = new Map<string, { dr: number; cr: number }>();
  for (const j of posted) {
    for (const line of j.lines || []) {
      const prev = movMap.get(line.accountId) || { dr: 0, cr: 0 };
      prev.dr = round2(prev.dr + Number(line.debit || 0));
      prev.cr = round2(prev.cr + Number(line.credit || 0));
      movMap.set(line.accountId, prev);
    }
  }

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of (accounts || []).slice().sort((a, b) => a.code.localeCompare(b.code))) {
    const mov = movMap.get(acc.id) || { dr: 0, cr: 0 };
    const ob = round2(Number(acc.openingBalance || 0));
    const debitNormal = isDebitNormalAccount(acc.accountType);

    // Express everything as signed debit (+) / credit (-)
    const obNet = debitNormal ? ob : -ob;
    const net = round2(obNet + mov.dr - mov.cr);

    if (Math.abs(net) < 0.005 && mov.dr === 0 && mov.cr === 0 && ob === 0) {
      continue;
    }

    const closingDebit = net > 0 ? round2(net) : 0;
    const closingCredit = net < 0 ? round2(Math.abs(net)) : 0;

    totalDebit = round2(totalDebit + closingDebit);
    totalCredit = round2(totalCredit + closingCredit);

    rows.push({
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      accountType: acc.accountType,
      subType: acc.subType,
      openingSigned: obNet,
      periodDebit: mov.dr,
      periodCredit: mov.cr,
      closingDebit,
      closingCredit
    });
  }

  const difference = round2(Math.abs(totalDebit - totalCredit));
  return {
    rows,
    totalDebit,
    totalCredit,
    difference,
    isBalanced: difference < 0.05
  };
}

// ========================
// PROFIT & LOSS STATEMENT
// ========================
export interface StatementLine {
  accountId: string;
  code: string;
  name: string;
  subType: string;
  amount: number;
}

export interface ProfitAndLossResult {
  revenueLines: StatementLine[];
  cogsLines: StatementLine[];
  operatingExpenseLines: StatementLine[];
  depreciationLines: StatementLine[];
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalOperatingExpenses: number;
  totalDepreciation: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}

export function buildProfitAndLoss(
  accounts: ChartAccount[],
  journals: JournalEntry[],
  startDate?: string,
  endDate?: string
): ProfitAndLossResult {
  const posted = getPostedJournals(journals).filter(
    j => (!startDate || j.entryDate >= startDate) && (!endDate || j.entryDate <= endDate)
  );

  const movMap = new Map<string, { dr: number; cr: number }>();
  for (const j of posted) {
    for (const line of j.lines || []) {
      const prev = movMap.get(line.accountId) || { dr: 0, cr: 0 };
      prev.dr = round2(prev.dr + Number(line.debit || 0));
      prev.cr = round2(prev.cr + Number(line.credit || 0));
      movMap.set(line.accountId, prev);
    }
  }

  const revenueLines: StatementLine[] = [];
  const cogsLines: StatementLine[] = [];
  const operatingExpenseLines: StatementLine[] = [];
  const depreciationLines: StatementLine[] = [];

  for (const acc of (accounts || []).slice().sort((a, b) => a.code.localeCompare(b.code))) {
    if (acc.accountType !== 'REVENUE' && acc.accountType !== 'EXPENSE') continue;
    const mov = movMap.get(acc.id) || { dr: 0, cr: 0 };
    const ob = !startDate ? Number(acc.openingBalance || 0) : 0;

    if (acc.accountType === 'REVENUE') {
      const amount = round2(ob + mov.cr - mov.dr);
      if (Math.abs(amount) >= 0.01) {
        revenueLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
      }
    } else {
      const amount = round2(ob + mov.dr - mov.cr);
      if (Math.abs(amount) >= 0.01) {
        const sub = (acc.subType || '').toLowerCase();
        if (sub.includes('cogs') || sub.includes('direct') || acc.code.startsWith('500')) {
          cogsLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
        } else if (sub.includes('depreciation') || acc.name.toLowerCase().includes('depreciation')) {
          depreciationLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
        } else {
          operatingExpenseLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
        }
      }
    }
  }

  const totalRevenue = round2(revenueLines.reduce((s, r) => s + r.amount, 0));
  const totalCogs = round2(cogsLines.reduce((s, r) => s + r.amount, 0));
  const grossProfit = round2(totalRevenue - totalCogs);
  const grossMarginPercent = totalRevenue > 0 ? round2((grossProfit / totalRevenue) * 100) : 0;
  const totalOperatingExpenses = round2(operatingExpenseLines.reduce((s, r) => s + r.amount, 0));
  const totalDepreciation = round2(depreciationLines.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = round2(totalCogs + totalOperatingExpenses + totalDepreciation);
  const netProfit = round2(totalRevenue - totalExpenses);
  const netMarginPercent = totalRevenue > 0 ? round2((netProfit / totalRevenue) * 100) : 0;

  return {
    revenueLines,
    cogsLines,
    operatingExpenseLines,
    depreciationLines,
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPercent,
    totalOperatingExpenses,
    totalDepreciation,
    totalExpenses,
    netProfit,
    netMarginPercent
  };
}

// ========================
// BALANCE SHEET
// ========================
export interface BalanceSheetResult {
  assetLines: StatementLine[];
  liabilityLines: StatementLine[];
  equityLines: StatementLine[];
  currentPeriodNetProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
  isBalanced: boolean;
}

export function buildBalanceSheet(
  accounts: ChartAccount[],
  journals: JournalEntry[],
  asOfDate?: string
): BalanceSheetResult {
  const tb = buildTrialBalance(accounts, journals, asOfDate);
  const pnl = buildProfitAndLoss(accounts, journals, undefined, asOfDate);

  const tbMap = new Map(tb.rows.map(r => [r.accountId, r]));
  const assetLines: StatementLine[] = [];
  const liabilityLines: StatementLine[] = [];
  const equityLines: StatementLine[] = [];

  for (const acc of (accounts || []).slice().sort((a, b) => a.code.localeCompare(b.code))) {
    const row = tbMap.get(acc.id);
    if (!row) continue;

    if (acc.accountType === 'ASSET') {
      const amount = round2(row.closingDebit - row.closingCredit);
      if (Math.abs(amount) >= 0.01) {
        assetLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
      }
    } else if (acc.accountType === 'LIABILITY') {
      const amount = round2(row.closingCredit - row.closingDebit);
      if (Math.abs(amount) >= 0.01) {
        liabilityLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
      }
    } else if (acc.accountType === 'EQUITY') {
      const amount = round2(row.closingCredit - row.closingDebit);
      if (Math.abs(amount) >= 0.01) {
        equityLines.push({ accountId: acc.id, code: acc.code, name: acc.name, subType: acc.subType, amount });
      }
    }
  }

  // Note: If Trial Balance includes unbalanced opening balances (e.g., initial Cash/Bank before contra Equity opening balance),
  // keep track transparently via difference.
  const totalAssets = round2(assetLines.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = round2(liabilityLines.reduce((s, r) => s + r.amount, 0));
  const baseEquity = round2(equityLines.reduce((s, r) => s + r.amount, 0));
  const totalEquity = round2(baseEquity + pnl.netProfit);
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  const difference = round2(totalAssets - totalLiabilitiesAndEquity);

  return {
    assetLines,
    liabilityLines,
    equityLines,
    currentPeriodNetProfit: pnl.netProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    isBalanced: Math.abs(difference) < 0.05
  };
}

// ========================
// CASH FLOW STATEMENT (Direct Ledger Method)
// ========================
export interface CashFlowResult {
  operatingInflows: number;
  operatingOutflows: number;
  netOperatingCashFlow: number;
  investingInflows: number;
  investingOutflows: number;
  netInvestingCashFlow: number;
  financingInflows: number;
  financingOutflows: number;
  netFinancingCashFlow: number;
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
  monthlyTrend: { month: string; label: string; inflow: number; outflow: number; net: number }[];
}

export function buildCashFlowStatement(
  accounts: ChartAccount[],
  bankAccounts: BankAccount[],
  journals: JournalEntry[],
  startDate?: string,
  endDate?: string
): CashFlowResult {
  const cashCoaIds = new Set<string>(
    (accounts || [])
      .filter(
        a =>
          a.accountType === 'ASSET' &&
          (a.subType.toLowerCase().includes('cash') ||
            a.subType.toLowerCase().includes('bank') ||
            a.code === '1010' ||
            a.code === '1020')
      )
      .map(a => a.id)
  );
  (bankAccounts || []).forEach(b => {
    if (b.coaAccountId) cashCoaIds.add(b.coaAccountId);
  });

  const accById = new Map((accounts || []).map(a => [a.id, a]));
  const posted = getPostedJournals(journals);

  // Opening cash balance: CoA opening balances + movements before startDate
  let openingCashBalance = (accounts || [])
    .filter(a => cashCoaIds.has(a.id))
    .reduce((s, a) => s + Number(a.openingBalance || 0), 0);

  let operatingInflows = 0;
  let operatingOutflows = 0;
  let investingInflows = 0;
  let investingOutflows = 0;
  let financingInflows = 0;
  let financingOutflows = 0;

  const monthlyMap = new Map<string, { inflow: number; outflow: number }>();

  for (const j of posted) {
    const cashLines = (j.lines || []).filter(l => cashCoaIds.has(l.accountId));
    if (cashLines.length === 0) continue;

    const cashDelta = cashLines.reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);

    if (startDate && j.entryDate < startDate) {
      openingCashBalance = round2(openingCashBalance + cashDelta);
      continue;
    }
    if (endDate && j.entryDate > endDate) {
      continue;
    }

    // Check if contra transfer (only cash/bank accounts involved)
    const nonCashLines = (j.lines || []).filter(l => !cashCoaIds.has(l.accountId));
    if (nonCashLines.length === 0) {
      // Internal contra transfer doesn't change total cash balance
      continue;
    }

    // Classify cash impact by counterpart accounts
    const hasFixedAssetCounterpart = nonCashLines.some(l => {
      const a = accById.get(l.accountId);
      return a && a.accountType === 'ASSET' && a.subType.toLowerCase().includes('fixed');
    });
    const hasEquityOrLoanCounterpart = nonCashLines.some(l => {
      const a = accById.get(l.accountId);
      return a && (a.accountType === 'EQUITY' || a.subType.toLowerCase().includes('loan'));
    });

    const absAmt = Math.abs(round2(cashDelta));
    if (hasFixedAssetCounterpart) {
      if (cashDelta >= 0) investingInflows = round2(investingInflows + absAmt);
      else investingOutflows = round2(investingOutflows + absAmt);
    } else if (hasEquityOrLoanCounterpart) {
      if (cashDelta >= 0) financingInflows = round2(financingInflows + absAmt);
      else financingOutflows = round2(financingOutflows + absAmt);
    } else {
      if (cashDelta >= 0) operatingInflows = round2(operatingInflows + absAmt);
      else operatingOutflows = round2(operatingOutflows + absAmt);
    }

    const monthKey = (j.entryDate || '').slice(0, 7);
    if (monthKey) {
      const m = monthlyMap.get(monthKey) || { inflow: 0, outflow: 0 };
      if (cashDelta >= 0) m.inflow = round2(m.inflow + absAmt);
      else m.outflow = round2(m.outflow + absAmt);
      monthlyMap.set(monthKey, m);
    }
  }

  const netOperatingCashFlow = round2(operatingInflows - operatingOutflows);
  const netInvestingCashFlow = round2(investingInflows - investingOutflows);
  const netFinancingCashFlow = round2(financingInflows - financingOutflows);
  const netCashChange = round2(netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow);
  const closingCashBalance = round2(openingCashBalance + netCashChange);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, val]) => {
      const [y, m] = month.split('-');
      const idx = Math.max(0, Math.min(11, Number(m) - 1));
      return {
        month,
        label: `${monthNames[idx]} ${y.slice(2)}`,
        inflow: val.inflow,
        outflow: val.outflow,
        net: round2(val.inflow - val.outflow)
      };
    });

  return {
    operatingInflows,
    operatingOutflows,
    netOperatingCashFlow,
    investingInflows,
    investingOutflows,
    netInvestingCashFlow,
    financingInflows,
    financingOutflows,
    netFinancingCashFlow,
    netCashChange,
    openingCashBalance: round2(openingCashBalance),
    closingCashBalance,
    monthlyTrend
  };
}

// ========================
// AGEING REPORTS
// ========================
export interface AgeingPartyRow {
  partyName: string;
  partyType: 'CUSTOMER' | 'VENDOR';
  docCount: number;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
}

const daysBetween = (dueDateStr: string, asOfDateStr: string): number => {
  const d1 = new Date(`${dueDateStr.slice(0, 10)}T00:00:00Z`).getTime();
  const d2 = new Date(`${asOfDateStr.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

export function buildReceivablesAgeing(
  salesInvoices: SalesInvoice[],
  vendorSalesInvoices: VendorSalesInvoice[],
  payments: PaymentRecord[],
  asOfDate = new Date().toISOString().slice(0, 10)
): { rows: AgeingPartyRow[]; totals: Omit<AgeingPartyRow, 'partyName' | 'partyType'> } {
  const map = new Map<string, AgeingPartyRow>();

  const addBucket = (partyName: string, partyType: 'CUSTOMER' | 'VENDOR', dueDate: string, amount: number) => {
    if (amount <= 0.01) return;
    const key = `${partyType}:${partyName}`;
    const existing = map.get(key) || {
      partyName,
      partyType,
      docCount: 0,
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      totalOutstanding: 0
    };
    const overdue = daysBetween(dueDate || asOfDate, asOfDate);
    if (overdue <= 0) existing.current = round2(existing.current + amount);
    else if (overdue <= 30) existing.days1_30 = round2(existing.days1_30 + amount);
    else if (overdue <= 60) existing.days31_60 = round2(existing.days31_60 + amount);
    else if (overdue <= 90) existing.days61_90 = round2(existing.days61_90 + amount);
    else existing.days90Plus = round2(existing.days90Plus + amount);

    existing.docCount += 1;
    existing.totalOutstanding = round2(existing.totalOutstanding + amount);
    map.set(key, existing);
  };

  // Compute linked paid amounts for customer invoices when paidAmount is not stored directly
  const paidByInv = new Map<string, number>();
  for (const p of payments || []) {
    if (p.status === 'PAID' && p.invoiceId) {
      paidByInv.set(p.invoiceId, round2((paidByInv.get(p.invoiceId) || 0) + Number(p.amount || 0)));
    }
  }

  for (const inv of salesInvoices || []) {
    if (inv.status === 'CANCELLED' || inv.status === 'DRAFT' || inv.status === 'PAID') continue;
    const paid = Number(inv.paidAmount ?? paidByInv.get(inv.id) ?? 0);
    const bal = inv.balanceAmount != null ? Number(inv.balanceAmount) : round2(Number(inv.totalAmount || 0) - paid);
    if (bal > 0.01) {
      addBucket(inv.customerName || 'Customer', 'CUSTOMER', inv.dueDate || inv.invoiceDate, bal);
    }
  }

  // Also include pending/overdue milestone payment records without linked invoice
  for (const p of payments || []) {
    if (!p.invoiceId && (p.status === 'PENDING' || p.status === 'OVERDUE' || p.status === 'PARTIAL')) {
      addBucket(p.customerName || 'Customer', 'CUSTOMER', p.dueDate, Number(p.amount || 0));
    }
  }

  for (const vsi of vendorSalesInvoices || []) {
    if (vsi.status === 'DRAFT' || vsi.status === 'PAID') continue;
    const bal = Number(vsi.balanceAmount ?? Math.max(0, Number(vsi.totalAmount || 0) - Number(vsi.paidAmount || 0)));
    if (bal > 0.01) {
      addBucket(vsi.vendorName || 'Vendor', 'VENDOR', vsi.dueDate || vsi.invoiceDate, bal);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  const totals = rows.reduce(
    (acc, r) => ({
      docCount: acc.docCount + r.docCount,
      current: round2(acc.current + r.current),
      days1_30: round2(acc.days1_30 + r.days1_30),
      days31_60: round2(acc.days31_60 + r.days31_60),
      days61_90: round2(acc.days61_90 + r.days61_90),
      days90Plus: round2(acc.days90Plus + r.days90Plus),
      totalOutstanding: round2(acc.totalOutstanding + r.totalOutstanding)
    }),
    { docCount: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, totalOutstanding: 0 }
  );
  return { rows, totals };
}

export function buildPayablesAgeing(
  vendorBills: VendorBill[],
  purchaseOrders: PurchaseOrder[],
  asOfDate = new Date().toISOString().slice(0, 10)
): { rows: AgeingPartyRow[]; totals: Omit<AgeingPartyRow, 'partyName' | 'partyType'> } {
  const map = new Map<string, AgeingPartyRow>();
  const billedPoIds = new Set((vendorBills || []).map(b => b.poId).filter(Boolean) as string[]);

  const addBucket = (vendorName: string, dueDate: string, amount: number) => {
    if (amount <= 0.01) return;
    const existing = map.get(vendorName) || {
      partyName: vendorName,
      partyType: 'VENDOR' as const,
      docCount: 0,
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      totalOutstanding: 0
    };
    const overdue = daysBetween(dueDate || asOfDate, asOfDate);
    if (overdue <= 0) existing.current = round2(existing.current + amount);
    else if (overdue <= 30) existing.days1_30 = round2(existing.days1_30 + amount);
    else if (overdue <= 60) existing.days31_60 = round2(existing.days31_60 + amount);
    else if (overdue <= 90) existing.days61_90 = round2(existing.days61_90 + amount);
    else existing.days90Plus = round2(existing.days90Plus + amount);

    existing.docCount += 1;
    existing.totalOutstanding = round2(existing.totalOutstanding + amount);
    map.set(vendorName, existing);
  };

  for (const bill of vendorBills || []) {
    if (bill.status === 'DRAFT' || bill.status === 'PAID') continue;
    const bal = Number(bill.balanceAmount ?? Math.max(0, Number(bill.totalAmount || 0) - Number(bill.paidAmount || 0)));
    addBucket(bill.vendorName || 'Vendor', bill.dueDate || bill.billDate, bal);
  }

  // Include unbilled received POs as accrued payables only if not yet converted to a vendor bill
  for (const po of purchaseOrders || []) {
    if (billedPoIds.has(po.id)) continue;
    if ((po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED') && po.paymentStatus !== 'PAID') {
      addBucket(po.vendorName || 'Vendor', po.paymentDueDate || po.purchaseDate, Number(po.totalAmount || 0));
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  const totals = rows.reduce(
    (acc, r) => ({
      docCount: acc.docCount + r.docCount,
      current: round2(acc.current + r.current),
      days1_30: round2(acc.days1_30 + r.days1_30),
      days31_60: round2(acc.days31_60 + r.days31_60),
      days61_90: round2(acc.days61_90 + r.days61_90),
      days90Plus: round2(acc.days90Plus + r.days90Plus),
      totalOutstanding: round2(acc.totalOutstanding + r.totalOutstanding)
    }),
    { docCount: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, totalOutstanding: 0 }
  );
  return { rows, totals };
}

// ========================
// GST & TAX SUMMARY
// ========================
export interface GstSummaryResult {
  outputTaxable: number;
  outputCgst: number;
  outputSgst: number;
  outputIgst: number;
  outputTotalTax: number;
  inputTaxable: number;
  inputCgst: number;
  inputSgst: number;
  inputIgst: number;
  inputTotalItc: number;
  netPayable: number;
  itcCarryForward: number;
  b2bInvoicesCount: number;
  b2cInvoicesCount: number;
  einvoiceGeneratedCount: number;
  einvoicePendingCount: number;
}

export function buildGstSummary(
  salesInvoices: SalesInvoice[],
  vendorSalesInvoices: VendorSalesInvoice[],
  vendorBills: VendorBill[],
  expenses: ExpenseRecord[]
): GstSummaryResult {
  let outputTaxable = 0;
  let outputCgst = 0;
  let outputSgst = 0;
  let outputIgst = 0;
  let b2bInvoicesCount = 0;
  let b2cInvoicesCount = 0;
  let einvoiceGeneratedCount = 0;
  let einvoicePendingCount = 0;

  for (const inv of salesInvoices || []) {
    if (inv.status === 'CANCELLED' || inv.status === 'DRAFT') continue;
    outputTaxable = round2(outputTaxable + Number(inv.subtotal || 0));
    const tax = Number(inv.taxAmount || 0);
    const cgst = inv.cgstAmount != null ? Number(inv.cgstAmount) : round2(tax / 2);
    const sgst = inv.sgstAmount != null ? Number(inv.sgstAmount) : round2(tax - cgst);
    const igst = Number(inv.igstAmount || 0);
    outputCgst = round2(outputCgst + cgst);
    outputSgst = round2(outputSgst + sgst);
    outputIgst = round2(outputIgst + igst);

    if ((inv.customerGst || '').trim().length >= 10) {
      b2bInvoicesCount++;
      if (inv.einvoiceStatus === 'GENERATED' && inv.einvoiceIrn) einvoiceGeneratedCount++;
      else einvoicePendingCount++;
    } else {
      b2cInvoicesCount++;
    }
  }

  for (const vsi of vendorSalesInvoices || []) {
    if (vsi.status === 'DRAFT') continue;
    outputTaxable = round2(outputTaxable + Number(vsi.subtotal || 0));
    outputCgst = round2(outputCgst + Number(vsi.cgstAmount || 0));
    outputSgst = round2(outputSgst + Number(vsi.sgstAmount || 0));
    outputIgst = round2(outputIgst + Number(vsi.igstAmount || 0));
    if ((vsi.vendorGst || '').trim().length >= 10) b2bInvoicesCount++;
    else b2cInvoicesCount++;
  }

  let inputTaxable = 0;
  let inputCgst = 0;
  let inputSgst = 0;
  let inputIgst = 0;

  for (const bill of vendorBills || []) {
    if (bill.status === 'DRAFT' || !bill.itcEligible) continue;
    inputTaxable = round2(inputTaxable + Number(bill.subtotal || 0));
    const cgst = Number(bill.cgstAmount || 0);
    const sgst = Number(bill.sgstAmount || 0);
    const igst = Number(bill.igstAmount || 0);
    if (cgst + sgst + igst > 0) {
      inputCgst = round2(inputCgst + cgst);
      inputSgst = round2(inputSgst + sgst);
      inputIgst = round2(inputIgst + igst);
    } else if (Number(bill.gstAmount || 0) > 0) {
      const half = round2(Number(bill.gstAmount) / 2);
      inputCgst = round2(inputCgst + half);
      inputSgst = round2(inputSgst + round2(Number(bill.gstAmount) - half));
    }
  }

  for (const exp of expenses || []) {
    if (exp.status === 'REJECTED' || exp.status === 'DRAFT') continue;
    if (exp.itcEligible && Number(exp.gstAmount || 0) > 0) {
      const g = Number(exp.gstAmount || 0);
      const half = round2(g / 2);
      inputCgst = round2(inputCgst + half);
      inputSgst = round2(inputSgst + round2(g - half));
      inputTaxable = round2(inputTaxable + Math.max(0, Number(exp.amount || 0) - g));
    }
  }

  const outputTotalTax = round2(outputCgst + outputSgst + outputIgst);
  const inputTotalItc = round2(inputCgst + inputSgst + inputIgst);
  const diff = round2(outputTotalTax - inputTotalItc);

  return {
    outputTaxable,
    outputCgst,
    outputSgst,
    outputIgst,
    outputTotalTax,
    inputTaxable,
    inputCgst,
    inputSgst,
    inputIgst,
    inputTotalItc,
    netPayable: diff > 0 ? diff : 0,
    itcCarryForward: diff < 0 ? Math.abs(diff) : 0,
    b2bInvoicesCount,
    b2cInvoicesCount,
    einvoiceGeneratedCount,
    einvoicePendingCount
  };
}

// ========================
// BUDGETS & FORECASTING
// ========================
export interface BudgetAnalysisRow {
  budget: BudgetRecord;
  actualSpend: number;
  variance: number;
  utilizationPercent: number;
  projectedSpend: number;
  statusFlag: 'UNDER_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET';
}

export function buildBudgetAnalysis(
  budgets: BudgetRecord[],
  expenses: ExpenseRecord[],
  vendorBills: VendorBill[],
  journals: JournalEntry[]
): BudgetAnalysisRow[] {
  const monthProgress = Math.max(1, new Date().getMonth() + 1); // 1..12 run-rate factor
  const posted = getPostedJournals(journals);

  return (budgets || []).map(b => {
    let actual = 0;

    if (b.accountId) {
      for (const j of posted) {
        for (const l of j.lines || []) {
          if (l.accountId === b.accountId && (!b.projectId || l.projectId === b.projectId)) {
            actual = round2(actual + Number(l.debit || 0) - Number(l.credit || 0));
          }
        }
      }
    }

    // Also incorporate project / category bills & approved expenses if no CoA ledger movement captured
    if (actual === 0) {
      for (const bill of vendorBills || []) {
        if (bill.status === 'DRAFT') continue;
        const matchProj = b.projectId && bill.projectId === b.projectId;
        const matchCat = b.category && bill.category.toLowerCase() === b.category.toLowerCase();
        if (matchProj || (!b.projectId && matchCat)) {
          actual = round2(actual + Number(bill.subtotal || bill.totalAmount || 0));
        }
      }
      for (const exp of expenses || []) {
        if (exp.status === 'REJECTED' || exp.status === 'DRAFT') continue;
        const matchProj = b.projectId && exp.projectId === b.projectId;
        const matchCat = b.category && exp.category.toLowerCase() === b.category.toLowerCase();
        if (matchProj || (!b.projectId && matchCat)) {
          actual = round2(actual + Number(exp.amount || 0));
        }
      }
    }

    const allocated = Number(b.allocatedAmount || 0);
    const variance = round2(allocated - actual);
    const utilizationPercent = allocated > 0 ? round2((actual / allocated) * 100) : 0;
    const monthsRemaining = b.periodType === 'MONTHLY' ? 1 : b.periodType === 'QUARTERLY' ? 3 : 12;
    const elapsed = Math.min(monthsRemaining, Math.max(1, monthProgress % (monthsRemaining + 1) || 1));
    const projectedSpend = round2((actual / elapsed) * monthsRemaining);

    let statusFlag: 'UNDER_BUDGET' | 'NEAR_LIMIT' | 'OVER_BUDGET' = 'UNDER_BUDGET';
    if (utilizationPercent > 100) statusFlag = 'OVER_BUDGET';
    else if (utilizationPercent >= 80) statusFlag = 'NEAR_LIMIT';

    return {
      budget: b,
      actualSpend: Math.max(0, actual),
      variance,
      utilizationPercent,
      projectedSpend: Math.max(0, projectedSpend),
      statusFlag
    };
  });
}

// ========================
// PROJECT COSTING
// ========================
export interface ProjectCostingRow {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  customerName: string;
  status: string;
  capacityKw: number;
  contractValue: number;
  billedRevenue: number;
  collectedRevenue: number;
  bomEstimatedCost: number;
  vendorBillsCost: number;
  expensesCost: number;
  poCommittedCost: number;
  actualTotalCost: number;
  grossProfit: number;
  marginPercent: number;
  budgetAllocated: number;
  isOverBudget: boolean;
}

export function buildProjectCosting(
  projects: SolarProject[],
  salesInvoices: SalesInvoice[],
  payments: PaymentRecord[],
  boms: BillOfMaterials[],
  purchaseOrders: PurchaseOrder[],
  vendorBills: VendorBill[],
  expenses: ExpenseRecord[],
  budgets: BudgetRecord[]
): ProjectCostingRow[] {
  return (projects || []).map(p => {
    const billedRevenue = round2(
      (salesInvoices || [])
        .filter(i => i.projectId === p.id && i.status !== 'CANCELLED' && i.status !== 'DRAFT')
        .reduce((s, i) => s + Number(i.totalAmount || 0), 0)
    );
    const collectedRevenue = round2(
      (payments || [])
        .filter(pay => pay.projectId === p.id && pay.status === 'PAID')
        .reduce((s, pay) => s + Number(pay.amount || 0), 0)
    );
    const bomEstimatedCost = round2(
      (boms || [])
        .filter(b => b.projectId === p.id)
        .reduce((s, b) => s + Number(b.totalCost || 0), 0)
    );
    const projectBills = (vendorBills || []).filter(b => b.projectId === p.id && b.status !== 'DRAFT');
    const billedPoIds = new Set(projectBills.map(b => b.poId).filter(Boolean) as string[]);
    const vendorBillsCost = round2(projectBills.reduce((s, b) => s + Number(b.totalAmount || 0), 0));

    const expensesCost = round2(
      (expenses || [])
        .filter(e => e.projectId === p.id && e.status !== 'REJECTED' && e.status !== 'DRAFT')
        .reduce((s, e) => s + Number(e.amount || 0), 0)
    );

    const poCommittedCost = round2(
      (purchaseOrders || [])
        .filter(po => po.projectId === p.id && po.status !== 'CANCELLED' && !billedPoIds.has(po.id))
        .reduce((s, po) => s + Number(po.totalAmount || 0), 0)
    );

    const actualTotalCost = round2(vendorBillsCost + expensesCost);
    const recognizedRevenue = billedRevenue > 0 ? billedRevenue : Number(p.totalValue || 0);
    const grossProfit = round2(recognizedRevenue - actualTotalCost);
    const marginPercent = recognizedRevenue > 0 ? round2((grossProfit / recognizedRevenue) * 100) : 0;

    const budgetAllocated = round2(
      (budgets || [])
        .filter(b => b.projectId === p.id && b.status === 'ACTIVE')
        .reduce((s, b) => s + Number(b.allocatedAmount || 0), 0)
    );
    const benchmark = budgetAllocated > 0 ? budgetAllocated : bomEstimatedCost;
    const isOverBudget = benchmark > 0 && actualTotalCost > benchmark;

    return {
      projectId: p.id,
      projectCode: p.projectCode,
      projectTitle: p.title,
      customerName: p.customerName,
      status: p.status,
      capacityKw: Number(p.capacityKw || 0),
      contractValue: Number(p.totalValue || 0),
      billedRevenue,
      collectedRevenue,
      bomEstimatedCost,
      vendorBillsCost,
      expensesCost,
      poCommittedCost,
      actualTotalCost,
      grossProfit,
      marginPercent,
      budgetAllocated,
      isOverBudget
    };
  });
}

// ========================
// ASSET DEPRECIATION & DISPOSAL PREVIEW
// ========================
export function calculateDepreciationPreview(asset: FixedAsset, months = 1): {
  depreciableRemaining: number;
  chargeAmount: number;
  closingBookValue: number;
} {
  if (asset.status !== 'ACTIVE') {
    return { depreciableRemaining: 0, chargeAmount: 0, closingBookValue: asset.bookValue };
  }
  const depreciableRemaining = Math.max(0, round2(asset.bookValue - asset.salvageValue));
  if (depreciableRemaining <= 0) {
    return { depreciableRemaining: 0, chargeAmount: 0, closingBookValue: asset.bookValue };
  }

  let rawCharge = 0;
  if (asset.depreciationMethod === 'WDV') {
    const rate = asset.depreciationRate > 0 ? asset.depreciationRate : 100 / Math.max(1, asset.usefulLifeYears);
    rawCharge = round2(asset.bookValue * (rate / 100) * (months / 12));
  } else {
    const annualSlm = (asset.purchaseCost - asset.salvageValue) / Math.max(1, asset.usefulLifeYears);
    rawCharge = round2(annualSlm * (months / 12));
  }

  const chargeAmount = Math.min(depreciableRemaining, Math.max(0, rawCharge));
  return {
    depreciableRemaining,
    chargeAmount,
    closingBookValue: round2(asset.bookValue - chargeAmount)
  };
}

export function calculateDisposalPreview(asset: FixedAsset, proceeds: number): {
  bookValue: number;
  gainLoss: number;
  isGain: boolean;
} {
  const gainLoss = round2(Number(proceeds || 0) - Number(asset.bookValue || 0));
  return {
    bookValue: round2(asset.bookValue),
    gainLoss,
    isGain: gainLoss >= 0
  };
}

// ========================
// CSV EXPORT HELPER
// ========================
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
