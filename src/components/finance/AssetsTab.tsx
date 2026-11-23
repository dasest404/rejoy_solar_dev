import React, { useState, useMemo } from 'react';
import { AccountingWorkspace, FixedAsset } from '../../types/solar';
import { apiClient } from '../../services/apiClient';
import {
  calculateDepreciationPreview,
  calculateDisposalPreview,
  formatINR,
  formatDateIN,
  round2
} from './accountingUtils';
import { Plus, TrendingDown, Trash2, X, Eye, Edit2, AlertCircle } from 'lucide-react';

interface AssetsTabProps {
  workspace: AccountingWorkspace;
  canManage: boolean;
  onRefresh: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const AssetsTab: React.FC<AssetsTabProps> = ({
  workspace,
  canManage,
  onRefresh,
  showToast
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [subTab, setSubTab] = useState<'REGISTER' | 'DEP_LOGS'>('REGISTER');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewAsset, setViewAsset] = useState<FixedAsset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assetForm, setAssetForm] = useState({
    id: '',
    assetCode: '',
    name: '',
    category: 'Tools & Testing Equipment',
    purchaseDate: today,
    vendorName: '',
    purchaseCost: 0,
    salvageValue: 0,
    usefulLifeYears: 5,
    depreciationMethod: 'SLM' as 'SLM' | 'WDV',
    depreciationRate: 20,
    location: 'Main Warehouse',
    custodian: '',
    notes: '',
    bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
    postPurchaseJournal: true
  });

  // Depreciation Modal
  const [depTarget, setDepTarget] = useState<FixedAsset | null>(null);
  const [depForm, setDepForm] = useState({
    periodLabel: `${today.slice(0, 7)} Monthly Run`,
    runDate: today,
    months: 1
  });

  // Disposal Modal
  const [disposeTarget, setDisposeTarget] = useState<FixedAsset | null>(null);
  const [disposeForm, setDisposeForm] = useState({
    disposalDate: today,
    proceeds: 0,
    bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
    notes: ''
  });

  const totals = useMemo(() => {
    const active = workspace.fixedAssets.filter(a => a.status === 'ACTIVE');
    return {
      grossBlock: round2(active.reduce((s, a) => s + a.purchaseCost, 0)),
      accumDep: round2(active.reduce((s, a) => s + a.accumulatedDepreciation, 0)),
      netBlock: round2(active.reduce((s, a) => s + a.bookValue, 0)),
      activeCount: active.length
    };
  }, [workspace.fixedAssets]);

  const depPreview = useMemo(
    () => (depTarget ? calculateDepreciationPreview(depTarget, depForm.months) : null),
    [depTarget, depForm.months]
  );

  const disposePreview = useMemo(
    () => (disposeTarget ? calculateDisposalPreview(disposeTarget, disposeForm.proceeds) : null),
    [disposeTarget, disposeForm.proceeds]
  );

  const openCreateAsset = () => {
    setModalError(null);
    setAssetForm({
      id: '',
      assetCode: '',
      name: '',
      category: 'Tools & Testing Equipment',
      purchaseDate: today,
      vendorName: '',
      purchaseCost: 0,
      salvageValue: 0,
      usefulLifeYears: 5,
      depreciationMethod: 'SLM',
      depreciationRate: 20,
      location: 'Main Warehouse',
      custodian: '',
      notes: '',
      bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
      postPurchaseJournal: true
    });
    setIsAddOpen(true);
  };

