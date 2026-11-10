import { useCallback } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchActiveProducts,
  fetchMerchantBranches,
  fetchMerchantDetails,
  fetchMerchantStripeConnectStatus,
  resolveMerchantBranch,
  MerchantCatalogError,
} from '../services/merchantCatalogService';
import type { ActiveProduct, MerchantBranch } from '../types/catalog';
import { setBasketMerchantContext } from '../../basket/store/basketStore';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';

type CatalogResult = {
  branch: MerchantBranch;
  merchantLogoUrl?: string;
  appointmentsEnabled?: boolean;
  products: ActiveProduct[];
};

async function loadCatalog(
  merchantId: string,
  merchantName: string,
  preferredBranchId?: string,
  includeProducts = true,
): Promise<CatalogResult> {
  const [branches, merchantDetails, stripeStatus] = await Promise.all([
    fetchMerchantBranches(merchantId),
    fetchMerchantDetails(merchantId),
    fetchMerchantStripeConnectStatus(merchantId),
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
  if (!branch) throw new MerchantCatalogError('merchant_branch_unavailable');

  const products = includeProducts ? await fetchActiveProducts(merchantId, branch.branchId) : [];
  const branchWithPolicy = {
    ...branch,
    delayedPaymentEnabled: merchantDetails.delayedPaymentEnabled,
    activePaymentChannels: [
      ...(stripeStatus?.charges_enabled === true ? ['STRIPE' as const] : []),
      ...(stripeStatus?.pay_by_bank_enabled === true ? ['PAY_BY_BANK' as const] : []),
      ...(stripeStatus?.tap_to_pay_enabled === true ? ['TAP_TO_PAY' as const] : []),
    ] as MerchantBranch['activePaymentChannels'],
  };

  setBasketMerchantContext({
    merchantId,
    merchantName,
    branchId: branchWithPolicy.branchId,
    branchName: branchWithPolicy.name,
  });

  return { branch: branchWithPolicy, merchantLogoUrl: merchantDetails.logoUrl, appointmentsEnabled: merchantDetails.appointmentsEnabled, products };
}

export function useMerchantCatalog(params: {
  merchantId?: string;
  merchantName?: string;
  preferredBranchId?: string;
  contextOnly?: boolean;
}) {
  const { merchantId, merchantName = 'Merchant', preferredBranchId, contextOnly = false } = params;

  const { data, isLoading, error, refetch, isStale } = useQuery({
    queryKey: contextOnly ? [...QUERY_KEYS.catalog(merchantId!, preferredBranchId), 'context'] : QUERY_KEYS.catalog(merchantId!, preferredBranchId),
    queryFn: () => loadCatalog(merchantId!, merchantName, preferredBranchId, !contextOnly),
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
    errorDetail: error instanceof MerchantCatalogError ? error.detail : undefined,
    branch: data?.branch ?? null,
    merchantLogoUrl: data?.merchantLogoUrl,
    appointmentsEnabled: data?.appointmentsEnabled ?? false,
    products: data?.products ?? [],
    retry: refetch,
  };
}
