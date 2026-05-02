import { authedFetch } from '../../../lib/api/authedFetch';
import { config } from '../../../lib/config';
import { observability } from '../../../lib/observability';
import type { StripeParams } from '../../../services/stripe';
import type { BraintreeCheckoutRequest, BraintreeCheckoutResponse } from '../../../types/braintree';
import type {
  CreateOrderInput,
  OrderPaymentIntentContext,
  RecentOrderSummary,
  OrderStatus,
  OrderSummary,
} from '../types/orderPayment';

interface RawOrderItemResponse {
  productId?: string;
  name?: string;
  quantity?: number;
  unitPriceMinor?: number;
  lineTotalMinor?: number;
}

interface RawOrderResponse {
  orderId?: string;
  merchantId?: string;
  merchantName?: string;
  branchId?: string | null;
  branchName?: string | null;
  merchantLogoUrl?: string | null;
  status?: string;
  currency?: string;
  totalAmountMinor?: number;
  items?: RawOrderItemResponse[];
  createdAt?: string;
  lastPaymentRequestId?: string | null;
  lastPaymentProvider?: string | null;
  paidAt?: string | null;
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
    status === 'PAYMENT_IN_PROGRESS' ||
    status === 'PAYMENT_INITIATED' ||
    status === 'PAID' ||
    status === 'PAYMENT_FAILED' ||
    status === 'FAILED' ||
    status === 'CANCELLED'
  ) {
    if (status === 'CREATED') return 'PENDING_PAYMENT';
    if (status === 'PAYMENT_INITIATED') return 'PAYMENT_IN_PROGRESS';
    if (status === 'FAILED') return 'PAYMENT_FAILED';
    return status;
  }
  return 'PENDING_PAYMENT';
}

function parseOrder(payload: RawOrderResponse): OrderSummary {
  if (!payload.orderId || !payload.merchantId || !payload.currency) {
    throw new Error('order_invalid_response');
  }

  return {
    orderId: payload.orderId,
    merchantId: payload.merchantId,
    branchId: payload.branchId ?? undefined,
    status: normalizeOrderStatus(payload.status),
    currency: payload.currency,
    totalAmountMinor: payload.totalAmountMinor ?? 0,
    items: (payload.items ?? []).map((item) => ({
      productId: item.productId ?? '',
      name: item.name ?? '',
      quantity: item.quantity ?? 0,
      unitPriceMinor: item.unitPriceMinor ?? 0,
      lineTotalMinor: item.lineTotalMinor ?? 0,
    })),
    createdAt: payload.createdAt ?? new Date().toISOString(),
    lastPaymentRequestId: payload.lastPaymentRequestId ?? undefined,
    lastPaymentProvider: payload.lastPaymentProvider ?? undefined,
    paidAt: payload.paidAt ?? undefined,
  };
}

function parseRecentOrder(payload: RawOrderResponse): RecentOrderSummary {
  const order = parseOrder(payload);
  return {
    ...order,
    merchantName: payload.merchantName ?? undefined,
    branchName: payload.branchName ?? undefined,
    merchantLogoUrl: payload.merchantLogoUrl ?? undefined,
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

export async function createOrder(input: CreateOrderInput): Promise<OrderSummary> {
  observability.info('order_create_started', {
    paymentMethod: input.paymentMethod,
    itemCount: input.items.length,
  });

  const response = await authedFetch('/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      paymentMethod: input.paymentMethod,
    }),
  });

  if (!response.ok) {
    const message = await readError(response);
    observability.warn('order_create_failed', {
      paymentMethod: input.paymentMethod,
      status: response.status,
      message,
    });
    throw new Error(response.status === 409 ? 'order_not_payable' : message);
  }

  const payload = (await response.json()) as RawOrderResponse;
  const order = parseOrder(payload);

  observability.info('order_create_succeeded', {
    orderId: order.orderId,
    merchantId: order.merchantId,
    branchId: order.branchId ?? null,
    status: order.status,
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
  observability.info('recent_orders_fetch_payload', {
    shape: Array.isArray(payload) ? 'array' : 'object',
    rowCount: rows.length,
    sampleOrderIds: rows.slice(0, 5).map((row) => row.orderId ?? 'missing').join(','),
    sampleStatuses: rows.slice(0, 5).map((row) => String(row.status ?? 'missing')).join(','),
    sampleCreatedAt: rows.slice(0, 3).map((row) => row.createdAt ?? 'missing').join(','),
  });
  const orders = rows
    .map(parseRecentOrder)
    .filter((order) => new Date(order.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  observability.info('recent_orders_fetch_succeeded', {
    count: orders.length,
    filteredOut: Math.max(0, rows.length - orders.length),
  });
  return orders;
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
  });

  return {
    paymentRequestId,
    clientSecret,
    ephemeralKey: typeof data.ephemeralKey === 'string' ? data.ephemeralKey : '',
    customer: typeof data.customer === 'string' ? data.customer : '',
    publishableKey: data.publishableKey,
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
