import React, { useState, useMemo } from 'react';
import {
  AccountingWorkspace,
  VendorBill,
  VendorBillLineItem,
  Vendor,
  PurchaseOrder,
  SolarProject
} from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import { formatINR, formatDateIN, round2 } from './accountingUtils';
import { Plus, Search, AlertCircle, Trash2, X, FileCheck2, Eye, Edit2 } from 'lucide-react';

interface VendorPaymentsTabProps {
  workspace: AccountingWorkspace;
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  projects: SolarProject[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const VendorPaymentsTab: React.FC<VendorPaymentsTabProps> = ({
  workspace,
  vendors,
  purchaseOrders,
  projects,
  canManage,
  onRefresh,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'BILLS' | 'PAYMENTS' | 'UNBILLED_POS'>('BILLS');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Create / Edit Vendor Bill Modal
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [viewBill, setViewBill] = useState<VendorBill | null>(null);
  const [savingBill, setSavingBill] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [billForm, setBillForm] = useState({
    id: '',
    billNumber: '',
    vendorId: '',
    poId: '',
    projectId: '',
    billDate: today,
    dueDate: today,
    category: 'Material Purchase',
    supplyType: 'INTRA' as 'INTRA' | 'INTER',
    tdsSection: '',
    tdsRate: 0,
    itcEligible: true,
    expenseAccountId: 'acc-5010',
    notes: ''
  });
  const [billLines, setBillLines] = useState<VendorBillLineItem[]>([
    { id: 'bl-1', description: '', hsnCode: '', quantity: 1, rate: 0, taxableAmount: 0, gstRate: 18, gstAmount: 0, totalAmount: 0 }
  ]);

  // Pay Vendor Bill Modal
  const [payTargetBill, setPayTargetBill] = useState<VendorBill | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [confirmPayDeleteId, setConfirmPayDeleteId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({
    paymentDate: today,
    amount: 0,
    tdsDeducted: 0,
    tdsSection: '194C',
    bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
    paymentMode: 'Bank NEFT/RTGS',
    referenceNo: '',
    notes: ''
  });

  const billedPoIds = useMemo(
    () => new Set(workspace.vendorBills.map(b => b.poId).filter(Boolean) as string[]),
    [workspace.vendorBills]
  );

  const unbilledPos = useMemo(
    () => purchaseOrders.filter(po => po.status !== 'CANCELLED' && !billedPoIds.has(po.id)),
    [purchaseOrders, billedPoIds]
  );

  const totalPayables = useMemo(
    () =>
      round2(
        workspace.vendorBills
          .filter(b => b.status !== 'PAID' && b.status !== 'DRAFT')
          .reduce((s, b) => s + Number(b.balanceAmount || 0), 0)
      ),
    [workspace.vendorBills]
  );

  const overduePayables = useMemo(
    () =>
      round2(
        workspace.vendorBills
          .filter(b => b.status !== 'PAID' && b.status !== 'DRAFT' && (b.dueDate || '') < today)
          .reduce((s, b) => s + Number(b.balanceAmount || 0), 0)
      ),
    [workspace.vendorBills, today]
  );

  const totalPaid = useMemo(
    () => round2(workspace.vendorPayments.reduce((s, p) => s + Number(p.amount || 0), 0)),
    [workspace.vendorPayments]
  );

  const billSummary = useMemo(() => {
    const subtotal = round2(billLines.reduce((s, l) => s + Number(l.taxableAmount || 0), 0));
    const gstAmount = round2(billLines.reduce((s, l) => s + Number(l.gstAmount || 0), 0));
    const cgstAmount = billForm.supplyType === 'INTRA' ? round2(gstAmount / 2) : 0;
    const sgstAmount = billForm.supplyType === 'INTRA' ? round2(gstAmount - cgstAmount) : 0;
    const igstAmount = billForm.supplyType === 'INTER' ? gstAmount : 0;
    const totalAmount = round2(subtotal + gstAmount);
    const tdsAmount = round2((subtotal * Number(billForm.tdsRate || 0)) / 100);
    return { subtotal, gstAmount, cgstAmount, sgstAmount, igstAmount, totalAmount, tdsAmount };
  }, [billLines, billForm.supplyType, billForm.tdsRate]);

  const openBillFromPo = (po?: PurchaseOrder) => {
    setBillError(null);
    if (po) {
      if (billedPoIds.has(po.id)) {
        showToast(`Purchase Order ${po.purchaseNumber} has already been converted to a Vendor Bill.`, 'warning');
        return;
      }
      const poReturnNote =
        Number(po.returnedAmount || 0) > 0
          ? ` (Note: PO has ${formatINR(Number(po.returnedAmount || 0))} purchase return recorded — verify quantities)`
          : '';
      setBillForm({
        id: '',
        billNumber: `BILL-${po.purchaseNumber}`,
        vendorId: po.vendorId,
        poId: po.id,
        projectId: po.projectId || '',
        billDate: today,
        dueDate: po.paymentDueDate || today,
        category: 'Material Purchase',
        supplyType: 'INTRA',
        tdsSection: '',
        tdsRate: 0,
        itcEligible: true,
        expenseAccountId: 'acc-5010',
        notes: `Converted from Purchase Order ${po.purchaseNumber}${poReturnNote}`
      });
      const items: VendorBillLineItem[] = (po.items || []).map((it, idx) => {
        const qty = Number(it.orderedQuantity || it.quantity || 1);
        const rate = Number(it.unitPrice || 0);
        const taxable = round2(qty * rate);
        const gstRate = Number(it.taxPercent ?? it.taxRatePercent ?? 18);
        const gstAmt = round2((taxable * gstRate) / 100);
        return {
          id: `bl-${idx}-${Date.now()}`,
          description: it.productName,
          hsnCode: it.sku,
          quantity: qty,
          rate,
          taxableAmount: taxable,
          gstRate,
          gstAmount: gstAmt,
          totalAmount: round2(taxable + gstAmt)
        };
      });
      setBillLines(
        items.length > 0
          ? items
          : [{ id: 'bl-1', description: `Materials for ${po.purchaseNumber}`, hsnCode: '', quantity: 1, rate: po.subtotal, taxableAmount: po.subtotal, gstRate: 18, gstAmount: po.taxAmount, totalAmount: po.totalAmount }]
      );
    } else {
      setBillForm({
        id: '',
        billNumber: '',
        vendorId: vendors[0]?.id || '',
        poId: '',
        projectId: '',
        billDate: today,
        dueDate: today,
        category: 'Material Purchase',
        supplyType: 'INTRA',
        tdsSection: '',
        tdsRate: 0,
        itcEligible: true,
        expenseAccountId: 'acc-5010',
        notes: ''
      });
      setBillLines([
        { id: `bl-${Date.now()}`, description: '', hsnCode: '', quantity: 1, rate: 0, taxableAmount: 0, gstRate: 18, gstAmount: 0, totalAmount: 0 }
      ]);
    }
    setIsBillModalOpen(true);
  };

  const openEditBill = (b: VendorBill) => {
    setBillError(null);
    setBillForm({
      id: b.id,
      billNumber: b.billNumber,
      vendorId: b.vendorId,
      poId: b.poId || '',
      projectId: b.projectId || '',
      billDate: b.billDate || today,
      dueDate: b.dueDate || today,
      category: b.category || 'Material Purchase',
      supplyType: Number(b.igstAmount || 0) > 0 ? 'INTER' : 'INTRA',
      tdsSection: b.tdsSection || '',
      tdsRate: Number(b.tdsRate || 0),
      itcEligible: b.itcEligible !== false,
      expenseAccountId: b.expenseAccountId || 'acc-5010',
      notes: b.notes || ''
    });
    if (Array.isArray(b.items) && b.items.length > 0) {
      setBillLines(b.items.map(it => ({ ...it })));
    } else {
      const gstRate = Number(b.subtotal || 0) > 0 ? round2((Number(b.gstAmount || 0) / Number(b.subtotal)) * 100) : 18;
      setBillLines([
        {
          id: `bl-${Date.now()}`,
          description: b.category || `Bill ${b.billNumber}`,
          hsnCode: '',
          quantity: 1,
          rate: round2(Number(b.subtotal || 0)),
          taxableAmount: round2(Number(b.subtotal || 0)),
          gstRate,
          gstAmount: round2(Number(b.gstAmount || 0)),
          totalAmount: round2(Number(b.totalAmount || 0))
        }
      ]);
    }
    setIsBillModalOpen(true);
  };

  const updateBillLine = (idx: number, patch: Partial<VendorBillLineItem>) => {
    setBillLines(prev =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        next.taxableAmount = round2(Number(next.quantity || 0) * Number(next.rate || 0));
        next.gstAmount = round2((next.taxableAmount * Number(next.gstRate || 0)) / 100);
        next.totalAmount = round2(next.taxableAmount + next.gstAmount);
        return next;
      })
    );
  };

  const handleSaveBill = async (e: React.FormEvent, targetStatus: 'DRAFT' | 'OPEN' = 'OPEN') => {
    e.preventDefault();
    if (savingBill) return;
    setBillError(null);
    const vendor = vendors.find(v => v.id === billForm.vendorId);
    if (!vendor) {
      setBillError('Please select a vendor.');
      return;
    }
    if (billSummary.totalAmount <= 0) {
      setBillError('Bill total must be greater than zero.');
      return;
    }
    setSavingBill(true);
    try {
      const po = purchaseOrders.find(p => p.id === billForm.poId);
      const proj = projects.find(p => p.id === billForm.projectId);
      await apiClient.saveVendorBill({
        id: billForm.id || undefined,
        billNumber: billForm.billNumber.trim() || undefined,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorGst: vendor.gstNumber,
        poId: po?.id,
        poNumber: po?.purchaseNumber,
        projectId: proj?.id,
        projectTitle: proj?.title,
        billDate: billForm.billDate,
        dueDate: billForm.dueDate,
        category: billForm.category,
        subtotal: billSummary.subtotal,
        cgstAmount: billSummary.cgstAmount,
        sgstAmount: billSummary.sgstAmount,
        igstAmount: billSummary.igstAmount,
        gstAmount: billSummary.gstAmount,
        tdsSection: billForm.tdsSection || undefined,
        tdsRate: Number(billForm.tdsRate || 0),
        tdsAmount: billSummary.tdsAmount,
        totalAmount: billSummary.totalAmount,
        itcEligible: billForm.itcEligible,
        status: targetStatus,
        expenseAccountId: billForm.expenseAccountId,
        notes: billForm.notes,
        items: billLines.filter(l => l.description.trim())
      });
      setIsBillModalOpen(false);
      await onRefresh();
      showToast(
        targetStatus === 'DRAFT'
          ? 'Vendor bill saved as draft.'
          : billForm.id
          ? 'Vendor bill updated and posted to Accounts Payable.'
          : 'Vendor bill recorded and posted to Accounts Payable.',
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to save vendor bill';
      setBillError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingBill(false);
    }
  };

  const handleDeleteBill = async (id: string) => {
    setBusyId(id);
    try {
      await apiClient.deleteVendorBill(id);
      setConfirmDeleteId(null);
      await onRefresh();
      showToast('Vendor bill deleted and linked AP journal removed.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete bill', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await apiClient.deleteVendorPayment(id);
      setConfirmPayDeleteId(null);
      await onRefresh();
      showToast('Vendor payment reversed and balances restored.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reverse vendor payment', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openPayModal = (bill: VendorBill) => {
    setPayError(null);
    const defaultBank = workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '';
    setPayTargetBill(bill);
    setPayForm({
      paymentDate: today,
      amount: bill.balanceAmount,
      tdsDeducted: bill.paidAmount === 0 && bill.tdsAmount > 0 ? bill.tdsAmount : 0,
      tdsSection: bill.tdsSection || '194C',
      bankAccountId: defaultBank,
      paymentMode: 'Bank NEFT/RTGS',
      referenceNo: '',
      notes: ''
    });
  };

  const handleRecordVendorPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTargetBill || savingPayment) return;
    setPayError(null);
    const grossAmt = round2(Number(payForm.amount || 0));
    const tdsAmt = round2(Number(payForm.tdsDeducted || 0));
    const activeBanks = workspace.bankAccounts.filter(b => b.isActive);
    if (activeBanks.length > 0 && !payForm.bankAccountId) {
      setPayError('Please select an active Bank / Cash account for this disbursement.');
      return;
    }
    if (grossAmt <= 0 || grossAmt > round2(Number(payTargetBill.balanceAmount || 0)) + 0.01) {
      setPayError(
        `Settlement amount must be between ₹0.01 and remaining bill balance (${formatINR(payTargetBill.balanceAmount)}).`
      );
      return;
    }
    if (tdsAmt < 0 || tdsAmt > grossAmt) {
      setPayError('TDS deducted cannot be negative or exceed the gross settlement amount.');
      return;
    }
    setSavingPayment(true);
    try {
      await apiClient.recordVendorPayment({
        billId: payTargetBill.id,
        paymentDate: payForm.paymentDate,
        amount: round2(Number(payForm.amount)),
        tdsDeducted: round2(Number(payForm.tdsDeducted || 0)),
        tdsSection: payForm.tdsSection,
        bankAccountId: payForm.bankAccountId,
        paymentMode: payForm.paymentMode,
        referenceNo: payForm.referenceNo,
        notes: payForm.notes
      });
      setPayTargetBill(null);
      await onRefresh();
      showToast('Vendor payment recorded and posted to ledger.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to record vendor payment';
      setPayError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredBills = workspace.vendorBills.filter(
    b =>
      !q ||
      b.billNumber.toLowerCase().includes(q) ||
      b.vendorName.toLowerCase().includes(q) ||
      (b.poNumber || '').toLowerCase().includes(q)
  );
  const filteredPayments = workspace.vendorPayments.filter(
    p =>
      !q ||
      p.paymentNumber.toLowerCase().includes(q) ||
      p.vendorName.toLowerCase().includes(q) ||
      (p.billNumber || '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Payables Outstanding</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totalPayables)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {workspace.vendorBills.filter(b => b.status !== 'PAID' && b.status !== 'DRAFT').length} unpaid bills
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Overdue Vendor Payables</div>
          <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${overduePayables > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {formatINR(overduePayables)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Requires immediate disbursement review</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Vendor Disbursements</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatINR(totalPaid)}</div>
          <div className="text-xs text-slate-500 mt-0.5">{workspace.vendorPayments.length} vendor payment vouchers</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('BILLS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'BILLS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Vendor Bills ({workspace.vendorBills.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('PAYMENTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'PAYMENTS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Vendor Payments ({workspace.vendorPayments.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('UNBILLED_POS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'UNBILLED_POS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Convert Purchase Orders ({unbilledPos.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search bill, vendor, PO..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-52"
            />
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => openBillFromPo()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" /> New Vendor Bill
            </button>
          )}
        </div>
      </div>

      {/* BILLS TABLE */}
      {subTab === 'BILLS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="md:hidden divide-y divide-slate-100">
            {filteredBills.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No vendor bills recorded yet. Create one manually or convert an existing Purchase Order.
              </div>
            ) : (
              filteredBills.map(b => {
                const isOverdue = b.status !== 'PAID' && b.status !== 'DRAFT' && (b.dueDate || '') < today;
                const displayStatus = isOverdue ? 'OVERDUE' : b.status;
                return (
                  <div key={b.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-900">{b.billNumber}</div>
                        <div className="font-semibold text-slate-800 truncate">{b.vendorName}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {[b.poNumber, b.projectTitle].filter(Boolean).join(' · ') || b.category}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-900 tabular-nums">{formatINR(b.balanceAmount)}</div>
                        <span
                          className={`text-[11px] font-semibold ${
                            displayStatus === 'PAID'
                              ? 'text-emerald-700'
                              : displayStatus === 'OVERDUE'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                      <span>Bill {formatDateIN(b.billDate)} · Due {formatDateIN(b.dueDate)}</span>
                      <span>Total {formatINR(b.totalAmount)} · Paid {formatINR(b.paidAmount)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setViewBill(b)}
                        className="inline-flex items-center gap-1 text-slate-700 font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      {canManage && Number(b.paidAmount || 0) === 0 && Number(b.returnedAmount || 0) === 0 && (
                        <button
                          type="button"
                          onClick={() => openEditBill(b)}
                          className="inline-flex items-center gap-1 text-slate-700 font-semibold cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      {canManage && b.status !== 'DRAFT' && b.balanceAmount > 0.01 && (
                        <button
                          type="button"
                          onClick={() => openPayModal(b)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Pay
                        </button>
                      )}
                      {canManage && Number(b.paidAmount || 0) === 0 && Number(b.returnedAmount || 0) === 0 && (
                        confirmDeleteId === b.id ? (
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleDeleteBill(b.id)}
                            className="text-rose-700 font-bold cursor-pointer"
                          >
                            {busyId === b.id ? '...' : 'Confirm Del'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(b.id)}
                            className="inline-flex items-center gap-1 text-rose-600 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Bill #</th>
                  <th className="py-2.5 px-4">Vendor</th>
                  <th className="py-2.5 px-4">PO / Project</th>
                  <th className="py-2.5 px-4">Bill / Due Date</th>
                  <th className="py-2.5 px-4 text-right">Total (₹)</th>
                  <th className="py-2.5 px-4 text-right">Paid (₹)</th>
                  <th className="py-2.5 px-4 text-right">Balance (₹)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No vendor bills recorded yet. Create one manually or convert an existing Purchase Order.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map(b => {
                    const isOverdue = b.status !== 'PAID' && b.status !== 'DRAFT' && (b.dueDate || '') < today;
                    const displayStatus = isOverdue ? 'OVERDUE' : b.status;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{b.billNumber}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{b.vendorName}</td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {[b.poNumber, b.projectTitle].filter(Boolean).join(' · ') || b.category}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          <div>{formatDateIN(b.billDate)}</div>
                          <div className="text-[11px] text-slate-400">Due {formatDateIN(b.dueDate)}</div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 font-semibold whitespace-nowrap">
                          {formatINR(b.totalAmount)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                          {formatINR(b.paidAmount)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {formatINR(b.balanceAmount)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              displayStatus === 'PAID'
                                ? 'text-emerald-700'
                                : displayStatus === 'OVERDUE'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => setViewBill(b)}
                            title="View Bill"
                            className="inline-flex items-center text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canManage && Number(b.paidAmount || 0) === 0 && Number(b.returnedAmount || 0) === 0 && (
                            <button
                              type="button"
                              onClick={() => openEditBill(b)}
                              title="Edit Unpaid Bill"
                              className="inline-flex items-center text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canManage && b.status !== 'DRAFT' && b.balanceAmount > 0.01 && (
                            <button
                              type="button"
                              onClick={() => openPayModal(b)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                              Pay
                            </button>
                          )}
                          {canManage && Number(b.paidAmount || 0) === 0 && Number(b.returnedAmount || 0) === 0 && (
                            confirmDeleteId === b.id ? (
                              <button
                                type="button"
                                disabled={busyId === b.id}
                                onClick={() => handleDeleteBill(b.id)}
                                className="text-rose-700 font-bold cursor-pointer"
                              >
                                {busyId === b.id ? '...' : 'Confirm Del'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(b.id)}
                                title="Delete Bill"
                                className="text-rose-600 hover:text-rose-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            )
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

      {/* VENDOR PAYMENTS TABLE */}
      {subTab === 'PAYMENTS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="md:hidden divide-y divide-slate-100">
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No vendor disbursements recorded yet.</div>
            ) : (
              filteredPayments.map(p => {
                const tdsDeposited = workspace.tdsEntries.some(
                  t => t.sourceType === 'VENDOR_PAYMENT' && t.sourceId === p.id && t.status === 'DEPOSITED'
                );
                return (
                  <div key={p.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-900">{p.paymentNumber}</div>
                        <div className="font-semibold text-slate-800 truncate">{p.vendorName}</div>
                        <div className="text-[11px] font-mono text-slate-500">Bill: {p.billNumber || p.billId}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-emerald-700 tabular-nums">{formatINR(p.netPaid)}</div>
                        {p.tdsDeducted > 0 && (
                          <div className="text-[11px] font-mono text-amber-700">TDS {formatINR(p.tdsDeducted)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-mono">{formatDateIN(p.paymentDate)}</span>
                      <span>{p.bankAccountName || p.paymentMode}{p.referenceNo ? ` · ${p.referenceNo}` : ''}</span>
                    </div>
                    <div className="flex justify-end pt-1">
                      {canManage && !tdsDeposited && (
                        confirmPayDeleteId === p.id ? (
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-rose-700 font-bold cursor-pointer"
                          >
                            {busyId === p.id ? '...' : 'Confirm Rev'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmPayDeleteId(p.id)}
                            className="inline-flex items-center gap-1 text-rose-600 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Reverse Payment
                          </button>
                        )
                      )}
                      {tdsDeposited && <span className="text-[11px] text-slate-400">TDS Deposited</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Payment #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Vendor</th>
                  <th className="py-2.5 px-4">Against Bill</th>
                  <th className="py-2.5 px-4">Bank / Mode</th>
                  <th className="py-2.5 px-4 text-right">Settled (₹)</th>
                  <th className="py-2.5 px-4 text-right">TDS (₹)</th>
                  <th className="py-2.5 px-4 text-right">Net Paid (₹)</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No vendor disbursements recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => {
                    const tdsDeposited = workspace.tdsEntries.some(
                      t => t.sourceType === 'VENDOR_PAYMENT' && t.sourceId === p.id && t.status === 'DEPOSITED'
                    );
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{p.paymentNumber}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(p.paymentDate)}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{p.vendorName}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{p.billNumber || p.billId}</td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {p.bankAccountName || p.paymentMode}
                          {p.referenceNo ? ` · ${p.referenceNo}` : ''}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatINR(p.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 whitespace-nowrap">
                          {p.tdsDeducted > 0 ? formatINR(p.tdsDeducted) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                          {formatINR(p.netPaid)}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {canManage && !tdsDeposited && (
                            confirmPayDeleteId === p.id ? (
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() => handleDeletePayment(p.id)}
                                className="text-rose-700 font-bold cursor-pointer"
                              >
                                {busyId === p.id ? '...' : 'Confirm Rev'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmPayDeleteId(p.id)}
                                title="Reverse / Delete Payment"
                                className="text-rose-600 hover:text-rose-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            )
                          )}
                          {tdsDeposited && (
                            <span className="text-[11px] text-slate-400">TDS Deposited</span>
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

      {/* UNBILLED PURCHASE ORDERS */}
      {subTab === 'UNBILLED_POS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="md:hidden divide-y divide-slate-100">
            {unbilledPos.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                All active Purchase Orders have already been converted to Vendor Bills.
              </div>
            ) : (
              unbilledPos.map(po => (
                <div key={po.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900">{po.purchaseNumber}</div>
                      <div className="font-semibold text-slate-800 truncate">{po.vendorName}</div>
                      <div className="text-[11px] text-slate-500 truncate">{po.projectTitle || 'Stock Procurement'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-slate-900">{formatINR(po.totalAmount)}</div>
                      <div className="text-[11px] text-slate-600">{po.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="font-mono text-[11px] text-slate-500">{formatDateIN(po.purchaseDate)}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openBillFromPo(po)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" /> Convert to Bill
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">PO #</th>
                  <th className="py-2.5 px-4">Vendor</th>
                  <th className="py-2.5 px-4">Project</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">PO Status</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unbilledPos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      All active Purchase Orders have already been converted to Vendor Bills.
                    </td>
                  </tr>
                ) : (
                  unbilledPos.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{po.purchaseNumber}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{po.vendorName}</td>
                      <td className="py-2.5 px-4 text-slate-600">{po.projectTitle || 'Stock Procurement'}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateIN(po.purchaseDate)}</td>
                      <td className="py-2.5 px-4 text-slate-700 font-medium whitespace-nowrap">{po.status}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(po.totalAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => openBillFromPo(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" /> Convert to Bill
                          </button>
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

      {/* CREATE VENDOR BILL MODAL */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {billForm.id ? 'Edit Vendor Purchase Bill' : 'Record Vendor Purchase Bill (Accounts Payable)'}
              </h3>
              <button type="button" onClick={() => setIsBillModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBill} className="p-5 space-y-4 overflow-y-auto">
              {billError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{billError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor *</label>
                  <select
                    required
                    value={billForm.vendorId}
                    onChange={e => setBillForm({ ...billForm, vendorId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.gstNumber || 'No GSTIN'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Invoice / Bill #</label>
                  <input
                    type="text"
                    value={billForm.billNumber}
                    onChange={e => setBillForm({ ...billForm, billNumber: e.target.value })}
                    placeholder="Auto-generated if blank"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project Allocation</label>
                  <select
                    value={billForm.projectId}
                    onChange={e => setBillForm({ ...billForm, projectId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">— Overhead / Stock —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} · {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Date *</label>
                  <input
                    type="date"
                    required
                    value={billForm.billDate}
                    onChange={e => setBillForm({ ...billForm, billDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={billForm.dueDate}
                    onChange={e => setBillForm({ ...billForm, dueDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST Supply Type</label>
                  <select
                    value={billForm.supplyType}
                    onChange={e => setBillForm({ ...billForm, supplyType: e.target.value as 'INTRA' | 'INTER' })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="INTRA">Intra-State (CGST + SGST)</option>
                    <option value="INTER">Inter-State (IGST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Ledger</label>
                  <select
                    value={billForm.expenseAccountId}
                    onChange={e => setBillForm({ ...billForm, expenseAccountId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    {workspace.accounts
                      .filter(a => a.accountType === 'EXPENSE' || a.accountType === 'ASSET')
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="md:hidden space-y-2.5">
                {billLines.map((line, idx) => (
                  <div key={line.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-600">Line #{idx + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{formatINR(line.totalAmount)}</span>
                        {billLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBillLines(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                            aria-label="Remove line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-0.5">Item / Service Description *</label>
                      <input
                        type="text"
                        required
                        value={line.description}
                        onChange={e => updateBillLine(idx, { description: e.target.value })}
                        placeholder="Description"
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">HSN/SAC</label>
                        <input
                          type="text"
                          value={line.hsnCode || ''}
                          onChange={e => updateBillLine(idx, { hsnCode: e.target.value })}
                          placeholder="HSN"
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={e => updateBillLine(idx, { quantity: Number(e.target.value) })}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.rate}
                          onChange={e => updateBillLine(idx, { rate: Number(e.target.value) })}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">GST %</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={line.gstRate}
                          onChange={e => updateBillLine(idx, { gstRate: Number(e.target.value) })}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Item / Service Description *</th>
                      <th className="py-2 px-2 w-24">HSN/SAC</th>
                      <th className="py-2 px-2 w-20 text-right">Qty</th>
                      <th className="py-2 px-2 w-28 text-right">Rate (₹)</th>
                      <th className="py-2 px-2 w-20 text-right">GST %</th>
                      <th className="py-2 px-3 w-28 text-right">Line Total (₹)</th>
                      <th className="py-2 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billLines.map((line, idx) => (
                      <tr key={line.id}>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            value={line.description}
                            onChange={e => updateBillLine(idx, { description: e.target.value })}
                            placeholder="Description"
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={line.hsnCode || ''}
                            onChange={e => updateBillLine(idx, { hsnCode: e.target.value })}
                            placeholder="HSN"
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity}
                            onChange={e => updateBillLine(idx, { quantity: Number(e.target.value) })}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.rate}
                            onChange={e => updateBillLine(idx, { rate: Number(e.target.value) })}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={line.gstRate}
                            onChange={e => updateBillLine(idx, { gstRate: Number(e.target.value) })}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 text-right font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-900">
                          {formatINR(line.totalAmount)}
                        </td>
                        <td className="p-2 text-center">
                          {billLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBillLines(prev => prev.filter((_, i) => i !== idx))}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setBillLines([
                        ...billLines,
                        { id: `bl-${Date.now()}`, description: '', hsnCode: '', quantity: 1, rate: 0, taxableAmount: 0, gstRate: 18, gstAmount: 0, totalAmount: 0 }
                      ])
                    }
                    className="font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                  >
                    + Add Line Item
                  </button>
                  <label className="inline-flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billForm.itcEligible}
                      onChange={e => setBillForm({ ...billForm, itcEligible: e.target.checked })}
                    />
                    Claim Input GST Credit (ITC)
                  </label>
                </div>

                <div className="text-xs font-mono space-y-0.5 text-right">
                  <div>Taxable: {formatINR(billSummary.subtotal)}</div>
                  <div>GST: {formatINR(billSummary.gstAmount)}</div>
                  <div className="text-sm font-bold text-slate-900">Bill Total: {formatINR(billSummary.totalAmount)}</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingBill}
                  onClick={e => handleSaveBill(e, 'DRAFT')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  disabled={savingBill}
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingBill ? 'Posting...' : 'Save & Post Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY VENDOR BILL MODAL */}
      {payTargetBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Pay Vendor Bill {payTargetBill.billNumber}</h3>
              <button type="button" onClick={() => setPayTargetBill(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordVendorPayment} className="p-4 sm:p-5 space-y-3 overflow-y-auto">
              {payError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}
              <div className="text-xs text-slate-600">
                Vendor: <strong className="text-slate-900">{payTargetBill.vendorName}</strong> · Balance Due:{' '}
                <strong className="font-mono text-slate-900">{formatINR(payTargetBill.balanceAmount)}</strong>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gross Settlement (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    max={payTargetBill.balanceAmount}
                    step="0.01"
                    required
                    value={payForm.amount}
                    onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">TDS Deducted (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payForm.tdsDeducted}
                    onChange={e => setPayForm({ ...payForm, tdsDeducted: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pay From Bank / Cash *</label>
                  <select
                    required
                    value={payForm.bankAccountId}
                    onChange={e => setPayForm({ ...payForm, bankAccountId: e.target.value })}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payForm.paymentDate}
                    onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">TDS Section</label>
                  <select
                    value={payForm.tdsSection}
                    onChange={e => setPayForm({ ...payForm, tdsSection: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="194C">194C — Contractor (1% / 2%)</option>
                    <option value="194J">194J — Professional (10%)</option>
                    <option value="194Q">194Q — Goods Purchase (0.1%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UTR / Cheque #</label>
                  <input
                    type="text"
                    value={payForm.referenceNo}
                    onChange={e => setPayForm({ ...payForm, referenceNo: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between font-mono">
                <span className="text-slate-600">Net Bank Outflow:</span>
                <strong className="text-slate-900">{formatINR(Math.max(0, round2(payForm.amount - payForm.tdsDeducted)))}</strong>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayTargetBill(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingPayment ? 'Processing...' : 'Disburse Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* VIEW VENDOR BILL MODAL */}
      {viewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 font-mono">{viewBill.billNumber}</h3>
              <button type="button" onClick={() => setViewBill(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Vendor</span>
                  <strong className="text-slate-900">{viewBill.vendorName}</strong>
                  {viewBill.vendorGst && <div className="font-mono text-[11px] text-slate-500">{viewBill.vendorGst}</div>}
                </div>
                <div>
                  <span className="text-slate-500 block">Bill / Due Date</span>
                  <span className="font-mono text-slate-900">{formatDateIN(viewBill.billDate)}</span>
                  <div className="font-mono text-[11px] text-slate-500">Due {formatDateIN(viewBill.dueDate)}</div>
                </div>
                <div>
                  <span className="text-slate-500 block">PO / Project</span>
                  <span className="text-slate-800">{viewBill.poNumber || 'Direct Bill'}</span>
                  <div className="text-[11px] text-slate-500">{viewBill.projectTitle || viewBill.category}</div>
                </div>
                <div>
                  <span className="text-slate-500 block">Status & JV</span>
                  <strong className="text-slate-900">{viewBill.status}</strong>
                  {viewBill.journalEntryId && (
                    <div className="font-mono text-[11px] text-slate-500 truncate">{viewBill.journalEntryId}</div>
                  )}
                </div>
              </div>

              {viewBill.items && viewBill.items.length > 0 && (
                <>
                  <div className="md:hidden divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {viewBill.items.map(it => (
                      <div key={it.id} className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-slate-800">{it.description}</div>
                          <div className="font-mono font-semibold text-slate-900 shrink-0">{formatINR(it.totalAmount)}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-slate-500">
                          {it.hsnCode && <span>HSN {it.hsnCode}</span>}
                          <span>Qty {it.quantity}</span>
                          <span>Rate {formatINR(it.rate)}</span>
                          <span>GST {it.gstRate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full min-w-[520px] text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">HSN</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Rate</th>
                          <th className="py-2 px-3 text-right">GST</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewBill.items.map(it => (
                          <tr key={it.id}>
                            <td className="py-2 px-3 font-medium text-slate-800">{it.description}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{it.hsnCode || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono">{it.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatINR(it.rate)}</td>
                            <td className="py-2 px-3 text-right font-mono">{it.gstRate}%</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold">{formatINR(it.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-500 block font-sans">Taxable Subtotal</span>
                  <strong>{formatINR(viewBill.subtotal)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">GST ({viewBill.itcEligible ? 'ITC' : 'Non-ITC'})</span>
                  <strong>{formatINR(viewBill.gstAmount)}</strong>
                  <div className="text-[10px] text-slate-500">
                    {viewBill.igstAmount > 0
                      ? `IGST ${formatINR(viewBill.igstAmount)}`
                      : `CGST ${formatINR(viewBill.cgstAmount)} / SGST ${formatINR(viewBill.sgstAmount)}`}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Total / Paid</span>
                  <strong>{formatINR(viewBill.totalAmount)}</strong>
                  <div className="text-[11px] text-emerald-700">Paid {formatINR(viewBill.paidAmount)}</div>
                </div>
                <div>
                  <span className="text-slate-500 block font-sans">Balance Due</span>
                  <strong className="text-rose-700">{formatINR(viewBill.balanceAmount)}</strong>
                </div>
              </div>

              {viewBill.notes && (
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700">
                  <span className="text-slate-500 font-semibold block mb-0.5">Notes</span>
                  {viewBill.notes}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
                {canManage && Number(viewBill.paidAmount || 0) === 0 && Number(viewBill.returnedAmount || 0) === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewBill;
                      setViewBill(null);
                      openEditBill(target);
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    Edit Bill
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewBill(null)}
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
