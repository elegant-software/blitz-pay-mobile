import React from 'react';
import { useLanguage } from './LanguageContext';

export function StripeTerminalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return React.createElement(React.Fragment, null, children);
}

const unavailable = async (message: string) => ({
  error: { code: 'UNSUPPORTED_PLATFORM', message },
});

export function useStripeTerminal() {
  const { t } = useLanguage();
  const fail = () => unavailable(t('terminal_native_required'));
  return {
    connectedReader: null,
    initialize: fail,
    discoverReaders: fail,
    cancelDiscovering: fail,
    connectReader: fail,
    disconnectReader: fail,
    retrievePaymentIntent: fail,
    processPaymentIntent: fail,
    cancelProcessPaymentIntent: fail,
    cancelPaymentIntent: fail,
    setSimulatedCard: fail,
  };
}

export const requestNeededAndroidPermissions = unavailable;
