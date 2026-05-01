import { authedFetch } from './api';
import { observability } from './observability';
import type { Product } from '../types';

const API_VERSION = 'v1';

type MerchantBranchResponse = {
  id?: string;
  merchantId?: string;
  name?: string;
  active?: boolean;
  latitude?: number;
  longitude?: number;
};

type MerchantProductResponse = {
  productId?: string;
  branchId?: string;
  name?: string;
  description?: string;
  unitPrice?: number;
  imageUrl?: string;
  categoryName?: string;
  productCode?: number;
  active?: boolean;
};

type NearbyMerchantBranchResponse = {
  branchId?: string;
  name?: string;
  distanceMeters?: number;
};

type NearbyMerchantResponse = {
  merchantId?: string;
  legalBusinessName?: string;
  distanceMeters?: number;
  activeBranches?: NearbyMerchantBranchResponse[];
};

type NearbyMerchantScopeResponse = {
  merchants?: NearbyMerchantResponse[];
};

export type MerchantBranchSummary = {
  branchId: string;
  merchantId: string;
  name: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
};

export type MerchantProductInput = {
  branchId: string;
  name: string;
  description?: string;
  unitPrice: string;
  productCode?: string;
  imageUri?: string;
  categoryName?: string;
  active?: boolean;
};

export type MerchantScope = {
  merchantId: string;
  merchantName: string;
  branchId: string;
  branchName: string;
  merchantDistanceMeters?: number;
  branchDistanceMeters?: number;
};

export class MerchantProductError extends Error {
  constructor(
    public readonly key: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'MerchantProductError';
  }
}

function buildPath(path: string): string {
  return path.startsWith('/') ? `/${API_VERSION}${path}` : `/${API_VERSION}/${path}`;
}

function ensureNumber(value: unknown, fallback?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapProduct(response: MerchantProductResponse): Product | null {
  if (!response.productId || !response.branchId || !response.name || typeof response.unitPrice !== 'number') {
    return null;
  }

  return {
    id: response.productId,
    branchId: response.branchId,
    name: response.name,
    description: response.description,
    unitPrice: response.unitPrice,
    imageUrl: response.imageUrl,
    categoryName: response.categoryName,
    productCode: response.productCode,
    active: Boolean(response.active),
  };
}

function inferImageMimeType(uri: string): string {
  if (/\.png($|\?)/i.test(uri)) return 'image/png';
  if (/\.webp($|\?)/i.test(uri)) return 'image/webp';
  return 'image/jpeg';
}

function inferImageName(uri: string): string {
  const clean = uri.split('?')[0];
  return clean.split('/').filter(Boolean).pop() || `product-image.${inferImageMimeType(uri).split('/')[1]}`;
}

async function appendImage(formData: FormData, imageUri: string): Promise<void> {
  if (/^(file|content):\/\//i.test(imageUri)) {
    formData.append('image', {
      uri: imageUri,
      name: inferImageName(imageUri),
      type: inferImageMimeType(imageUri),
    } as unknown as Blob);
    return;
  }

  if (/^https?:\/\//i.test(imageUri)) {
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new MerchantProductError('merchant_product_invalid_image', `remote_image_${response.status}`);
    }
    formData.append('image', await response.blob());
    return;
  }

  throw new MerchantProductError('merchant_product_invalid_image', 'invalid_image_uri');
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  meta: { event: string; merchantId: string; branchId?: string; productId?: string; failureKey: string },
): Promise<T> {
  observability.info('merchant_products_request_started', {
    event: meta.event,
    merchantId: meta.merchantId,
    branchId: meta.branchId ?? null,
    productId: meta.productId ?? null,
    method: init.method ?? 'GET',
  });

  const response = await authedFetch(buildPath(path), init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    observability.error('merchant_products_request_failed', {
      event: meta.event,
      merchantId: meta.merchantId,
      branchId: meta.branchId ?? null,
      productId: meta.productId ?? null,
      status: response.status,
      reason: body.slice(0, 500) || 'empty_body',
    });
    throw new MerchantProductError(meta.failureKey, body || meta.failureKey, response.status);
  }

  observability.info('merchant_products_request_succeeded', {
    event: meta.event,
    merchantId: meta.merchantId,
    branchId: meta.branchId ?? null,
    productId: meta.productId ?? null,
    status: response.status,
  });

  return response.json() as Promise<T>;
}

