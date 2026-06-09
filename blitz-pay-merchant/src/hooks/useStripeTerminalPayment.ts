import { useState, useCallback, useRef } from 'react';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import type { Reader } from '@stripe/stripe-terminal-react-native';
import * as Location from 'expo-location';
import { fetchConnectionToken, createTerminalIntent, setTerminalScope } from '../services/stripeTerminal';

export type TerminalPaymentStatus = 'idle' | 'discovering' | 'connecting' | 'collecting' | 'succeeded' | 'failed';

interface CollectResult {
  succeeded: boolean;
  error?: string;
}

export function useStripeTerminalPayment() {
  const [status, setStatus] = useState<TerminalPaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const discoveredReadersRef = useRef<Reader.Type[]>([]);

  const {
    initialize,
    discoverReaders,
    connectReader,
    retrievePaymentIntent,
    processPaymentIntent,
    cancelPaymentIntent,
    connectedReader,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers) => {
      discoveredReadersRef.current = readers;
    },
  });

  const collectPayment = useCallback(async (params: {
    orderId: string;
    merchantId: string;
    branchId: string;
    simulated?: boolean;
  }): Promise<CollectResult> => {
    setStatus('discovering');
    setErrorMessage(null);

    try {
      // Must be set before SDK calls so terminalTokenProvider (in StripeTerminalProvider) can fetch the token.
      setTerminalScope(params.branchId, params.merchantId);

      const { error: initError } = await initialize();
      if (initError) throw new Error(initError.message);

      const tokenResult = await fetchConnectionToken(params.branchId, params.merchantId);

      if (!connectedReader) {
        const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
        if (locationStatus !== Location.PermissionStatus.GRANTED) {
          throw new Error('Location permission is required to use Tap to Pay');
        }

        const { error: discoverError } = await discoverReaders({
          discoveryMethod: 'tapToPay',
          simulated: params.simulated ?? false,
        });
        if (discoverError) {
          throw new Error(discoverError.message);
        }

        const reader = discoveredReadersRef.current[0];
        if (!reader) {
          throw new Error('No Tap to Pay reader found on this device');
        }

        setStatus('connecting');
        const { error: connectError } = await connectReader({
          discoveryMethod: 'tapToPay',
          reader,
          locationId: tokenResult.locationId,
        });
        if (connectError) {
          throw new Error(connectError.message);
        }
      }

      setStatus('collecting');
      const intent = await createTerminalIntent({
        orderId: params.orderId,
        merchantId: params.merchantId,
        branchId: params.branchId,
      });

      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(intent.clientSecret);
      if (retrieveError || !paymentIntent) {
        throw new Error(retrieveError?.message ?? 'Failed to retrieve payment intent');
      }

      const { error: processError } = await processPaymentIntent({ paymentIntent });
      if (processError) {
        // Explicitly cancel the PaymentIntent on Stripe so the backend receives
        // payment_intent.canceled and reverts the order status. Without this,
        // dismissing the native sheet leaves the PI in requires_payment_method
        // and no webhook fires.
        await cancelPaymentIntent({ paymentIntent }).catch(() => null);
        throw new Error(processError.message);
      }

      setStatus('succeeded');
      return { succeeded: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terminal payment failed';
      setStatus('failed');
      setErrorMessage(message);
      return { succeeded: false, error: message };
    }
  }, [initialize, connectedReader, discoverReaders, connectReader, retrievePaymentIntent, processPaymentIntent, cancelPaymentIntent]);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, collectPayment, reset };
}
