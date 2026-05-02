import { authedFetch } from '../lib/api/authedFetch';
import { observability } from '../lib/observability';
import type {
  BraintreeCheckoutRequest,
  BraintreeCheckoutResponse,
  BraintreeClientTokenRequest,
  BraintreeClientTokenResponse,
} from '../types/braintree';

const SALE_TIMEOUT_MS = 30_000;

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs = SALE_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await authedFetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Server returned ${response.status}: ${text}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchClientToken(request: BraintreeClientTokenRequest): Promise<string> {
  const url = '/v1/payments/braintree/client-token';
  observability.info('braintree_client_token_started', {
    merchantId: request.merchantId,
    branchId: request.branchId ?? null,
  });
  const data = await fetchJson<BraintreeClientTokenResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId: request.merchantId, branchId: request.branchId }),
  });
  if (!data.clientToken) {
    observability.error('braintree_client_token_invalid_response', {
      merchantId: request.merchantId,
      branchId: request.branchId ?? null,
      hasClientToken: false,
    });
    throw new Error('Missing clientToken in response');
  }
  observability.info('braintree_client_token_succeeded', {
    merchantId: request.merchantId,
    branchId: request.branchId ?? null,
  });
  return data.clientToken;
}

export async function submitNonce(
  request: BraintreeCheckoutRequest,
): Promise<BraintreeCheckoutResponse> {
  const url = '/v1/payments/braintree/checkout';
  observability.info('braintree_checkout_started', {
    orderId: request.orderId,
    amount: request.amount,
    currency: request.currency ?? 'EUR',
  });
  const response = await fetchJson<BraintreeCheckoutResponse>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  observability.info('braintree_checkout_finished', {
    orderId: request.orderId,
    status: response.status,
    code: 'code' in response ? (response.code ?? null) : null,
  });
  return response;
}
