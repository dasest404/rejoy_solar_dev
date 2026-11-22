import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { storageService } from '../../services/storage';
import {
  SalesReturn,
  SalesReturnTargetType,
  SalesReturnSettlementMode,
  SalesInvoice,
  VendorSalesInvoice,
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

interface DraftReturnLine {
  key: string;
  productId?: string;
  description: string;
  hsnCode: string;
  unit: string;
  originalQuantity: number;
  previouslyReturned: number;
  maxReturnable: number;
  quantity: number;
  rate: number;
  gstRate: number;
}

export const SalesReturnManager: React.FC = () => {
  const { refreshTrigger, triggerRefresh, showToast } = useApp();
  const [syncTick, setSyncTick] = useState(0);

  const [returnsList, setReturnsList] = useState<SalesReturn[]>(() => storageService.getSalesReturns());
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SalesReturnTargetType>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingReturn, setViewingReturn] = useState<SalesReturn | null>(null);
  const [confirmDeleteReturn, setConfirmDeleteReturn] = useState<SalesReturn | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [targetType, setTargetType] = useState<SalesReturnTargetType>('CUSTOMER_INVOICE');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(today);
  const [reason, setReason] = useState('Damaged / Defective Material');
  const [warehouseId, setWarehouseId] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [settlementMode, setSettlementMode] = useState<SalesReturnSettlementMode>('CREDIT_NOTE');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftReturnLine[]>([]);

  const customerInvoices = useMemo(() => storageService.getSalesInvoices(), [refreshTrigger, syncTick]);
  const vendorInvoices = useMemo(() => storageService.getVendorSalesInvoices(), [refreshTrigger, syncTick]);
  const warehouses = useMemo<Warehouse[]>(() => storageService.getWarehouses(), [refreshTrigger, syncTick]);

  const loadRemoteData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedReturns, banks] = await Promise.all([
        storageService.fetchSalesReturnsAsync().catch(() => storageService.getSalesReturns()),
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
      setReturnsList(storageService.getSalesReturns());
      setSyncTick(t => t + 1);
    };
    window.addEventListener('solarpulse_storage_updated', onUpdated);
    return () => window.removeEventListener('solarpulse_storage_updated', onUpdated);
  }, []);

  // Eligible source invoices
  const eligibleInvoices = useMemo(() => {
    if (targetType === 'CUSTOMER_INVOICE') {
      return customerInvoices.filter(inv => {
        const st = String(inv.status || 'ISSUED').toUpperCase();
        if (st === 'DRAFT' || st === 'CANCELLED') return false;
        const remainingReturnableValue = round2(Math.max(0, Number(inv.totalAmount || 0) - Number(inv.returnedAmount || 0)));
        return remainingReturnableValue > 0.01;
      });
    }
    return vendorInvoices.filter(inv => {
      const st = String(inv.status || 'ISSUED').toUpperCase();
      if (st === 'DRAFT' || st === 'CANCELLED') return false;
      const remainingReturnableValue = round2(Math.max(0, Number(inv.totalAmount || 0) - Number(inv.returnedAmount || 0)));
      return remainingReturnableValue > 0.01;
    });
  }, [targetType, customerInvoices, vendorInvoices]);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    if (targetType === 'CUSTOMER_INVOICE') {
      return customerInvoices.find(i => i.id === selectedInvoiceId) || null;
    }
    return vendorInvoices.find(i => i.id === selectedInvoiceId) || null;
  }, [targetType, selectedInvoiceId, customerInvoices, vendorInvoices]);

  const invoiceMeta = useMemo(() => {
    if (!selectedInvoice) {
      return { isInterState: false, netPaid: 0, remainingValue: 0, invoiceNumber: '', partyName: '' };
    }
    const total = round2(Number(selectedInvoice.totalAmount || 0));
    const paid = round2(Number(selectedInvoice.paidAmount || 0));
    const returned = round2(Number(selectedInvoice.returnedAmount || 0));
    const refunded = round2(Number(selectedInvoice.refundedAmount || 0));
    const netPaid = round2(Math.max(0, paid - refunded));
    const remainingValue = round2(Math.max(0, total - returned));
    const isInterState =
      targetType === 'VENDOR_INVOICE'
        ? (selectedInvoice as VendorSalesInvoice).supplyType === 'INTER_STATE' ||
          Number((selectedInvoice as VendorSalesInvoice).igstAmount || 0) > 0
        : Number((selectedInvoice as SalesInvoice).igstAmount || 0) > 0;
    const partyName =
      targetType === 'VENDOR_INVOICE'
        ? (selectedInvoice as VendorSalesInvoice).vendorName
        : (selectedInvoice as SalesInvoice).customerName;
    return {
      isInterState,
      netPaid,
      remainingValue,
      invoiceNumber: selectedInvoice.invoiceNumber,
      partyName
    };
  }, [selectedInvoice, targetType]);

  // Populate line items when source invoice changes
  const buildDraftLinesForInvoice = useCallback(
    (type: SalesReturnTargetType, invId: string) => {
      if (!invId) {
        setDraftLines([]);
        return;
      }
      const inv =
        type === 'CUSTOMER_INVOICE'
          ? customerInvoices.find(i => i.id === invId)
          : vendorInvoices.find(i => i.id === invId);
      if (!inv) {
        setDraftLines([]);
        return;
      }

      const prevByKey = new Map<string, number>();
      returnsList
        .filter(r => r.targetType === type && r.invoiceId === invId && String(r.status || 'POSTED').toUpperCase() !== 'REVERSED')
        .forEach(r => {
          (r.items || []).forEach(li => {
            const key = li.productId
              ? `pid:${li.productId}`
              : `desc:${String(li.description || '').trim().toLowerCase()}`;
            prevByKey.set(key, round3((prevByKey.get(key) || 0) + Number(li.quantity || 0)));
          });
        });

      const invSub = Number(inv.subtotal || 0);
      const invTax = Number(inv.taxAmount || 0);
      const fallbackGst = invSub > 0 ? round2((invTax / invSub) * 100) : 18;

      const lines: DraftReturnLine[] = (inv.items || []).map((it: any, idx: number) => {
        const origQty = Number(it.quantity || 0);
        const key = it.productId
          ? `pid:${it.productId}`
          : `desc:${String(it.description || '').trim().toLowerCase()}`;
        const prevQty = prevByKey.get(key) || 0;
        const maxReturnable = round3(Math.max(0, origQty - prevQty));
        const origRate = Number(it.rate ?? it.unitPrice ?? 0);
        const origTaxable = Number(it.taxableAmount ?? origQty * origRate);
        const effectiveRate = origQty > 0 ? round2(origTaxable / origQty) : round2(origRate);
        const gstRate = Number(it.gstRate ?? it.taxRatePercent ?? fallbackGst);
        return {
          key: `${key}-${idx}`,
          productId: it.productId || undefined,
          description: String(it.description || 'Item'),
          hsnCode: String(it.hsnCode || ''),
          unit: String(it.unit || 'Nos'),
          originalQuantity: origQty,
          previouslyReturned: prevQty,
          maxReturnable,
          quantity: 0,
          rate: effectiveRate,
          gstRate
        };
      });
      setDraftLines(lines);
    },
    [customerInvoices, vendorInvoices, returnsList]
  );

  const handleOpenCreate = () => {
    setFormError('');
    setReturnDate(today);
    setReason('Damaged / Defective Material');
    setRestockInventory(true);
    setSettlementMode('CREDIT_NOTE');
    setRefundAmount(0);
    setNotes('');
    const defWh = warehouses.find(w => w.isDefault) || warehouses[0];
    setWarehouseId(defWh?.id || '');
    const primaryBank = bankAccounts.find(b => b.isPrimary) || bankAccounts[0];
    if (primaryBank) setBankAccountId(primaryBank.id);
    setTargetType('CUSTOMER_INVOICE');
    setSelectedInvoiceId('');
    setDraftLines([]);
    setIsCreateOpen(true);
  };

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    setFormError('');
    setSettlementMode('CREDIT_NOTE');
    setRefundAmount(0);
    buildDraftLinesForInvoice(targetType, invId);
  };

  const handleTargetTypeChange = (nextType: SalesReturnTargetType) => {
    setTargetType(nextType);
    setSelectedInvoiceId('');
    setDraftLines([]);
    setSettlementMode('CREDIT_NOTE');
    setRefundAmount(0);
    setFormError('');
  };

  // Live GST & Total calculations mirroring backend
  const computedSummary = useMemo(() => {
    let subtotal = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    const itemBreakdowns = draftLines.map(line => {
      const qty = Math.max(0, Math.min(line.maxReturnable, Number(line.quantity || 0)));
      const taxable = round2(qty * line.rate);
      const tax = round2((taxable * line.gstRate) / 100);
      const igst = invoiceMeta.isInterState ? tax : 0;
      const cgst = invoiceMeta.isInterState ? 0 : round2(tax / 2);
      const sgst = invoiceMeta.isInterState ? 0 : round2(tax - cgst);
      const total = round2(taxable + tax);
      subtotal = round2(subtotal + taxable);
      cgstAmount = round2(cgstAmount + cgst);
      sgstAmount = round2(sgstAmount + sgst);
      igstAmount = round2(igstAmount + igst);
      return { taxable, cgst, sgst, igst, tax, total, qty };
    });
    const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
    const totalAmount = round2(subtotal + taxAmount);
    return { subtotal, cgstAmount, sgstAmount, igstAmount, taxAmount, totalAmount, itemBreakdowns };
  }, [draftLines, invoiceMeta.isInterState]);

  const maxRefundAllowed = useMemo(() => {
    return round2(Math.min(computedSummary.totalAmount, invoiceMeta.netPaid));
  }, [computedSummary.totalAmount, invoiceMeta.netPaid]);

  useEffect(() => {
    if (settlementMode === 'BANK_REFUND') {
      setRefundAmount(maxRefundAllowed);
    } else {
      setRefundAmount(0);
    }
  }, [settlementMode, maxRefundAllowed]);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    if (!selectedInvoice) {
      setFormError('Please select a source invoice.');
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
    if (computedSummary.totalAmount > invoiceMeta.remainingValue + 0.05) {
      setFormError(`Return value (${formatINR(computedSummary.totalAmount)}) exceeds remaining invoice value (${formatINR(invoiceMeta.remainingValue)}).`);
      return;
    }
    if (settlementMode === 'BANK_REFUND') {
      if (invoiceMeta.netPaid <= 0) {
        setFormError('No net payment has been received on this invoice. Use Credit Note settlement.');
        return;
      }
      if (!bankAccountId) {
        setFormError('Please select the Cash / Bank account paying this refund.');
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
      const res = await storageService.createSalesReturnAsync({
        targetType,
        invoiceId: selectedInvoice.id,
        returnDate,
        reason: reason.trim() || 'Sales Return',
        warehouseId: wh?.id || '',
        warehouseName: wh?.name || '',
        restockInventory,
        settlementMode,
        refundAmount: settlementMode === 'BANK_REFUND' ? round2(refundAmount) : 0,
        bankAccountId: settlementMode === 'BANK_REFUND' ? bankAccountId : undefined,
        notes: notes.trim(),
        items: itemsToSubmit
      });
      await loadRemoteData();
      triggerRefresh();
      setIsCreateOpen(false);
      showToast(
        `Credit Note ${res?.returnNumber || ''} recorded (${formatINR(computedSummary.totalAmount)}) and synced to ledger.`,
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to record sales return.';
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
      await storageService.deleteSalesReturnAsync(confirmDeleteReturn.id);
      if (viewingReturn?.id === confirmDeleteReturn.id) setViewingReturn(null);
      setConfirmDeleteReturn(null);
      await loadRemoteData();
      triggerRefresh();
      showToast(`Sales Return ${confirmDeleteReturn.returnNumber} reversed across inventory, invoice & ledger.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reverse sales return.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const metrics = useMemo(() => {
    const active = returnsList.filter(r => String(r.status || 'POSTED').toUpperCase() !== 'REVERSED');
    const totalValue = round2(active.reduce((s, r) => s + Number(r.totalAmount || 0), 0));
    const totalGstReversed = round2(active.reduce((s, r) => s + Number(r.taxAmount || 0), 0));
    const totalRefunded = round2(active.reduce((s, r) => s + Number(r.refundAmount || 0), 0));
    const creditNoteAdjusted = round2(Math.max(0, totalValue - totalRefunded));
    return { count: active.length, totalValue, totalGstReversed, totalRefunded, creditNoteAdjusted };
  }, [returnsList]);

  const filteredReturns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return returnsList.filter(r => {
      if (typeFilter !== 'ALL' && r.targetType !== typeFilter) return false;
      if (!q) return true;
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      );
    });
  }, [returnsList, searchQuery, typeFilter]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sales Returns / Credit Notes</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600"><RotateCcw className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-mono">{formatINR(metrics.totalValue)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">{metrics.count} active return notes</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Output GST Reversed</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><FileText className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-purple-700 mt-2 font-mono">{formatINR(metrics.totalGstReversed)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">CGST / SGST / IGST adjusted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash / Bank Refunded</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><Landmark className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-2 font-mono">{formatINR(metrics.totalRefunded)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Deducted from bank registers</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receivable Credit Adjusted</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2 font-mono">{formatINR(metrics.creditNoteAdjusted)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Offset against open invoices</span>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            Sales Returns & Credit Notes
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Process returns on Customer or Vendor Sales Invoices with automatic inventory restock, GST reversal, receivable offset, and Cash/Bank refund posting.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Sales Return
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search return #, invoice #, party..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {([
            { id: 'ALL', label: 'All Returns' },
            { id: 'CUSTOMER_INVOICE', label: 'Customer Invoices' },
            { id: 'VENDOR_INVOICE', label: 'Vendor Sales Invoices' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                typeFilter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Credit Note #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Source Invoice</th>
                <th className="p-3.5">Party</th>
                <th className="p-3.5 text-center">Items / Stock</th>
                <th className="p-3.5 text-right">Taxable + GST</th>
                <th className="p-3.5 text-right">Total Credit</th>
                <th className="p-3.5">Settlement / Bank</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.map(sr => (
                <tr key={sr.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-amber-700 whitespace-nowrap">
                    <button onClick={() => setViewingReturn(sr)} className="hover:underline text-left">
                      {sr.returnNumber}
                    </button>
                  </td>
                  <td className="p-3.5 text-slate-600 whitespace-nowrap">{sr.returnDate}</td>
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="font-mono font-semibold text-slate-800">{sr.invoiceNumber}</div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {sr.targetType === 'VENDOR_INVOICE' ? 'Vendor Sale' : 'Customer Sale'}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-800">{sr.partyName}</div>
                    {sr.reason && <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{sr.reason}</div>}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="font-mono font-semibold text-slate-700">{(sr.items || []).length} line(s)</div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        sr.restockInventory
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Boxes className="w-2.5 h-2.5" />
                      {sr.restockInventory ? 'Restocked' : 'No Restock'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                    <div>{formatINR(sr.subtotal)}</div>
                    <div className="text-[10px] text-purple-700">GST: {formatINR(sr.taxAmount)}</div>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    {formatINR(sr.totalAmount)}
                  </td>
                  <td className="p-3.5">
                    {sr.settlementMode === 'BANK_REFUND' ? (
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Refund {formatINR(sr.refundAmount)}
                        </span>
                        {sr.bankAccountName && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Landmark className="w-2.5 h-2.5" />
                            {sr.bankAccountName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Credit Note Offset
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewingReturn(sr)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View Credit Note"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteReturn(sr)}
                        disabled={deletingId === sr.id}
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
                    {loading ? 'Loading sales returns...' : 'No sales returns recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Sales Return Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Record Sales Return (Credit Note)</h3>
                  <p className="text-xs text-slate-500">
                    Reverses Output GST, restocks inventory if enabled, and posts double-entry accounting.
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

              {/* Source Type & Invoice Picker */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Type *</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleTargetTypeChange('CUSTOMER_INVOICE')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        targetType === 'CUSTOMER_INVOICE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTargetTypeChange('VENDOR_INVOICE')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        targetType === 'VENDOR_INVOICE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Vendor Sale
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Source Invoice *</label>
                  <select
                    required
                    value={selectedInvoiceId}
                    onChange={e => handleInvoiceChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="">-- Select Eligible Invoice --</option>
                    {eligibleInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {targetType === 'VENDOR_INVOICE' ? inv.vendorName : inv.customerName} (Total: {formatINR(inv.totalAmount)}, Net Paid: {formatINR(Math.max(0, Number(inv.paidAmount || 0) - Number(inv.refundedAmount || 0)))})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Return Reason *</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. Damaged transit / Wrong spec"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Restock Warehouse</label>
                  <select
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    disabled={!restockInventory}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl disabled:opacity-50"
                  >
                    <option value="">-- Default Hub --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items Table */}
              {selectedInvoice && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Return Line Items — {invoiceMeta.invoiceNumber} ({invoiceMeta.partyName})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftLines(prev => prev.map(l => ({ ...l, quantity: l.maxReturnable })))
                      }
                      className="text-xs font-bold text-amber-700 hover:underline"
                    >
                      Return All Remaining
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Item</th>
                          <th className="p-2.5 text-center">Invoiced</th>
                          <th className="p-2.5 text-center">Prev Ret.</th>
                          <th className="p-2.5 text-center">Max Ret.</th>
                          <th className="p-2.5 text-center w-28">Return Qty</th>
                          <th className="p-2.5 text-right">Rate</th>
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
                                {line.hsnCode && <span className="text-[10px] text-slate-400 font-mono">HSN: {line.hsnCode}</span>}
                              </td>
                              <td className="p-2.5 text-center font-mono">{line.originalQuantity} {line.unit}</td>
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

              {/* Inventory Restock & Settlement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restockInventory}
                      onChange={e => setRestockInventory(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-800">Restock returned goods back into Inventory</span>
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Settlement Mode *</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="srSettlement"
                          checked={settlementMode === 'CREDIT_NOTE'}
                          onChange={() => setSettlementMode('CREDIT_NOTE')}
                          className="mt-0.5 text-amber-500"
                        />
                        <span>
                          <strong className="text-slate-800">Credit Note Adjustment</strong>
                          <span className="block text-[11px] text-slate-500">Reduces receivable balance directly without bank payout.</span>
                        </span>
                      </label>

                      <label className={`flex items-start gap-2 text-xs ${invoiceMeta.netPaid <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="srSettlement"
                          disabled={invoiceMeta.netPaid <= 0}
                          checked={settlementMode === 'BANK_REFUND'}
                          onChange={() => setSettlementMode('BANK_REFUND')}
                          className="mt-0.5 text-amber-500"
                        />
                        <span>
                          <strong className="text-slate-800">Cash / Bank Refund</strong>
                          <span className="block text-[11px] text-slate-500">
                            {invoiceMeta.netPaid > 0
                              ? `Available net paid to refund: ${formatINR(invoiceMeta.netPaid)}`
                              : 'Unavailable — no net payment received on selected invoice.'}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {settlementMode === 'BANK_REFUND' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Pay Refund From Account *</label>
                        <select
                          required
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
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Refund Amount (Max {formatINR(maxRefundAllowed)}) *
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
                    </div>
                  )}
                </div>

                {/* Live Totals Box */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
                    Credit Note GST & Total Preview
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono font-semibold">{formatINR(computedSummary.subtotal)}</span>
                  </div>
                  {invoiceMeta.isInterState ? (
                    <div className="flex justify-between text-purple-700">
                      <span>IGST Reversal:</span>
                      <span className="font-mono font-semibold">{formatINR(computedSummary.igstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-purple-700">
                        <span>CGST Reversal:</span>
                        <span className="font-mono font-semibold">{formatINR(computedSummary.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-purple-700">
                        <span>SGST Reversal:</span>
                        <span className="font-mono font-semibold">{formatINR(computedSummary.sgstAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total Credit Note:</span>
                    <span className="font-mono text-amber-700">{formatINR(computedSummary.totalAmount)}</span>
                  </div>
                  {settlementMode === 'BANK_REFUND' && (
                    <div className="flex justify-between text-xs font-bold text-rose-700 pt-1">
                      <span>Cash / Bank Refund Outflow:</span>
                      <span className="font-mono">{formatINR(refundAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional inspection or credit note remarks..."
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
                  disabled={submitting || !selectedInvoice || computedSummary.totalAmount <= 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Post Credit Note & Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Credit Note Modal */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Credit Note — {viewingReturn.returnNumber}</h3>
                <p className="text-xs text-slate-500">
                  Against Invoice {viewingReturn.invoiceNumber} • Date {viewingReturn.returnDate}
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
                  <span className="text-slate-400 block">Party</span>
                  <span className="font-bold text-slate-900">{viewingReturn.partyName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Source Type</span>
                  <span className="font-bold text-slate-800">{viewingReturn.targetType === 'VENDOR_INVOICE' ? 'Vendor Sales Invoice' : 'Customer Sales Invoice'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Settlement</span>
                  <span className="font-bold text-slate-800">
                    {viewingReturn.settlementMode === 'BANK_REFUND'
                      ? `Bank Refund (${formatINR(viewingReturn.refundAmount)})`
                      : 'Credit Note Offset'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Inventory</span>
                  <span className="font-bold text-slate-800">
                    {viewingReturn.restockInventory ? `Restocked (${viewingReturn.warehouseName || 'Default Hub'})` : 'Not Restocked'}
                  </span>
                </div>
                {viewingReturn.bankAccountName && (
                  <div>
                    <span className="text-slate-400 block">Bank / Cash Account</span>
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
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Taxable</th>
                      <th className="p-2.5 text-right">GST</th>
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
                  {viewingReturn.igstAmount > 0 ? (
                    <div className="flex justify-between text-purple-700">
                      <span>IGST:</span>
                      <span className="font-mono font-semibold">{formatINR(viewingReturn.igstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-purple-700">
                        <span>CGST:</span>
                        <span className="font-mono font-semibold">{formatINR(viewingReturn.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-purple-700">
                        <span>SGST:</span>
                        <span className="font-mono font-semibold">{formatINR(viewingReturn.sgstAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Credit Note Total:</span>
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
            <h4 className="text-base font-bold text-slate-900">Reverse & Delete Sales Return?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reversing Credit Note <strong>{confirmDeleteReturn.returnNumber}</strong> ({formatINR(confirmDeleteReturn.totalAmount)}) will restore the invoice balance, reverse posted journal entries
              {confirmDeleteReturn.restockInventory ? ', deduct restocked inventory' : ''}
              {confirmDeleteReturn.refundAmount > 0 ? `, and restore ${formatINR(confirmDeleteReturn.refundAmount)} back into ${confirmDeleteReturn.bankAccountName || 'the bank account'}` : ''}.
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
