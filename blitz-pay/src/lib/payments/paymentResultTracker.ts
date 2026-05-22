import { trackPaymentResultEvent } from './analytics';
import { BACKOFF_SCHEDULE_MS, INITIAL_WAIT_MS, MAX_WAIT_MS } from './constants';
import { inFlightStore } from './inFlightStore';
import { fetchPaymentStatus } from './paymentStatusClient';
import {
  isTerminalStatus,
  type PaymentResult,
  type PaymentResultPushData,
  type TrackerResolution,
  type TrackerSource,
} from './types';

type Listener = (resolution: TrackerResolution) => void;

interface TrackerState {
  paymentRequestId: string;
  startedAt: number;
  resolved: boolean;
  pollController: AbortController | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  maxWaitTimer: ReturnType<typeof setTimeout> | null;
  resolve: (resolution: TrackerResolution) => void;
  promise: Promise<TrackerResolution>;
}

const trackers = new Map<string, TrackerState>();
const listeners = new Set<Listener>();

function emit(resolution: TrackerResolution): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener(resolution);
    } catch {
      // swallow listener errors so one bad subscriber can't break the others
    }
  }
}

function clearTimers(state: TrackerState): void {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.maxWaitTimer) {
    clearTimeout(state.maxWaitTimer);
    state.maxWaitTimer = null;
  }
  if (state.pollController) {
    state.pollController.abort();
    state.pollController = null;
  }
}

async function resolveOnce(
  paymentRequestId: string,
  source: TrackerSource,
  result: PaymentResult
): Promise<void> {
  const state = trackers.get(paymentRequestId);
  if (!state) return;
  if (state.resolved) {
    trackPaymentResultEvent('payment_result_duplicate_suppressed', {
      paymentRequestId,
      source,
      status: result.status,
    });
    return;
  }
  state.resolved = true;
  clearTimers(state);

  if (source === 'push') {
    const latencyMs = Date.now() - state.startedAt;
    trackPaymentResultEvent('payment_result_push_received', {
      paymentRequestId,
      status: result.status,
      latencyMs,
    });
  } else if (source === 'poll') {
    trackPaymentResultEvent('payment_result_poll_terminal', {
      paymentRequestId,
      status: result.status,
      elapsedMs: Date.now() - state.startedAt,
    });
  } else {
    trackPaymentResultEvent('payment_result_recovered', {
      paymentRequestId,
      status: result.status,
    });
  }

  try {
    await inFlightStore.remove(paymentRequestId);
  } catch {
    // non-fatal
  }

  const resolution: TrackerResolution = { kind: 'terminal', source, result };
  state.resolve(resolution);
  trackers.delete(paymentRequestId);
  emit(resolution);
}

function nextBackoffDelay(attempt: number): number {
  if (attempt < BACKOFF_SCHEDULE_MS.length) return BACKOFF_SCHEDULE_MS[attempt];
  return BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
}

async function runPoll(state: TrackerState, attempt: number): Promise<void> {
  if (state.resolved) return;
  const elapsed = Date.now() - state.startedAt;
  if (elapsed >= MAX_WAIT_MS) return; // max-wait timer will handle timeout

  state.pollController = new AbortController();
  let outcome: Awaited<ReturnType<typeof fetchPaymentStatus>>;
  try {
    outcome = await fetchPaymentStatus(state.paymentRequestId, {
      signal: state.pollController.signal,
    });
  } catch {
    outcome = { kind: 'non_terminal' };
  }
  state.pollController = null;

  if (state.resolved) return;

  try {
    await inFlightStore.update(state.paymentRequestId, { lastPolledAt: Date.now() });
  } catch {
    // non-fatal
  }

  if (outcome.kind === 'terminal') {
    await resolveOnce(state.paymentRequestId, 'poll', outcome.result);
    return;
  }

  schedulePoll(state, attempt + 1);
}

function schedulePoll(state: TrackerState, attempt: number): void {
  if (state.resolved) return;
  const elapsed = Date.now() - state.startedAt;
  const remaining = MAX_WAIT_MS - elapsed;
  if (remaining <= 0) return;
  const delay = Math.min(nextBackoffDelay(attempt), remaining);
  state.pollTimer = setTimeout(() => {
    state.pollTimer = null;
    void runPoll(state, attempt);
  }, delay);
}

