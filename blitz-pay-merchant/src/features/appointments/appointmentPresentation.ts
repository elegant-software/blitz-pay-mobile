import { colors } from '../../lib/theme';
import type { AppointmentResponse, AppointmentStatus } from './types/appointment';

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  BOOKED: colors.primary,
  CANCELLED: colors.error,
  COMPLETED: colors.success,
};

// Deterministic color per employeeId for color-coding in the merchant calendar
const EMPLOYEE_PALETTE = [
  '#00C2FF', // primary
  '#5856D6', // secondary
  '#FF9500', // warning
  '#34C759', // success
  '#FF3B30', // error
  '#AF52DE', // purple
  '#FF6B35', // orange
  '#00C7BE', // teal
];

const employeeColorCache = new Map<string, string>();

export function getEmployeeColor(employeeId: string | null): string {
  if (!employeeId) return colors.gray400;
  if (employeeColorCache.has(employeeId)) return employeeColorCache.get(employeeId)!;

  // Simple hash of the employeeId string for stable color assignment
  let hash = 0;
  for (let i = 0; i < employeeId.length; i++) {
    hash = (hash * 31 + employeeId.charCodeAt(i)) >>> 0;
  }
  const color = EMPLOYEE_PALETTE[hash % EMPLOYEE_PALETTE.length];
  employeeColorCache.set(employeeId, color);
  return color;
}

export function formatAppointmentTime(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatDateHeading(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatWeekRange(from: Date, to: Date): string {
  const f = formatShortDate(from);
  const t = formatShortDate(to);
  return `${f} – ${t}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Week starts Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function groupAppointmentsByDay(
  appointments: AppointmentResponse[],
  from: Date,
  to: Date,
): Map<string, AppointmentResponse[]> {
  const map = new Map<string, AppointmentResponse[]>();

  // Pre-populate all days in range
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = endOfDay(to);
  while (cursor <= end) {
    map.set(cursor.toDateString(), []);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const appt of appointments) {
    const key = new Date(appt.startTime).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(appt);
  }

  // Sort each day's appointments by start time
  for (const [, dayAppts] of map) {
    dayAppts.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }

  return map;
}
