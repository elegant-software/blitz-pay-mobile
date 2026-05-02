import { StripeParams } from '../../services/stripe';
import { config } from '../config';

export const mockCreatePaymentIntent = async (params: {
  amount: number;
  currency: string;
  orderId: string;
  merchantId: string;
  branchId?: string;
  productId?: string;
}): Promise<StripeParams> => {
  const url = `${config.apiUrl}/v1/payments/stripe/create-intent`;
  console.log(`[Stripe] Calling backend at: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
