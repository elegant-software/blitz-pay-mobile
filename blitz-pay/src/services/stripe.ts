import { initStripe, initPaymentSheet, CardBrand } from '@stripe/stripe-react-native';

export interface StripeParams {
  paymentRequestId: string;
  clientSecret: string;
  ephemeralKey: string;
  customer: string;
  publishableKey: string;
  connectedAccountId?: string;
}

export const initializeStripePaymentSheet = async (
  params: StripeParams,
  merchantDisplayName: string = 'BlitzPay'
) => {
  // Re-initialize the SDK scoped to the connected account so the PaymentIntent
  // is looked up on the correct account, not the platform account.
  await initStripe({
    publishableKey: params.publishableKey,
    ...(params.connectedAccountId ? { stripeAccountId: params.connectedAccountId } : {}),
  });

  const { error } = await initPaymentSheet({
    merchantDisplayName,
    customerId: params.customer,
    customerEphemeralKeySecret: params.ephemeralKey,
    paymentIntentClientSecret: params.clientSecret,
    allowsDelayedPaymentMethods: true,
    defaultBillingDetails: {
      name: 'User Name',
    },
    preferredNetworks: [CardBrand.Visa, CardBrand.Mastercard],
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const mapStripeErrorToMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  
  const code = error?.code;
  switch (code) {
    case 'Failed':
      return 'Payment failed. Please try another card.';
    case 'Canceled':
      return 'Payment was cancelled.';
    case 'Timeout':
      return 'Payment timed out. Please check your connection.';
    default:
      return error?.message || 'An unexpected error occurred during payment.';
  }
};
