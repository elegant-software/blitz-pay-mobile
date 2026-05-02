import type { BasketCheckoutItemSummary } from '../../basket/types/basket';
import type { PaymentChannel as MerchantPaymentChannel } from '../../merchant-catalog/types/catalog';

export type CheckoutPaymentMethod = 'bank' | 'card' | 'paypal';
export type OrderPaymentChannel = MerchantPaymentChannel;
export type CreateOrderPaymentMethod = 'TRUELAYER' | 'STRIPE' | 'BRAINTREE';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_IN_PROGRESS'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  paymentMethod: CreateOrderPaymentMethod;
  items: CreateOrderItemInput[];
}

export interface OrderPaymentIntentContext {
  orderId: string;
  merchantId: string;
  branchId?: string;
  productId?: string;
}

export interface OrderItemSummary {
  productId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface OrderSummary {
  orderId: string;
  merchantId: string;
  branchId?: string;
  status: OrderStatus;
  currency: string;
  totalAmountMinor: number;
  items: OrderItemSummary[];
  createdAt: string;
  lastPaymentRequestId?: string;
  lastPaymentProvider?: string;
  paidAt?: string;
}

export interface RecentOrderSummary extends OrderSummary {
  merchantName?: string;
  branchName?: string;
  merchantLogoUrl?: string;
}

export interface OrderPaymentSession {
  orderId: string;
  merchantId: string;
  merchantName: string;
  branchId?: string;
  branchName?: string;
  amount: number;
  currency: string;
  basketSummary?: string;
  basketItemCount: number;
  basketItems: BasketCheckoutItemSummary[];
  selectedMethod: CheckoutPaymentMethod;
  selectedChannel: OrderPaymentChannel;
  orderStatus: OrderStatus;
  paymentRequestId?: string;
  paymentProvider?: string;
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

export function mapOrderStatusToPaymentResult(
  status: OrderStatus,
): 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' {
  if (status === 'PAID') return 'succeeded';
  if (status === 'PAYMENT_FAILED') return 'failed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'PAYMENT_IN_PROGRESS') return 'processing';
  return 'pending';
}
