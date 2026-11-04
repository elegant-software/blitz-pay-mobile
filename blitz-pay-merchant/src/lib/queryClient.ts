import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { storage } from './storage';

export const STALE_TIMES = {
  ORDERS_LIST: 30_000,
  ORDER_DETAIL: 15_000,
  PRODUCTS: 5 * 60_000,
  BRANCH_NAMES: 10 * 60_000,
  SETTLEMENT_SUMMARY: 5 * 60_000,
  MERCHANT_KPI: 5 * 60_000,
  BRANCH_TABLES: 60_000,
  BRANCH_FLOOR: 10_000,
} as const;

export const QUERY_KEYS = {
  ordersList: (branchId: string | null) => ['orders', branchId] as const,
  orderDetail: (orderId: string) => ['order', orderId] as const,
  products: (merchantId: string, branchId: string) => ['products', merchantId, branchId] as const,
  settlementSummary: (merchantId: string, from: string, to: string) =>
    ['settlements', 'summary', merchantId, from, to] as const,
  merchantKpi: (merchantId: string, from: string, to: string, branchId: string | null) =>
    ['reporting', 'kpi', merchantId, from, to, branchId] as const,
  branchTables: (branchId: string | null) => ['tables', branchId] as const,
  floorPlans: (branchId: string | null) => ['floor-plans', branchId] as const,
  branchFloor: (branchId: string | null) => ['floor', branchId] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: STALE_TIMES.ORDERS_LIST,
    },
  },
});

// Adapter from our storage abstraction to the AsyncStorage-compatible interface
const storageAdapter = {
  getItem: (key: string) => storage.getItem(key),
  setItem: (key: string, value: string) => storage.setItem(key, value),
  removeItem: (key: string) => storage.deleteItem(key),
};

export const productsPersister = createAsyncStoragePersister({
  storage: storageAdapter,
  key: 'blitzpay_merchant_query_cache',
});
