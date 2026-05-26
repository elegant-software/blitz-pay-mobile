import { authedFetch } from '../../../lib/api/authedFetch';
import { config } from '../../../lib/config';
import { observability } from '../../../lib/observability';
import type { StripeParams } from '../../../services/stripe';
import type { BraintreeCheckoutRequest, BraintreeCheckoutResponse } from '../../../types/braintree';
import type {
  AddOrderItemInput,
  CreateOrderInput,
  ManualSettlementInput,
  OrderPaymentIntentContext,
  OrderStatus,
  OrderSummary,
  OverrideOrderLinePriceInput,
  RecentOrderSummary,
  UpdateOrderLineQuantityInput,
} from '../types/orderPayment';

interface RawOrderItemResponse {
  lineId?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  unitPriceMinor?: number;
  lineTotalMinor?: number;
  priceSource?: string | null;
}

interface RawOrderResponse {
  orderId?: string;
  merchantId?: string;
  merchantName?: string;
  branchId?: string | null;
  branchName?: string | null;
  merchantLogoUrl?: string | null;
  status?: string;
  checkoutIntent?: string | null;
  paymentSource?: string | null;
  currency?: string;
  totalAmountMinor?: number;
  items?: RawOrderItemResponse[];
  createdAt?: string;
  updatedAt?: string;
  paymentRetryAllowed?: boolean | null;
  lastPaymentRequestId?: string | null;
  lastPaymentProvider?: string | null;
  paidAt?: string | null;
  manualSettlementNote?: string | null;
  lastUpdatedBy?: string | null;
  orderNumber?: string;
}

