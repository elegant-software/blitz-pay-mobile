// Backend lifecycle: PENDING → EXECUTED → SETTLED | FAILED | EXPIRED.
// See blitz-pay/docs/mobile-api.md §5.
export const BACKEND_STATUSES = [
  'PENDING',
  'EXECUTED',
  'SETTLED',
  'FAILED',
  'EXPIRED',
] as const;
export type BackendPaymentStatus = (typeof BACKEND_STATUSES)[number];

export const BACKEND_TERMINAL_STATUSES = ['SETTLED', 'FAILED', 'EXPIRED'] as const;
export type BackendTerminalStatus = (typeof BACKEND_TERMINAL_STATUSES)[number];

// UI-facing statuses — what screens render.
export const TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled'] as const;
export type TerminalPaymentStatus = (typeof TERMINAL_STATUSES)[number];

export type PaymentStatus = 'pending' | 'processing' | TerminalPaymentStatus;

export function isBackendTerminalStatus(value: unknown): value is BackendTerminalStatus {
  return (
    typeof value === 'string' &&
    (BACKEND_TERMINAL_STATUSES as readonly string[]).includes(value)
  );
}

export function mapBackendStatus(value: unknown): TerminalPaymentStatus | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  if (upper === 'SETTLED') return 'succeeded';
  if (upper === 'FAILED') return 'failed';
  if (upper === 'EXPIRED') return 'cancelled';
  return null;
}

export function isTerminalStatus(value: unknown): value is TerminalPaymentStatus {
  return typeof value === 'string' && (TERMINAL_STATUSES as readonly string[]).includes(value);
}

export interface PaymentResult {
  paymentRequestId: string;
  orderId?: string;
  provider?: string | null;
  orderStatus?: string | null;
  status: TerminalPaymentStatus;
  amount?: number;
  currency?: string;
  reason?: string | null;
  updatedAt?: string;
}

export interface PaymentResultPushData {
  type: 'payment_result';
  paymentRequestId: string;
  orderId?: string | null;
  status: TerminalPaymentStatus;
  reason?: string | null;
}

export type TrackerResolution =
  | { kind: 'terminal'; source: 'push' | 'poll' | 'recovered'; result: PaymentResult }
  | { kind: 'timeout'; paymentRequestId: string };

export type TrackerSource = 'push' | 'poll' | 'recovered';
