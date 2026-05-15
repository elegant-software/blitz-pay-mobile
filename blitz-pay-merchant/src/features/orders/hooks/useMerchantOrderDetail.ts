import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { ActiveBranchScope } from '../../../lib/auth';
import { observability } from '../../../lib/observability';
import {
  addMerchantOrderItem,
  cancelMerchantOrder,
  fetchMerchantOrderDetail,
  markMerchantOrderManuallyPaid,
  overrideMerchantOrderLinePrice,
  removeMerchantOrderLine,
  updateMerchantOrderLineQuantity,
} from '../services/orderService';
import type { MerchantOrderDetail } from '../types/order';

function isEditableStatus(status: MerchantOrderDetail['status']) {
  return status === 'awaiting_payment' || status === 'payment_failed';
}

export function useMerchantOrderDetail(orderId: string, activeBranchScope: ActiveBranchScope | null) {
  const [order, setOrder] = useState<MerchantOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!activeBranchScope) {
      setOrder(null);
      setError('merchant_branch_access_missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextOrder = await fetchMerchantOrderDetail(orderId, activeBranchScope);
      setOrder(nextOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'merchant_order_detail_load_failed');
    } finally {
      setLoading(false);
    }
  }, [activeBranchScope, orderId]);

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

  const runMutation = useCallback(
    async (action: () => Promise<MerchantOrderDetail>, eventName: string): Promise<void> => {
      if (!order || !isEditableStatus(order.status)) {
        observability.warn('merchant_order_edit_blocked', {
          orderId,
          status: order?.status ?? null,
          eventName,
        });
        throw new Error('merchant_order_edit_blocked');
      }

      setMutating(true);
      setError(null);
      try {
        const nextOrder = await action();
        setOrder(nextOrder);
        observability.info('merchant_order_mutation_applied', {
          orderId: nextOrder.orderId,
          eventName,
          status: nextOrder.status,
          itemCount: nextOrder.items.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'merchant_order_mutation_failed';
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setMutating(false);
      }
    },
    [order, orderId],
  );

  return {
    order,
    loading,
    mutating,
    error,
    reload,
    addItem: (productId: string, quantity: number) =>
      runMutation(() => addMerchantOrderItem(orderId, { productId, quantity }), 'merchant_add_item'),
    updateLineQuantity: (lineId: string, quantity: number) =>
      runMutation(
        () => updateMerchantOrderLineQuantity(orderId, { lineId, quantity }),
        'merchant_update_line_quantity',
      ),
    removeLine: (lineId: string) =>
      runMutation(() => removeMerchantOrderLine(orderId, lineId), 'merchant_remove_line'),
    overrideLinePrice: (lineId: string, unitPriceMinor: number) =>
      runMutation(
        () => overrideMerchantOrderLinePrice(orderId, { lineId, unitPriceMinor }),
        'merchant_override_line_price',
      ),
    cancelOrder: () => runMutation(() => cancelMerchantOrder(orderId), 'merchant_cancel_order'),
    markManuallyPaid: (note?: string) =>
      runMutation(
        () => markMerchantOrderManuallyPaid(orderId, { note }),
        'merchant_manual_settlement',
      ),
  };
}
