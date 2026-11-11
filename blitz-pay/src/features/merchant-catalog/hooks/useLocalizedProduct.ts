import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../lib/LanguageContext';
import { fetchCatalogProductDetail, MerchantCatalogError } from '../services/merchantCatalogService';

export function useLocalizedProduct(merchantId: string, branchId: string, productId: string) {
  const { language } = useLanguage();
  const query = useQuery({
    queryKey: ['catalog-product', merchantId, branchId, productId, language],
    queryFn: () => fetchCatalogProductDetail(merchantId, branchId, productId, language),
  });
  return {
    product: query.data,
    error: query.error,
    errorDetail: query.error instanceof MerchantCatalogError ? query.error.detail : undefined,
    retry: query.refetch,
  };
}
