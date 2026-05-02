import { authedFetch } from '../api/authedFetch';
import { observability } from '../observability';
import { mapBackendStatus, type PaymentResult } from './types';

export type StatusOutcome =
  | { kind: 'terminal'; result: PaymentResult }
  | {
      kind: 'non_terminal';
      status?: string;
      paymentRequestId?: string;
      orderId?: string;
      provider?: string;
      amount?: number;
      currency?: string;
    };

interface FetchOptions {
  signal?: AbortSignal;
}

interface RawStatusResponse {
  paymentRequestId?: string;
  status?: string;
  terminal?: boolean;
  lastEventAt?: string;
}

interface RawOrderStatusResponse {
  orderId?: string;
  status?: string;
  currency?: string;
  totalAmountMinor?: number;
  lastPaymentRequestId?: string | null;
  lastPaymentProvider?: string | null;
}

function mapOrderStatus(value: unknown): 'succeeded' | 'failed' | 'cancelled' | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  if (upper === 'PAID') return 'succeeded';
  if (upper === 'PAYMENT_FAILED') return 'failed';
  if (upper === 'CANCELLED') return 'cancelled';
  return null;
}

export async function fetchPaymentStatus(
  paymentRequestId: string,
  options: FetchOptions = {}
): Promise<StatusOutcome> {
  let response: Response;
  try {
    response = await authedFetch(`/v1/payments/${encodeURIComponent(paymentRequestId)}`, {
      method: 'GET',
      signal: options.signal,
    });
  } catch (err) {
    observability.debug('payment_status_network_error', {
      paymentRequestId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { kind: 'non_terminal' };
  }

  // 404 = no status record yet (payment too new). Keep polling.
  if (response.status === 404) {
    observability.debug('payment_status_not_found_yet', { paymentRequestId });
    return { kind: 'non_terminal' };
  }

  if (!response.ok) {
    observability.debug('payment_status_non_ok', {
      paymentRequestId,
      status: response.status,
    });
    return { kind: 'non_terminal' };
  }

  let payload: RawStatusResponse;
  try {
    payload = (await response.json()) as RawStatusResponse;
  } catch {
    return { kind: 'non_terminal' };
  }

  const mapped = mapBackendStatus(payload.status);
  const isTerminal = payload.terminal === true && mapped !== null;

  if (isTerminal && mapped) {
    const result: PaymentResult = {
      paymentRequestId: payload.paymentRequestId ?? paymentRequestId,
      status: mapped,
      updatedAt: payload.lastEventAt,
    };
    return { kind: 'terminal', result };
  }

  return { kind: 'non_terminal', status: payload.status };
}

export async function fetchOrderStatus(
  orderId: string,
  options: FetchOptions = {}
): Promise<StatusOutcome> {
  let response: Response;
  try {
    response = await authedFetch(`/v1/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      signal: options.signal,
    });
  } catch (err) {
    observability.debug('order_status_network_error', {
      orderId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { kind: 'non_terminal', orderId };
  }

  if (response.status === 404) {
    return { kind: 'non_terminal', orderId };
  }

  if (!response.ok) {
    observability.debug('order_status_non_ok', {
      orderId,
      status: response.status,
    });
    return { kind: 'non_terminal', orderId };
  }

  let payload: RawOrderStatusResponse;
  try {
    payload = (await response.json()) as RawOrderStatusResponse;
  } catch {
    return { kind: 'non_terminal', orderId };
  }

  const mapped = mapOrderStatus(payload.status);
  if (mapped) {
    return {
      kind: 'terminal',
      result: {
        paymentRequestId: payload.lastPaymentRequestId ?? orderId,
        orderId: payload.orderId ?? orderId,
        provider: payload.lastPaymentProvider ?? null,
        orderStatus: payload.status ?? null,
        status: mapped,
        amount:
          typeof payload.totalAmountMinor === 'number'
            ? payload.totalAmountMinor / 100
            : undefined,
        currency: payload.currency,
      },
    };
  }

  return {
    kind: 'non_terminal',
    orderId: payload.orderId ?? orderId,
    paymentRequestId: payload.lastPaymentRequestId ?? undefined,
    provider: payload.lastPaymentProvider ?? undefined,
    status: payload.status,
    amount:
      typeof payload.totalAmountMinor === 'number'
        ? payload.totalAmountMinor / 100
        : undefined,
    currency: payload.currency,
  };
}
