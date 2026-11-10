import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchCatalogProductPage, fetchBranchCatalogCategories, MerchantCatalogError } from '../services/merchantCatalogService';
import { useCatalogSelection } from '../store/catalogBrowserStore';
import { UNCATEGORIZED_CATEGORY } from '../types/catalog';
import { STALE_TIMES } from '../../../lib/queryClient';

export function useCatalogBrowser(merchantId?: string, branchId?: string) {
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
  const categoryId = selected !== undefined && validSelection ? selected : categories.data?.categories[0]?.id ?? '';
  const products = useInfiniteQuery({
    queryKey: ['catalog-pages-v1', merchantId, branchId, categoryId],
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
    (products.data?.pages.flatMap(page => page.items) ?? []).map(product => [product.productId, product]),
  ).values()), [products.data]);
  const fatalError = (!categories.data && categories.error) || (!products.data && products.error);
  const backgroundError = (categories.data && categories.error) || (products.data && products.error);
  const errorKey = fatalError ? 'merchant_catalog_load_failed' : null;
  const retry = async () => {
    if (!enabled) return;
    if (categories.isError) await categories.refetch();
    else if (products.error instanceof MerchantCatalogError && products.error.code === 'INVALID_CATALOG_CURSOR') await products.refetch();
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
    errorDetail: fatalError instanceof MerchantCatalogError ? fatalError.detail : undefined,
    pageErrorKey: backgroundError ? 'merchant_catalog_load_failed' : null,
    pageErrorDetail: backgroundError instanceof MerchantCatalogError ? backgroundError.detail : undefined,
    loadMore: () => {
      if (products.hasNextPage && !products.isFetching && !products.isError) void products.fetchNextPage();
    },
    retry,
    reload: async () => {
      if (enabled) await Promise.all([categories.refetch(), products.refetch()]);
    },
  };
}
