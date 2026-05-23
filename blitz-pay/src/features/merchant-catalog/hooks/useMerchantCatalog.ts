import { useCallback } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchActiveProducts,
  fetchMerchantBranches,
  fetchMerchantDetails,
  resolveMerchantBranch,
} from '../services/merchantCatalogService';
import type { ActiveProduct, MerchantBranch } from '../types/catalog';
import { setBasketMerchantContext } from '../../basket/store/basketStore';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';

type CatalogResult = {
  branch: MerchantBranch;
  merchantLogoUrl?: string;
  products: ActiveProduct[];
};

async function loadCatalog(
  merchantId: string,
  merchantName: string,
  preferredBranchId?: string,
): Promise<CatalogResult> {
  const [branches, merchantDetails] = await Promise.all([
    fetchMerchantBranches(merchantId),
    fetchMerchantDetails(merchantId),
  ]);

  let coords: { latitude: number; longitude: number } | undefined;
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({});
    if (lastKnown) coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
  } catch {
    coords = undefined;
  }

  const branch =
    branches.find((value) => value.branchId === preferredBranchId)
    ?? resolveMerchantBranch(branches, coords);
  if (!branch) throw new Error('merchant_branch_unavailable');

  const products = await fetchActiveProducts(merchantId, branch.branchId);
  const branchWithPolicy = { ...branch, delayedPaymentEnabled: merchantDetails.delayedPaymentEnabled };

  setBasketMerchantContext({
    merchantId,
    merchantName,
    branchId: branchWithPolicy.branchId,
    branchName: branchWithPolicy.name,
  });

  return { branch: branchWithPolicy, merchantLogoUrl: merchantDetails.logoUrl, products };
}

export function useMerchantCatalog(params: {
  merchantId?: string;
  merchantName?: string;
  preferredBranchId?: string;
}) {
  const { merchantId, merchantName = 'Merchant', preferredBranchId } = params;

  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey: QUERY_KEYS.catalog(merchantId!, preferredBranchId),
    queryFn: () => loadCatalog(merchantId!, merchantName, preferredBranchId),
    enabled: !!merchantId,
    staleTime: STALE_TIMES.PRODUCTS,
  });

  useFocusEffect(
    useCallback(() => {
      if (isStale) void refetch();
    }, [refetch, isStale]),
  );

  const errorKey = !merchantId
    ? 'merchant_unavailable'
    : error
      ? (error instanceof Error && error.message === 'merchant_branch_unavailable'
        ? 'merchant_branch_unavailable'
        : 'merchant_catalog_load_failed')
      : null;

  return {
    loading: isLoading,
    errorKey,
    branch: data?.branch ?? null,
    merchantLogoUrl: data?.merchantLogoUrl,
    products: data?.products ?? [],
    retry: refetch,
  };
}
