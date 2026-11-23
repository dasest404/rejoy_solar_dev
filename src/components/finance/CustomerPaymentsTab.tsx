import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  PaymentRecord,
  SalesInvoice,
  VendorSalesInvoice,
  SolarProject,
  Customer,
  SystemSettings
} from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { generateTallyReceiptXML, attemptTallySync } from '../../services/tally';
import { formatINR, formatDateIN, round2 } from './accountingUtils';
import { Plus, Search, AlertCircle, CheckCircle2, FileCode, RefreshCw, X, Eye, Edit2, Trash2 } from 'lucide-react';

interface CustomerPaymentsTabProps {
  workspace: AccountingWorkspace;
  payments: PaymentRecord[];
  salesInvoices: SalesInvoice[];
  vendorSalesInvoices: VendorSalesInvoice[];
  projects: SolarProject[];
  customers: Customer[];
  settings: SystemSettings;
  canEdit: boolean;
  canTallySync: boolean;
  onRefresh: () => Promise<void>;
  onOpenXml: (xml: string) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CustomerPaymentsTab: React.FC<CustomerPaymentsTabProps> = ({
  workspace,
  payments,
  salesInvoices,
  vendorSalesInvoices,
  projects,
  customers,
  settings,
  canEdit,
  canTallySync,
  onRefresh,
  onOpenXml,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'RECEIPTS' | 'OPEN_INVOICES' | 'OVERDUE'>('RECEIPTS');
  const [search, setSearch] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [viewReceipt, setViewReceipt] = useState<PaymentRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    invoiceId: '',
    customerId: '',
    customerName: '',
    projectId: '',
    milestone: 'Milestone Payment',
    amount: 0,
    paidDate: today,
    paymentMode: 'Bank NEFT/RTGS',
    transactionReference: '',
    bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
    notes: ''
  });

