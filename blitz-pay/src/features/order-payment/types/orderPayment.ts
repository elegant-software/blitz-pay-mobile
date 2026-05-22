import type { BasketCheckoutItemSummary } from '../../basket/types/basket';
import type { PaymentChannel as MerchantPaymentChannel } from '../../merchant-catalog/types/catalog';

export type CheckoutPaymentMethod = 'bank' | 'card' | 'paypal';
export type OrderPaymentChannel = MerchantPaymentChannel;
export type CreateOrderPaymentMethod = 'TRUELAYER' | 'STRIPE' | 'BRAINTREE';
export type OrderType = 'PRE_ORDER' | 'WALK_IN_ORDERING';
export type CheckoutIntent = 'PAY_NOW' | 'PAY_LATER';
export type PaymentSource = 'APP_PAYMENT' | 'MANUAL_SETTLEMENT';
export type OrderPriceSource = 'CATALOG' | 'MERCHANT_OVERRIDE';
export type OrderUpdateActor = 'MERCHANT' | 'SHOPPER';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_IN_PROGRESS'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface CreateOrderItemInput {
  lineId?: string;
  productId: string;
  quantity: number;
  unitPriceMinor?: number;
}

export interface CreateOrderInput {
  branchId: string;
  orderType: OrderType;
  checkoutIntent: CheckoutIntent;
  paymentMethod?: CreateOrderPaymentMethod;
  items: CreateOrderItemInput[];
}

export interface AddOrderItemInput {
  productId: string;
  quantity: number;
}

export interface UpdateOrderLineQuantityInput {
  lineId: string;
  quantity: number;
}

export interface OverrideOrderLinePriceInput {
  lineId: string;
  unitPriceMinor: number;
}

export interface ManualSettlementInput {
  note?: string;
}

export interface OrderPaymentIntentContext {
  orderId: string;
  merchantId: string;
  branchId?: string;
  productId?: string;
}

export interface OrderItemSummary {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  priceSource: OrderPriceSource;
}

export interface OrderUpdateBanner {
  actor: OrderUpdateActor;
  messageKey: 'order_updated_by_merchant' | 'order_updated_by_shopper';
  updatedAt: string;
  visibleScope: 'ORDER_DETAIL_ONLY';
}

export interface OrderSummary {
  orderId: string;
  merchantId: string;
  branchId?: string;
  merchantName?: string;
  branchName?: string;
  merchantLogoUrl?: string;
  checkoutIntent: CheckoutIntent;
  status: OrderStatus;
  paymentSource?: PaymentSource;
  currency: string;
  totalAmountMinor: number;
  items: OrderItemSummary[];
  createdAt: string;
  updatedAt: string;
  paymentRetryAllowed: boolean;
  lastPaymentRequestId?: string;
  lastPaymentProvider?: string;
  paidAt?: string;
  manualSettlementNote?: string;
  banner?: OrderUpdateBanner;
}

export interface RecentOrderSummary extends OrderSummary {
  preferredMethod?: CheckoutPaymentMethod;
}

export interface OrderPaymentSession {
  orderId: string;
  merchantId: string;
  merchantName: string;
  branchId?: string;
  branchName?: string;
  checkoutIntent: CheckoutIntent;
  availableChannels: OrderPaymentChannel[];
  amount: number;
  currency: string;
  basketSummary?: string;
  basketItemCount: number;
  basketItems: BasketCheckoutItemSummary[];
  selectedMethod?: CheckoutPaymentMethod;
  selectedChannel?: OrderPaymentChannel;
  orderStatus: OrderStatus;
  paymentSource?: PaymentSource;
  banner?: OrderUpdateBanner;
  updatedAt?: string;
  paymentRequestId?: string;
  paymentProvider?: string;
  retryPreferredMethod?: CheckoutPaymentMethod;
}

export interface ResumeOrderPaymentArgs {
  order: OrderSummary;
  merchantName: string;
  branchName?: string;
  merchantLogoUrl?: string;
  selectedMethod: CheckoutPaymentMethod;
  availableChannels: OrderPaymentChannel[];
  navigation: import('../../../types').RootStackNav;
  token: string | null;
  invoiceId?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
}

export const METHOD_TO_CHANNEL: Record<CheckoutPaymentMethod, OrderPaymentChannel> = {
  bank: 'TRUELAYER',
  card: 'STRIPE',
  paypal: 'PAYPAL',
};

export function mapMethodToChannel(method: CheckoutPaymentMethod): OrderPaymentChannel {
  return METHOD_TO_CHANNEL[method];
}

export function mapMethodToOrderPaymentMethod(method: CheckoutPaymentMethod): CreateOrderPaymentMethod {
  if (method === 'paypal') return 'BRAINTREE';
  if (method === 'card') return 'STRIPE';
  return 'TRUELAYER';
}

export function isMethodAvailable(
  method: CheckoutPaymentMethod,
  activeChannels: readonly OrderPaymentChannel[],
): boolean {
  return activeChannels.includes(mapMethodToChannel(method));
}

export function isOrderStatusTerminal(status: OrderStatus): boolean {
  return status === 'PAID' || status === 'PAYMENT_FAILED' || status === 'CANCELLED';
}

export function isOrderResumable(status: OrderStatus): boolean {
  return status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED';
}

export function isOrderEditable(status: OrderStatus): boolean {
  return status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED';
}

export function mapOrderStatusToPaymentResult(
  status: OrderStatus,
): 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' {
  if (status === 'PAID') return 'succeeded';
  if (status === 'PAYMENT_FAILED') return 'failed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'PAYMENT_IN_PROGRESS') return 'processing';
  return 'pending';
}
