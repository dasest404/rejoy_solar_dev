import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  ChartAccount,
  AccountType,
  JournalEntry,
  SolarProject
} from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import {
  buildAccountLedger,
  buildTrialBalance,
  formatINR,
  formatDateIN,
  round2,
  downloadCsv
} from './accountingUtils';
import {
  Plus,
  Search,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Edit3,
  Download,
  X,
  AlertCircle
} from 'lucide-react';

interface AccountsLedgerTabProps {
  workspace: AccountingWorkspace;
  projects: SolarProject[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type SubTab = 'COA' | 'JOURNALS' | 'LEDGER' | 'TRIAL_BALANCE';

interface DraftLine {
  id: string;
  accountId: string;
  description: string;
  projectId: string;
  partyName: string;
  debit: number;
  credit: number;
}

export const AccountsLedgerTab: React.FC<AccountsLedgerTabProps> = ({
  workspace,
  projects,
  canManage,
  onRefresh,
  showToast
}) => {
  const [subTab, setSubTab] = useState<SubTab>('COA');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'ALL'>('ALL');

  // CoA Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [accountForm, setAccountForm] = useState({
    code: '',
    name: '',
    accountType: 'EXPENSE' as AccountType,
    subType: 'Operating Expense',
    openingBalance: 0,
    description: ''
  });
  const [savingAccount, setSavingAccount] = useState(false);

