import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveProducts, MerchantCatalogError } from '../../merchant-catalog/services/merchantCatalogService';
import { getBasketSnapshot, subscribeBasket, localizeBasketProducts } from '../store/basketStore';
import type { Language } from '../../../lib/translations';

export function useBasketLanguage(language: Language, authenticated: boolean) {
  const basket = useSyncExternalStore(subscribeBasket, getBasketSnapshot, getBasketSnapshot);
  const { merchantId, branchId } = basket;
  const products = useQuery({
    queryKey: ['basket-language', merchantId, branchId, language],
    queryFn: () => fetchActiveProducts(merchantId!, branchId!, undefined, language),
    enabled: authenticated && !!merchantId && !!branchId && basket.items.length > 0,
  });
  useEffect(() => {
    if (merchantId && branchId && products.data) localizeBasketProducts(merchantId, branchId, products.data);
  }, [merchantId, branchId, products.data, basket.items]);
  return { ...products, errorDetail: products.error instanceof MerchantCatalogError ? products.error.detail : undefined };
}
