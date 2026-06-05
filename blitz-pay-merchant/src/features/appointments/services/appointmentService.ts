import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';
import type {
  AppointmentResponse,
  MerchantBookAppointmentRequest,
  RescheduleAppointmentRequest,
  OverrideAppointmentRequest,
} from '../types/appointment';

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
          : null;
      return detail ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

function parseWindow(from: Date, to: Date): { from: string; to: string } {
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export async function fetchMerchantAppointments(
  merchantId: string,
  from: Date,
  to: Date,
): Promise<AppointmentResponse[]> {
  const { from: fromStr, to: toStr } = parseWindow(from, to);
  observability.info('merchant_appointments_request_started', { merchantId, from: fromStr, to: toStr });

  const params = new URLSearchParams({ from: fromStr, to: toStr });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_appointments_request_failed', {
      merchantId,
      status: response.status,
      reason,
    });
    throw new Error('appointments_load_failed');
  }

  const data = (await response.json()) as AppointmentResponse[];
  observability.info('merchant_appointments_request_succeeded', {
    merchantId,
    count: data.length,
  });
  return data;
}

export async function fetchEmployeeAppointments(
  merchantId: string,
  employeeId: string,
  from: Date,
  to: Date,
): Promise<AppointmentResponse[]> {
  const { from: fromStr, to: toStr } = parseWindow(from, to);
  observability.info('employee_appointments_request_started', {
    merchantId,
    employeeId,
    from: fromStr,
    to: toStr,
  });

  const params = new URLSearchParams({ from: fromStr, to: toStr });
  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments/employee/${encodeURIComponent(employeeId)}?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('employee_appointments_request_failed', {
      merchantId,
      employeeId,
      status: response.status,
      reason,
    });
    throw new Error('appointments_load_failed');
  }

  const data = (await response.json()) as AppointmentResponse[];
  observability.info('employee_appointments_request_succeeded', {
    merchantId,
    employeeId,
    count: data.length,
  });
  return data;
}

export async function bookMerchantAppointment(
  merchantId: string,
  request: MerchantBookAppointmentRequest,
): Promise<AppointmentResponse> {
  observability.info('merchant_appointment_book_started', {
    merchantId,
    branchId: request.branchId,
    productId: request.productId,
    startTime: request.startTime,
  });

  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_appointment_book_failed', {
      merchantId,
      status: response.status,
      reason,
    });
    if (response.status === 409) throw new Error('appointment_conflict');
    if (response.status === 400 || response.status === 422) throw new Error('appointment_validation_failed');
    throw new Error('appointment_book_failed');
  }

  const data = (await response.json()) as AppointmentResponse;
  observability.info('merchant_appointment_book_succeeded', {
    merchantId,
    appointmentId: data.id,
  });
  return data;
}

export async function cancelAppointment(
  merchantId: string,
  appointmentId: string,
): Promise<void> {
  observability.info('merchant_appointment_cancel_started', { merchantId, appointmentId });

  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments/${encodeURIComponent(appointmentId)}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_appointment_cancel_failed', {
      merchantId,
      appointmentId,
      status: response.status,
      reason,
    });
    throw new Error('appointment_cancel_failed');
  }

  observability.info('merchant_appointment_cancel_succeeded', { merchantId, appointmentId });
}

export async function completeAppointment(
  merchantId: string,
  appointmentId: string,
): Promise<AppointmentResponse> {
  observability.info('merchant_appointment_complete_started', { merchantId, appointmentId });

  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments/${encodeURIComponent(appointmentId)}/complete`,
    { method: 'PUT', headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_appointment_complete_failed', {
      merchantId,
      appointmentId,
      status: response.status,
      reason,
    });
    throw new Error('appointment_complete_failed');
  }

  const data = (await response.json()) as AppointmentResponse;
  observability.info('merchant_appointment_complete_succeeded', { merchantId, appointmentId });
  return data;
}

export async function rescheduleAppointment(
  merchantId: string,
  appointmentId: string,
  request: RescheduleAppointmentRequest,
): Promise<AppointmentResponse> {
  observability.info('merchant_appointment_reschedule_started', {
    merchantId,
    appointmentId,
    newStartTime: request.newStartTime,
  });

  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_appointment_reschedule_failed', {
      merchantId,
      appointmentId,
      status: response.status,
      reason,
    });
    if (response.status === 409) throw new Error('appointment_conflict');
    if (response.status === 400 || response.status === 422) throw new Error('appointment_validation_failed');
    throw new Error('appointment_reschedule_failed');
  }

  const data = (await response.json()) as AppointmentResponse;
  observability.info('merchant_appointment_reschedule_succeeded', { merchantId, appointmentId });
  return data;
}

export async function overrideAppointment(
  merchantId: string,
  appointmentId: string,
  request: OverrideAppointmentRequest,
): Promise<AppointmentResponse> {
  observability.info('merchant_appointment_override_started', { merchantId, appointmentId });

  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments/${encodeURIComponent(appointmentId)}/override`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_appointment_override_failed', {
      merchantId,
      appointmentId,
      status: response.status,
      reason,
    });
    throw new Error('appointment_override_failed');
  }

  const data = (await response.json()) as AppointmentResponse;
  observability.info('merchant_appointment_override_succeeded', { merchantId, appointmentId });
  return data;
}
