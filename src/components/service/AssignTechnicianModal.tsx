import React, { useEffect, useState } from 'react';
import { EligibleServiceTechnician, ServiceTicket } from '../../types/solar';
import { storageService } from '../../services/storage';
import { useApp } from '../../context/AppContext';
import {
  X,
  UserCheck,
  UserX,
  Calendar,
  Wrench,
  AlertCircle,
  Loader2,
  Phone,
  ShieldCheck
} from 'lucide-react';

interface AssignTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: ServiceTicket | null;
  technicians: EligibleServiceTechnician[];
  isLoadingTechnicians?: boolean;
  onAssigned: (updatedTicket: ServiceTicket) => void;
}

export const AssignTechnicianModal: React.FC<AssignTechnicianModalProps> = ({
  isOpen,
  onClose,
  ticket,
  technicians,
  isLoadingTechnicians = false,
  onAssigned
}) => {
  const { showToast } = useApp();
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ticket) {
      setSelectedTechId(ticket.assignedTechnicianId || '');
      setScheduledDate(ticket.visitScheduledDate || ticket.scheduledDate || '');
      setRemarks('');
      setErrorMsg(null);
    }
  }, [isOpen, ticket?.id]);

  if (!isOpen || !ticket) return null;

  const currentAssignedName =
    ticket.assignedTechnicianName ||
    (ticket.assignedToName && ticket.assignedToName !== 'To be assigned' && ticket.assignedToName !== 'Unassigned'
      ? ticket.assignedToName
      : '');
  const isCurrentlyAssigned = Boolean(ticket.assignedTechnicianId || currentAssignedName);
  const selectedTech = technicians.find(t => t.id === selectedTechId) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const updated = await storageService.assignServiceTicketAsync(ticket.id, {
        technicianId: selectedTechId ? selectedTechId : null,
        scheduledDate: scheduledDate ? scheduledDate : null,
        remarks: remarks.trim() ? remarks.trim() : null
      });
      showToast(
        selectedTechId
          ? `Technician assigned to ${ticket.ticketId}`
          : `Technician unassigned from ${ticket.ticketId}`,
        'success'
      );
      onAssigned(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update technician assignment in MySQL.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassign = async () => {
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const updated = await storageService.assignServiceTicketAsync(ticket.id, {
        technicianId: null,
        scheduledDate: scheduledDate ? scheduledDate : null,
        remarks: remarks.trim() || 'Technician unassigned by Admin'
      });
      showToast(`Technician unassigned from ${ticket.ticketId}`, 'success');
      onAssigned(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to unassign technician in MySQL.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isCurrentlyAssigned ? 'Reassign Field Technician' : 'Assign Field Technician'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {ticket.ticketId} • {ticket.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Assignment Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Current Assignment Status
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isCurrentlyAssigned
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isCurrentlyAssigned ? 'ASSIGNED' : 'UNASSIGNED'}
              </span>
            </div>
            <p className="text-xs text-slate-700">
              {isCurrentlyAssigned ? (
                <>
                  Assigned to <strong>{currentAssignedName}</strong>
                </>
              ) : (
                'No technician is currently assigned to this ticket.'
              )}
            </p>
          </div>

          {/* Field Worker / Technician Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Active Field Worker / Technician *
            </label>
            {isLoadingTechnicians ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 p-2.5 border border-slate-200 rounded-xl bg-slate-50">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Loading active field workers from MySQL...</span>
              </div>
            ) : (
              <select
                value={selectedTechId}
                onChange={e => setSelectedTechId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="">— Unassigned (Clear Technician) —</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} ({tech.employeeCode || tech.id}) — {tech.role || tech.designation || 'Field Technician'}
                    {tech.phone ? ` • ${tech.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
            {!isLoadingTechnicians && technicians.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5">
                No active Field Workers found in HRMS/Users. Mark an active employee as a Field Worker in HRMS or User Management first.
              </p>
            )}
          </div>

          {selectedTech && (
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold">{selectedTech.name}</span>
                  <span className="text-blue-700 ml-1.5">
                    ({selectedTech.role || selectedTech.designation})
                  </span>
                </div>
              </div>
              {selectedTech.phone && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                  <Phone className="w-3 h-3" />
                  {selectedTech.phone}
                </span>
              )}
            </div>
          )}

          {/* Scheduled Visit Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Scheduled Site Visit Date
              </span>
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Assignment Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Assignment / Dispatch Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional instructions for the technician (e.g., carry DC clamp meter, check string 2 voltage)..."
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div>
              {isCurrentlyAssigned && (
                <button
                  type="button"
                  onClick={handleUnassign}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Unassign</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || (isLoadingTechnicians && !selectedTechId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-2xs transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{selectedTechId ? (isCurrentlyAssigned ? 'Save Reassignment' : 'Assign Technician') : 'Save Unassigned'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
