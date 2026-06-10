import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { fetchMerchantKpi } from '../services/kpiService';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useMerchantKpi(
  merchantId: string | null,
  from: string,
  to: string,
  branchId?: string | null,
) {
  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey: QUERY_KEYS.merchantKpi(merchantId ?? '', from, to, branchId ?? null),
    queryFn: () => fetchMerchantKpi(merchantId!, from, to, branchId),
    enabled: !!merchantId,
    staleTime: STALE_TIMES.MERCHANT_KPI,
  });

  useFocusEffect(
    useCallback(() => {
      if (merchantId && isStale) void refetch();
    }, [merchantId, isStale, refetch]),
  );

  return {
    report: data ?? null,
    loading: isLoading,
    error: error ? 'merchant_kpi_load_failed' : null,
    refetch,
  };
}

export { toIsoDate };
