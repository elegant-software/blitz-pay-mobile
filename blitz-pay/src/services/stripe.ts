import { initPaymentSheet, CardBrand } from '@stripe/stripe-react-native';

export interface StripeParams {
  paymentRequestId: string;
  clientSecret: string;
  ephemeralKey: string;
  customer: string;
  publishableKey: string;
}

export const initializeStripePaymentSheet = async (
  params: StripeParams,
  merchantDisplayName: string = 'BlitzPay'
) => {
  const { error } = await initPaymentSheet({
    merchantDisplayName,
    customerId: params.customer,
    customerEphemeralKeySecret: params.ephemeralKey,
    paymentIntentClientSecret: params.clientSecret,
    // Set allowsDelayedPaymentMethods to true if you want to support methods like SEPA Debit
    allowsDelayedPaymentMethods: true,
    defaultBillingDetails: {
      name: 'User Name', // Should ideally come from user profile
    },
    // Enable card scanning
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
