import { authedFetch } from '../lib/api';

export interface ConnectionTokenResult {
  secret: string;
  locationId: string;
}

// StripeTerminalProvider calls tokenProvider() once on mount to validate it.
// We defer the actual fetch until scope (branchId + merchantId) is set by setTerminalScope().
let _currentBranchId: string | null = null;
let _currentMerchantId: string | null = null;

// Pending waiter: resolves when setTerminalScope() is called the first time.
let _scopeResolve: (() => void) | null = null;
let _scopeReady: Promise<void> = new Promise((resolve) => { _scopeResolve = resolve; });

export function setTerminalScope(branchId: string, merchantId: string): void {
  _currentBranchId = branchId;
  _currentMerchantId = merchantId;
  // Unblock any waiting tokenProvider call and reset for the next payment.
  if (_scopeResolve) {
    _scopeResolve();
    _scopeResolve = null;
    _scopeReady = new Promise((resolve) => { _scopeResolve = resolve; });
  }
}

export async function terminalTokenProvider(): Promise<string> {
  if (!_currentBranchId || !_currentMerchantId) {
    await _scopeReady;
  }
  const result = await fetchConnectionToken(_currentBranchId!, _currentMerchantId!);
  return result.secret;
}

export interface StripeIntentResult {
  paymentRequestId: string;
  clientSecret: string;
  paymentIntent: string;
  publishableKey: string;
  connectedAccountId: string;
}

export async function fetchConnectionToken(branchId: string, merchantId: string): Promise<ConnectionTokenResult> {
  const res = await authedFetch('/v1/payments/stripe/terminal/connection-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId, merchantId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `ConnectionToken failed: ${res.status}`);
  }
  return res.json() as Promise<ConnectionTokenResult>;
}

export async function createTerminalIntent(params: {
  orderId: string;
  merchantId: string;
  branchId: string;
}): Promise<StripeIntentResult> {
  const res = await authedFetch('/v1/payments/stripe/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, paymentMethodType: 'card_present' }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `CreateIntent failed: ${res.status}`);
  }
  return res.json() as Promise<StripeIntentResult>;
}
