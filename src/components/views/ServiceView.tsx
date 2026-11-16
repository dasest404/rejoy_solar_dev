import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { apiClient } from '../../services/apiClient';
import { EligibleServiceTechnician, ServiceTicket, Priority } from '../../types/solar';
import { StatusBadge, PriorityBadge } from '../common/StatusBadge';
import { AssignTechnicianModal } from '../service/AssignTechnicianModal';
import { TicketDetailsModal } from '../service/TicketDetailsModal';
import {
  Wrench,
  Plus,
  Search,
  MessageSquare,
  User,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  X,
  Mail,
  Eye,
  UserPlus,
  Loader2,
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

type TicketFilter =
  | 'ALL'
  | 'UNASSIGNED'
  | 'OPEN'
  | 'ASSIGNED'
  | 'VISIT SCHEDULED'
  | 'IN PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export const ServiceView: React.FC = () => {
  const { openWhatsAppModal, openEmailModal, openImportExportModal, showToast, refreshTrigger } = useApp();
  const { currentUser, isCustomer, isAdmin } = useAuth();

  const isAdminUser =
    isAdmin || String(currentUser?.role || '').toUpperCase() === 'SUPER ADMIN';

  const customers = useMemo(() => storageService.getCustomers(), [refreshTrigger]);
  const projects = useMemo(() => storageService.getProjects(), [refreshTrigger]);

  const currentCustomer = useMemo(() => {
    if (isCustomer) {
      return (
        customers.find(
          c =>
            (currentUser?.email && c.email?.toLowerCase() === currentUser.email?.toLowerCase()) ||
            (currentUser?.phone && c.phone === currentUser.phone) ||
            (currentUser?.name && c.name?.toLowerCase() === currentUser.name?.toLowerCase())
        ) || null
      );
    }
    return null;
  }, [customers, isCustomer, currentUser]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketFilter>('ALL');
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState(0);

  const [eligibleTechnicians, setEligibleTechnicians] = useState<EligibleServiceTechnician[]>([]);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);

  const [detailsTicket, setDetailsTicket] = useState<ServiceTicket | null>(null);
  const [assignTicket, setAssignTicket] = useState<ServiceTicket | null>(null);
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);

  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    customerId: '',
    customerName: '',
    projectId: '',
    category: 'Inverter Error / Offline',
    issue: '',
    priority: 'HIGH' as Priority,
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  });

  // Fetch live service tickets from MySQL without triggering global refreshTrigger loops
  const loadTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    setTicketLoadError(null);
    try {
      const rows = await apiClient.getServiceTickets();
      if (Array.isArray(rows)) {
        storageService.setServiceTicketsFromBackend(rows, false);
        setLocalVersion(v => v + 1);
      }
    } catch (err: any) {
      console.error('[ServiceView] Failed to fetch tickets from MySQL:', err);
      setTicketLoadError(err?.message || 'Unable to load service tickets from MySQL.');
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  const loadTechnicians = useCallback(async () => {
    if (!isAdminUser) {
      setEligibleTechnicians([]);
      return;
    }
    setIsLoadingTechnicians(true);
    try {
      const list = await apiClient.getEligibleServiceTechnicians();
      setEligibleTechnicians(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('[ServiceView] Failed to fetch eligible technicians:', err);
    } finally {
      setIsLoadingTechnicians(false);
    }
  }, [isAdminUser]);

  // Initial mount fetch only (never depends on refreshTrigger)
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Load active Field Workers/Technicians once for Admin (never depends on refreshTrigger)
  useEffect(() => {
    loadTechnicians();
  }, [loadTechnicians]);

  const tickets = useMemo(() => {
    const all = storageService.getServiceTickets();
    if (isCustomer && currentCustomer) {
      return all.filter(
        t =>
          t.customerId === currentCustomer.id ||
          t.customerName.toLowerCase() === currentCustomer.name.toLowerCase()
      );
    }
    return all;
  }, [isCustomer, currentCustomer, refreshTrigger, localVersion]);

  const getTicketTechDisplay = (t: ServiceTicket) => {
    const cleanName =
      t.assignedTechnicianName ||
      (t.assignedToName && t.assignedToName !== 'To be assigned' && t.assignedToName !== 'Unassigned'
        ? t.assignedToName
        : '');
    const assigned = Boolean(t.assignedTechnicianId || cleanName);
    return {
      assigned,
      name: cleanName || 'Unassigned'
    };
  };

  const filteredTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tickets.filter(t => {
      const tech = getTicketTechDisplay(t);
      if (statusFilter === 'UNASSIGNED' && tech.assigned) return false;
      if (
        statusFilter !== 'ALL' &&
        statusFilter !== 'UNASSIGNED' &&
        String(t.status || '').toUpperCase() !== statusFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(t.ticketId || '').toLowerCase().includes(q) ||
        String(t.customerName || '').toLowerCase().includes(q) ||
        String(t.projectTitle || '').toLowerCase().includes(q) ||
        String(t.issue || '').toLowerCase().includes(q) ||
        String(t.category || '').toLowerCase().includes(q) ||
        tech.name.toLowerCase().includes(q)
      );
    });
  }, [tickets, searchTerm, statusFilter]);

  const availableProjectsForForm = useMemo(() => {
    if (!ticketForm.customerId) return projects;
    const matched = projects.filter(p => p.customerId === ticketForm.customerId);
    return matched.length > 0 ? matched : projects;
  }, [projects, ticketForm.customerId]);

  const handleCustomerSelect = (customerId: string) => {
    const matched = customers.find(c => c.id === customerId);
    const linkedProj = matched?.activeProjectId
      ? projects.find(p => p.id === matched.activeProjectId)
      : projects.find(p => p.customerId === customerId);
    setTicketForm(prev => ({
      ...prev,
      customerId,
      customerName: matched?.name || prev.customerName,
      projectId: linkedProj?.id || ''
    }));
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedCustomer = ticketForm.customerId
      ? customers.find(c => c.id === ticketForm.customerId)
      : customers.find(c => c.name.toLowerCase() === ticketForm.customerName.trim().toLowerCase());

    const activeCustName =
      isCustomer && currentCustomer
        ? currentCustomer.name
        : (matchedCustomer?.name || ticketForm.customerName.trim() || (isCustomer ? currentUser?.name || '' : ''));
    const activeCustId =
      isCustomer && currentCustomer
        ? currentCustomer.id
        : (matchedCustomer?.id || '');
    const activeProjId =
      isCustomer && currentCustomer?.activeProjectId
        ? currentCustomer.activeProjectId
        : ticketForm.projectId;
    const matchedProj = activeProjId ? projects.find(p => p.id === activeProjId) : undefined;

    const newTicketPayload: Partial<ServiceTicket> = {
      id: `srv-${Date.now()}`,
      ticketId: `SRV-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerId: activeCustId,
      customerName: activeCustName,
      projectId: activeProjId,
      projectTitle: matchedProj?.title || '',
      category: ticketForm.category,
      issue: ticketForm.issue.trim(),
      priority: ticketForm.priority,
      status: 'OPEN',
      assignedTechnicianId: '',
      assignedTechnicianName: '',
      assignedToName: 'Unassigned',
      createdAt: new Date().toISOString().slice(0, 10),
      visitScheduledDate: ticketForm.scheduledDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    };

    setIsCreatingTicket(true);
    try {
      const saved = await storageService.createServiceTicketAsync(newTicketPayload);
      setIsNewTicketOpen(false);
      setTicketForm({
        customerId: '',
        customerName: '',
        projectId: '',
        category: 'Inverter Error / Offline',
        issue: '',
        priority: 'HIGH',
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      });
      showToast(`Service ticket ${saved?.ticketId || newTicketPayload.ticketId} saved to MySQL`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to log service ticket in MySQL.', 'error');
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const handleQuickResolveTicket = async (ticket: ServiceTicket) => {
    if (!isAdminUser) return;
    setResolvingTicketId(ticket.id);
    try {
      await storageService.adminUpdateServiceTicketAsync(ticket.id, {
        status: 'RESOLVED',
        resolutionDetails:
          ticket.resolutionDetails || 'Ticket resolved and verified by Admin.'
      });
      showToast(`Ticket ${ticket.ticketId} marked as RESOLVED in MySQL`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to resolve ticket in MySQL.', 'error');
    } finally {
      setResolvingTicketId(null);
    }
  };

  const handleTicketSynced = (updated: ServiceTicket) => {
    if (detailsTicket?.id === updated.id) {
      setDetailsTicket(updated);
    }
    if (assignTicket?.id === updated.id) {
      setAssignTicket(updated);
    }
  };

  const handleManualRefresh = async () => {
    await Promise.all([loadTickets(), loadTechnicians()]);
  };

  const unassignedCount = useMemo(
    () => tickets.filter(t => !getTicketTechDisplay(t).assigned && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length,
    [tickets]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              Post-Commissioning Care
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Solar Plant AMC & Breakdown Support</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Service & AMC Ticketing
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewTicketOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Service Ticket</span>
          </button>

          <button
            type="button"
            onClick={() => openImportExportModal('Service')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel Hub</span>
          </button>
        </div>
      </div>

      {ticketLoadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{ticketLoadError}</span>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? 'animate-spin' : ''}`} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-bold text-slate-600 mr-2 flex items-center gap-2">
            <span>Total: {tickets.length}</span>
            <span>•</span>
            <span>Open: {tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length}</span>
            <span>•</span>
            <span className="text-amber-700">Unassigned: {unassignedCount}</span>
            {isLoadingTickets && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as TicketFilter)}
            className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNASSIGNED">Unassigned Only</option>
            <option value="OPEN">OPEN</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="VISIT SCHEDULED">VISIT SCHEDULED</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoadingTickets}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh tickets from MySQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? 'animate-spin text-amber-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ticket, customer, technician..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-dashed border-slate-200 text-center">
          <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No service tickets match your current filter</p>
          <p className="text-xs text-slate-500 mt-1">
            {tickets.length === 0
              ? 'No service or AMC tickets exist in the MySQL database yet.'
              : 'Try clearing the search term or status filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTickets.map(t => {
            const techDisplay = getTicketTechDisplay(t);
            const matchedCust = customers.find(
              c => (t.customerId && c.id === t.customerId) || c.name.toLowerCase() === t.customerName.toLowerCase()
            );

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                      {t.ticketId}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} size="sm" />
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 mt-1">{t.customerName}</h3>
                  {t.projectTitle && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{t.projectTitle}</span>
                    </p>
                  )}
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide block mt-1">
                    {t.category}
                  </span>

                  <p className="text-xs text-slate-600 mt-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed line-clamp-3">
                    {t.issue}
                  </p>

                  <div className="space-y-1.5 mt-3 text-xs text-slate-500">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Technician: <strong className="text-slate-800">{techDisplay.name}</strong>
                        </span>
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          techDisplay.assigned
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {techDisplay.assigned ? 'ASSIGNED' : 'UNASSIGNED'}
                      </span>
                    </div>

                    {(t.visitScheduledDate || t.scheduledDate) && (
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Site Visit: {t.visitScheduledDate || t.scheduledDate}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsTicket(t)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>

                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => setAssignTicket(t)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{techDisplay.assigned ? 'Reassign' : 'Assign Technician'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!matchedCust?.phone) {
                            showToast('Customer phone number not found in customer record.', 'warning');
                            return;
                          }
                          openWhatsAppModal(matchedCust.phone, t.customerName, 'SERVICE_TICKET', {
                            ticketId: t.ticketId
                          });
                        }}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Send WhatsApp Update"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openEmailModal({
                            recipientEmail: matchedCust?.email || '',
                            recipientName: t.customerName,
                            type: 'SERVICE_TICKET',
                            data: {
                              ticketId: t.ticketId,
                              issue: t.issue,
                              technician: techDisplay.name,
                              status: t.status
                            }
                          });
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Send Email Update via Gmail"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    </div>

                    {t.status !== 'RESOLVED' && t.status !== 'CLOSED' ? (
                      isAdminUser ? (
                        <button
                          type="button"
                          disabled={resolvingTicketId === t.id}
                          onClick={() => handleQuickResolveTicket(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                        >
                          {resolvingTicketId === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Resolve</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-semibold">
                          In Service Queue
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign / Reassign Technician Modal (Admin Only) */}
      <AssignTechnicianModal
        isOpen={Boolean(assignTicket) && isAdminUser}
        onClose={() => setAssignTicket(null)}
        ticket={assignTicket}
        technicians={eligibleTechnicians}
        isLoadingTechnicians={isLoadingTechnicians}
        onAssigned={handleTicketSynced}
      />

      {/* Ticket Details & Admin Management Modal */}
      <TicketDetailsModal
        isOpen={Boolean(detailsTicket)}
        onClose={() => setDetailsTicket(null)}
        ticket={detailsTicket}
        isAdmin={isAdminUser}
        technicians={eligibleTechnicians}
        onTicketUpdated={handleTicketSynced}
      />

      {/* New Ticket Modal */}
      {isNewTicketOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-base text-slate-900">Log Service / AMC Ticket</h3>
              <button
                type="button"
                onClick={() => setIsNewTicketOpen(false)}
                disabled={isCreatingTicket}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-5 space-y-4">
              {isCustomer && currentCustomer ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Plant</label>
                  <input
                    type="text"
                    required
                    value={currentCustomer.name}
                    disabled
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-600 font-medium cursor-not-allowed"
                  />
                </div>
              ) : (
                <>
                  {customers.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Select Registered Customer</label>
                      <select
                        value={ticketForm.customerId}
                        onChange={e => handleCustomerSelect(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white"
                      >
                        <option value="">— Select Customer (or type below) —</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.city ? `(${c.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Plant Name *</label>
                      <input
                        type="text"
                        required
                        value={ticketForm.customerName}
                        onChange={e => setTicketForm({ ...ticketForm, customerName: e.target.value, customerId: '' })}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                        placeholder="Customer or solar plant name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Project / Site (Optional)</label>
                      <select
                        value={ticketForm.projectId}
                        onChange={e => setTicketForm({ ...ticketForm, projectId: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white"
                      >
                        <option value="">— Select Project —</option>
                        {availableProjectsForForm.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.projectCode ? `${p.projectCode} - ` : ''}{p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                  >
                    <option value="Inverter Error / Offline">Inverter Error / Offline</option>
                    <option value="Generation Drop">Generation Drop</option>
                    <option value="Panel Cleaning / Soiling">Panel Cleaning / Soiling</option>
                    <option value="Structure Inspection">Structure Inspection</option>
                    <option value="Electrical & Earth Pit">Electrical & Earth Pit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value as Priority })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 font-bold"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Visit Date</label>
                  <input
                    type="date"
                    value={ticketForm.scheduledDate}
                    onChange={e => setTicketForm({ ...ticketForm, scheduledDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Issue Description *</label>
                <textarea
                  required
                  rows={3}
                  value={ticketForm.issue}
                  onChange={e => setTicketForm({ ...ticketForm, issue: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5"
                  placeholder="Describe alarm code, tripping behavior, or physical damage..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewTicketOpen(false)}
                  disabled={isCreatingTicket}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTicket}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-2xs disabled:opacity-50"
                >
                  {isCreatingTicket && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreatingTicket ? 'Saving to MySQL...' : 'Create Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

