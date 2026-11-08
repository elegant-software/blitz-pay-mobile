import * as Location from 'expo-location';
import { config } from '../../../lib/config';
import { observability } from '../../../lib/observability';
import type { CustomerLocationInput } from '../../order-payment/types/orderPayment';

export interface TableCheckIn {
  merchantId: string;
  merchantName: string;
  branchId: string;
  branchName: string;
  /** Null when the Table is deactivated: open the branch storefront for counter pickup. */
  tableId: string | null;
  tableName: string | null;
  active: boolean;
  /** True when people already sit at the Table; then nobody is asked for a Guest Count. */
  occupied: boolean;
}

export class TableCheckInError extends Error {
  constructor(
    public readonly key: string,
    public readonly detail: string,
    public readonly status?: number,
  ) {
    super(key);
    this.name = 'TableCheckInError';
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text.trim()) return `HTTP ${response.status}`;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (typeof json.error === 'string') return json.error;
      if (typeof json.message === 'string') return json.message;
    } catch {
      // not JSON
    }
    return text.slice(0, 500);
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function resolveTableCode(code: string): Promise<TableCheckIn> {
  const url = `${config.apiUrl.replace(/\/+$/, '')}/v1/storefront/tables/${encodeURIComponent(code)}`;
  observability.info('table_checkin_resolve_started', { codeLength: code.length });
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    observability.error('table_checkin_resolve_network_failed', { reason });
    throw new TableCheckInError('error_server_unreachable', reason);
  }
  if (!response.ok) {
    const reason = await readError(response);
    observability.warn('table_checkin_resolve_failed', { status: response.status, reason });
    if (response.status === 404) throw new TableCheckInError('table_code_unknown', reason, 404);
    throw new TableCheckInError('table_checkin_failed', reason, response.status);
  }
  const raw = (await response.json()) as Partial<TableCheckIn>;
  if (!raw.merchantId || !raw.branchId) {
    observability.error('table_checkin_resolve_invalid_response', { hasMerchant: Boolean(raw.merchantId), hasBranch: Boolean(raw.branchId) });
    throw new TableCheckInError('table_checkin_failed', 'invalid_response');
  }
  const active = raw.active !== false && Boolean(raw.tableId);
  const result: TableCheckIn = {
    merchantId: raw.merchantId,
    merchantName: raw.merchantName ?? '',
    branchId: raw.branchId,
    branchName: raw.branchName ?? '',
    tableId: active ? raw.tableId ?? null : null,
    tableName: active ? raw.tableName ?? null : null,
    active,
    occupied: raw.occupied === true,
  };
  observability.info('table_checkin_resolved', {
    merchantId: result.merchantId,
    branchId: result.branchId,
    active: result.active,
    occupied: result.occupied,
  });
  return result;
}

/** Walk-In Ordering at a Table still needs a fresh, accurate location (ADR-0023). */
export async function captureWalkInLocation(): Promise<CustomerLocationInput> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    observability.warn('table_order_location_denied', { status: permission.status });
    throw new Error('table_location_required');
  }
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? 9999,
      capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    };
  } catch (err) {
    observability.error('table_order_location_failed', { reason: err instanceof Error ? err.message : String(err) });
    throw new Error('table_location_required');
  }
}
