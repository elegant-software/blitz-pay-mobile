import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { fetchSettlementSummary } from '../services/settlementService';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useSettlementSummary(merchantId: string | null) {
  const today = new Date();
  const from = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = toIsoDate(today);

  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey: QUERY_KEYS.settlementSummary(merchantId ?? '', from, to),
    queryFn: () => fetchSettlementSummary(merchantId!, from, to),
    enabled: !!merchantId,
    staleTime: STALE_TIMES.SETTLEMENT_SUMMARY,
  });

  useFocusEffect(
    useCallback(() => {
      if (isStale) void refetch();
    }, [refetch, isStale]),
  );

  return {
    summary: data ?? null,
    loading: isLoading,
    error: error ? 'settlements_summary_load_failed' : null,
    from,
    to,
  };
}