function armTimeout(state: TrackerState): void {
  const elapsed = Date.now() - state.startedAt;
  const remaining = Math.max(0, MAX_WAIT_MS - elapsed);
  state.maxWaitTimer = setTimeout(() => {
    if (state.resolved) return;
    state.resolved = true;
    clearTimers(state);
    trackPaymentResultEvent('payment_result_timeout', {
      paymentRequestId: state.paymentRequestId,
      elapsedMs: Date.now() - state.startedAt,
    });
    // Intentionally keep the inFlightStore record — a later push or next-launch
    // recovery must still be able to deliver the real terminal result.
    const resolution: TrackerResolution = {
      kind: 'timeout',
      paymentRequestId: state.paymentRequestId,
    };
    state.resolve(resolution);
    trackers.delete(state.paymentRequestId);
    emit(resolution);
  }, remaining);
}

export interface StartOptions {
  persist?: boolean;
  initialWaitMs?: number;
  startedAt?: number;
}

function createState(
  paymentRequestId: string,
  startedAt: number
): TrackerState {
  let resolveFn!: (r: TrackerResolution) => void;
  const promise = new Promise<TrackerResolution>((resolve) => {
    resolveFn = resolve;
  });
  return {
    paymentRequestId,

    startedAt,
    resolved: false,
    pollController: null,
    pollTimer: null,
    maxWaitTimer: null,
    resolve: resolveFn,
    promise,
  };
}

async function start(
  paymentRequestId: string,
  options: StartOptions = {}
): Promise<TrackerResolution> {
  if (!paymentRequestId || typeof paymentRequestId !== 'string') {
    throw new Error('paymentResultTracker.start: paymentRequestId is required');
  }

  const existing = trackers.get(paymentRequestId);
  if (existing) return existing.promise;

  const startedAt = options.startedAt ?? Date.now();
  const state = createState(paymentRequestId, startedAt);
  trackers.set(paymentRequestId, state);

  if (options.persist !== false) {
    try {
      await inFlightStore.add({ paymentRequestId, startedAt });
    } catch {
      // non-fatal
    }
  }

  armTimeout(state);

  const initialDelay = Math.max(
    0,
    (options.initialWaitMs ?? INITIAL_WAIT_MS) - (Date.now() - startedAt)
  );
  state.pollTimer = setTimeout(() => {
    state.pollTimer = null;
    void runPoll(state, 0);
  }, initialDelay);

  return state.promise;
}

function applyPush(data: PaymentResultPushData): void {
  if (!data || data.type !== 'payment_result') return;
  if (!data.paymentRequestId || !isTerminalStatus(data.status)) return;
  const result: PaymentResult = {
    paymentRequestId: data.paymentRequestId,
    status: data.status,
    reason: data.reason ?? null,
  };
  const state = trackers.get(data.paymentRequestId);
  if (!state) {
    // Push arrived for a payment we aren't actively tracking on this device —
    // remove any persisted record and fan out to listeners so post-timeout
    // screens can still surface the result.
    void inFlightStore.remove(data.paymentRequestId).catch(() => undefined);
    trackPaymentResultEvent('payment_result_push_received', {
      paymentRequestId: data.paymentRequestId,
      status: data.status,
      untracked: true,
    });
    emit({ kind: 'terminal', source: 'push', result });
    return;
  }
  void resolveOnce(data.paymentRequestId, 'push', result);
}

function applyRecoveredResult(result: PaymentResult): void {
  const state = trackers.get(result.paymentRequestId);
  if (state) {
    void resolveOnce(result.paymentRequestId, 'recovered', result);
    return;
  }
  trackPaymentResultEvent('payment_result_recovered', {
    paymentRequestId: result.paymentRequestId,
    status: result.status,
  });
  emit({ kind: 'terminal', source: 'recovered', result });
}

function cancel(paymentRequestId: string): void {
  const state = trackers.get(paymentRequestId);
  if (!state) return;
  state.resolved = true;
  clearTimers(state);
  trackers.delete(paymentRequestId);
}

function isTracking(paymentRequestId: string): boolean {
  return trackers.has(paymentRequestId);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const paymentResultTracker = {
  start,
  applyPush,
  applyRecoveredResult,
  cancel,
  isTracking,
  subscribe,
};
