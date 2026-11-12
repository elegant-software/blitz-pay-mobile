import type { BasketCheckoutItemSummary } from '../../basket/types/basket';
import type { PaymentChannel as MerchantPaymentChannel } from '../../merchant-catalog/types/catalog';

export type CheckoutPaymentMethod = 'bank' | 'card' | 'paypal' | 'pay_by_bank' | 'tap_to_pay';
export type OrderPaymentChannel = MerchantPaymentChannel;
export type CreateOrderPaymentMethod = 'TRUELAYER' | 'STRIPE' | 'BRAINTREE';
export type BackendCheckoutPaymentMethod = 'BANK_ACCOUNT' | 'CARD' | 'PAY_BY_BANK' | 'TERMINAL' | 'PAYPAL' | 'CASH';
export type OrderType = 'PRE_ORDER' | 'WALK_IN_ORDERING';
/** How a Walk-In or Pre-Order is consumed; independent of the Table (ADR-0025). Fixed at placement. */
export type FulfilmentType = 'DINE_IN' | 'TAKE_AWAY';
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
/** Kitchen-side progress of an order, independent of payment status. */
export type PreparationStatus = 'RECEIVED' | 'PREPARING' | 'READY';

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
  checkoutPaymentMethod?: BackendCheckoutPaymentMethod;
  items: CreateOrderItemInput[];
  /** Table check-in: requires orderType WALK_IN_ORDERING and a customerLocation. */
  tableCode?: string;
  /** People at the Table; the backend applies it only when the Table has no Guest Count yet. */
  guestCount?: number;
  /** Always sent explicitly by the app; the backend defaults it (Table -> DINE_IN, else TAKE_AWAY) when omitted. */
  fulfilmentType?: FulfilmentType;
  customerLocation?: CustomerLocationInput;
}

export interface CustomerLocationInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
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
  paymentMethodType?: string;
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
  checkoutPaymentMethod?: BackendCheckoutPaymentMethod;
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
  /** If set, this is an invoice order sent by a merchant to this shopper. */
  targetShopperId?: string;
  /** ISO date (e.g. "2026-07-01") — display-only due date for invoice orders. */
  dueDate?: string;
  /** True when the order uses deferred payment (PAY_LATER / invoice order). */
  usesDeferredPayment?: boolean;
  preparationStatus?: PreparationStatus;
  /** Number staff call out at pickup. Null for legacy orders and orders without a Branch. */
  pickupNumber?: number | null;
  /** Null for legacy orders and orders without one (Appointment, Invoice). */
  fulfilmentType?: FulfilmentType | null;
  /** Present only if the backend reports the order's Table; otherwise see OrderPaymentSession.hasTable. */
  tableCode?: string | null;
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
  checkoutPaymentMethod?: BackendCheckoutPaymentMethod;
  selectedChannel?: OrderPaymentChannel;
  orderStatus: OrderStatus;
  paymentSource?: PaymentSource;
  banner?: OrderUpdateBanner;
  updatedAt?: string;
  paymentRequestId?: string;
  paymentProvider?: string;
  retryPreferredMethod?: CheckoutPaymentMethod;
  /** The order was placed at a Table. */
  hasTable?: boolean;
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
  pay_by_bank: 'PAY_BY_BANK',
  tap_to_pay: 'TAP_TO_PAY',
};

export function mapMethodToChannel(method: CheckoutPaymentMethod): OrderPaymentChannel {
  return METHOD_TO_CHANNEL[method];
}

export function mapMethodToOrderPaymentMethod(method: CheckoutPaymentMethod): CreateOrderPaymentMethod {
  if (method === 'paypal') return 'BRAINTREE';
  if (method === 'card' || method === 'pay_by_bank' || method === 'tap_to_pay') return 'STRIPE';
  return 'TRUELAYER';
}

export function mapMethodToBackendCheckoutPaymentMethod(method: CheckoutPaymentMethod): BackendCheckoutPaymentMethod {
  if (method === 'bank') return 'BANK_ACCOUNT';
  if (method === 'card') return 'CARD';
  if (method === 'pay_by_bank') return 'PAY_BY_BANK';
  if (method === 'tap_to_pay') return 'TERMINAL';
  return 'PAYPAL';
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

/** Table gives DINE_IN, no Table gives TAKE_AWAY (mirrors the backend default). */
export function defaultFulfilmentType(hasTable: boolean): FulfilmentType {
  return hasTable ? 'DINE_IN' : 'TAKE_AWAY';
}

/** Translation key for the in-app 'ready' wording: DINE_IN with a Table is brought over, everything else is collected. */
export function readyPickupMessageKey(
  fulfilmentType: FulfilmentType | null | undefined,
  hasTable: boolean,
): 'order_ready_to_table' | 'order_ready_at_counter' {
  return fulfilmentType === 'DINE_IN' && hasTable ? 'order_ready_to_table' : 'order_ready_at_counter';
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

/** "#042": the Pickup Number as staff call it out (matches the backend push text). */
export function formatPickupNumber(pickupNumber: number): string {
  return `#${String(pickupNumber).padStart(3, '0')}`;
}
