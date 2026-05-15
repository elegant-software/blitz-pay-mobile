import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';
import type { ActiveBranchScope } from '../../../lib/auth';
import type {
  MerchantAddOrderItemInput,
  MerchantManualSettlementInput,
  MerchantOrderDetail,
  MerchantOrderItem,
  MerchantOrderStatus,
  MerchantOrderSummary,
  MerchantOverrideOrderLinePriceInput,
  MerchantUpdateOrderLineQuantityInput,
} from '../types/order';

interface RawOrderItem {
  lineId?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  unitPriceMinor?: number;
  lineTotalMinor?: number;
  priceSource?: string | null;
}

interface RawOrder {
  orderId?: string;
  merchantId?: string;
  branchId?: string | null;
  customerDisplayName?: string | null;
  customerName?: string | null;
  totalAmountMinor?: number;
  currency?: string;
  status?: string;
  checkoutIntent?: string | null;
  paymentSource?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: RawOrderItem[];
  paymentRetryAllowed?: boolean | null;
  manualSettlementNote?: string | null;
  lastUpdatedBy?: string | null;
}

function mapStatus(status: unknown): MerchantOrderStatus {
  if (status === 'PAID') return 'paid';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'PAYMENT_INITIATED' || status === 'PAYMENT_IN_PROGRESS') return 'payment_in_progress';
  if (status === 'FAILED' || status === 'PAYMENT_FAILED') return 'payment_failed';
  return 'awaiting_payment';
}

function mapCheckoutIntent(intent: unknown): 'PAY_NOW' | 'PAY_LATER' {
  return intent === 'PAY_LATER' ? 'PAY_LATER' : 'PAY_NOW';
}

function mapPaymentSource(source: unknown): 'APP_PAYMENT' | 'MANUAL_SETTLEMENT' | undefined {
  if (source === 'MANUAL_SETTLEMENT') return 'MANUAL_SETTLEMENT';
  if (source === 'APP_PAYMENT') return 'APP_PAYMENT';
  return undefined;
}

function parseItems(items: RawOrderItem[] | undefined, orderId: string): MerchantOrderItem[] {
  return (items ?? []).map((item, index) => ({
    lineId: item.lineId ?? `${orderId}-${item.productId ?? 'line'}-${index}`,
    productId: item.productId ?? '',
    name: item.name ?? '',
    quantity: item.quantity ?? 0,
    unitPriceMinor: item.unitPriceMinor ?? 0,
    lineTotalMinor: item.lineTotalMinor ?? 0,
    priceSource: item.priceSource === 'MERCHANT_OVERRIDE' ? 'MERCHANT_OVERRIDE' : 'CATALOG',
  }));
}

function parseSummary(raw: RawOrder): MerchantOrderSummary {
  if (!raw.orderId || !raw.merchantId || !raw.currency || !raw.createdAt) {
    throw new Error('merchant_orders_invalid_response');
  }

  return {
    orderId: raw.orderId,
    merchantId: raw.merchantId,
    branchId: raw.branchId ?? undefined,
    customerName: raw.customerDisplayName ?? raw.customerName ?? undefined,
    amountMinor: raw.totalAmountMinor ?? 0,
    currency: raw.currency,
    status: mapStatus(raw.status),
    checkoutIntent: mapCheckoutIntent(raw.checkoutIntent),
    paymentSource: mapPaymentSource(raw.paymentSource),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt ?? raw.createdAt,
  };
}

