import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';
import type {
  AppearanceHistoryFilter,
  AppearanceHistoryPage,
  AppearanceStatus,
  CreateAppearanceInput,
  MerchantAppearance,
} from '../types/appearance';

type AppearanceResponse = Partial<Omit<MerchantAppearance, 'appearanceId'>> & { id?: string };
type PageResponse = { content?: AppearanceResponse[]; page?: number; size?: number; totalElements?: number; totalPages?: number };

export class MerchantAppearanceError extends Error {
  constructor(public readonly key: string, public readonly detail: string, public readonly status?: number) {
    super(detail);
    this.name = 'MerchantAppearanceError';
  }
}

function mapAppearance(value: AppearanceResponse): MerchantAppearance {
  if (!value.id || !value.branchId || !value.merchantId || !value.name || !value.startTime || !value.endTime
    || !value.createdAt || typeof value.declaredLatitude !== 'number' || typeof value.declaredLongitude !== 'number'
    || !['ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED'].includes(value.status ?? '')) {
    throw new MerchantAppearanceError('merchant_appearances_load_failed', 'invalid_appearance_response');
  }
  return {
    appearanceId: value.id,
    branchId: value.branchId,
    branchName: value.branchName ?? value.branchId,
    merchantId: value.merchantId,
    name: value.name,
    declaredLatitude: value.declaredLatitude,
    declaredLongitude: value.declaredLongitude,
    startTime: value.startTime,
    endTime: value.endTime,
    createdAt: value.createdAt,
    cancelledAt: value.cancelledAt ?? null,
    status: value.status as AppearanceStatus,
  };
}

async function request<T>(path: string, init: RequestInit, failureKey: string): Promise<T> {
  observability.info('merchant_appearances_request_started', { path, method: init.method ?? 'GET' });
  const response = await authedFetch(`/v1${path}`, init);
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let detail = raw || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      detail = parsed.error ?? parsed.message ?? detail;
    } catch {}
    observability.error('merchant_appearances_request_failed', { path, status: response.status, reason: detail.slice(0, 500) });
    throw new MerchantAppearanceError(failureKey, detail, response.status);
  }
  observability.info('merchant_appearances_request_succeeded', { path, status: response.status });
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function listAppearances(merchantId: string, branchId: string): Promise<MerchantAppearance[]> {
  const rows = await request<AppearanceResponse[]>(
    `/merchants/${merchantId}/branches/${branchId}/appearances`,
    { method: 'GET' },
    'merchant_appearances_load_failed',
  );
  return rows.map(mapAppearance);
}

export async function listAppearanceHistory(
  merchantId: string,
  branchId: string,
  filter: AppearanceHistoryFilter,
): Promise<AppearanceHistoryPage> {
  const query = new URLSearchParams({
    from: filter.from,
    to: filter.to,
    page: String(filter.page),
    size: '20',
  });
  if (filter.status) query.set('status', filter.status);
  const page = await request<PageResponse>(
    `/merchants/${merchantId}/branches/${branchId}/appearances/history?${query}`,
    { method: 'GET' },
    'merchant_appearances_load_failed',
  );
  return {
    content: (page.content ?? []).map(mapAppearance),
    page: page.page ?? filter.page,
    size: page.size ?? 20,
    totalElements: page.totalElements ?? 0,
    totalPages: page.totalPages ?? 0,
  };
}

export async function createAppearance(input: CreateAppearanceInput): Promise<MerchantAppearance> {
  const response = await request<AppearanceResponse>(
    `/merchants/${input.merchantId}/branches/${input.branchId}/appearances`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        declaredLatitude: input.declaredLatitude,
        declaredLongitude: input.declaredLongitude,
        startTime: input.startTime,
        endTime: input.endTime,
      }),
    },
    'merchant_appearance_create_failed',
  );
  return mapAppearance(response);
}

export async function cancelAppearance(merchantId: string, branchId: string, appearanceId: string): Promise<void> {
  await request<void>(
    `/merchants/${merchantId}/branches/${branchId}/appearances/${appearanceId}`,
    { method: 'DELETE' },
    'merchant_appearance_cancel_failed',
  );
}
