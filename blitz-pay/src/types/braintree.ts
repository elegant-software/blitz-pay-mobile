export interface BraintreeClientTokenResponse {
  clientToken: string;
}

export interface BraintreeClientTokenRequest {
  merchantId: string;
  branchId?: string;
}

export interface BraintreeCheckoutRequest {
  nonce: string;
  amount: number;
  currency?: string;
  orderId: string;
  invoiceId?: string;
  merchantId: string;
  branchId?: string;
  productId?: string;
}

export type BraintreeCheckoutResponse =
  | {
      status: 'succeeded';
      paymentRequestId: string;
      transactionId: string;
      amount: string;
      currency: string;
      orderId: string;
    }
  | {
      status: 'failed';
      message: string;
      code?: string;
    };

export type PayPalPaymentStatus = 'succeeded' | 'failed' | 'cancelled';

export interface PayPalPaymentResult {
  status: PayPalPaymentStatus;
  paymentRequestId?: string;
  transactionId?: string;
  error?: string;
}
