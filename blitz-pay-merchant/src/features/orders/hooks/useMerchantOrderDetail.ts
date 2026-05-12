import { useEffect, useState } from 'react';
import type { ActiveBranchScope } from '../../../lib/auth';
import { fetchMerchantOrderDetail } from '../services/orderService';
import type { MerchantOrderDetail } from '../types/order';

export function useMerchantOrderDetail(orderId: string, activeBranchScope: ActiveBranchScope | null) {
  const [order, setOrder] = useState<MerchantOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!activeBranchScope) {
      setOrder(null);
      setError('merchant_branch_access_missing');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    void fetchMerchantOrderDetail(orderId, activeBranchScope)
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
  }, [activeBranchScope, orderId]);

  return { order, loading, error };
}
