import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchMerchantOrders } from '../services/orderService';
import type { MerchantOrderFilter, MerchantOrderSummary } from '../types/order';

export function useMerchantOrders(branchId: string | null, filter: MerchantOrderFilter) {
  const [orders, setOrders] = useState<MerchantOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!branchId) {
      setOrders([]);
      setError('merchant_branch_access_missing');
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
              if (filter === 'PROCESSING') {
                return order.status === 'awaiting_payment' || order.status === 'payment_in_progress' || order.status === 'payment_failed';
              }
              if (filter === 'COMPLETED') return order.status === 'paid';
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

  useFocusEffect(
    useCallback(() => {
      void reload();
      const interval = setInterval(() => {
        void reload();
      }, 5000);

      return () => {
        clearInterval(interval);
      };
    }, [reload]),
  );

  return { orders, loading, error, reload };
}
