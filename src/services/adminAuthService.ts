import { UserRole } from '../types/solar';
import { apiClient } from './apiClient';

export interface ProvisionAccountParams {
  id?: string;
  email: string;
  password?: string;
  displayName: string;
  systemRole: UserRole;
  employeeCode: string;
  phone?: string;
  department?: string;
  designation?: string;
  isFieldWorker?: boolean;
}

export interface ProvisionAccountResult {
  uid: string;
  provider: 'local_offline' | 'server_admin';
  message: string;
}

/**
 * Provisions a new ERP login account for an employee without external Firebase dependencies.
 */
export async function provisionEmployeeAccount(
  params: ProvisionAccountParams
): Promise<ProvisionAccountResult> {
  const cleanEmail = params.email.trim();
  const password = params.password;

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // 1. Call authenticated server-side endpoint
  const res = await apiClient.request(`${apiClient.getBaseUrl()}/admin/create-employee-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: params.id,
      email: cleanEmail,
      password,
      displayName: params.displayName.trim(),
      systemRole: params.systemRole,
      employeeCode: params.employeeCode,
      phone: params.phone,
      department: params.department,
      designation: params.designation,
      isFieldWorker: params.isFieldWorker
    })
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || `Failed to provision employee account (HTTP ${res.status}).`);
  }

  return {
    uid: data?.uid || params.id || `usr-emp-${Date.now()}`,
    provider: 'server_admin',
    message: data?.message || 'Account provisioned successfully.'
  };
}

/**
 * Updates an employee's credentials, field worker flag, or account status.
 */
export async function updateEmployeeAccount(params: {
  uid: string;
  password?: string;
  disabled?: boolean;
  isFieldWorker?: boolean;
  displayName?: string;
  systemRole?: UserRole;
}): Promise<boolean> {
  if (
    !params.password &&
    typeof params.disabled !== 'boolean' &&
    typeof params.isFieldWorker !== 'boolean' &&
    !params.displayName &&
    !params.systemRole
  ) {
    return true;
  }

  const res = await apiClient.request(`${apiClient.getBaseUrl()}/admin/update-employee-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: params.uid,
      password: params.password,
      disabled: params.disabled,
      isFieldWorker: params.isFieldWorker,
      displayName: params.displayName,
      systemRole: params.systemRole
    })
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || `Failed to update employee account (HTTP ${res.status}).`);
  }

  return Boolean(data?.success ?? true);
}

/**
 * Sends a password reset confirmation for an employee.
 */
export async function sendEmployeePasswordResetEmail(email: string): Promise<void> {
  console.log(`[ERP Auth] Password reset simulated for ${email}`);
}
