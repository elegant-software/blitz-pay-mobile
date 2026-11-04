import React, { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
  type LinkingOptions,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, productsPersister } from './src/lib/queryClient';
import { AuthProvider, useAuth } from './src/lib/auth';
import { LanguageProvider } from './src/lib/LanguageContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import SplashScreen from './src/components/SplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initObservability } from './src/lib/observability';
import { config } from './src/lib/config';
import { ensurePaymentsChannel } from './src/lib/notifications/channels';
import { initPushHandlers } from './src/lib/notifications/pushHandlers';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
import { recoverInFlight } from './src/lib/payments/recoverInFlight';
import { registerShopperPushToken } from './src/lib/notifications/shopperPushRegistration';
import type { RootStackParamList } from './src/types';
// Register geofence background tasks before any React component mounts (expo-task-manager requirement)
import './src/tasks/geofenceTask';

// Keep native splash up until our custom JS splash is rendered, preventing black flash
ExpoSplashScreen.preventAutoHideAsync();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  // Table Links (https://<storefront>/t/{code}) arrive as universal/app links when the storefront host is configured.
  prefixes: [`${config.trueLayerRedirectScheme}://`, ...(config.storefrontUrl ? [config.storefrontUrl] : [])],
  config: {
    screens: {
      TableCheckIn: 't/:code',
      PaymentResult: 'payments/:paymentRequestId/result',
      PaymentProcessing: 'payments/:paymentRequestId/processing',
      PaymentPending: 'payments/:paymentRequestId/pending',
      StripeCheckoutReturn: 'payments/stripe-return/:orderId/:status',
    },
  },
};

function PostAuthEffects() {
  const { authenticated, initialized } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!initialized || !authenticated) return;
    if (ranRef.current) return;
    ranRef.current = true;
    void recoverInFlight();
    if (!isExpoGo) void registerShopperPushToken();
  }, [initialized, authenticated]);

  return null;
}

export default function App() {
  const [splashVisible, setSplashVisible] = React.useState(true);

  useEffect(() => {
    initObservability();
    if (!isExpoGo) void ensurePaymentsChannel();
    // Custom splash is now rendered — safe to dismiss the native one
    void ExpoSplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: productsPersister,
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => query.queryKey[0] === 'catalog',
              },
            }}
          >
          <LanguageProvider>
            <StripeProvider
              publishableKey={config.stripePublishableKey}
              urlScheme={config.trueLayerRedirectScheme} // "blitzpay"
              merchantIdentifier="merchant.app.blitzpay.mobile"
            >
              <>
                {splashVisible ? (
                  <SplashScreen onComplete={() => setSplashVisible(false)} />
                ) : null}
                <AuthProvider>
                <NavigationContainer
                  ref={navigationRef}
                  linking={linking}
                  onReady={() => {
                    if (!isExpoGo) initPushHandlers(navigationRef);
                  }}
                >
                  <StatusBar style="dark" />
                  <PostAuthEffects />
                  <AppNavigator />
                </NavigationContainer>
                </AuthProvider>
              </>
            </StripeProvider>
          </LanguageProvider>
          </PersistQueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
