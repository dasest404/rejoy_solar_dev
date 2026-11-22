import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { StatusBadge } from '../common/StatusBadge';
import {
  Search,
  ArrowRight,
  MapPin,
  Calendar,
  FileSpreadsheet,
  MessageSquare,
  Pencil,
  Check,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

const formatLakhValue = (amount: number): string => {
  const lakhs = (Number(amount || 0) / 100000).toFixed(2).replace(/\.?0+$/, '');
  return lakhs || '0';
};

const parseNumericInput = (raw: string): number | null => {
  const cleaned = String(raw ?? '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
};

export const ProjectsView: React.FC = () => {
  const {
    openCustomerControlCenter,
    openWhatsAppModal,
    openImportExportModal,
    stageFilterKey,
    setStageFilterKey,
    triggerRefresh,
    showToast,
    refreshTrigger
  } = useApp();
  const { isCustomer, isAdmin, hasPermission, canEditFinancials } = useAuth();

  const canEditProjectSpecs =
    !isCustomer && (isAdmin || hasPermission('projects.edit_specs') || canEditFinancials());

  const [searchTerm, setSearchTerm] = useState('');
  const [activeStageFilter, setActiveStageFilter] = useState<string>(stageFilterKey || 'ALL');
  const [localUpdateCounter, setLocalUpdateCounter] = useState(0);

  // Inline edit state for Project Capacity & Total Project Value
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editCapacityInput, setEditCapacityInput] = useState('');
  const [editTotalValueInput, setEditTotalValueInput] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);

  useEffect(() => {
    const handleStorageUpdate = () => setLocalUpdateCounter(prev => prev + 1);
    window.addEventListener('solarpulse_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('solarpulse_storage_updated', handleStorageUpdate);
  }, []);

  const projects = useMemo(
    () => storageService.getProjects(),
    [refreshTrigger, localUpdateCounter]
  );

  const filteredProjects = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    const stageTerm = (activeStageFilter || '').toLowerCase().trim();

    return projects.filter(p => {
      const matchesSearch =
        !term ||
        (p.title || '').toLowerCase().includes(term) ||
        (p.projectCode || '').toLowerCase().includes(term) ||
        (p.customerName || '').toLowerCase().includes(term) ||
        (p.location || '').toLowerCase().includes(term) ||
        (p.city || '').toLowerCase().includes(term) ||
        (p.siteAddress || '').toLowerCase().includes(term);

      const matchesStage =
        !activeStageFilter ||
        activeStageFilter === 'ALL' ||
        (p.currentStageKey || '').toLowerCase().includes(stageTerm);

      return matchesSearch && matchesStage;
    });
  }, [projects, searchTerm, activeStageFilter]);

  const startEditingSpecs = (projectId: string, capacityKw: number, totalValue: number) => {
    if (!canEditProjectSpecs) return;
    setEditingProjectId(projectId);
    setEditCapacityInput(String(capacityKw ?? ''));
    setEditTotalValueInput(String(totalValue ?? ''));
    setEditError(null);
  };

  const cancelEditingSpecs = () => {
    if (savingProjectId) return;
    setEditingProjectId(null);
    setEditError(null);
  };

  const handleSaveSpecs = async (projectId: string) => {
    const parsedCapacity = parseNumericInput(editCapacityInput);
    const parsedTotalValue = parseNumericInput(editTotalValueInput);

    if (parsedCapacity === null || parsedCapacity <= 0) {
      setEditError('Project Capacity must be greater than 0 kW.');
      return;
    }
    if (parsedTotalValue === null || parsedTotalValue < 0) {
      setEditError('Total Project Value cannot be negative.');
      return;
    }

    setSavingProjectId(projectId);
    setEditError(null);
    try {
      await storageService.updateProjectSpecsAsync(projectId, {
        capacityKw: parsedCapacity,
        totalValue: parsedTotalValue
      });
      setEditingProjectId(null);
      setLocalUpdateCounter(prev => prev + 1);
      triggerRefresh();
      showToast('Project capacity and total value saved to MySQL', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to update project specs in MySQL.';
      setEditError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingProjectId(null);
    }
  };

  const stagesList = [
    { key: 'ALL', label: 'All Projects' },
    { key: 'site_survey', label: 'Site Survey' },
    { key: 'procurement_dispatch', label: 'Procurement' },
    { key: 'civil_work', label: 'Civil Work' },
    { key: 'structure_mounting', label: 'Structure' },
    { key: 'panel_installation', label: 'Panel Installation' },
    { key: 'inverter_electrical', label: 'Electrical' },
    { key: 'testing_commissioning', label: 'Testing' },
    { key: 'net_metering', label: 'Net Metering' },
    { key: 'final_handover', label: 'Commissioned' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              EPC Project Execution
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">{projects.length} Total Turnkey Sites</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Active Solar Projects Portfolio
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openImportExportModal('Projects')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel / CSV Hub</span>
          </button>
        </div>
      </div>

      {/* Stage Filter Chips */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto flex items-center gap-1.5">
        {stagesList.map(st => (
          <button
            key={st.key}
            onClick={() => {
              setActiveStageFilter(st.key);
              setStageFilterKey(st.key === 'ALL' ? null : st.key);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeStageFilter === st.key
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by project name, project ID, customer, location..."
          className="w-full text-xs pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(filteredProjects || []).map((p) => {
          const completedStagesCount = (p.stages || []).filter(s => s && s.status === 'COMPLETED').length;
          const isEditing = editingProjectId === p.id;
          const isSaving = savingProjectId === p.id;
          const displayLocation = p.city || p.location || p.siteAddress || 'Not specified';
          const pct = p.progressPercentage ?? p.completionPercentage ?? 0;

          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    {p.projectCode}
                  </span>
                  <StatusBadge status={p.status} size="sm" />
                </div>

                <h3 className="font-bold text-base text-slate-900 group-hover:text-amber-700 transition-colors">
                  {p.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{p.customerName}</p>

                {/* Specs Box (Editable Capacity & Total Value) */}
                {isEditing ? (
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 my-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                        Edit Project Specs
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveSpecs(p.id)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSpecs}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Project Capacity (kW)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={editCapacityInput}
                          onChange={(e) => setEditCapacityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSpecs(p.id);
                            if (e.key === 'Escape') cancelEditingSpecs();
                          }}
                          disabled={isSaving}
                          aria-label="Project Capacity (kW)"
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Total Value (₹)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={editTotalValueInput}
                          onChange={(e) => setEditTotalValueInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveSpecs(p.id);
                            if (e.key === 'Escape') cancelEditingSpecs();
                          }}
                          disabled={isSaving}
                          aria-label="Total Project Value (INR)"
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          ≈ ₹{formatLakhValue(parseNumericInput(editTotalValueInput) ?? 0)}L
                        </span>
                      </div>
                    </div>

                    {editError && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{editError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 my-3 text-xs relative">
                    {canEditProjectSpecs && (
                      <button
                        type="button"
                        onClick={() => startEditingSpecs(p.id, p.capacityKw, p.totalValue)}
                        title="Edit Project Capacity & Total Value"
                        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 hover:text-amber-700 bg-white border border-slate-200 hover:border-amber-300 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2 pr-10">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Capacity</span>
                        <p className="font-black text-slate-900 text-sm">{p.capacityKw} kW</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Value</span>
                        <p className="font-black text-slate-900 text-sm">
                          ₹{formatLakhValue(p.totalValue)}L
                        </p>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          ₹{Number(p.totalValue || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Location & Dates */}
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{displayLocation}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Target: {p.expectedCompletionDate || 'TBD'}</span>
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-700 capitalize">
                      Stage: {(p.currentStageKey || 'site_survey').replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold text-amber-700">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {completedStagesCount} of {(p.stages || []).length || 15} Workflow Stages Completed
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() =>
                    openWhatsAppModal('919879544321', p.customerName, 'INSTALLATION_UPDATE', {
                      projectTitle: p.title,
                      stageTitle: (p.currentStageKey || 'site_survey').replace(/_/g, ' ')
                    })
                  }
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="WhatsApp Update"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                <button
                  onClick={() => openCustomerControlCenter(p.customerId, p.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  <span>Open Control Center</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