  const openEditAsset = (a: FixedAsset) => {
    setModalError(null);
    setAssetForm({
      id: a.id,
      assetCode: a.assetCode,
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate,
      vendorName: a.vendorName || '',
      purchaseCost: a.purchaseCost,
      salvageValue: a.salvageValue,
      usefulLifeYears: a.usefulLifeYears,
      depreciationMethod: a.depreciationMethod,
      depreciationRate: a.depreciationRate,
      location: a.location || '',
      custodian: a.custodian || '',
      notes: a.notes || '',
      bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
      postPurchaseJournal: false
    });
    setIsAddOpen(true);
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setModalError(null);
    setSaving(true);
    try {
      await apiClient.saveFixedAsset({
        id: assetForm.id || undefined,
        assetCode: assetForm.assetCode.trim() || undefined,
        name: assetForm.name.trim(),
        category: assetForm.category,
        purchaseDate: assetForm.purchaseDate,
        vendorName: assetForm.vendorName.trim(),
        purchaseCost: round2(Number(assetForm.purchaseCost)),
        salvageValue: round2(Number(assetForm.salvageValue || 0)),
        usefulLifeYears: Number(assetForm.usefulLifeYears || 5),
        depreciationMethod: assetForm.depreciationMethod,
        depreciationRate: Number(assetForm.depreciationRate || 0),
        location: assetForm.location.trim(),
        custodian: assetForm.custodian.trim(),
        notes: assetForm.notes.trim() || undefined,
        bankAccountId: !assetForm.id && assetForm.postPurchaseJournal ? assetForm.bankAccountId : undefined,
        postPurchaseJournal: !assetForm.id && assetForm.postPurchaseJournal
      });
      setIsAddOpen(false);
      await onRefresh();
      showToast(assetForm.id ? 'Asset details updated.' : 'Fixed asset capitalized.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save asset';
      setModalError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await apiClient.deleteFixedAsset(id);
      setConfirmDeleteId(null);
      await onRefresh();
      showToast('Fixed asset deleted and purchase voucher reversed.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete asset', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRunDep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depTarget || saving) return;
    setModalError(null);
    setSaving(true);
    try {
      await apiClient.runAssetDepreciation(depTarget.id, depForm);
      setDepTarget(null);
      await onRefresh();
      showToast('Depreciation posted to ledger.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Depreciation run failed';
      setModalError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposeTarget || saving) return;
    setModalError(null);
    setSaving(true);
    try {
      await apiClient.disposeAsset(disposeTarget.id, {
        disposalDate: disposeForm.disposalDate,
        disposalProceeds: round2(Number(disposeForm.proceeds)),
        bankAccountId: disposeForm.bankAccountId || undefined
      });
      setDisposeTarget(null);
      await onRefresh();
      showToast('Asset disposed & gain/loss posted to ledger.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Disposal failed';
      setModalError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Gross Asset Block ({totals.activeCount} Active)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">{formatINR(totals.grossBlock)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Accumulated Depreciation</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">{formatINR(totals.accumDep)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Net Book Value (WDV)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">{formatINR(totals.netBlock)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('REGISTER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'REGISTER' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Asset Register ({workspace.fixedAssets.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('DEP_LOGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              subTab === 'DEP_LOGS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Depreciation Runs ({workspace.assetDepreciationLogs.length})
          </button>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateAsset}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Capitalize Asset
          </button>
        )}
      </div>

      {subTab === 'REGISTER' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="md:hidden divide-y divide-slate-100">
            {workspace.fixedAssets.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-slate-500">
                No fixed assets registered yet. Capitalize solar testing equipment, vehicles, or office hardware.
              </div>
            ) : (
              workspace.fixedAssets.map(a => (
                <div key={a.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900">{a.assetCode}</div>
                      <div className="font-semibold text-slate-800">{a.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {a.category}{a.location ? ` · ${a.location}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">{formatINR(a.bookValue)}</div>
                      <span className={`text-[11px] font-semibold ${a.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-slate-50 rounded-lg p-2.5">
                    <div>
                      <span className="block text-slate-400">Purchased</span>
                      <span>{formatDateIN(a.purchaseDate)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Cost</span>
                      <span>{formatINR(a.purchaseCost)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Accum. Dep</span>
                      <span className="text-amber-700">{formatINR(a.accumulatedDepreciation)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewAsset(a)}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openEditAsset(a)}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {canManage && a.status === 'ACTIVE' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            setDepTarget(a);
                            setDepForm({ periodLabel: `${today.slice(0, 7)} Depreciation`, runDate: today, months: 1 });
                          }}
                          className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                        >
                          <TrendingDown className="w-3.5 h-3.5" /> Depreciate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            setDisposeTarget(a);
                            setDisposeForm({
                              disposalDate: today,
                              proceeds: a.bookValue,
                              bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
                              notes: ''
                            });
                          }}
                          className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                        >
                          Dispose
                        </button>
                        {a.accumulatedDepreciation === 0 && (
                          confirmDeleteId === a.id ? (
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => handleDeleteAsset(a.id)}
                              className="text-rose-700 font-bold cursor-pointer"
                            >
                              {busyId === a.id ? '...' : 'Confirm Del'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(a.id)}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Asset Code</th>
                  <th className="py-2.5 px-4">Asset Name & Category</th>
                  <th className="py-2.5 px-4">Purchase Date</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4 text-right">Cost (₹)</th>
                  <th className="py-2.5 px-4 text-right">Accum. Dep (₹)</th>
                  <th className="py-2.5 px-4 text-right">Book Value (₹)</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.fixedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No fixed assets registered yet. Capitalize solar testing equipment, vehicles, or office hardware.
                    </td>
                  </tr>
                ) : (
                  workspace.fixedAssets.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{a.assetCode}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-800">{a.name}</div>
                        <div className="text-[11px] text-slate-500">{a.category} {a.location ? `· ${a.location}` : ''}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateIN(a.purchaseDate)}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {a.depreciationMethod} ({a.usefulLifeYears}y)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(a.purchaseCost)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">{formatINR(a.accumulatedDepreciation)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">{formatINR(a.bookValue)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`font-semibold ${a.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setViewAsset(a)}
                          title="View Asset Details"
                          className="inline-flex items-center text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => openEditAsset(a)}
                            title="Edit Asset Metadata"
                            className="inline-flex items-center text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManage && a.status === 'ACTIVE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null);
                                setDepTarget(a);
                                setDepForm({ periodLabel: `${today.slice(0, 7)} Depreciation`, runDate: today, months: 1 });
                              }}
                              className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                            >
                              <TrendingDown className="w-3.5 h-3.5" /> Depreciate
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null);
                                setDisposeTarget(a);
                                setDisposeForm({
                                  disposalDate: today,
                                  proceeds: a.bookValue,
                                  bankAccountId: workspace.bankAccounts.find(b => b.isPrimary)?.id || workspace.bankAccounts[0]?.id || '',
                                  notes: ''
                                });
                              }}
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                            >
                              Dispose
                            </button>
                            {a.accumulatedDepreciation === 0 && (
                              confirmDeleteId === a.id ? (
                                <button
                                  type="button"
                                  disabled={busyId === a.id}
                                  onClick={() => handleDeleteAsset(a.id)}
                                  className="text-rose-700 font-bold cursor-pointer"
                                >
                                  {busyId === a.id ? '...' : 'Confirm Del'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(a.id)}
                                  title="Delete Undepreciated Asset"
                                  className="text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 inline" />
                                </button>
                              )
                            )}
                          </>
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

      {subTab === 'DEP_LOGS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Run Date</th>
                  <th className="py-2.5 px-4">Asset</th>
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-4 text-right">Opening WDV (₹)</th>
                  <th className="py-2.5 px-4 text-right">Depreciation (₹)</th>
                  <th className="py-2.5 px-4 text-right">Closing WDV (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.assetDepreciationLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No depreciation runs recorded yet.
                    </td>
                  </tr>
                ) : (
                  workspace.assetDepreciationLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDateIN(log.runDate)}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {log.assetCode} — {log.assetName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{log.periodLabel}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(log.openingBookValue)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-700 font-semibold">
                        {formatINR(log.depreciationAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">{formatINR(log.closingBookValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT ASSET MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {assetForm.id ? `Edit Fixed Asset · ${assetForm.assetCode}` : 'Capitalize Fixed Asset'}
              </h3>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAsset} className="p-4 sm:p-5 space-y-3 overflow-y-auto">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={assetForm.name}
                    onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
                    placeholder="e.g. Thermal Drone / Crane"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={assetForm.category}
                    onChange={e => setAssetForm({ ...assetForm, category: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="Tools & Testing Equipment">Tools & Testing Equipment</option>
                    <option value="Vehicles & Logistics">Vehicles & Logistics</option>
                    <option value="IT & Computers">IT & Computers</option>
                    <option value="Machinery & Plant">Machinery & Plant</option>
                    <option value="Office Furniture & Fixtures">Office Furniture & Fixtures</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Name</label>
                  <input
                    type="text"
                    value={assetForm.vendorName}
                    onChange={e => setAssetForm({ ...assetForm, vendorName: e.target.value })}
                    placeholder="Supplier"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={assetForm.location}
                    onChange={e => setAssetForm({ ...assetForm, location: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Custodian</label>
                  <input
                    type="text"
                    value={assetForm.custodian}
                    onChange={e => setAssetForm({ ...assetForm, custodian: e.target.value })}
                    placeholder="Assigned person"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              {!assetForm.id && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        value={assetForm.purchaseCost}
                        onChange={e => setAssetForm({ ...assetForm, purchaseCost: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Salvage Value (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={assetForm.salvageValue}
                        onChange={e => setAssetForm({ ...assetForm, salvageValue: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date *</label>
                      <input
                        type="date"
                        required
                        value={assetForm.purchaseDate}
                        onChange={e => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Dep. Method</label>
                      <select
                        value={assetForm.depreciationMethod}
                        onChange={e => setAssetForm({ ...assetForm, depreciationMethod: e.target.value as 'SLM' | 'WDV' })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      >
                        <option value="SLM">SLM (Straight Line)</option>
                        <option value="WDV">WDV (Written Down)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Useful Life (Yrs)</label>
                      <input
                        type="number"
                        min="1"
                        value={assetForm.usefulLifeYears}
                        onChange={e => setAssetForm({ ...assetForm, usefulLifeYears: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">WDV Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={assetForm.depreciationRate}
                        onChange={e => setAssetForm({ ...assetForm, depreciationRate: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono"
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assetForm.postPurchaseJournal}
                      onChange={e => setAssetForm({ ...assetForm, postPurchaseJournal: e.target.checked })}
                    />
                    Post Purchase Journal Voucher (Debit Fixed Assets / Credit Cash or Bank)
                  </label>
                  {assetForm.postPurchaseJournal && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Paid From Cash / Bank</label>
                      <select
                        value={assetForm.bankAccountId}
                        onChange={e => setAssetForm({ ...assetForm, bankAccountId: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      >
                        {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                          <option key={b.id} value={b.id}>
                            {b.accountName} ({formatINR(b.currentBalance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={assetForm.notes}
                  onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving...' : assetForm.id ? 'Save Asset Changes' : 'Capitalize Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPRECIATION MODAL */}
      {depTarget && depPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">Run Depreciation · {depTarget.assetCode}</h3>
              <button type="button" onClick={() => setDepTarget(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRunDep} className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Period Label *</label>
                <input
                  type="text"
                  required
                  value={depForm.periodLabel}
                  onChange={e => setDepForm({ ...depForm, periodLabel: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Run Date *</label>
                  <input
                    type="date"
                    required
                    value={depForm.runDate}
                    onChange={e => setDepForm({ ...depForm, runDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Months</label>
                  <select
                    value={depForm.months}
                    onChange={e => setDepForm({ ...depForm, months: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months (Quarter)</option>
                    <option value={6}>6 Months (Half-Year)</option>
                    <option value={12}>12 Months (Full Year)</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono">
                <div className="flex flex-wrap justify-between gap-1">
                  <span>Opening Book Value:</span>
                  <span>{formatINR(depTarget.bookValue)}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-1 text-rose-700 font-bold">
                  <span>Depreciation Charge ({depTarget.depreciationMethod}):</span>
                  <span>{formatINR(depPreview.chargeAmount)}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-1 border-t border-slate-200 pt-1 font-bold">
                  <span>Closing Book Value:</span>
                  <span>{formatINR(depPreview.closingBookValue)}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepTarget(null)}
                  className="px-4 py-2 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || depPreview.chargeAmount <= 0}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Post Depreciation JV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPOSAL MODAL */}
      {disposeTarget && disposePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">Dispose Asset · {disposeTarget.assetCode}</h3>
              <button type="button" onClick={() => setDisposeTarget(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleDispose} className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Disposal Date *</label>
                  <input
                    type="date"
                    required
                    value={disposeForm.disposalDate}
                    onChange={e => setDisposeForm({ ...disposeForm, disposalDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sale Proceeds (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={disposeForm.proceeds}
                    onChange={e => setDisposeForm({ ...disposeForm, proceeds: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deposit Proceeds To</label>
                <select
                  value={disposeForm.bankAccountId}
                  onChange={e => setDisposeForm({ ...disposeForm, bankAccountId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                >
                  {workspace.bankAccounts.filter(b => b.isActive).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.accountName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono">
                <div className="flex flex-wrap justify-between gap-1">
                  <span>Current Book Value:</span>
                  <span>{formatINR(disposePreview.bookValue)}</span>
                </div>
                <div className={`flex flex-wrap justify-between gap-1 font-bold ${disposePreview.isGain ? 'text-emerald-700' : 'text-rose-700'}`}>
                  <span>{disposePreview.isGain ? 'Gain on Disposal:' : 'Loss on Disposal:'}</span>
                  <span>{formatINR(Math.abs(disposePreview.gainLoss))}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisposeTarget(null)}
                  className="px-4 py-2 font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Confirm Disposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* VIEW ASSET DETAIL MODAL */}
      {viewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-900 font-mono truncate">{viewAsset.assetCode}</h3>
              <button type="button" onClick={() => setViewAsset(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-2.5 text-xs overflow-y-auto">
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Asset Name:</span>
                <strong className="text-slate-900">{viewAsset.name}</strong>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Category:</span>
                <span className="text-slate-800">{viewAsset.category}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Vendor / Location / Custodian:</span>
                <span className="text-slate-800">
                  {[viewAsset.vendorName, viewAsset.location, viewAsset.custodian].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Purchase Date:</span>
                <span className="font-mono text-slate-800">{formatDateIN(viewAsset.purchaseDate)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Gross Cost / Salvage:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatINR(viewAsset.purchaseCost)} / {formatINR(viewAsset.salvageValue)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Accumulated Depreciation:</span>
                <span className="font-mono text-amber-700 font-semibold">{formatINR(viewAsset.accumulatedDepreciation)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Net Book Value:</span>
                <strong className="font-mono text-emerald-700 text-sm">{formatINR(viewAsset.bookValue)}</strong>
              </div>
              <div className="flex flex-wrap justify-between gap-1">
                <span className="text-slate-500">Status:</span>
                <strong className="text-slate-900">{viewAsset.status}</strong>
              </div>
              {viewAsset.purchaseJournalId && (
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="text-slate-500">Purchase JV Ref:</span>
                  <span className="font-mono text-slate-700 break-all">{viewAsset.purchaseJournalId}</span>
                </div>
              )}
              {viewAsset.disposalDate && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1 font-mono">
                  <div className="font-semibold text-slate-700">Disposed {formatDateIN(viewAsset.disposalDate)}</div>
                  <div>Proceeds: {formatINR(viewAsset.disposalProceeds || 0)} · Gain/Loss: {formatINR(viewAsset.disposalGainLoss || 0)}</div>
                </div>
              )}
              {viewAsset.notes && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-700">
                  <span className="font-semibold text-slate-500 block mb-0.5">Notes</span>
                  {viewAsset.notes}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewAsset;
                      setViewAsset(null);
                      openEditAsset(target);
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    Edit Metadata
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewAsset(null)}
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
