import { StripeParams } from '../../services/stripe';
import { authedFetch } from './authedFetch';

export const mockCreatePaymentIntent = async (params: {
  amount: number;
  currency: string;
  orderId: string;
  merchantId: string;
  branchId?: string;
  productId?: string;
}): Promise<StripeParams> => {
  console.log('[Stripe] Calling backend: POST /v1/payments/stripe/create-intent');

  try {
    const response = await authedFetch('/v1/payments/stripe/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Stripe] Backend error (${response.status}):`, errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      paymentRequestId: data.paymentRequestId,
      clientSecret: data.clientSecret ?? data.paymentIntent,
      ephemeralKey: data.ephemeralKey || '',
      customer: data.customer || '',
      publishableKey: data.publishableKey,
    };
  } catch (error: any) {
    console.error('[Stripe] Network or Server Error:', error.message);
    throw error;
  }
};
