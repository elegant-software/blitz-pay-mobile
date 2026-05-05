import { useCallback, useEffect, useState } from 'react';
import { fetchMerchantOrders } from '../services/orderService';
import type { MerchantOrderFilter, MerchantOrderSummary } from '../types/order';

export function useMerchantOrders(branchId: string | null, filter: MerchantOrderFilter) {
  const [orders, setOrders] = useState<MerchantOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!branchId) {
      setOrders([]);
      setError('merchant_products_branch_missing');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const allOrders = await fetchMerchantOrders(branchId);
      setOrders(
        filter === 'ALL'
          ? allOrders
          : allOrders.filter((order) => {
              if (filter === 'PROCESSING') return order.status === 'pending' || order.status === 'processing';
              if (filter === 'COMPLETED') return order.status === 'completed';
              return order.status === 'cancelled';
            }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'merchant_orders_load_failed');
    } finally {
      setLoading(false);
    }
  }, [branchId, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { orders, loading, error, reload };
}
