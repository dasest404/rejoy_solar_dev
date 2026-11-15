import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { BOMManager } from '../sales_purchase/BOMManager';
import { InvoiceCreator } from '../sales_purchase/InvoiceCreator';
import { VendorManager } from '../sales_purchase/VendorManager';
import { PurchaseOrderEntry } from '../sales_purchase/PurchaseOrderEntry';
import { ProductCatalog } from '../sales_purchase/ProductCatalog';
import { InventoryStockManager } from '../sales_purchase/InventoryStockManager';
import { WarehouseManager } from '../sales_purchase/WarehouseManager';
import {
  Layers,
  FileText,
  Building2,
  ShoppingCart,
  Package,
  Boxes,
  ArrowRightLeft,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Warehouse as WarehouseIcon
} from 'lucide-react';

type MainSection = 'SALES' | 'PURCHASE' | 'INVENTORY' | 'WAREHOUSE';

export const SalesPurchaseView: React.FC = () => {
  const { activeView, setActiveView } = useApp();
  const { canAccessModule } = useAuth();

  const canBom = canAccessModule('sales_bom');
  const canInvoices = canAccessModule('sales_invoices');
  const canPo = canAccessModule('purchase_orders');
  const canVendors = canAccessModule('purchase_vendors');
  const canStock = canAccessModule('inventory_stock');
  const canProducts = canAccessModule('inventory_products');
  const canWarehouse = canAccessModule('warehouse_management');

  const canSales = canBom || canInvoices;
  const canPurchase = canPo || canVendors;
  const canInventory = canStock || canProducts;

  const [activeSection, setActiveSection] = useState<MainSection>(() => {
    if (canSales) return 'SALES';
    if (canPurchase) return 'PURCHASE';
    if (canInventory) return 'INVENTORY';
    return 'WAREHOUSE';
  });
  const [salesSubTab, setSalesSubTab] = useState<'BOM' | 'INVOICE'>(() => (canBom ? 'BOM' : 'INVOICE'));
  const [purchaseSubTab, setPurchaseSubTab] = useState<'VENDORS' | 'PO_ENTRY'>(() => (canPo ? 'PO_ENTRY' : 'VENDORS'));
  const [inventorySubTab, setInventorySubTab] = useState<'PRODUCTS' | 'STOCK'>(() => (canStock ? 'STOCK' : 'PRODUCTS'));

  // Sync with activeView from Sidebar / AppContext navigation & enforce permitted subtab fallback
  useEffect(() => {
    if (activeView === 'sales_bom' && canBom) {
      setActiveSection('SALES');
      setSalesSubTab('BOM');
    } else if (activeView === 'sales_invoices' && canInvoices) {
      setActiveSection('SALES');
      setSalesSubTab('INVOICE');
    } else if (activeView === 'purchase_vendors' && canVendors) {
      setActiveSection('PURCHASE');
      setPurchaseSubTab('VENDORS');
    } else if (activeView === 'purchase_orders' && canPo) {
      setActiveSection('PURCHASE');
      setPurchaseSubTab('PO_ENTRY');
    } else if (activeView === 'inventory_products' && canProducts) {
      setActiveSection('INVENTORY');
      setInventorySubTab('PRODUCTS');
    } else if (activeView === 'inventory_stock' && canStock) {
      setActiveSection('INVENTORY');
      setInventorySubTab('STOCK');
    } else if (activeView === 'warehouse_management' && canWarehouse) {
      setActiveSection('WAREHOUSE');
    } else {
      if (canSales) {
        setActiveSection('SALES');
        setSalesSubTab(canBom ? 'BOM' : 'INVOICE');
      } else if (canPurchase) {
        setActiveSection('PURCHASE');
        setPurchaseSubTab(canPo ? 'PO_ENTRY' : 'VENDORS');
      } else if (canInventory) {
        setActiveSection('INVENTORY');
        setInventorySubTab(canStock ? 'STOCK' : 'PRODUCTS');
      } else if (canWarehouse) {
        setActiveSection('WAREHOUSE');
      }
    }
  }, [activeView, canBom, canInvoices, canPo, canVendors, canStock, canProducts, canWarehouse, canSales, canPurchase, canInventory]);

  return (
    <div className="space-y-6 pb-12">
      {/* Module Title Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Sales & Purchase ERP</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  End-to-end solar supply chain: Bill of Materials, customer invoices, vendor management, PO entry, and warehouse stock synchronization.
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Sync Indicator */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3.5 py-2 rounded-xl text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Stock Auto-Synchronized (BOM • PO • Invoice)</span>
          </div>
        </div>

        {/* Main Functional Area Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-6 pt-5 border-t border-slate-100">
          {canSales && (
            <button
              id="tab-sales-section"
              onClick={() => {
                setActiveSection('SALES');
                setActiveView(canBom ? 'sales_bom' : 'sales_invoices');
              }}
              className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl font-bold text-sm transition-all ${
                activeSection === 'SALES'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              1. Sales (BOM & Invoicing)
            </button>
          )}

          {canPurchase && (
            <button
              id="tab-purchase-section"
              onClick={() => {
                setActiveSection('PURCHASE');
                setActiveView(canPo ? 'purchase_orders' : 'purchase_vendors');
              }}
              className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl font-bold text-sm transition-all ${
                activeSection === 'PURCHASE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              2. Purchase (Vendors & POs)
            </button>
          )}

          {canInventory && (
            <button
              id="tab-inventory-section"
              onClick={() => {
                setActiveSection('INVENTORY');
                setActiveView(canStock ? 'inventory_stock' : 'inventory_products');
              }}
              className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl font-bold text-sm transition-all ${
                activeSection === 'INVENTORY'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
              }`}
            >
              <Boxes className="w-4 h-4" />
              3. Products & Stock
            </button>
          )}

          {canWarehouse && (
            <button
              id="tab-warehouse-section"
              onClick={() => {
                setActiveSection('WAREHOUSE');
                setActiveView('warehouse_management');
              }}
              className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl font-bold text-sm transition-all ${
                activeSection === 'WAREHOUSE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
              }`}
            >
              <WarehouseIcon className="w-4 h-4" />
              4. Warehouse Management
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs for Area 1: SALES */}
      {activeSection === 'SALES' && canSales && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {canBom && (
              <button
                onClick={() => {
                  setSalesSubTab('BOM');
                  setActiveView('sales_bom');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  salesSubTab === 'BOM'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Bill of Materials (BOM)
              </button>
            )}
            {canInvoices && (
              <button
                onClick={() => {
                  setSalesSubTab('INVOICE');
                  setActiveView('sales_invoices');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  salesSubTab === 'INVOICE'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Invoice Creation & Tax Billing
              </button>
            )}
          </div>

          {salesSubTab === 'BOM' && canBom ? <BOMManager /> : canInvoices ? <InvoiceCreator /> : null}
        </div>
      )}

      {/* Sub-Tabs for Area 2: PURCHASE */}
      {activeSection === 'PURCHASE' && canPurchase && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {canPo && (
              <button
                onClick={() => {
                  setPurchaseSubTab('PO_ENTRY');
                  setActiveView('purchase_orders');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  purchaseSubTab === 'PO_ENTRY'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                Purchase Entry & POs
              </button>
            )}
            {canVendors && (
              <button
                onClick={() => {
                  setPurchaseSubTab('VENDORS');
                  setActiveView('purchase_vendors');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  purchaseSubTab === 'VENDORS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Vendor Management Directory
              </button>
            )}
          </div>

          {purchaseSubTab === 'PO_ENTRY' && canPo ? <PurchaseOrderEntry /> : canVendors ? <VendorManager /> : null}
        </div>
      )}

      {/* Sub-Tabs for Area 3: PRODUCTS & INVENTORY */}
      {activeSection === 'INVENTORY' && canInventory && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {canStock && (
              <button
                onClick={() => {
                  setInventorySubTab('STOCK');
                  setActiveView('inventory_stock');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  inventorySubTab === 'STOCK'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Boxes className="w-4 h-4" />
                Inventory & Live Stock Management
              </button>
            )}
            {canProducts && (
              <button
                onClick={() => {
                  setInventorySubTab('PRODUCTS');
                  setActiveView('inventory_products');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  inventorySubTab === 'PRODUCTS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Package className="w-4 h-4" />
                Purchased Products Catalog
              </button>
            )}
          </div>

          {inventorySubTab === 'STOCK' && canStock ? <InventoryStockManager /> : canProducts ? <ProductCatalog /> : null}
        </div>
      )}

      {/* Area 4: WAREHOUSE MANAGEMENT */}
      {activeSection === 'WAREHOUSE' && canWarehouse && (
        <div className="space-y-6">
          <WarehouseManager />
        </div>
      )}
    </div>
  );
};
