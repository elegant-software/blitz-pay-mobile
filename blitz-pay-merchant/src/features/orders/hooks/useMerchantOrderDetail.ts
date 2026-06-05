import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { ActiveBranchScope } from '../../../lib/auth';
import { observability } from '../../../lib/observability';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';
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

const TERMINAL_SETTLEMENT_RETRY_DELAY_MS = 1_500;
const TERMINAL_SETTLEMENT_MAX_ATTEMPTS = 8;

function isEditableStatus(status: MerchantOrderDetail['status']) {
  return status === 'awaiting_payment' || status === 'payment_failed';
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useMerchantOrderDetail(orderId: string, activeBranchScope: ActiveBranchScope | null) {
  const queryClient = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: order, isLoading, error, refetch, isStale } = useQuery({
    queryKey: QUERY_KEYS.orderDetail(orderId),
    queryFn: () => fetchMerchantOrderDetail(orderId, activeBranchScope!),
    enabled: !!activeBranchScope,
    staleTime: STALE_TIMES.ORDER_DETAIL,
  });

  useFocusEffect(
    useCallback(() => {
      if (isStale) void refetch();
    }, [refetch, isStale]),
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
      setMutationError(null);
      observability.info('merchant_order_mutation_started', {
        orderId,
        eventName,
        merchantId: activeBranchScope?.merchantId ?? null,
        branchId: activeBranchScope?.branchId ?? null,
        orderStatus: order.status,
        checkoutIntent: order.checkoutIntent,
        paymentSource: order.paymentSource ?? null,
        itemCount: order.items.length,
      });
      try {
        const nextOrder = await action();
        // Update detail cache directly from the mutation response
        queryClient.setQueryData(QUERY_KEYS.orderDetail(orderId), nextOrder);
        // Invalidate list so status changes are reflected there too
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ordersList(activeBranchScope?.branchId ?? null) });
        observability.info('merchant_order_mutation_applied', {
          orderId: nextOrder.orderId,
          eventName,
          merchantId: activeBranchScope?.merchantId ?? null,
          branchId: activeBranchScope?.branchId ?? null,
          previousStatus: order.status,
          status: nextOrder.status,
          checkoutIntent: nextOrder.checkoutIntent,
          paymentSource: nextOrder.paymentSource ?? null,
          itemCount: nextOrder.items.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'merchant_order_mutation_failed';
        setMutationError(message);
        observability.error('merchant_order_mutation_ui_failed', {
          orderId,
          eventName,
          merchantId: activeBranchScope?.merchantId ?? null,
          branchId: activeBranchScope?.branchId ?? null,
          orderStatus: order.status,
          checkoutIntent: order.checkoutIntent,
          paymentSource: order.paymentSource ?? null,
          itemCount: order.items.length,
          reason: message,
        });
      } finally {
        setMutating(false);
      }
    },
    [order, orderId, queryClient, activeBranchScope],
  );

  const reconcileTerminalPayment = useCallback(async (): Promise<MerchantOrderDetail | null> => {
    if (!activeBranchScope) return null;

    for (let attempt = 1; attempt <= TERMINAL_SETTLEMENT_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await delay(TERMINAL_SETTLEMENT_RETRY_DELAY_MS);
      }

      try {
        const nextOrder = await fetchMerchantOrderDetail(orderId, activeBranchScope);
        queryClient.setQueryData(QUERY_KEYS.orderDetail(orderId), nextOrder);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ordersList(activeBranchScope.branchId) });

        observability.info('merchant_terminal_order_reconcile_result', {
          orderId: nextOrder.orderId,
          attempt,
          status: nextOrder.status,
          paymentSource: nextOrder.paymentSource ?? null,
        });

        if (
          nextOrder.status === 'paid' ||
          nextOrder.status === 'awaiting_payment' ||
          nextOrder.status === 'payment_failed' ||
          nextOrder.status === 'cancelled'
        ) {
          return nextOrder;
        }
      } catch (err) {
        observability.warn('merchant_terminal_order_reconcile_retry', {
          orderId,
          attempt,
          reason: err instanceof Error ? err.message : 'merchant_order_detail_load_failed',
        });
      }
    }

    const result = await refetch();
    return result.data ?? null;
  }, [activeBranchScope, orderId, queryClient, refetch]);

  const loadError = !activeBranchScope
    ? 'merchant_branch_access_missing'
    : error
      ? (error instanceof Error ? error.message : 'merchant_order_detail_load_failed')
      : null;

  return {
    order: order ?? null,
    loading: isLoading,
    mutating,
    error: loadError,
    mutationError,
    reload: refetch,
    reconcileTerminalPayment,
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
    markManuallyPaid: (note?: string) => {
      const trimmedNote = note?.trim();
      observability.info('merchant_manual_settlement_requested', {
        orderId,
        merchantId: activeBranchScope?.merchantId ?? null,
        branchId: activeBranchScope?.branchId ?? null,
        orderStatus: order?.status ?? null,
        checkoutIntent: order?.checkoutIntent ?? null,
        paymentSource: order?.paymentSource ?? null,
        hasNote: Boolean(trimmedNote),
        noteLength: trimmedNote?.length ?? 0,
      });
      return runMutation(
        () => markMerchantOrderManuallyPaid(orderId, { note: trimmedNote }),
        'merchant_manual_settlement',
      );
    },
  };
}
