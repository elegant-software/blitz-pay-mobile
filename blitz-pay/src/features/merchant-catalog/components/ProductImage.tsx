import React from 'react';
import { Image, type ImageProps, type ImageSource } from 'expo-image';
import { useProductImage } from '../hooks/useProductImage';

type ProductImageProps = Omit<ImageProps, 'source'> & {
  source: ImageSource;
  merchantId?: string;
  branchId?: string;
  productId?: string;
  variant?: 'thumbnail' | 'detail';
};

export function ProductImage({ source, merchantId, branchId, productId, variant = 'detail', onError, ...props }: ProductImageProps) {
  const { imageUrl, refresh } = useProductImage({ merchantId, branchId, productId, variant, imageUrl: source.uri });
  return (
    <Image
      {...props}
      source={{ ...source, uri: imageUrl }}
      recyclingKey={`${productId}:${variant}:${imageUrl}`}
      onError={event => {
        onError?.({ ...event, error: event.error.replace(/https?:\/\/[^\s]+/g, url => url.split('?')[0]) });
        void refresh();
      }}
    />
  );
}
