import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal, Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius } from '../lib/theme';
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
import StripeCheckoutReturnScreen from '../screens/StripeCheckoutReturnScreen';
import InvoicePdfPreviewScreen from '../screens/InvoicePdfPreviewScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import AvailableSlotsScreen from '../screens/AvailableSlotsScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import MyAppointmentsScreen from '../screens/MyAppointmentsScreen';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { initialized, authenticated, isBiometricAvailable, biometricEnrolled, biometricPromptDismissed, enrollBiometric, dismissBiometricPrompt } = useAuth();
  const { t } = useLanguage();
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  useEffect(() => {
    if (authenticated && isBiometricAvailable && !biometricEnrolled && !biometricPromptDismissed) {
      setShowBiometricPrompt(true);
    }
  }, [authenticated, isBiometricAvailable, biometricEnrolled, biometricPromptDismissed]);

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
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
          <Stack.Screen
            name="StripeCheckoutReturn"
            component={StripeCheckoutReturnScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="InvoicePdfPreview" component={InvoicePdfPreviewScreen} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="AvailableSlots" component={AvailableSlotsScreen} />
          <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
          <Stack.Screen name="MyAppointments" component={MyAppointmentsScreen} />
          <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
        </>
      )}
    </Stack.Navigator>

    <Modal
      visible={showBiometricPrompt}
      transparent
      animationType="slide"
      onRequestClose={() => {
        void dismissBiometricPrompt();
        setShowBiometricPrompt(false);
      }}
    >
      <View style={styles.promptOverlay}>
        <View style={styles.promptSheet}>
          <View style={styles.promptIconWrap}>
            <Ionicons name="finger-print" size={36} color={colors.primary} />
          </View>
          <Text style={styles.promptTitle}>{t('biometric_prompt_title')}</Text>
          <Text style={styles.promptBody}>{t('biometric_prompt_body')}</Text>
          <TouchableOpacity
            style={styles.promptEnableBtn}
            activeOpacity={0.85}
            onPress={async () => {
              await enrollBiometric();
              await dismissBiometricPrompt();
              setShowBiometricPrompt(false);
            }}
          >
            <Text style={styles.promptEnableBtnText}>{t('biometric_prompt_enable')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.promptDismissBtn}
            activeOpacity={0.85}
            onPress={async () => {
              await dismissBiometricPrompt();
              setShowBiometricPrompt(false);
            }}
          >
            <Text style={styles.promptDismissBtnText}>{t('biometric_prompt_not_now')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  promptOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  promptSheet: {
    backgroundColor: '#0D0D2B',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    paddingBottom: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  promptIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  promptBody: {
    fontSize: 14,
    color: colors.gray400,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  promptEnableBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  promptEnableBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
  },
  promptDismissBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    width: '100%',
  },
  promptDismissBtnText: {
    fontSize: 15,
    color: colors.gray400,
  },
});
