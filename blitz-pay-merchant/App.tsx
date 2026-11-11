import React, { useEffect } from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider } from './src/lib/auth';
import { LanguageProvider } from './src/lib/LanguageContext';
import SplashScreen from './src/components/SplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { queryClient, productsPersister } from './src/lib/queryClient';
import { StripeTerminalProvider } from './src/lib/terminalSdk';
import { terminalTokenProvider } from './src/services/stripeTerminal';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import type { RootStackParamList } from './src/types';
// Register geofence background tasks before any React component mounts (expo-task-manager requirement).
// defineTask is safe to call in any environment — Expo Go simply won't execute background tasks.
import './src/tasks/geofenceTask';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

ExpoSplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <ThemeProvider>
      <MerchantApp />
    </ThemeProvider>
  );
}

function MerchantApp() {
  const { mode, colors } = useTheme();
  const [splashVisible, setSplashVisible] = React.useState(true);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [routeName, setRouteName] = React.useState<string>();
  const darkHeader = !splashVisible && routeName === 'Dashboard';
  const statusBarColor = darkHeader ? colors.heroBackground : colors.background;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = statusBarColor;
    document.documentElement.style.colorScheme = mode;
  }, [statusBarColor, mode]);

  useEffect(() => {
    void ExpoSplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <SafeAreaProvider>
        <ErrorBoundary>
          <StripeTerminalProvider
            tokenProvider={terminalTokenProvider}
            logLevel="verbose"
            localeConfig={{ type: 'cardLanguagePreferenceIfAvailable' }}
          >
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: productsPersister,
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) =>
                    query.queryKey[0] === 'products',
                },
              }}
            >
              <AuthProvider>
                <LanguageProvider>
                  <>
                    {splashVisible ? (
                      <SplashScreen
                        onComplete={() => setSplashVisible(false)}
                      />
                    ) : null}
                    <NavigationContainer
                      ref={navigationRef}
                      onReady={() =>
                        setRouteName(navigationRef.getCurrentRoute()?.name)
                      }
                      onStateChange={() =>
                        setRouteName(navigationRef.getCurrentRoute()?.name)
                      }
                      theme={{
                        ...(mode === 'dark' ? DarkTheme : DefaultTheme),
                        colors: {
                          ...(mode === 'dark' ? DarkTheme : DefaultTheme)
                            .colors,
                          background: colors.background,
                          card: colors.cardBg,
                          text: colors.onSurface,
                          primary: colors.primary,
                          border: colors.gray200,
                        },
                      }}
                    >
                      <StatusBar
                        animated
                        style={darkHeader || mode === 'dark' ? 'light' : 'dark'}
                      />
                      <AppNavigator />
                    </NavigationContainer>
                  </>
                </LanguageProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </StripeTerminalProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
