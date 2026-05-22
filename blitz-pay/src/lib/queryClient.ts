import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { storage } from './storage';

export const STALE_TIMES = {
  PRODUCTS: 5 * 60_000,
  BRANCH_NAMES: 10 * 60_000,
} as const;

export const QUERY_KEYS = {
  catalog: (merchantId: string) => ['catalog', merchantId] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: STALE_TIMES.PRODUCTS,
    },
  },
});

const storageAdapter = {
  getItem: (key: string) => storage.getItem(key),
  setItem: (key: string, value: string) => storage.setItem(key, value),
  removeItem: (key: string) => storage.deleteItem(key),
};

export const productsPersister = createAsyncStoragePersister({
  storage: storageAdapter,
  key: 'blitzpay_query_cache',
});
