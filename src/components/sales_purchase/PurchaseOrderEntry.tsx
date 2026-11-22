import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { apiClient } from '../../services/apiClient';
import { PurchaseOrder, PurchaseLineItem, Vendor, ProductItem, SolarProject, BankAccount, VendorBillAttachment } from '../../types/solar';
import { validatePOLineItem, validatePOLineItems, validatePurchaseOrder } from '../../services/validation';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Truck,
  Trash2,
  Eye,
  AlertTriangle,
  X,
  PackagePlus,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  Edit3,
  CheckCircle2,
  PackageCheck,
  Loader2,
  CreditCard,
  Landmark,
  Paperclip
} from 'lucide-react';
import { GoodsReceiptModal } from './purchase_order/GoodsReceiptModal';
import { EditPurchaseOrderModal } from './purchase_order/EditPurchaseOrderModal';
import { PurchaseOrderSummaryModal } from './purchase_order/PurchaseOrderSummaryModal';
import { VendorBillAttachmentsSection } from './purchase_order/VendorBillAttachmentsSection';

export const PurchaseOrderEntry: React.FC = () => {
  const { refreshTrigger, triggerRefresh, showToast } = useApp();
  const { currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingPOId, setViewingPOId] = useState<string | null>(null);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [receivingPOId, setReceivingPOId] = useState<string | null>(null);
  const [paymentPOId, setPaymentPOId] = useState<string | null>(null);
  const [confirmDeletePO, setConfirmDeletePO] = useState<{ id: string; poNum: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [syncTick, setSyncTick] = useState(0);

  // Payment modal form state
  const [poPayDate, setPoPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [poPayAmount, setPoPayAmount] = useState<number>(0);
  const [poPayTdsDeducted, setPoPayTdsDeducted] = useState<number>(0);
  const [poPayTdsSection, setPoPayTdsSection] = useState('194C');
  const [poPayBankAccountId, setPoPayBankAccountId] = useState('');
  const [poPayMode, setPoPayMode] = useState('Bank NEFT / RTGS');
  const [poPayReference, setPoPayReference] = useState('');
  const [poPayNotes, setPoPayNotes] = useState('');

  // Form states for creating new PO
  const [formVendorId, setFormVendorId] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formPurchaseDate, setFormPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [formExpectedDate, setFormExpectedDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [formPaymentStatus, setFormPaymentStatus] = useState<PurchaseOrder['paymentStatus']>('UNPAID');
  const [formInitialPaidAmount, setFormInitialPaidAmount] = useState<number>(0);
  const [formBankAccountId, setFormBankAccountId] = useState('');
  const [formPaymentMode, setFormPaymentMode] = useState('Bank NEFT / RTGS');
  const [formPaymentReference, setFormPaymentReference] = useState('');
  const [formPaymentDueDate, setFormPaymentDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [formInvoiceRef, setFormInvoiceRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [draftPoId, setDraftPoId] = useState(() => `po-${Date.now()}`);
  const [formVendorBills, setFormVendorBills] = useState<VendorBillAttachment[]>([]);
  const [lineItemError, setLineItemError] = useState('');
  const [formError, setFormError] = useState('');

  // Line items state for creating new PO
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState<number>(10);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [itemTaxRate, setItemTaxRate] = useState<number>(12);

  useEffect(() => {
    storageService
      .fetchAccountingBankAccountsAsync()
      .then(banks => {
        setBankAccounts(banks);
        const primary = banks.find((b: any) => b.isActive && b.isPrimary) || banks.find((b: any) => b.isActive);
        if (primary) {
          setFormBankAccountId(prev => prev || primary.id);
        }
      })
      .catch(() => undefined);
    const onUpdated = () => setSyncTick(t => t + 1);
    window.addEventListener('solarpulse_storage_updated', onUpdated);
    return () => window.removeEventListener('solarpulse_storage_updated', onUpdated);
  }, []);

  const activeBankAccounts = useMemo(
    () => bankAccounts.filter(b => b.isActive),
    [bankAccounts]
  );

  const orders = useMemo(() => storageService.getPurchaseOrders(), [refreshTrigger, syncTick]);
  const vendors = useMemo(() => storageService.getVendors(), [refreshTrigger, syncTick]);
  const products = useMemo(() => storageService.getProducts(), [refreshTrigger, syncTick]);
  const projects = useMemo(() => storageService.getProjects(), [refreshTrigger, syncTick]);
  const warehouses = useMemo(() => storageService.getWarehouses(), [refreshTrigger, syncTick]);

  const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const getPOBalanceInfo = (po: PurchaseOrder) => {
    const total = round2(Number(po.totalAmount || 0));
    const paid = round2(Number(po.paidAmount || 0));
    const returned = round2(Number(po.returnedAmount || 0));
    const refunded = round2(Number(po.refundedAmount || 0));
    const netPaid = round2(Math.max(0, paid - refunded));
    const balance = round2(
      po.balanceAmount != null
        ? Math.max(0, Number(po.balanceAmount))
        : Math.max(0, total - returned - netPaid)
    );
    return { total, paid, returned, refunded, netPaid, balance };
  };

  const viewingPO = useMemo(
    () => (viewingPOId ? orders.find(o => o.id === viewingPOId) || null : null),
    [orders, viewingPOId]
  );
  const editingPO = useMemo(
    () => (editingPOId ? orders.find(o => o.id === editingPOId) || null : null),
    [orders, editingPOId]
  );
  const receivingPO = useMemo(
    () => (receivingPOId ? orders.find(o => o.id === receivingPOId) || null : null),
    [orders, receivingPOId]
  );
  const paymentPO = useMemo(
    () => (paymentPOId ? orders.find(o => o.id === paymentPOId) || null : null),
    [orders, paymentPOId]
  );

  const metrics = useMemo(() => {
    const totalPurchases = round2(orders.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0));
    const pendingDeliveries = orders.filter(o => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED').length;
    const partialDeliveries = orders.filter(o => o.status === 'PARTIALLY_RECEIVED').length;
    const receivedOrders = orders.filter(o => o.status === 'RECEIVED').length;
    const totalPendingPayment = round2(
      orders
        .filter(o => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + getPOBalanceInfo(o).balance, 0)
    );

    return { totalPurchases, pendingDeliveries, partialDeliveries, receivedOrders, totalPendingPayment };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();

    return orders.filter(o => {
      const matchesSearch =
        !q ||
        (o.purchaseNumber || '').toLowerCase().includes(q) ||
        (o.vendorName || '').toLowerCase().includes(q) ||
        ((o.projectTitle || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // When a product is chosen in line items builder
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    setLineItemError('');
    if (!prodId) return;

    // Check if product is already in line items
    const existing = lineItems.find(it => it.productId === prodId);
    if (existing) {
      const prod = products.find(p => p.id === prodId);
      const msg = `Product "${prod?.name || prodId}" is already added to this Purchase Order (Ordered: ${existing.orderedQuantity} ${existing.unit}). Please adjust the existing item quantity instead of adding it again.`;
      setLineItemError(msg);
      showToast(msg, 'warning');
      return;
    }

    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setItemUnitPrice(prod.unitPrice);
      const prodGst =
        prod.gstRate !== undefined && prod.gstRate !== null && Number.isFinite(Number(prod.gstRate))
          ? Number(prod.gstRate)
          : 12;
      setItemTaxRate(prodGst);
      if (prod.preferredVendorId && !formVendorId) {
        setFormVendorId(prod.preferredVendorId);
      }
    }
  };

  const handleAddLineItem = () => {
    setLineItemError('');
    if (!selectedProductId) {
      setLineItemError('Please select a product from catalog.');
      showToast('Please select a product from catalog', 'warning');
      return;
    }
    if (itemQty <= 0 || itemUnitPrice <= 0) {
      setLineItemError('Quantity and Unit Price must be greater than 0.');
      showToast('Quantity and Unit Price must be greater than 0', 'warning');
      return;
    }

    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    // Strict duplicate check before adding
    const candidateItem: Partial<PurchaseLineItem> = {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku
    };
    const duplicateValidation = validatePOLineItem(candidateItem, lineItems);
    if (!duplicateValidation.valid) {
      const msg = duplicateValidation.message || `Product "${prod.name}" is already included in this Purchase Order.`;
      setLineItemError(msg);
      showToast(msg, 'warning');
      return;
    }

    if (!Number.isFinite(itemTaxRate) || itemTaxRate < 0 || itemTaxRate > 100) {
      setLineItemError('GST Rate (%) must be between 0 and 100.');
      showToast('GST Rate (%) must be between 0 and 100', 'warning');
      return;
    }

    const baseAmount = itemQty * itemUnitPrice;
    const taxAmt = Number(((baseAmount * itemTaxRate) / 100).toFixed(2));
    const totalAmt = Number((baseAmount + taxAmt).toFixed(2));

    const newItem: PurchaseLineItem = {
      id: `poi-${Date.now()}-${lineItems.length}`,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      category: prod.category,
      orderedQuantity: itemQty,
      receivedQuantity: 0,
      pendingQuantity: itemQty,
      rejectedQuantity: 0,
      unit: prod.unit,
      unitPrice: itemUnitPrice,
      taxPercent: itemTaxRate,
      taxAmount: taxAmt,
      totalAmount: totalAmt,
      quantity: itemQty,
      taxRatePercent: itemTaxRate,
      totalPrice: totalAmt
    };

    setLineItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setItemQty(10);
    setItemUnitPrice(0);
    setItemTaxRate(12);
    setLineItemError('');
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
    setLineItemError('');
    setFormError('');
  };

  const formSubtotal = useMemo(() => {
    return lineItems.reduce((acc, it) => acc + it.orderedQuantity * it.unitPrice, 0);
  }, [lineItems]);

  const formTaxTotal = useMemo(() => {
    return lineItems.reduce((acc, it) => acc + it.taxAmount, 0);
  }, [lineItems]);

  const formGrandTotal = formSubtotal + formTaxTotal;

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError('');

    if (!formVendorId) {
      setFormError('Please select a vendor.');
      showToast('Please select a vendor', 'warning');
      return;
    }

    if (lineItems.length === 0) {
      setFormError('Please add at least one line item to the purchase order.');
      showToast('Please add at least one line item to the purchase order', 'warning');
      return;
    }

    const duplicateValidation = validatePOLineItems(lineItems);
    if (!duplicateValidation.valid) {
      const msg = duplicateValidation.message || 'Duplicate products found in Purchase Order.';
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    let initialPaidAmount = 0;
    if (formPaymentStatus === 'PAID') {
      initialPaidAmount = round2(formGrandTotal);
    } else if (formPaymentStatus === 'PARTIALLY_PAID') {
      if (!Number.isFinite(formInitialPaidAmount) || formInitialPaidAmount <= 0 || formInitialPaidAmount > formGrandTotal + 0.01) {
        const msg = `Initial partial PO payment must be between ₹0.01 and ₹${round2(formGrandTotal).toLocaleString('en-IN')}.`;
        setFormError(msg);
        showToast(msg, 'warning');
        return;
      }
      initialPaidAmount = round2(formInitialPaidAmount);
    }
    if (initialPaidAmount > 0 && activeBankAccounts.length > 0 && !formBankAccountId) {
      const msg = 'Please select the Cash / Bank account used to pay this vendor.';
      setFormError(msg);
      showToast(msg, 'warning');
      return;
    }

    const vendor = vendors.find(v => v.id === formVendorId);
    const project = projects.find(p => p.id === formProjectId);
    const selectedWh = warehouses.find(w => w.id === formWarehouseId) || storageService.getDefaultWarehouse();
    const selectedBank = activeBankAccounts.find(b => b.id === formBankAccountId);

    const newPO: PurchaseOrder & { paymentMode?: string; referenceNo?: string } = {
      id: draftPoId || `po-${Date.now()}`,
      purchaseNumber: `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`,
      vendorId: formVendorId,
      vendorName: vendor?.name || 'Authorized Supplier',
      purchaseDate: formPurchaseDate,
      expectedDeliveryDate: formExpectedDate,
      projectId: formProjectId || undefined,
      projectTitle: project?.title || undefined,
      warehouseId: selectedWh.id,
      warehouseName: selectedWh.name,
      items: lineItems,
      subtotal: formSubtotal,
      taxAmount: formTaxTotal,
      totalAmount: formGrandTotal,
      status: 'ORDERED',
      paymentStatus: formPaymentStatus,
      paidAmount: initialPaidAmount > 0 ? initialPaidAmount : 0,
      bankAccountId: initialPaidAmount > 0 ? selectedBank?.id || undefined : undefined,
      bankAccountName: initialPaidAmount > 0 ? selectedBank?.accountName || undefined : undefined,
      paymentMode: initialPaidAmount > 0 ? formPaymentMode : undefined,
      referenceNo: initialPaidAmount > 0 ? formPaymentReference.trim() || undefined : undefined,
      paymentDueDate: formPaymentDueDate,
      invoiceReference: formInvoiceRef.trim() || undefined,
      notes: formNotes.trim() || undefined,
      vendorBills: formVendorBills,
      vendorBillUrl: formVendorBills[0]?.fileUrl || undefined,
      vendorBillName: formVendorBills[0]?.fileName || undefined,
      vendorBillMimeType: formVendorBills[0]?.mimeType || undefined,
      vendorBillSize: formVendorBills[0]?.fileSize || undefined,
      vendorBillUploadedAt: formVendorBills[0]?.uploadedAt || undefined,
      stockUpdated: false,
      deliveryReceipts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      const saved = await storageService.savePurchaseOrderAsync(newPO, false);
      if (initialPaidAmount > 0) {
        const latestBanks = await storageService.fetchAccountingBankAccountsAsync().catch(() => []);
        if (latestBanks.length > 0) setBankAccounts(latestBanks);
      }
      triggerRefresh();
      showToast(`Purchase Order ${saved.purchaseNumber} submitted to ${saved.vendorName}`, 'success');
      setIsCreateModalOpen(false);

      setFormVendorId('');
      setFormProjectId('');
      setFormWarehouseId('');
      setLineItems([]);
      setFormNotes('');
      setFormInvoiceRef('');
      setFormPaymentStatus('UNPAID');
      setFormInitialPaidAmount(0);
      setFormPaymentReference('');
      setFormVendorBills([]);
      setDraftPoId(`po-${Date.now()}`);
      setLineItemError('');
      setFormError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save purchase order.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseCreateModal = () => {
    if (isSaving) return;
    if (formVendorBills.length > 0 && draftPoId) {
      formVendorBills.forEach(bill => {
        apiClient.deletePurchaseOrderBill(draftPoId, bill.id).catch(() => undefined);
      });
    }
    setIsCreateModalOpen(false);
    setFormVendorBills([]);
    setDraftPoId(`po-${Date.now()}`);
    setLineItemError('');
    setFormError('');
  };

  const openPaymentModal = (order: PurchaseOrder) => {
    const { balance } = getPOBalanceInfo(order);
    const defaultBank =
      activeBankAccounts.find(b => b.isPrimary)?.id || activeBankAccounts[0]?.id || '';
    setPaymentPOId(order.id);
    setPoPayDate(new Date().toISOString().slice(0, 10));
    setPoPayAmount(balance > 0 ? balance : 0);
    setPoPayTdsDeducted(0);
    setPoPayTdsSection('194C');
    setPoPayBankAccountId(defaultBank);
    setPoPayMode('Bank NEFT / RTGS');
    setPoPayReference('');
    setPoPayNotes('');
    if (activeBankAccounts.length === 0) {
      storageService
        .fetchAccountingBankAccountsAsync()
        .then(banks => {
          setBankAccounts(banks);
          const def = banks.find(b => b.isActive && b.isPrimary)?.id || banks.find(b => b.isActive)?.id || '';
          if (def) setPoPayBankAccountId(prev => prev || def);
        })
        .catch(() => undefined);
    }
  };

  const handleSubmitPOPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPO || isRecordingPayment) return;

    const { balance } = getPOBalanceInfo(paymentPO);
    const grossSettlement = round2(Number(poPayAmount || 0) + Number(poPayTdsDeducted || 0));

    if (!Number.isFinite(poPayAmount) || poPayAmount <= 0) {
      showToast('Enter a valid payment amount greater than 0.', 'warning');
      return;
    }
    if (poPayTdsDeducted < 0) {
      showToast('TDS deducted cannot be negative.', 'warning');
      return;
    }
    if (grossSettlement > balance + 0.01) {
      showToast(`Cash paid + TDS cannot exceed remaining balance (₹${balance.toLocaleString('en-IN')}).`, 'warning');
      return;
    }
    if (activeBankAccounts.length > 0 && !poPayBankAccountId) {
      showToast('Select the Cash / Bank account used for this vendor payment.', 'warning');
      return;
    }

    setIsRecordingPayment(true);
    try {
      const updated = await storageService.recordPurchaseOrderPaymentAsync(paymentPO.id, {
        amount: round2(poPayAmount),
        tdsDeducted: round2(poPayTdsDeducted),
        tdsSection: poPayTdsDeducted > 0 ? poPayTdsSection : undefined,
        paymentDate: poPayDate,
        paymentMode: poPayMode,
        bankAccountId: poPayBankAccountId || undefined,
        referenceNo: poPayReference.trim() || undefined,
        notes: poPayNotes.trim() || undefined
      });
      const latestBanks = await storageService.fetchAccountingBankAccountsAsync().catch(() => []);
      if (latestBanks.length > 0) setBankAccounts(latestBanks);
      triggerRefresh();
      showToast(
        `Recorded ₹${poPayAmount.toLocaleString('en-IN')} payment for ${updated?.purchaseNumber || updated?.poNumber || paymentPO.purchaseNumber} (${updated?.paymentStatus || 'PAID'}).`,
        'success'
      );
      setPaymentPOId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record purchase order payment.';
      showToast(msg, 'error');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleDeletePO = async () => {
    if (!confirmDeletePO || deletingId) return;
    const { id, poNum } = confirmDeletePO;
    setDeletingId(id);
    try {
      await storageService.deletePurchaseOrderAsync(id);
      if (viewingPOId === id) setViewingPOId(null);
      if (editingPOId === id) setEditingPOId(null);
      if (receivingPOId === id) setReceivingPOId(null);
      if (paymentPOId === id) setPaymentPOId(null);
      setConfirmDeletePO(null);
      triggerRefresh();
      showToast(`Purchase Order ${poNum} deleted`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete purchase order';
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOrderSavedFromModal = (_updated: PurchaseOrder) => {
    triggerRefresh();
  };

  const handleReceiptRecordedFromModal = (_updated: PurchaseOrder) => {
    triggerRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Purchase Value
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
            ₹{metrics.totalPurchases.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across {orders.length} orders
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Deliveries In Inflow
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-blue-700 mt-2 font-mono">
            {metrics.pendingDeliveries} Orders
          </div>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
            {metrics.partialDeliveries > 0 ? `${metrics.partialDeliveries} partially delivered` : 'Awaiting physical delivery'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stock Synchronized
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2 font-mono">
            {metrics.receivedOrders} Fully Received
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            Physical stock updated on delivery
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Vendor Payables
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-2 font-mono">
            ₹{metrics.totalPendingPayment.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Unpaid vendor balances
          </span>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-500" />
            Purchase Entry & Orders
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Editable purchase order summaries with multi-stage partial product receipt and inventory tracking.
          </p>
        </div>

        <button
          id="btn-create-po"
          onClick={() => {
            setDraftPoId(`po-${Date.now()}`);
            setFormVendorBills([]);
            setLineItemError('');
            setFormError('');
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Purchase Entry
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO #, vendor, project..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          {['ALL', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DRAFT'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st === 'PARTIALLY_RECEIVED' ? 'PARTIALLY RECEIVED' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">PO Number</th>
                <th className="p-3.5">Vendor</th>
                <th className="p-3.5">Linked Project</th>
                <th className="p-3.5">PO Date</th>
                <th className="p-3.5">Delivery Progress</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Physical Receipt Action</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map(order => {
                const totalOrdered = order.items.reduce((sum, it) => sum + it.orderedQuantity, 0);
                const totalReceived = order.items.reduce((sum, it) => sum + it.receivedQuantity, 0);
                const totalPending = order.items.reduce((sum, it) => sum + it.pendingQuantity, 0);
                const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                const poBal = getPOBalanceInfo(order);

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-amber-600 whitespace-nowrap">
                      <button
                        onClick={() => setViewingPOId(order.id)}
                        className="hover:underline text-left cursor-pointer"
                        title="View PO Summary"
                      >
                        {order.purchaseNumber}
                      </button>
                      {order.bankAccountName && (
                        <span className="block text-[10px] text-slate-400 font-sans font-normal">
                          Paid via: {order.bankAccountName}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {order.vendorName}
                      {order.invoiceReference && (
                        <span className="block text-[10px] text-slate-400 font-mono font-normal">
                          Ref: {order.invoiceReference}
                        </span>
                      )}
                      {((order.vendorBills && order.vendorBills.length > 0) || order.vendorBillUrl) && (
                        <button
                          type="button"
                          onClick={() => setViewingPOId(order.id)}
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold cursor-pointer"
                          title="View attached vendor bill"
                        >
                          <Paperclip className="w-2.5 h-2.5" />
                          <span>
                            {order.vendorBills && order.vendorBills.length > 1
                              ? `${order.vendorBills.length} Vendor Bills`
                              : 'Bill Attached'}
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-xs truncate">
                      <span className="block font-medium text-slate-850">
                        {order.projectTitle || 'Central Stock'}
                      </span>
                      <span className="block text-[10px] text-amber-700 font-semibold truncate" title={order.warehouseName || 'Central Hub'}>
                        Hub: {order.warehouseName || 'Central Solar Logistics Hub'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">{order.purchaseDate}</td>
                    
                    {/* Delivery Progress Column */}
                    <td className="p-3.5 whitespace-nowrap min-w-[140px]">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-slate-800 font-mono">
                          {totalReceived} / {totalOrdered} Units
                        </span>
                        <span className="font-semibold text-slate-500 font-mono text-[10px]">
                          {percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            percent === 100
                              ? 'bg-emerald-500'
                              : percent > 0
                              ? 'bg-amber-500'
                              : 'bg-slate-200'
                          }`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </td>

                    <td className="p-3.5 text-right font-mono tabular-nums">
                      <div className="font-bold text-slate-900 text-sm">
                        ₹{order.totalAmount.toLocaleString('en-IN')}
                      </div>
                      {poBal.netPaid > 0 && (
                        <div className="text-[10px] text-emerald-700">
                          Paid: ₹{poBal.netPaid.toLocaleString('en-IN')}
                        </div>
                      )}
                      {poBal.returned > 0 && (
                        <div className="text-[10px] text-amber-700">
                          Returned: -₹{poBal.returned.toLocaleString('en-IN')}
                        </div>
                      )}
                      {poBal.balance > 0.01 && order.status !== 'CANCELLED' && (
                        <div className="text-[10px] font-semibold text-rose-700">
                          Due: ₹{poBal.balance.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${
                          order.status === 'RECEIVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : order.status === 'PARTIALLY_RECEIVED'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : order.status === 'ORDERED'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {order.status === 'PARTIALLY_RECEIVED' ? 'PARTIALLY RECEIVED' : order.status}
                      </span>
                      <span
                        className={`block mt-1 text-[9px] font-bold uppercase tracking-wider ${
                          order.paymentStatus === 'PAID'
                            ? 'text-emerald-700'
                            : order.paymentStatus === 'PARTIALLY_PAID'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {(order.paymentStatus || 'UNPAID').replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Inflow Action */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {order.status === 'RECEIVED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          Stock Fully Added
                        </span>
                      ) : order.status === 'PARTIALLY_RECEIVED' ? (
                        <button
                          onClick={() => setReceivingPOId(order.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] rounded-lg border border-amber-200 transition-colors shadow-2xs cursor-pointer"
                          title="Record arrival of next delivery batch"
                        >
                          <Truck className="w-3 h-3 text-amber-600" />
                          Receive Balance ({totalPending} left)
                        </button>
                      ) : (
                        <button
                          onClick={() => setReceivingPOId(order.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          <PackagePlus className="w-3 h-3" />
                          Receive Goods (GRN)
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingPOId(order.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View PO Summary & Receipts"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {order.status !== 'CANCELLED' && poBal.balance > 0.01 && (
                          <button
                            onClick={() => openPaymentModal(order)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Record Vendor Payment via Bank/Cash"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingPOId(order.id)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit PO Summary & Quantities"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {totalPending > 0 && (
                          <button
                            onClick={() => setReceivingPOId(order.id)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Record Delivery Receipt"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeletePO({ id: order.id, poNum: order.purchaseNumber })}
                          disabled={deletingId === order.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                          title="Delete PO"
                        >
                          {deletingId === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    No purchase orders found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Purchase Entry Form */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Create Purchase Order Entry</h3>
                  <p className="text-xs text-slate-500">
                    Procure equipment and solar components from authorized manufacturers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePO} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Vendor, Warehouse & Project */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Vendor *
                  </label>
                  <select
                    required
                    value={formVendorId}
                    onChange={e => setFormVendorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category} - {v.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Destination Warehouse *
                  </label>
                  <select
                    value={formWarehouseId}
                    onChange={e => setFormWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="">-- Primary Logistics Hub --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) {w.isDefault ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Direct Site Project Allocation (Optional)
                  </label>
                  <select
                    value={formProjectId}
                    onChange={e => setFormProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="">-- General Warehouse Stock --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.customerName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    required
                    value={formPurchaseDate}
                    onChange={e => setFormPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formExpectedDate}
                    onChange={e => setFormExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vendor Invoice / Challan Ref
                  </label>
                  <input
                    type="text"
                    value={formInvoiceRef}
                    onChange={e => setFormInvoiceRef(e.target.value)}
                    placeholder="e.g. WAA-INV-998"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Purchase Order Line Items
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Product Catalog Item *
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={e => handleProductSelect(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Select Product to Order --</option>
                      {products.map(p => {
                        const isAlreadyAdded = lineItems.some(
                          it => it.productId === p.id || (p.sku && it.sku === p.sku)
                        );
                        return (
                          <option
                            key={p.id}
                            value={p.id}
                            disabled={isAlreadyAdded}
                            className={isAlreadyAdded ? 'text-slate-400 bg-slate-50' : ''}
                          >
                            {isAlreadyAdded
                              ? `[Already in PO] ${p.sku} - ${p.name}`
                              : `${p.sku} - ${p.name} (Stock: ${p.currentStock})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={e => setItemQty(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unit Cost (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={itemUnitPrice}
                      onChange={e => setItemUnitPrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      GST Rate (%)
                    </label>
                    <select
                      value={itemTaxRate}
                      onChange={e => setItemTaxRate(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      {Array.from(new Set([0, 5, 12, 18, 28, itemTaxRate]))
                        .filter(r => Number.isFinite(r) && r >= 0 && r <= 100)
                        .sort((a, b) => a - b)
                        .map(rate => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Line Item Validation Error Banner */}
                {lineItemError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{lineItemError}</span>
                  </div>
                )}

                {/* Items Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right">GST</th>
                        <th className="p-2.5 text-right">Total</th>
                        <th className="p-2.5 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium text-slate-800">
                            <div>{it.productName}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{it.sku}</span>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-700">
                            {it.orderedQuantity} {it.unit}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600">
                            ₹{it.unitPrice.toLocaleString('en-IN')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-purple-700">
                            ₹{it.taxAmount.toLocaleString('en-IN')} ({it.taxPercent}%)
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                            ₹{it.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {lineItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                            No items added. Select a product above to add to PO.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {lineItems.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-xs">
                        <tr>
                          <td colSpan={4} className="p-2 text-right text-slate-600">
                            Subtotal:
                          </td>
                          <td className="p-2 text-right font-mono">
                            ₹{formSubtotal.toLocaleString('en-IN')}
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="p-2 text-right text-slate-600">
                            Total GST Tax:
                          </td>
                          <td className="p-2 text-right font-mono text-purple-700">
                            ₹{formTaxTotal.toLocaleString('en-IN')}
                          </td>
                          <td></td>
                        </tr>
                        <tr className="border-t border-slate-300 text-sm font-bold bg-amber-50">
                          <td colSpan={4} className="p-2.5 text-right text-amber-900">
                            Grand Total (with Tax):
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-900">
                            ₹{formGrandTotal.toLocaleString('en-IN')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Initial Payment & Cash/Bank Selection */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-amber-600" />
                    <span>Vendor Payment &amp; Bank Account (Optional Upfront Settlement)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(['UNPAID', 'PARTIALLY_PAID', 'PAID'] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setFormPaymentStatus(opt);
                          if (opt === 'PAID') setFormInitialPaidAmount(round2(formGrandTotal));
                          else if (opt === 'PARTIALLY_PAID' && formInitialPaidAmount <= 0) setFormInitialPaidAmount(round2(formGrandTotal * 0.5));
                          else if (opt === 'UNPAID') setFormInitialPaidAmount(0);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          formPaymentStatus === opt
                            ? 'bg-amber-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt === 'UNPAID' ? 'Pay Later' : opt === 'PARTIALLY_PAID' ? 'Partial Advance' : 'Paid in Full'}
                      </button>
                    ))}
                  </div>
                </div>

                {formPaymentStatus !== 'UNPAID' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Pay From Cash / Bank Account *
                      </label>
                      <select
                        required={activeBankAccounts.length > 0}
                        value={formBankAccountId}
                        onChange={e => setFormBankAccountId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        {activeBankAccounts.length === 0 && (
                          <option value="">Default Cash / Bank Ledger</option>
                        )}
                        {activeBankAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountName} ({acc.accountType}) — Bal: ₹{Number(acc.currentBalance || 0).toLocaleString('en-IN')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {formPaymentStatus === 'PAID' ? 'Full Payment (₹)' : 'Advance Amount (₹) *'}
                      </label>
                      <input
                        type="number"
                        min={0.01}
                        max={Math.max(0.01, round2(formGrandTotal))}
                        step="0.01"
                        disabled={formPaymentStatus === 'PAID'}
                        required
                        value={formPaymentStatus === 'PAID' ? round2(formGrandTotal) : formInitialPaidAmount}
                        onChange={e => setFormInitialPaidAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                      <select
                        value={formPaymentMode}
                        onChange={e => setFormPaymentMode(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="Bank NEFT / RTGS">Bank NEFT / RTGS</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Due Date</label>
                      <input
                        type="date"
                        value={formPaymentDueDate}
                        onChange={e => setFormPaymentDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">UTR / Cheque Ref</label>
                      <input
                        type="text"
                        value={formPaymentReference}
                        onChange={e => setFormPaymentReference(e.target.value)}
                        placeholder="Optional reference number"
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Vendor Bill Upload */}
              <VendorBillAttachmentsSection
                poId={draftPoId}
                bills={formVendorBills}
                onBillsChange={setFormVendorBills}
                showToast={showToast}
              />

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Procurement Notes / Dispatch Instructions
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Delivery address, unloading crane requirement, test certificates..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                />
              </div>

              {/* Form Validation Error */}
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || lineItems.length === 0 || !validatePOLineItems(lineItems).valid}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSaving ? 'Saving to MySQL...' : 'Confirm & Place PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View PO Summary & Delivery Receipts */}
      {viewingPO && (
        <PurchaseOrderSummaryModal
          order={viewingPO}
          onClose={() => setViewingPOId(null)}
          onEditPO={order => {
            setViewingPOId(null);
            setEditingPOId(order.id);
          }}
          onReceiveGoods={order => {
            setViewingPOId(null);
            setReceivingPOId(order.id);
          }}
          onRecordPayment={order => {
            setViewingPOId(null);
            openPaymentModal(order);
          }}
        />
      )}

      {/* Modal: Edit PO Summary & Quantities */}
      {editingPO && (
        <EditPurchaseOrderModal
          order={editingPO}
          vendors={vendors}
          products={products}
          projects={projects}
          onClose={() => setEditingPOId(null)}
          onOrderSaved={handleOrderSavedFromModal}
          showToast={showToast}
        />
      )}

      {/* Modal: Record Delivery Receipt (GRN) */}
      {receivingPO && (
        <GoodsReceiptModal
          order={receivingPO}
          currentUser={currentUser}
          onClose={() => setReceivingPOId(null)}
          onReceiptRecorded={handleReceiptRecordedFromModal}
          showToast={showToast}
        />
      )}

      {/* Modal: Record Purchase Order Payment */}
      {paymentPO && (() => {
        const payBal = getPOBalanceInfo(paymentPO);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Purchase Order Payment</h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {paymentPO.purchaseNumber} • {paymentPO.vendorName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRecordingPayment}
                  onClick={() => setPaymentPOId(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitPOPayment} className="p-5 space-y-4 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block">Net Billed</span>
                    <span className="font-bold text-slate-900">
                      ₹{Math.max(0, payBal.total - payBal.returned).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block">Net Paid</span>
                    <span className="font-bold text-emerald-700">
                      ₹{payBal.netPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block">Balance Due</span>
                    <span className="font-bold text-rose-700">
                      ₹{payBal.balance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pay From Cash / Bank Account *</span>
                  </label>
                  <select
                    required={activeBankAccounts.length > 0}
                    value={poPayBankAccountId}
                    onChange={e => setPoPayBankAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    {activeBankAccounts.length === 0 && (
                      <option value="">Default Cash / Bank Ledger</option>
                    )}
                    {activeBankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.accountType}) — Bal: ₹{Number(acc.currentBalance || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={poPayDate}
                      onChange={e => setPoPayDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">Cash Paid (₹) *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setPoPayTdsDeducted(0);
                          setPoPayAmount(payBal.balance);
                        }}
                        className="text-[10px] font-semibold text-amber-700 hover:underline cursor-pointer"
                      >
                        Pay Full
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0.01}
                      max={payBal.balance}
                      step="0.01"
                      required
                      value={poPayAmount}
                      onChange={e => setPoPayAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">TDS Deducted (₹)</label>
                    <input
                      type="number"
                      min={0}
                      max={payBal.balance}
                      step="0.01"
                      value={poPayTdsDeducted}
                      onChange={e => setPoPayTdsDeducted(Number(e.target.value))}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">TDS Section</label>
                    <select
                      value={poPayTdsSection}
                      onChange={e => setPoPayTdsSection(e.target.value)}
                      disabled={poPayTdsDeducted <= 0}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg disabled:bg-slate-100"
                    >
                      <option value="194C">194C (Contractors)</option>
                      <option value="194Q">194Q (Goods Purchase)</option>
                      <option value="194J">194J (Technical / Prof.)</option>
                      <option value="194H">194H (Commission)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Mode *</label>
                    <select
                      value={poPayMode}
                      onChange={e => setPoPayMode(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="Bank NEFT / RTGS">Bank NEFT / RTGS</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">UTR / Reference No.</label>
                    <input
                      type="text"
                      value={poPayReference}
                      onChange={e => setPoPayReference(e.target.value)}
                      placeholder="UTR / Cheque #"
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={poPayNotes}
                    onChange={e => setPoPayNotes(e.target.value)}
                    placeholder="Optional disbursement notes"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={isRecordingPayment}
                    onClick={() => setPaymentPOId(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRecordingPayment}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-60"
                  >
                    {isRecordingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save PO Payment</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: Confirm Delete PO */}
      {confirmDeletePO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Purchase Order?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to delete{' '}
                  <strong className="font-mono">{confirmDeletePO.poNum}</strong>? Linked inventory or accounting records must be consistent before removal.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeletePO(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleDeletePO}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer disabled:opacity-60"
              >
                {deletingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete PO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
