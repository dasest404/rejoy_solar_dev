import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { storageService } from '../../services/storage';
import {
  PurchaseReturn,
  PurchaseReturnSettlementMode,
  PurchaseOrder,
  Warehouse,
  BankAccount
} from '../../types/solar';
import {
  RotateCcw,
  Plus,
  Search,
  Eye,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Landmark,
  Boxes,
  FileText,
  Printer,
  Loader2
} from 'lucide-react';

const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 1000) / 1000;
const formatINR = (n: number) =>
  `₹${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface DraftPurchaseReturnLine {
  key: string;
  productId?: string;
  description: string;
  sku: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  baseQuantity: number;
  previouslyReturned: number;
  maxReturnable: number;
  quantity: number;
  rate: number;
  gstRate: number;
}

export const PurchaseReturnManager: React.FC = () => {
  const { refreshTrigger, triggerRefresh, showToast } = useApp();
  const [syncTick, setSyncTick] = useState(0);

  const [returnsList, setReturnsList] = useState<PurchaseReturn[]>(() => storageService.getPurchaseReturns());
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | PurchaseReturnSettlementMode>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingReturn, setViewingReturn] = useState<PurchaseReturn | null>(null);
  const [confirmDeleteReturn, setConfirmDeleteReturn] = useState<PurchaseReturn | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [returnDate, setReturnDate] = useState(today);
  const [reason, setReason] = useState('Damaged / Defective Supply');
  const [warehouseId, setWarehouseId] = useState('');
  const [deductInventory, setDeductInventory] = useState(true);
  const [settlementMode, setSettlementMode] = useState<PurchaseReturnSettlementMode>('DEBIT_NOTE');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftPurchaseReturnLine[]>([]);

  const purchaseOrders = useMemo(() => storageService.getPurchaseOrders(), [refreshTrigger, syncTick]);
  const warehouses = useMemo<Warehouse[]>(() => storageService.getWarehouses(), [refreshTrigger, syncTick]);

  const loadRemoteData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedReturns, banks] = await Promise.all([
        storageService.fetchPurchaseReturnsAsync().catch(() => storageService.getPurchaseReturns()),
        storageService.fetchAccountingBankAccountsAsync().catch(() => [])
      ]);
      if (Array.isArray(fetchedReturns)) setReturnsList(fetchedReturns);
      if (Array.isArray(banks)) {
        const activeBanks = banks.filter((b: any) => b && b.isActive !== false);
        setBankAccounts(activeBanks);
        setBankAccountId(prev => {
          if (prev && activeBanks.some((b: any) => b.id === prev)) return prev;
          const primary = activeBanks.find((b: any) => b.isPrimary) || activeBanks[0];
          return primary?.id || '';
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRemoteData();
  }, [loadRemoteData, refreshTrigger]);

  useEffect(() => {
    const onUpdated = () => {
      setReturnsList(storageService.getPurchaseReturns());
      setSyncTick(t => t + 1);
    };
    window.addEventListener('solarpulse_storage_updated', onUpdated);
    return () => window.removeEventListener('solarpulse_storage_updated', onUpdated);
  }, []);

  const eligiblePOs = useMemo(() => {
    return purchaseOrders.filter(po => {
      const st = String(po.status || '').toUpperCase();
      if (st === 'DRAFT' || st === 'CANCELLED') return false;
      const remainingReturnableValue = round2(Math.max(0, Number(po.totalAmount || 0) - Number(po.returnedAmount || 0)));
      return remainingReturnableValue > 0.01;
    });
  }, [purchaseOrders]);

  const selectedPO = useMemo<PurchaseOrder | null>(
    () => (selectedPoId ? purchaseOrders.find(p => p.id === selectedPoId) || null : null),
    [selectedPoId, purchaseOrders]
  );

  const poMeta = useMemo(() => {
    if (!selectedPO) {
      return { netPaid: 0, remainingValue: 0 };
    }
    const total = round2(Number(selectedPO.totalAmount || 0));
    const paid = round2(Number(selectedPO.paidAmount || 0));
    const returned = round2(Number(selectedPO.returnedAmount || 0));
    const refunded = round2(Number(selectedPO.refundedAmount || 0));
    return {
      netPaid: round2(Math.max(0, paid - refunded)),
      remainingValue: round2(Math.max(0, total - returned))
    };
  }, [selectedPO]);

  const buildDraftLinesForPO = useCallback(
    (poId: string) => {
      const po = purchaseOrders.find(p => p.id === poId);
      if (!po) {
        setDraftLines([]);
        return;
      }
      const anyReceived = (po.items || []).some(it => Number(it.receivedQuantity || 0) > 0);
      setDeductInventory(anyReceived || Boolean(po.stockUpdated));
      if (po.warehouseId) setWarehouseId(po.warehouseId);

      const prevByKey = new Map<string, number>();
      returnsList
        .filter(
          r =>
            (r.purchaseOrderId || r.poId) === poId &&
            String(r.status || 'POSTED').toUpperCase() !== 'REVERSED'
        )
        .forEach(r => {
          (r.items || []).forEach(li => {
            const key = li.productId
              ? `pid:${li.productId}`
              : `desc:${String(li.description || '').trim().toLowerCase()}`;
            prevByKey.set(key, round3((prevByKey.get(key) || 0) + Number(li.quantity || 0)));
          });
        });

      const poEffGst = Number(po.subtotal || 0) > 0 ? round2((Number(po.taxAmount || 0) / Number(po.subtotal)) * 100) : 18;
      const lines: DraftPurchaseReturnLine[] = (po.items || []).map((it: any, idx: number) => {
        const orderedQty = Number(it.orderedQuantity ?? it.quantity ?? 0);
        const receivedQty = Number(it.receivedQuantity || 0);
        const baseQty = anyReceived ? receivedQty : orderedQty;
        const key = it.productId
          ? `pid:${it.productId}`
          : `desc:${String(it.productName || it.description || '').trim().toLowerCase()}`;
        const prevQty = prevByKey.get(key) || 0;
        const maxReturnable = round3(Math.max(0, baseQty - prevQty));
        const rate = round2(Number(it.unitPrice ?? it.rate ?? 0));
        const gstRate = Number(it.taxPercent ?? it.taxRatePercent ?? poEffGst);
        return {
          key: `${key}-${idx}`,
          productId: it.productId || undefined,
          description: String(it.productName || it.description || 'Item'),
          sku: String(it.sku || ''),
          unit: String(it.unit || 'Nos'),
          orderedQuantity: orderedQty,
          receivedQuantity: receivedQty,
          baseQuantity: baseQty,
          previouslyReturned: prevQty,
          maxReturnable,
          quantity: 0,
          rate,
          gstRate
        };
      });
      setDraftLines(lines);
    },
    [purchaseOrders, returnsList]
  );

  const handleOpenCreate = () => {
    setFormError('');
    setReturnDate(today);
    setReason('Damaged / Defective Supply');
    setDeductInventory(true);
    setSettlementMode('DEBIT_NOTE');
    setRefundAmount(0);
    setNotes('');
    const defWh = warehouses.find(w => w.isDefault) || warehouses[0];
    setWarehouseId(defWh?.id || '');
    const primaryBank = bankAccounts.find(b => b.isPrimary) || bankAccounts[0];
    if (primaryBank) setBankAccountId(primaryBank.id);
    setSelectedPoId('');
    setDraftLines([]);
    setIsCreateOpen(true);
  };

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    setFormError('');
    setSettlementMode('DEBIT_NOTE');
    setRefundAmount(0);
    const po = purchaseOrders.find(p => p.id === poId);
    if (po?.bankAccountId && bankAccounts.some(b => b.id === po.bankAccountId)) {
      setBankAccountId(po.bankAccountId);
    }
    buildDraftLinesForPO(poId);
  };

  const computedSummary = useMemo(() => {
    let subtotal = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    const itemBreakdowns = draftLines.map(line => {
      const qty = Math.max(0, Math.min(line.maxReturnable, Number(line.quantity || 0)));
      const taxable = round2(qty * line.rate);
      const tax = round2((taxable * line.gstRate) / 100);
      const cgst = round2(tax / 2);
      const sgst = round2(tax - cgst);
      const total = round2(taxable + tax);
      subtotal = round2(subtotal + taxable);
      cgstAmount = round2(cgstAmount + cgst);
      sgstAmount = round2(sgstAmount + sgst);
      return { taxable, cgst, sgst, tax, total, qty };
    });
    const taxAmount = round2(cgstAmount + sgstAmount);
    const totalAmount = round2(subtotal + taxAmount);
    return { subtotal, cgstAmount, sgstAmount, taxAmount, totalAmount, itemBreakdowns };
  }, [draftLines]);

  const maxRefundAllowed = useMemo(() => {
    return round2(Math.min(computedSummary.totalAmount, poMeta.netPaid));
  }, [computedSummary.totalAmount, poMeta.netPaid]);

  useEffect(() => {
    if (settlementMode === 'VENDOR_REFUND') {
      setRefundAmount(maxRefundAllowed);
    } else {
      setRefundAmount(0);
    }
  }, [settlementMode, maxRefundAllowed]);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    if (!selectedPO) {
      setFormError('Please select a Purchase Order.');
      return;
    }
    const itemsToSubmit = draftLines
      .filter(l => Number(l.quantity || 0) > 0)
      .map(l => ({
        productId: l.productId || undefined,
        description: l.description,
        quantity: round3(Number(l.quantity))
      }));

    if (itemsToSubmit.length === 0) {
      setFormError('Enter return quantity greater than 0 for at least one line item.');
      return;
    }
    if (computedSummary.totalAmount <= 0) {
      setFormError('Return total must be greater than zero.');
      return;
    }
    if (computedSummary.totalAmount > poMeta.remainingValue + 0.05) {
      setFormError(`Return value (${formatINR(computedSummary.totalAmount)}) exceeds remaining PO value (${formatINR(poMeta.remainingValue)}).`);
      return;
    }
    if (settlementMode === 'VENDOR_REFUND') {
      if (poMeta.netPaid <= 0) {
        setFormError('No net payment has been made on this PO. Use Debit Note settlement.');
        return;
      }
      if (!bankAccountId) {
        setFormError('Please select the Cash / Bank account receiving the vendor refund.');
        return;
      }
      if (refundAmount <= 0 || refundAmount > maxRefundAllowed + 0.01) {
        setFormError(`Refund amount must be between ₹0.01 and ${formatINR(maxRefundAllowed)}.`);
        return;
      }
    }

    const wh = warehouses.find(w => w.id === warehouseId);
    setSubmitting(true);
    try {
      const res = await storageService.createPurchaseReturnAsync({
        purchaseOrderId: selectedPO.id,
        returnDate,
        reason: reason.trim() || 'Purchase Return',
        warehouseId: wh?.id || '',
        warehouseName: wh?.name || '',
        deductInventory,
        settlementMode,
        refundAmount: settlementMode === 'VENDOR_REFUND' ? round2(refundAmount) : 0,
        bankAccountId: bankAccountId || undefined,
        notes: notes.trim(),
        items: itemsToSubmit
      });
      await loadRemoteData();
      triggerRefresh();
      setIsCreateOpen(false);
      showToast(
        `Debit Note ${res?.returnNumber || ''} recorded (${formatINR(computedSummary.totalAmount)}) and synced across PO, Vendor Bill & Ledger.`,
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to record purchase return.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteReturn || deletingId) return;
    setDeletingId(confirmDeleteReturn.id);
    try {
      await storageService.deletePurchaseReturnAsync(confirmDeleteReturn.id);
      if (viewingReturn?.id === confirmDeleteReturn.id) setViewingReturn(null);
      setConfirmDeleteReturn(null);
      await loadRemoteData();
      triggerRefresh();
      showToast(`Purchase Return ${confirmDeleteReturn.returnNumber} reversed across inventory, PO, Vendor Bill & ledger.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reverse purchase return.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const metrics = useMemo(() => {
    const active = returnsList.filter(r => String(r.status || 'POSTED').toUpperCase() !== 'REVERSED');
    const totalValue = round2(active.reduce((s, r) => s + Number(r.totalAmount || 0), 0));
    const totalItcReversed = round2(active.reduce((s, r) => s + Number(r.taxAmount || 0), 0));
    const totalVendorRefund = round2(active.reduce((s, r) => s + Number(r.refundAmount || 0), 0));
    const debitNoteAdjusted = round2(Math.max(0, totalValue - totalVendorRefund));
    return { count: active.length, totalValue, totalItcReversed, totalVendorRefund, debitNoteAdjusted };
  }, [returnsList]);

  const filteredReturns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return returnsList.filter(r => {
      if (modeFilter !== 'ALL' && r.settlementMode !== modeFilter) return false;
      if (!q) return true;
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        r.poNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      );
    });
  }, [returnsList, searchQuery, modeFilter]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Returns / Debit Notes</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><RotateCcw className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-mono">{formatINR(metrics.totalValue)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">{metrics.count} active debit notes</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Input GST (ITC) Reversed</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><FileText className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-purple-700 mt-2 font-mono">{formatINR(metrics.totalItcReversed)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">CGST / SGST ITC adjusted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor Cash / Bank Refunds</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Landmark className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2 font-mono">{formatINR(metrics.totalVendorRefund)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Credited back to bank registers</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payable Debit Adjusted</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-blue-700 mt-2 font-mono">{formatINR(metrics.debitNoteAdjusted)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Offset against PO & Vendor Bills</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            Purchase Returns & Debit Notes
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Record goods returned to vendors against Purchase Orders with optional stock deduction, ITC reversal, PO/Bill balance reduction, and vendor refund bank deposit.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Purchase Return
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search debit note #, PO #, vendor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {([
            { id: 'ALL', label: 'All Returns' },
            { id: 'DEBIT_NOTE', label: 'Debit Note Offset' },
            { id: 'VENDOR_REFUND', label: 'Vendor Bank Refund' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setModeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                modeFilter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Debit Note #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Purchase Order</th>
                <th className="p-3.5">Vendor</th>
                <th className="p-3.5 text-center">Items / Stock</th>
                <th className="p-3.5 text-right">Taxable + ITC</th>
                <th className="p-3.5 text-right">Total Debit</th>
                <th className="p-3.5">Settlement / Bank</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.map(pr => (
                <tr key={pr.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-amber-700 whitespace-nowrap">
                    <button onClick={() => setViewingReturn(pr)} className="hover:underline text-left">
                      {pr.returnNumber}
                    </button>
                  </td>
                  <td className="p-3.5 text-slate-600 whitespace-nowrap">{pr.returnDate}</td>
                  <td className="p-3.5 font-mono font-semibold text-slate-800 whitespace-nowrap">{pr.poNumber}</td>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-800">{pr.vendorName}</div>
                    {pr.reason && <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{pr.reason}</div>}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="font-mono font-semibold text-slate-700">{(pr.items || []).length} line(s)</div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        pr.deductInventory
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Boxes className="w-2.5 h-2.5" />
                      {pr.deductInventory ? 'Stock Deducted' : 'No Stock Deduct'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                    <div>{formatINR(pr.subtotal)}</div>
                    <div className="text-[10px] text-purple-700">ITC: {formatINR(pr.taxAmount)}</div>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    {formatINR(pr.totalAmount)}
                  </td>
                  <td className="p-3.5">
                    {pr.settlementMode === 'VENDOR_REFUND' ? (
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Refund +{formatINR(pr.refundAmount)}
                        </span>
                        {pr.bankAccountName && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Landmark className="w-2.5 h-2.5" />
                            {pr.bankAccountName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Debit Note Offset
                        </span>
                        {pr.bankAccountName && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Landmark className="w-2.5 h-2.5" />
                            {pr.bankAccountName}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewingReturn(pr)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Debit Note"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteReturn(pr)}
                        disabled={deletingId === pr.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Reverse & Delete Return"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReturns.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    {loading ? 'Loading purchase returns...' : 'No purchase returns recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Return Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Record Purchase Return (Debit Note)</h3>
                  <p className="text-xs text-slate-500">
                    Reverses Input GST (ITC), adjusts inventory & PO/Vendor Bill payable, and records vendor cash/bank refunds.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Source Purchase Order *</label>
                  <select
                    required
                    value={selectedPoId}
                    onChange={e => handlePoChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="">-- Select Eligible Purchase Order --</option>
                    {eligiblePOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.purchaseNumber} — {po.vendorName} (Total: {formatINR(po.totalAmount)}, Net Paid: {formatINR(Math.max(0, Number(po.paidAmount || 0) - Number(po.refundedAmount || 0)))})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Return Warehouse</label>
                  <select
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    disabled={!deductInventory}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl disabled:opacity-50"
                  >
                    <option value="">-- Default Hub --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Return Date *</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Return *</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. Defective inverter / Excess supply"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {selectedPO && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      PO Line Items — {selectedPO.purchaseNumber} ({selectedPO.vendorName})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftLines(prev => prev.map(l => ({ ...l, quantity: l.maxReturnable })))
                      }
                      className="text-xs font-bold text-amber-700 hover:underline"
                    >
                      Return All Eligible
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Item</th>
                          <th className="p-2.5 text-center">Eligible Base</th>
                          <th className="p-2.5 text-center">Prev Ret.</th>
                          <th className="p-2.5 text-center">Max Ret.</th>
                          <th className="p-2.5 text-center w-28">Return Qty</th>
                          <th className="p-2.5 text-right">Unit Cost</th>
                          <th className="p-2.5 text-right">GST %</th>
                          <th className="p-2.5 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {draftLines.map((line, idx) => {
                          const bd = computedSummary.itemBreakdowns[idx];
                          return (
                            <tr key={line.key}>
                              <td className="p-2.5 font-medium text-slate-800">
                                <div>{line.description}</div>
                                {line.sku && <span className="text-[10px] text-slate-400 font-mono">{line.sku}</span>}
                              </td>
                              <td className="p-2.5 text-center font-mono">
                                {line.baseQuantity} {line.unit}
                                <span className="block text-[10px] text-slate-400">
                                  Ord: {line.orderedQuantity} • Rec: {line.receivedQuantity}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-500">{line.previouslyReturned}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-amber-700">{line.maxReturnable}</td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={line.maxReturnable}
                                  step="any"
                                  disabled={line.maxReturnable <= 0}
                                  value={line.quantity}
                                  onChange={e => {
                                    const raw = Number(e.target.value);
                                    const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(line.maxReturnable, raw)) : 0;
                                    setDraftLines(prev => prev.map((it, i) => (i === idx ? { ...it, quantity: clamped } : it)));
                                  }}
                                  className="w-full px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono">{formatINR(line.rate)}</td>
                              <td className="p-2.5 text-right font-mono">{line.gstRate}%</td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                {formatINR(bd?.total || 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deductInventory}
                      onChange={e => setDeductInventory(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-800">Deduct returned goods from Warehouse Inventory</span>
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Settlement Mode *</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="prSettlement"
                          checked={settlementMode === 'DEBIT_NOTE'}
                          onChange={() => setSettlementMode('DEBIT_NOTE')}
                          className="mt-0.5 text-amber-500"
                        />
                        <span>
                          <strong className="text-slate-800">Debit Note Adjustment</strong>
                          <span className="block text-[11px] text-slate-500">Reduces PO & Vendor Bill payable balance directly.</span>
                        </span>
                      </label>

                      <label className={`flex items-start gap-2 text-xs ${poMeta.netPaid <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="prSettlement"
                          disabled={poMeta.netPaid <= 0}
                          checked={settlementMode === 'VENDOR_REFUND'}
                          onChange={() => setSettlementMode('VENDOR_REFUND')}
                          className="mt-0.5 text-amber-500"
                        />
                        <span>
                          <strong className="text-slate-800">Vendor Cash / Bank Refund Received</strong>
                          <span className="block text-[11px] text-slate-500">
                            {poMeta.netPaid > 0
                              ? `Available net paid eligible for vendor refund: ${formatINR(poMeta.netPaid)}`
                              : 'Unavailable — no net payment made on selected PO.'}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {settlementMode === 'VENDOR_REFUND'
                          ? 'Deposit Refund Into Account *'
                          : 'Cash / Bank Account (Settlement Link)'}
                      </label>
                      <select
                        required={settlementMode === 'VENDOR_REFUND'}
                        value={bankAccountId}
                        onChange={e => setBankAccountId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Select Account --</option>
                        {bankAccounts.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.accountName} ({b.accountType}) — Bal: {formatINR(b.currentBalance)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {settlementMode === 'VENDOR_REFUND' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Refund Received (Max {formatINR(maxRefundAllowed)}) *
                        </label>
                        <input
                          type="number"
                          min={0.01}
                          max={maxRefundAllowed}
                          step="0.01"
                          required
                          value={refundAmount}
                          onChange={e => setRefundAmount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals Box */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
                    Debit Note ITC & Total Preview
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono font-semibold">{formatINR(computedSummary.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>CGST ITC Reversal:</span>
                    <span className="font-mono font-semibold">{formatINR(computedSummary.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>SGST ITC Reversal:</span>
                    <span className="font-mono font-semibold">{formatINR(computedSummary.sgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total Debit Note:</span>
                    <span className="font-mono text-amber-700">{formatINR(computedSummary.totalAmount)}</span>
                  </div>
                  {settlementMode === 'VENDOR_REFUND' && (
                    <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                      <span>Cash / Bank Refund Inflow:</span>
                      <span className="font-mono">+{formatINR(refundAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional dispatch / debit note remarks..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedPO || computedSummary.totalAmount <= 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Post Debit Note & Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Debit Note Modal */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Debit Note — {viewingReturn.returnNumber}</h3>
                <p className="text-xs text-slate-500">
                  Against PO {viewingReturn.poNumber} • Date {viewingReturn.returnDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button onClick={() => setViewingReturn(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Vendor</span>
                  <span className="font-bold text-slate-900">{viewingReturn.vendorName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Settlement</span>
                  <span className="font-bold text-slate-800">
                    {viewingReturn.settlementMode === 'VENDOR_REFUND'
                      ? `Vendor Refund (+${formatINR(viewingReturn.refundAmount)})`
                      : 'Debit Note Offset'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Inventory</span>
                  <span className="font-bold text-slate-800">
                    {viewingReturn.deductInventory ? `Deducted (${viewingReturn.warehouseName || 'Default Hub'})` : 'Not Deducted'}
                  </span>
                </div>
                {viewingReturn.bankAccountName && (
                  <div>
                    <span className="text-slate-400 block">
                      {viewingReturn.settlementMode === 'VENDOR_REFUND' ? 'Deposited Into' : 'Linked Bank Account'}
                    </span>
                    <span className="font-bold text-slate-800">{viewingReturn.bankAccountName}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block">Reason</span>
                  <span className="font-semibold text-slate-800">{viewingReturn.reason || '-'}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-center">Qty Returned</th>
                      <th className="p-2.5 text-right">Unit Cost</th>
                      <th className="p-2.5 text-right">Taxable</th>
                      <th className="p-2.5 text-right">ITC GST</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewingReturn.items || []).map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-2.5 font-medium text-slate-800">{it.description}</td>
                        <td className="p-2.5 text-center font-mono">{it.quantity} {it.unit || 'Nos'}</td>
                        <td className="p-2.5 text-right font-mono">{formatINR(it.rate)}</td>
                        <td className="p-2.5 text-right font-mono">{formatINR(it.taxableAmount)}</td>
                        <td className="p-2.5 text-right font-mono text-purple-700">{formatINR(it.taxAmount)}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{formatINR(it.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Subtotal:</span>
                    <span className="font-mono font-semibold">{formatINR(viewingReturn.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>CGST ITC Reversed:</span>
                    <span className="font-mono font-semibold">{formatINR(viewingReturn.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>SGST ITC Reversed:</span>
                    <span className="font-mono font-semibold">{formatINR(viewingReturn.sgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Debit Note Total:</span>
                    <span className="font-mono text-amber-700">{formatINR(viewingReturn.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete / Reversal Confirmation Modal */}
      {confirmDeleteReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Reverse & Delete Purchase Return?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reversing Debit Note <strong>{confirmDeleteReturn.returnNumber}</strong> ({formatINR(confirmDeleteReturn.totalAmount)}) will restore PO & Vendor Bill payable balances, reverse posted journal entries
              {confirmDeleteReturn.deductInventory ? ', restore deducted inventory' : ''}
              {confirmDeleteReturn.refundAmount > 0 ? `, and reverse ${formatINR(confirmDeleteReturn.refundAmount)} from ${confirmDeleteReturn.bankAccountName || 'the bank account'}` : ''}.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteReturn(null)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Reverse Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
