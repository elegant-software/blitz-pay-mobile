import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';
import { readApiError } from '../../../lib/apiError';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployeeResponse {
  id: string;
  merchantId: string;
  name: string;
  active: boolean;   // derived from backend 'status' field ("ACTIVE" / "INACTIVE")
}

interface EmployeeRaw {
  id: string;
  merchantId: string;
  name: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

function rawToEmployee(raw: EmployeeRaw): EmployeeResponse {
  return { id: raw.id, merchantId: raw.merchantId, name: raw.name, active: raw.status === 'ACTIVE' };
}

export interface BranchAssignment {
  branchId: string;
}

export interface ServiceAssignment {
  productCategoryId: string;
  name: string;
  code: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  estimatedDurationMinutes: number | null;
}

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface WeeklyAvailabilitySlot {
  id?: string;        // present for saved slots
  dayOfWeek: DayOfWeek;
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
}

// Backend uses 1=Mon…7=Sun (ISO DayOfWeek)
const DAY_TO_INT: Record<DayOfWeek, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
};
const INT_TO_DAY: Record<number, DayOfWeek> = {
  1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY',
  5: 'FRIDAY', 6: 'SATURDAY', 7: 'SUNDAY',
};

function parseTime(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 5); // "09:00:00" → "09:00"
  if (Array.isArray(value)) {
    const [h, m] = value as number[];
    return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
  }
  return '00:00';
}

export interface AvailabilityException {
  id: string;
  date: string;           // YYYY-MM-DD
  type: 'BLOCKED' | 'EXTRA_WINDOW';
  startTime: string | null;
  endTime: string | null;
}

export interface AppointmentPolicy {
  bookingIntervalMinutes: number;
  bookingLeadTimeMinutes: number;
  bookingHorizonDays: number;
  reminderLeadTimeMinutes: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Employee CRUD ────────────────────────────────────────────────────────────

export async function fetchEmployees(merchantId: string): Promise<EmployeeResponse[]> {
  observability.info('employees_fetch_started', { merchantId });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    observability.error('employees_fetch_failed', { merchantId, status: response.status, reason });
    throw new Error('employees_load_failed');
  }
  const data = (await response.json()) as EmployeeRaw[];
  observability.info('employees_fetch_succeeded', { merchantId, count: data.length });
  return data.map(rawToEmployee);
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
    const reason = await readApiError(response);
    observability.error('employee_create_failed', { merchantId, status: response.status, reason });
    throw new Error('employee_create_failed');
  }
  const data = (await response.json()) as EmployeeRaw;
  observability.info('employee_create_succeeded', { merchantId, employeeId: data.id });
  return rawToEmployee(data);
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
    const reason = await readApiError(response);
    observability.error('employee_rename_failed', { merchantId, employeeId, status: response.status, reason });
    throw new Error('employee_rename_failed');
  }
  const data = (await response.json()) as EmployeeRaw;
  observability.info('employee_rename_succeeded', { merchantId, employeeId });
  return rawToEmployee(data);
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
    const reason = await readApiError(response);
    observability.error('employee_activate_failed', { merchantId, employeeId, status: response.status, reason });
    throw new Error('employee_activate_failed');
  }
  const data = (await response.json()) as EmployeeRaw;
  observability.info('employee_activate_succeeded', { merchantId, employeeId });
  return rawToEmployee(data);
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
    const reason = await readApiError(response);
    observability.error('employee_deactivate_failed', {
      merchantId,
      employeeId,
      status: response.status,
      reason,
    });
    if (response.status === 409) throw new Error('employee_deactivate_has_future_bookings');
    throw new Error('employee_deactivate_failed');
  }
  const data = (await response.json()) as EmployeeRaw;
  observability.info('employee_deactivate_succeeded', { merchantId, employeeId });
  return rawToEmployee(data);
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
    const reason = await readApiError(response);
    throw new Error(reason);
  }
}

export async function removeEmployeeBranchAssignment(
  merchantId: string,
  employeeId: string,
  branchId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branch-assignments/${encodeURIComponent(branchId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
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
  const data = await response.json() as { productCategoryId: string; categoryName?: string; categoryCode?: string }[];
  return data.map((item) => ({ productCategoryId: item.productCategoryId, name: item.categoryName ?? '', code: item.categoryCode ?? '' }));
}

export async function fetchProductCategories(merchantId: string): Promise<ProductCategory[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/product-categories`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('product_categories_load_failed');
  return (await response.json()) as ProductCategory[];
}

export async function addEmployeeServiceAssignment(
  merchantId: string,
  employeeId: string,
  productCategoryId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/service-assignments`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ productCategoryId }),
    },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
}

