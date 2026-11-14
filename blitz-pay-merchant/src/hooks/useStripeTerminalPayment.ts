import { useState, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { requestNeededAndroidPermissions, useStripeTerminal } from '../lib/terminalSdk';
import type { PaymentIntent, Reader, StripeError } from '@stripe/stripe-terminal-react-native';
import * as Location from 'expo-location';
import {
  fetchConnectionToken,
  createTerminalIntent,
  setTerminalScope,
  loadPairedCardReader,
  CreateIntentError,
} from '../services/stripeTerminal';
import { isSoftDecline } from '../lib/terminalErrors';
import { observability } from '../lib/observability';
import { useLanguage } from '../lib/LanguageContext';
import type { TranslationKeys } from '../lib/translations';

export type TerminalPaymentStatus =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'collecting'
  | 'insert_card'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'already_paid'
  | 'in_progress';

/**
 * `failed` leaves the PaymentIntent open (the backend reuses it on retry); callers reconcile via the Order status,
 * which is the truth for "paid". `in_progress`: the open PaymentIntent is mid-collection elsewhere; reconcile, don't
 * start a new collection. Only `cancelPayment()` cancels the PaymentIntent.
 */
export type TerminalPaymentOutcome = 'succeeded' | 'failed' | 'canceled' | 'already_paid' | 'in_progress';

interface CollectResult {
  outcome: TerminalPaymentOutcome;
  succeeded: boolean;
  error?: string;
}

/** Button label while a Terminal Payment runs. */
export function terminalStatusLabelKey(status: TerminalPaymentStatus): TranslationKeys {
  switch (status) {
    case 'discovering':
    case 'connecting':
      return 'merchant_terminal_status_connecting';
    case 'collecting':
      return 'merchant_terminal_status_collecting';
    case 'insert_card':
      return 'merchant_terminal_insert_card';
    default:
      return 'merchant_collect_via_terminal';
  }
}

type ConnectedReader = { kind: 'card_reader' | 'tap_to_pay'; serial: string | null };
type FallbackChoice = 'tapToPay' | 'retry' | 'cancel';

const BLUETOOTH_SCAN_TIMEOUT_S = 10;
const MAX_SOFT_DECLINE_RETRIES = 2;
/** Simulated discovery returns four readers; only the WisePad 3 is supported in our Stripe location's country. */
const SIMULATED_READER_TYPE = 'wisePad3';
const SIMULATED_CARD = '4242424242424242'; // 4000000000009995 = insufficient funds decline

/** Dev-only: the SDK's real error is otherwise hidden behind generic messages. */
const dev = (step: string, e: unknown) => {
  if (__DEV__) console.warn(`[terminal] ${step}`, JSON.stringify(e));
};

/** Error carrying the Stripe error so the failure log can record its code. */
function stripeFailure(error: StripeError | undefined, fallback: string): Error {
  return Object.assign(new Error(error?.message ?? fallback), { stripeError: error });
}

function stripeErrorAttrs(error: StripeError) {
  return { code: error.code, declineCode: error.apiError?.declineCode || null, reason: error.message };
}

export function useStripeTerminalPayment() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<TerminalPaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Order whose PaymentIntent is open and may be canceled with "Zahlung abbrechen". */
  const [cancelableOrderId, setCancelableOrderId] = useState<string | null>(null);
  const discoveredReadersRef = useRef<Reader.Type[]>([]);
  const serialWaiterRef = useRef<{ serial: string; simulated: boolean; resolve: (reader: Reader.Type) => void } | null>(null);
  const openIntentRef = useRef<{ orderId: string; paymentIntent: PaymentIntent.Type } | null>(null);
  const lastIntentIdByOrderRef = useRef(new Map<string, string>());
  const cancelRequestedRef = useRef(false);

  const {
    initialize,
    discoverReaders,
    cancelDiscovering,
    connectReader,
    disconnectReader,
    retrievePaymentIntent,
    processPaymentIntent,
    cancelProcessPaymentIntent,
    cancelPaymentIntent,
    connectedReader,
    setSimulatedCard,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: (readers) => {
      discoveredReadersRef.current = readers;
      dev('discovered', readers.map((r) => ({ serial: r.serialNumber, simulated: r.simulated, type: r.deviceType })));
      const waiter = serialWaiterRef.current;
      const match = waiter && (readers.find((reader) => reader.serialNumber === waiter.serial)
        ?? (waiter.simulated ? readers.find((reader) => reader.deviceType === SIMULATED_READER_TYPE) : undefined));
      if (waiter && match) waiter.resolve(match);
    },
  });

  /** Scans Bluetooth until the paired reader shows up; null when the scan ends without it. */
  const scanForCardReader = useCallback(async (serial: string, simulated: boolean): Promise<Reader.Type | null> => {
    if (Platform.OS === 'android') {
      const { error } = await requestNeededAndroidPermissions();
      if (error) throw new Error('Bluetooth permission is required to use the card reader');
    }
    const found = new Promise<Reader.Type>((resolve) => {
      serialWaiterRef.current = { serial, simulated, resolve };
    });
    const finished = discoverReaders({ discoveryMethod: 'bluetoothScan', timeout: BLUETOOTH_SCAN_TIMEOUT_S, simulated })
      .then(({ error }) => {
        if (error && error.code !== 'CANCELED') dev('discover', error); // we cancel discovery ourselves once found
        return null;
      });
    try {
      const reader = await Promise.race([found, finished]);
      if (reader) await cancelDiscovering().catch(() => null);
      return reader ?? (simulated ? discoveredReadersRef.current.find((r) => r.deviceType === SIMULATED_READER_TYPE) ?? null : null);
    } finally {
      serialWaiterRef.current = null;
    }
  }, [discoverReaders, cancelDiscovering]);

  const askReaderFallback = useCallback(() => new Promise<FallbackChoice>((resolve) => {
    Alert.alert(
      t('terminal_reader_unreachable_title'),
      t('terminal_reader_unreachable_body'),
      [
        { text: t('cancel'), style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Tap to Pay', onPress: () => resolve('tapToPay') },
        { text: t('retry'), onPress: () => resolve('retry') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    );
  }), [t]);

  /**
   * Connects the reader for this payment: the paired Card Reader when reachable, Tap to Pay when none is paired
   * or the merchant chose the fallback. Returns null when the merchant gave up at the "unreachable" dialog.
   */
  const ensureReader = useCallback(async (params: {
    orderId: string;
    locationId: string;
    simulated: boolean;
  }): Promise<ConnectedReader | null> => {
    let useTapToPay = false;
    for (;;) {
      // Simulated: no real pairing exists, so always use the simulated WisePad 3 (found by type, not serial).
      const paired = useTapToPay ? null : params.simulated ? { serialNumber: '' } : await loadPairedCardReader();
      const current = connectedReader;

      if (paired) {
        if (params.simulated ? current?.deviceType === SIMULATED_READER_TYPE : current?.serialNumber === paired.serialNumber) {
          return { kind: 'card_reader', serial: current?.serialNumber ?? paired.serialNumber };
        }
        if (current) await disconnectReader();
        setStatus('discovering');
        const reader = await scanForCardReader(paired.serialNumber, params.simulated);
        if (reader) {
          setStatus('connecting');
          const { error } = await connectReader({
            discoveryMethod: 'bluetoothScan',
            reader,
            locationId: params.locationId,
            autoReconnectOnUnexpectedDisconnect: true,
          });
          if (error) {
            dev('connect', error);
            throw stripeFailure(error, 'Card reader connection failed');
          }
          return { kind: 'card_reader', serial: reader.serialNumber ?? null };
        }
        observability.warn('terminal_card_reader_unreachable', { orderId: params.orderId, readerSerial: paired.serialNumber });
        const choice = await askReaderFallback();
        observability.info('terminal_card_reader_fallback_choice', { orderId: params.orderId, choice });
        if (choice === 'cancel') return null;
        useTapToPay = choice === 'tapToPay';
        continue;
      }

      // No Card Reader paired, or the merchant chose the Tap to Pay fallback (no girocard).
      if (current) {
        return { kind: current.deviceType === 'tapToPay' ? 'tap_to_pay' : 'card_reader', serial: current.serialNumber ?? null };
      }
      setStatus('discovering');
      discoveredReadersRef.current = [];
      const { error: discoverError } = await discoverReaders({ discoveryMethod: 'tapToPay', simulated: params.simulated });
      if (discoverError) throw stripeFailure(discoverError, 'Tap to Pay discovery failed');
      const reader = discoveredReadersRef.current[0];
      if (!reader) throw new Error('No Tap to Pay reader found on this device');

      setStatus('connecting');
      const { error: connectError } = await connectReader({
        discoveryMethod: 'tapToPay',
        reader,
        locationId: params.locationId,
      });
      if (connectError) throw stripeFailure(connectError, 'Tap to Pay connection failed');
      return { kind: 'tap_to_pay', serial: reader.serialNumber ?? null };
    }
  }, [connectedReader, scanForCardReader, disconnectReader, connectReader, askReaderFallback, discoverReaders]);

  const collectPayment = useCallback(async (params: {
    orderId: string;
    merchantId: string;
    branchId: string;
    simulated?: boolean;
  }): Promise<CollectResult> => {
    const { orderId } = params;
    const simulated = params.simulated ?? false;
    setStatus('discovering');
    setErrorMessage(null);
    setCancelableOrderId(null);
    cancelRequestedRef.current = false;
    openIntentRef.current = null;
    let readerSerial: string | null = null;
    let paymentIntentId: string | null = null;

    const finish = (outcome: TerminalPaymentOutcome, error?: string): CollectResult => {
      setStatus(outcome);
      setErrorMessage(error ?? null);
      observability.info('terminal_payment_result', { orderId, paymentIntentId, readerSerial, outcome });
      return { outcome, succeeded: outcome === 'succeeded', error };
    };

    observability.info('terminal_payment_requested', { orderId, branchId: params.branchId, simulated });
    try {
      // Must be set before SDK calls so terminalTokenProvider (in StripeTerminalProvider) can fetch the token.
      setTerminalScope(params.branchId, params.merchantId);

      const { error: initError } = await initialize();
      if (initError) dev('initialize', initError);
      if (initError) throw stripeFailure(initError, 'Terminal initialization failed');

      const { locationId } = await fetchConnectionToken(params.branchId, params.merchantId);

      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== Location.PermissionStatus.GRANTED) {
        throw new Error('Location permission is required for card payments');
      }

      const reader = await ensureReader({ orderId, locationId, simulated });
      if (!reader) return finish('canceled');
      readerSerial = reader.serial;
      observability.info('terminal_reader_selected', { orderId, readerType: reader.kind, readerSerial });

      setStatus('collecting');
      let clientSecret: string;
      try {
        ({ clientSecret } = await createTerminalIntent({ orderId, merchantId: params.merchantId, branchId: params.branchId }));
      } catch (err) {
        if (err instanceof CreateIntentError && err.status === 409 && err.code === 'ORDER_ALREADY_PAID') {
          return finish('already_paid', t('merchant_terminal_already_paid'));
        }
        if (err instanceof CreateIntentError && err.status === 409 && err.code === 'PAYMENT_IN_PROGRESS') {
          return finish('in_progress', t('merchant_terminal_payment_in_progress'));
        }
        throw err;
      }

      const { paymentIntent, error: retrieveError } = await retrievePaymentIntent(clientSecret);
      if (retrieveError || !paymentIntent) throw stripeFailure(retrieveError, 'Failed to retrieve payment intent');
      if (!paymentIntent.id) throw new Error('Retrieved payment intent has no id');
      paymentIntentId = paymentIntent.id;
      const reused = lastIntentIdByOrderRef.current.get(orderId) === paymentIntent.id;
      lastIntentIdByOrderRef.current.set(orderId, paymentIntent.id);
      openIntentRef.current = { orderId, paymentIntent };
      setCancelableOrderId(orderId);
      observability.info('terminal_intent_ready', {
        orderId, paymentIntentId, readerSerial, reused, intentStatus: paymentIntent.status ?? null,
      });

      // The simulated reader never prompts for a card; it pays with this one.
      if (simulated) await setSimulatedCard(SIMULATED_CARD);

      let current = paymentIntent;
      for (let softRetries = 0; ; softRetries += 1) {
        const { error: processError } = await processPaymentIntent({ paymentIntent: current });
        if (!processError) break;
        if (cancelRequestedRef.current) return finish('canceled', t('merchant_terminal_payment_canceled'));
        if (reader.kind === 'card_reader' && isSoftDecline(processError) && softRetries < MAX_SOFT_DECLINE_RETRIES) {
          // Soft decline: the card must be inserted for PIN; retry the SAME PaymentIntent.
          observability.info('terminal_payment_soft_decline', { orderId, paymentIntentId, readerSerial, ...stripeErrorAttrs(processError) });
          setStatus('insert_card');
          current = processError.paymentIntent ?? current;
          openIntentRef.current = { orderId, paymentIntent: current };
          continue;
        }
        // Do NOT cancel the PaymentIntent: after a disconnect or unknown error it can still settle on Stripe.
        // The caller reconciles via the Order status; a retry reuses this PaymentIntent.
        dev('process', processError);
        throw stripeFailure(processError, 'Card payment failed');
      }

      openIntentRef.current = null;
      setCancelableOrderId(null);
      return finish('succeeded');
    } catch (err) {
      const stripeError = (err as { stripeError?: StripeError }).stripeError;
      const message = err instanceof Error ? err.message : 'Terminal payment failed';
      observability.error('terminal_payment_failed', {
        orderId,
        paymentIntentId,
        readerSerial,
        ...(stripeError ? stripeErrorAttrs(stripeError) : { code: null, declineCode: null, reason: message }),
      });
      return finish('failed', message);
    }
  }, [t, initialize, ensureReader, retrievePaymentIntent, processPaymentIntent, setSimulatedCard]);

  /** "Zahlung abbrechen": the only path that cancels the PaymentIntent. */
  const cancelPayment = useCallback(async () => {
    const open = openIntentRef.current;
    if (!open) return;
    const attrs = { orderId: open.orderId, paymentIntentId: open.paymentIntent.id };
    cancelRequestedRef.current = true;
    observability.info('terminal_payment_cancel_requested', attrs);
    await cancelProcessPaymentIntent().catch(() => null);
    const { error } = await cancelPaymentIntent({ paymentIntent: open.paymentIntent });
    if (error) {
      observability.error('terminal_payment_cancel_failed', { ...attrs, ...stripeErrorAttrs(error) });
      setErrorMessage(error.message);
      return;
    }
    observability.info('terminal_payment_cancel_result', attrs);
    openIntentRef.current = null;
    lastIntentIdByOrderRef.current.delete(open.orderId);
    setCancelableOrderId(null);
    setStatus('canceled');
    setErrorMessage(t('merchant_terminal_payment_canceled'));
  }, [t, cancelProcessPaymentIntent, cancelPaymentIntent]);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, cancelableOrderId, collectPayment, cancelPayment, reset };
}
