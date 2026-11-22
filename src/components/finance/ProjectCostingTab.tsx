import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  SolarProject,
  SalesInvoice,
  PaymentRecord,
  BillOfMaterials,
  PurchaseOrder,
  ExpenseRecord
} from '../../types/solar';
import { buildProjectCosting, formatINR, round2, ProjectCostingRow, downloadCsv } from './accountingUtils';
import { Search, Download, AlertTriangle, X } from 'lucide-react';

interface ProjectCostingTabProps {
  workspace: AccountingWorkspace;
  projects: SolarProject[];
  salesInvoices: SalesInvoice[];
  payments: PaymentRecord[];
  boms: BillOfMaterials[];
  purchaseOrders: PurchaseOrder[];
  expenses: ExpenseRecord[];
}

export const ProjectCostingTab: React.FC<ProjectCostingTabProps> = ({
  workspace,
  projects,
  salesInvoices,
  payments,
  boms,
  purchaseOrders,
  expenses
}) => {
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<ProjectCostingRow | null>(null);

  const rows = useMemo(
    () =>
      buildProjectCosting(
        projects,
        salesInvoices,
        payments,
        boms,
        purchaseOrders,
        workspace.vendorBills,
        expenses,
        workspace.budgets
      ),
    [projects, salesInvoices, payments, boms, purchaseOrders, workspace.vendorBills, expenses, workspace.budgets]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      r =>
        !q ||
        r.projectCode.toLowerCase().includes(q) ||
        r.projectTitle.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const contract = round2(rows.reduce((s, r) => s + r.contractValue, 0));
    const billed = round2(rows.reduce((s, r) => s + r.billedRevenue, 0));
    const collected = round2(rows.reduce((s, r) => s + r.collectedRevenue, 0));
    const actualCost = round2(rows.reduce((s, r) => s + r.actualTotalCost, 0));
    const profit = round2(rows.reduce((s, r) => s + r.grossProfit, 0));
    return { contract, billed, collected, actualCost, profit };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Contract Portfolio</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totals.contract)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Billed Revenue</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totals.billed)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Cash Collected</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatINR(totals.collected)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Actual Costs Booked</div>
          <div className="text-lg font-bold font-mono tabular-nums text-rose-700 mt-1">{formatINR(totals.actualCost)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Project Gross Profit</div>
          <div className={`text-lg font-bold font-mono tabular-nums mt-1 ${totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(totals.profit)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Solar EPC Project Costing & Margin Tracker</h3>
          <p className="text-xs text-slate-500">Compares Contract Value, Billed Revenue, BOM Estimate, Vendor Bills, and Direct Expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search project or customer..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `project-costing-${new Date().toISOString().slice(0, 10)}`,
                ['Project Code', 'Project', 'Customer', 'Contract Value', 'Billed', 'Collected', 'BOM Est', 'Actual Cost', 'Gross Profit', 'Margin %'],
                filtered.map(r => [
                  r.projectCode,
                  r.projectTitle,
                  r.customerName,
                  r.contractValue,
                  r.billedRevenue,
                  r.collectedRevenue,
                  r.bomEstimatedCost,
                  r.actualTotalCost,
                  r.grossProfit,
                  r.marginPercent
                ])
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Project</th>
                <th className="py-2.5 px-4 text-right">Contract (₹)</th>
                <th className="py-2.5 px-4 text-right">Billed / Recv (₹)</th>
                <th className="py-2.5 px-4 text-right">BOM Est (₹)</th>
                <th className="py-2.5 px-4 text-right">Actual Cost (₹)</th>
                <th className="py-2.5 px-4 text-right">Gross Profit (₹)</th>
                <th className="py-2.5 px-4 text-right">Margin</th>
                <th className="py-2.5 px-4 text-right">Drilldown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No EPC projects found matching your filter.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.projectId} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-slate-500">{r.projectCode}</span>
                        <span>{r.projectTitle}</span>
                        {r.isOverBudget && (
                          <span title="Actual costs exceed BOM/Budget benchmark">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.customerName} · {r.capacityKw} kWp · {r.status}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(r.contractValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="text-slate-900">{formatINR(r.billedRevenue)}</div>
                      <div className="text-[11px] text-emerald-700">Recv {formatINR(r.collectedRevenue)}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatINR(r.bomEstimatedCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700 font-semibold">
                      {formatINR(r.actualTotalCost)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${r.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatINR(r.grossProfit)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${r.marginPercent >= 15 ? 'text-emerald-700' : r.marginPercent >= 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                      {r.marginPercent}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(r)}
                        className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                      >
                        Breakdown
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Financial Drilldown Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedRow.projectCode} — Cost Breakdown</h3>
                <p className="text-xs text-slate-500">{selectedRow.projectTitle} ({selectedRow.customerName})</p>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">EPC Contract Value</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(selectedRow.contractValue)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">Billed Customer Invoices</span>
                  <span className="font-mono font-semibold text-slate-900">{formatINR(selectedRow.billedRevenue)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">Cash Collected</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatINR(selectedRow.collectedRevenue)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">BOM Estimated Material Cost</span>
                  <span className="font-mono text-slate-700">{formatINR(selectedRow.bomEstimatedCost)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">Posted Vendor Bills</span>
                  <span className="font-mono text-rose-700">{formatINR(selectedRow.vendorBillsCost)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">Site & Direct Expenses</span>
                  <span className="font-mono text-rose-700">{formatINR(selectedRow.expensesCost)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-slate-600">Open Unbilled PO Commitments</span>
                  <span className="font-mono text-amber-700">{formatINR(selectedRow.poCommittedCost)}</span>
                </div>
                <div className="p-3 flex justify-between bg-slate-50 font-bold">
                  <span className="text-slate-900">Gross Profit ({selectedRow.marginPercent}% margin)</span>
                  <span className={`font-mono ${selectedRow.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatINR(selectedRow.grossProfit)}
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
