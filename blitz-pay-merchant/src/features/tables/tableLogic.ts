import type { BranchFloor, BranchFloorSummary, BranchTable, TableLive, TableOrderSummary } from './types/table';

const MAX_BULK_TABLES = 200;

export function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Converts a point inside the rendered picture into a Table Placement fraction. */
export function pointToFraction(
  pointX: number,
  pointY: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };
  return { x: clampFraction(pointX / width), y: clampFraction(pointY / height) };
}

/** Converts a Table Placement fraction into a point inside the rendered picture. */
export function fractionToPoint(
  x: number,
  y: number,
  width: number,
  height: number,
): { left: number; top: number } {
  return { left: clampFraction(x) * width, top: clampFraction(y) * height };
}

/** Moves a placed fraction by a drag delta measured in rendered pixels. */
export function dragFraction(
  start: { x: number; y: number },
  dx: number,
  dy: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (width <= 0 || height <= 0) return { x: clampFraction(start.x), y: clampFraction(start.y) };
  return { x: clampFraction(start.x + dx / width), y: clampFraction(start.y + dy / height) };
}

export function isOrderPaid(order: Pick<TableOrderSummary, 'paymentStatus'>): boolean {
  return order.paymentStatus === 'PAID';
}

export function isOrderOpenForPayment(order: Pick<TableOrderSummary, 'paymentStatus'>): boolean {
  return order.paymentStatus !== 'PAID' && order.paymentStatus !== 'CANCELLED';
}

export function hasUnpaidOrders(live: Pick<TableLive, 'orders'>): boolean {
  return live.orders.some(isOrderOpenForPayment);
}

export type TablePaymentLabel =
  | 'table_payment_paid'
  | 'table_payment_cancelled'
  | 'table_payment_in_progress'
  | 'table_payment_failed'
  | 'table_payment_unpaid';

export function paymentStatusLabel(paymentStatus: string): TablePaymentLabel {
  if (paymentStatus === 'PAID') return 'table_payment_paid';
  if (paymentStatus === 'CANCELLED') return 'table_payment_cancelled';
  if (paymentStatus === 'PAYMENT_IN_PROGRESS' || paymentStatus === 'PAYMENT_INITIATED') return 'table_payment_in_progress';
  if (paymentStatus === 'PAYMENT_FAILED' || paymentStatus === 'FAILED') return 'table_payment_failed';
  return 'table_payment_unpaid';
}

export type TablePinTone ='free' | 'unpaid' | 'paid' | 'reserved';

export function tablePinTone(live: Pick<TableLive, 'status' | 'orders'>): TablePinTone {
  if (live.status === 'OCCUPIED') return hasUnpaidOrders(live) ? 'unpaid' : 'paid';
  if (live.status === 'RESERVED') return 'reserved';
  return 'free';
}

/**
 * Turns the bulk-create input into Table Names. Entries are separated by commas or new lines;
 * a range such as "1-10" or "Terrace 1-4" expands to one Table per number.
 */
export function parseBulkTableNames(input: string): string[] {
  const names: string[] = [];
  for (const raw of input.split(/[\n,;]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const range = /^(.*?)(\d+)\s*-\s*(\d+)$/.exec(entry);
    if (range) {
      const prefix = range[1];
      const from = Number(range[2]);
      const to = Number(range[3]);
      if (to >= from && to - from < MAX_BULK_TABLES) {
        for (let n = from; n <= to; n += 1) names.push(`${prefix}${n}`);
        continue;
      }
    }
    names.push(entry);
  }
  return Array.from(new Set(names)).slice(0, MAX_BULK_TABLES);
}

export const MIN_SEATS = 1;
export const MAX_SEATS = 50;

export function parseSeats(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(n) && n >= MIN_SEATS && n <= MAX_SEATS ? n : null;
}

/** Reads a seats text field: empty clears seats, out-of-range or non-numeric input is invalid. */
export function parseSeatsInput(text: string): { valid: boolean; seats: number | null } {
  if (!text.trim()) return { valid: true, seats: null };
  const seats = parseSeats(text.trim());
  return seats == null ? { valid: false, seats: null } : { valid: true, seats };
}

/**
 * Pin caption. Setup shows "name · seats"; the live floor passes guests and shows "name · guests/seats",
 * with "–" when no guests are seated and "?" when seats are not set so the gap is visible.
 */
export function pinCaption(name: string, seats: number | null, guests?: number | null): string {
  const seatText = seats == null ? '?' : String(seats);
  if (guests === undefined) return `${name} · ${seatText}`;
  return `${name} · ${guests ?? '–'}/${seatText}`;
}

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 50;

export function clampGuests(value: number): number {
  return Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, Math.round(value)));
}

export function summarizeFloor(tables: TableLive[], branchCapacity: number | null): BranchFloorSummary {
  const occupied = tables.filter((live) => live.status === 'OCCUPIED');
  return {
    totalTables: tables.length,
    occupiedTables: occupied.length,
    seatedCapacity: tables.reduce((sum, live) => sum + (live.table.seats ?? 0), 0),
    occupiedSeats: occupied.reduce((sum, live) => sum + (live.table.seats ?? 0), 0),
    totalGuests: occupied.reduce((sum, live) => sum + (live.guestCount ?? 0), 0),
    branchCapacity,
  };
}

/** Applies one `table` event from the live floor stream; deactivated tables leave the floor. */
export function applyTableEvent(floor: BranchFloor, live: TableLive): BranchFloor {
  const exists = floor.tables.some((candidate) => candidate.table.id === live.table.id);
  const tables = !live.table.active
    ? floor.tables.filter((candidate) => candidate.table.id !== live.table.id)
    : exists
      ? floor.tables.map((candidate) => (candidate.table.id === live.table.id ? live : candidate))
      : [...floor.tables, live];
  return { ...floor, tables, summary: summarizeFloor(tables, floor.summary.branchCapacity) };
}

export function seatedCapacity(tables: Pick<BranchTable, 'active' | 'seats'>[]): number {
  return tables.reduce((sum, table) => sum + (table.active && table.seats ? table.seats : 0), 0);
}

/** Branch Capacity never blocks; setup only warns when seats on Tables exceed it. */
export function exceedsBranchCapacity(seated: number, branchCapacity: number | null): boolean {
  return branchCapacity != null && seated > branchCapacity;
}