interface RawOrderListResponse {
  orders?: RawOrderResponse[];
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

function normalizeOrderStatus(status: unknown): OrderStatus {
  if (
    status === 'PENDING_PAYMENT' ||
    status === 'CREATED' ||
    status === 'AWAITING_PAYMENT' ||
    status === 'PAYMENT_IN_PROGRESS' ||
    status === 'PAYMENT_INITIATED' ||
    status === 'PAID' ||
    status === 'PAYMENT_FAILED' ||
    status === 'FAILED' ||
    status === 'CANCELLED'
  ) {
    if (status === 'CREATED' || status === 'AWAITING_PAYMENT') return 'PENDING_PAYMENT';
    if (status === 'PAYMENT_INITIATED') return 'PAYMENT_IN_PROGRESS';
    if (status === 'FAILED') return 'PAYMENT_FAILED';
    return status;
  }
  return 'PENDING_PAYMENT';
}

function normalizeCheckoutIntent(intent: unknown): 'PAY_NOW' | 'PAY_LATER' {
  return intent === 'PAY_LATER' ? 'PAY_LATER' : 'PAY_NOW';
}

function normalizePaymentSource(source: unknown): 'APP_PAYMENT' | 'MANUAL_SETTLEMENT' | undefined {
  if (source === 'MANUAL_SETTLEMENT') return 'MANUAL_SETTLEMENT';
  if (source === 'APP_PAYMENT') return 'APP_PAYMENT';
  return undefined;
}

function normalizePriceSource(source: unknown): 'CATALOG' | 'MERCHANT_OVERRIDE' {
  return source === 'MERCHANT_OVERRIDE' ? 'MERCHANT_OVERRIDE' : 'CATALOG';
}

function normalizeBanner(raw: RawOrderResponse): OrderSummary['banner'] {
  if (raw.lastUpdatedBy === 'MERCHANT') {
    return {
      actor: 'MERCHANT',
      messageKey: 'order_updated_by_merchant',
      updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
      visibleScope: 'ORDER_DETAIL_ONLY',
    };
  }
  if (raw.lastUpdatedBy === 'SHOPPER' || raw.lastUpdatedBy === 'CUSTOMER') {
    return {
      actor: 'SHOPPER',
      messageKey: 'order_updated_by_shopper',
      updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
      visibleScope: 'ORDER_DETAIL_ONLY',
    };
  }
  return undefined;
}

function parseOrder(payload: RawOrderResponse): OrderSummary {
  if (!payload.orderId || !payload.merchantId || !payload.currency) {
    throw new Error('order_invalid_response');
  }

  const status = normalizeOrderStatus(payload.status);
  return {
    orderId: payload.orderId,
    merchantId: payload.merchantId,
    merchantName: payload.merchantName ?? undefined,
    branchId: payload.branchId ?? undefined,
    branchName: payload.branchName ?? undefined,
    merchantLogoUrl: payload.merchantLogoUrl ?? undefined,
    checkoutIntent: normalizeCheckoutIntent(payload.checkoutIntent),
    status,
    paymentSource: normalizePaymentSource(payload.paymentSource),
    currency: payload.currency,
    totalAmountMinor: payload.totalAmountMinor ?? 0,
    items: (payload.items ?? []).map((item, index) => ({
      lineId: item.lineId ?? `${payload.orderId}-${item.productId ?? 'line'}-${index}`,
      productId: item.productId ?? '',
      name: item.name ?? '',
      quantity: item.quantity ?? 0,
      unitPriceMinor: item.unitPriceMinor ?? 0,
      lineTotalMinor: item.lineTotalMinor ?? 0,
      priceSource: normalizePriceSource(item.priceSource),
    })),
    createdAt: payload.createdAt ?? new Date().toISOString(),
    updatedAt: payload.updatedAt ?? payload.createdAt ?? new Date().toISOString(),
    paymentRetryAllowed:
      typeof payload.paymentRetryAllowed === 'boolean'
        ? payload.paymentRetryAllowed
        : status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED',
    lastPaymentRequestId: payload.lastPaymentRequestId ?? undefined,
    lastPaymentProvider: payload.lastPaymentProvider ?? undefined,
    paidAt: payload.paidAt ?? undefined,
    manualSettlementNote: payload.manualSettlementNote ?? undefined,
    banner: normalizeBanner(payload),
  };
}

function parseRecentOrder(payload: RawOrderResponse): RecentOrderSummary {
  return {
    ...parseOrder(payload),
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload;
    if (payload.error) return payload.error;
    if (payload.message) return payload.message;
  } catch {
    // ignore
  }

  try {
    const text = await response.text();
    if (text.trim()) return text.slice(0, 400);
  } catch {
    // ignore
  }

  return `HTTP ${response.status}`;
}

async function mutateOrder(
  orderId: string,
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: object,
): Promise<OrderSummary> {
  const response = await authedFetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as RawOrderResponse;
  const order = parseOrder(payload);
  observability.info('order_mutation_succeeded', {
    orderId,
    path,
    status: order.status,
    itemCount: order.items.length,
  });
  return order;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderSummary> {
  const requestBody = {
    branchId: input.branchId,
    orderType: input.orderType,
    usesDeferredPayment: input.checkoutIntent === 'PAY_LATER',
    items: input.items.map((item) => ({
      lineId: item.lineId,
      productId: item.productId,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
    })),
    paymentMethod: input.paymentMethod,
  };

  observability.info('order_create_started', {
    checkoutIntent: input.checkoutIntent,
    branchId: input.branchId,
    orderType: input.orderType,
    paymentMethod: input.paymentMethod ?? null,
    itemCount: input.items.length,
  });
  observability.info('order_create_request_payload', {
    checkoutIntent: input.checkoutIntent,
    branchId: requestBody.branchId,
    orderType: requestBody.orderType,
    usesDeferredPayment: requestBody.usesDeferredPayment,
    paymentMethod: requestBody.paymentMethod ?? null,
    itemCount: requestBody.items.length,
    itemsJson: JSON.stringify(
      requestBody.items.map((item) => ({
        lineId: item.lineId ?? null,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor ?? null,
      })),
    ),
  });

  const response = await authedFetch('/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const message = await readError(response);
    observability.error('order_create_response_failed', {
      checkoutIntent: input.checkoutIntent,
      paymentMethod: input.paymentMethod ?? null,
      status: response.status,
      message,
      usesDeferredPayment: requestBody.usesDeferredPayment,
      itemCount: requestBody.items.length,
      requestBodyJson: JSON.stringify(requestBody),
    });
    observability.warn('order_create_failed', {
      checkoutIntent: input.checkoutIntent,
      paymentMethod: input.paymentMethod ?? null,
      status: response.status,
      message,
    });
    throw new Error(response.status === 409 ? 'order_not_payable' : message);
  }

  const payload = (await response.json()) as RawOrderResponse;
  observability.info('order_create_response_payload', {
    orderId: payload.orderId ?? null,
    merchantId: payload.merchantId ?? null,
    branchId: payload.branchId ?? null,
    status: payload.status ?? null,
    checkoutIntent: payload.checkoutIntent ?? null,
    paymentSource: payload.paymentSource ?? null,
    hasPaymentRequestId: Boolean(payload.lastPaymentRequestId),
    itemCount: payload.items?.length ?? 0,
  });
  const order = parseOrder(payload);

  observability.info('order_create_succeeded', {
    orderId: order.orderId,
    merchantId: order.merchantId,
    branchId: order.branchId ?? null,
    status: order.status,
    checkoutIntent: order.checkoutIntent,
    lastPaymentRequestId: order.lastPaymentRequestId ?? null,
  });

  return order;
}

export async function fetchOrder(orderId: string): Promise<OrderSummary> {
  observability.info('order_fetch_started', { orderId });
  const response = await authedFetch(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const message = await readError(response);
    observability.warn('order_fetch_failed', { orderId, status: response.status, message });
    throw new Error(message);
  }

  const payload = (await response.json()) as RawOrderResponse;
  const order = parseOrder(payload);
  observability.info('order_fetch_succeeded', {
    orderId: order.orderId,
    status: order.status,
    checkoutIntent: order.checkoutIntent,
    paymentSource: order.paymentSource ?? null,
    lastPaymentRequestId: order.lastPaymentRequestId ?? null,
  });
  return order;
}

export async function fetchRecentOrders(): Promise<RecentOrderSummary[]> {
  observability.info('recent_orders_fetch_started');
  observability.info('recent_orders_fetch_request', {
    method: 'GET',
    apiBaseUrl: config.apiUrl,
    path: '/v1/orders',
    accept: 'application/json',
    authExpected: true,
  });
  const response = await authedFetch('/v1/orders', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const message = await readError(response);
    observability.warn('recent_orders_fetch_failed', { status: response.status, message });
    throw new Error(message);
  }

  const payload = (await response.json()) as RawOrderListResponse | RawOrderResponse[];
  const rows = Array.isArray(payload) ? payload : payload.orders ?? [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const orders = rows
    .map(parseRecentOrder)
    .filter((order) => new Date(order.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  observability.info('recent_orders_fetch_succeeded', {
    count: orders.length,
    filteredOut: Math.max(0, rows.length - orders.length),
  });
  return orders;
}

export async function addOrderItem(orderId: string, input: AddOrderItemInput): Promise<OrderSummary> {
  observability.info('order_add_item_started', { orderId, productId: input.productId, quantity: input.quantity });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/items`, 'POST', input);
}

export async function updateOrderLineQuantity(
  orderId: string,
  input: UpdateOrderLineQuantityInput,
): Promise<OrderSummary> {
  observability.info('order_update_line_quantity_started', { orderId, lineId: input.lineId, quantity: input.quantity });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(input.lineId)}`, 'PATCH', {
    quantity: input.quantity,
  });
}

export async function removeOrderLine(orderId: string, lineId: string): Promise<OrderSummary> {
  observability.info('order_remove_line_started', { orderId, lineId });
  return mutateOrder(
    orderId,
    `/v1/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(lineId)}`,
    'DELETE',
  );
}

export async function cancelOrder(orderId: string): Promise<OrderSummary> {
  observability.info('order_cancel_started', { orderId });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/cancel`, 'POST');
}

export async function overrideOrderLinePrice(
  orderId: string,
  input: OverrideOrderLinePriceInput,
): Promise<OrderSummary> {
  observability.info('order_override_price_started', {
    orderId,
    lineId: input.lineId,
    unitPriceMinor: input.unitPriceMinor,
  });
  return mutateOrder(
    orderId,
    `/v1/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(input.lineId)}/price`,
    'POST',
    {
      unitPriceMinor: input.unitPriceMinor,
    },
  );
}

export async function markOrderManuallyPaid(
  orderId: string,
  input: ManualSettlementInput,
): Promise<OrderSummary> {
  observability.info('order_manual_settlement_started', { orderId, hasNote: Boolean(input.note?.trim()) });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/manual-settlement`, 'POST', {
    note: input.note?.trim() || undefined,
  });
}

export async function createStripeIntentForOrder(
  context: OrderPaymentIntentContext,
): Promise<StripeParams> {
  observability.info('stripe_create_intent_started', {
    orderId: context.orderId,
    merchantId: context.merchantId,
    branchId: context.branchId ?? null,
  });
  const response = await authedFetch('/v1/payments/stripe/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      orderId: context.orderId,
      merchantId: context.merchantId,
      branchId: context.branchId,
      productId: context.productId,
    }),
  });

  if (!response.ok) {
    const message = await readError(response);
    observability.warn('stripe_create_intent_failed', {
      orderId: context.orderId,
      status: response.status,
      message,
    });
    throw new Error(message);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const paymentRequestId = typeof data.paymentRequestId === 'string' ? data.paymentRequestId : undefined;
  const clientSecret =
    typeof data.clientSecret === 'string'
      ? data.clientSecret
      : typeof data.paymentIntent === 'string'
        ? data.paymentIntent
        : undefined;
  const connectedAccountId =
    typeof data.connectedAccountId === 'string' ? data.connectedAccountId :
    typeof data.stripeAccountId === 'string' ? data.stripeAccountId :
    undefined;

  if (!paymentRequestId || !clientSecret || typeof data.publishableKey !== 'string') {
    observability.error('stripe_create_intent_invalid_response', {
      orderId: context.orderId,
      hasPaymentRequestId: Boolean(paymentRequestId),
      hasClientSecret: Boolean(clientSecret),
      hasPublishableKey: typeof data.publishableKey === 'string',
    });
    throw new Error('stripe_invalid_response');
  }

  observability.info('stripe_create_intent_succeeded', {
    orderId: context.orderId,
    paymentRequestId,
    hasEphemeralKey: typeof data.ephemeralKey === 'string',
    hasCustomer: typeof data.customer === 'string',
    hasConnectedAccountId: Boolean(connectedAccountId),
  });

  return {
    paymentRequestId,
    clientSecret,
    ephemeralKey: typeof data.ephemeralKey === 'string' ? data.ephemeralKey : '',
    customer: typeof data.customer === 'string' ? data.customer : '',
    publishableKey: data.publishableKey,
    connectedAccountId,
  };
}

export async function submitBraintreeOrderNonce(
  request: BraintreeCheckoutRequest,
): Promise<BraintreeCheckoutResponse> {
  const response = await authedFetch('/v1/payments/braintree/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as BraintreeCheckoutResponse;
}
