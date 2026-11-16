import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { ProductItem, Vendor } from '../../types/solar';
import { validateProduct, DuplicateRecordError } from '../../services/validation';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit,
  Trash2,
  X,
  Building2,
  Tag,
  DollarSign,
  Boxes,
  MapPin,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';

export const ProductCatalog: React.FC = () => {
  const { refreshTrigger, triggerRefresh, showToast, openImportExportModal } = useApp();
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('inventory.products_manage');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Solar Panels');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formSpec, setFormSpec] = useState('');
  const [formUnit, setFormUnit] = useState<string>('NOS');
  const [useCustomUnit, setUseCustomUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState('');
  const [formHsn, setFormHsn] = useState('85414011');
  const [formGstOption, setFormGstOption] = useState<string>('18');
  const [customGstRate, setCustomGstRate] = useState<string>('');
  const [formUnitPrice, setFormUnitPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formMinThreshold, setFormMinThreshold] = useState<number>(10);
  const [formLocation, setFormLocation] = useState('Warehouse A - Bay 1');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formVendorId, setFormVendorId] = useState('');

  const products = useMemo(() => storageService.getProducts(), [refreshTrigger]);
  const vendors = useMemo(() => storageService.getVendors(), [refreshTrigger]);
  const warehouses = useMemo(() => storageService.getWarehouses(), [refreshTrigger]);

  const presetCategories: string[] = [
    'Solar Panels',
    'Inverters',
    'Mounting Structures',
    'Electrical & Cables',
    'Civil & Fasteners',
    'Safety & Accessories',
    'Monitoring & Sensors'
  ];

  const categories = useMemo(() => {
    const merged = [...presetCategories];
    products.forEach(p => {
      const cat = (p.category || '').trim();
      if (cat && !merged.includes(cat)) {
        merged.push(cat);
      }
    });
    return merged;
  }, [products]);

  const availableUnits = useMemo(() => {
    const merged = ['NOS', 'SETS', 'METERS', 'PACKS', 'KG'];
    products.forEach(p => {
      const unit = (p.unit || '').trim().toUpperCase();
      if (unit && !merged.includes(unit)) {
        merged.push(unit);
      }
    });
    return merged;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();

    return products.filter(p => {
      const matchesSearch =
        !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, categoryFilter]);

  const handleOpenAdd = () => {
    const defaultWh = storageService.getDefaultWarehouse();
    setEditingProduct(null);
    setFormErrors({});
    setFormSku(`PRD-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormCategory('Solar Panels');
    setUseCustomCategory(false);
    setCustomCategory('');
    setFormBrand('');
    setFormSpec('');
    setFormUnit('NOS');
    setUseCustomUnit(false);
    setCustomUnit('');
    setFormHsn('85414011');
    setFormGstOption('18');
    setCustomGstRate('');
    setFormUnitPrice(0);
    setFormSellingPrice(0);
    setFormStock(50);
    setFormMinThreshold(10);
    setFormLocation('Warehouse A - Bay 1');
    setFormWarehouseId(defaultWh?.id || warehouses[0]?.id || '');
    setFormVendorId(vendors[0]?.id || '');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ProductItem) => {
    const defaultWh = storageService.getDefaultWarehouse();
    setEditingProduct(p);
    setFormErrors({});
    setFormSku(p.sku);
    setFormName(p.name);
    setFormCategory(p.category || 'Solar Panels');
    setUseCustomCategory(false);
    setCustomCategory('');
    setFormBrand(p.brand);
    setFormSpec(p.specification);
    setFormUnit(p.unit || 'NOS');
    setUseCustomUnit(false);
    setCustomUnit('');
    setFormHsn(p.hsnCode);
    const savedGst =
      p.gstRate !== undefined && p.gstRate !== null && Number.isFinite(Number(p.gstRate))
        ? Number(p.gstRate)
        : 18;
    if (savedGst === 5 || savedGst === 12 || savedGst === 18) {
      setFormGstOption(String(savedGst));
      setCustomGstRate('');
    } else {
      setFormGstOption('__OTHERS__');
      setCustomGstRate(String(savedGst));
    }
    setFormUnitPrice(p.unitPrice);
    setFormSellingPrice(p.sellingPrice);
    setFormStock(p.currentStock);
    setFormMinThreshold(p.minStockThreshold);
    setFormLocation(p.location);
    setFormWarehouseId(p.warehouseId || defaultWh?.id || warehouses[0]?.id || '');
    setFormVendorId(p.preferredVendorId || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormErrors({});

    const resolvedCategory = useCustomCategory ? customCategory.trim() : formCategory.trim();
    const resolvedUnit = (useCustomUnit ? customUnit.trim() : formUnit.trim()).toUpperCase();

    const errs: Record<string, string> = {};
    if (!formSku.trim()) errs.sku = 'SKU code is required';
    if (!formName.trim()) errs.name = 'Product name is required';
    if (!resolvedCategory) errs.category = 'Category is required';
    if (!resolvedUnit) errs.unit = 'Unit of measure is required';

    let resolvedGstRate = 18;
    if (formGstOption === '__OTHERS__') {
      const trimmedGst = customGstRate.trim();
      if (!trimmedGst) {
        errs.gstRate = 'Please enter a custom GST percentage';
      } else {
        const parsedGst = Number(trimmedGst);
        if (!Number.isFinite(parsedGst) || parsedGst < 0 || parsedGst > 100) {
          errs.gstRate = 'GST Rate (%) must be between 0 and 100';
        } else {
          resolvedGstRate = Math.round(parsedGst * 100) / 100;
        }
      }
    } else {
      const presetGst = Number(formGstOption);
      if (!Number.isFinite(presetGst) || presetGst < 0 || presetGst > 100) {
        errs.gstRate = 'Please select a valid GST Rate (%)';
      } else {
        resolvedGstRate = presetGst;
      }
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      showToast(errs.gstRate || 'Please complete all required fields', 'warning');
      return;
    }

    const preferredVendor = vendors.find(v => v.id === formVendorId);
    const defaultWh = storageService.getDefaultWarehouse();
    const selectedWh = warehouses.find(w => w.id === formWarehouseId) || (defaultWh?.id ? defaultWh : undefined);
    const warehouseId = selectedWh?.id || formWarehouseId || undefined;
    const warehouseName = selectedWh?.name || (editingProduct?.warehouseName || undefined);

    const nextWhStocks = { ...(editingProduct?.warehouseStocks || {}) };
    if (warehouseId && (!editingProduct || Object.keys(nextWhStocks).length === 0)) {
      nextWhStocks[warehouseId] = Math.max(0, Number(formStock) || 0);
    }

    const productToSave: ProductItem = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: formSku.trim().toUpperCase(),
      name: formName.trim(),
      category: resolvedCategory as ProductItem['category'],
      brand: formBrand.trim(),
      specification: formSpec.trim(),
      unit: resolvedUnit as ProductItem['unit'],
      hsnCode: formHsn.trim(),
      gstRate: resolvedGstRate,
      unitPrice: Number(formUnitPrice) || 0,
      sellingPrice: Number(formSellingPrice) || 0,
      currentStock: Math.max(0, Number(formStock) || 0),
      minStockThreshold: Math.max(0, Number(formMinThreshold) || 0),
      location: formLocation.trim(),
      warehouseId,
      warehouseName,
      warehouseStocks: Object.keys(nextWhStocks).length > 0 ? nextWhStocks : undefined,
      preferredVendorId: formVendorId || undefined,
      preferredVendorName: preferredVendor?.name || undefined,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const dupCheck = validateProduct(productToSave, products, editingProduct?.id);
    if (!dupCheck.valid) {
      setFormErrors({ [dupCheck.field || 'general']: dupCheck.message });
      showToast(dupCheck.message, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await storageService.saveProductAsync(productToSave);
      triggerRefresh();
      showToast(
        `Product ${saved.sku} ${editingProduct ? 'updated' : 'added'} to catalog`,
        'success'
      );
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product to MySQL';
      showToast(msg, 'error');
      if (err instanceof DuplicateRecordError) {
        setFormErrors({ [err.field]: err.message });
      } else {
        setFormErrors({ general: msg });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (deletingId) return;
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    setDeletingId(id);
    try {
      await storageService.deleteProductAsync(id);
      triggerRefresh();
      showToast(`Product deleted`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete product';
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            Purchased Products & Master Catalog
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Complete inventory catalog of solar PV modules, string inverters, HDG structures, and balance of system (BOS) materials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openImportExportModal('Products')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel Hub</span>
          </button>
          {canManageProducts && (
            <button
              id="btn-add-product"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by SKU, product name, brand..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              categoryFilter === 'ALL'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Products ({products.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map(product => {
          const isLowStock = product.currentStock <= product.minStockThreshold;
          return (
            <div
              key={product.id}
              id={`product-card-${product.id}`}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/60">
                    {product.sku}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isLowStock
                        ? 'bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isLowStock ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Low Stock Alert
                      </>
                    ) : (
                      'In Stock'
                    )}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-base leading-snug mb-1 line-clamp-2">
                  {product.name}
                </h4>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <span className="font-medium text-slate-700">{product.brand}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{product.category}</span>
                </div>

                {product.specification && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {product.specification}
                  </p>
                )}

                {/* Stock & Valuation Stats */}
                <div className="space-y-1.5 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Available Stock:</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isLowStock ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {product.currentStock} {product.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Purchase Cost (Excl. Tax):</span>
                    <span className="font-mono text-slate-700">
                      ₹{product.unitPrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Selling Price:</span>
                    <span className="font-mono font-bold text-amber-700">
                      ₹{product.sellingPrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400">Warehouse Facility:</span>
                    <span className="text-slate-600 truncate max-w-[160px]" title={product.warehouseName || product.location}>
                      {product.warehouseName ? `${product.warehouseName}${product.location ? ` (${product.location})` : ''}` : product.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 font-mono">
                  HSN: {product.hsnCode || 'N/A'} • GST: {Number.isFinite(Number(product.gstRate)) ? Number(product.gstRate) : 18}%
                </span>

                {canManageProducts && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(product)}
                      disabled={deletingId === product.id}
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                      title="Edit Product"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      disabled={deletingId === product.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                      title="Delete Product"
                    >
                      {deletingId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700 text-base mb-1">No Products Found</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Add products to your catalog to link with BOMs and purchase entries.
            </p>
            {canManageProducts && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600"
              >
                <Plus className="w-4 h-4" />
                Add First Product
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {editingProduct ? 'Edit Product Item' : 'New Product Item'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define specifications, units, HSN codes, and warehouse threshold.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  {formErrors.general}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={e => {
                      setFormSku(e.target.value.toUpperCase());
                      if (formErrors.sku) setFormErrors(prev => ({ ...prev, sku: '' }));
                    }}
                    placeholder="MOD-WAA-540"
                    className={`w-full px-3 py-2 text-xs bg-white border rounded-xl font-mono ${
                      formErrors.sku ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.sku && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{formErrors.sku}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Title / Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => {
                      setFormName(e.target.value);
                      if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                    }}
                    placeholder="e.g. Waaree 540Wp Bifacial Solar Module"
                    className={`w-full px-3 py-2 text-xs bg-white border rounded-xl ${
                      formErrors.name ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{formErrors.name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={useCustomCategory ? '__CUSTOM__' : formCategory}
                    onChange={e => {
                      if (e.target.value === '__CUSTOM__') {
                        setUseCustomCategory(true);
                        setCustomCategory('');
                      } else {
                        setUseCustomCategory(false);
                        setFormCategory(e.target.value);
                      }
                      if (formErrors.category) setFormErrors(prev => ({ ...prev, category: '' }));
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Add Custom Category...</option>
                  </select>
                  {useCustomCategory && (
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      placeholder="Enter new category name"
                      className="mt-1.5 w-full px-3 py-1.5 text-xs bg-white border border-amber-400 rounded-xl"
                    />
                  )}
                  {formErrors.category && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{formErrors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand / OEM</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={e => setFormBrand(e.target.value)}
                    placeholder="e.g. Waaree / Sungrow / Polycab"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measure *</label>
                  <select
                    value={useCustomUnit ? '__CUSTOM__' : formUnit}
                    onChange={e => {
                      if (e.target.value === '__CUSTOM__') {
                        setUseCustomUnit(true);
                        setCustomUnit('');
                      } else {
                        setUseCustomUnit(false);
                        setFormUnit(e.target.value);
                      }
                      if (formErrors.unit) setFormErrors(prev => ({ ...prev, unit: '' }));
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    {availableUnits.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Add Custom Unit...</option>
                  </select>
                  {useCustomUnit && (
                    <input
                      type="text"
                      required
                      value={customUnit}
                      onChange={e => setCustomUnit(e.target.value.toUpperCase())}
                      placeholder="e.g. ROLL, BOX, KWP"
                      className="mt-1.5 w-full px-3 py-1.5 text-xs bg-white border border-amber-400 rounded-xl font-mono uppercase"
                    />
                  )}
                  {formErrors.unit && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{formErrors.unit}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Technical Specifications
                </label>
                <textarea
                  rows={2}
                  value={formSpec}
                  onChange={e => setFormSpec(e.target.value)}
                  placeholder="540Wp Bifacial Dual Glass, 144 Half-cut Cells, IP68 Junction Box..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    value={formHsn}
                    onChange={e => setFormHsn(e.target.value)}
                    placeholder="85414011"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GST Rate (%) *
                  </label>
                  <select
                    value={formGstOption}
                    onChange={e => {
                      const val = e.target.value;
                      setFormGstOption(val);
                      if (val !== '__OTHERS__') {
                        setCustomGstRate('');
                      }
                      if (formErrors.gstRate) setFormErrors(prev => ({ ...prev, gstRate: '' }));
                    }}
                    className={`w-full px-3 py-2 text-xs bg-white border rounded-xl ${
                      formErrors.gstRate ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    }`}
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="__OTHERS__">Others</option>
                  </select>
                  {formGstOption === '__OTHERS__' && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={customGstRate}
                      onChange={e => {
                        setCustomGstRate(e.target.value);
                        if (formErrors.gstRate) setFormErrors(prev => ({ ...prev, gstRate: '' }));
                      }}
                      placeholder="Enter custom GST %"
                      className={`mt-1.5 w-full px-3 py-1.5 text-xs bg-white border rounded-xl ${
                        formErrors.gstRate ? 'border-red-400 bg-red-50/30' : 'border-amber-400'
                      }`}
                    />
                  )}
                  {formErrors.gstRate && (
                    <p className="text-[11px] text-red-600 font-medium mt-1">{formErrors.gstRate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Purchase Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formUnitPrice}
                    onChange={e => setFormUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formSellingPrice}
                    onChange={e => setFormSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={e => setFormStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min Stock Reorder Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinThreshold}
                    onChange={e => setFormMinThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Warehouse
                  </label>
                  <select
                    value={formWarehouseId}
                    onChange={e => setFormWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    {warehouses.length === 0 && (
                      <option value="">Default Warehouse</option>
                    )}
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warehouse Bin / Rack
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    placeholder="Warehouse A - Bay 1"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preferred Vendor
                  </label>
                  <select
                    value={formVendorId}
                    onChange={e => setFormVendorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="">-- None / Multiple --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSaving ? 'Saving to MySQL...' : editingProduct ? 'Save Changes' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
