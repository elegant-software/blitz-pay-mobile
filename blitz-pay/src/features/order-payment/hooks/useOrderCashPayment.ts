import { useCallback, useEffect, useState } from 'react';
import { fetchMerchantBranch } from '../../merchant-catalog/services/merchantCatalogService';
import { fetchOrder } from '../services/orderPaymentService';
import { isOrderResumable, type OrderSummary } from '../types/orderPayment';
import { observability } from '../../../lib/observability';

export function useOrderCashPayment(currentOrder: OrderSummary | null) {
  const [resolvedScope, setResolvedScope] = useState<string | null>(null);
  const scope = currentOrder?.branchId ? `${currentOrder.merchantId}:${currentOrder.branchId}` : null;
  const eligible = currentOrder?.checkoutIntent === 'PAY_LATER' && isOrderResumable(currentOrder.status);
  useEffect(() => {
    let active = true;
    setResolvedScope(null);
    if (eligible && currentOrder?.branchId) {
      void fetchMerchantBranch(currentOrder.merchantId, currentOrder.branchId).then((branch) => {
        if (active && branch.active && branch.merchantId === currentOrder.merchantId && branch.branchId === currentOrder.branchId) {
          setResolvedScope(scope);
        }
      }).catch((error: unknown) => {
        observability.warn('order_cash_eligibility_failed', {
          merchantId: currentOrder.merchantId, branchId: currentOrder.branchId,
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return () => { active = false; };
  }, [scope, eligible, currentOrder?.merchantId, currentOrder?.branchId]);

  const payCashToStaff = useCallback(async (orderId: string): Promise<OrderSummary> => {
    observability.info('order_cash_requested', { orderId });
    try {
      const order = await fetchOrder(orderId);
      if (!isOrderResumable(order.status) || order.checkoutIntent !== 'PAY_LATER' || !order.branchId) {
        throw new Error('order_not_payable');
      }
      const branch = await fetchMerchantBranch(order.merchantId, order.branchId);
      if (!branch.active || branch.merchantId !== order.merchantId || branch.branchId !== order.branchId) {
        throw new Error('payment_option_unavailable');
      }
      observability.info('order_cash_awaiting_staff', {
        orderId, merchantId: order.merchantId, branchId: order.branchId, status: order.status,
      });
      return order;
    } catch (error) {
      observability.error('order_cash_failed', {
        orderId, reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);
  return { cashAvailable: Boolean(eligible && scope && resolvedScope === scope), payCashToStaff };
}
