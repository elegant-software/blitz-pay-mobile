import { authedFetch } from '../../../lib/api';
import { config } from '../../../lib/config';
import { observability } from '../../../lib/observability';
import { createSseParser } from '../sseParser';
import { parseSeats } from '../tableLogic';
import type {
  BranchFloor,
  BranchRef,
  BranchTable,
  FloorPlan,
  PresignedUpload,
  TableLive,
  TableOrderSummary,
  TableStatus,
} from '../types/table';

export class TableError extends Error {
  constructor(
    public readonly key: string,
    public readonly detail: string,
    public readonly status?: number,
  ) {
    super(key);
    this.name = 'TableError';
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text.trim()) return `HTTP ${response.status}`;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const detail = typeof json.error === 'string' ? json.error
        : typeof json.message === 'string' ? json.message
        : null;
      return detail ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

function branchPath(ref: BranchRef): string {
  return `/v1/merchants/${encodeURIComponent(ref.merchantId)}/branches/${encodeURIComponent(ref.branchId)}`;
}

async function request<T>(
  event: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  observability.info(`${event}_started`, { path, method });
  let response: Response;
  try {
    response = await authedFetch(path, {
      method,
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    observability.error(`${event}_network_failed`, { path, method, reason });
    throw new TableError(`${event}_failed`, reason);
  }
  if (!response.ok) {
    const reason = await readError(response);
    observability.error(`${event}_failed`, { path, method, status: response.status, reason });
    throw new TableError(`${event}_failed`, reason, response.status);
  }
  observability.info(`${event}_succeeded`, { path, method, status: response.status });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

type RawTable = Partial<BranchTable> & { placement?: BranchTable['placement'] };

function parseTable(raw: RawTable): BranchTable {
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    active: raw.active !== false,
    link: String(raw.link ?? ''),
    seats: parseSeats(raw.seats),
    placement: raw.placement && raw.placement.floorPlanId
      ? { floorPlanId: raw.placement.floorPlanId, x: Number(raw.placement.x), y: Number(raw.placement.y) }
      : null,
  };
}

function parseFloorPlan(raw: Partial<FloorPlan>): FloorPlan {
  return { id: String(raw.id ?? ''), name: String(raw.name ?? ''), imageUrl: raw.imageUrl ?? null };
}

function parseStatus(status: unknown): TableStatus {
  return status === 'OCCUPIED' || status === 'RESERVED' ? status : 'FREE';
}

function parseOrder(raw: Partial<TableOrderSummary>): TableOrderSummary {
  return {
    orderId: String(raw.orderId ?? ''),
    pickupNumber: typeof raw.pickupNumber === 'number' ? raw.pickupNumber : null,
    totalAmountMinor: raw.totalAmountMinor ?? 0,
    currency: raw.currency ?? 'EUR',
    paymentStatus: String(raw.paymentStatus ?? ''),
    preparationStatus: raw.preparationStatus ?? null,
    createdAt: raw.createdAt ?? '',
  };
}

type RawLive = {
  table?: RawTable;
  status?: unknown;
  occupiedSince?: string | null;
  guestCount?: number | null;
  orders?: Partial<TableOrderSummary>[];
};

function parseLive(raw: RawLive): TableLive {
  return {
    table: parseTable(raw.table ?? {}),
    status: parseStatus(raw.status),
    occupiedSince: raw.occupiedSince ?? null,
    guestCount: typeof raw.guestCount === 'number' && raw.guestCount > 0 ? raw.guestCount : null,
    orders: (raw.orders ?? []).map(parseOrder),
  };
}

export async function fetchTables(ref: BranchRef): Promise<BranchTable[]> {
  const raw = await request<RawTable[]>('branch_tables_load', `${branchPath(ref)}/tables`);
  return (raw ?? []).map(parseTable);
}

export async function createTables(ref: BranchRef, names: string[], seats?: number | null): Promise<BranchTable[]> {
  const raw = await request<RawTable[]>('branch_tables_create', `${branchPath(ref)}/tables`, {
    method: 'POST',
    body: seats != null ? { names, seats } : { names },
  });
  return (raw ?? []).map(parseTable);
}

export async function updateTable(
  ref: BranchRef,
  tableId: string,
  patch: { name?: string; active?: boolean; seats?: number | null },
): Promise<BranchTable> {
  const raw = await request<RawTable>('branch_table_update', `${branchPath(ref)}/tables/${encodeURIComponent(tableId)}`, {
    method: 'PATCH',
    body: patch,
  });
  return parseTable(raw);
}

export async function deleteTable(ref: BranchRef, tableId: string): Promise<void> {
  await request<void>('branch_table_delete', `${branchPath(ref)}/tables/${encodeURIComponent(tableId)}`, {
    method: 'DELETE',
  });
}

export async function placeTable(
  ref: BranchRef,
  tableId: string,
  placement: { floorPlanId: string; x: number; y: number },
): Promise<BranchTable> {
  const raw = await request<RawTable>(
    'branch_table_place',
    `${branchPath(ref)}/tables/${encodeURIComponent(tableId)}/placement`,
    { method: 'PUT', body: placement },
  );
  return parseTable(raw);
}

export async function unplaceTable(ref: BranchRef, tableId: string): Promise<void> {
  await request<void>('branch_table_unplace', `${branchPath(ref)}/tables/${encodeURIComponent(tableId)}/placement`, {
    method: 'DELETE',
  });
}

export async function fetchFloorPlans(ref: BranchRef): Promise<FloorPlan[]> {
  const raw = await request<Partial<FloorPlan>[]>('floor_plans_load', `${branchPath(ref)}/floor-plans`);
  return (raw ?? []).map(parseFloorPlan);
}

export async function createFloorPlan(ref: BranchRef, name: string): Promise<FloorPlan> {
  const raw = await request<Partial<FloorPlan>>('floor_plan_create', `${branchPath(ref)}/floor-plans`, {
    method: 'POST',
    body: { name },
  });
  return parseFloorPlan(raw);
}

export async function renameFloorPlan(ref: BranchRef, floorPlanId: string, name: string): Promise<FloorPlan> {
  const raw = await request<Partial<FloorPlan>>(
    'floor_plan_rename',
    `${branchPath(ref)}/floor-plans/${encodeURIComponent(floorPlanId)}`,
    { method: 'PATCH', body: { name } },
  );
  return parseFloorPlan(raw);
}

export async function deleteFloorPlan(ref: BranchRef, floorPlanId: string): Promise<void> {
  await request<void>('floor_plan_delete', `${branchPath(ref)}/floor-plans/${encodeURIComponent(floorPlanId)}`, {
    method: 'DELETE',
  });
}

function inferImageMimeType(uri: string): string {
  if (/\.png($|\?)/i.test(uri)) return 'image/png';
  if (/\.webp($|\?)/i.test(uri)) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Uploads a Floor Plan picture: ask the backend for a presigned URL and PUT the bytes to storage.
 * The backend links the picture to the Floor Plan itself; callers reload the Floor Plans afterwards.
 */
export async function uploadFloorPlanImage(
  ref: BranchRef,
  floorPlanId: string,
  imageUri: string,
  mimeType?: string | null,
): Promise<void> {
  const contentType = mimeType || inferImageMimeType(imageUri);
  const planPath = `${branchPath(ref)}/floor-plans/${encodeURIComponent(floorPlanId)}`;
  const presigned = await request<PresignedUpload>('floor_plan_image_upload_url', `${planPath}/image/upload-url`, {
    method: 'POST',
    body: { contentType },
  });

  observability.info('floor_plan_image_upload_started', { floorPlanId, contentType });
  try {
    const file = await fetch(imageUri);
    const blob = await file.blob();
    const upload = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!upload.ok) {
      const reason = await readError(upload);
      observability.error('floor_plan_image_upload_failed', { floorPlanId, status: upload.status, reason });
      throw new TableError('floor_plan_image_upload_failed', reason, upload.status);
    }
  } catch (err) {
    if (err instanceof TableError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    observability.error('floor_plan_image_upload_failed', { floorPlanId, reason });
    throw new TableError('floor_plan_image_upload_failed', reason);
  }
  observability.info('floor_plan_image_upload_succeeded', { floorPlanId });
}

export async function fetchBranchFloor(ref: BranchRef): Promise<BranchFloor> {
  const raw = await request<{
    floorPlans?: Partial<FloorPlan>[];
    tables?: Parameters<typeof parseLive>[0][];
    totalTables?: number;
    occupiedTables?: number;
    seatedCapacity?: number;
    occupiedSeats?: number;
    totalGuests?: number;
    branchCapacity?: number | null;
  }>('branch_floor_load', `${branchPath(ref)}/floor`);
  const tables = (raw?.tables ?? []).map(parseLive);
  return {
    floorPlans: (raw?.floorPlans ?? []).map(parseFloorPlan),
    tables,
    summary: {
      totalTables: raw?.totalTables ?? tables.length,
      occupiedTables: raw?.occupiedTables ?? tables.filter((live) => live.status === 'OCCUPIED').length,
      seatedCapacity: raw?.seatedCapacity ?? 0,
      occupiedSeats: raw?.occupiedSeats ?? 0,
      totalGuests: raw?.totalGuests ?? tables.reduce((sum, live) => sum + (live.guestCount ?? 0), 0),
      branchCapacity: typeof raw?.branchCapacity === 'number' ? raw.branchCapacity : null,
    },
  };
}

export async function clearTable(ref: BranchRef, tableId: string): Promise<void> {
  await request<void>('branch_table_clear', `${branchPath(ref)}/tables/${encodeURIComponent(tableId)}/clear`, {
    method: 'POST',
  });
}

export async function setGuestCount(ref: BranchRef, tableId: string, guestCount: number): Promise<TableLive> {
  const raw = await request<RawLive>(
    'branch_table_guests',
    `${branchPath(ref)}/tables/${encodeURIComponent(tableId)}/guests`,
    { method: 'PUT', body: { guestCount } },
  );
  return parseLive(raw);
}

export interface FloorEventHandlers {
  onOpen: () => void;
  onTable: (live: TableLive) => void;
  onClosed: (reason: string) => void;
}

/**
 * Opens the live floor stream (text/event-stream). React Native has no EventSource, so this reads the
 * response incrementally through XMLHttpRequest. Returns a function that closes the stream.
 */
export function openFloorEvents(ref: BranchRef, accessToken: string, handlers: FloorEventHandlers): () => void {
  const url = `${config.apiUrl.replace(/\/+$/, '')}${branchPath(ref)}/floor/events`;
  const xhr = new XMLHttpRequest();
  let seen = 0;
  let closed = false;
  let opened = false;

  const parse = createSseParser(({ event, data }) => {
    if (event !== 'table') return;
    try {
      handlers.onTable(parseLive(JSON.parse(data) as RawLive));
    } catch (err) {
      observability.warn('branch_floor_event_invalid', { reason: err instanceof Error ? err.message : String(err) });
    }
  });

  const finish = (reason: string) => {
    if (closed) return;
    closed = true;
    handlers.onClosed(reason);
  };

  xhr.open('GET', url);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
  xhr.onreadystatechange = () => {
    if (xhr.readyState >= 2 && !opened && xhr.status === 200) {
      opened = true;
      observability.info('branch_floor_events_opened', { branchId: ref.branchId });
      handlers.onOpen();
    }
    if (xhr.readyState === 4) {
      if (xhr.status !== 200) {
        observability.warn('branch_floor_events_failed', { branchId: ref.branchId, status: xhr.status });
      }
      finish(`status_${xhr.status}`);
    }
  };
  xhr.onprogress = () => {
    const text = xhr.responseText ?? '';
    if (text.length > seen) {
      parse(text.slice(seen));
      seen = text.length;
    }
  };
  xhr.onerror = () => {
    observability.warn('branch_floor_events_network_error', { branchId: ref.branchId });
    finish('network_error');
  };
  xhr.send();

  return () => {
    closed = true;
    xhr.abort();
  };
}
