import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployeeResponse {
  id: string;
  merchantId: string;
  name: string;
  active: boolean;
}

export interface BranchAssignment {
  branchId: string;
}

export interface ServiceAssignment {
  productId: string;
  productName: string;
}

export interface WeeklyAvailabilitySlot {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface AvailabilityException {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  unavailable: boolean;
}

export interface AppointmentPolicy {
  bookingIntervalMinutes: number;
  bookingLeadTimeMinutes: number;
  bookingHorizonDays: number;
  reminderLeadTimeMinutes: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text.trim()) return `HTTP ${response.status}`;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const detail =
        typeof json.error === 'string'
          ? json.error
          : typeof json.message === 'string'
          ? json.message
          : typeof json.detail === 'string'
          ? json.detail
          : null;
      return detail ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

// ─── Employee CRUD ────────────────────────────────────────────────────────────

export async function fetchEmployees(merchantId: string): Promise<EmployeeResponse[]> {
  observability.info('employees_fetch_started', { merchantId });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('employees_fetch_failed', { merchantId, status: response.status, reason });
    throw new Error('employees_load_failed');
  }
  const data = (await response.json()) as EmployeeResponse[];
  observability.info('employees_fetch_succeeded', { merchantId, count: data.length });
  return data;
}

export async function createEmployee(merchantId: string, name: string): Promise<EmployeeResponse> {
  observability.info('employee_create_started', { merchantId, name });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('employee_create_failed', { merchantId, status: response.status, reason });
    throw new Error('employee_create_failed');
  }
  const data = (await response.json()) as EmployeeResponse;
  observability.info('employee_create_succeeded', { merchantId, employeeId: data.id });
  return data;
}

export async function renameEmployee(
  merchantId: string,
  employeeId: string,
  name: string,
): Promise<EmployeeResponse> {
  observability.info('employee_rename_started', { merchantId, employeeId, name });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/name`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('employee_rename_failed', { merchantId, employeeId, status: response.status, reason });
    throw new Error('employee_rename_failed');
  }
  const data = (await response.json()) as EmployeeResponse;
  observability.info('employee_rename_succeeded', { merchantId, employeeId });
  return data;
}

export async function activateEmployee(
  merchantId: string,
  employeeId: string,
): Promise<EmployeeResponse> {
  observability.info('employee_activate_started', { merchantId, employeeId });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/activate`,
    { method: 'PUT', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('employee_activate_failed', { merchantId, employeeId, status: response.status, reason });
    throw new Error('employee_activate_failed');
  }
  const data = (await response.json()) as EmployeeResponse;
  observability.info('employee_activate_succeeded', { merchantId, employeeId });
  return data;
}

export async function deactivateEmployee(
  merchantId: string,
  employeeId: string,
): Promise<EmployeeResponse> {
  observability.info('employee_deactivate_started', { merchantId, employeeId });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/deactivate`,
    { method: 'PUT', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('employee_deactivate_failed', {
      merchantId,
      employeeId,
      status: response.status,
      reason,
    });
    if (response.status === 409) throw new Error('employee_deactivate_has_future_bookings');
    throw new Error('employee_deactivate_failed');
  }
  const data = (await response.json()) as EmployeeResponse;
  observability.info('employee_deactivate_succeeded', { merchantId, employeeId });
  return data;
}

// ─── Branch Assignments ───────────────────────────────────────────────────────

export async function fetchEmployeeBranchAssignments(
  merchantId: string,
  employeeId: string,
): Promise<BranchAssignment[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branch-assignments`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('branch_assignments_load_failed');
  return (await response.json()) as BranchAssignment[];
}

export async function addEmployeeBranchAssignment(
  merchantId: string,
  employeeId: string,
  branchId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branch-assignments`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

export async function removeEmployeeBranchAssignment(
  merchantId: string,
  employeeId: string,
  branchId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branch-assignments`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

// ─── Service Assignments ──────────────────────────────────────────────────────

export async function fetchEmployeeServiceAssignments(
  merchantId: string,
  employeeId: string,
): Promise<ServiceAssignment[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/service-assignments`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('service_assignments_load_failed');
  return (await response.json()) as ServiceAssignment[];
}

export async function addEmployeeServiceAssignment(
  merchantId: string,
  employeeId: string,
  productId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/service-assignments`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

export async function removeEmployeeServiceAssignment(
  merchantId: string,
  employeeId: string,
  productId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/service-assignments`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function fetchWeeklyAvailability(
  merchantId: string,
  employeeId: string,
  branchId: string,
): Promise<WeeklyAvailabilitySlot[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('availability_load_failed');
  return (await response.json()) as WeeklyAvailabilitySlot[];
}

export async function setWeeklyAvailability(
  merchantId: string,
  employeeId: string,
  branchId: string,
  slots: WeeklyAvailabilitySlot[],
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(slots),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

export async function clearWeeklyAvailability(
  merchantId: string,
  employeeId: string,
  branchId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

// ─── Availability Exceptions ──────────────────────────────────────────────────

export async function fetchAvailabilityExceptions(
  merchantId: string,
  employeeId: string,
  branchId: string,
): Promise<AvailabilityException[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability/exceptions`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('exceptions_load_failed');
  return (await response.json()) as AvailabilityException[];
}

export async function addAvailabilityException(
  merchantId: string,
  employeeId: string,
  branchId: string,
  exception: Omit<AvailabilityException, 'id'>,
): Promise<AvailabilityException> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability/exceptions`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(exception),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
  return (await response.json()) as AvailabilityException;
}

export async function removeAvailabilityException(
  merchantId: string,
  employeeId: string,
  branchId: string,
  exceptionId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability/exceptions`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exceptionId }),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    throw new Error(reason);
  }
}

// ─── Appointment Policy ───────────────────────────────────────────────────────

export async function fetchAppointmentPolicy(merchantId: string): Promise<AppointmentPolicy> {
  observability.info('appointment_policy_fetch_started', { merchantId });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointment-policy`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('appointment_policy_fetch_failed', { merchantId, status: response.status, reason });
    throw new Error('appointment_policy_load_failed');
  }
  const data = (await response.json()) as AppointmentPolicy;
  observability.info('appointment_policy_fetch_succeeded', { merchantId });
  return data;
}

export async function patchAppointmentPolicy(
  merchantId: string,
  patch: Partial<AppointmentPolicy>,
): Promise<AppointmentPolicy> {
  observability.info('appointment_policy_patch_started', { merchantId });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointment-policy`,
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('appointment_policy_patch_failed', { merchantId, status: response.status, reason });
    throw new Error('appointment_policy_save_failed');
  }
  const data = (await response.json()) as AppointmentPolicy;
  observability.info('appointment_policy_patch_succeeded', { merchantId });
  return data;
}

// ─── Appointment Note / Contact Patch ────────────────────────────────────────

export async function patchAppointment(
  merchantId: string,
  appointmentId: string,
  patch: { note?: string | null; contactName?: string; contactEmail?: string | null; contactPhone?: string | null },
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments/${encodeURIComponent(appointmentId)}`,
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('appointment_patch_failed', {
      merchantId,
      appointmentId,
      status: response.status,
      reason,
    });
    throw new Error('appointment_patch_failed');
  }
}
