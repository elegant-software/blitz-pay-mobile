import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { fetchMerchantOrders } from '../services/orderService';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';
import type { MerchantOrderFilter, MerchantOrderSummary } from '../types/order';

function applyFilter(orders: MerchantOrderSummary[], filter: MerchantOrderFilter): MerchantOrderSummary[] {
  if (filter === 'ALL') return orders;
  return orders.filter((order) => {
    if (filter === 'PROCESSING') {
      return order.status === 'awaiting_payment' || order.status === 'payment_in_progress' || order.status === 'payment_failed';
    }
    if (filter === 'COMPLETED') return order.status === 'paid';
    return order.status === 'cancelled';
  });
}

export function useMerchantOrders(branchId: string | null, filter: MerchantOrderFilter) {
  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey: QUERY_KEYS.ordersList(branchId),
    queryFn: () => fetchMerchantOrders(branchId!),
    enabled: !!branchId,
    staleTime: STALE_TIMES.ORDERS_LIST,
  });

  useFocusEffect(
    useCallback(() => {
      if (isStale) void refetch();
    }, [refetch, isStale]),
  );

  const errorKey = !branchId
    ? 'merchant_branch_access_missing'
    : error
      ? (error instanceof Error ? error.message : 'merchant_orders_load_failed')
      : null;

  return {
    orders: applyFilter(data ?? [], filter),
    loading: isLoading,
    error: errorKey,
    reload: refetch,
  };
}
