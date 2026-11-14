import { authedFetch } from '../lib/api';
import { readApiError, readApiProblem } from '../lib/apiError';
import { storage } from '../lib/storage';

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
  const t0 = Date.now();
  if (__DEV__) console.warn('[terminal] token:start');
  try {
    const result = await fetchConnectionToken(_currentBranchId!, _currentMerchantId!);
    if (__DEV__) console.warn('[terminal] token:ok', JSON.stringify({ ms: Date.now() - t0 }));
    return result.secret;
  } catch (e) {
    if (__DEV__) console.warn('[terminal] token:fail', JSON.stringify({ ms: Date.now() - t0, e: e instanceof Error ? e.message : String(e) }));
    throw e;
  }
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
    throw new Error(`ConnectionToken failed: ${await readApiError(res)}`);
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
    const problem = await readApiProblem(res);
    throw new CreateIntentError(`CreateIntent failed: ${problem.detail ?? `HTTP ${problem.status}`}`, problem.status, problem.code);
  }
  return res.json() as Promise<StripeIntentResult>;
}

/** create-intent failure; `code` is the ProblemDetail code, e.g. `ORDER_ALREADY_PAID` on a 409. */
export class CreateIntentError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'CreateIntentError';
  }
}

/** The Card Reader paired on this device. Readers are paired on the phone, not registered in our DB. */
export interface PairedCardReader {
  serialNumber: string;
  label?: string;
}

const PAIRED_CARD_READER_KEY = 'blitzpay_card_reader';

export async function loadPairedCardReader(): Promise<PairedCardReader | null> {
  try {
    const raw = await storage.getItem(PAIRED_CARD_READER_KEY);
    return raw ? (JSON.parse(raw) as PairedCardReader) : null;
  } catch {
    return null;
  }
}

export async function savePairedCardReader(reader: PairedCardReader): Promise<void> {
  await storage.setItem(PAIRED_CARD_READER_KEY, JSON.stringify(reader));
}

export async function clearPairedCardReader(): Promise<void> {
  await storage.deleteItem(PAIRED_CARD_READER_KEY);
}
