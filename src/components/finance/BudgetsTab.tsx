import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  BudgetRecord,
  ExpenseRecord,
  SolarProject
} from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { buildBudgetAnalysis, formatINR, round2 } from './accountingUtils';
import { Plus, Trash2, Edit3, X } from 'lucide-react';

interface BudgetsTabProps {
  workspace: AccountingWorkspace;
  expenses: ExpenseRecord[];
  projects: SolarProject[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({
  workspace,
  expenses,
  projects,
  canManage,
  onRefresh,
  showToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: '',
    name: '',
    fiscalYear: workspace.settings.activeFiscalYear || '2026-27',
    periodType: 'ANNUAL' as 'ANNUAL' | 'QUARTERLY' | 'MONTHLY',
    periodLabel: 'FY 2026-27',
    department: 'Operations',
    category: 'Material Purchase',
    projectId: '',
    accountId: 'acc-5010',
    allocatedAmount: 0,
    notes: ''
  });

  const rows = useMemo(
    () => buildBudgetAnalysis(workspace.budgets, expenses, workspace.vendorBills, workspace.journals),
    [workspace.budgets, expenses, workspace.vendorBills, workspace.journals]
  );

  const summary = useMemo(() => {
    const totalAllocated = round2(rows.reduce((s, r) => s + r.budget.allocatedAmount, 0));
    const totalActual = round2(rows.reduce((s, r) => s + r.actualSpend, 0));
    const totalForecast = round2(rows.reduce((s, r) => s + r.projectedSpend, 0));
    return {
      totalAllocated,
      totalActual,
      totalVariance: round2(totalAllocated - totalActual),
      totalForecast
    };
  }, [rows]);

  const openModal = (b?: BudgetRecord) => {
    if (b) {
      setForm({
        id: b.id,
        name: b.name,
        fiscalYear: b.fiscalYear,
        periodType: b.periodType,
        periodLabel: b.periodLabel,
        department: b.department || '',
        category: b.category || '',
        projectId: b.projectId || '',
        accountId: b.accountId || '',
        allocatedAmount: b.allocatedAmount,
        notes: b.notes || ''
      });
    } else {
      setForm({
        id: '',
        name: '',
        fiscalYear: workspace.settings.activeFiscalYear || '2026-27',
        periodType: 'ANNUAL',
        periodLabel: `FY ${workspace.settings.activeFiscalYear || '2026-27'}`,
        department: 'Operations',
        category: 'Material Purchase',
        projectId: '',
        accountId: 'acc-5010',
        allocatedAmount: 0,
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const proj = projects.find(p => p.id === form.projectId);
      await apiClient.saveBudget({
        id: form.id || undefined,
        name: form.name.trim(),
        fiscalYear: form.fiscalYear,
        periodType: form.periodType,
        periodLabel: form.periodLabel.trim(),
        department: form.department.trim(),
        category: form.category.trim(),
        projectId: proj?.id,
        projectTitle: proj?.title,
        accountId: form.accountId || undefined,
        allocatedAmount: round2(Number(form.allocatedAmount)),
        notes: form.notes
      });
      setIsModalOpen(false);
      await onRefresh();
      showToast('Budget saved.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save budget', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteBudget(id);
      setConfirmDeleteId(null);
      await onRefresh();
      showToast('Budget deleted.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Allocated Budget</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(summary.totalAllocated)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Actual Spend YTD</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(summary.totalActual)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Remaining Variance</div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${summary.totalVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(summary.totalVariance)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Projected Run-Rate Spend</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">{formatINR(summary.totalForecast)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Budget vs Actual & Forecast Control</h3>
          <p className="text-xs text-slate-500">Monitor departmental, ledger, and project spending against approved allocations</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Create Budget
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Budget Name</th>
                <th className="py-2.5 px-4">Period / Scope</th>
                <th className="py-2.5 px-4 text-right">Allocated (₹)</th>
                <th className="py-2.5 px-4 text-right">Actual (₹)</th>
                <th className="py-2.5 px-4 text-right">Variance (₹)</th>
                <th className="py-2.5 px-4 text-right">Forecast (₹)</th>
                <th className="py-2.5 px-4 w-44">Utilization</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No fiscal budgets defined yet. Create a budget to track actuals and run-rate forecasts.
                  </td>
                </tr>
              ) : (
                rows.map(({ budget, actualSpend, variance, utilizationPercent, projectedSpend, statusFlag }) => (
                  <tr key={budget.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{budget.name}</div>
                      {budget.projectTitle && <div className="text-[11px] text-slate-500">{budget.projectTitle}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{budget.periodLabel} ({budget.periodType})</div>
                      <div className="text-[11px] text-slate-400">{[budget.department, budget.category].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(budget.allocatedAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {formatINR(actualSpend)}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatINR(variance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatINR(projectedSpend)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span
                          className={
                            statusFlag === 'OVER_BUDGET'
                              ? 'text-rose-700 font-bold'
                              : statusFlag === 'NEAR_LIMIT'
                              ? 'text-amber-700 font-semibold'
                              : 'text-emerald-700'
                          }
                        >
                          {utilizationPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            statusFlag === 'OVER_BUDGET'
                              ? 'bg-rose-600'
                              : statusFlag === 'NEAR_LIMIT'
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.min(100, utilizationPercent)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => openModal(budget)}
                            className="text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 inline" />
                          </button>
                          {confirmDeleteId === budget.id ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(budget.id)}
                              className="text-rose-700 font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(budget.id)}
                              className="text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">{form.id ? 'Edit Budget' : 'Create Fiscal Budget'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Budget Title *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Solar Module Procurement Q2"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fiscal Year</label>
                  <input
                    type="text"
                    required
                    value={form.fiscalYear}
                    onChange={e => setForm({ ...form, fiscalYear: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period Type</label>
                  <select
                    value={form.periodType}
                    onChange={e => setForm({ ...form, periodType: e.target.value as 'ANNUAL' | 'QUARTERLY' | 'MONTHLY' })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="ANNUAL">ANNUAL</option>
                    <option value="QUARTERLY">QUARTERLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period Label *</label>
                  <input
                    type="text"
                    required
                    value={form.periodLabel}
                    onChange={e => setForm({ ...form, periodLabel: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Allocated Amount (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.allocatedAmount}
                    onChange={e => setForm({ ...form, allocatedAmount: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Expense Ledger</label>
                  <select
                    value={form.accountId}
                    onChange={e => setForm({ ...form, accountId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">— Match by Category / Project —</option>
                    {workspace.accounts
                      .filter(a => a.accountType === 'EXPENSE')
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project (Optional)</label>
                  <select
                    value={form.projectId}
                    onChange={e => setForm({ ...form, projectId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">— Company-Wide —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} · {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
