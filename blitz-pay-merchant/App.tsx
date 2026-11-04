import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useIsRestoring } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/lib/auth';
import { LanguageProvider } from './src/lib/LanguageContext';
import SplashScreen from './src/components/SplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { queryClient, productsPersister } from './src/lib/queryClient';
import { StripeTerminalProvider } from '@stripe/stripe-terminal-react-native';
import { terminalTokenProvider } from './src/services/stripeTerminal';
// Register geofence background tasks before any React component mounts (expo-task-manager requirement).
// defineTask is safe to call in any environment — Expo Go simply won't execute background tasks.
import './src/tasks/geofenceTask';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

ExpoSplashScreen.preventAutoHideAsync();

function StartupSplash() {
  const { initialized } = useAuth();
  const restoring = useIsRestoring();
  const [visible, setVisible] = React.useState(true);

  return visible ? (
    <SplashScreen ready={initialized && !restoring} onComplete={() => setVisible(false)} />
  ) : null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StripeTerminalProvider tokenProvider={terminalTokenProvider} logLevel="verbose">
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: productsPersister,
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => query.queryKey[0] === 'products',
              },
            }}
          >
          <LanguageProvider>
            <>
              <AuthProvider>
                <NavigationContainer>
                  <StatusBar style="dark" />
                  <AppNavigator />
                </NavigationContainer>
                <StartupSplash />
              </AuthProvider>
            </>
          </LanguageProvider>
          </PersistQueryClientProvider>
          </StripeTerminalProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}