import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchCatalogProductDetail as fetchProductDetail } from '../services/merchantCatalogService';
import { observability } from '../../../lib/observability';

type ProductImageContext = {
  merchantId?: string;
  branchId?: string;
  productId?: string;
  imageUrl?: string;
  variant?: 'thumbnail' | 'detail';
};

export function useProductImage({ merchantId, branchId, productId, imageUrl, variant = 'detail' }: ProductImageContext) {
  const queryClient = useQueryClient();
  const attempted = useRef(new Set<string>());
  const [replacement, setReplacement] = useState<{ key: string; uri: string } | null>(null);
  const key = JSON.stringify([merchantId, branchId, productId, imageUrl, variant]);

  const refresh = useCallback(async () => {
    if (!merchantId || !branchId || !productId || !imageUrl || attempted.current.has(key)) return;
    try {
      if (!new URL(imageUrl).searchParams.has('X-Amz-Signature')) return;
    } catch {
      return;
    }
    attempted.current.add(key);
    const context = { merchantId, branchId, productId };
    observability.info('product_image_url_refresh_requested', context);
    try {
      const product = await queryClient.fetchQuery({
        queryKey: ['product-image-refresh', merchantId, branchId, productId],
        queryFn: () => fetchProductDetail(merchantId, branchId, productId),
        staleTime: 5_000,
        gcTime: 60_000,
        retry: false,
      });
      const freshUrl = variant === 'thumbnail' && product.thumbnailUrl !== imageUrl
        ? product.thumbnailUrl ?? product.imageUrl : product.imageUrl;
      const changed = Boolean(freshUrl && freshUrl !== imageUrl);
      if (changed) setReplacement({ key, uri: freshUrl! });
      observability.info('product_image_url_refresh_completed', { ...context, changed });
    } catch (error) {
      observability.warn('product_image_url_refresh_failed', {
        ...context,
        reason: error instanceof Error ? error.name : 'unknown_error',
      });
    }
  }, [merchantId, branchId, productId, imageUrl, variant, key, queryClient]);

  return { imageUrl: replacement?.key === key ? replacement.uri : imageUrl, refresh };
}
