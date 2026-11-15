import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storageService } from '../../services/storage';
import {
  Search,
  X,
  Building2,
  Users,
  SunMedium,
  FileText,
  CreditCard,
  UserSquare2,
  Wrench,
  ArrowRight,
  Package,
  Truck,
  Warehouse as WarehouseIcon,
  ClipboardList
} from 'lucide-react';

export const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, openCustomerControlCenter, setActiveView, refreshTrigger } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsSearchOpen]);

  const customers = useMemo(() => storageService.getCustomers(), [isSearchOpen, refreshTrigger]);
  const leads = useMemo(() => storageService.getLeads(), [isSearchOpen, refreshTrigger]);
  const projects = useMemo(() => storageService.getProjects(), [isSearchOpen, refreshTrigger]);
  const employees = useMemo(() => storageService.getEmployees(), [isSearchOpen, refreshTrigger]);
  const quotations = useMemo(() => storageService.getQuotations(), [isSearchOpen, refreshTrigger]);
  const payments = useMemo(() => storageService.getPayments(), [isSearchOpen, refreshTrigger]);
  const serviceTickets = useMemo(() => storageService.getServiceTickets(), [isSearchOpen, refreshTrigger]);
  const products = useMemo(() => storageService.getProducts(), [isSearchOpen, refreshTrigger]);
  const vendors = useMemo(() => storageService.getVendors(), [isSearchOpen, refreshTrigger]);
  const warehouses = useMemo(() => storageService.getWarehouses(), [isSearchOpen, refreshTrigger]);
  const purchaseOrders = useMemo(() => storageService.getPurchaseOrders(), [isSearchOpen, refreshTrigger]);

  const results = useMemo(() => {
    if (!searchTerm.trim()) {
      return null;
    }
    const q = (searchTerm || '').toLowerCase().trim();

    return {
      customers: customers.filter(
        c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.city || '').toLowerCase().includes(q)
      ),
      projects: projects.filter(
        p =>
          (p.projectCode || '').toLowerCase().includes(q) ||
          (p.title || '').toLowerCase().includes(q) ||
          (p.customerName || '').toLowerCase().includes(q)
      ),
      leads: leads.filter(
        l =>
          (l.customerName || '').toLowerCase().includes(q) ||
          (l.phone || '').includes(q) ||
          (l.notes || '').toLowerCase().includes(q)
      ),
      quotations: quotations.filter(
        qt =>
          (qt.quotationNumber || '').toLowerCase().includes(q) ||
          (qt.customerName || '').toLowerCase().includes(q)
      ),
      payments: payments.filter(
        py =>
          (py.receiptNumber || '').toLowerCase().includes(q) ||
          (py.customerName || '').toLowerCase().includes(q) ||
          ((py.transactionReference || '').toLowerCase().includes(q))
      ),
      employees: employees.filter(
        e =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.employeeCode || '').toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q)
      ),
      serviceTickets: serviceTickets.filter(
        s =>
          (s.ticketId || '').toLowerCase().includes(q) ||
          (s.customerName || '').toLowerCase().includes(q) ||
          (s.issue || '').toLowerCase().includes(q)
      ),
      products: products.filter(
        pr =>
          (pr.name || '').toLowerCase().includes(q) ||
          (pr.sku || '').toLowerCase().includes(q) ||
          (pr.brand || '').toLowerCase().includes(q) ||
          (pr.category || '').toLowerCase().includes(q)
      ),
      vendors: vendors.filter(
        v =>
          (v.name || '').toLowerCase().includes(q) ||
          (v.vendorCode || '').toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q)
      ),
      warehouses: warehouses.filter(
        w =>
          (w.name || '').toLowerCase().includes(q) ||
          (w.code || '').toLowerCase().includes(q) ||
          (w.city || '').toLowerCase().includes(q)
      ),
      purchaseOrders: purchaseOrders.filter(
        po =>
          (po.purchaseNumber || '').toLowerCase().includes(q) ||
          (po.vendorName || '').toLowerCase().includes(q) ||
          (po.projectTitle || '').toLowerCase().includes(q)
      )
    };
  }, [
    searchTerm,
    customers,
    projects,
    leads,
    quotations,
    payments,
    employees,
    serviceTickets,
    products,
    vendors,
    warehouses,
    purchaseOrders
  ]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 bg-slate-50/50">
          <Search className="w-5 h-5 text-amber-500 mr-3 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer, product SKU, vendor, warehouse, PO, project..."
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-base focus:outline-hidden"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsSearchOpen(false)}
            className="ml-2 text-xs font-semibold px-2 py-1 bg-slate-200/70 text-slate-600 rounded-md hover:bg-slate-200"
          >
            ESC
          </button>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-4 space-y-5 divide-y divide-slate-100">
          {!searchTerm.trim() ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">Type to search across all solar business records</p>
              <p className="text-xs text-slate-400 mt-1">Customers, Projects, Leads, Products, Vendors, Warehouses, POs, Engineers</p>
            </div>
          ) : (
            <>
              {/* Projects */}
              {results && results.projects.length > 0 && (
                <div className="pt-2 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <SunMedium className="w-3.5 h-3.5 text-amber-500" />
                    <span>Solar Projects ({results.projects.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.projects.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          openCustomerControlCenter(p.customerId, p.id);
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-amber-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 group-hover:text-amber-700">{p.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 font-bold">{p.projectCode}</span>
                          </div>
                          <p className="text-xs text-slate-500">{p.customerName} • {p.capacityKw} kW • Stage: {p.currentStageKey.replace(/_/g, ' ')}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers */}
              {results && results.customers.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Customers ({results.customers.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          openCustomerControlCenter(c.id, c.activeProjectId);
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-blue-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900 group-hover:text-blue-700">{c.name}</span>
                          <p className="text-xs text-slate-500">{c.customerType} • {c.phone} • {c.city}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leads */}
              {results && results.leads.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Leads ({results.leads.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.leads.map(l => (
                      <div
                        key={l.id}
                        onClick={() => {
                          setActiveView('crm_leads');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-emerald-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700">{l.customerName}</span>
                          <p className="text-xs text-slate-500">{l.solarCapacityKw} kW • ₹{(l.estimatedValue / 100000).toFixed(1)}L • Status: {l.status}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotations */}
              {results && results.quotations.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Quotations ({results.quotations.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.quotations.map(q => (
                      <div
                        key={q.id}
                        onClick={() => {
                          setActiveView('crm_quotations');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-indigo-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900 group-hover:text-indigo-700">{q.quotationNumber} - {q.customerName}</span>
                          <p className="text-xs text-slate-500">{q.capacityKw} kW • ₹{q.totalAmount.toLocaleString('en-IN')} • Status: {q.status}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payments */}
              {results && results.payments.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <CreditCard className="w-3.5 h-3.5 text-rose-500" />
                    <span>Payments ({results.payments.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.payments.map(py => (
                      <div
                        key={py.id}
                        onClick={() => {
                          setActiveView('finance');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-rose-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900 group-hover:text-rose-700">{py.receiptNumber} - {py.customerName}</span>
                          <p className="text-xs text-slate-500">₹{py.amount.toLocaleString('en-IN')} • Milestone: {py.milestone} • {py.status}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employees */}
              {results && results.employees.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <UserSquare2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Employees ({results.employees.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.employees.map(e => (
                      <div
                        key={e.id}
                        onClick={() => {
                          setActiveView('hrms');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900">{e.name}</span>
                          <p className="text-xs text-slate-500">{e.designation} • {e.department} • {e.phone}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Tickets */}
              {results && results.serviceTickets.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <span>Service Tickets ({results.serviceTickets.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.serviceTickets.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setActiveView('service');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-amber-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900">{s.ticketId} - {s.customerName}</span>
                          <p className="text-xs text-slate-500">{s.issue}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products / Inventory Catalog */}
              {results && results.products.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Package className="w-3.5 h-3.5 text-amber-500" />
                    <span>Products ({results.products.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.products.map(pr => (
                      <div
                        key={pr.id}
                        onClick={() => {
                          setActiveView('inventory_products');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-amber-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 group-hover:text-amber-700">{pr.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono font-bold">{pr.sku}</span>
                          </div>
                          <p className="text-xs text-slate-500">{pr.category} • {pr.brand} • Stock: {pr.currentStock} {pr.unit}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendors */}
              {results && results.vendors.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <Truck className="w-3.5 h-3.5 text-purple-500" />
                    <span>Vendors ({results.vendors.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.vendors.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setActiveView('purchase_vendors');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-purple-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 group-hover:text-purple-700">{v.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-800 font-mono font-bold">{v.vendorCode}</span>
                          </div>
                          <p className="text-xs text-slate-500">{v.category} • {v.city}, {v.state}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warehouses */}
              {results && results.warehouses.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <WarehouseIcon className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Warehouses ({results.warehouses.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.warehouses.map(w => (
                      <div
                        key={w.id}
                        onClick={() => {
                          setActiveView('warehouse_management');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-cyan-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 group-hover:text-cyan-700">{w.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-cyan-100 text-cyan-800 font-mono font-bold">{w.code}</span>
                          </div>
                          <p className="text-xs text-slate-500">{w.city}, {w.state} • {w.contactPerson}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-cyan-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Purchase Orders */}
              {results && results.purchaseOrders.length > 0 && (
                <div className="pt-4 first:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Purchase Orders ({results.purchaseOrders.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.purchaseOrders.map(po => (
                      <div
                        key={po.id}
                        onClick={() => {
                          setActiveView('purchase_orders');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 hover:bg-emerald-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div>
                          <span className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700">{po.purchaseNumber} - {po.vendorName}</span>
                          <p className="text-xs text-slate-500">₹{po.totalAmount.toLocaleString('en-IN')} • {po.status}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
