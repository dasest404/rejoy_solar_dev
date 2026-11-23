import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp, FinanceTab } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { apiClient } from '../../services/apiClient';
import { AccountingWorkspace } from '../../types/solar';
import { FinanceDashboardTab } from '../finance/FinanceDashboardTab';
import { AccountsLedgerTab } from '../finance/AccountsLedgerTab';
import { CustomerPaymentsTab } from '../finance/CustomerPaymentsTab';
import { VendorPaymentsTab } from '../finance/VendorPaymentsTab';
import { CashBankTab } from '../finance/CashBankTab';
import { ExpensesFinanceTab } from '../finance/ExpensesFinanceTab';
import { GstTaxTab } from '../finance/GstTaxTab';
import { BudgetsTab } from '../finance/BudgetsTab';
import { AssetsTab } from '../finance/AssetsTab';
import { ProjectCostingTab } from '../finance/ProjectCostingTab';
import { FinancialReportsTab } from '../finance/FinancialReportsTab';
import { FinanceSettingsTab } from '../finance/FinanceSettingsTab';
import {
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react';

const TAB_ITEMS: { id: FinanceTab; label: string }[] = [
  { id: 'dashboard', label: 'Finance Dashboard' },
  { id: 'ledger', label: 'Accounts & Ledger' },
  { id: 'receivables', label: 'Customer Payments' },
  { id: 'payables', label: 'Vendor Payments' },
  { id: 'banking', label: 'Cash & Bank' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'gst', label: 'GST & Tax' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'assets', label: 'Assets' },
  { id: 'project_costing', label: 'Project Costing' },
  { id: 'reports', label: 'Financial Reports' },
  { id: 'settings', label: 'Settings' }
];

export const FinanceView: React.FC = () => {
  const {
    settings,
    showToast,
    openImportExportModal,
    triggerRefresh,
    refreshTrigger,
    activeFinanceTab,
    setActiveFinanceTab
  } = useApp();
  const { isAdmin, currentRole, hasPermission, canEditFinancials } = useAuth();

  const [workspace, setWorkspace] = useState<AccountingWorkspace | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSyncingVouchers, setIsSyncingVouchers] = useState(false);
  const [activeXmlPayload, setActiveXmlPayload] = useState<string | null>(null);
  const [localSyncCounter, setLocalSyncCounter] = useState(0);

  const isPrivilegedFinance = isAdmin || currentRole === 'Accountant';

  const allowedTabs = useMemo(() => {
    const check: Record<FinanceTab, boolean> = {
      dashboard: true,
      ledger: isPrivilegedFinance || hasPermission('finance.ledger') || hasPermission('finance.audit'),
      receivables: isPrivilegedFinance || hasPermission('finance.receipts') || hasPermission('finance.view'),
      payables: isPrivilegedFinance || hasPermission('finance.vendors') || hasPermission('finance.expenses'),
      banking: isPrivilegedFinance || hasPermission('finance.banking') || hasPermission('finance.audit'),
      expenses: isPrivilegedFinance || hasPermission('finance.expenses'),
      gst: isPrivilegedFinance || hasPermission('finance.tax') || hasPermission('finance.invoices'),
      budgets: isPrivilegedFinance || hasPermission('finance.budgets'),
      assets: isPrivilegedFinance || hasPermission('finance.assets'),
      project_costing: isPrivilegedFinance || hasPermission('finance.project_costing') || hasPermission('finance.view'),
      reports: isPrivilegedFinance || hasPermission('finance.reports') || hasPermission('finance.audit'),
      settings: isPrivilegedFinance || hasPermission('finance.settings')
    };
    return TAB_ITEMS.filter(t => check[t.id]);
  }, [isPrivilegedFinance, hasPermission]);

  const effectiveTab: FinanceTab = useMemo(() => {
    if (allowedTabs.some(t => t.id === activeFinanceTab)) return activeFinanceTab;
    return allowedTabs[0]?.id || 'dashboard';
  }, [allowedTabs, activeFinanceTab]);

  const loadWorkspace = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await apiClient.getAccountingWorkspace();
      setWorkspace(data);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load Accounting & Finance workspace from MySQL.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const handleStorageUpdate = () => setLocalSyncCounter(c => c + 1);
    window.addEventListener('solarpulse_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('solarpulse_storage_updated', handleStorageUpdate);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadWorkspace(),
      storageService.hydrateFromBackend().catch(() => undefined),
      storageService.fetchSalesReturnsAsync().catch(() => null),
      storageService.fetchPurchaseReturnsAsync().catch(() => null)
    ]);
    triggerRefresh();
  }, [loadWorkspace, triggerRefresh]);

  const handleSyncErpVouchers = async () => {
    if (isSyncingVouchers) return;
    setIsSyncingVouchers(true);
    try {
      const res = await apiClient.syncErpVouchersToLedger();
      await refreshAll();
      showToast(`Posted ${res.syncedCount || 0} ERP voucher(s) to the General Ledger.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to sync ERP vouchers to ledger.', 'error');
    } finally {
      setIsSyncingVouchers(false);
    }
  };

  // Snapshot collections from synchronized store
  const payments = useMemo(() => storageService.getPayments(), [refreshTrigger, localSyncCounter]);
  const expenses = useMemo(() => storageService.getExpenses(), [refreshTrigger, localSyncCounter]);
  const salesInvoices = useMemo(() => storageService.getSalesInvoices(), [refreshTrigger, localSyncCounter]);
  const vendorSalesInvoices = useMemo(() => storageService.getVendorSalesInvoices(), [refreshTrigger, localSyncCounter]);
  const purchaseOrders = useMemo(() => storageService.getPurchaseOrders(), [refreshTrigger, localSyncCounter]);
  const boms = useMemo(() => storageService.getBOMs(), [refreshTrigger, localSyncCounter]);
  const projects = useMemo(() => storageService.getProjects(), [refreshTrigger, localSyncCounter]);
  const customers = useMemo(() => storageService.getCustomers(), [refreshTrigger, localSyncCounter]);
  const vendors = useMemo(() => storageService.getVendors(), [refreshTrigger, localSyncCounter]);
  const employees = useMemo(() => storageService.getEmployees(), [refreshTrigger, localSyncCounter]);
  const salesReturns = useMemo(() => storageService.getSalesReturns(), [refreshTrigger, localSyncCounter]);
  const purchaseReturns = useMemo(() => storageService.getPurchaseReturns(), [refreshTrigger, localSyncCounter]);

  const canManage = isPrivilegedFinance || canEditFinancials();
  const canTallySync = isPrivilegedFinance || hasPermission('finance.tally_sync');
  const canApproveExpenses = isPrivilegedFinance || hasPermission('finance.audit') || hasPermission('finance.expenses');

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-amber-700">Accounting & Finance</span>
            <span>·</span>
            <span>Double-Entry General Ledger, Receivables, Payables, GST/TDS, Budgets & Assets</span>
            {workspace?.settings?.lockDate && (
              <>
                <span>·</span>
                <span className="font-mono text-rose-700">Books Locked ≤ {workspace.settings.lockDate}</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {TAB_ITEMS.find(t => t.id === effectiveTab)?.label || 'Accounting & Finance'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={handleSyncErpVouchers}
              disabled={isSyncingVouchers || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingVouchers ? 'animate-spin' : ''}`} />
              <span>{isSyncingVouchers ? 'Syncing Vouchers...' : 'Sync ERP Vouchers'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => openImportExportModal(effectiveTab === 'expenses' ? 'Expenses' : 'Payments')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel Hub</span>
          </button>
        </div>
      </div>

      {/* Horizontal Module Navigation Strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 overflow-x-auto print:hidden">
        <div className="flex items-center gap-1 min-w-max">
          {allowedTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFinanceTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                effectiveTab === tab.id
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && !workspace && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">Loading Financial Ledger & MySQL Accounting Workspace...</p>
          <p className="text-xs text-slate-500 mt-1">Initializing Chart of Accounts, Bank Registers, Bills & Budgets</p>
        </div>
      )}

      {!loading && loadError && !workspace && (
        <div className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <div className="text-sm font-bold text-slate-900">Unable to load Accounting & Finance Workspace</div>
          <p className="text-xs text-rose-700 max-w-lg mx-auto">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadWorkspace();
            }}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Active Section Content */}
      {workspace && (
        <>
          {effectiveTab === 'dashboard' && (
            <FinanceDashboardTab
              workspace={workspace}
              payments={payments}
              expenses={expenses}
              salesInvoices={salesInvoices}
              vendorSalesInvoices={vendorSalesInvoices}
              purchaseOrders={purchaseOrders}
              settings={settings}
              canSyncVouchers={canManage}
              isSyncingVouchers={isSyncingVouchers}
              onSyncErpVouchers={handleSyncErpVouchers}
              onNavigateTab={setActiveFinanceTab}
            />
          )}

          {effectiveTab === 'ledger' && (
            <AccountsLedgerTab
              workspace={workspace}
              projects={projects}
              canManage={isPrivilegedFinance || hasPermission('finance.ledger')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'receivables' && (
            <CustomerPaymentsTab
              workspace={workspace}
              payments={payments}
              salesInvoices={salesInvoices}
              vendorSalesInvoices={vendorSalesInvoices}
              projects={projects}
              customers={customers}
              settings={settings}
              canEdit={isPrivilegedFinance || hasPermission('finance.receipts')}
              canTallySync={canTallySync}
              onRefresh={refreshAll}
              onOpenXml={setActiveXmlPayload}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'payables' && (
            <VendorPaymentsTab
              workspace={workspace}
              vendors={vendors}
              purchaseOrders={purchaseOrders}
              projects={projects}
              canManage={isPrivilegedFinance || hasPermission('finance.vendors')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'banking' && (
            <CashBankTab
              workspace={workspace}
              canManage={isPrivilegedFinance || hasPermission('finance.banking')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'expenses' && (
            <ExpensesFinanceTab
              workspace={workspace}
              expenses={expenses}
              projects={projects}
              employees={employees}
              settings={settings}
              canEdit={canManage || hasPermission('finance.expenses')}
              canApprove={canApproveExpenses}
              onRefresh={refreshAll}
              onOpenXml={setActiveXmlPayload}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'gst' && (
            <GstTaxTab
              workspace={workspace}
              salesInvoices={salesInvoices}
              vendorSalesInvoices={vendorSalesInvoices}
              expenses={expenses}
              salesReturns={salesReturns}
              purchaseReturns={purchaseReturns}
              canManage={isPrivilegedFinance || hasPermission('finance.tax')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'budgets' && (
            <BudgetsTab
              workspace={workspace}
              expenses={expenses}
              projects={projects}
              canManage={isPrivilegedFinance || hasPermission('finance.budgets')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'assets' && (
            <AssetsTab
              workspace={workspace}
              canManage={isPrivilegedFinance || hasPermission('finance.assets')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}

          {effectiveTab === 'project_costing' && (
            <ProjectCostingTab
              workspace={workspace}
              projects={projects}
              salesInvoices={salesInvoices}
              payments={payments}
              boms={boms}
              purchaseOrders={purchaseOrders}
              expenses={expenses}
              salesReturns={salesReturns}
              purchaseReturns={purchaseReturns}
            />
          )}

          {effectiveTab === 'reports' && (
            <FinancialReportsTab
              workspace={workspace}
              payments={payments}
              salesInvoices={salesInvoices}
              vendorSalesInvoices={vendorSalesInvoices}
              purchaseOrders={purchaseOrders}
              settings={settings}
            />
          )}

          {effectiveTab === 'settings' && (
            <FinanceSettingsTab
              workspace={workspace}
              canManage={isPrivilegedFinance || hasPermission('finance.settings')}
              onRefresh={refreshAll}
              showToast={showToast}
            />
          )}
        </>
      )}

      {/* Tally Prime XML Preview Modal */}
      {activeXmlPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-slate-900 text-white shrink-0">
              <span className="text-xs font-mono font-bold truncate pr-2">Tally Prime XML Voucher Payload</span>
              <button type="button" onClick={() => setActiveXmlPayload(null)} className="text-slate-400 hover:text-white p-1 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs overflow-auto flex-1">
              <pre>{activeXmlPayload}</pre>
            </div>
            <div className="p-4 bg-slate-50 flex flex-wrap justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeXmlPayload);
                  showToast('XML payload copied to clipboard', 'success');
                }}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Copy XML
              </button>
              <button
                type="button"
                onClick={() => setActiveXmlPayload(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
