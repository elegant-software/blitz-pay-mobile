import { authedFetch } from './api';
import { observability } from './observability';

const API_VERSION = 'v1';

type BranchResponse = {
  id?: string;
  merchantId?: string;
  name?: string;
  active?: boolean;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  status?: string;
};

export type MerchantBranchDetails = {
  branchId: string;
  merchantId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  status?: string;
};

function buildPath(path: string): string {
  return path.startsWith('/') ? `/${API_VERSION}${path}` : `/${API_VERSION}/${path}`;
}

function ensureNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function fetchMerchantBranches(
  merchantId: string,
): Promise<{ branchId: string; name: string }[]> {
  const response = await authedFetch(buildPath(`/merchants/${merchantId}/branches`), { method: 'GET' });
  if (!response.ok) return [];
  const rows = await response.json() as BranchResponse[];
  return rows
    .filter((row): row is BranchResponse & { id: string; name: string } => !!row.id && !!row.name)
    .map((row) => ({ branchId: row.id, name: row.name }));
}

export async function fetchMerchantBranchDetails(
  merchantId: string,
  branchId: string,
): Promise<MerchantBranchDetails | null> {
  observability.info('merchant_branch_details_request_started', {
    merchantId,
    branchId,
  });

  const response = await authedFetch(buildPath(`/merchants/${merchantId}/branches`), {
    method: 'GET',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    observability.warn('merchant_branch_details_request_failed', {
      merchantId,
      branchId,
      status: response.status,
      reason: body.slice(0, 500) || 'empty_body',
    });
    return null;
  }

  const rows = await response.json() as BranchResponse[];
  const branch = rows.find((row) => row.id === branchId && row.name);
  if (!branch || !branch.id || !branch.name) {
    observability.warn('merchant_branch_details_missing', {
      merchantId,
      branchId,
      resultCount: rows.length,
    });
    return null;
  }

  observability.info('merchant_branch_details_request_succeeded', {
    merchantId,
    branchId,
    status: branch.status ?? null,
  });

  return {
    branchId: branch.id,
    merchantId: branch.merchantId ?? merchantId,
    name: branch.name,
    latitude: ensureNumber(branch.latitude),
    longitude: ensureNumber(branch.longitude),
    geofenceRadiusMeters: ensureNumber(branch.geofenceRadiusMeters),
    status: branch.status,
  };
}
