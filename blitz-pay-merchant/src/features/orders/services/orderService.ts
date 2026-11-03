import { authedFetch } from '../../../lib/api';
import { observability } from '../../../lib/observability';
import type { ActiveBranchScope } from '../../../lib/auth';
import type {
  BranchCustomer,
  MerchantAddOrderItemInput,
  MerchantManualSettlementInput,
  MerchantOrderDetail,
  MerchantOrderItem,
  MerchantOrderStatus,
  MerchantOrderSummary,
  MerchantOverrideOrderLinePriceInput,
  MerchantPreparationStatus,
  MerchantUpdateOrderLineQuantityInput,
} from '../types/order';

interface RawOrderItem {
  itemId?: string;
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
  totalAmountMinor?: number;
  currency?: string;
  status?: string;
  checkoutIntent?: string | null;
  paymentSource?: string | null;
  checkoutPaymentMethod?: string | null;
  lastPaymentProvider?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: RawOrderItem[];
  paymentRetryAllowed?: boolean | null;
  manualSettlementNote?: string | null;
  lastUpdatedBy?: string | null;
  preparationStatus?: string | null;
  pickupNumber?: number | null;
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

function mapPaymentProvider(
  provider: unknown,
): 'STRIPE' | 'STRIPE_TERMINAL' | 'STRIPE_PAY_BY_BANK' | 'TERMINAL' | 'TRUELAYER' | 'BRAINTREE' | 'QRPAY' | undefined {
  if (provider === 'STRIPE') return 'STRIPE';
  if (provider === 'STRIPE_TERMINAL') return 'STRIPE_TERMINAL';
  if (provider === 'STRIPE_PAY_BY_BANK') return 'STRIPE_PAY_BY_BANK';
  if (provider === 'TERMINAL') return 'TERMINAL';
  if (provider === 'TRUELAYER') return 'TRUELAYER';
  if (provider === 'BRAINTREE') return 'BRAINTREE';
  if (provider === 'QRPAY') return 'QRPAY';
  return undefined;
}

function mapCheckoutPaymentMethod(method: unknown): 'BANK_ACCOUNT' | 'CARD' | 'PAY_BY_BANK' | 'TERMINAL' | 'PAYPAL' | undefined {
  if (method === 'BANK_ACCOUNT') return 'BANK_ACCOUNT';
  if (method === 'CARD') return 'CARD';
  if (method === 'PAY_BY_BANK') return 'PAY_BY_BANK';
  if (method === 'TERMINAL') return 'TERMINAL';
  if (method === 'PAYPAL') return 'PAYPAL';
  return undefined;
}

function mapPreparationStatus(status: unknown): MerchantPreparationStatus | undefined {
  if (status === 'RECEIVED' || status === 'PREPARING' || status === 'READY') return status;
  return undefined;
}

function parseItems(items: RawOrderItem[] | undefined, orderId: string): MerchantOrderItem[] {
  return (items ?? []).map((item, index) => ({
    lineId: item.itemId ?? item.lineId ?? `${orderId}-${item.productId ?? 'line'}-${index}`,
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

  const itemCount = raw.items?.reduce((sum, item) => sum + Math.max(0, item.quantity ?? 0), 0);

  return {
    orderId: raw.orderId,
    merchantId: raw.merchantId,
    branchId: raw.branchId ?? undefined,
    amountMinor: raw.totalAmountMinor ?? 0,
    currency: raw.currency,
    status: mapStatus(raw.status),
    checkoutIntent: mapCheckoutIntent(raw.checkoutIntent),
    paymentSource: mapPaymentSource(raw.paymentSource),
    checkoutPaymentMethod: mapCheckoutPaymentMethod(raw.checkoutPaymentMethod),
    paymentProvider: mapPaymentProvider(raw.lastPaymentProvider),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt ?? raw.createdAt,
    itemCount: itemCount && itemCount > 0 ? itemCount : undefined,
    preparationStatus: mapPreparationStatus(raw.preparationStatus),
    pickupNumber: typeof raw.pickupNumber === 'number' ? raw.pickupNumber : null,
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
    if (!text.trim()) return `HTTP ${response.status}`;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const detail = typeof json.error === 'string' ? json.error
        : typeof json.message === 'string' ? json.message
        : null;
      return detail ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

export class MerchantOrderError extends Error {
  constructor(
    public readonly key: string,
    public readonly detail: string,
    public readonly status?: number,
  ) {
    super(key);
    this.name = 'MerchantOrderError';
  }
}

export interface InvoiceDownloadResponse {
  url: string;
  filename: string;
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
    const reason = await readError(response);
    observability.error('merchant_order_mutation_failed', {
      orderId,
      path,
      method,
      status: response.status,
      reason,
    });
    if (path.endsWith('/settle') && response.status === 404) {
      throw new Error('merchant_manual_settlement_unavailable');
    }
    throw new Error('merchant_order_mutation_failed');
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

export interface CreateMerchantOrderItem {
  productId: string;
  quantity: number;
}

export interface CreateMerchantOrderOptions {
  targetShopperId?: string;
  dueDate?: string;
}

export async function createMerchantOrder(
  merchantId: string,
  branchId: string,
  items: CreateMerchantOrderItem[],
  options?: CreateMerchantOrderOptions,
): Promise<MerchantOrderDetail> {
  const isInvoice = !!options?.targetShopperId;
  observability.info('merchant_order_create_started', { merchantId, branchId, itemCount: items.length, isInvoice });
  const body: Record<string, unknown> = {
    merchantId,
    branchId,
    orderType: isInvoice ? 'WALK_IN_ORDERING' : 'PRE_ORDER',
    usesDeferredPayment: isInvoice,
    items,
  };
  if (options?.targetShopperId) body.targetShopperId = options.targetShopperId;
  if (options?.dueDate) body.dueDate = options.dueDate;
  const response = await authedFetch('/v1/merchant/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('merchant_order_create_failed', { merchantId, branchId, status: response.status, reason });
    throw new MerchantOrderError('merchant_order_create_failed', reason, response.status);
  }

  const payload = (await response.json()) as RawOrder;
  const order = parseDetail(payload);
  observability.info('merchant_order_create_succeeded', { orderId: order.orderId, branchId });
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
  const response = await authedFetch(`/v1/merchant/orders/${encodeURIComponent(orderId)}`, {
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

export async function fetchMerchantOrderInvoice(
  orderId: string,
  activeBranchScope: ActiveBranchScope,
): Promise<InvoiceDownloadResponse | null> {
  const params = new URLSearchParams({
    merchantId: activeBranchScope.merchantId,
    branchId: activeBranchScope.branchId,
  });
  const response = await authedFetch(`/v1/merchant/orders/${encodeURIComponent(orderId)}/invoice?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const reason = await readError(response);
    observability.warn('merchant_order_invoice_fetch_failed', {
      orderId,
      merchantId: activeBranchScope.merchantId,
      branchId: activeBranchScope.branchId,
      status: response.status,
      reason,
    });
    throw new Error('merchant_order_invoice_load_failed');
  }
  return response.json() as Promise<InvoiceDownloadResponse>;
}

export async function addMerchantOrderItem(orderId: string, input: MerchantAddOrderItemInput): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_add_item_started', { orderId, productId: input.productId, quantity: input.quantity });
  return mutateOrder(orderId, `/v1/merchant/orders/${encodeURIComponent(orderId)}/items`, 'POST', input);
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
  return mutateOrder(orderId, `/v1/merchant/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(input.lineId)}`, 'PATCH', {
    quantity: input.quantity,
  });
}

export async function removeMerchantOrderLine(orderId: string, lineId: string): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_remove_line_started', { orderId, lineId });
  return mutateOrder(orderId, `/v1/merchant/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(lineId)}`, 'DELETE');
}

export async function cancelMerchantOrder(orderId: string): Promise<MerchantOrderDetail> {
  observability.info('merchant_order_cancel_started', { orderId });
  return mutateOrder(orderId, `/v1/merchant/orders/${encodeURIComponent(orderId)}/cancel`, 'POST');
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
    `/v1/merchant/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(input.lineId)}/price`,
    'PATCH',
    { unitPriceMinor: input.unitPriceMinor },
  );
}

export async function markMerchantOrderManuallyPaid(
  orderId: string,
  input: MerchantManualSettlementInput,
): Promise<MerchantOrderDetail> {
  const path = `/v1/merchant/orders/${encodeURIComponent(orderId)}/settle`;
  const trimmedNote = input.note?.trim();
  observability.info('merchant_order_manual_settlement_started', {
    orderId,
    path,
    method: 'POST',
    hasNote: Boolean(trimmedNote),
    noteLength: trimmedNote?.length ?? 0,
  });
  return mutateOrder(orderId, path, 'POST', {
    note: trimmedNote || undefined,
  });
}

export async function fetchBranchCustomers(branchId: string): Promise<BranchCustomer[]> {
  observability.info('branch_customers_request_started', { branchId });
  const response = await authedFetch(
    `/v1/merchant/orders/branches/${encodeURIComponent(branchId)}/customers`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    const reason = await readError(response);
    observability.error('branch_customers_request_failed', { branchId, status: response.status, reason });
    throw new MerchantOrderError('branch_customers_load_failed', reason, response.status);
  }

  const rows = (await response.json()) as Array<{ shopperAccountId?: string; name?: string }>;
  const customers: BranchCustomer[] = rows
    .filter((r) => r.shopperAccountId && r.name)
    .map((r) => ({ shopperAccountId: r.shopperAccountId!, name: r.name! }));

  observability.info('branch_customers_request_succeeded', { branchId, count: customers.length });
  return customers;
}

export async function searchShopperByEmail(email: string): Promise<BranchCustomer | null> {
  observability.info('shopper_search_started', { email });
  const params = new URLSearchParams({ email });
  const response = await authedFetch(
    `/v1/merchant/orders/shoppers/search?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );

  if (response.status === 404) {
    observability.info('shopper_search_not_found', { email });
    return null;
  }
  if (!response.ok) {
    const reason = await readError(response);
    observability.error('shopper_search_failed', { email, status: response.status, reason });
    throw new MerchantOrderError('shopper_search_failed', reason, response.status);
  }

  const result = (await response.json()) as { shopperAccountId?: string; name?: string };
  if (!result.shopperAccountId || !result.name) return null;

  observability.info('shopper_search_succeeded', { email, shopperAccountId: result.shopperAccountId });
  return { shopperAccountId: result.shopperAccountId, name: result.name };
}
