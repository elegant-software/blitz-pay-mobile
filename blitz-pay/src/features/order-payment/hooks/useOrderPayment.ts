import { useCallback } from 'react';
import { Linking } from 'react-native';
import { registerDeviceForPayment } from '../../../lib/notifications/pushRegistration';
import { observability } from '../../../lib/observability';
import { paymentResultTracker } from '../../../lib/payments/paymentResultTracker';
import { createTrueLayerPayment, runTrueLayerSdk } from '../../../lib/truelayer';
import { useBraintreePayPal } from '../../../hooks/useBraintreePayPal';
import { useStripePayment } from '../../../hooks/useStripePayment';
import type { RootStackNav } from '../../../types';
import {
  addOrderItem,
  cancelOrder,
  createOrder,
  createStripePayByBankCheckoutForOrder,
  createStripeIntentForOrder,
  fetchOrder,
  removeOrderLine,
  updateOrderLineQuantity,
} from '../services/orderPaymentService';
import { orderPaymentStore } from '../store/orderPaymentStore';
import { captureWalkInLocation } from '../../table-checkin/services/tableCheckInService';
import {
  isMethodAvailable,
  isOrderEditable,
  isOrderResumable,
  mapMethodToBackendCheckoutPaymentMethod,
  mapMethodToChannel,
  mapMethodToOrderPaymentMethod,
  mapOrderStatusToPaymentResult,
  type CheckoutIntent,
  type CheckoutPaymentMethod,
  type OrderPaymentChannel,
  type OrderPaymentSession,
  type OrderSummary,
  type ResumeOrderPaymentArgs,
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
  selectedIntent: CheckoutIntent;
  selectedMethod: CheckoutPaymentMethod | null;
  availableChannels: OrderPaymentChannel[];
  navigation: RootStackNav;
  /** Ordering at a Table: a Walk-In order with fresh geolocation (ADR-0023). */
  table?: { tableCode: string; guestCount?: number };
  /** Cash Payment: the order stays unpaid until staff confirm the cash. */
  payWithCash?: boolean;
}

function toSession(args: ConfirmCheckoutArgs, order: OrderSummary): OrderPaymentSession {
  return {
    orderId: order.orderId,
    merchantId: args.merchantId ?? order.merchantId,
    merchantName: args.merchantName,
    branchId: args.branchId ?? order.branchId,
    branchName: args.branchName,
    checkoutIntent: order.checkoutIntent,
    availableChannels: args.availableChannels,
    amount: args.amount,
    currency: order.currency,
    basketSummary: args.basketSummary,
    basketItemCount: args.basketItemCount,
    basketItems: args.basketItems,
    selectedMethod: args.selectedMethod ?? undefined,
    checkoutPaymentMethod: args.selectedMethod ? mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod) : order.checkoutPaymentMethod,
    selectedChannel: args.selectedMethod ? mapMethodToChannel(args.selectedMethod) : undefined,
    orderStatus: order.status,
    paymentSource: order.paymentSource,
    banner: order.banner,
    updatedAt: order.updatedAt,
    paymentRequestId: order.lastPaymentRequestId,
    paymentProvider: order.lastPaymentProvider,
    retryPreferredMethod: args.selectedMethod ?? undefined,
  };
}

function toResumeSession(args: ResumeOrderPaymentArgs): OrderPaymentSession {
  return {
    orderId: args.order.orderId,
    merchantId: args.order.merchantId,
    merchantName: args.merchantName,
    branchId: args.order.branchId,
    branchName: args.branchName,
    checkoutIntent: args.order.checkoutIntent,
    availableChannels: args.availableChannels,
    amount: args.order.totalAmountMinor / 100,
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
    checkoutPaymentMethod: mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod),
    selectedChannel: mapMethodToChannel(args.selectedMethod),
    orderStatus: args.order.status,
    paymentSource: args.order.paymentSource,
    banner: args.order.banner,
    updatedAt: args.order.updatedAt,
    paymentRequestId: args.order.lastPaymentRequestId,
    paymentProvider: args.order.lastPaymentProvider,
    retryPreferredMethod: args.selectedMethod,
  };
}