  // Compute open & overdue customer invoices
  const invoiceRows = useMemo(() => {
    const paidByInv = new Map<string, number>();
    payments.forEach(p => {
      if (p.status === 'PAID' && p.invoiceId) {
        paidByInv.set(p.invoiceId, round2((paidByInv.get(p.invoiceId) || 0) + Number(p.amount || 0)));
      }
    });

    return salesInvoices
      .filter(inv => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
      .map(inv => {
        const paid = Number(inv.paidAmount ?? paidByInv.get(inv.id) ?? 0);
        const returned = Number(inv.returnedAmount || 0);
        const refunded = Number(inv.refundedAmount || 0);
        const netPaid = Math.max(0, round2(paid - refunded));
        const total = Number(inv.totalAmount || 0);
        const balance =
          inv.balanceAmount != null
            ? Number(inv.balanceAmount)
            : Math.max(0, round2(total - returned - netPaid));
        const isOverdue = balance > 0.01 && (inv.dueDate || '') < today;
        const payStatus = balance <= 0.01 ? 'PAID' : isOverdue ? 'OVERDUE' : netPaid > 0 ? 'PARTIAL' : 'UNPAID';
        return { inv, paid, balance, isOverdue, payStatus };
      });
  }, [salesInvoices, payments, today]);

  const openInvoices = useMemo(
    () => invoiceRows.filter(r => r.balance > 0.01),
    [invoiceRows]
  );

  const overdueInvoices = useMemo(
    () => openInvoices.filter(r => r.isOverdue),
    [openInvoices]
  );

  const totalCollected = useMemo(
    () => round2(payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.amount || 0), 0)),
    [payments]
  );

  const totalOpenReceivables = useMemo(
    () =>
      round2(
        openInvoices.reduce((s, r) => s + r.balance, 0) +
          vendorSalesInvoices
            .filter(v => v.status !== 'DRAFT' && v.status !== 'PAID')
            .reduce((s, v) => s + Number(v.balanceAmount || 0), 0)
      ),
    [openInvoices, vendorSalesInvoices]
  );

  const overdueTotal = useMemo(
    () => round2(overdueInvoices.reduce((s, r) => s + r.balance, 0)),
    [overdueInvoices]
  );

  const openModalForInvoice = (inv?: SalesInvoice, balance?: number) => {
    setErrorMsg(null);
    setEditingReceiptId(null);
    const defaultBank = workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '';
    if (inv) {
      setForm({
        invoiceId: inv.id,
        customerId: inv.customerId || '',
        customerName: inv.customerName,
        projectId: inv.projectId || '',
        milestone: `Invoice ${inv.invoiceNumber}`,
        amount: round2(balance ?? inv.totalAmount),
        paidDate: today,
        paymentMode: 'Bank NEFT/RTGS',
        transactionReference: '',
        bankAccountId: defaultBank,
        notes: ''
      });
    } else {
      setForm({
        invoiceId: '',
        customerId: '',
        customerName: '',
        projectId: '',
        milestone: 'Advance Booking',
        amount: 0,
        paidDate: today,
        paymentMode: 'Bank NEFT/RTGS',
        transactionReference: '',
        bankAccountId: defaultBank,
        notes: ''
      });
    }
    setIsReceiptModalOpen(true);
  };

  const openEditReceipt = (p: PaymentRecord) => {
    setErrorMsg(null);
    setEditingReceiptId(p.id);
    const defaultBank = workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '';
    setForm({
      invoiceId: p.invoiceId || '',
      customerId: p.customerId || '',
      customerName: p.customerName,
      projectId: p.projectId || '',
      milestone: p.milestone || 'Customer Receipt',
      amount: round2(Number(p.amount || 0)),
      paidDate: (p.paidDate || p.dueDate || today).slice(0, 10),
      paymentMode: p.paymentMode || 'Bank NEFT/RTGS',
      transactionReference: p.transactionReference || '',
      bankAccountId: p.bankAccountId || defaultBank,
      notes: p.notes || ''
    });
    setIsReceiptModalOpen(true);
  };

  const handleDeleteReceipt = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await apiClient.deleteCustomerReceipt(id);
      setConfirmDeleteId(null);
      await onRefresh();
      showToast('Customer receipt deleted and ledger entry reversed.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete customer receipt', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const selectableInvoices = useMemo(() => {
    const list = [...openInvoices];
    if (editingReceiptId && form.invoiceId && !list.some(r => r.inv.id === form.invoiceId)) {
      const existing = invoiceRows.find(r => r.inv.id === form.invoiceId);
      if (existing) list.unshift(existing);
    }
    return list;
  }, [openInvoices, invoiceRows, editingReceiptId, form.invoiceId]);

  const handleInvoiceSelect = (invoiceId: string) => {
    const match = selectableInvoices.find(r => r.inv.id === invoiceId);
    if (!match) {
      setForm(prev => ({ ...prev, invoiceId: '' }));
      return;
    }
    setForm(prev => ({
      ...prev,
      invoiceId,
      customerId: match.inv.customerId || prev.customerId,
      customerName: match.inv.customerName,
      projectId: match.inv.projectId || prev.projectId,
      milestone: `Against ${match.inv.invoiceNumber}`,
      amount: editingReceiptId ? prev.amount : match.balance
    }));
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(null);
    if (!form.customerName.trim() || Number(form.amount) <= 0) {
      setErrorMsg('Customer name and a positive receipt amount are required.');
      return;
    }
    const activeBanks = workspace.bankAccounts.filter(b => b.isActive);
    if (activeBanks.length > 0 && !form.bankAccountId) {
      setErrorMsg('Please select an active Cash / Bank account to deposit this receipt.');
      return;
    }
    if (form.invoiceId) {
      const targetRow = invoiceRows.find(r => r.inv.id === form.invoiceId);
      if (targetRow) {
        const origReceipt = editingReceiptId ? payments.find(p => p.id === editingReceiptId) : undefined;
        const prevLinkedAmt =
          origReceipt && origReceipt.invoiceId === form.invoiceId && origReceipt.status === 'PAID'
            ? Number(origReceipt.amount || 0)
            : 0;
        const maxAllowed = round2(targetRow.balance + prevLinkedAmt);
        if (round2(Number(form.amount)) > maxAllowed + 0.01) {
          setErrorMsg(
            `Receipt amount (${formatINR(Number(form.amount))}) cannot exceed remaining invoice balance (${formatINR(maxAllowed)}).`
          );
          return;
        }
      }
    }
    setSaving(true);
    try {
      const payload = {
        customerName: form.customerName.trim(),
        customerId: form.customerId || undefined,
        projectId: form.projectId || undefined,
        invoiceId: form.invoiceId || undefined,
        milestone: form.milestone.trim() || 'Customer Receipt',
        amount: round2(Number(form.amount)),
        paidDate: form.paidDate,
        dueDate: form.paidDate,
        status: 'PAID',
        paymentMode: form.paymentMode,
        transactionReference: form.transactionReference.trim() || undefined,
        bankAccountId: form.bankAccountId || undefined,
        notes: form.notes.trim() || undefined
      };
      if (editingReceiptId) {
        await apiClient.updateCustomerReceipt(editingReceiptId, payload);
      } else {
        await apiClient.recordCustomerReceipt(payload);
      }
      setIsReceiptModalOpen(false);
      setEditingReceiptId(null);
      await onRefresh();
      showToast(
        editingReceiptId
          ? 'Customer receipt updated and ledger adjusted.'
          : 'Customer receipt recorded and posted to general ledger.',
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to record receipt';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredPayments = payments.filter(
    p =>
      !q ||
      p.receiptNumber.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      (p.invoiceNumber || '').toLowerCase().includes(q) ||
      (p.milestone || '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Collected Receipts</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {formatINR(totalCollected)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{payments.filter(p => p.status === 'PAID').length} settled receipts</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Open Receivables Balance</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatINR(totalOpenReceivables)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{openInvoices.length} open customer invoices</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Overdue Receivables</div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${overdueTotal > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {formatINR(overdueTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{overdueInvoices.length} invoices past due date</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('RECEIPTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'RECEIPTS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Customer Receipts ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('OPEN_INVOICES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'OPEN_INVOICES' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Open Invoices ({openInvoices.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'OVERDUE' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Overdue Invoices ({overdueInvoices.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search receipt, customer, invoice..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-56"
            />
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => openModalForInvoice()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Record Receipt
            </button>
          )}
        </div>
      </div>

      {/* Subtab 1: Receipts */}
      {subTab === 'RECEIPTS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Mobile Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No customer receipts recorded matching your filter.
              </div>
            ) : (
              filteredPayments.map(p => (
                <div key={p.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900">{p.receiptNumber}</div>
                      <div className="font-semibold text-slate-800 truncate">{p.customerName}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.invoiceNumber ? `${p.invoiceNumber} · ` : ''}
                        {p.milestone}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(p.amount)}</div>
                      <span className={`text-[11px] font-semibold ${p.status === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{formatDateIN(p.paidDate || p.dueDate)}</span>
                    <span>
                      {p.paymentMode || 'NEFT'}
                      {p.transactionReference ? ` · ${p.transactionReference}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setViewReceipt(p)}
                      className="inline-flex items-center gap-1 text-slate-700 font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditReceipt(p)}
                        className="inline-flex items-center gap-1 text-slate-700 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenXml(generateTallyReceiptXML(p, settings))}
                      className="inline-flex items-center gap-1 text-slate-700 font-semibold cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5" /> XML
                    </button>
                    {canTallySync && (
                      <button
                        type="button"
                        disabled={syncingId === p.id}
                        onClick={() => {
                          setSyncingId(p.id);
                          setTimeout(() => {
                            setSyncingId(null);
                            const res = attemptTallySync(p.id, 'PAYMENT', p, settings);
                            showToast(res.message, res.success ? 'success' : 'warning');
                          }, 500);
                        }}
                        className="inline-flex items-center gap-1 text-amber-700 font-semibold cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                        {syncingId === p.id ? 'Syncing' : 'Tally'}
                      </button>
                    )}
                    {canEdit && (
                      confirmDeleteId === p.id ? (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleDeleteReceipt(p.id)}
                          className="text-rose-700 font-bold cursor-pointer"
                        >
                          {busyId === p.id ? '...' : 'Confirm Del'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="inline-flex items-center gap-1 text-rose-600 font-medium cursor-pointer"
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
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Receipt #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Invoice / Milestone</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Mode / UTR</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Tally / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No customer receipts recorded matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{p.receiptNumber}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{p.customerName}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.invoiceNumber ? `${p.invoiceNumber} · ` : ''}
                        {p.milestone}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(p.paidDate || p.dueDate)}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.paymentMode || 'NEFT'}
                        {p.transactionReference ? ` · ${p.transactionReference}` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`font-semibold ${p.status === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewReceipt(p)}
                          title="View Receipt Details"
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditReceipt(p)}
                            title="Edit Receipt"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenXml(generateTallyReceiptXML(p, settings))}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" /> XML
                        </button>
                        {canTallySync && (
                          <button
                            type="button"
                            disabled={syncingId === p.id}
                            onClick={() => {
                              setSyncingId(p.id);
                              setTimeout(() => {
                                setSyncingId(null);
                                const res = attemptTallySync(p.id, 'PAYMENT', p, settings);
                                showToast(res.message, res.success ? 'success' : 'warning');
                              }, 500);
                            }}
                            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                            {syncingId === p.id ? 'Syncing' : 'Tally'}
                          </button>
                        )}
                        {canEdit && (
                          confirmDeleteId === p.id ? (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => handleDeleteReceipt(p.id)}
                              className="text-rose-700 font-bold cursor-pointer"
                            >
                              {busyId === p.id ? '...' : 'Confirm Del'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              title="Delete Receipt"
                              className="inline-flex items-center text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Subtab 2 & 3: Open / Overdue Invoices */}
      {(subTab === 'OPEN_INVOICES' || subTab === 'OVERDUE') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {(() => {
            const invoiceRows = (subTab === 'OVERDUE' ? overdueInvoices : openInvoices).filter(
              r =>
                !q ||
                r.inv.invoiceNumber.toLowerCase().includes(q) ||
                r.inv.customerName.toLowerCase().includes(q) ||
                (r.inv.projectTitle || '').toLowerCase().includes(q)
            );
            return (
              <>
                <div className="md:hidden divide-y divide-slate-100">
                  {invoiceRows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                      All customer invoices are settled!
                    </div>
                  ) : (
                    invoiceRows.map(({ inv, paid, balance, payStatus }) => (
                      <div key={inv.id} className="p-3.5 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                            <div className="font-semibold text-slate-800 truncate">{inv.customerName}</div>
                            <div className="text-[11px] text-slate-500 truncate">{inv.projectTitle || '—'}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-slate-900">{formatINR(balance)}</div>
                            <span className={`text-[11px] font-semibold ${payStatus === 'OVERDUE' ? 'text-rose-700' : 'text-amber-700'}`}>
                              {payStatus}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="font-mono">Due {formatDateIN(inv.dueDate)}</span>
                          <span className="font-mono">Billed {formatINR(inv.totalAmount)} · Recv {formatINR(paid)}</span>
                        </div>
                        {canEdit && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => openModalForInvoice(inv, balance)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                              Receive Payment
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Invoice #</th>
                        <th className="py-2.5 px-4">Customer</th>
                        <th className="py-2.5 px-4">Project</th>
                        <th className="py-2.5 px-4">Due Date</th>
                        <th className="py-2.5 px-4 text-right">Billed (₹)</th>
                        <th className="py-2.5 px-4 text-right">Received (₹)</th>
                        <th className="py-2.5 px-4 text-right">Balance Due (₹)</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceRows.map(({ inv, paid, balance, payStatus }) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{inv.invoiceNumber}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">{inv.customerName}</td>
                          <td className="py-2.5 px-4 text-slate-600">{inv.projectTitle || '—'}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(inv.dueDate)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">{formatINR(inv.totalAmount)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">{formatINR(paid)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">{formatINR(balance)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`font-semibold ${payStatus === 'OVERDUE' ? 'text-rose-700' : 'text-amber-700'}`}>
                              {payStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openModalForInvoice(inv, balance)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer"
                              >
                                Receive Payment
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {invoiceRows.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                            All customer invoices are settled!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Record Receipt Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                {editingReceiptId ? 'Edit Customer Receipt & Adjust Ledger' : 'Record Customer Receipt & Auto-Post Ledger'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  setEditingReceiptId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveReceipt} className="p-4 sm:p-5 space-y-3 overflow-y-auto">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Link to Open Invoice (Optional)</label>
                <select
                  value={form.invoiceId}
                  onChange={e => handleInvoiceSelect(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                >
                  <option value="">— Direct / On-Account Receipt —</option>
                  {selectableInvoices.map(({ inv, balance }) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customerName} (Due: {formatINR(balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
                  <input
                    type="text"
                    required
                    list="accounting-customers-list"
                    value={form.customerName}
                    onChange={e => {
                      const c = customers.find(cu => cu.name === e.target.value);
                      setForm({ ...form, customerName: e.target.value, customerId: c?.id || form.customerId });
                    }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                  <datalist id="accounting-customers-list">
                    {customers.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project</label>
                  <select
                    value={form.projectId}
                    onChange={e => setForm({ ...form, projectId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">— None —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} · {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Amount (₹) *</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={form.paidDate}
                    onChange={e => setForm({ ...form, paidDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Into Cash / Bank *</label>
                  <select
                    required
                    value={form.bankAccountId}
                    onChange={e => setForm({ ...form, bankAccountId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.accountName} ({b.accountType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={form.paymentMode}
                    onChange={e => setForm({ ...form, paymentMode: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="Bank NEFT/RTGS">Bank NEFT/RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Milestone / Description</label>
                  <input
                    type="text"
                    value={form.milestone}
                    onChange={e => setForm({ ...form, milestone: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UTR / Reference #</label>
                  <input
                    type="text"
                    value={form.transactionReference}
                    onChange={e => setForm({ ...form, transactionReference: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setEditingReceiptId(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Posting...' : editingReceiptId ? 'Save Receipt Changes' : 'Record Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Receipt Detail Modal */}
      {viewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 font-mono">{viewReceipt.receiptNumber}</h3>
              <button type="button" onClick={() => setViewReceipt(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-2.5 text-xs overflow-y-auto">
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Customer:</span>
                <strong className="text-slate-900 text-right">{viewReceipt.customerName}</strong>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Receipt Date:</span>
                <span className="font-mono text-slate-800">{formatDateIN(viewReceipt.paidDate || viewReceipt.dueDate)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Amount Collected:</span>
                <strong className="font-mono text-emerald-700 text-sm">{formatINR(viewReceipt.amount)}</strong>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-slate-900">{viewReceipt.status}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Invoice / Milestone:</span>
                <span className="text-slate-800 text-right">
                  {viewReceipt.invoiceNumber ? `${viewReceipt.invoiceNumber} · ` : ''}{viewReceipt.milestone}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Bank / Cash Register:</span>
                <span className="text-slate-800 text-right">
                  {workspace.bankAccounts.find(b => b.id === viewReceipt.bankAccountId)?.accountName || 'Default Bank/Cash'}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Mode & Reference:</span>
                <span className="font-mono text-slate-800 text-right break-all">
                  {viewReceipt.paymentMode || 'NEFT'}{viewReceipt.transactionReference ? ` · ${viewReceipt.transactionReference}` : ''}
                </span>
              </div>
              {viewReceipt.journalEntryId && (
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="text-slate-500">Journal Voucher Ref:</span>
                  <span className="font-mono text-slate-700 break-all">{viewReceipt.journalEntryId}</span>
                </div>
              )}
              {viewReceipt.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-1">Notes</span>
                  <p className="text-slate-800 bg-slate-50 p-2 rounded">{viewReceipt.notes}</p>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewReceipt;
                      setViewReceipt(null);
                      openEditReceipt(target);
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    Edit Receipt
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewReceipt(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
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