function mapSaveFailureKey(status?: number): string {
  if (status === 400 || status === 422) return 'merchant_product_validation_failed';
  if (status === 404 || status === 409) return 'merchant_product_refresh_required';
  return 'merchant_product_save_failed';
}

export async function fetchMerchantBranches(merchantId: string): Promise<MerchantBranchSummary[]> {
  const response = await requestJson<MerchantBranchResponse[]>(
    `/merchants/${merchantId}/branches`,
    { method: 'GET' },
    {
      event: 'fetch_merchant_branches',
      merchantId,
      failureKey: 'merchant_products_load_failed',
    },
  );

  return response
    .filter((branch) => branch.id && branch.merchantId && branch.name && branch.active)
    .map((branch) => ({
      branchId: branch.id!,
      merchantId: branch.merchantId!,
      name: branch.name!,
      latitude: ensureNumber(branch.latitude),
      longitude: ensureNumber(branch.longitude),
    }));
}

export function resolveMerchantBranch(
  branches: MerchantBranchSummary[],
  userLocation?: { latitude: number; longitude: number },
): MerchantBranchSummary | null {
  if (branches.length === 0) return null;
  if (!userLocation) return null;

  const sorted = branches
    .map((branch, index) => ({
      index,
      branch,
      distanceMeters:
        branch.latitude != null && branch.longitude != null
          ? haversineMeters(
              userLocation.latitude,
              userLocation.longitude,
              branch.latitude,
              branch.longitude,
            )
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (a.distanceMeters !== b.distanceMeters) {
        return a.distanceMeters - b.distanceMeters;
      }
      return a.index - b.index;
    });

  const resolved = sorted[0];
  if (!resolved || !Number.isFinite(resolved.distanceMeters)) {
    return null;
  }

  return {
    ...resolved.branch,
    distanceMeters: resolved.distanceMeters,
  };
}

export async function resolveNearbyMerchantScope(
  userLocation: { latitude: number; longitude: number },
): Promise<MerchantScope> {
  const search = new URLSearchParams({
    lat: String(userLocation.latitude),
    lng: String(userLocation.longitude),
  });
  const response = await requestJson<NearbyMerchantScopeResponse>(
    `/merchants/nearby?${search.toString()}`,
    { method: 'GET' },
    {
      event: 'fetch_nearby_merchant_scope',
      merchantId: 'nearby_lookup',
      failureKey: 'merchant_products_load_failed',
    },
  );

  const merchants = (response.merchants ?? []).filter(
    (merchant): merchant is NearbyMerchantResponse & { merchantId: string; legalBusinessName: string } =>
      Boolean(merchant.merchantId && merchant.legalBusinessName),
  );
  if (merchants.length === 0) {
    throw new MerchantProductError('merchant_products_scope_missing', 'nearby_merchant_not_found');
  }

  const resolved = merchants
    .map((merchant, index) => {
      let nearestBranch: (NearbyMerchantBranchResponse & { branchId: string; name: string }) | undefined;
      let nearestBranchDistance = Number.POSITIVE_INFINITY;
      for (const branch of merchant.activeBranches ?? []) {
        if (!branch.branchId || !branch.name) continue;
        const distance = ensureNumber(branch.distanceMeters, Number.POSITIVE_INFINITY) ?? Number.POSITIVE_INFINITY;
        if (distance < nearestBranchDistance) {
          nearestBranch = branch as NearbyMerchantBranchResponse & { branchId: string; name: string };
          nearestBranchDistance = distance;
        }
      }

      return nearestBranch
        ? {
            index,
            merchantId: merchant.merchantId,
            merchantName: merchant.legalBusinessName,
            merchantDistanceMeters: ensureNumber(merchant.distanceMeters, Number.POSITIVE_INFINITY),
            branchId: nearestBranch.branchId,
            branchName: nearestBranch.name,
            branchDistanceMeters: nearestBranchDistance,
          }
        : null;
    })
    .filter(
      (
        merchant,
      ): merchant is {
        index: number;
        merchantId: string;
        merchantName: string;
        merchantDistanceMeters: number;
        branchId: string;
        branchName: string;
        branchDistanceMeters: number;
      } => merchant != null,
    )
    .sort((a, b) => {
      if (a.merchantDistanceMeters !== b.merchantDistanceMeters) {
        return a.merchantDistanceMeters - b.merchantDistanceMeters;
      }
      if (a.branchDistanceMeters !== b.branchDistanceMeters) {
        return a.branchDistanceMeters - b.branchDistanceMeters;
      }
      return a.index - b.index;
    })[0];

  if (!resolved) {
    throw new MerchantProductError('merchant_products_branch_missing', 'nearby_branch_not_found');
  }

  return {
    merchantId: resolved.merchantId,
    merchantName: resolved.merchantName,
    branchId: resolved.branchId,
    branchName: resolved.branchName,
    merchantDistanceMeters: Number.isFinite(resolved.merchantDistanceMeters)
      ? resolved.merchantDistanceMeters
      : undefined,
    branchDistanceMeters: Number.isFinite(resolved.branchDistanceMeters)
      ? resolved.branchDistanceMeters
      : undefined,
  };
}

export async function fetchBranchProducts(merchantId: string, branchId: string): Promise<Product[]> {
  const search = new URLSearchParams({ branchId });
  const response = await requestJson<MerchantProductResponse[]>(
    `/merchants/${merchantId}/products?${search.toString()}`,
    { method: 'GET' },
    {
      event: 'fetch_branch_products',
      merchantId,
      branchId,
      failureKey: 'merchant_products_load_failed',
    },
  );

  return response
    .map(mapProduct)
    .filter((product): product is Product => product != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchProductDetail(merchantId: string, branchId: string, productId: string): Promise<Product> {
  const search = new URLSearchParams({ branchId });
  const response = await requestJson<MerchantProductResponse>(
    `/merchants/${merchantId}/products/${productId}?${search.toString()}`,
    { method: 'GET' },
    {
      event: 'fetch_product_detail',
      merchantId,
      branchId,
      productId,
      failureKey: 'merchant_product_load_failed',
    },
  );

  const product = mapProduct(response);
  if (!product) {
    throw new MerchantProductError('merchant_product_load_failed', 'invalid_product_response');
  }
  return product;
}

async function buildProductFormData(input: MerchantProductInput): Promise<FormData> {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('branchId', input.branchId);
  formData.append('unitPrice', input.unitPrice);
  if (input.description) formData.append('description', input.description);
  if (input.productCode) formData.append('productCode', input.productCode);
  if (input.categoryName) formData.append('categoryName', input.categoryName);
  if (input.active !== undefined) formData.append('active', String(input.active));
  if (input.imageUri) await appendImage(formData, input.imageUri);
  return formData;
}

export async function createMerchantProduct(merchantId: string, input: MerchantProductInput): Promise<Product> {
  try {
    const response = await requestJson<MerchantProductResponse>(
      `/merchants/${merchantId}/products`,
      {
        method: 'POST',
        body: await buildProductFormData(input) as unknown as BodyInit,
      },
      {
        event: 'create_product',
        merchantId,
        branchId: input.branchId,
        failureKey: 'merchant_product_save_failed',
      },
    );
    const product = mapProduct(response);
    if (!product) throw new MerchantProductError('merchant_product_save_failed', 'invalid_product_response');
    return product;
  } catch (error) {
    if (error instanceof MerchantProductError && error.key === 'merchant_product_save_failed') {
      throw new MerchantProductError(mapSaveFailureKey(error.status), error.message, error.status);
    }
    throw error;
  }
}

export async function updateMerchantProduct(
  merchantId: string,
  productId: string,
  input: MerchantProductInput,
): Promise<Product> {
  try {
    const response = await requestJson<MerchantProductResponse>(
      `/merchants/${merchantId}/products/${productId}`,
      {
        method: 'PUT',
        body: await buildProductFormData(input) as unknown as BodyInit,
      },
      {
        event: 'update_product',
        merchantId,
        branchId: input.branchId,
        productId,
        failureKey: 'merchant_product_save_failed',
      },
    );
    const product = mapProduct(response);
    if (!product) throw new MerchantProductError('merchant_product_save_failed', 'invalid_product_response');
    return product;
  } catch (error) {
    if (error instanceof MerchantProductError && error.key === 'merchant_product_save_failed') {
      throw new MerchantProductError(mapSaveFailureKey(error.status), error.message, error.status);
    }
    throw error;
  }
}