export function useOrderPayment() {
  const { initializePayment, openPaymentSheet } = useStripePayment();
  const { presentPayPal } = useBraintreePayPal();

  const startPayment = useCallback(
    async (
      session: OrderPaymentSession,
      args: Omit<ConfirmCheckoutArgs, 'selectedIntent'> & { selectedMethod: CheckoutPaymentMethod },
    ): Promise<void> => {
      const selectedChannel = mapMethodToChannel(args.selectedMethod);
      observability.info('order_payment_handoff_started', {
        orderId: session.orderId,
        paymentChannel: selectedChannel,
        merchantId: session.merchantId,
        branchId: session.branchId ?? null,
        checkoutIntent: session.checkoutIntent,
      });

      if (args.selectedMethod === 'bank') {
        const context = await createTrueLayerPayment({
          token: args.token,
          amount: args.amount,
          merchantName: args.merchantName,
          orderId: session.orderId,
          merchantId: session.merchantId,
          branchId: session.branchId,
          itemSummary: session.basketSummary,
          itemCount: session.basketItemCount,
          invoiceId: args.invoiceId,
          currency: session.currency,
          user: args.user,
        });

        orderPaymentStore.patchSession(session.orderId, {
          availableChannels: args.availableChannels,
          selectedMethod: args.selectedMethod,
          selectedChannel,
          checkoutPaymentMethod: mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod),
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
          merchantId: session.merchantId,
          branchId: session.branchId,
          productId: session.basketItems[0]?.productId,
        });
        orderPaymentStore.patchSession(session.orderId, {
          availableChannels: args.availableChannels,
          selectedMethod: args.selectedMethod,
          selectedChannel,
          checkoutPaymentMethod: mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod),
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
            paymentSource: refreshed.paymentSource,
            checkoutPaymentMethod: refreshed.checkoutPaymentMethod,
            updatedAt: refreshed.updatedAt,
          });
        }

        if (result.status === 'failed') throw new Error(result.error ?? 'payment_failed');
        if (result.status === 'canceled') {
          args.navigation.replace('PaymentResult', {
            paymentRequestId: refreshed?.lastPaymentRequestId ?? stripeParams.paymentRequestId,
            orderId: session.orderId,
            status: 'cancelled',
            amount: args.amount,
            currency: session.currency,
            merchantName: args.merchantName,
            branchName: args.branchName,
            merchantLogoUrl: args.merchantLogoUrl,
            checkoutIntent: session.checkoutIntent,
            paymentSource: refreshed?.paymentSource,
          });
          return;
        }

        const paymentRequestId = refreshed?.lastPaymentRequestId ?? stripeParams.paymentRequestId;
        if (paymentRequestId && refreshed && refreshed.status !== 'PAID' && refreshed.status !== 'CANCELLED') {
          if (!paymentResultTracker.isTracking(paymentRequestId)) void paymentResultTracker.start(paymentRequestId);
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

        const resultStatus = refreshed ? mapOrderStatusToPaymentResult(refreshed.status) : 'succeeded';
        args.navigation.replace('PaymentResult', {
          paymentRequestId,
          orderId: session.orderId,
          status: resultStatus === 'processing' || resultStatus === 'pending' ? 'succeeded' : resultStatus,
          amount: args.amount,
          currency: session.currency,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
          checkoutIntent: session.checkoutIntent,
          paymentSource: refreshed?.paymentSource,
        });
        return;
      }

      if (args.selectedMethod === 'pay_by_bank') {
        const checkout = await createStripePayByBankCheckoutForOrder({
          orderId: session.orderId,
          merchantId: session.merchantId,
          branchId: session.branchId,
          productId: session.basketItems[0]?.productId,
        });
        orderPaymentStore.patchSession(session.orderId, {
          availableChannels: args.availableChannels,
          selectedMethod: args.selectedMethod,
          selectedChannel,
          checkoutPaymentMethod: mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod),
          paymentRequestId: checkout.paymentRequestId,
          paymentProvider: 'STRIPE',
          orderStatus: 'PAYMENT_IN_PROGRESS',
        });
        void registerDeviceForPayment(session.orderId);
        if (!paymentResultTracker.isTracking(checkout.paymentRequestId)) {
          void paymentResultTracker.start(checkout.paymentRequestId);
        }
        args.navigation.replace('PaymentProcessing', {
          paymentRequestId: checkout.paymentRequestId,
          orderId: session.orderId,
          amount: args.amount,
          currency: session.currency,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
          invoiceId: args.invoiceId,
        });
        try {
          await Linking.openURL(checkout.checkoutUrl);
        } catch (err) {
          observability.error(
            'stripe_pay_by_bank_redirect_failed',
            {
              orderId: session.orderId,
              paymentRequestId: checkout.paymentRequestId,
              checkoutUrl: checkout.checkoutUrl,
              message: err instanceof Error ? err.message : String(err),
            },
            err instanceof Error ? err : undefined,
          );
          paymentResultTracker.applyRecoveredResult({
            paymentRequestId: checkout.paymentRequestId,
            orderId: session.orderId,
            provider: 'STRIPE',
            status: 'failed',
            reason: 'redirect_open_failed',
          });
          args.navigation.replace('PaymentResult', {
            paymentRequestId: checkout.paymentRequestId,
            orderId: session.orderId,
            status: 'failed',
            amount: args.amount,
            currency: session.currency,
            merchantName: args.merchantName,
            branchName: args.branchName,
            merchantLogoUrl: args.merchantLogoUrl,
            checkoutIntent: session.checkoutIntent,
            reason: 'stripe_pay_by_bank_redirect_failed',
          });
        }
        return;
      }

      if (args.selectedMethod === 'tap_to_pay') {
        // The merchant's device creates the card_present intent and collects the physical payment.
        // The order stays in PENDING_PAYMENT so the merchant can see it in their queue.
        // PaymentProcessing polls by orderId until the merchant's terminal webhook fires.
        orderPaymentStore.patchSession(session.orderId, {
          availableChannels: args.availableChannels,
          selectedMethod: args.selectedMethod,
          selectedChannel,
          checkoutPaymentMethod: mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod),
        });
        void registerDeviceForPayment(session.orderId);
        args.navigation.replace('PaymentProcessing', {
          orderId: session.orderId,
          amount: args.amount,
          currency: session.currency,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
          invoiceId: args.invoiceId,
        });
        return;
      }

      void registerDeviceForPayment(session.orderId);
      const result = await presentPayPal({
        paymentRequestId: session.paymentRequestId,
        amount: args.amount,
        currency: session.currency,
        invoiceId: args.invoiceId,
        orderId: session.orderId,
        merchantId: session.merchantId,
        branchId: session.branchId,
        productId: session.basketItems[0]?.productId,
      });
      if (result.paymentRequestId) {
        orderPaymentStore.patchSession(session.orderId, {
          availableChannels: args.availableChannels,
          selectedMethod: args.selectedMethod,
          selectedChannel,
          checkoutPaymentMethod: mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod),
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
          paymentSource: refreshed.paymentSource,
          checkoutPaymentMethod: refreshed.checkoutPaymentMethod,
          updatedAt: refreshed.updatedAt,
        });
      }
      const paymentRequestId = refreshed?.lastPaymentRequestId ?? result.paymentRequestId ?? session.paymentRequestId;
      if (paymentRequestId && refreshed && refreshed.status !== 'PAID' && refreshed.status !== 'CANCELLED') {
        if (!paymentResultTracker.isTracking(paymentRequestId)) void paymentResultTracker.start(paymentRequestId);
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
      const resultStatus =
        result.status === 'failed'
          ? 'failed'
          : result.status === 'cancelled'
            ? 'cancelled'
            : refreshed
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
        checkoutIntent: session.checkoutIntent,
        paymentSource: refreshed?.paymentSource,
        reason: result.status === 'failed' ? result.error : undefined,
      });
    },
    [initializePayment, openPaymentSheet, presentPayPal],
  );

  const confirmCheckout = useCallback(
    async (args: ConfirmCheckoutArgs): Promise<void> => {
      if (!args.merchantId) throw new Error('merchant_unavailable');
      if (!args.branchId) throw new Error('merchant_branch_unavailable');
      const payWithCash = args.selectedIntent === 'PAY_NOW' && args.payWithCash === true && Boolean(args.table);
      if (args.selectedIntent === 'PAY_NOW' && !args.selectedMethod && !payWithCash) {
        throw new Error('payment_option_required');
      }
      if (args.selectedIntent === 'PAY_NOW' && args.selectedMethod && !payWithCash && !isMethodAvailable(args.selectedMethod, args.availableChannels)) {
        throw new Error('payment_option_unavailable');
      }

      observability.info('checkout_intent_selected', {
        checkoutIntent: args.selectedIntent,
        paymentMethod: args.selectedMethod ?? null,
        checkoutPaymentMethod: args.selectedMethod ? mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod) : null,
        merchantId: args.merchantId,
        branchId: args.branchId ?? null,
        basketItemCount: args.basketItemCount,
      });
      observability.info('checkout_order_create_requested', {
        checkoutIntent: args.selectedIntent,
        paymentMethod: args.selectedMethod ? mapMethodToOrderPaymentMethod(args.selectedMethod) : null,
        checkoutPaymentMethod: args.selectedMethod ? mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod) : null,
        usesDeferredPayment: args.selectedIntent === 'PAY_LATER',
        merchantId: args.merchantId,
        branchId: args.branchId ?? null,
        basketItemsJson: JSON.stringify(
          args.basketItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceMinor: Math.round(item.unitPrice * 100),
          })),
        ),
      });

      if (args.table) {
        observability.info('table_order_requested', {
          merchantId: args.merchantId,
          branchId: args.branchId,
          checkoutIntent: args.selectedIntent,
          payWithCash,
          hasGuestCount: args.table.guestCount != null,
        });
      }
      const customerLocation = args.table ? await captureWalkInLocation() : undefined;
      const order = await createOrder({
        branchId: args.branchId,
        orderType: args.table ? 'WALK_IN_ORDERING' : 'PRE_ORDER',
        checkoutIntent: args.selectedIntent,
        paymentMethod: !payWithCash && args.selectedMethod ? mapMethodToOrderPaymentMethod(args.selectedMethod) : undefined,
        checkoutPaymentMethod: payWithCash
          ? 'CASH'
          : args.selectedMethod
            ? mapMethodToBackendCheckoutPaymentMethod(args.selectedMethod)
            : undefined,
        tableCode: args.table?.tableCode,
        guestCount: args.table?.guestCount,
        customerLocation,
        items: args.basketItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceMinor: Math.round(item.unitPrice * 100),
        })),
      });

      const session = toSession(args, order);
      orderPaymentStore.saveSession(session);
      orderPaymentStore.upsertRecentOrder({
        ...order,
        merchantName: args.merchantName,
        branchName: args.branchName,
        merchantLogoUrl: args.merchantLogoUrl,
        preferredMethod: args.selectedMethod ?? undefined,
      });

      observability.info('order_payment_session_created', {
        orderId: order.orderId,
        merchantId: order.merchantId,
        branchId: order.branchId ?? null,
        orderStatus: order.status,
        checkoutIntent: order.checkoutIntent,
      });

      if (args.selectedIntent === 'PAY_LATER' || payWithCash) {
        args.navigation.replace('OrderDetail', {
          orderId: order.orderId,
          merchantName: args.merchantName,
          branchName: args.branchName,
          merchantLogoUrl: args.merchantLogoUrl,
          availableChannels: args.availableChannels,
          checkoutIntent: order.checkoutIntent,
        });
        return;
      }

      await startPayment(session, {
        ...args,
        selectedMethod: args.selectedMethod!,
      });
    },
    [startPayment],
  );

  const resumeOrderPayment = useCallback(
    async (args: ResumeOrderPaymentArgs): Promise<void> => {
      if (!isMethodAvailable(args.selectedMethod, args.availableChannels)) {
        throw new Error('payment_option_unavailable');
      }
      if (!isOrderResumable(args.order.status)) {
        throw new Error('order_not_payable');
      }

      const session = toResumeSession(args);
      orderPaymentStore.saveSession(session);
      await startPayment(session, {
        token: args.token,
        amount: session.amount,
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
    [startPayment],
  );

  const refreshOrder = useCallback(async (orderId: string): Promise<OrderSummary> => {
    const order = await fetchOrder(orderId);
    const session = orderPaymentStore.getSession(orderId);
    if (session) {
      orderPaymentStore.patchSession(orderId, {
        orderStatus: order.status,
        paymentSource: order.paymentSource,
        checkoutPaymentMethod: order.checkoutPaymentMethod,
        banner: order.banner,
        updatedAt: order.updatedAt,
        paymentRequestId: order.lastPaymentRequestId,
        paymentProvider: order.lastPaymentProvider,
        checkoutIntent: order.checkoutIntent,
      });
    }
    orderPaymentStore.upsertRecentOrder({
      ...order,
      merchantName: order.merchantName,
      branchName: order.branchName,
      merchantLogoUrl: order.merchantLogoUrl,
      preferredMethod: session?.selectedMethod ?? session?.retryPreferredMethod,
    });
    return order;
  }, []);

  const mutateEditableOrder = useCallback(
    async (orderId: string, action: () => Promise<OrderSummary>): Promise<OrderSummary> => {
      const current = await refreshOrder(orderId);
      if (!isOrderEditable(current.status)) {
        observability.warn('order_edit_blocked', { orderId, status: current.status });
        throw new Error('order_not_payable');
      }
      const nextOrder = await action();
      const session = orderPaymentStore.getSession(orderId);
      if (session) {
        orderPaymentStore.patchSession(orderId, {
          orderStatus: nextOrder.status,
          paymentSource: nextOrder.paymentSource,
          checkoutPaymentMethod: nextOrder.checkoutPaymentMethod,
          banner: nextOrder.banner,
          updatedAt: nextOrder.updatedAt,
          paymentRequestId: nextOrder.lastPaymentRequestId,
          paymentProvider: nextOrder.lastPaymentProvider,
        });
      }
      orderPaymentStore.upsertRecentOrder({
        ...nextOrder,
        merchantName: nextOrder.merchantName,
        branchName: nextOrder.branchName,
        merchantLogoUrl: nextOrder.merchantLogoUrl,
        preferredMethod: session?.selectedMethod ?? session?.retryPreferredMethod,
      });
      return nextOrder;
    },
    [refreshOrder],
  );

  return {
    confirmCheckout,
    resumeOrderPayment,
    refreshOrder,
    addItemToOrder: (orderId: string, productId: string, quantity: number) =>
      mutateEditableOrder(orderId, () => addOrderItem(orderId, { productId, quantity })),
    updateOrderItemQuantity: (orderId: string, lineId: string, quantity: number) =>
      mutateEditableOrder(orderId, () => updateOrderLineQuantity(orderId, { lineId, quantity })),
    removeOrderItem: (orderId: string, lineId: string) =>
      mutateEditableOrder(orderId, () => removeOrderLine(orderId, lineId)),
    cancelOrder: (orderId: string) => mutateEditableOrder(orderId, () => cancelOrder(orderId)),
  };
}
