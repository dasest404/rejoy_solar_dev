import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  ExpenseRecord,
  SolarProject,
  Employee,
  SystemSettings
} from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { generateTallyExpenseXML } from '../../services/tally';
import { formatINR, formatDateIN, round2 } from './accountingUtils';
import { Plus, Search, CheckCircle2, XCircle, Wallet, FileCode, X } from 'lucide-react';

interface ExpensesFinanceTabProps {
  workspace: AccountingWorkspace;
  expenses: ExpenseRecord[];
  projects: SolarProject[];
  employees: Employee[];
  settings: SystemSettings;
  canEdit: boolean;
  canApprove: boolean;
  onRefresh: () => Promise<void>;
  onOpenXml: (xml: string) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ExpensesFinanceTab: React.FC<ExpensesFinanceTabProps> = ({
  workspace,
  expenses,
  projects,
  employees,
  settings,
  canEdit,
  canApprove,
  onRefresh,
  onOpenXml,
  showToast
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DIRECT_EXPENSE' | 'REIMBURSEMENT' | 'PENDING_APPROVAL'>('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payModalExpense, setPayModalExpense] = useState<ExpenseRecord | null>(null);
  const [payBankId, setPayBankId] = useState(
    workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || ''
  );
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    expenseDate: today,
    expenseType: 'DIRECT_EXPENSE' as 'DIRECT_EXPENSE' | 'REIMBURSEMENT',
    category: 'Site Travel & Logistics',
    vendorName: '',
    employeeId: '',
    projectId: '',
    amount: 0,
    gstAmount: 0,
    itcEligible: false,
    paymentMode: 'Bank NEFT/RTGS',
    referenceNo: '',
    expenseAccountId: 'acc-5020',
    notes: ''
  });

  const totals = useMemo(() => {
    const approvedPaid = round2(
      expenses
        .filter(e => e.status !== 'REJECTED')
        .reduce((s, e) => s + Number(e.amount || 0), 0)
    );
    const pendingCount = expenses.filter(e => e.status === 'PENDING_APPROVAL').length;
    const pendingReimb = round2(
      expenses
        .filter(e => e.expenseType === 'REIMBURSEMENT' && e.status !== 'PAID' && e.status !== 'REJECTED')
        .reduce((s, e) => s + Number(e.amount || 0), 0)
    );
    return { approvedPaid, pendingCount, pendingReimb };
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter(e => {
        if (filterType === 'PENDING_APPROVAL') return e.status === 'PENDING_APPROVAL';
        if (filterType === 'REIMBURSEMENT') return e.expenseType === 'REIMBURSEMENT';
        if (filterType === 'DIRECT_EXPENSE') return e.expenseType !== 'REIMBURSEMENT';
        return true;
      })
      .filter(
        e =>
          !q ||
          e.expenseNumber.toLowerCase().includes(q) ||
          e.vendorName.toLowerCase().includes(q) ||
          (e.employeeName || '').toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
  }, [expenses, filterType, search]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const emp = employees.find(em => em.id === form.employeeId);
      const proj = projects.find(p => p.id === form.projectId);
      await apiClient.saveAccountingExpense({
        expenseDate: form.expenseDate,
        expenseType: form.expenseType,
        category: form.category,
        vendorName: form.expenseType === 'REIMBURSEMENT' && emp ? emp.name : form.vendorName.trim(),
        employeeId: emp?.id,
        employeeName: emp?.name,
        projectId: proj?.id,
        projectCode: proj?.projectCode,
        amount: round2(Number(form.amount)),
        gstAmount: round2(Number(form.gstAmount || 0)),
        itcEligible: form.itcEligible,
        paymentMode: form.paymentMode,
        referenceNo: form.referenceNo,
        expenseAccountId: form.expenseAccountId,
        notes: form.notes
      });
      setIsModalOpen(false);
      await onRefresh();
      showToast('Expense entry submitted to finance workflow.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED', reason?: string) => {
    setBusyId(id);
    try {
      await apiClient.approveAccountingExpense(id, decision, reason);
      setRejectTargetId(null);
      setRejectReason('');
      await onRefresh();
      showToast(`Expense ${decision.toLowerCase()}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handlePayExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalExpense || busyId) return;
    setBusyId(payModalExpense.id);
    try {
      await apiClient.payAccountingExpense(payModalExpense.id, {
        bankAccountId: payBankId,
        paidDate: today
      });
      setPayModalExpense(null);
      await onRefresh();
      showToast('Expense disbursed & posted to general ledger.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to pay expense', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Active Expenses</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totals.approvedPaid)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Approval threshold: {formatINR(workspace.settings.approvalThreshold)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Pending Approval Queue</div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${totals.pendingCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {totals.pendingCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Requiring manager/accountant sign-off</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Unpaid Reimbursements</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totals.pendingReimb)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Employee claims awaiting disbursement</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `All (${expenses.length})` },
              { id: 'DIRECT_EXPENSE', label: 'Direct Expenses' },
              { id: 'REIMBURSEMENT', label: 'Employee Reimbursements' },
              { id: 'PENDING_APPROVAL', label: `Pending Approval (${totals.pendingCount})` }
            ] as const
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                filterType === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search voucher, payee, category..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-52"
            />
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Record Expense / Claim
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Voucher #</th>
                <th className="py-2.5 px-4">Type / Date</th>
                <th className="py-2.5 px-4">Payee / Employee</th>
                <th className="py-2.5 px-4">Category / Project</th>
                <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                <th className="py-2.5 px-4">Workflow Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No expenses or reimbursements match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map(exp => {
                  const st = exp.status || 'APPROVED';
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{exp.expenseNumber}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-800">
                          {exp.expenseType === 'REIMBURSEMENT' ? 'Reimbursement' : 'Direct Expense'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{formatDateIN(exp.expenseDate || exp.date)}</div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {exp.employeeName || exp.vendorName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        <div>{exp.category}</div>
                        {exp.projectCode && <div className="font-mono text-[11px] text-slate-400">Project {exp.projectCode}</div>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatINR(exp.amount)}
                        {exp.itcEligible && Number(exp.gstAmount) > 0 && (
                          <div className="text-[10px] text-emerald-700 font-normal">ITC {formatINR(exp.gstAmount || 0)}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-semibold ${
                            st === 'PAID' || st === 'APPROVED'
                              ? 'text-emerald-700'
                              : st === 'REJECTED'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                        {canApprove && st === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === exp.id}
                              onClick={() => handleDecision(exp.id, 'APPROVED')}
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === exp.id}
                              onClick={() => setRejectTargetId(exp.id)}
                              className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-800 font-semibold cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {canApprove && st === 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => setPayModalExpense(exp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer"
                          >
                            <Wallet className="w-3 h-3" /> Pay
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenXml(generateTallyExpenseXML(exp, settings))}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" /> XML
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Reject Expense Claim</h4>
            <input
              type="text"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTargetId(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDecision(rejectTargetId, 'REJECTED', rejectReason)}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Expense Modal */}
      {payModalExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Disburse {payModalExpense.expenseNumber}</h3>
              <button type="button" onClick={() => setPayModalExpense(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePayExpense} className="p-5 space-y-3">
              <div className="text-xs text-slate-600">
                Payee: <strong className="text-slate-900">{payModalExpense.employeeName || payModalExpense.vendorName}</strong> ·{' '}
                Amount: <strong className="font-mono text-slate-900">{formatINR(payModalExpense.amount)}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Disburse From Cash / Bank *</label>
                <select
                  required
                  value={payBankId}
                  onChange={e => setPayBankId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                >
                  {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.accountName} ({formatINR(b.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalExpense(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === payModalExpense.id}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Disburse & Post Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Record Expense or Employee Reimbursement</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Type</label>
                  <select
                    value={form.expenseType}
                    onChange={e => setForm({ ...form, expenseType: e.target.value as 'DIRECT_EXPENSE' | 'REIMBURSEMENT' })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="DIRECT_EXPENSE">Direct Expense</option>
                    <option value="REIMBURSEMENT">Employee Reimbursement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={form.expenseDate}
                    onChange={e => setForm({ ...form, expenseDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {form.expenseType === 'REIMBURSEMENT' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                    <select
                      required
                      value={form.employeeId}
                      onChange={e => setForm({ ...form, employeeId: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Payee *</label>
                    <input
                      type="text"
                      required
                      value={form.vendorName}
                      onChange={e => setForm({ ...form, vendorName: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Included GST (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gstAmount}
                    onChange={e => setForm({ ...form, gstAmount: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Ledger</label>
                  <select
                    value={form.expenseAccountId}
                    onChange={e => setForm({ ...form, expenseAccountId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    {workspace.accounts
                      .filter(a => a.accountType === 'EXPENSE')
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project (Optional)</label>
                  <select
                    value={form.projectId}
                    onChange={e => setForm({ ...form, projectId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">— General Overhead —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} · {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.itcEligible}
                  onChange={e => setForm({ ...form, itcEligible: e.target.checked })}
                />
                GST Input Tax Credit (ITC) Eligible
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Justification</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
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
                  {saving ? 'Submitting...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
