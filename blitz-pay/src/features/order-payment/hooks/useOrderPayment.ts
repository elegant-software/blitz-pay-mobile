import { useCallback } from 'react';
import { registerDeviceForPayment } from '../../../lib/notifications/pushRegistration';
import { observability } from '../../../lib/observability';
import { paymentResultTracker } from '../../../lib/payments/paymentResultTracker';
import { createTrueLayerPayment, runTrueLayerSdk } from '../../../lib/truelayer';
import { useBraintreePayPal } from '../../../hooks/useBraintreePayPal';
import { useStripePayment } from '../../../hooks/useStripePayment';
import type { RootStackNav } from '../../../types';
import { createOrder, createStripeIntentForOrder, fetchOrder } from '../services/orderPaymentService';
import { orderPaymentStore } from '../store/orderPaymentStore';
import {
  isMethodAvailable,
  isOrderResumable,
  mapMethodToOrderPaymentMethod,
  mapMethodToChannel,
  mapOrderStatusToPaymentResult,
  type CheckoutPaymentMethod,
  type OrderPaymentChannel,
  type ResumeOrderPaymentArgs,
  type OrderPaymentSession,
} from '../types/orderPayment';

interface ConfirmCheckoutArgs {
  token: string | null;
  amount: number;
  merchantName: string;
  merchantId?: string;
  branchId?: string;
  branchName?: string;
  merchantLogoUrl?: string;
  basketSummary?: string;
  basketItemCount: number;
  basketItems: Array<{
    productId: string;
    merchantId: string;
    branchId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl?: string;
  }>;
  invoiceId?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
  selectedMethod: CheckoutPaymentMethod | null;
  availableChannels: OrderPaymentChannel[];
  navigation: RootStackNav;
}

function canReuseSession(
  session: OrderPaymentSession | undefined,
  args: ConfirmCheckoutArgs,
  method: CheckoutPaymentMethod,
): session is OrderPaymentSession {
  if (!session) return false;
  return (
    session.merchantId === args.merchantId &&
    session.branchId === args.branchId &&
    session.amount === args.amount &&
    session.selectedMethod === method &&
    session.basketItemCount === args.basketItemCount &&
    session.orderStatus !== 'PAID' &&
    session.orderStatus !== 'CANCELLED'
  );
}

