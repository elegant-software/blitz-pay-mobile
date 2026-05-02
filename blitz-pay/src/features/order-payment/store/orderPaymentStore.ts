import { storage } from '../../../lib/storage';
import type { OrderPaymentSession, RecentOrderSummary } from '../types/orderPayment';

interface OrderPaymentState {
  activeOrderId?: string;
  sessions: Record<string, OrderPaymentSession>;
  recentOrders: RecentOrderSummary[];
}

const STORAGE_KEY = 'blitzpay_order_payment_sessions';
const listeners = new Set<() => void>();

let state: OrderPaymentState = {
  sessions: {},
  recentOrders: [],
};

function emit() {
  listeners.forEach((listener) => listener());
}

function isSession(value: unknown): value is OrderPaymentSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as OrderPaymentSession).orderId === 'string' &&
    typeof (value as OrderPaymentSession).merchantId === 'string' &&
    typeof (value as OrderPaymentSession).merchantName === 'string'
  );
}

async function persist(): Promise<void> {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // non-fatal
  }
}

async function hydrate(): Promise<void> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<OrderPaymentState> | null;
    const sessions = Object.fromEntries(
      Object.entries(parsed?.sessions ?? {}).filter((entry): entry is [string, OrderPaymentSession] =>
        isSession(entry[1]),
      ),
    );
    state = {
      activeOrderId:
        typeof parsed?.activeOrderId === 'string' && sessions[parsed.activeOrderId]
          ? parsed.activeOrderId
          : undefined,
      sessions,
      recentOrders: Array.isArray(parsed?.recentOrders) ? parsed.recentOrders as RecentOrderSummary[] : [],
    };
    emit();
  } catch {
    // non-fatal
  }
}

function replaceState(next: OrderPaymentState) {
  state = next;
  emit();
  void persist();
}

function saveSession(session: OrderPaymentSession) {
  replaceState({
    activeOrderId: session.orderId,
    recentOrders: state.recentOrders,
    sessions: {
      ...state.sessions,
      [session.orderId]: session,
    },
  });
}

function patchSession(orderId: string, patch: Partial<OrderPaymentSession>) {
  const current = state.sessions[orderId];
  if (!current) return;
  saveSession({
    ...current,
    ...patch,
    orderId: current.orderId,
  });
}

function getActiveSession(): OrderPaymentSession | undefined {
  return state.activeOrderId ? state.sessions[state.activeOrderId] : undefined;
}

function getSession(orderId: string): OrderPaymentSession | undefined {
  return state.sessions[orderId];
}

function setRecentOrders(recentOrders: RecentOrderSummary[]) {
  replaceState({
    ...state,
    recentOrders,
  });
}

function getSnapshot(): OrderPaymentState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

void hydrate();

export const orderPaymentStore = {
  subscribe,
  getSnapshot,
  getActiveSession,
  getSession,
  saveSession,
  patchSession,
  setRecentOrders,
};
