import { authedFetch } from './api';
import { observability } from './observability';

const API_VERSION = 'v1';

type AppearanceResponse = {
  id?: string;
  branchId?: string;
  merchantId?: string;
  declaredLatitude?: number;
  declaredLongitude?: number;
  effectiveLatitude?: number;
  effectiveLongitude?: number;
  startTime?: string;
  endTime?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MerchantAppearance = {
  appearanceId: string;
  branchId: string;
  merchantId: string;
  name: string;
  declaredLatitude: number;
  declaredLongitude: number;
  effectiveLatitude: number;
  effectiveLongitude: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateMerchantAppearanceInput = {
  merchantId: string;
  branchId: string;
  name: string;
  declaredLatitude: number;
  declaredLongitude: number;
  startTime: string;
  endTime: string;
};

export class MerchantAppearanceError extends Error {
  constructor(
    public readonly key: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'MerchantAppearanceError';
  }
}

function buildPath(path: string): string {
  return path.startsWith('/') ? `/${API_VERSION}${path}` : `/${API_VERSION}/${path}`;
}

function ensureNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapAppearance(value: AppearanceResponse): MerchantAppearance | null {
  if (
    !value.id
    || !value.branchId
    || !value.merchantId
    || !value.startTime
    || !value.endTime
    || !value.createdAt
    || !value.updatedAt
  ) {
    return null;
  }

  const declaredLatitude = ensureNumber(value.declaredLatitude);
  const declaredLongitude = ensureNumber(value.declaredLongitude);
  const effectiveLatitude = ensureNumber(value.effectiveLatitude);
  const effectiveLongitude = ensureNumber(value.effectiveLongitude);
  if (
    declaredLatitude == null
    || declaredLongitude == null
    || effectiveLatitude == null
    || effectiveLongitude == null
  ) {
    return null;
  }

  return {
    appearanceId: value.id,
    branchId: value.branchId,
    merchantId: value.merchantId,
    name: value.name?.trim() || value.id,
    declaredLatitude,
    declaredLongitude,
    effectiveLatitude,
    effectiveLongitude,
    startTime: value.startTime,
    endTime: value.endTime,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function inferFailureKey(
  status: number,
  reason: string,
  fallback: 'load' | 'create' | 'cancel',
): string {
  if (/mobile branch|mobile merchant branch|MOBILE/i.test(reason)) {
    return 'merchant_appearance_mobile_only';
  }
  if (status === 409 || /overlap|conflict|already.*appearance/i.test(reason)) {
    return 'merchant_appearance_conflict';
  }
  if (status === 404 && /appearances/.test(reason)) {
    return 'merchant_appearance_unavailable';
  }
  if (fallback === 'create' && (status === 400 || status === 422)) {
    return 'merchant_appearance_validation_failed';
  }
  if (fallback === 'cancel') {
    return 'merchant_appearance_cancel_failed';
  }
  if (fallback === 'create') {
    return 'merchant_appearance_create_failed';
  }
  return 'merchant_appearances_load_failed';
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  meta: {
    event: string;
    merchantId: string;
    branchId: string;
    appearanceId?: string;
    fallback: 'load' | 'create' | 'cancel';
  },
): Promise<T> {
  observability.info('merchant_appearances_request_started', {
    event: meta.event,
    merchantId: meta.merchantId,
    branchId: meta.branchId,
    appearanceId: meta.appearanceId ?? null,
    method: init.method ?? 'GET',
  });

  const response = await authedFetch(buildPath(path), init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const reason = body.slice(0, 500) || `HTTP ${response.status}`;
    observability.error('merchant_appearances_request_failed', {
      event: meta.event,
      merchantId: meta.merchantId,
      branchId: meta.branchId,
      appearanceId: meta.appearanceId ?? null,
      status: response.status,
      reason,
    });
    throw new MerchantAppearanceError(
      inferFailureKey(response.status, reason, meta.fallback),
      reason,
      response.status,
    );
  }

  observability.info('merchant_appearances_request_succeeded', {
    event: meta.event,
    merchantId: meta.merchantId,
    branchId: meta.branchId,
    appearanceId: meta.appearanceId ?? null,
    status: response.status,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function listMerchantAppearances(
  merchantId: string,
  branchId: string,
): Promise<MerchantAppearance[]> {
  const rows = await requestJson<AppearanceResponse[]>(
    `/merchants/${merchantId}/branches/${branchId}/appearances`,
    { method: 'GET' },
    {
      event: 'list_merchant_appearances',
      merchantId,
      branchId,
      fallback: 'load',
    },
  );

  const mapped = rows
    .map(mapAppearance)
    .filter((value): value is MerchantAppearance => value != null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (rows.length !== mapped.length) {
    observability.warn('merchant_appearances_response_filtered', {
      merchantId,
      branchId,
      responseCount: rows.length,
      mappedCount: mapped.length,
    });
  }

  return mapped;
}

export async function createMerchantAppearance(
  input: CreateMerchantAppearanceInput,
): Promise<MerchantAppearance> {
  const response = await requestJson<AppearanceResponse>(
    `/merchants/${input.merchantId}/branches/${input.branchId}/appearances`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        declaredLatitude: input.declaredLatitude,
        declaredLongitude: input.declaredLongitude,
        startTime: input.startTime,
        endTime: input.endTime,
      }),
    },
    {
      event: 'create_merchant_appearance',
      merchantId: input.merchantId,
      branchId: input.branchId,
      fallback: 'create',
    },
  );

  const mapped = mapAppearance(response);
  if (!mapped) {
    observability.error('merchant_appearance_response_invalid', {
      merchantId: input.merchantId,
      branchId: input.branchId,
      reason: 'invalid_appearance_response',
    });
    throw new MerchantAppearanceError(
      'merchant_appearance_create_failed',
      'invalid_appearance_response',
    );
  }
  return mapped;
}

export async function cancelMerchantAppearance(
  merchantId: string,
  branchId: string,
  appearanceId: string,
): Promise<void> {
  await requestJson<void>(
    `/merchants/${merchantId}/branches/${branchId}/appearances/${appearanceId}`,
    { method: 'DELETE' },
    {
      event: 'cancel_merchant_appearance',
      merchantId,
      branchId,
      appearanceId,
      fallback: 'cancel',
    },
  );
}