function parseDetail(raw: RawOrder): MerchantOrderDetail {
  const summary = parseSummary(raw);
  return {
    ...summary,
    items: parseItems(raw.items, summary.orderId),
    paymentRetryAllowed:
      typeof raw.paymentRetryAllowed === 'boolean'
        ? raw.paymentRetryAllowed
        : summary.status === 'awaiting_payment' || summary.status === 'payment_failed',
    manualSettlementNote: raw.manualSettlementNote ?? undefined,
    banner:
      raw.lastUpdatedBy === 'SHOPPER' || raw.lastUpdatedBy === 'CUSTOMER'
        ? {
            actor: 'SHOPPER',
            messageKey: 'merchant_order_updated_by_customer',
            updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
          }
        : raw.lastUpdatedBy === 'MERCHANT'
          ? {
              actor: 'MERCHANT',
              messageKey: 'merchant_order_updated_by_merchant',
              updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
            }
          : undefined,
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim() ? text.slice(0, 500) : `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function mutateOrder(
  orderId: string,
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: object,
): Promise<MerchantOrderDetail> {
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

  const payload = (await response.json()) as RawOrder;
  const order = parseDetail(payload);
  observability.info('merchant_order_mutation_succeeded', {
    orderId,
    path,
    status: order.status,
    itemCount: order.items.length,
  });
  return order;
}

export async function fetchMerchantOrders(branchId: string): Promise<MerchantOrderSummary[]> {
  observability.info('merchant_orders_request_started', { branchId });
  const params = new URLSearchParams({ branchId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  const response = await authedFetch(`/v1/merchant/orders?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_orders_request_failed', { branchId, status: response.status, reason });
    throw new Error('merchant_orders_load_failed');
  }

  const rows = (await response.json()) as RawOrder[];
  const orders = rows
    .map(parseSummary)
    .filter((order) => {
      if (order.branchId && order.branchId !== branchId) {
        observability.warn('merchant_orders_branch_scope_mismatch', {
          expectedBranchId: branchId,
          actualBranchId: order.branchId,
          orderId: order.orderId,
        });
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  observability.info('merchant_orders_request_succeeded', {
    branchId,
    count: orders.length,
    awaitingPaymentCount: orders.filter((order) => order.status === 'awaiting_payment').length,
    paymentFailedCount: orders.filter((order) => order.status === 'payment_failed').length,
  });
  return orders;
}

export async function fetchMerchantOrderDetail(orderId: string, activeBranchScope: ActiveBranchScope): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_detail_started', {
    orderId,
    merchantId: activeBranchScope.merchantId,
    branchId: activeBranchScope.branchId,
  });
  const response = await authedFetch(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_order_detail_failed', {
      orderId,
      merchantId: activeBranchScope.merchantId,
      branchId: activeBranchScope.branchId,
      status: response.status,
      reason,
    });
    throw new Error('merchant_order_detail_load_failed');
  }

  const payload = (await response.json()) as RawOrder;
  const order = parseDetail(payload);
  if (
    order.merchantId !== activeBranchScope.merchantId ||
    (order.branchId != null && order.branchId !== activeBranchScope.branchId)
  ) {
    observability.warn('merchant_order_detail_access_denied', {
      orderId: order.orderId,
      expectedMerchantId: activeBranchScope.merchantId,
      expectedBranchId: activeBranchScope.branchId,
      actualMerchantId: order.merchantId,
      actualBranchId: order.branchId ?? null,
    });
    throw new Error('merchant_branch_access_denied');
  }

  observability.info('merchant_order_detail_succeeded', {
    orderId: order.orderId,
    status: order.status,
    checkoutIntent: order.checkoutIntent,
    paymentSource: order.paymentSource ?? null,
    branchId: activeBranchScope.branchId,
  });
  return order;
}

export async function addMerchantOrderItem(orderId: string, input: MerchantAddOrderItemInput): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_add_item_started', { orderId, productId: input.productId, quantity: input.quantity });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/items`, 'POST', input);
}

export async function updateMerchantOrderLineQuantity(
  orderId: string,
  input: MerchantUpdateOrderLineQuantityInput,
): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_update_line_quantity_started', {
    orderId,
    lineId: input.lineId,
    quantity: input.quantity,
  });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(input.lineId)}`, 'PATCH', {
    quantity: input.quantity,
  });
}

export async function removeMerchantOrderLine(orderId: string, lineId: string): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_remove_line_started', { orderId, lineId });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(lineId)}`, 'DELETE');
}

export async function cancelMerchantOrder(orderId: string): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_cancel_started', { orderId });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/cancel`, 'POST');
}

export async function overrideMerchantOrderLinePrice(
  orderId: string,
  input: MerchantOverrideOrderLinePriceInput,
): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_override_price_started', {
    orderId,
    lineId: input.lineId,
    unitPriceMinor: input.unitPriceMinor,
  });
  return mutateOrder(
    orderId,
    `/v1/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(input.lineId)}/price`,
    'POST',
    { unitPriceMinor: input.unitPriceMinor },
  );
}

export async function markMerchantOrderManuallyPaid(
  orderId: string,
  input: MerchantManualSettlementInput,
): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_manual_settlement_started', { orderId, hasNote: Boolean(input.note?.trim()) });
  return mutateOrder(orderId, `/v1/orders/${encodeURIComponent(orderId)}/manual-settlement`, 'POST', {
    note: input.note?.trim() || undefined,
  });
}
