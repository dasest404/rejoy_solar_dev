export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  subType: string;
  parentId?: string | null;
  description?: string;
  openingBalance: number;
  currentBalance: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export interface JournalLine {
  id: string;
  journalId: string;
  lineOrder: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  description?: string;
  projectId?: string;
  projectTitle?: string;
  partyType?: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'NONE' | string;
  partyId?: string;
  partyName?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  status: JournalEntryStatus;
  reversedEntryId?: string | null;
  postedBy?: string;
  postedAt?: string | null;
  createdBy?: string;
  lines: JournalLine[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAccount {
  id: string;
  accountName: string;
  accountType: 'CASH' | 'BANK';
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  coaAccountId: string;
  openingBalance: number;
  currentBalance: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankTransfer {
  id: string;
  transferNumber: string;
  transferDate: string;
  fromAccountId: string;
  fromAccountName?: string;
  toAccountId: string;
  toAccountName?: string;
  amount: number;
  mode: string;
  referenceNo?: string;
  notes?: string;
  journalEntryId?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface BankReconciliation {
  id: string;
  bankAccountId: string;
  bankAccountName?: string;
  statementDate: string;
  bookBalance: number;
  statementBalance: number;
  clearedTxnIds: string[];
  difference: number;
  status: 'DRAFT' | 'RECONCILED';
  notes?: string;
  reconciledBy?: string;
  reconciledAt?: string;
  createdAt?: string;
}

export interface VendorBillLineItem {
  id: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export type VendorBillStatus = 'DRAFT' | 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  vendorGst?: string;
  poId?: string;
  poNumber?: string;
  projectId?: string;
  projectTitle?: string;
  billDate: string;
  dueDate: string;
  category: string;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  tdsSection?: string;
  tdsRate: number;
  tdsAmount: number;
  totalAmount: number;
  paidAmount: number;
  returnedAmount?: number;
  refundedAmount?: number;
  balanceAmount: number;
  itcEligible: boolean;
  status: VendorBillStatus;
  expenseAccountId?: string;
  journalEntryId?: string;
  notes?: string;
  items: VendorBillLineItem[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorPayment {
  id: string;
  paymentNumber: string;
  billId: string;
  billNumber?: string;
  vendorId: string;
  vendorName: string;
  paymentDate: string;
  amount: number;
  tdsDeducted: number;
  netPaid: number;
  bankAccountId: string;
  bankAccountName?: string;
  paymentMode: string;
  referenceNo?: string;
  notes?: string;
  journalEntryId?: string;
  recordedBy?: string;
  createdAt?: string;
}

export interface TdsEntry {
  id: string;
  section: string;
  partyType: string;
  partyId: string;
  partyName: string;
  panNumber?: string;
  sourceType: string;
  sourceId: string;
  sourceNumber?: string;
  deductionDate: string;
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
  status: 'DEDUCTED' | 'DEPOSITED';
  challanNo?: string;
  bsrCode?: string;
  depositDate?: string | null;
  createdAt?: string;
}

export interface BudgetRecord {
  id: string;
  name: string;
  fiscalYear: string;
  periodType: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';
  periodLabel: string;
  department?: string;
  category?: string;
  projectId?: string;
  projectTitle?: string;
  accountId?: string;
  allocatedAmount: number;
  notes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string;
  vendorName?: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: 'SLM' | 'WDV';
  depreciationRate: number;
  accumulatedDepreciation: number;
  bookValue: number;
  lastDepreciationDate?: string | null;
  assetAccountId?: string;
  depExpenseAccountId?: string;
  location?: string;
  custodian?: string;
  status: 'ACTIVE' | 'DISPOSED';
  disposalDate?: string | null;
  disposalProceeds?: number;
  disposalGainLoss?: number;
  disposalJournalId?: string | null;
  purchaseJournalId?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetDepreciationLog {
  id: string;
  assetId: string;
  assetCode?: string;
  assetName?: string;
  periodLabel: string;
  runDate: string;
  openingBookValue: number;
  depreciationAmount: number;
  closingBookValue: number;
  journalEntryId?: string;
  runBy?: string;
  createdAt?: string;
}

export interface AccountingSettings {
  id: string;
  fiscalYearStartMonth: number;
  activeFiscalYear: string;
  lockDate?: string | null;
  currency: string;
  approvalThreshold: number;
  requireExpenseApproval: boolean;
  autoPostErpVouchers: boolean;
  journalPrefix: string;
  billPrefix: string;
  voucherPrefix: string;
  defaultCashAccountId: string;
  defaultBankAccountId: string;
  defaultArAccountId: string;
  defaultApAccountId: string;
  defaultSalesAccountId: string;
  defaultCogsAccountId: string;
  defaultOutputGstAccountId: string;
  defaultInputGstAccountId: string;
  defaultTdsAccountId: string;
  defaultPayrollAccountId: string;
  defaultDepExpenseAccountId: string;
  defaultDisposalGainLossAccountId: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AccountingAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  module: string;
  action: string;
  entityId: string;
  entityRef: string;
  summary: string;
  details?: any;
  createdAt: string;
}

export interface AccountingWorkspace {
  accounts: ChartAccount[];
  journals: JournalEntry[];
  bankAccounts: BankAccount[];
  bankTransfers: BankTransfer[];
  bankReconciliations: BankReconciliation[];
  vendorBills: VendorBill[];
  vendorPayments: VendorPayment[];
  tdsEntries: TdsEntry[];
  budgets: BudgetRecord[];
  fixedAssets: FixedAsset[];
  assetDepreciationLogs: AssetDepreciationLog[];
  settings: AccountingSettings;
  auditLogs: AccountingAuditLog[];
}
