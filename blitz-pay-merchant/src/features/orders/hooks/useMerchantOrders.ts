import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { fetchMerchantOrders } from '../services/orderService';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';

export function useMerchantOrders(branchId: string | null) {
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
    orders: data ?? [],
    loading: isLoading,
    error: errorKey,
    reload: refetch,
  };
}
