export type MerchantOrderFilter = 'ALL' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
export type MerchantOrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export interface MerchantOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface MerchantOrderSummary {
  orderId: string;
  orderNumber: string;
  merchantId: string;
  branchId?: string;
  customerName?: string;
  amountMinor: number;
  currency: string;
  status: MerchantOrderStatus;
  createdAt: string;
}

export interface MerchantOrderDetail extends MerchantOrderSummary {
  items: MerchantOrderItem[];
}
