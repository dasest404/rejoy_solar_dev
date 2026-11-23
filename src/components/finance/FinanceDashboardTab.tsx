import React, { useMemo } from 'react';
import {
  AccountingWorkspace,
  PaymentRecord,
  ExpenseRecord,
  SalesInvoice,
  VendorSalesInvoice,
  PurchaseOrder,
  SystemSettings
} from '../../types/solar';
import { FinanceTab } from '../../context/AppContext';
import {
  buildProfitAndLoss,
  buildCashFlowStatement,
  buildReceivablesAgeing,
  buildPayablesAgeing,
  buildGstSummary,
  formatINR,
  formatDateIN,
  round2
} from './accountingUtils';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface FinanceDashboardTabProps {
  workspace: AccountingWorkspace;
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  salesInvoices: SalesInvoice[];
  vendorSalesInvoices: VendorSalesInvoice[];
  purchaseOrders: PurchaseOrder[];
  settings: SystemSettings;
  canSyncVouchers: boolean;
  isSyncingVouchers: boolean;
  onSyncErpVouchers: () => Promise<void>;
  onNavigateTab: (tab: FinanceTab) => void;
}

export const FinanceDashboardTab: React.FC<FinanceDashboardTabProps> = ({
  workspace,
  payments,
  expenses,
  salesInvoices,
  vendorSalesInvoices,
  purchaseOrders,
  settings,
  canSyncVouchers,
  isSyncingVouchers,
  onSyncErpVouchers,
  onNavigateTab
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const pnl = useMemo(
    () => buildProfitAndLoss(workspace.accounts, workspace.journals),
    [workspace.accounts, workspace.journals]
  );

  const cashFlow = useMemo(
    () => buildCashFlowStatement(workspace.accounts, workspace.bankAccounts, workspace.journals),
    [workspace.accounts, workspace.bankAccounts, workspace.journals]
  );

  const arAgeing = useMemo(
    () => buildReceivablesAgeing(salesInvoices, vendorSalesInvoices, payments, today),
    [salesInvoices, vendorSalesInvoices, payments, today]
  );

  const apAgeing = useMemo(
    () => buildPayablesAgeing(workspace.vendorBills, purchaseOrders, today),
    [workspace.vendorBills, purchaseOrders, today]
  );

  const gstSummary = useMemo(
    () => buildGstSummary(salesInvoices, vendorSalesInvoices, workspace.vendorBills, expenses),
    [salesInvoices, vendorSalesInvoices, workspace.vendorBills, expenses]
  );

  const cashAndBankTotal = useMemo(
    () =>
      round2(
        (workspace.bankAccounts || [])
          .filter(b => b.isActive)
          .reduce((s, b) => s + Number(b.currentBalance || 0), 0)
      ),
    [workspace.bankAccounts]
  );

  // Operational fallback figures if ledger hasn't been synced yet so dashboard reflects both books & ERP
  const operationalRevenue = useMemo(() => {
    if (pnl.totalRevenue > 0) return pnl.totalRevenue;
    const invRev = (salesInvoices || [])
      .filter(i => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
      .reduce((s, i) => s + Number(i.subtotal || i.totalAmount || 0), 0);
    const payRev = (payments || [])
      .filter(p => p.status === 'PAID')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return round2(Math.max(invRev, payRev));
  }, [pnl.totalRevenue, salesInvoices, payments]);

  const operationalExpenses = useMemo(() => {
    if (pnl.totalExpenses > 0) return pnl.totalExpenses;
    const billExp = (workspace.vendorBills || [])
      .filter(b => b.status !== 'DRAFT')
      .reduce((s, b) => s + Number(b.subtotal || b.totalAmount || 0), 0);
    const expSum = (expenses || [])
      .filter(e => e.status !== 'REJECTED')
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return round2(billExp + expSum);
  }, [pnl.totalExpenses, workspace.vendorBills, expenses]);

  const netProfit = round2(operationalRevenue - operationalExpenses);
  const usingOperationalFallback = pnl.totalRevenue === 0 && operationalRevenue > 0;

  const overdueInvoices = useMemo(
    () =>
      (salesInvoices || []).filter(
        i => i.status === 'ISSUED' && i.paymentStatus !== 'PAID' && (i.dueDate || '') < today
      ),
    [salesInvoices, today]
  );

  const overdueBills = useMemo(
    () =>
      (workspace.vendorBills || []).filter(
        b => b.status !== 'PAID' && b.status !== 'DRAFT' && (b.dueDate || '') < today
      ),
    [workspace.vendorBills, today]
  );

  const pendingApprovals = useMemo(
    () => (expenses || []).filter(e => e.status === 'PENDING_APPROVAL'),
    [expenses]
  );

  const pendingTds = useMemo(
    () =>
      (workspace.tdsEntries || [])
        .filter(t => t.status === 'DEDUCTED')
        .reduce((s, t) => s + Number(t.tdsAmount || 0), 0),
    [workspace.tdsEntries]
  );

  const maxChartVal = useMemo(() => {
    const vals = cashFlow.monthlyTrend.flatMap(m => [m.inflow, m.outflow]);
    return Math.max(1, ...vals);
  }, [cashFlow.monthlyTrend]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('reports')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatINR(operationalRevenue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {usingOperationalFallback ? 'ERP Invoiced/Collected · Unsynced' : `Posted Ledger · Margin ${pnl.grossMarginPercent}%`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('expenses')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatINR(operationalExpenses)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            COGS + Operating + Depreciation
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net Profit / Surplus</span>
            <Wallet className={`w-4 h-4 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-2 ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(netProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Fiscal Year {workspace.settings.activeFiscalYear}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('banking')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Cash & Bank Balance</span>
            <Landmark className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatINR(cashAndBankTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {workspace.bankAccounts.filter(b => b.isActive).length} active registers
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('receivables')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>AR / AP Outstanding</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-2">
            AR: {formatINR(arAgeing.totals.totalOutstanding)}
          </div>
          <div className="text-xs font-semibold text-rose-700 font-mono tabular-nums mt-1">
            AP: {formatINR(apAgeing.totals.totalOutstanding)}
          </div>
        </button>
      </div>

      {/* Sync Banner & Tally Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
            GL
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              <span>Double-Entry General Ledger & Tally Prime Bridge</span>
              <span className="text-xs font-medium text-slate-500">
                · {workspace.journals.filter(j => j.status === 'POSTED').length} Posted Vouchers · Tally: {settings.tallyStatus} ({settings.tallyCompany})
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Synchronize existing Sales Invoices, Vendor Sales Invoices, Customer Receipts, Vendor Bills, and Approved Expenses into balanced double-entry journal vouchers.
            </p>
          </div>
        </div>
        {canSyncVouchers && (
          <button
            type="button"
            onClick={onSyncErpVouchers}
            disabled={isSyncingVouchers}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingVouchers ? 'animate-spin' : ''}`} />
            <span>{isSyncingVouchers ? 'Posting Vouchers...' : 'Sync ERP Vouchers to Ledger'}</span>
          </button>
        )}
      </div>

      {/* Two-Column Analytics + Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Cash Flow Bar Visualization */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Cash Inflow vs Outflow</h3>
              <p className="text-xs text-slate-500">Derived strictly from posted bank and cash ledger entries</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-xs" /> Inflow
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-rose-500 inline-block rounded-xs" /> Outflow
              </span>
            </div>
          </div>

          {cashFlow.monthlyTrend.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm font-medium text-slate-700">No posted cash/bank movements yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Click "Sync ERP Vouchers to Ledger" above or record a Customer Receipt / Vendor Payment to generate ledger cash trends.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 items-end pt-4 pb-2 border-b border-slate-100">
                {cashFlow.monthlyTrend.slice(-6).map(m => {
                  const inPct = Math.max(4, Math.round((m.inflow / maxChartVal) * 100));
                  const outPct = Math.max(4, Math.round((m.outflow / maxChartVal) * 100));
                  return (
                    <div key={m.month} className="flex flex-col items-center gap-2">
                      <div className="w-full h-32 flex items-end justify-center gap-1.5 px-2">
                        <div
                          className="w-5 bg-emerald-600 rounded-t-xs transition-all"
                          style={{ height: `${inPct}%` }}
                          title={`Inflow: ${formatINR(m.inflow)}`}
                        />
                        <div
                          className="w-5 bg-rose-500 rounded-t-xs transition-all"
                          style={{ height: `${outPct}%` }}
                          title={`Outflow: ${formatINR(m.outflow)}`}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold text-slate-700">{m.label}</div>
                        <div className={`text-[11px] font-mono tabular-nums ${m.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatINR(m.net, true)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1 text-xs">
                <div>
                  <span className="text-slate-500">Operating Cash Flow</span>
                  <div className="font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatINR(cashFlow.netOperatingCashFlow, true)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Investing Cash Flow</span>
                  <div className="font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatINR(cashFlow.netInvestingCashFlow, true)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Financing Cash Flow</span>
                  <div className="font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatINR(cashFlow.netFinancingCashFlow, true)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statutory & Pending Action Queue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Action Queue & Compliance</h3>
            <span className="text-xs text-slate-500">As of {formatDateIN(today)}</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('receivables')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <AlertCircle className={`w-4 h-4 ${overdueInvoices.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                Overdue Customer Invoices
              </span>
              <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1">
                {overdueInvoices.length} <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('payables')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <AlertCircle className={`w-4 h-4 ${overdueBills.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                Overdue Vendor Bills
              </span>
              <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1">
                {overdueBills.length} <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('expenses')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <Clock className={`w-4 h-4 ${pendingApprovals.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                Pending Expense Approvals
              </span>
              <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1">
                {pendingApprovals.length} <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('gst')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <FileText className="w-4 h-4 text-blue-600" />
                {gstSummary.netPayable > 0 ? 'Net GST Liability' : 'Input ITC Credit Pool'}
              </span>
              <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1">
                {formatINR(gstSummary.netPayable > 0 ? gstSummary.netPayable : gstSummary.itcCarryForward)}
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('gst')}
              className="w-full py-2.5 flex items-center justify-between hover:bg-slate-50 px-1 rounded transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 font-medium">
                <CheckCircle2 className={`w-4 h-4 ${pendingTds > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                TDS Deducted (Pending Challan)
              </span>
              <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1">
                {formatINR(pendingTds)} <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 mb-2">Cash & Bank Registers</div>
            <div className="space-y-1.5">
              {workspace.bankAccounts.filter(b => b.isActive).slice(0, 4).map(bank => (
                <div key={bank.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 truncate pr-2">
                    {bank.accountName} <span className="text-slate-400">({bank.accountType})</span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {formatINR(bank.currentBalance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Journal Activity */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Posted Journal Vouchers</h3>
            <p className="text-xs text-slate-500">Latest general ledger activity across invoices, bills, receipts, and journals</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('ledger')}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer self-start sm:self-auto shrink-0"
          >
            Open Accounts & Ledger →
          </button>
        </div>
        {workspace.journals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No journal entries recorded yet. Post a manual journal or click Sync ERP Vouchers.
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {workspace.journals.slice(0, 8).map(j => (
                <div key={j.id} className="p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-900">{j.entryNumber}</span>
                    <span className="font-mono text-slate-500">{formatDateIN(j.entryDate)}</span>
                  </div>
                  <div className="text-slate-700 line-clamp-2">{j.narration}</div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span
                      className={`text-[11px] font-semibold ${
                        j.status === 'POSTED'
                          ? 'text-emerald-700'
                          : j.status === 'REVERSED'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {j.status}
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(j.totalDebit)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Voucher #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Reference</th>
                    <th className="py-2.5 px-4">Narration</th>
                    <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workspace.journals.slice(0, 8).map(j => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">{j.entryNumber}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(j.entryDate)}</td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{j.referenceNumber || j.referenceType || 'Manual'}</td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-md truncate">{j.narration}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatINR(j.totalDebit)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatINR(j.totalCredit)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            j.status === 'POSTED'
                              ? 'text-emerald-700'
                              : j.status === 'REVERSED'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
