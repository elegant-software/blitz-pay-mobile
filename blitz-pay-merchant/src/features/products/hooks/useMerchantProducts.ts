import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { ActiveBranchScope } from '../../../lib/auth';
import { fetchBranchProducts, MerchantProductError } from '../../../lib/merchantProducts';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';
import type { Product } from '../../../types';

type UseMerchantProductsResult = {
  products: Product[];
  loading: boolean;
  refreshing: boolean;
  errorKey: string | null;
  errorDetail?: string;
  reload: () => Promise<unknown>;
};

export function useMerchantProducts(activeBranchScope: ActiveBranchScope | null, branchScopeError: string | null): UseMerchantProductsResult {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    isStale,
  } = useQuery({
    queryKey: activeBranchScope
      ? QUERY_KEYS.products(activeBranchScope.merchantId, activeBranchScope.branchId)
      : ['products', 'missing-scope'],
    queryFn: () => fetchBranchProducts(activeBranchScope!.merchantId, activeBranchScope!.branchId),
    enabled: !!activeBranchScope,
    staleTime: STALE_TIMES.PRODUCTS,
  });

  useFocusEffect(
    useCallback(() => {
      if (activeBranchScope && isStale) void refetch();
    }, [activeBranchScope, isStale, refetch]),
  );

  const failure = error;
  const errorKey = !activeBranchScope
    ? (branchScopeError ?? 'merchant_products_branch_missing')
    : failure
      ? (failure instanceof MerchantProductError ? failure.key : 'merchant_products_load_failed')
      : null;

  return {
    products: data ?? [],
    loading: isLoading && !data,
    refreshing: isFetching && !!data,
    errorKey,
    errorDetail: failure instanceof MerchantProductError ? failure.detail : undefined,
    reload: refetch,
  };
}
