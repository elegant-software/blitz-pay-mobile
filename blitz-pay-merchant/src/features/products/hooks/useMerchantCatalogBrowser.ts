import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ActiveBranchScope } from '../../../lib/auth';
import { fetchCatalogProductPage, fetchBranchCatalogCategories, MerchantProductError } from '../../../lib/merchantProducts';
import { useCatalogSelection } from '../store/catalogBrowserStore';
import { UNCATEGORIZED_CATEGORY } from '../types/catalog';
import { STALE_TIMES } from '../../../lib/queryClient';

export function useMerchantCatalogBrowser(activeBranchScope: ActiveBranchScope | null, branchScopeError: string | null) {
  const merchantId = activeBranchScope?.merchantId;
  const branchId = activeBranchScope?.branchId;
  const enabled = !!merchantId && !!branchId;
  const selection = useCatalogSelection(JSON.stringify([merchantId, branchId]));
  const categories = useQuery({
    queryKey: ['branch-catalog-categories-v1', merchantId, branchId],
    queryFn: () => fetchBranchCatalogCategories(merchantId!, branchId!),
    enabled,
    staleTime: STALE_TIMES.PRODUCTS,
  });
  const selected = selection.categoryId;
  const validSelection = selected === '' ||
    (selected === UNCATEGORIZED_CATEGORY && (categories.data?.uncategorizedCount ?? 0) > 0) ||
    categories.data?.categories.some(category => category.id === selected);
  const categoryId = selected !== undefined && validSelection ? selected : '';
  const products = useInfiniteQuery({
    queryKey: ['products', merchantId, branchId, 'catalog-pages-v1', categoryId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchCatalogProductPage(merchantId!, branchId!, {
      categoryId: categoryId && categoryId !== UNCATEGORIZED_CATEGORY ? categoryId : undefined,
      uncategorized: categoryId === UNCATEGORIZED_CATEGORY,
      cursor: pageParam,
    }),
    getNextPageParam: page => page.hasMore ? page.nextCursor ?? undefined : undefined,
    enabled: enabled && !!categories.data,
    staleTime: STALE_TIMES.PRODUCTS,
  });
  useFocusEffect(useCallback(() => {
    if (enabled && categories.isStale) void categories.refetch();
    if (enabled && categories.data && products.isStale) void products.refetch();
  }, [enabled, categories.isStale, categories.data, categories.refetch, products.isStale, products.refetch]));
  const items = useMemo(() => Array.from(new Map(
    (products.data?.pages.flatMap(page => page.items) ?? []).map(product => [product.id, product]),
  ).values()), [products.data]);
  const fatalError = (!categories.data && categories.error) || (!products.data && products.error);
  const backgroundError = (categories.data && categories.error) || (products.data && products.error);
  const errorKey = (!activeBranchScope ? branchScopeError ?? 'merchant_products_branch_missing' : null) ?? (fatalError ? 'merchant_products_load_failed' : null);
  const retry = async () => {
    if (!enabled) return;
    if (categories.isError) await categories.refetch();
    else if (products.error instanceof MerchantProductError && products.error.code === 'INVALID_CATALOG_CURSOR') await products.refetch();
    else if (products.isFetchNextPageError) await products.fetchNextPage();
    else await products.refetch();
  };
  return {
    categories: categories.data?.categories ?? [],
    uncategorizedCount: categories.data?.uncategorizedCount ?? 0,
    categoryId,
    selectCategory: selection.selectCategory,
    products: items,
    loading: enabled && ((!categories.data && categories.isPending) || (!!categories.data && products.isPending)),
    refreshing: products.isRefetching,
    loadingMore: products.isFetchingNextPage,
    hasMore: products.hasNextPage ?? false,
    errorKey,
    errorDetail: fatalError instanceof MerchantProductError ? fatalError.detail : undefined,
    pageErrorKey: backgroundError ? 'merchant_products_load_failed' : null,
    pageErrorDetail: backgroundError instanceof MerchantProductError ? backgroundError.detail : undefined,
    loadMore: () => {
      if (products.hasNextPage && !products.isFetching && !products.isError) void products.fetchNextPage();
    },
    retry,
    reload: async () => {
      if (enabled) await Promise.all([categories.refetch(), products.refetch()]);
    },
  };
}