export function useOrderPayment() {
  const { initializePayment, openPaymentSheet } = useStripePayment();
  const { presentPayPal } = useBraintreePayPal();

  const confirmCheckout = useCallback(
    async (args: ConfirmCheckoutArgs): Promise<void> => {
      if (!args.selectedMethod) {
        throw new Error('payment_option_required');
      }
      if (!args.merchantId) {
        throw new Error('merchant_unavailable');
      }
      if (!isMethodAvailable(args.selectedMethod, args.availableChannels)) {
        throw new Error('payment_option_unavailable');
      }

      const selectedChannel = mapMethodToChannel(args.selectedMethod);
      let session = orderPaymentStore.getActiveSession();

      if (!canReuseSession(session, args, args.selectedMethod)) {
        const order = await createOrder({
          paymentMethod: mapMethodToOrderPaymentMethod(args.selectedMethod),
          items: args.basketItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });

        session = {
          orderId: order.orderId,
          merchantId: args.merchantId,
          merchantName: args.merchantName,
          branchId: args.branchId,
          branchName: args.branchName,
          amount: args.amount,
          currency: order.currency,
          basketSummary: args.basketSummary,
          basketItemCount: args.basketItemCount,
          basketItems: args.basketItems,
          selectedMethod: args.selectedMethod,
          selectedChannel,
          orderStatus: order.status,
          paymentRequestId: order.lastPaymentRequestId,
          paymentProvider: order.lastPaymentProvider,
        };
        orderPaymentStore.saveSession(session);
        observability.info('order_payment_session_created', {
          orderId: order.orderId,
          merchantId: order.merchantId,
          branchId: order.branchId ?? null,
          orderStatus: order.status,
          shopperUserId: args.user?.id ?? null,
          shopperEmailHint: args.user?.email ? args.user.email.slice(0, 80) : null,
          paymentMethod: args.selectedMethod,
          paymentChannel: selectedChannel,
        });
      }

      const orderLinkedPaymentRequestId = session.paymentRequestId;

      observability.info('order_payment_handoff_started', {
        orderId: session.orderId,
        paymentChannel: session.selectedChannel,
        merchantId: session.merchantId,
        branchId: session.branchId ?? null,
      });

      if (args.selectedMethod === 'bank') {
        const context = await createTrueLayerPayment({
          token: args.token,
          amount: args.amount,
          merchantName: args.merchantName,
          orderId: session.orderId,
          merchantId: args.merchantId,
          branchId: args.branchId,
          itemSummary: args.basketSummary,
          itemCount: args.basketItemCount,
          invoiceId: args.invoiceId,
          currency: session.currency,
          user: args.user,
        });

        orderPaymentStore.patchSession(session.orderId, {
          paymentRequestId: context.paymentRequestId,
          paymentProvider: 'TRUELAYER',
          orderStatus: 'PAYMENT_IN_PROGRESS',
        });

        void registerDeviceForPayment(session.orderId);
        void paymentResultTracker.start(context.paymentRequestId);

        args.navigation.replace('PaymentProcessing', {
          paymentRequestId: context.paymentRequestId,
          orderId: session.orderId,
          amount: args.amount,
          currency: session.currency,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
          invoiceId: args.invoiceId,
        });

        void runTrueLayerSdk(context).catch((err: unknown) => {
          const key = err instanceof Error ? err.message : 'truelayer_reason_unknown';
          if (key === 'truelayer_cancelled') {
            paymentResultTracker.applyRecoveredResult({
              paymentRequestId: context.paymentRequestId,
              orderId: session.orderId,
              provider: 'TRUELAYER',
              status: 'cancelled',
              reason: 'UserAborted',
            });
          }
        });
        return;
      }

      if (args.selectedMethod === 'card') {
        const stripeParams = await createStripeIntentForOrder({
          orderId: session.orderId,
          merchantId: args.merchantId,
          branchId: args.branchId,
          productId: args.basketItems[0]?.productId,
        });
        orderPaymentStore.patchSession(session.orderId, {
          paymentRequestId: stripeParams.paymentRequestId,
          paymentProvider: 'STRIPE',
          orderStatus: 'PAYMENT_IN_PROGRESS',
        });
        void registerDeviceForPayment(session.orderId);
        await initializePayment(stripeParams);
        const result = await openPaymentSheet();
        const refreshed = await fetchOrder(session.orderId).catch(() => null);

        if (refreshed) {
          orderPaymentStore.patchSession(session.orderId, {
            orderStatus: refreshed.status,
            paymentRequestId: refreshed.lastPaymentRequestId,
            paymentProvider: refreshed.lastPaymentProvider,
          });
        }

        if (result.status === 'failed') {
          throw new Error(result.error ?? 'payment_failed');
        }
        if (result.status === 'canceled') {
          const cancelledPaymentRequestId =
            refreshed?.lastPaymentRequestId ?? stripeParams.paymentRequestId ?? session.paymentRequestId ?? session.orderId;
          args.navigation.replace('PaymentResult', {
            paymentRequestId: cancelledPaymentRequestId,
            orderId: session.orderId,
            status: 'cancelled',
            amount: args.amount,
            currency: session.currency,
            merchantName: args.merchantName,
            branchName: args.branchName,
            merchantLogoUrl: args.merchantLogoUrl,
          });
          return;
        }

        const paymentRequestId =
          refreshed?.lastPaymentRequestId ?? stripeParams.paymentRequestId ?? session.paymentRequestId;
        if (paymentRequestId && refreshed && refreshed.status !== 'PAID' && refreshed.status !== 'CANCELLED') {
          if (!paymentResultTracker.isTracking(paymentRequestId)) {
            void paymentResultTracker.start(paymentRequestId);
          }
          args.navigation.replace('PaymentProcessing', {
            paymentRequestId,
            orderId: session.orderId,
            amount: args.amount,
            currency: session.currency,
            merchantName: args.merchantName,
            branchName: args.branchName,
            merchantLogoUrl: args.merchantLogoUrl,
          });
          return;
        }

        const resultStatus = refreshed
          ? mapOrderStatusToPaymentResult(refreshed.status)
          : 'succeeded';
        args.navigation.replace('PaymentResult', {
          paymentRequestId: paymentRequestId ?? session.orderId,
          orderId: session.orderId,
          status: resultStatus === 'processing' || resultStatus === 'pending' ? 'succeeded' : resultStatus,
          amount: args.amount,
          currency: session.currency,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
        });
        return;
      }

      void registerDeviceForPayment(session.orderId);
      const result = await presentPayPal({
        paymentRequestId: orderLinkedPaymentRequestId ?? undefined,
        amount: args.amount,
        currency: session.currency,
        invoiceId: args.invoiceId,
        orderId: session.orderId,
        merchantId: args.merchantId,
        branchId: args.branchId,
        productId: args.basketItems[0]?.productId,
      });
      if (result.paymentRequestId) {
        orderPaymentStore.patchSession(session.orderId, {
          paymentRequestId: result.paymentRequestId,
          paymentProvider: 'BRAINTREE',
          orderStatus: 'PAYMENT_IN_PROGRESS',
        });
      }
      const refreshed = await fetchOrder(session.orderId).catch(() => null);

      if (refreshed) {
        orderPaymentStore.patchSession(session.orderId, {
          orderStatus: refreshed.status,
          paymentRequestId: refreshed.lastPaymentRequestId,
          paymentProvider: refreshed.lastPaymentProvider,
        });
      }

      const trackedPaymentRequestId =
        refreshed?.lastPaymentRequestId ?? result.paymentRequestId ?? session.paymentRequestId ?? orderLinkedPaymentRequestId;
      if (trackedPaymentRequestId && refreshed && refreshed.status !== 'PAID' && refreshed.status !== 'CANCELLED') {
        if (!paymentResultTracker.isTracking(trackedPaymentRequestId)) {
          void paymentResultTracker.start(trackedPaymentRequestId);
        }
        args.navigation.replace('PaymentProcessing', {
          paymentRequestId: trackedPaymentRequestId,
          orderId: session.orderId,
          amount: args.amount,
          currency: session.currency,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
        });
        return;
      }

      const resultStatus =
        result.status === 'failed'
          ? 'failed'
          : result.status === 'cancelled'
            ? 'cancelled'
            : refreshed
              ? mapOrderStatusToPaymentResult(refreshed.status)
              : 'succeeded';

      args.navigation.replace('PaymentResult', {
        paymentRequestId: trackedPaymentRequestId ?? session.orderId,
        orderId: session.orderId,
        status: resultStatus === 'processing' || resultStatus === 'pending' ? 'succeeded' : resultStatus,
        amount: args.amount,
        currency: session.currency,
        merchantName: args.merchantName,
        branchName: args.branchName,
        merchantLogoUrl: args.merchantLogoUrl,
        reason: result.status === 'failed' ? result.error : undefined,
      });
    },
    [initializePayment, openPaymentSheet, presentPayPal],
  );

  const resumeOrderPayment = useCallback(
    async (args: ResumeOrderPaymentArgs): Promise<void> => {
      if (!isMethodAvailable(args.selectedMethod, args.availableChannels)) {
        throw new Error('payment_option_unavailable');
      }
      if (!isOrderResumable(args.order.status)) {
        throw new Error('order_not_payable');
      }

      const selectedChannel = mapMethodToChannel(args.selectedMethod);
      const amount = args.order.totalAmountMinor / 100;
      const session: OrderPaymentSession = {
        orderId: args.order.orderId,
        merchantId: args.order.merchantId,
        merchantName: args.merchantName,
        branchId: args.order.branchId,
        branchName: args.branchName,
        amount,
        currency: args.order.currency,
        basketSummary: args.order.items.map((item) => `${item.quantity}x ${item.name}`).join(', '),
        basketItemCount: args.order.items.reduce((total, item) => total + item.quantity, 0),
        basketItems: args.order.items.map((item) => ({
          productId: item.productId,
          merchantId: args.order.merchantId,
          branchId: args.order.branchId ?? '',
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPriceMinor / 100,
          lineTotal: item.lineTotalMinor / 100,
        })),
        selectedMethod: args.selectedMethod,
        selectedChannel,
        orderStatus: args.order.status,
        paymentRequestId: args.order.lastPaymentRequestId,
        paymentProvider: args.order.lastPaymentProvider,
      };
      orderPaymentStore.saveSession(session);

      return confirmCheckout({
        token: args.token,
        amount,
        merchantName: args.merchantName,
        merchantId: args.order.merchantId,
        branchId: args.order.branchId,
        branchName: args.branchName,
        merchantLogoUrl: args.merchantLogoUrl,
        basketSummary: session.basketSummary,
        basketItemCount: session.basketItemCount,
        basketItems: session.basketItems,
        invoiceId: args.invoiceId,
        user: args.user,
        selectedMethod: args.selectedMethod,
        availableChannels: args.availableChannels,
        navigation: args.navigation,
      });
    },
    [confirmCheckout],
  );

  return {
    confirmCheckout,
    resumeOrderPayment,
  };
}
