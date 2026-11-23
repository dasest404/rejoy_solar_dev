import React, { useState, useEffect } from 'react';
import { AccountingWorkspace, AccountingSettings } from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { formatDateIN } from './accountingUtils';
import { Save, ShieldCheck } from 'lucide-react';

interface FinanceSettingsTabProps {
  workspace: AccountingWorkspace;
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const FinanceSettingsTab: React.FC<FinanceSettingsTabProps> = ({
  workspace,
  canManage,
  onRefresh,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'CONFIG' | 'AUDIT'>('CONFIG');
  const [form, setForm] = useState<AccountingSettings>({ ...workspace.settings });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...workspace.settings });
  }, [workspace.settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    try {
      await apiClient.updateAccountingSettings({
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
        activeFiscalYear: form.activeFiscalYear,
        lockDate: form.lockDate || null,
        currency: form.currency,
        approvalThreshold: Number(form.approvalThreshold || 0),
        requireExpenseApproval: Boolean(form.requireExpenseApproval),
        autoPostErpVouchers: Boolean(form.autoPostErpVouchers),
        journalPrefix: form.journalPrefix,
        billPrefix: form.billPrefix,
        voucherPrefix: form.voucherPrefix,
        defaultCashAccountId: form.defaultCashAccountId,
        defaultBankAccountId: form.defaultBankAccountId,
        defaultArAccountId: form.defaultArAccountId,
        defaultApAccountId: form.defaultApAccountId,
        defaultSalesAccountId: form.defaultSalesAccountId,
        defaultCogsAccountId: form.defaultCogsAccountId,
        defaultOutputGstAccountId: form.defaultOutputGstAccountId,
        defaultInputGstAccountId: form.defaultInputGstAccountId,
        defaultTdsAccountId: form.defaultTdsAccountId,
        defaultPayrollAccountId: form.defaultPayrollAccountId,
        defaultDepExpenseAccountId: form.defaultDepExpenseAccountId,
        defaultDisposalGainLossAccountId: form.defaultDisposalGainLossAccountId
      });
      await onRefresh();
      showToast('Accounting settings updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save accounting settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderAccountSelect = (label: string, field: keyof AccountingSettings) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <select
        disabled={!canManage}
        value={String(form[field] || '')}
        onChange={e => setForm({ ...form, [field]: e.target.value })}
        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 disabled:bg-slate-50"
      >
        {workspace.accounts
          .slice()
          .sort((a, b) => a.code.localeCompare(b.code))
          .map(a => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name} ({a.accountType})
            </option>
          ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('CONFIG')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            subTab === 'CONFIG' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Fiscal Year, Lock Date & Ledger Mappings
        </button>
        <button
          type="button"
          onClick={() => setSubTab('AUDIT')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            subTab === 'AUDIT' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Accounting Audit Trail ({workspace.auditLogs.length})
        </button>
      </div>

      {subTab === 'CONFIG' && (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Fiscal Period & Internal Controls</h3>
            <p className="text-xs text-slate-500">Define fiscal year boundaries, transaction lock dates, and approval rules</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Active Fiscal Year</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={form.activeFiscalYear}
                  onChange={e => setForm({ ...form, activeFiscalYear: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fiscal Start Month</label>
                <select
                  disabled={!canManage}
                  value={form.fiscalYearStartMonth}
                  onChange={e => setForm({ ...form, fiscalYearStartMonth: Number(e.target.value) })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                >
                  <option value={4}>April (Indian FY)</option>
                  <option value={1}>January (Calendar Year)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Period Lock Date (No Edits On/Before)</label>
                <input
                  type="date"
                  disabled={!canManage}
                  value={form.lockDate || ''}
                  onChange={e => setForm({ ...form, lockDate: e.target.value || null })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Approval Threshold (₹)</label>
                <input
                  type="number"
                  min="0"
                  disabled={!canManage}
                  value={form.approvalThreshold}
                  onChange={e => setForm({ ...form, approvalThreshold: Number(e.target.value) })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Journal Prefix</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={form.journalPrefix}
                  onChange={e => setForm({ ...form, journalPrefix: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Bill Prefix</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={form.billPrefix}
                  onChange={e => setForm({ ...form, billPrefix: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Payment Prefix</label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={form.voucherPrefix}
                  onChange={e => setForm({ ...form, voucherPrefix: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 mt-4 text-xs">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.requireExpenseApproval}
                  onChange={e => setForm({ ...form, requireExpenseApproval: e.target.checked })}
                />
                Require Manager/Accountant Approval on Reimbursements & Above-Threshold Expenses
              </label>
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={form.autoPostErpVouchers}
                  onChange={e => setForm({ ...form, autoPostErpVouchers: e.target.checked })}
                />
                Auto-Post Approved Operational Vouchers to General Ledger
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Default Chart of Accounts Mapping</h3>
            <p className="text-xs text-slate-500">System ledger accounts used when auto-posting ERP transactions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {renderAccountSelect('Default Cash Account', 'defaultCashAccountId')}
              {renderAccountSelect('Default Bank Account', 'defaultBankAccountId')}
              {renderAccountSelect('Accounts Receivable (Debtors)', 'defaultArAccountId')}
              {renderAccountSelect('Accounts Payable (Creditors)', 'defaultApAccountId')}
              {renderAccountSelect('Default EPC Sales Revenue', 'defaultSalesAccountId')}
              {renderAccountSelect('Default Direct COGS Account', 'defaultCogsAccountId')}
              {renderAccountSelect('Output GST Payable', 'defaultOutputGstAccountId')}
              {renderAccountSelect('Input GST Credit (ITC)', 'defaultInputGstAccountId')}
              {renderAccountSelect('TDS Payable Ledger', 'defaultTdsAccountId')}
              {renderAccountSelect('Salaries & Wages Expense', 'defaultPayrollAccountId')}
              {renderAccountSelect('Depreciation Expense', 'defaultDepExpenseAccountId')}
              {renderAccountSelect('Asset Disposal Gain / Loss', 'defaultDisposalGainLossAccountId')}
            </div>
          </div>

          {canManage && (
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Accounting Configuration'}
              </button>
            </div>
          )}
        </form>
      )}

      {subTab === 'AUDIT' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Immutable Financial Audit Trail
            </span>
            <span className="text-slate-500">Latest {workspace.auditLogs.length} events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Actor & Role</th>
                  <th className="py-2.5 px-4">Module</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Reference</th>
                  <th className="py-2.5 px-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No accounting audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  workspace.auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatDateIN(log.createdAt)} {log.createdAt.slice(11, 16)}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {log.actorName} <span className="text-slate-400">({log.actorRole})</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{log.module}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{log.action}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{log.entityRef || log.entityId}</td>
                      <td className="py-2.5 px-4 text-slate-700">{log.summary}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
