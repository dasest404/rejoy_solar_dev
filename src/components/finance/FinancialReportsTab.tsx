import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  PaymentRecord,
  SalesInvoice,
  VendorSalesInvoice,
  PurchaseOrder,
  SystemSettings
} from '../../types/solar';
import {
  buildProfitAndLoss,
  buildBalanceSheet,
  buildCashFlowStatement,
  buildReceivablesAgeing,
  buildPayablesAgeing,
  formatINR,
  formatDateIN,
  downloadCsv
} from './accountingUtils';
import { Download, Printer, CheckCircle2, AlertCircle } from 'lucide-react';

interface FinancialReportsTabProps {
  workspace: AccountingWorkspace;
  payments: PaymentRecord[];
  salesInvoices: SalesInvoice[];
  vendorSalesInvoices: VendorSalesInvoice[];
  purchaseOrders: PurchaseOrder[];
  settings: SystemSettings;
}

type ReportType = 'PNL' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'AR_AGEING' | 'AP_AGEING';

export const FinancialReportsTab: React.FC<FinancialReportsTabProps> = ({
  workspace,
  payments,
  salesInvoices,
  vendorSalesInvoices,
  purchaseOrders,
  settings
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [reportType, setReportType] = useState<ReportType>('PNL');
  const [startDate, setStartDate] = useState(`${today.slice(0, 4)}-01-01`);
  const [endDate, setEndDate] = useState(today);

  const pnl = useMemo(
    () => buildProfitAndLoss(workspace.accounts, workspace.journals, startDate || undefined, endDate || undefined),
    [workspace.accounts, workspace.journals, startDate, endDate]
  );

  const bs = useMemo(
    () => buildBalanceSheet(workspace.accounts, workspace.journals, endDate || undefined),
    [workspace.accounts, workspace.journals, endDate]
  );

  const cf = useMemo(
    () => buildCashFlowStatement(workspace.accounts, workspace.bankAccounts, workspace.journals, startDate || undefined, endDate || undefined),
    [workspace.accounts, workspace.bankAccounts, workspace.journals, startDate, endDate]
  );

  const arAgeing = useMemo(
    () => buildReceivablesAgeing(salesInvoices, vendorSalesInvoices, payments, endDate || today),
    [salesInvoices, vendorSalesInvoices, payments, endDate, today]
  );

  const apAgeing = useMemo(
    () => buildPayablesAgeing(workspace.vendorBills, purchaseOrders, endDate || today),
    [workspace.vendorBills, purchaseOrders, endDate, today]
  );

  const handleExportCsv = () => {
    if (reportType === 'PNL') {
      downloadCsv(
        `profit-loss-${endDate}`,
        ['Section', 'Code', 'Account', 'Amount (INR)'],
        [
          ...pnl.revenueLines.map(l => ['Revenue', l.code, l.name, l.amount]),
          ...pnl.cogsLines.map(l => ['Direct Costs / COGS', l.code, l.name, l.amount]),
          ...pnl.operatingExpenseLines.map(l => ['Operating Expenses', l.code, l.name, l.amount]),
          ...pnl.depreciationLines.map(l => ['Depreciation', l.code, l.name, l.amount]),
          ['Summary', '', 'Net Profit / (Loss)', pnl.netProfit]
        ]
      );
    } else if (reportType === 'BALANCE_SHEET') {
      downloadCsv(
        `balance-sheet-${endDate}`,
        ['Section', 'Code', 'Account', 'Amount (INR)'],
        [
          ...bs.assetLines.map(l => ['Assets', l.code, l.name, l.amount]),
          ...bs.liabilityLines.map(l => ['Liabilities', l.code, l.name, l.amount]),
          ...bs.equityLines.map(l => ['Equity', l.code, l.name, l.amount]),
          ['Equity', '', 'Current Period Net Profit', bs.currentPeriodNetProfit]
        ]
      );
    } else if (reportType === 'CASH_FLOW') {
      downloadCsv(
        `cash-flow-${endDate}`,
        ['Activity', 'Inflow', 'Outflow', 'Net Cash'],
        [
          ['Operating Activities', cf.operatingInflows, cf.operatingOutflows, cf.netOperatingCashFlow],
          ['Investing Activities', cf.investingInflows, cf.investingOutflows, cf.netInvestingCashFlow],
          ['Financing Activities', cf.financingInflows, cf.financingOutflows, cf.netFinancingCashFlow],
          ['Summary', 0, 0, cf.closingCashBalance]
        ]
      );
    } else {
      const target = reportType === 'AR_AGEING' ? arAgeing : apAgeing;
      downloadCsv(
        `${reportType.toLowerCase()}-${endDate}`,
        ['Party', 'Docs', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total'],
        target.rows.map(r => [
          r.partyName,
          r.docCount,
          r.current,
          r.days1_30,
          r.days31_60,
          r.days61_90,
          r.days90Plus,
          r.totalOutstanding
        ])
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'PNL', label: 'Profit & Loss' },
              { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
              { id: 'CASH_FLOW', label: 'Cash Flow Statement' },
              { id: 'AR_AGEING', label: 'Receivables Ageing' },
              { id: 'AP_AGEING', label: 'Payables Ageing' }
            ] as { id: ReportType; label: string }[]
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                reportType === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(reportType === 'PNL' || reportType === 'CASH_FLOW') && (
            <>
              <span className="text-slate-500">From</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5"
              />
            </>
          )}
          <span className="text-slate-500">{reportType === 'PNL' || reportType === 'CASH_FLOW' ? 'To' : 'As of'}</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Report Body */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">{settings.companyName}</h2>
            <p className="text-xs text-slate-500">
              {reportType === 'PNL' && `Statement of Profit & Loss (${formatDateIN(startDate)} to ${formatDateIN(endDate)})`}
              {reportType === 'BALANCE_SHEET' && `Balance Sheet as of ${formatDateIN(endDate)}`}
              {reportType === 'CASH_FLOW' && `Cash Flow Statement (${formatDateIN(startDate)} to ${formatDateIN(endDate)})`}
              {reportType === 'AR_AGEING' && `Accounts Receivable Ageing Schedule as of ${formatDateIN(endDate)}`}
              {reportType === 'AP_AGEING' && `Accounts Payable Ageing Schedule as of ${formatDateIN(endDate)}`}
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500">GSTIN: {settings.companyGst}</div>
        </div>

        {/* 1. P&L */}
        {reportType === 'PNL' && (
          <div className="space-y-4 text-xs">
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider mb-2">Operating Revenue</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {pnl.revenueLines.length === 0 ? (
                  <div className="p-3 text-slate-500">No posted revenue entries in this period.</div>
                ) : (
                  pnl.revenueLines.map(l => (
                    <div key={l.accountId} className="p-2.5 px-4 flex justify-between">
                      <span><span className="font-mono text-slate-400 mr-2">{l.code}</span>{l.name}</span>
                      <span className="font-mono tabular-nums font-semibold">{formatINR(l.amount)}</span>
                    </div>
                  ))
                )}
                <div className="p-2.5 px-4 flex justify-between bg-slate-50 font-bold text-slate-900">
                  <span>Total Revenue</span>
                  <span className="font-mono tabular-nums">{formatINR(pnl.totalRevenue)}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider mb-2">Direct Costs & COGS</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {pnl.cogsLines.length === 0 ? (
                  <div className="p-3 text-slate-500">No direct cost entries in this period.</div>
                ) : (
                  pnl.cogsLines.map(l => (
                    <div key={l.accountId} className="p-2.5 px-4 flex justify-between">
                      <span><span className="font-mono text-slate-400 mr-2">{l.code}</span>{l.name}</span>
                      <span className="font-mono tabular-nums">{formatINR(l.amount)}</span>
                    </div>
                  ))
                )}
                <div className="p-2.5 px-4 flex justify-between bg-slate-50 font-bold text-slate-900">
                  <span>Gross Profit (Margin: {pnl.grossMarginPercent}%)</span>
                  <span className="font-mono tabular-nums">{formatINR(pnl.grossProfit)}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider mb-2">Operating Expenses & Depreciation</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {[...pnl.operatingExpenseLines, ...pnl.depreciationLines].length === 0 ? (
                  <div className="p-3 text-slate-500">No operating expense entries in this period.</div>
                ) : (
                  [...pnl.operatingExpenseLines, ...pnl.depreciationLines].map(l => (
                    <div key={l.accountId} className="p-2.5 px-4 flex justify-between">
                      <span><span className="font-mono text-slate-400 mr-2">{l.code}</span>{l.name}</span>
                      <span className="font-mono tabular-nums">{formatINR(l.amount)}</span>
                    </div>
                  ))
                )}
                <div className="p-3 px-4 flex justify-between bg-slate-900 text-white font-bold text-sm">
                  <span>Net Profit / (Loss) · Net Margin {pnl.netMarginPercent}%</span>
                  <span className="font-mono tabular-nums">{formatINR(pnl.netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. BALANCE SHEET */}
        {reportType === 'BALANCE_SHEET' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              {bs.isBalanced ? (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Accounting Equation Balanced (Assets = Liabilities + Equity)
                </span>
              ) : (
                <span className="text-amber-700 inline-flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Difference of {formatINR(bs.difference)} (Verify Opening Balances)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 uppercase">Assets</div>
                <div className="divide-y divide-slate-100">
                  {bs.assetLines.map(l => (
                    <div key={l.accountId} className="p-2.5 px-4 flex justify-between">
                      <span><span className="font-mono text-slate-400 mr-2">{l.code}</span>{l.name}</span>
                      <span className="font-mono tabular-nums font-semibold">{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  <div className="p-3 px-4 flex justify-between bg-slate-900 text-white font-bold">
                    <span>Total Assets</span>
                    <span className="font-mono tabular-nums">{formatINR(bs.totalAssets)}</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 uppercase">
                  Liabilities & Equity
                </div>
                <div className="divide-y divide-slate-100">
                  {bs.liabilityLines.map(l => (
                    <div key={l.accountId} className="p-2.5 px-4 flex justify-between">
                      <span><span className="font-mono text-slate-400 mr-2">{l.code}</span>{l.name}</span>
                      <span className="font-mono tabular-nums font-semibold">{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  {bs.equityLines.map(l => (
                    <div key={l.accountId} className="p-2.5 px-4 flex justify-between">
                      <span><span className="font-mono text-slate-400 mr-2">{l.code}</span>{l.name}</span>
                      <span className="font-mono tabular-nums font-semibold">{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  <div className="p-2.5 px-4 flex justify-between text-emerald-800 font-semibold">
                    <span>Current Period Retained Earnings / Net Profit</span>
                    <span className="font-mono tabular-nums">{formatINR(bs.currentPeriodNetProfit)}</span>
                  </div>
                  <div className="p-3 px-4 flex justify-between bg-slate-900 text-white font-bold">
                    <span>Total Liabilities & Equity</span>
                    <span className="font-mono tabular-nums">{formatINR(bs.totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. CASH FLOW */}
        {reportType === 'CASH_FLOW' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs divide-y divide-slate-100">
            <div className="p-3 px-4 bg-slate-50 font-bold grid grid-cols-4 text-slate-700">
              <span>Cash Flow Category</span>
              <span className="text-right">Inflows (₹)</span>
              <span className="text-right">Outflows (₹)</span>
              <span className="text-right">Net Cash Flow (₹)</span>
            </div>
            <div className="p-3 px-4 grid grid-cols-4">
              <span className="font-semibold text-slate-800">Operating Activities</span>
              <span className="text-right font-mono">{formatINR(cf.operatingInflows)}</span>
              <span className="text-right font-mono">{formatINR(cf.operatingOutflows)}</span>
              <span className="text-right font-mono font-bold">{formatINR(cf.netOperatingCashFlow, true)}</span>
            </div>
            <div className="p-3 px-4 grid grid-cols-4">
              <span className="font-semibold text-slate-800">Investing Activities (Fixed Assets)</span>
              <span className="text-right font-mono">{formatINR(cf.investingInflows)}</span>
              <span className="text-right font-mono">{formatINR(cf.investingOutflows)}</span>
              <span className="text-right font-mono font-bold">{formatINR(cf.netInvestingCashFlow, true)}</span>
            </div>
            <div className="p-3 px-4 grid grid-cols-4">
              <span className="font-semibold text-slate-800">Financing Activities (Equity / Loans)</span>
              <span className="text-right font-mono">{formatINR(cf.financingInflows)}</span>
              <span className="text-right font-mono">{formatINR(cf.financingOutflows)}</span>
              <span className="text-right font-mono font-bold">{formatINR(cf.netFinancingCashFlow, true)}</span>
            </div>
            <div className="p-3 px-4 grid grid-cols-4 bg-slate-50 font-semibold">
              <span>Opening Cash & Bank Balance</span>
              <span />
              <span />
              <span className="text-right font-mono">{formatINR(cf.openingCashBalance)}</span>
            </div>
            <div className="p-3 px-4 grid grid-cols-4 bg-slate-900 text-white font-bold">
              <span>Closing Cash & Bank Balance</span>
              <span />
              <span />
              <span className="text-right font-mono">{formatINR(cf.closingCashBalance)}</span>
            </div>
          </div>
        )}

        {/* 4 & 5. AGEING */}
        {(reportType === 'AR_AGEING' || reportType === 'AP_AGEING') && (
          <div className="overflow-x-auto">
            {(() => {
              const target = reportType === 'AR_AGEING' ? arAgeing : apAgeing;
              return (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Party Name</th>
                      <th className="py-2.5 px-3 text-right">Docs</th>
                      <th className="py-2.5 px-3 text-right">Current</th>
                      <th className="py-2.5 px-3 text-right">1-30 Days</th>
                      <th className="py-2.5 px-3 text-right">31-60 Days</th>
                      <th className="py-2.5 px-3 text-right">61-90 Days</th>
                      <th className="py-2.5 px-3 text-right">90+ Days</th>
                      <th className="py-2.5 px-3 text-right">Total Due (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {target.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No open balances in this ageing schedule.
                        </td>
                      </tr>
                    ) : (
                      target.rows.map((r, i) => (
                        <tr key={`${r.partyName}-${i}`}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{r.partyName}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.docCount}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatINR(r.current)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatINR(r.days1_30)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-700">{formatINR(r.days31_60)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">{formatINR(r.days61_90)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-bold">{formatINR(r.days90Plus)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatINR(r.totalOutstanding)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td className="py-2.5 px-3">Total Outstanding</td>
                      <td className="py-2.5 px-3 text-right font-mono">{target.totals.docCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(target.totals.current)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(target.totals.days1_30)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(target.totals.days31_60)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(target.totals.days61_90)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(target.totals.days90Plus)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(target.totals.totalOutstanding)}</td>
                    </tr>
                  </tfoot>
                </table>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
