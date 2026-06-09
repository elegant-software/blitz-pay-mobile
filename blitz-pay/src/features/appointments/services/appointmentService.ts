import { authedFetch } from '../../../lib/api/authedFetch';
import type {
  AppointmentResponse,
  BookableSlot,
  RescheduleRequest,
  SearchSlotsRequest,
  ShopperBookAppointmentRequest,
} from '../types/appointment';

export async function fetchBookableSlots(params: SearchSlotsRequest): Promise<BookableSlot[]> {
  const body: Record<string, string | undefined> = {
    branchId: params.branchId,
    productCategoryId: params.productCategoryId,
    from: params.from,
    to: params.to,
  };
  if (params.employeeId) {
    body.employeeId = params.employeeId;
  }
  const res = await authedFetch('/v1/shopper/appointments/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error('appointments_slots_load_failed');
  }
  return res.json() as Promise<BookableSlot[]>;
}

export async function bookAppointment(
  request: ShopperBookAppointmentRequest,
): Promise<AppointmentResponse> {
  const res = await authedFetch('/v1/shopper/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error('appointment_booking_failed');
  }
  return res.json() as Promise<AppointmentResponse>;
}

export async function fetchMyAppointments(): Promise<AppointmentResponse[]> {
  const res = await authedFetch('/v1/shopper/appointments');
  if (!res.ok) {
    throw new Error('appointments_load_failed');
  }
  return res.json() as Promise<AppointmentResponse[]>;
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  const res = await authedFetch(`/v1/shopper/appointments/${appointmentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('appointment_cancel_failed');
  }
}

export async function rescheduleAppointment(
  appointmentId: string,
  request: RescheduleRequest,
): Promise<AppointmentResponse> {
  const res = await authedFetch(`/v1/shopper/appointments/${appointmentId}/reschedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error('appointment_reschedule_failed');
  }
  return res.json() as Promise<AppointmentResponse>;
}

export async function registerShopperDevice(params: {
  expoPushToken: string;
  platform: 'ios' | 'android';
}): Promise<void> {
  const res = await authedFetch('/v1/shopper/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expoPushToken: params.expoPushToken,
      platform: params.platform,
    }),
  });
  if (!res.ok) {
    throw new Error('shopper_device_registration_failed');
  }
}

export async function unregisterShopperDevice(expoPushToken: string): Promise<void> {
  await authedFetch(`/v1/shopper/devices/${encodeURIComponent(expoPushToken)}`, {
    method: 'DELETE',
  });
}
