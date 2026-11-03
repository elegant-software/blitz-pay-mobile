export type MerchantOrderFilter = 'ALL' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
export type MerchantOrderStatus =
  | 'awaiting_payment'
  | 'payment_in_progress'
  | 'payment_failed'
  | 'paid'
  | 'cancelled';
export type MerchantCheckoutIntent = 'PAY_NOW' | 'PAY_LATER';
export type MerchantPaymentSource = 'APP_PAYMENT' | 'MANUAL_SETTLEMENT';
export type MerchantCheckoutPaymentMethod = 'BANK_ACCOUNT' | 'CARD' | 'PAY_BY_BANK' | 'TERMINAL' | 'PAYPAL';
export type MerchantPaymentProvider =
  | 'STRIPE'
  | 'STRIPE_TERMINAL'
  | 'STRIPE_PAY_BY_BANK'
  | 'TERMINAL'
  | 'TRUELAYER'
  | 'BRAINTREE'
  | 'QRPAY';
export type MerchantOrderPriceSource = 'CATALOG' | 'MERCHANT_OVERRIDE';
export type MerchantOrderUpdateActor = 'MERCHANT' | 'SHOPPER';
export type MerchantPreparationStatus = 'RECEIVED' | 'PREPARING' | 'READY';

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
  amountMinor: number;
  currency: string;
  status: MerchantOrderStatus;
  checkoutIntent: MerchantCheckoutIntent;
  paymentSource?: MerchantPaymentSource;
  checkoutPaymentMethod?: MerchantCheckoutPaymentMethod;
  paymentProvider?: MerchantPaymentProvider;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  preparationStatus?: MerchantPreparationStatus;
  /** Null for legacy orders and orders without a Branch; hide it then. */
  pickupNumber: number | null;
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

export interface BranchCustomer {
  shopperAccountId: string;
  name: string;
}
