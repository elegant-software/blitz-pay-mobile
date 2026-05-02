import { useCallback, useState } from 'react';
import { requestOneTimePayment } from 'react-native-expo-braintree';
import { fetchClientToken, submitNonce } from '../services/braintree';
import { observability } from '../lib/observability';
import type { PayPalPaymentResult } from '../types/braintree';

interface PresentArgs {
  paymentRequestId?: string;
  amount: number;
  currency?: string;
  invoiceId?: string;
  orderId: string;
  merchantId: string;
  branchId?: string;
  productId?: string;
}

// Must match the `host` + `pathPrefix` declared in app.json under the
// react-native-expo-braintree plugin. SDK v5 uses Android App Links for the
// PayPal browser-switch return path.
const MERCHANT_APP_LINK = 'https://blitzpay.example.com/paypal-return';

function extractNonce(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  if (typeof r.nonce === 'string') return r.nonce;
  const payPalAccount = r.payPalAccount as Record<string, unknown> | undefined;
  if (payPalAccount && typeof payPalAccount.nonce === 'string') return payPalAccount.nonce;
  return null;
}

function isUserCancellation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    code.includes('USER_CANCEL') ||
    message.includes('USER_CANCEL') ||
    code === 'CANCELED'
  );
}

// Library returns errors as resolved values (not thrown), so we need to detect them.
function isErrorResult(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;
  return !('nonce' in r) && ('code' in r || 'message' in r || 'domain' in r);
}

export function useBraintreePayPal() {
  const [loading, setLoading] = useState(false);

  const presentPayPal = useCallback(
    async (args: PresentArgs): Promise<PayPalPaymentResult> => {
      setLoading(true);
      try {
        const clientToken = await fetchClientToken({
          merchantId: args.merchantId,
          branchId: args.branchId,
        });
        observability.info('braintree_client_token_received', {
          paymentRequestId: args.paymentRequestId ?? null,
          length: clientToken.length,
        });

        let ppResult: unknown;
        try {
          ppResult = await requestOneTimePayment({
            clientToken,
            merchantAppLink: MERCHANT_APP_LINK,
            fallbackUrlScheme: 'blitzpay',
            amount: args.amount.toFixed(2),
            currencyCode: args.currency ?? 'EUR',
          });
        } catch (err: unknown) {
          if (isUserCancellation(err)) {
            return { status: 'cancelled' };
          }
          const e = err as { message?: string; code?: string } | null;
          observability.warn('braintree_paypal_error', {
            paymentRequestId: args.paymentRequestId ?? null,
            code: e?.code ?? null,
            message: e?.message ?? String(err),
          });
          return {
            status: 'failed',
            error: e?.message ?? e?.code ?? 'PayPal error',
          };
        }

        // Library resolves with an error-shaped object instead of throwing on failure/cancellation
        if (isErrorResult(ppResult)) {
          if (isUserCancellation(ppResult)) {
            return { status: 'cancelled' };
          }
          const e = ppResult as Record<string, unknown>;
          const code = typeof e.code === 'string' ? e.code : undefined;
          const message = typeof e.message === 'string' ? e.message : undefined;
          observability.warn('braintree_paypal_error', {
            paymentRequestId: args.paymentRequestId ?? null,
            code: code ?? null,
            message: message ?? 'unknown',
          });
          return { status: 'failed', error: message ?? code ?? 'PayPal error' };
        }

        const nonce = extractNonce(ppResult);
        if (!nonce) {
          observability.warn('braintree_paypal_missing_nonce', {
            paymentRequestId: args.paymentRequestId ?? null,
            keys: ppResult && typeof ppResult === 'object' ? Object.keys(ppResult as object).join(',') : null,
          });
          return { status: 'failed', error: 'Missing PayPal nonce' };
        }

        const saleResponse = await submitNonce({
          nonce,
          amount: args.amount,
          currency: args.currency ?? 'EUR',
          orderId: args.orderId,
          invoiceId: args.invoiceId,
          merchantId: args.merchantId,
          branchId: args.branchId,
          productId: args.productId,
        });

        if (saleResponse.status === 'succeeded') {
          return {
            status: 'succeeded',
            paymentRequestId: saleResponse.paymentRequestId,
            transactionId: saleResponse.transactionId,
          };
        }
        return {
          status: 'failed',
          error: saleResponse.message || 'Transaction declined',
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const isNetworkError =
          message === 'Network request failed' ||
          message.toLowerCase().includes('network') ||
          message.toLowerCase().includes('fetch');
        observability.error('braintree_paypal_flow_failed', {
          paymentRequestId: args.paymentRequestId ?? null,
          orderId: args.orderId,
          message,
        });
        return { status: 'failed', error: isNetworkError ? 'error_server_unreachable' : message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, presentPayPal };
}
