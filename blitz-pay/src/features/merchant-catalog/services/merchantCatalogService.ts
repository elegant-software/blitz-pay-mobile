import type { BasketItem } from '../../basket/types/basket';
import { fetchMerchantCommerceJson } from '../../../lib/api/merchantCommerce';
import type { ActiveProduct, CatalogValidationIssue, MerchantBranch } from '../types/catalog';

type BranchResponse = {
  id?: string;
  merchantId?: string;
  name?: string;
  active?: boolean;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  activePaymentChannels?: string[];
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
};

type MerchantDetailsResponse = {
  logoUrl?: string;
  delayedPaymentEnabled?: boolean;
  deferredPaymentEnabled?: boolean;
  offerings?: string[];
};

export interface MerchantDetails {
  logoUrl?: string;
  delayedPaymentEnabled?: boolean;
}

type ProductResponse = {
  productId?: string;
  branchId?: string;
  name?: string;
  description?: string;
  unitPrice?: number;
  imageUrl?: string;
  active?: boolean;
  categoryId?: string;
  categoryName?: string;
  category?: string | { id?: string; name?: string };
  productCategoryName?: string;
  productCategory?: { id?: string; name?: string };
  productCode?: number;
  updatedAt?: string;
};

function ensureNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

function buildAddressSummary(branch: BranchResponse): string | undefined {
  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.postalCode,
    branch.country,
  ]
    .filter(Boolean)
    .join(', ') || undefined;
}

function resolveCategory(product: ProductResponse): { categoryId?: string; categoryName?: string } {
  const nestedCategory =
    typeof product.category === 'object' && product.category
      ? product.category
      : product.productCategory;

  const categoryName =
    product.categoryName
    ?? product.productCategoryName
    ?? (typeof product.category === 'string' ? product.category : undefined)
    ?? nestedCategory?.name;

  const categoryId = product.categoryId ?? nestedCategory?.id;

  return { categoryId, categoryName };
}

export async function fetchMerchantBranches(merchantId: string): Promise<MerchantBranch[]> {
  const response = await fetchMerchantCommerceJson<BranchResponse[]>(`/merchants/${merchantId}/branches`);
  return response
    .filter((branch) => branch.id && branch.merchantId && branch.name && branch.active)
    .map((branch) => ({
      branchId: branch.id!,
      merchantId: branch.merchantId!,
      name: branch.name!,
      active: Boolean(branch.active),
      addressSummary: buildAddressSummary(branch),
      latitude: ensureNumber(branch.latitude),
      longitude: ensureNumber(branch.longitude),
      activePaymentChannels: (branch.activePaymentChannels ?? []) as MerchantBranch['activePaymentChannels'],
      imageUrl: branch.imageUrl,
    }));
}

export async function fetchMerchantDetails(merchantId: string): Promise<MerchantDetails> {
  try {
    const details = await fetchMerchantCommerceJson<MerchantDetailsResponse>(`/merchants/${merchantId}`);
    return {
      logoUrl: details.logoUrl ?? undefined,
      delayedPaymentEnabled:
        typeof details.delayedPaymentEnabled === 'boolean'
          ? details.delayedPaymentEnabled
          : typeof details.deferredPaymentEnabled === 'boolean'
            ? details.deferredPaymentEnabled
            : Array.isArray(details.offerings)
              ? details.offerings.includes('DEFERRED_PAYMENT')
              : undefined,
    };
  } catch {
    return {};
  }
}


export function resolveMerchantBranch(
  branches: MerchantBranch[],
  userLocation?: { latitude: number; longitude: number },
): MerchantBranch | null {
  if (branches.length === 0) return null;
  if (!userLocation) return branches[0];

  const sorted = branches
    .map((branch) => ({
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
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const resolved = sorted[0];
  return {
    ...resolved.branch,
    distanceMeters: Number.isFinite(resolved.distanceMeters)
      ? resolved.distanceMeters
      : undefined,
  };
}

export async function fetchActiveProducts(
  merchantId: string,
  branchId: string,
): Promise<ActiveProduct[]> {
  const search = new URLSearchParams({ branchId });
  const response = await fetchMerchantCommerceJson<ProductResponse[]>(
    `/merchants/${merchantId}/products?${search.toString()}`,
  );
  console.log('[catalog] raw products sample:', JSON.stringify(response.slice(0, 2), null, 2));
  return response
    .filter((product) => product.productId && product.branchId && product.name && typeof product.unitPrice === 'number')
    .map((product) => {
      const { categoryId, categoryName } = resolveCategory(product);
      return {
        productId: product.productId!,
        merchantId,
        branchId: product.branchId!,
        name: product.name!,
        description: product.description,
        unitPrice: product.unitPrice!,
        imageUrl: product.imageUrl,
        active: Boolean(product.active),
        categoryId,
        categoryName,
        productCode: product.productCode,
        updatedAt: product.updatedAt,
      };
    })
    .filter((product) => product.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function revalidateBasketItems(
  merchantId: string,
  branchId: string,
  items: BasketItem[],
): Promise<{ valid: boolean; issues: CatalogValidationIssue[]; products: ActiveProduct[] }> {
  const products = await fetchActiveProducts(merchantId, branchId);
  const productMap = new Map(products.map((product) => [product.productId, product]));
  const issues: CatalogValidationIssue[] = [];

  for (const item of items) {
    const latest = productMap.get(item.productId);
    if (!latest) {
      issues.push({ productId: item.productId, type: 'missing' });
      continue;
    }
    if (!latest.active) {
      issues.push({ productId: item.productId, type: 'inactive' });
      continue;
    }
    if (latest.unitPrice !== item.unitPrice) {
      issues.push({
        productId: item.productId,
        type: 'price_changed',
        latestUnitPrice: latest.unitPrice,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    products,
  };
}