export async function removeEmployeeServiceAssignment(
  merchantId: string,
  employeeId: string,
  productCategoryId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/service-assignments/${encodeURIComponent(productCategoryId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
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
  const data = await response.json() as { id: string; dayOfWeek: number; startTime: unknown; endTime: unknown }[];
  return data.map((item) => ({
    id: item.id,
    dayOfWeek: INT_TO_DAY[item.dayOfWeek] ?? 'MONDAY',
    startTime: parseTime(item.startTime),
    endTime: parseTime(item.endTime),
  }));
}

export async function addWeeklyAvailabilitySlot(
  merchantId: string,
  employeeId: string,
  branchId: string,
  slot: Omit<WeeklyAvailabilitySlot, 'id'>,
): Promise<WeeklyAvailabilitySlot> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek: DAY_TO_INT[slot.dayOfWeek],
        startTime: slot.startTime,
        endTime: slot.endTime,
      }),
    },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
  const item = await response.json() as { id: string; dayOfWeek: number; startTime: unknown; endTime: unknown };
  return {
    id: item.id,
    dayOfWeek: INT_TO_DAY[item.dayOfWeek] ?? slot.dayOfWeek,
    startTime: parseTime(item.startTime),
    endTime: parseTime(item.endTime),
  };
}

export async function removeWeeklyAvailabilitySlot(
  merchantId: string,
  employeeId: string,
  branchId: string,
  slotId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability/${encodeURIComponent(slotId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
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
    const reason = await readApiError(response);
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
    `/v1/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}/branches/${encodeURIComponent(branchId)}/availability/exceptions/${encodeURIComponent(exceptionId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
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
    const reason = await readApiError(response);
    observability.error('appointment_policy_fetch_failed', { merchantId, status: response.status, reason });
    throw new Error('appointment_policy_load_failed');
  }
  const data = (await response.json()) as AppointmentPolicy;
  observability.info('appointment_policy_fetch_succeeded', { merchantId });
  return data;
}

// ─── Branch Opening Hours ─────────────────────────────────────────────────────

export interface BranchOpeningWindow {
  id: string;
  branchId: string;
  dayOfWeek: number;   // 1=Mon…7=Sun
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
}

export interface BranchOpeningException {
  id: string;
  branchId: string;
  date: string;        // YYYY-MM-DD
  type: 'CLOSED' | 'EXTRA_WINDOW';
  startTime: string | null;
  endTime: string | null;
}

export async function fetchBranchOpeningHours(
  merchantId: string,
  branchId: string,
): Promise<BranchOpeningWindow[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}/opening-hours`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('opening_hours_load_failed');
  const data = await response.json() as { id: string; branchId: string; dayOfWeek: number; startTime: unknown; endTime: unknown }[];
  return data.map((item) => ({
    id: item.id,
    branchId: item.branchId,
    dayOfWeek: item.dayOfWeek,
    startTime: parseTime(item.startTime),
    endTime: parseTime(item.endTime),
  }));
}

export async function addBranchOpeningWindow(
  merchantId: string,
  branchId: string,
  slot: { dayOfWeek: number; startTime: string; endTime: string },
): Promise<BranchOpeningWindow> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}/opening-hours`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(slot),
    },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
  const item = await response.json() as { id: string; branchId: string; dayOfWeek: number; startTime: unknown; endTime: unknown };
  return { id: item.id, branchId: item.branchId, dayOfWeek: item.dayOfWeek, startTime: parseTime(item.startTime), endTime: parseTime(item.endTime) };
}

export async function removeBranchOpeningWindow(
  merchantId: string,
  branchId: string,
  windowId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}/opening-hours/${encodeURIComponent(windowId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
}

export async function fetchBranchOpeningExceptions(
  merchantId: string,
  branchId: string,
): Promise<BranchOpeningException[]> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}/opening-hours/exceptions`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('opening_exceptions_load_failed');
  return (await response.json()) as BranchOpeningException[];
}

export async function addBranchOpeningException(
  merchantId: string,
  branchId: string,
  exception: Omit<BranchOpeningException, 'id' | 'branchId'>,
): Promise<BranchOpeningException> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}/opening-hours/exceptions`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(exception),
    },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
  return (await response.json()) as BranchOpeningException;
}

export async function removeBranchOpeningException(
  merchantId: string,
  branchId: string,
  exceptionId: string,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}/opening-hours/exceptions/${encodeURIComponent(exceptionId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
}

export async function updateProductCategory(
  merchantId: string,
  categoryId: string,
  name: string,
  estimatedDurationMinutes: number | null,
): Promise<void> {
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/product-categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, estimatedDurationMinutes }),
    },
  );
  if (!response.ok) {
    const reason = await readApiError(response);
    throw new Error(reason);
  }
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
    const reason = await readApiError(response);
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
    const reason = await readApiError(response);
    observability.error('appointment_patch_failed', {
      merchantId,
      appointmentId,
      status: response.status,
      reason,
    });
    throw new Error('appointment_patch_failed');
  }
}
