import { useEffect, useState } from 'react';
import { fetchOrderStatus } from '../lib/payments/paymentStatusClient';
import { paymentResultTracker } from '../lib/payments/paymentResultTracker';
import type { PaymentResult, TrackerSource } from '../lib/payments/types';

export type UsePaymentResultState =
  | { status: 'processing' }
  | { status: 'timeout' }
  | {
      status: 'succeeded' | 'failed' | 'cancelled';
      result: PaymentResult;
      source: TrackerSource;
    };

export function usePaymentResult(
  paymentRequestId: string | undefined,
  orderId?: string,
): UsePaymentResultState {
  const [state, setState] = useState<UsePaymentResultState>({ status: 'processing' });
  const [trackedPaymentRequestId, setTrackedPaymentRequestId] = useState<string | undefined>(
    paymentRequestId,
  );

  useEffect(() => {
    setTrackedPaymentRequestId(paymentRequestId);
  }, [paymentRequestId]);

  useEffect(() => {
    if (!orderId || trackedPaymentRequestId) return;
    let active = true;

    const inspectOrder = async () => {
      const outcome = await fetchOrderStatus(orderId);
      if (!active) return;
      if (outcome.kind === 'terminal') {
        setState({
          status: outcome.result.status,
          result: outcome.result,
          source: 'recovered',
        });
        return;
      }
      if (outcome.paymentRequestId) {
        if (!paymentResultTracker.isTracking(outcome.paymentRequestId)) {
          void paymentResultTracker.start(outcome.paymentRequestId);
        }
        setTrackedPaymentRequestId(outcome.paymentRequestId);
      }
    };

    void inspectOrder();
    const interval = setInterval(() => {
      void inspectOrder();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId, trackedPaymentRequestId]);

  useEffect(() => {
    if (!trackedPaymentRequestId) return;
    let active = true;

    const unsubscribe = paymentResultTracker.subscribe((resolution) => {
      if (!active) return;
      if (resolution.kind === 'timeout') {
        if (resolution.paymentRequestId !== trackedPaymentRequestId) return;
        setState({ status: 'timeout' });
        return;
      }
      if (resolution.result.paymentRequestId !== trackedPaymentRequestId) return;
      setState({
        status: resolution.result.status,
        result: resolution.result,
        source: resolution.source,
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [trackedPaymentRequestId]);

  return state;
}
