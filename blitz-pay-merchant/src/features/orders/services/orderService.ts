import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';
import type {
  MerchantOrderDetail,
  MerchantOrderItem,
  MerchantOrderStatus,
  MerchantOrderSummary,
} from '../types/order';

interface RawOrderItem {
  productId?: string;
  name?: string;
  quantity?: number;
  unitPriceMinor?: number;
  lineTotalMinor?: number;
}

interface RawOrder {
  orderId?: string;
  orderNumber?: string;
  merchantId?: string;
  branchId?: string | null;
  customerDisplayName?: string | null;
  customerName?: string | null;
  totalAmountMinor?: number;
  currency?: string;
  status?: string;
  createdAt?: string;
  items?: RawOrderItem[];
}

function mapStatus(status: unknown): MerchantOrderStatus {
  if (status === 'PAID') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'PAYMENT_INITIATED') return 'processing';
  return 'pending';
}

function parseItems(items: RawOrderItem[] | undefined): MerchantOrderItem[] {
  return (items ?? []).map((item) => ({
    productId: item.productId ?? '',
    name: item.name ?? '',
    quantity: item.quantity ?? 0,
    unitPriceMinor: item.unitPriceMinor ?? 0,
    lineTotalMinor: item.lineTotalMinor ?? 0,
  }));
}

function parseSummary(raw: RawOrder): MerchantOrderSummary {
  if (!raw.orderId || !raw.merchantId || !raw.currency || !raw.createdAt) {
    throw new Error('merchant_orders_invalid_response');
  }

  return {
    orderId: raw.orderId,
    orderNumber: raw.orderNumber ?? raw.orderId,
    merchantId: raw.merchantId,
    branchId: raw.branchId ?? undefined,
    customerName: raw.customerDisplayName ?? raw.customerName ?? undefined,
    amountMinor: raw.totalAmountMinor ?? 0,
    currency: raw.currency,
    status: mapStatus(raw.status),
    createdAt: raw.createdAt,
  };
}

function parseDetail(raw: RawOrder): MerchantOrderDetail {
  return {
    ...parseSummary(raw),
    items: parseItems(raw.items),
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
  observability.info('merchant_orders_request_payload', {
    branchId,
    rowCount: rows.length,
    sampleOrderIds: rows.slice(0, 5).map((row) => row.orderId ?? 'missing').join(','),
    sampleStatuses: rows.slice(0, 5).map((row) => String(row.status ?? 'missing')).join(','),
    sampleCreatedAt: rows.slice(0, 5).map((row) => row.createdAt ?? 'missing').join(','),
  });
  const orders = rows
    .map(parseSummary)
    .filter((order) => {
      const createdAt = new Date(order.createdAt);
      const today = new Date();
      return (
        createdAt.getFullYear() === today.getFullYear() &&
        createdAt.getMonth() === today.getMonth() &&
        createdAt.getDate() === today.getDate()
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  observability.info('merchant_orders_request_succeeded', {
    branchId,
    count: orders.length,
    filteredOut: Math.max(0, rows.length - orders.length),
  });
  return orders;
}

export async function fetchMerchantOrderDetail(orderId: string): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_detail_started', { orderId });
  const response = await authedFetch(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_order_detail_failed', { orderId, status: response.status, reason });
    throw new Error('merchant_order_detail_load_failed');
  }

  const payload = (await response.json()) as RawOrder;
  const order = parseDetail(payload);
  observability.info('merchant_order_detail_succeeded', { orderId: order.orderId, status: order.status });
  return order;
}
