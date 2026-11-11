import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../lib/LanguageContext';
import { fetchActiveProducts } from '../../merchant-catalog/services/merchantCatalogService';
import type { BasketCheckoutItemSummary } from '../types/basket';

export function useLocalizedCheckoutItems(
  items: BasketCheckoutItemSummary[], merchantId?: string, branchId?: string, enabled = true,
) {
  const { language } = useLanguage();
  const products = useQuery({
    queryKey: ['basket-language', merchantId, branchId, language],
    queryFn: () => fetchActiveProducts(merchantId!, branchId!, undefined, language),
    enabled: enabled && !!merchantId && !!branchId && items.length > 0,
  });
  const byId = new Map((enabled ? products.data ?? [] : []).map(product => [product.productId, product]));
  return items.map(item => ({ ...item, productName: byId.get(item.productId)?.name ?? item.productName }));
}
