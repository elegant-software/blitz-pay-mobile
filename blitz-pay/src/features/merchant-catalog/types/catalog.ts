export type PaymentChannel = 'PAYPAL' | 'STRIPE' | 'TRUELAYER' | 'PAY_BY_BANK' | 'TAP_TO_PAY';

export interface MerchantBranch {
  branchId: string;
  merchantId: string;
  name: string;
  active: boolean;
  addressSummary?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  activePaymentChannels: PaymentChannel[];
  delayedPaymentEnabled?: boolean;
  imageUrl?: string;
}

export interface ActiveProduct {
  productId: string;
  merchantId: string;
  branchId: string;
  name: string;
  description?: string;
  unitPrice: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  active: boolean;
  categoryId?: string;
  categoryName?: string;
  productCode?: number;
  updatedAt?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  productCount: number;
}

export interface BranchCatalogCategories {
  categories: CatalogCategory[];
  uncategorizedCount: number;
  totalCount: number;
}

export interface CatalogProductPage {
  items: ActiveProduct[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export type CatalogProductFilter = { categoryId?: string; uncategorized?: boolean; cursor?: string };

export interface CatalogValidationIssue {
  productId: string;
  type: 'missing' | 'inactive' | 'price_changed';
  latestUnitPrice?: number;
}
export const UNCATEGORIZED_CATEGORY = 'uncategorized';
