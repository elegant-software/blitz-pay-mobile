import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchBranchProducts as fetchProducts } from '../../../lib/merchantProducts';
import { observability } from '../../../lib/observability';

type ProductImageContext = {
  merchantId?: string;
  branchId?: string;
  productId?: string;
  imageUrl?: string;
};

export function useProductImage({ merchantId, branchId, productId, imageUrl }: ProductImageContext) {
  const queryClient = useQueryClient();
  const attempted = useRef(new Set<string>());
  const [replacement, setReplacement] = useState<{ key: string; uri: string } | null>(null);
  const key = JSON.stringify([merchantId, branchId, productId, imageUrl]);

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
      const products = await queryClient.fetchQuery({
        queryKey: ['product-image-refresh', merchantId, branchId],
        queryFn: () => fetchProducts(merchantId, branchId),
        staleTime: 5_000,
        gcTime: 60_000,
        retry: false,
      });
      const product = products.find(value => value.id === productId && value.branchId === branchId);
      const freshUrl = product?.imageUrl;
      const changed = Boolean(freshUrl && freshUrl !== imageUrl);
      if (changed) setReplacement({ key, uri: freshUrl! });
      observability.info('product_image_url_refresh_completed', { ...context, changed });
    } catch (error) {
      observability.warn('product_image_url_refresh_failed', {
        ...context,
        reason: error instanceof Error ? error.name : 'unknown_error',
      });
    }
  }, [merchantId, branchId, productId, imageUrl, key, queryClient]);

  return { imageUrl: replacement?.key === key ? replacement.uri : imageUrl, refresh };
}
