import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import TabNavigator from './TabNavigator';
import MerchantScreen from '../screens/MerchantScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import MyQRCodeScreen from '../screens/MyQRCodeScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import SendInvoiceScreen from '../screens/SendInvoiceScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PaymentProcessingScreen from '../screens/PaymentProcessingScreen';
import PaymentResultScreen from '../screens/PaymentResultScreen';
import PaymentPendingScreen from '../screens/PaymentPendingScreen';
import InvoicePdfPreviewScreen from '../screens/InvoicePdfPreviewScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';

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
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} options={{ animation: 'fade' }} />
          <Stack.Screen name="Merchant" component={MerchantScreen} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} />
          <Stack.Screen name="MyQRCode" component={MyQRCodeScreen} />
          <Stack.Screen name="QRScanner" component={QRScannerScreen} />
          <Stack.Screen name="Invoices" component={InvoicesScreen} />
          <Stack.Screen name="SendInvoice" component={SendInvoiceScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen
            name="PaymentProcessing"
            component={PaymentProcessingScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen
            name="PaymentResult"
            component={PaymentResultScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen
            name="PaymentPending"
            component={PaymentPendingScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="InvoicePdfPreview" component={InvoicePdfPreviewScreen} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
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
