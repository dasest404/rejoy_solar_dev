import React, { useState, useMemo } from 'react';
import { AccountingWorkspace, BankAccount } from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { buildAccountLedger, formatINR, formatDateIN, round2 } from './accountingUtils';
import { Plus, ArrowLeftRight, CheckCircle2, X, Landmark, Wallet, Trash2, AlertCircle } from 'lucide-react';

interface CashBankTabProps {
  workspace: AccountingWorkspace;
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CashBankTab: React.FC<CashBankTabProps> = ({
  workspace,
  canManage,
  onRefresh,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'ACCOUNTS' | 'CASH_BOOK' | 'TRANSFERS' | 'RECONCILIATION'>('ACCOUNTS');
  const today = new Date().toISOString().slice(0, 10);

  // Add/Edit Account Modal
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [savingAcc, setSavingAcc] = useState(false);
  const [accError, setAccError] = useState<string | null>(null);
  const [confirmDeleteBankId, setConfirmDeleteBankId] = useState<string | null>(null);
  const [busyBankId, setBusyBankId] = useState<string | null>(null);
  const [accForm, setAccForm] = useState({
    id: '',
    accountName: '',
    accountType: 'BANK' as 'CASH' | 'BANK',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    coaAccountId: 'acc-1020',
    openingBalance: 0,
    isPrimary: false,
    isActive: true
  });

  // Contra Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [confirmDeleteTransferId, setConfirmDeleteTransferId] = useState<string | null>(null);
  const [busyTransferId, setBusyTransferId] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({
    transferDate: today,
    fromAccountId: workspace.bankAccounts[0]?.id || '',
    toAccountId: workspace.bankAccounts[1]?.id || workspace.bankAccounts[0]?.id || '',
    amount: 0,
    mode: 'Bank Transfer / Contra',
    referenceNo: '',
    notes: ''
  });

  // Cash Book / Register selection
  const [selectedBankId, setSelectedBankId] = useState<string>(
    () => workspace.bankAccounts[0]?.id || ''
  );

  // Reconciliation State
  const [reconBankId, setReconBankId] = useState<string>(
    () => workspace.bankAccounts.find(b => b.accountType === 'BANK')?.id || workspace.bankAccounts[0]?.id || ''
  );
  const [activeReconId, setActiveReconId] = useState<string | null>(null);
  const [statementDate, setStatementDate] = useState(today);
  const [statementBalance, setStatementBalance] = useState<number>(0);
  const [clearedIds, setClearedIds] = useState<string[]>([]);
  const [reconNotes, setReconNotes] = useState('');
  const [savingRecon, setSavingRecon] = useState(false);
  const [confirmDeleteReconId, setConfirmDeleteReconId] = useState<string | null>(null);
  const [busyReconId, setBusyReconId] = useState<string | null>(null);

  const totalCash = useMemo(
    () => round2(workspace.bankAccounts.filter(b => b.isActive && b.accountType === 'CASH').reduce((s, b) => s + b.currentBalance, 0)),
    [workspace.bankAccounts]
  );
  const totalBank = useMemo(
    () => round2(workspace.bankAccounts.filter(b => b.isActive && b.accountType === 'BANK').reduce((s, b) => s + b.currentBalance, 0)),
    [workspace.bankAccounts]
  );

  const selectedBank = useMemo(
    () => workspace.bankAccounts.find(b => b.id === selectedBankId) || workspace.bankAccounts[0] || null,
    [workspace.bankAccounts, selectedBankId]
  );

  const cashBookLedger = useMemo(() => {
    if (!selectedBank) return null;
    const coa = workspace.accounts.find(a => a.id === selectedBank.coaAccountId);
    if (!coa) return null;
    return buildAccountLedger(coa, workspace.journals);
  }, [selectedBank, workspace.accounts, workspace.journals]);

  const reconBank = useMemo(
    () => workspace.bankAccounts.find(b => b.id === reconBankId) || workspace.bankAccounts[0] || null,
    [workspace.bankAccounts, reconBankId]
  );

  const reconLedger = useMemo(() => {
    if (!reconBank) return null;
    const coa = workspace.accounts.find(a => a.id === reconBank.coaAccountId);
    if (!coa) return null;
    return buildAccountLedger(coa, workspace.journals, undefined, statementDate);
  }, [reconBank, workspace.accounts, workspace.journals, statementDate]);

  const clearedLedgerBalance = useMemo(() => {
    if (!reconBank || !reconLedger) return 0;
    let bal = Number(reconBank.openingBalance || 0);
    for (const r of reconLedger.rows) {
      if (clearedIds.includes(r.lineId)) {
        bal = round2(bal + r.debit - r.credit);
      }
    }
    return bal;
  }, [reconBank, reconLedger, clearedIds]);

  const reconDifference = round2(Number(statementBalance || 0) - clearedLedgerBalance);

  const openNewBankModal = () => {
    setAccError(null);
    setAccForm({
      id: '',
      accountName: '',
      accountType: 'BANK',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branch: '',
      coaAccountId: 'acc-1020',
      openingBalance: 0,
      isPrimary: false,
      isActive: true
    });
    setIsAccountModalOpen(true);
  };

  const openEditBankModal = (b: BankAccount) => {
    setAccError(null);
    setAccForm({
      id: b.id,
      accountName: b.accountName,
      accountType: b.accountType,
      bankName: b.bankName || '',
      accountNumber: b.accountNumber || '',
      ifscCode: b.ifscCode || '',
      branch: b.branch || '',
      coaAccountId: b.coaAccountId,
      openingBalance: b.openingBalance,
      isPrimary: b.isPrimary,
      isActive: b.isActive !== false
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAcc) return;
    setAccError(null);
    setSavingAcc(true);
    try {
      await apiClient.saveBankAccount({
        id: accForm.id || undefined,
        accountName: accForm.accountName.trim(),
        accountType: accForm.accountType,
        bankName: accForm.bankName.trim(),
        accountNumber: accForm.accountNumber.trim(),
        ifscCode: accForm.ifscCode.trim().toUpperCase(),
        branch: accForm.branch.trim(),
        coaAccountId: accForm.coaAccountId,
        openingBalance: Number(accForm.openingBalance || 0),
        isPrimary: accForm.isPrimary,
        isActive: accForm.isActive
      });
      setIsAccountModalOpen(false);
      await onRefresh();
      showToast('Cash/Bank register saved.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save bank account';
      setAccError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingAcc(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (busyBankId) return;
    setBusyBankId(id);
    try {
      await apiClient.deleteBankAccount(id);
      setConfirmDeleteBankId(null);
      await onRefresh();
      showToast('Bank/Cash register deleted.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete register', 'error');
    } finally {
      setBusyBankId(null);
    }
  };

  const handleRecordTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingTransfer) return;
    setTransferError(null);
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      const msg = 'Source and destination accounts must be different.';
      setTransferError(msg);
      showToast(msg, 'error');
      return;
    }
    setSavingTransfer(true);
    try {
      await apiClient.recordBankTransfer({
        transferDate: transferForm.transferDate,
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: round2(Number(transferForm.amount)),
        mode: transferForm.mode,
        referenceNo: transferForm.referenceNo,
        notes: transferForm.notes
      });
      setIsTransferModalOpen(false);
      await onRefresh();
      showToast('Contra fund transfer posted.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Transfer failed';
      setTransferError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (busyTransferId) return;
    setBusyTransferId(id);
    try {
      await apiClient.deleteBankTransfer(id);
      setConfirmDeleteTransferId(null);
      await onRefresh();
      showToast('Contra transfer reversed and balances restored.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reverse transfer', 'error');
    } finally {
      setBusyTransferId(null);
    }
  };

  const handleSaveReconciliation = async (status: 'DRAFT' | 'RECONCILED') => {
    if (!reconBank || savingRecon) return;
    setSavingRecon(true);
    try {
      await apiClient.saveBankReconciliation({
        id: activeReconId || undefined,
        bankAccountId: reconBank.id,
        statementDate,
        statementBalance: round2(Number(statementBalance)),
        clearedTxnIds: clearedIds,
        status,
        notes: reconNotes
      });
      if (status === 'RECONCILED') setActiveReconId(null);
      await onRefresh();
      showToast(`Bank reconciliation ${status === 'RECONCILED' ? 'completed' : 'saved as draft'}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save reconciliation', 'error');
    } finally {
      setSavingRecon(false);
    }
  };

  const handleDeleteReconciliation = async (id: string) => {
    if (busyReconId) return;
    setBusyReconId(id);
    try {
      await apiClient.deleteBankReconciliation(id);
      if (activeReconId === id) setActiveReconId(null);
      setConfirmDeleteReconId(null);
      await onRefresh();
      showToast('Reconciliation draft deleted.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete reconciliation draft', 'error');
    } finally {
      setBusyReconId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Cash in Hand / Petty Cash</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totalCash)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {workspace.bankAccounts.filter(b => b.accountType === 'CASH').length} cash drawer(s)
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Bank Current / CC Balances</span>
            <Landmark className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totalBank)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {workspace.bankAccounts.filter(b => b.accountType === 'BANK').length} bank account(s)
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Liquid Funds</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {formatINR(round2(totalCash + totalBank))}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {workspace.bankTransfers.length} contra transfers · {workspace.bankReconciliations.length} reconciliations
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ACCOUNTS', label: 'Bank & Cash Accounts' },
              { id: 'CASH_BOOK', label: 'Cash & Bank Book' },
              { id: 'TRANSFERS', label: `Contra Transfers (${workspace.bankTransfers.length})` },
              { id: 'RECONCILIATION', label: 'Bank Reconciliation' }
            ] as const
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                subTab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTransferError(null);
                setTransferForm(f => ({
                  ...f,
                  fromAccountId: workspace.bankAccounts[0]?.id || '',
                  toAccountId: workspace.bankAccounts[1]?.id || workspace.bankAccounts[0]?.id || ''
                }));
                setIsTransferModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Fund Transfer (Contra)
            </button>
            <button
              type="button"
              onClick={openNewBankModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Bank / Cash
            </button>
          </div>
        )}
      </div>

      {/* 1. ACCOUNTS GRID */}
      {subTab === 'ACCOUNTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspace.bankAccounts.map(b => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      {b.accountType} {b.isPrimary ? '· PRIMARY' : ''} {!b.isActive ? '· INACTIVE' : ''}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{b.accountName}</h4>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditBankModal(b)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Edit
                      </button>
                      {!b.isPrimary && (
                        confirmDeleteBankId === b.id ? (
                          <button
                            type="button"
                            disabled={busyBankId === b.id}
                            onClick={() => handleDeleteBankAccount(b.id)}
                            className="text-xs font-bold text-rose-700 cursor-pointer"
                          >
                            {busyBankId === b.id ? '...' : 'Confirm Del'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBankId(b.id)}
                            title="Delete Account"
                            className="text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
                {b.accountType === 'BANK' && (
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5 font-mono">
                    <div>{b.bankName || 'Bank Account'} {b.branch ? `· ${b.branch}` : ''}</div>
                    <div>A/C: {b.accountNumber || '—'} · IFSC: {b.ifscCode || '—'}</div>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Current Book Balance</span>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {formatINR(b.currentBalance)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBankId(b.id);
                    setSubTab('CASH_BOOK');
                  }}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  View Book →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. CASH & BANK BOOK */}
      {subTab === 'CASH_BOOK' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cash & Bank Ledger Register</h3>
              <p className="text-xs text-slate-500">Chronological inflows and outflows with running balance</p>
            </div>
            <select
              value={selectedBank?.id || ''}
              onChange={e => setSelectedBankId(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2"
            >
              {workspace.bankAccounts.map(b => (
                <option key={b.id} value={b.id}>
                  {b.accountName} ({b.accountType}) — {formatINR(b.currentBalance)}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3">Party</th>
                  <th className="py-2.5 px-3 text-right">Receipt / Dr (₹)</th>
                  <th className="py-2.5 px-3 text-right">Payment / Cr (₹)</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!cashBookLedger || cashBookLedger.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No cash/bank entries posted to this register yet.
                    </td>
                  </tr>
                ) : (
                  cashBookLedger.rows.map(r => (
                    <tr key={r.lineId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-600">{formatDateIN(r.entryDate)}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900">{r.entryNumber}</td>
                      <td className="py-2 px-3 text-slate-700">{r.narration}</td>
                      <td className="py-2 px-3 text-slate-500">{r.partyName || '—'}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">
                        {r.debit > 0 ? formatINR(r.debit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-700">
                        {r.credit > 0 ? formatINR(r.credit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatINR(r.runningBalance)} {r.balanceOrientation}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CONTRA TRANSFERS */}
      {subTab === 'TRANSFERS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Transfer #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">From Account</th>
                  <th className="py-2.5 px-4">To Account</th>
                  <th className="py-2.5 px-4">Mode / Ref</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.bankTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No contra fund transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  workspace.bankTransfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{t.transferNumber}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateIN(t.transferDate)}</td>
                      <td className="py-2.5 px-4 text-rose-700 font-medium">{t.fromAccountName || t.fromAccountId}</td>
                      <td className="py-2.5 px-4 text-emerald-700 font-medium">{t.toAccountName || t.toAccountId}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {t.mode}
                        {t.referenceNo ? ` · ${t.referenceNo}` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatINR(t.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {canManage && (
                          confirmDeleteTransferId === t.id ? (
                            <button
                              type="button"
                              disabled={busyTransferId === t.id}
                              onClick={() => handleDeleteTransfer(t.id)}
                              className="text-rose-700 font-bold cursor-pointer"
                            >
                              {busyTransferId === t.id ? '...' : 'Confirm Rev'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTransferId(t.id)}
                              title="Reverse / Delete Transfer"
                              className="text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. BANK RECONCILIATION */}
      {subTab === 'RECONCILIATION' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account</label>
                <select
                  value={reconBankId}
                  onChange={e => {
                    setReconBankId(e.target.value);
                    setActiveReconId(null);
                    setClearedIds([]);
                  }}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                >
                  {workspace.bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.accountName} ({formatINR(b.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Statement Cut-off Date</label>
                <input
                  type="date"
                  value={statementDate}
                  onChange={e => setStatementDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Closing Bank Statement Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={statementBalance}
                  onChange={e => setStatementBalance(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reconciliation Notes</label>
                <input
                  type="text"
                  value={reconNotes}
                  onChange={e => setReconNotes(e.target.value)}
                  placeholder="Optional remark"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-y border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Cleared Book Balance</span>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{formatINR(clearedLedgerBalance)}</div>
              </div>
              <div>
                <span className="text-slate-500">Bank Statement Balance</span>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{formatINR(statementBalance)}</div>
              </div>
              <div>
                <span className="text-slate-500">Unreconciled Difference</span>
                <div className={`font-mono font-bold mt-0.5 ${Math.abs(reconDifference) < 0.05 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatINR(reconDifference)} {Math.abs(reconDifference) < 0.05 ? '· Matched' : ''}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3 w-10">Clear</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Voucher #</th>
                    <th className="py-2 px-3">Narration</th>
                    <th className="py-2 px-3 text-right">Deposit (₹)</th>
                    <th className="py-2 px-3 text-right">Withdrawal (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reconLedger || reconLedger.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No ledger transactions in this account up to {formatDateIN(statementDate)}.
                      </td>
                    </tr>
                  ) : (
                    reconLedger.rows.map(r => {
                      const checked = clearedIds.includes(r.lineId);
                      return (
                        <tr key={r.lineId} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e =>
                                setClearedIds(prev =>
                                  e.target.checked ? [...prev, r.lineId] : prev.filter(id => id !== r.lineId)
                                )
                              }
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{formatDateIN(r.entryDate)}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-900">{r.entryNumber}</td>
                          <td className="py-2 px-3 text-slate-700">{r.narration}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">
                            {r.debit > 0 ? formatINR(r.debit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-700">
                            {r.credit > 0 ? formatINR(r.credit) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {canManage && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingRecon}
                  onClick={() => handleSaveReconciliation('DRAFT')}
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={savingRecon}
                  onClick={() => handleSaveReconciliation('RECONCILED')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reconciled
                </button>
              </div>
            )}
          </div>

          {workspace.bankReconciliations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 text-xs font-bold text-slate-900">
                Reconciliation History
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2 px-4">Statement Date</th>
                    <th className="py-2 px-4">Account</th>
                    <th className="py-2 px-4 text-right">Book Balance</th>
                    <th className="py-2 px-4 text-right">Statement Balance</th>
                    <th className="py-2 px-4 text-right">Difference</th>
                    <th className="py-2 px-4">Status</th>
                    <th className="py-2 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workspace.bankReconciliations.map(rec => (
                    <tr key={rec.id}>
                      <td className="py-2 px-4 font-mono">{formatDateIN(rec.statementDate)}</td>
                      <td className="py-2 px-4 font-semibold text-slate-800">{rec.bankAccountName}</td>
                      <td className="py-2 px-4 text-right font-mono">{formatINR(rec.bookBalance)}</td>
                      <td className="py-2 px-4 text-right font-mono">{formatINR(rec.statementBalance)}</td>
                      <td className="py-2 px-4 text-right font-mono">{formatINR(rec.difference)}</td>
                      <td className={`py-2 px-4 font-semibold ${rec.status === 'RECONCILED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {rec.status}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap space-x-2">
                        {canManage && rec.status !== 'RECONCILED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReconId(rec.id);
                                setReconBankId(rec.bankAccountId);
                                setStatementDate(rec.statementDate);
                                setStatementBalance(rec.statementBalance);
                                setClearedIds(rec.clearedTxnIds || []);
                                setReconNotes(rec.notes || '');
                                showToast('Loaded reconciliation draft into workspace.', 'info');
                              }}
                              className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                            >
                              Resume
                            </button>
                            {confirmDeleteReconId === rec.id ? (
                              <button
                                type="button"
                                disabled={busyReconId === rec.id}
                                onClick={() => handleDeleteReconciliation(rec.id)}
                                className="text-rose-700 font-bold cursor-pointer"
                              >
                                {busyReconId === rec.id ? '...' : 'Confirm Del'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteReconId(rec.id)}
                                title="Delete Draft"
                                className="text-rose-600 hover:text-rose-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT BANK MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">{accForm.id ? 'Edit Register' : 'Add Cash / Bank Register'}</h3>
              <button type="button" onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBankAccount} className="p-5 space-y-3">
              {accError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{accError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Register Type *</label>
                  <select
                    value={accForm.accountType}
                    onChange={e =>
                      setAccForm({
                        ...accForm,
                        accountType: e.target.value as 'CASH' | 'BANK',
                        coaAccountId: e.target.value === 'CASH' ? 'acc-1010' : 'acc-1020'
                      })
                    }
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="BANK">BANK</option>
                    <option value="CASH">CASH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accForm.openingBalance}
                    onChange={e => setAccForm({ ...accForm, openingBalance: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Display Name *</label>
                <input
                  type="text"
                  required
                  value={accForm.accountName}
                  onChange={e => setAccForm({ ...accForm, accountName: e.target.value })}
                  placeholder="e.g. HDFC Current Account / Site Petty Cash"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              {accForm.accountType === 'BANK' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={accForm.bankName}
                        onChange={e => setAccForm({ ...accForm, bankName: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                      <input
                        type="text"
                        value={accForm.branch}
                        onChange={e => setAccForm({ ...accForm, branch: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={accForm.accountNumber}
                        onChange={e => setAccForm({ ...accForm, accountNumber: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={accForm.ifscCode}
                        onChange={e => setAccForm({ ...accForm, ifscCode: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono uppercase"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accForm.isPrimary}
                    onChange={e => setAccForm({ ...accForm, isPrimary: e.target.checked })}
                  />
                  Set as Primary Account
                </label>
                {accForm.id && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accForm.isActive}
                      onChange={e => setAccForm({ ...accForm, isActive: e.target.checked })}
                    />
                    Active Register
                  </label>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAcc}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer"
                >
                  {savingAcc ? 'Saving...' : 'Save Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTRA TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Contra Fund Transfer</h3>
              <button type="button" onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordTransfer} className="p-5 space-y-3">
              {transferError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">From Account *</label>
                <select
                  required
                  value={transferForm.fromAccountId}
                  onChange={e => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                >
                  {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.accountName} ({formatINR(b.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">To Account *</label>
                <select
                  required
                  value={transferForm.toAccountId}
                  onChange={e => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                >
                  {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.accountName} ({formatINR(b.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={transferForm.amount}
                    onChange={e => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    required
                    value={transferForm.transferDate}
                    onChange={e => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mode</label>
                  <input
                    type="text"
                    value={transferForm.mode}
                    onChange={e => setTransferForm({ ...transferForm, mode: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reference #</label>
                  <input
                    type="text"
                    value={transferForm.referenceNo}
                    onChange={e => setTransferForm({ ...transferForm, referenceNo: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTransfer}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer"
                >
                  {savingTransfer ? 'Transferring...' : 'Post Contra Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
