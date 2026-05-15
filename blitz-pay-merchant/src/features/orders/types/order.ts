export type MerchantOrderFilter = 'ALL' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
export type MerchantOrderStatus =
  | 'awaiting_payment'
  | 'payment_in_progress'
  | 'payment_failed'
  | 'paid'
  | 'cancelled';
export type MerchantCheckoutIntent = 'PAY_NOW' | 'PAY_LATER';
export type MerchantPaymentSource = 'APP_PAYMENT' | 'MANUAL_SETTLEMENT';
export type MerchantOrderPriceSource = 'CATALOG' | 'MERCHANT_OVERRIDE';
export type MerchantOrderUpdateActor = 'MERCHANT' | 'SHOPPER';

export interface MerchantOrderItem {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  priceSource: MerchantOrderPriceSource;
}

export interface MerchantOrderSummary {
  orderId: string;
  merchantId: string;
  branchId?: string;
  customerName?: string;
  amountMinor: number;
  currency: string;
  status: MerchantOrderStatus;
  checkoutIntent: MerchantCheckoutIntent;
  paymentSource?: MerchantPaymentSource;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantOrderDetail extends MerchantOrderSummary {
  items: MerchantOrderItem[];
  paymentRetryAllowed: boolean;
  manualSettlementNote?: string;
  banner?: {
    actor: MerchantOrderUpdateActor;
    messageKey: 'merchant_order_updated_by_customer' | 'merchant_order_updated_by_merchant';
    updatedAt: string;
  };
}

export interface MerchantAddOrderItemInput {
  productId: string;
  quantity: number;
}

export interface MerchantUpdateOrderLineQuantityInput {
  lineId: string;
  quantity: number;
}

export interface MerchantOverrideOrderLinePriceInput {
  lineId: string;
  unitPriceMinor: number;
}

export interface MerchantManualSettlementInput {
  note?: string;
}
