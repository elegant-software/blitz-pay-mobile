import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

import LoginScreen from '../screens/LoginScreen';
import TabNavigator from './TabNavigator';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import ProductEditScreen from '../screens/ProductEditScreen';
import MerchantQRCodeScreen from '../screens/MerchantQRCodeScreen';
import PaymentsHistoryScreen from '../screens/PaymentsHistoryScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AppearancesScreen from '../screens/AppearancesScreen';
import PaymentSetupPrototypeScreen from '../screens/PaymentSetupPrototypeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { initialized, authenticated } = useAuth();

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!authenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} options={{ animation: 'fade' }} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="ProductEdit" component={ProductEditScreen} />
          <Stack.Screen name="MerchantQRCode" component={MerchantQRCodeScreen} />
          <Stack.Screen name="PaymentsHistory" component={PaymentsHistoryScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Appearances" component={AppearancesScreen} />
          <Stack.Screen name="PaymentSetupPrototype" component={PaymentSetupPrototypeScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