  // Journal Modal State
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [journalForm, setJournalForm] = useState({
    entryNumber: '',
    entryDate: new Date().toISOString().slice(0, 10),
    referenceNumber: '',
    narration: '',
    status: 'POSTED' as 'DRAFT' | 'POSTED'
  });
  const [journalLines, setJournalLines] = useState<DraftLine[]>([
    { id: 'l1', accountId: '', description: '', projectId: '', partyName: '', debit: 0, credit: 0 },
    { id: 'l2', accountId: '', description: '', projectId: '', partyName: '', debit: 0, credit: 0 }
  ]);
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReverseId, setConfirmReverseId] = useState<string | null>(null);
  const [reversedJournalIds, setReversedJournalIds] = useState<string[]>([]);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // General Ledger Filter State
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>(
    () => workspace.accounts[0]?.id || ''
  );
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // Trial Balance Filter
  const [tbAsOfDate, setTbAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.accounts
      .filter(a => typeFilter === 'ALL' || a.accountType === typeFilter)
      .filter(
        a =>
          !q ||
          a.code.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.subType.toLowerCase().includes(q)
      )
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [workspace.accounts, search, typeFilter]);

  const filteredJournals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.journals.filter(
      j =>
        !q ||
        j.entryNumber.toLowerCase().includes(q) ||
        j.narration.toLowerCase().includes(q) ||
        (j.referenceNumber || '').toLowerCase().includes(q)
    );
  }, [workspace.journals, search]);

  const reversedSourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of workspace.journals) {
      if (String(entry.referenceType || '').toUpperCase() === 'REVERSAL' && entry.referenceId) {
        ids.add(entry.referenceId);
      }
      if (entry.status === 'REVERSED') {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [workspace.journals]);

  const selectedLedgerAccount = useMemo(
    () => workspace.accounts.find(a => a.id === selectedLedgerAccountId) || workspace.accounts[0] || null,
    [workspace.accounts, selectedLedgerAccountId]
  );

  const ledgerResult = useMemo(() => {
    if (!selectedLedgerAccount) return null;
    return buildAccountLedger(selectedLedgerAccount, workspace.journals, ledgerStartDate || undefined, ledgerEndDate || undefined);
  }, [selectedLedgerAccount, workspace.journals, ledgerStartDate, ledgerEndDate]);

  const trialBalance = useMemo(
    () => buildTrialBalance(workspace.accounts, workspace.journals, tbAsOfDate || undefined),
    [workspace.accounts, workspace.journals, tbAsOfDate]
  );

  const journalTotals = useMemo(() => {
    const debit = round2(journalLines.reduce((s, l) => s + Number(l.debit || 0), 0));
    const credit = round2(journalLines.reduce((s, l) => s + Number(l.credit || 0), 0));
    const diff = round2(debit - credit);
    return { debit, credit, diff, isBalanced: debit > 0 && Math.abs(diff) < 0.01 };
  }, [journalLines]);

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({
      code: '',
      name: '',
      accountType: 'EXPENSE',
      subType: 'Operating Expense',
      openingBalance: 0,
      description: ''
    });
    setIsAccountModalOpen(true);
  };

  const openEditAccount = (acc: ChartAccount) => {
    setEditingAccount(acc);
    setAccountForm({
      code: acc.code,
      name: acc.name,
      accountType: acc.accountType,
      subType: acc.subType,
      openingBalance: acc.openingBalance,
      description: acc.description || ''
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAccount) return;
    setSavingAccount(true);
    try {
      await apiClient.saveAccountingAccount({
        id: editingAccount?.id,
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        accountType: accountForm.accountType,
        subType: accountForm.subType.trim(),
        openingBalance: Number(accountForm.openingBalance || 0),
        description: accountForm.description.trim()
      });
      setIsAccountModalOpen(false);
      await onRefresh();
      showToast(`Account ${accountForm.code} saved.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save account', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setBusyActionId(id);
    try {
      await apiClient.deleteAccountingAccount(id);
      setConfirmDeleteId(null);
      await onRefresh();
      showToast('Account removed.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete account', 'error');
    } finally {
      setBusyActionId(null);
    }
  };

  const openNewJournal = () => {
    setEditingJournalId(null);
    setJournalError(null);
    const defaultDr = workspace.accounts[0]?.id || '';
    const defaultCr = workspace.accounts[1]?.id || defaultDr;
    setJournalForm({
      entryNumber: '',
      entryDate: new Date().toISOString().slice(0, 10),
      referenceNumber: '',
      narration: '',
      status: 'POSTED'
    });
    setJournalLines([
      { id: `l-${Date.now()}-1`, accountId: defaultDr, description: '', projectId: '', partyName: '', debit: 0, credit: 0 },
      { id: `l-${Date.now()}-2`, accountId: defaultCr, description: '', projectId: '', partyName: '', debit: 0, credit: 0 }
    ]);
    setIsJournalModalOpen(true);
  };

  const openEditJournal = (j: JournalEntry) => {
    setEditingJournalId(j.id);
    setJournalError(null);
    setJournalForm({
      entryNumber: j.entryNumber,
      entryDate: j.entryDate,
      referenceNumber: j.referenceNumber || '',
      narration: j.narration,
      status: j.status === 'POSTED' ? 'POSTED' : 'DRAFT'
    });
    setJournalLines(
      j.lines.map((l, idx) => ({
        id: l.id || `l-${idx}`,
        accountId: l.accountId,
        description: l.description || '',
        projectId: l.projectId || '',
        partyName: l.partyName || '',
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0)
      }))
    );
    setIsJournalModalOpen(true);
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingJournal) return;
    setJournalError(null);

    const validLines = journalLines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) {
      setJournalError('At least two valid ledger lines (one debit, one credit) are required.');
      return;
    }
    if (!journalTotals.isBalanced) {
      setJournalError(`Unbalanced journal: Total Debit (${formatINR(journalTotals.debit)}) must equal Total Credit (${formatINR(journalTotals.credit)}).`);
      return;
    }

    setSavingJournal(true);
    try {
      await apiClient.saveJournalEntry({
        id: editingJournalId || undefined,
        entryNumber: journalForm.entryNumber || undefined,
        entryDate: journalForm.entryDate,
        referenceType: 'MANUAL',
        referenceNumber: journalForm.referenceNumber,
        narration: journalForm.narration,
        status: journalForm.status,
        lines: validLines.map(l => {
          const proj = projects.find(p => p.id === l.projectId);
          return {
            accountId: l.accountId,
            description: l.description,
            projectId: l.projectId || undefined,
            projectTitle: proj?.title || undefined,
            partyName: l.partyName || undefined,
            debit: round2(Number(l.debit || 0)),
            credit: round2(Number(l.credit || 0))
          };
        })
      });
      setIsJournalModalOpen(false);
      await onRefresh();
      showToast(`Journal entry ${journalForm.status === 'POSTED' ? 'posted' : 'saved as draft'}.`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save journal entry';
      setJournalError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingJournal(false);
    }
  };

  const handlePostDraft = async (id: string) => {
    setBusyActionId(id);
    try {
      await apiClient.postJournalEntry(id);
      await onRefresh();
      showToast('Draft journal posted to ledger.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to post journal', 'error');
    } finally {
      setBusyActionId(null);
    }
  };

  const isJournalReversed = (j: JournalEntry) =>
    j.status === 'REVERSED' ||
    Boolean(j.reversedEntryId) ||
    reversedSourceIds.has(j.id) ||
    reversedJournalIds.includes(j.id);

  const canReverseJournal = (j: JournalEntry) =>
    canManage &&
    j.status === 'POSTED' &&
    String(j.referenceType || '').toUpperCase() !== 'REVERSAL' &&
    !isJournalReversed(j);

  const handleReversePosted = async (id: string) => {
    if (busyActionId || reversedSourceIds.has(id) || reversedJournalIds.includes(id)) return;
    setConfirmReverseId(null);
    setBusyActionId(id);
    try {
      await apiClient.reverseJournalEntry(id);
      setReversedJournalIds(prev => (prev.includes(id) ? prev : [...prev, id]));
      await onRefresh();
      showToast('Reversing journal voucher posted.', 'success');
    } catch (err: any) {
      await onRefresh().catch(() => undefined);
      showToast(err?.message || 'Failed to reverse journal', 'error');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteDraftJournal = async (id: string) => {
    setBusyActionId(id);
    try {
      await apiClient.deleteJournalEntry(id);
      setConfirmDeleteId(null);
      await onRefresh();
      showToast('Draft journal deleted.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete draft journal', 'error');
    } finally {
      setBusyActionId(null);
    }
  };

  const openLedgerForAccount = (accountId: string) => {
    setSelectedLedgerAccountId(accountId);
    setSubTab('LEDGER');
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Sub-Navigation & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'COA', label: `Chart of Accounts (${workspace.accounts.length})` },
              { id: 'JOURNALS', label: `Journal Entries (${workspace.journals.length})` },
              { id: 'LEDGER', label: 'General Ledger' },
              { id: 'TRIAL_BALANCE', label: 'Trial Balance' }
            ] as { id: SubTab; label: string }[]
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto min-w-0">
          {(subTab === 'COA' || subTab === 'JOURNALS') && (
            <div className="relative flex-1 sm:flex-none min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={subTab === 'COA' ? 'Search code or account...' : 'Search voucher or narration...'}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-amber-500 w-full sm:w-56"
              />
            </div>
          )}

          {subTab === 'COA' && canManage && (
            <button
              type="button"
              onClick={openNewAccount}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Add Account
            </button>
          )}

          {subTab === 'JOURNALS' && canManage && (
            <button
              type="button"
              onClick={openNewJournal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" /> New Journal Entry
            </button>
          )}

          {subTab === 'TRIAL_BALANCE' && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `trial-balance-${tbAsOfDate}`,
                  ['Code', 'Account', 'Type', 'Period Debit', 'Period Credit', 'Closing Debit', 'Closing Credit'],
                  trialBalance.rows.map(r => [
                    r.code,
                    r.name,
                    r.accountType,
                    r.periodDebit,
                    r.periodCredit,
                    r.closingDebit,
                    r.closingCredit
                  ])
                )
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer w-full sm:w-auto"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* 1. CHART OF ACCOUNTS */}
      {subTab === 'COA' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-50">
            {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  typeFilter === t ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Mobile Stacked Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No matching ledger accounts found.</div>
            ) : (
              filteredAccounts.map(acc => (
                <div key={acc.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-800">{acc.code}</span>
                        <span className="font-semibold text-slate-500">{acc.accountType}</span>
                        {acc.isSystem && <span className="text-[10px] font-semibold text-slate-400">SYSTEM</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => openLedgerForAccount(acc.id)}
                        className="font-semibold text-slate-900 hover:text-amber-700 text-left mt-0.5 cursor-pointer"
                      >
                        {acc.name}
                      </button>
                      <div className="text-[11px] text-slate-500">{acc.subType}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Balance</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(acc.currentBalance)}</div>
                      <div className="text-[10px] font-mono text-slate-400">Open {formatINR(acc.openingBalance)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openLedgerForAccount(acc.id)}
                      className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                    >
                      View Ledger
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openEditAccount(acc)}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {canManage && !acc.isSystem && (
                      confirmDeleteId === acc.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyActionId === acc.id}
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="text-rose-700 font-bold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-500 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(acc.id)}
                          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tablet & Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Account Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Sub-Group</th>
                  <th className="py-2.5 px-4 text-right">Opening (₹)</th>
                  <th className="py-2.5 px-4 text-right">Balance (₹)</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No matching ledger accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map(acc => (
                    <tr key={acc.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">{acc.code}</td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => openLedgerForAccount(acc.id)}
                          className="font-semibold text-slate-900 hover:text-amber-700 text-left cursor-pointer"
                        >
                          {acc.name}
                        </button>
                        {acc.isSystem && (
                          <span className="ml-2 text-[10px] font-semibold text-slate-400">SYSTEM</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-600 whitespace-nowrap">{acc.accountType}</td>
                      <td className="py-2.5 px-4 text-slate-500">{acc.subType}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatINR(acc.openingBalance)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(acc.currentBalance)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => openLedgerForAccount(acc.id)}
                          className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                        >
                          Ledger
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => openEditAccount(acc)}
                            className="text-slate-600 hover:text-slate-900 cursor-pointer"
                            title="Edit account"
                          >
                            <Edit3 className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                        {canManage && !acc.isSystem && (
                          confirmDeleteId === acc.id ? (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={busyActionId === acc.id}
                                onClick={() => handleDeleteAccount(acc.id)}
                                className="text-rose-700 font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(acc.id)}
                              className="text-rose-600 hover:text-rose-800 cursor-pointer"
                              title="Delete account"
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

      {/* 2. JOURNAL ENTRIES */}
      {subTab === 'JOURNALS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Mobile Stacked Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredJournals.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No journal entries found.</div>
            ) : (
              filteredJournals.map(j => {
                const reversed = isJournalReversed(j);
                const reversable = canReverseJournal(j);
                return (
                  <div key={j.id} className="p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">{j.entryNumber}</span>
                          <span className="font-mono text-slate-500">{formatDateIN(j.entryDate)}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {j.referenceType || 'MANUAL'}
                          {j.referenceNumber ? ` · ${j.referenceNumber}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(j.totalDebit)}</div>
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
                      </div>
                    </div>

                    <div className="font-semibold text-slate-800">{j.narration}</div>

                    <div className="bg-slate-50 rounded-lg p-2 space-y-1 text-[11px] text-slate-600">
                      {(j.lines || []).map(l => (
                        <div key={l.id} className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="font-mono text-slate-400">{l.accountCode}</span> {l.accountName}
                            {l.partyName ? ` · ${l.partyName}` : ''}
                          </span>
                          <span className="font-mono tabular-nums shrink-0 font-medium text-slate-800">
                            {l.debit > 0 ? `Dr ${formatINR(l.debit)}` : `Cr ${formatINR(l.credit)}`}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                      {canManage && j.status === 'DRAFT' && (
                        <>
                          <button
                            type="button"
                            disabled={busyActionId === j.id}
                            onClick={() => openEditJournal(j)}
                            className="text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyActionId === j.id}
                            onClick={() => handlePostDraft(j.id)}
                            className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                          >
                            Post
                          </button>
                          {confirmDeleteId === j.id ? (
                            <span className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyActionId === j.id}
                                onClick={() => handleDeleteDraftJournal(j.id)}
                                className="text-rose-700 font-bold cursor-pointer"
                              >
                                Confirm Del
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(j.id)}
                              className="text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}

                      {reversable && (
                        confirmReverseId === j.id ? (
                          <span className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyActionId === j.id}
                              onClick={() => handleReversePosted(j.id)}
                              className="text-amber-800 font-bold cursor-pointer"
                            >
                              {busyActionId === j.id ? 'Reversing...' : 'Confirm Reverse'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmReverseId(null)}
                              className="text-slate-500 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyActionId === j.id}
                            onClick={() => setConfirmReverseId(j.id)}
                            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" /> Reverse
                          </button>
                        )
                      )}

                      {reversed && (
                        <span className="text-[11px] font-medium text-slate-400">Reversed (Locked)</span>
                      )}
                      {!reversed && String(j.referenceType || '').toUpperCase() === 'REVERSAL' && (
                        <span className="text-[11px] font-medium text-slate-400">Reversal Voucher</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tablet & Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Voucher #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Ref / Source</th>
                  <th className="py-2.5 px-4">Narration & Postings</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJournals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No journal entries found.
                    </td>
                  </tr>
                ) : (
                  filteredJournals.map(j => {
                    const reversed = isJournalReversed(j);
                    const reversable = canReverseJournal(j);
                    return (
                      <tr key={j.id} className="hover:bg-slate-50 align-top">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{j.entryNumber}</td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(j.entryDate)}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="font-medium text-slate-800">{j.referenceType || 'MANUAL'}</div>
                          {j.referenceNumber && <div className="font-mono text-[11px] text-slate-500">{j.referenceNumber}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 mb-1">{j.narration}</div>
                          <div className="space-y-0.5 text-[11px] text-slate-600">
                            {(j.lines || []).map(l => (
                              <div key={l.id} className="flex items-center justify-between gap-4 max-w-lg">
                                <span>
                                  <span className="font-mono text-slate-400">{l.accountCode}</span> {l.accountName}
                                  {l.partyName ? ` · ${l.partyName}` : ''}
                                </span>
                                <span className="font-mono tabular-nums whitespace-nowrap">
                                  {l.debit > 0 ? `Dr ${formatINR(l.debit)}` : `Cr ${formatINR(l.credit)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {formatINR(j.totalDebit)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
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
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {canManage && j.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                disabled={busyActionId === j.id}
                                onClick={() => openEditJournal(j)}
                                className="text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={busyActionId === j.id}
                                onClick={() => handlePostDraft(j.id)}
                                className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                              >
                                Post
                              </button>
                              {confirmDeleteId === j.id ? (
                                <button
                                  type="button"
                                  disabled={busyActionId === j.id}
                                  onClick={() => handleDeleteDraftJournal(j.id)}
                                  className="text-rose-700 font-bold cursor-pointer"
                                >
                                  Confirm Del
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(j.id)}
                                  className="text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                          {reversable && (
                            confirmReverseId === j.id ? (
                              <span className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={busyActionId === j.id}
                                  onClick={() => handleReversePosted(j.id)}
                                  className="text-amber-800 font-bold cursor-pointer"
                                >
                                  {busyActionId === j.id ? 'Reversing...' : 'Confirm Rev'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmReverseId(null)}
                                  className="text-slate-500 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={busyActionId === j.id}
                                onClick={() => setConfirmReverseId(j.id)}
                                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" /> Reverse
                              </button>
                            )
                          )}
                          {reversed && (
                            <span className="text-[11px] font-medium text-slate-400">Reversed (Locked)</span>
                          )}
                          {!reversed && String(j.referenceType || '').toUpperCase() === 'REVERSAL' && (
                            <span className="text-[11px] font-medium text-slate-400">Reversal Voucher</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. GENERAL LEDGER */}
      {subTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Account</label>
              <select
                value={selectedLedgerAccount?.id || ''}
                onChange={e => setSelectedLedgerAccountId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">From Date</label>
              <input
                type="date"
                value={ledgerStartDate}
                onChange={e => setLedgerStartDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">To Date</label>
              <input
                type="date"
                value={ledgerEndDate}
                onChange={e => setLedgerEndDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {ledgerResult && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Opening Balance</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {formatINR(ledgerResult.openingBalance)} {ledgerResult.openingOrientation}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Period Debit</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{formatINR(ledgerResult.totalDebit)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Period Credit</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{formatINR(ledgerResult.totalCredit)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Closing Balance</span>
                  <div className="font-mono font-bold text-amber-700 mt-0.5">
                    {formatINR(ledgerResult.closingBalance)} {ledgerResult.closingOrientation}
                  </div>
                </div>
              </div>

              {/* Mobile Stacked Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {ledgerResult.rows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No posted transactions in this account for the selected period.
                  </div>
                ) : (
                  ledgerResult.rows.map(r => (
                    <div key={r.lineId} className="p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-800">{r.entryNumber}</span>
                        <span className="font-mono text-slate-500">{formatDateIN(r.entryDate)}</span>
                      </div>
                      <div className="text-slate-700">{r.narration}</div>
                      {(r.partyName || r.projectTitle) && (
                        <div className="text-[11px] text-slate-500">
                          {[r.partyName, r.projectTitle].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 font-mono tabular-nums text-[11px]">
                        <span className="text-slate-600">
                          {r.debit > 0 ? `Dr ${formatINR(r.debit)}` : `Cr ${formatINR(r.credit)}`}
                        </span>
                        <span className="font-bold text-slate-900">
                          Bal: {formatINR(r.runningBalance)} {r.balanceOrientation}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Tablet & Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Voucher #</th>
                      <th className="py-2 px-3">Particulars / Narration</th>
                      <th className="py-2 px-3">Party / Project</th>
                      <th className="py-2 px-3 text-right">Debit (₹)</th>
                      <th className="py-2 px-3 text-right">Credit (₹)</th>
                      <th className="py-2 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerResult.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No posted transactions in this account for the selected period.
                        </td>
                      </tr>
                    ) : (
                      ledgerResult.rows.map(r => (
                        <tr key={r.lineId} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(r.entryDate)}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">{r.entryNumber}</td>
                          <td className="py-2 px-3 text-slate-700">{r.narration}</td>
                          <td className="py-2 px-3 text-slate-500">
                            {[r.partyName, r.projectTitle].filter(Boolean).join(' · ') || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                            {r.debit > 0 ? formatINR(r.debit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                            {r.credit > 0 ? formatINR(r.credit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                            {formatINR(r.runningBalance)} {r.balanceOrientation}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. TRIAL BALANCE */}
      {subTab === 'TRIAL_BALANCE' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Trial Balance Summary</h3>
              <p className="text-xs text-slate-500">
                Verification of total closing debits vs total closing credits across all accounts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 font-medium">As of:</span>
                <input
                  type="date"
                  value={tbAsOfDate}
                  onChange={e => setTbAsOfDate(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold ${
                  trialBalance.isBalanced ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {trialBalance.isBalanced ? 'Balanced' : `Out of balance by ${formatINR(trialBalance.difference)}`}
              </span>
            </div>
          </div>

          {/* Mobile Stacked Cards (< md) */}
          <div className="md:hidden space-y-2">
            {trialBalance.rows.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                No account balances recorded as of {formatDateIN(tbAsOfDate)}.
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {trialBalance.rows.map(r => (
                    <div key={r.accountId} className="p-3 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openLedgerForAccount(r.accountId)}
                          className="font-semibold text-slate-900 hover:text-amber-700 text-left cursor-pointer min-w-0"
                        >
                          <span className="font-mono text-slate-500 mr-1.5">{r.code}</span>
                          {r.name}
                        </button>
                        <span className="text-[10px] font-semibold text-slate-500 shrink-0">{r.accountType}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 block">Period Dr / Cr</span>
                          <span className="text-slate-600">
                            {r.periodDebit > 0 ? formatINR(r.periodDebit) : '—'} / {r.periodCredit > 0 ? formatINR(r.periodCredit) : '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block">Closing Dr / Cr</span>
                          <span className="font-semibold text-slate-900">
                            {r.closingDebit > 0 ? `Dr ${formatINR(r.closingDebit)}` : r.closingCredit > 0 ? `Cr ${formatINR(r.closingCredit)}` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold flex flex-wrap items-center justify-between gap-2">
                  <span>Total Closing Trial Balance</span>
                  <span className="font-mono tabular-nums text-right">
                    Dr {formatINR(trialBalance.totalDebit)} / Cr {formatINR(trialBalance.totalCredit)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Tablet & Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Period Debit</th>
                  <th className="py-2.5 px-3 text-right">Period Credit</th>
                  <th className="py-2.5 px-3 text-right">Closing Debit</th>
                  <th className="py-2.5 px-3 text-right">Closing Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trialBalance.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No account balances recorded as of {formatDateIN(tbAsOfDate)}.
                    </td>
                  </tr>
                ) : (
                  trialBalance.rows.map(r => (
                    <tr key={r.accountId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">{r.code}</td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => openLedgerForAccount(r.accountId)}
                          className="font-medium text-slate-900 hover:text-amber-700 cursor-pointer text-left"
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{r.accountType}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {r.periodDebit > 0 ? formatINR(r.periodDebit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {r.periodCredit > 0 ? formatINR(r.periodCredit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {r.closingDebit > 0 ? formatINR(r.closingDebit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {r.closingCredit > 0 ? formatINR(r.closingCredit) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right">
                    Total Closing Trial Balance
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">{formatINR(trialBalance.totalDebit)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">{formatINR(trialBalance.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAccount ? `Edit Account ${editingAccount.code}` : 'New Chart of Accounts Ledger'}
              </h3>
              <button type="button" onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-4 sm:p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Code *</label>
                  <input
                    type="text"
                    required
                    value={accountForm.code}
                    onChange={e => setAccountForm({ ...accountForm, code: e.target.value })}
                    placeholder="e.g. 5095"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type *</label>
                  <select
                    value={accountForm.accountType}
                    onChange={e => setAccountForm({ ...accountForm, accountType: e.target.value as AccountType })}
                    disabled={Boolean(editingAccount?.isSystem)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="REVENUE">REVENUE</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Group</label>
                  <input
                    type="text"
                    value={accountForm.subType}
                    onChange={e => setAccountForm({ ...accountForm, subType: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.openingBalance}
                    onChange={e => setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={accountForm.description}
                  onChange={e => setAccountForm({ ...accountForm, description: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingAccount ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Journal Voucher Modal */}
      {isJournalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                {editingJournalId ? `Edit Draft Journal ${journalForm.entryNumber}` : 'New Double-Entry Journal Voucher'}
              </h3>
              <button type="button" onClick={() => setIsJournalModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveJournal} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {journalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{journalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Date *</label>
                  <input
                    type="date"
                    required
                    value={journalForm.entryDate}
                    onChange={e => setJournalForm({ ...journalForm, entryDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reference #</label>
                  <input
                    type="text"
                    value={journalForm.referenceNumber}
                    onChange={e => setJournalForm({ ...journalForm, referenceNumber: e.target.value })}
                    placeholder="Optional ref"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Action</label>
                  <select
                    value={journalForm.status}
                    onChange={e => setJournalForm({ ...journalForm, status: e.target.value as 'DRAFT' | 'POSTED' })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="POSTED">Post Immediately</option>
                    <option value="DRAFT">Save as Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Narration *</label>
                  <input
                    type="text"
                    required
                    value={journalForm.narration}
                    onChange={e => setJournalForm({ ...journalForm, narration: e.target.value })}
                    placeholder="Reason for voucher"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Mobile Per-Line Journal Cards (< md) */}
              <div className="md:hidden space-y-3">
                {journalLines.map((line, idx) => (
                  <div key={line.id} className="border border-slate-200 rounded-lg p-3 space-y-2.5 bg-slate-50/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Line #{idx + 1}</span>
                      {journalLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setJournalLines(journalLines.filter((_, i) => i !== idx))}
                          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ledger Account *</label>
                      <select
                        value={line.accountId}
                        onChange={e => {
                          const next = [...journalLines];
                          next[idx] = { ...line, accountId: e.target.value };
                          setJournalLines(next);
                        }}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                      >
                        {workspace.accounts
                          .slice()
                          .sort((a, b) => a.code.localeCompare(b.code))
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Project (Optional)</label>
                        <select
                          value={line.projectId}
                          onChange={e => {
                            const next = [...journalLines];
                            next[idx] = { ...line, projectId: e.target.value };
                            setJournalLines(next);
                          }}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                        >
                          <option value="">— None —</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.projectCode} · {p.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Party / Memo</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={e => {
                            const next = [...journalLines];
                            next[idx] = { ...line, description: e.target.value };
                            setJournalLines(next);
                          }}
                          placeholder="Line note"
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Debit (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={e => {
                            const val = Number(e.target.value || 0);
                            const next = [...journalLines];
                            next[idx] = { ...line, debit: val, credit: val > 0 ? 0 : line.credit };
                            setJournalLines(next);
                          }}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-right font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Credit (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={e => {
                            const val = Number(e.target.value || 0);
                            const next = [...journalLines];
                            next[idx] = { ...line, credit: val, debit: val > 0 ? 0 : line.debit };
                            setJournalLines(next);
                          }}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-right font-mono bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Journal Lines Table (>= md) */}
              <div className="hidden md:block border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Ledger Account *</th>
                      <th className="py-2 px-3">Project (Optional)</th>
                      <th className="py-2 px-3">Party / Memo</th>
                      <th className="py-2 px-3 w-28 text-right">Debit (₹)</th>
                      <th className="py-2 px-3 w-28 text-right">Credit (₹)</th>
                      <th className="py-2 px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {journalLines.map((line, idx) => (
                      <tr key={line.id}>
                        <td className="p-2">
                          <select
                            value={line.accountId}
                            onChange={e => {
                              const next = [...journalLines];
                              next[idx] = { ...line, accountId: e.target.value };
                              setJournalLines(next);
                            }}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
                          >
                            {workspace.accounts
                              .slice()
                              .sort((a, b) => a.code.localeCompare(b.code))
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.code} — {a.name}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={line.projectId}
                            onChange={e => {
                              const next = [...journalLines];
                              next[idx] = { ...line, projectId: e.target.value };
                              setJournalLines(next);
                            }}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
                          >
                            <option value="">— None —</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.projectCode} · {p.title}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={e => {
                              const next = [...journalLines];
                              next[idx] = { ...line, description: e.target.value };
                              setJournalLines(next);
                            }}
                            placeholder="Line note"
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.debit}
                            onChange={e => {
                              const val = Number(e.target.value || 0);
                              const next = [...journalLines];
                              next[idx] = { ...line, debit: val, credit: val > 0 ? 0 : line.credit };
                              setJournalLines(next);
                            }}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.credit}
                            onChange={e => {
                              const val = Number(e.target.value || 0);
                              const next = [...journalLines];
                              next[idx] = { ...line, credit: val, debit: val > 0 ? 0 : line.debit };
                              setJournalLines(next);
                            }}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {journalLines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setJournalLines(journalLines.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setJournalLines([
                      ...journalLines,
                      {
                        id: `l-${Date.now()}-${journalLines.length}`,
                        accountId: workspace.accounts[0]?.id || '',
                        description: '',
                        projectId: '',
                        partyName: '',
                        debit: 0,
                        credit: 0
                      }
                    ])
                  }
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  + Add Line
                </button>

                <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-mono">
                  <span>
                    Total Debit: <strong>{formatINR(journalTotals.debit)}</strong>
                  </span>
                  <span>
                    Total Credit: <strong>{formatINR(journalTotals.credit)}</strong>
                  </span>
                  <span className={`font-bold ${journalTotals.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {journalTotals.isBalanced ? 'Balanced' : `Diff: ${formatINR(Math.abs(journalTotals.diff))}`}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsJournalModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingJournal || !journalTotals.isBalanced}
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingJournal ? 'Saving...' : journalForm.status === 'POSTED' ? 'Post Journal' : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
