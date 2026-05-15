export type PaymentChannel = 'PAYPAL' | 'STRIPE' | 'TRUELAYER';

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
  active: boolean;
  categoryId?: string;
  categoryName?: string;
  productCode?: number;
  updatedAt?: string;
}

export interface CatalogValidationIssue {
  productId: string;
  type: 'missing' | 'inactive' | 'price_changed';
  latestUnitPrice?: number;
}
