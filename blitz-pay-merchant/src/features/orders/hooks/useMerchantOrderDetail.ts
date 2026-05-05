import { useEffect, useState } from 'react';
import { fetchMerchantOrderDetail } from '../services/orderService';
import type { MerchantOrderDetail } from '../types/order';

export function useMerchantOrderDetail(orderId: string) {
  const [order, setOrder] = useState<MerchantOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchMerchantOrderDetail(orderId)
      .then((nextOrder) => {
        if (active) setOrder(nextOrder);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'merchant_order_detail_load_failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  return { order, loading, error };
}
