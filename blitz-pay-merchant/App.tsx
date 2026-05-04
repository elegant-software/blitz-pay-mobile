import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/lib/auth';
import { LanguageProvider } from './src/lib/LanguageContext';
import SplashScreen from './src/components/SplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import Constants, { ExecutionEnvironment } from 'expo-constants';
// Register geofence background tasks before any React component mounts (expo-task-manager requirement).
// defineTask is safe to call in any environment — Expo Go simply won't execute background tasks.
import './src/tasks/geofenceTask';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

ExpoSplashScreen.preventAutoHideAsync();

export default function App() {
  const [splashVisible, setSplashVisible] = React.useState(true);

  useEffect(() => {
    void ExpoSplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <LanguageProvider>
            <>
              {splashVisible ? (
                <SplashScreen onComplete={() => setSplashVisible(false)} />
              ) : null}
              <AuthProvider>
                <NavigationContainer>
                  <StatusBar style="dark" />
                  <AppNavigator />
                </NavigationContainer>
              </AuthProvider>
            </>
          </LanguageProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}