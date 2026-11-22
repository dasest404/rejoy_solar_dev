import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import {
  Employee,
  LeaveApplication,
  EmployeeLeaveBalance,
  LeaveType,
  LeaveStatus
} from '../../types/solar';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
  RefreshCw,
  UserCheck,
  MessageSquare,
  X,
  ShieldCheck,
  Users,
  FileText
} from 'lucide-react';

interface LeaveManagementViewProps {
  employees: Employee[];
  searchTerm: string;
  openApplySignal?: number;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  CASUAL: 'Casual Leave (CL)',
  SICK: 'Sick Leave (SL)',
  EARNED: 'Earned Leave (EL)',
  UNPAID: 'Unpaid Leave (LWP)'
};

const LEAVE_TYPE_SHORT: Record<LeaveType, string> = {
  CASUAL: 'Casual',
  SICK: 'Sick',
  EARNED: 'Earned',
  UNPAID: 'Unpaid'
};

function getLeaveTypeBadge(type: LeaveType): string {
  switch (type) {
    case 'CASUAL':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'SICK':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'EARNED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'UNPAID':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getLeaveStatusBadge(status: LeaveStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'PENDING':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

function formatDateDisplay(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const clean = iso.slice(0, 10);
    const d = new Date(`${clean}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function computeRequestedDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (!startDate) return 0;
  if (isHalfDay) return 0.5;
  const end = endDate || startDate;
  if (end < startDate) return 0;
  const sMs = Date.parse(`${startDate}T00:00:00Z`);
  const eMs = Date.parse(`${end}T00:00:00Z`);
  if (isNaN(sMs) || isNaN(eMs)) return 0;
  return Math.round((eMs - sMs) / 86400000) + 1;
}

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({
  employees,
  searchTerm,
  openApplySignal = 0
}) => {
  const { showToast, triggerRefresh, refreshTrigger } = useApp();
  const { currentUser, hasPermission } = useAuth();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [canReviewFromServer, setCanReviewFromServer] = useState<boolean>(false);
  const [myEmployee, setMyEmployee] = useState<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    department: string;
    designation: string;
  } | null>(null);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [balances, setBalances] = useState<EmployeeLeaveBalance[]>([]);

  // View filters & sub-tabs
  const [subTab, setSubTab] = useState<'APPLICATIONS' | 'BALANCES'>('APPLICATIONS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeaveStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LeaveType>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');

  // Apply Leave Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [applyForm, setApplyForm] = useState({
    employeeId: '',
    leaveType: 'CASUAL' as LeaveType,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    isHalfDay: false,
    halfDaySession: 'FIRST_HALF' as 'FIRST_HALF' | 'SECOND_HALF',
    reason: ''
  });
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isSubmittingApply, setIsSubmittingApply] = useState<boolean>(false);

  // Admin Review Modal state
  const [reviewTarget, setReviewTarget] = useState<LeaveApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Cancel Leave Confirmation Modal state
  const [cancelTarget, setCancelTarget] = useState<LeaveApplication | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  const canApplyLeave =
    hasPermission('hrms.leave_apply') ||
    hasPermission('hrms.manage') ||
    currentUser?.role !== 'Customer';

  const canReviewLeaves =
    canReviewFromServer ||
    hasPermission('hrms.leave_review') ||
    hasPermission('hrms.manage') ||
    ['Admin', 'Super Admin', 'HR Manager'].includes(String(currentUser?.role || ''));

  const loadLeaveData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.getLeaves(selectedYear);
      setCanReviewFromServer(Boolean(data?.canReview));
      setMyEmployee(data?.myEmployee || null);
      setLeaves(Array.isArray(data?.leaves) ? data.leaves : []);
      setBalances(Array.isArray(data?.balances) ? data.balances : []);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to load leave records from MySQL.';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadLeaveData(false);
  }, [loadLeaveData, refreshTrigger]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      loadLeaveData(true);
    };
    window.addEventListener('solarpulse_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('solarpulse_storage_updated', handleStorageUpdate);
  }, [loadLeaveData]);

  // Open Apply Modal when triggered from parent HrmsView header button
  useEffect(() => {
    if (openApplySignal > 0) {
      handleOpenApplyModal();
    }
  }, [openApplySignal]);

  const myBalance = useMemo<EmployeeLeaveBalance | null>(() => {
    if (!balances || balances.length === 0) return null;
    if (myEmployee?.employeeId) {
      const found = balances.find(b => b.employeeId === myEmployee.employeeId);
      if (found) return found;
    }
    const uId = currentUser?.id;
    const uEmpId = (currentUser as any)?.employeeId;
    return (
      balances.find(
        b => b.employeeId === uId || (uEmpId && b.employeeCode === uEmpId)
      ) || balances[0]
    );
  }, [balances, myEmployee, currentUser]);

  const activeApplyBalance = useMemo<EmployeeLeaveBalance | null>(() => {
    const targetId = applyForm.employeeId || myEmployee?.employeeId;
    if (!targetId) return myBalance;
    return balances.find(b => b.employeeId === targetId) || myBalance;
  }, [applyForm.employeeId, myEmployee, balances, myBalance]);

  const pendingCount = useMemo(
    () => leaves.filter(l => l.status === 'PENDING').length,
    [leaves]
  );

  const combinedSearch = (localSearch || searchTerm || '').trim().toLowerCase();

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && l.leaveType !== typeFilter) return false;
      if (!combinedSearch) return true;
      return (
        (l.employeeName || '').toLowerCase().includes(combinedSearch) ||
        (l.employeeCode || '').toLowerCase().includes(combinedSearch) ||
        (l.department || '').toLowerCase().includes(combinedSearch) ||
        (l.reason || '').toLowerCase().includes(combinedSearch) ||
        (l.adminRemarks || '').toLowerCase().includes(combinedSearch)
      );
    });
  }, [leaves, statusFilter, typeFilter, combinedSearch]);

  const filteredBalances = useMemo(() => {
    if (!combinedSearch) return balances;
    return balances.filter(b =>
      (b.employeeName || '').toLowerCase().includes(combinedSearch) ||
      (b.employeeCode || '').toLowerCase().includes(combinedSearch) ||
      (b.department || '').toLowerCase().includes(combinedSearch) ||
      (b.designation || '').toLowerCase().includes(combinedSearch)
    );
  }, [balances, combinedSearch]);

  const activeEmployeesForApply = useMemo(() => {
    return (employees || []).filter(e => String(e.status || '').toUpperCase() !== 'TERMINATED');
  }, [employees]);

  const requestedDays = useMemo(
    () => computeRequestedDays(applyForm.startDate, applyForm.endDate, applyForm.isHalfDay),
    [applyForm.startDate, applyForm.endDate, applyForm.isHalfDay]
  );

  const selectedBalanceAvailable = useMemo(() => {
    if (!activeApplyBalance || applyForm.leaveType === 'UNPAID') return null;
    if (applyForm.leaveType === 'CASUAL') {
      return Math.max(0, Number((activeApplyBalance.casualRemaining - activeApplyBalance.casualPending).toFixed(2)));
    }
    if (applyForm.leaveType === 'SICK') {
      return Math.max(0, Number((activeApplyBalance.sickRemaining - activeApplyBalance.sickPending).toFixed(2)));
    }
    return Math.max(0, Number((activeApplyBalance.earnedRemaining - activeApplyBalance.earnedPending).toFixed(2)));
  }, [activeApplyBalance, applyForm.leaveType]);

  const handleOpenApplyModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setApplyForm({
      employeeId: myEmployee?.employeeId || activeEmployeesForApply[0]?.id || '',
      leaveType: 'CASUAL',
      startDate: today,
      endDate: today,
      isHalfDay: false,
      halfDaySession: 'FIRST_HALF',
      reason: ''
    });
    setApplyError(null);
    setIsApplyModalOpen(true);
  };

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingApply) return;
    setApplyError(null);

    if (!applyForm.startDate || !applyForm.endDate) {
      setApplyError('Please select valid start and end dates.');
      return;
    }
    if (applyForm.endDate < applyForm.startDate) {
      setApplyError('End date cannot be earlier than start date.');
      return;
    }
    if (requestedDays <= 0) {
      setApplyError('Leave duration must be at least 0.5 day.');
      return;
    }
    if (applyForm.reason.trim().length < 3) {
      setApplyError('Please enter a reason (at least 3 characters).');
      return;
    }
    if (
      applyForm.leaveType !== 'UNPAID' &&
      selectedBalanceAvailable !== null &&
      requestedDays > selectedBalanceAvailable + 0.001
    ) {
      setApplyError(
        `Insufficient ${LEAVE_TYPE_SHORT[applyForm.leaveType]} leave balance (${selectedBalanceAvailable} day(s) available after pending). Switch to Unpaid Leave if exhausted.`
      );
      return;
    }

    setIsSubmittingApply(true);
    try {
      await apiClient.applyLeave({
        employeeId: canReviewLeaves && applyForm.employeeId ? applyForm.employeeId : undefined,
        leaveType: applyForm.leaveType,
        startDate: applyForm.startDate,
        endDate: applyForm.isHalfDay ? applyForm.startDate : applyForm.endDate,
        isHalfDay: applyForm.isHalfDay,
        halfDaySession: applyForm.isHalfDay ? applyForm.halfDaySession : undefined,
        reason: applyForm.reason.trim()
      });

      const appYear = Number(applyForm.startDate.slice(0, 4)) || currentYear;
      if (appYear !== selectedYear) {
        setSelectedYear(appYear);
      } else {
        await loadLeaveData(true);
      }

      setIsApplyModalOpen(false);
      showToast('Leave application submitted to MySQL and sent for approval.', 'success');
      window.dispatchEvent(new CustomEvent('solarpulse_storage_updated'));
      triggerRefresh();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to submit leave application.';
      setApplyError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmittingApply(false);
    }
  };

  const handleOpenReviewModal = (lv: LeaveApplication, defaultAction: 'APPROVE' | 'REJECT') => {
    setReviewTarget(lv);
    setReviewAction(defaultAction);
    setReviewRemarks(lv.adminRemarks || '');
    setReviewError(null);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget || isSubmittingReview) return;
    setReviewError(null);

    if (reviewAction === 'REJECT' && reviewRemarks.trim().length < 3) {
      setReviewError('Please provide rejection remarks explaining the reason (minimum 3 characters).');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await apiClient.reviewLeave(reviewTarget.id, reviewAction, reviewRemarks.trim());
      await loadLeaveData(true);
      setReviewTarget(null);
      showToast(
        reviewAction === 'APPROVE'
          ? `Leave approved for ${reviewTarget.employeeName} (${reviewTarget.totalDays} day(s)).`
          : `Leave rejected for ${reviewTarget.employeeName}.`,
        'success'
      );
      window.dispatchEvent(new CustomEvent('solarpulse_storage_updated'));
      triggerRefresh();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to update leave review status.';
      setReviewError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || isSubmittingCancel) return;
    setIsSubmittingCancel(true);
    try {
      await apiClient.cancelLeave(cancelTarget.id, cancelReason.trim() || undefined);
      await loadLeaveData(true);
      setCancelTarget(null);
      setCancelReason('');
      showToast('Leave application cancelled successfully.', 'success');
      window.dispatchEvent(new CustomEvent('solarpulse_storage_updated'));
      triggerRefresh();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel leave request.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const reviewApplicantBalance = useMemo(() => {
    if (!reviewTarget) return null;
    return balances.find(b => b.employeeId === reviewTarget.employeeId) || null;
  }, [reviewTarget, balances]);

  return (
    <div className="space-y-4">
      {/* Header Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900">
              Employee Leave Management & Approvals
            </span>
            {canReviewLeaves && pendingCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                {pendingCount} Pending Approval{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {canReviewLeaves
              ? 'Apply for leave, track real-time balances, and review or approve employee leave applications'
              : `Logged in as ${myEmployee?.employeeName || currentUser?.name || 'Employee'} • Apply for leave & track approval status`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Year:</span>
            <select
              aria-label="Select Leave Year"
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800 cursor-pointer"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadLeaveData(false)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {canApplyLeave && (
            <button
              type="button"
              onClick={handleOpenApplyModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>
          )}
        </div>
      </div>

      {/* Error State Banner */}
      {loadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => loadLeaveData(false)}
            className="px-2.5 py-1 font-bold bg-white border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-100 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Personal Leave Balance Summary Cards */}
      {myBalance && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-sky-700">Casual Leave ({selectedYear})</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                CL
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{myBalance.casualRemaining}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {myBalance.casualTotal} days left</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Used: {myBalance.casualUsed}d {myBalance.casualPending > 0 ? `• Pending: ${myBalance.casualPending}d` : ''}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-700">Sick Leave ({selectedYear})</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                SL
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{myBalance.sickRemaining}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {myBalance.sickTotal} days left</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Used: {myBalance.sickUsed}d {myBalance.sickPending > 0 ? `• Pending: ${myBalance.sickPending}d` : ''}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-700">Earned Leave ({selectedYear})</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                EL
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{myBalance.earnedRemaining}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {myBalance.earnedTotal} days left</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Used: {myBalance.earnedUsed}d {myBalance.earnedPending > 0 ? `• Pending: ${myBalance.earnedPending}d` : ''}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-800">Total Paid Available</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Quota
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-900">{myBalance.totalRemaining}</span>
              <span className="text-xs text-amber-700 font-semibold">/ {myBalance.totalAllocated} days</span>
            </div>
            <p className="text-[10px] text-amber-700 mt-1">
              Paid Used: {myBalance.totalUsed}d • Unpaid (LWP): {myBalance.unpaidUsed}d
            </p>
          </div>
        </div>
      )}

      {/* Sub-Tabs & Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {canReviewLeaves && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSubTab('APPLICATIONS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'APPLICATIONS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                <span>Leave Applications ({leaves.length})</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('BALANCES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'BALANCES' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                <span>Team Leave Balances ({balances.length})</span>
              </button>
            </div>
          )}

          {subTab === 'APPLICATIONS' && (
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subTab === 'APPLICATIONS' && (
            <select
              aria-label="Filter by Leave Type"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Leave Types</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="EARNED">Earned Leave</option>
              <option value="UNPAID">Unpaid Leave</option>
            </select>
          )}

          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder={
              subTab === 'APPLICATIONS'
                ? 'Filter by employee, reason, remarks...'
                : 'Filter team member, code, dept...'
            }
            className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white w-full sm:w-64 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* CONTENT AREA */}
      {subTab === 'APPLICATIONS' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Dates & Duration</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Review & Admin Remarks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Loading leave applications from MySQL...
                    </td>
                  </tr>
                ) : filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">No Leave Applications Found</p>
                        <p className="text-xs text-slate-500">
                          {statusFilter !== 'ALL' || typeFilter !== 'ALL' || combinedSearch
                            ? 'No leave records matched your selected filters.'
                            : `No leave requests recorded for ${selectedYear} yet.`}
                        </p>
                        {canApplyLeave && (
                          <button
                            type="button"
                            onClick={handleOpenApplyModal}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs cursor-pointer"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>Apply for Leave</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map(lv => {
                    const isOwnPending =
                      lv.status === 'PENDING' &&
                      (lv.employeeId === myEmployee?.employeeId ||
                        lv.employeeId === currentUser?.id);

                    return (
                      <tr key={lv.id} className="hover:bg-slate-50/70 transition-colors align-top">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{lv.employeeName}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                              {lv.employeeCode || lv.employeeId}
                            </span>
                            <span>•</span>
                            <span>{lv.department || 'Operations'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getLeaveTypeBadge(lv.leaveType)}`}>
                            {LEAVE_TYPE_SHORT[lv.leaveType] || lv.leaveType}
                          </span>
                          {lv.isHalfDay && (
                            <span className="block text-[10px] text-indigo-700 font-semibold mt-1">
                              Half Day ({lv.halfDaySession === 'SECOND_HALF' ? '2nd Half' : '1st Half'})
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 whitespace-nowrap">
                            {lv.startDate === lv.endDate
                              ? formatDateDisplay(lv.startDate)
                              : `${formatDateDisplay(lv.startDate)} → ${formatDateDisplay(lv.endDate)}`}
                          </div>
                          <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                            {lv.totalDays} {lv.totalDays === 1 ? 'day' : 'days'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[240px]">
                          <p className="text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                            {lv.reason}
                          </p>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            Applied {formatDateDisplay(lv.appliedAt)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${getLeaveStatusBadge(lv.status)}`}>
                            {lv.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                            {lv.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                            {lv.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            {lv.status === 'CANCELLED' && <Ban className="w-3 h-3" />}
                            <span>{lv.status}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-[220px]">
                          {lv.reviewedBy ? (
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{lv.reviewedBy}</span>
                              </div>
                              {lv.reviewedAt && (
                                <span className="text-[10px] text-slate-400 block">
                                  {formatDateDisplay(lv.reviewedAt)}
                                </span>
                              )}
                              {lv.adminRemarks && (
                                <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 mt-1">
                                  {lv.adminRemarks}
                                </p>
                              )}
                            </div>
                          ) : lv.adminRemarks ? (
                            <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                              {lv.adminRemarks}
                            </p>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Awaiting review</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {canReviewLeaves && lv.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewModal(lv, 'APPROVE')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewModal(lv, 'REJECT')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {canReviewLeaves && (lv.status === 'APPROVED' || lv.status === 'REJECTED') && (
                              <button
                                type="button"
                                onClick={() => handleOpenReviewModal(lv, lv.status === 'APPROVED' ? 'REJECT' : 'APPROVE')}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Update</span>
                              </button>
                            )}

                            {(isOwnPending || (canReviewLeaves && lv.status !== 'CANCELLED')) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelTarget(lv);
                                  setCancelReason('');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TEAM LEAVE BALANCES REGISTER (Admin / HR Manager) */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Casual (CL)</th>
                  <th className="py-3 px-4 text-center">Sick (SL)</th>
                  <th className="py-3 px-4 text-center">Earned (EL)</th>
                  <th className="py-3 px-4 text-center">Unpaid Taken</th>
                  <th className="py-3 px-4 text-center">Total Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No employee leave balance records found for {selectedYear}.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{b.employeeName}</div>
                        <span className="font-mono text-[10px] text-slate-400">{b.employeeCode || b.employeeId}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-medium text-slate-800">{b.department || '-'}</div>
                        <span className="text-[10px] text-slate-400">{b.designation || '-'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-sky-800">{b.casualRemaining}</span>
                        <span className="text-slate-400"> / {b.casualTotal}</span>
                        <span className="block text-[10px] text-slate-400">
                          Used {b.casualUsed}d {b.casualPending > 0 ? `(${b.casualPending}d pend)` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-rose-800">{b.sickRemaining}</span>
                        <span className="text-slate-400"> / {b.sickTotal}</span>
                        <span className="block text-[10px] text-slate-400">
                          Used {b.sickUsed}d {b.sickPending > 0 ? `(${b.sickPending}d pend)` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-emerald-800">{b.earnedRemaining}</span>
                        <span className="text-slate-400"> / {b.earnedTotal}</span>
                        <span className="block text-[10px] text-slate-400">
                          Used {b.earnedUsed}d {b.earnedPending > 0 ? `(${b.earnedPending}d pend)` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {b.unpaidUsed} d
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {b.totalRemaining} / {b.totalAllocated} d
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPLY FOR LEAVE MODAL */}
      {isApplyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-leave-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="apply-leave-modal-title" className="font-bold text-sm text-slate-900">
                    Apply for Employee Leave
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Submit leave request directly to HR & Admin for review
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitApply} className="p-5 space-y-4 overflow-y-auto">
              {applyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{applyError}</span>
                </div>
              )}

              {canReviewLeaves && activeEmployeesForApply.length > 0 ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Applicant Employee
                  </label>
                  <select
                    value={applyForm.employeeId}
                    onChange={e => setApplyForm({ ...applyForm, employeeId: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {activeEmployeesForApply.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeCode}) — {emp.department}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Applicant</span>
                    <span className="font-bold text-slate-900">
                      {myEmployee?.employeeName || currentUser?.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                    {myEmployee?.employeeCode || (currentUser as any)?.employeeId || 'STAFF'}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={applyForm.leaveType}
                  onChange={e => setApplyForm({ ...applyForm, leaveType: e.target.value as LeaveType })}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="CASUAL">
                    {LEAVE_TYPE_LABELS.CASUAL}
                    {activeApplyBalance ? ` — ${Math.max(0, activeApplyBalance.casualRemaining - activeApplyBalance.casualPending)} avail` : ''}
                  </option>
                  <option value="SICK">
                    {LEAVE_TYPE_LABELS.SICK}
                    {activeApplyBalance ? ` — ${Math.max(0, activeApplyBalance.sickRemaining - activeApplyBalance.sickPending)} avail` : ''}
                  </option>
                  <option value="EARNED">
                    {LEAVE_TYPE_LABELS.EARNED}
                    {activeApplyBalance ? ` — ${Math.max(0, activeApplyBalance.earnedRemaining - activeApplyBalance.earnedPending)} avail` : ''}
                  </option>
                  <option value="UNPAID">{LEAVE_TYPE_LABELS.UNPAID}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    From Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={applyForm.startDate}
                    onChange={e => {
                      const nextStart = e.target.value;
                      setApplyForm(prev => ({
                        ...prev,
                        startDate: nextStart,
                        endDate: prev.isHalfDay || !prev.endDate || prev.endDate < nextStart ? nextStart : prev.endDate
                      }));
                    }}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    To Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    disabled={applyForm.isHalfDay}
                    min={applyForm.startDate}
                    value={applyForm.isHalfDay ? applyForm.startDate : applyForm.endDate}
                    onChange={e => setApplyForm({ ...applyForm, endDate: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyForm.isHalfDay}
                    onChange={e => {
                      const checked = e.target.checked;
                      setApplyForm(prev => ({
                        ...prev,
                        isHalfDay: checked,
                        endDate: checked ? prev.startDate : prev.endDate
                      }));
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Half-Day Leave (0.5 day)</span>
                </label>

                {applyForm.isHalfDay ? (
                  <select
                    value={applyForm.halfDaySession}
                    onChange={e => setApplyForm({ ...applyForm, halfDaySession: e.target.value as 'FIRST_HALF' | 'SECOND_HALF' })}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer"
                  >
                    <option value="FIRST_HALF">First Half (Morning)</option>
                    <option value="SECOND_HALF">Second Half (Afternoon)</option>
                  </select>
                ) : (
                  <span className="text-xs font-black text-amber-800">
                    Duration: {requestedDays} {requestedDays === 1 ? 'Day' : 'Days'}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Leave <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={applyForm.reason}
                  onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })}
                  placeholder="Specify reason (e.g. family event, medical appointment, personal work)..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  disabled={isSubmittingApply}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApply}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>{isSubmittingApply ? 'Submitting...' : 'Submit Leave Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN REVIEW MODAL */}
      {reviewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-leave-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-800 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="review-leave-modal-title" className="font-bold text-sm text-slate-900">
                    Review Leave Application
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {reviewTarget.employeeName} ({reviewTarget.employeeCode}) • {reviewTarget.department}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-5 space-y-4">
              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{reviewError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getLeaveTypeBadge(reviewTarget.leaveType)}`}>
                    {LEAVE_TYPE_LABELS[reviewTarget.leaveType]}
                  </span>
                  <span className="font-black text-slate-900">
                    {reviewTarget.totalDays} {reviewTarget.totalDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
                <div className="text-slate-700 font-semibold">
                  {reviewTarget.startDate === reviewTarget.endDate
                    ? formatDateDisplay(reviewTarget.startDate)
                    : `${formatDateDisplay(reviewTarget.startDate)} → ${formatDateDisplay(reviewTarget.endDate)}`}
                  {reviewTarget.isHalfDay && ` (${reviewTarget.halfDaySession === 'SECOND_HALF' ? '2nd Half' : '1st Half'})`}
                </div>
                <p className="text-slate-600 bg-white border border-slate-200 rounded-lg p-2">
                  <span className="font-bold text-slate-500">Reason: </span>
                  {reviewTarget.reason}
                </p>
                {reviewApplicantBalance && reviewTarget.leaveType !== 'UNPAID' && (
                  <p className="text-[11px] text-slate-500">
                    Current {LEAVE_TYPE_SHORT[reviewTarget.leaveType]} Balance Remaining:{' '}
                    <span className="font-bold text-slate-900">
                      {reviewTarget.leaveType === 'CASUAL'
                        ? reviewApplicantBalance.casualRemaining
                        : reviewTarget.leaveType === 'SICK'
                          ? reviewApplicantBalance.sickRemaining
                          : reviewApplicantBalance.earnedRemaining}{' '}
                      day(s)
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Decision</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      reviewAction === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Leave</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECT')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      reviewAction === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Leave</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Remarks {reviewAction === 'REJECT' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder={
                    reviewAction === 'REJECT'
                      ? 'Provide reason for rejecting this leave application...'
                      : 'Optional approval note / handover instructions...'
                  }
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  disabled={isSubmittingReview}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-2xs cursor-pointer disabled:opacity-50 ${
                    reviewAction === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <span>
                    {isSubmittingReview
                      ? 'Saving Decision...'
                      : reviewAction === 'APPROVE'
                        ? 'Confirm Approval'
                        : 'Confirm Rejection'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Cancel Leave Request</h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmCancel} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to cancel the{' '}
                <span className="font-bold text-slate-900">{LEAVE_TYPE_SHORT[cancelTarget.leaveType]}</span> leave
                request for <span className="font-bold text-slate-900">{cancelTarget.employeeName}</span> (
                {formatDateDisplay(cancelTarget.startDate)} – {formatDateDisplay(cancelTarget.endDate)})?
                {cancelTarget.status === 'APPROVED' && ' Approved leave balance days will be automatically restored.'}
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cancellation Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Plans changed, reporting to duty"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  disabled={isSubmittingCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                >
                  Keep Request
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
