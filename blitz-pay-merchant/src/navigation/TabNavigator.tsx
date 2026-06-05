import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { useLanguage } from '../lib/LanguageContext';
import { useMerchantFeatures } from '../lib/useMerchantFeatures';
import type { TabParamList } from '../types';

import DashboardScreen from '../screens/DashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProductsScreen from '../screens/ProductsScreen';
import AccountScreen from '../screens/AccountScreen';
import MerchantCalendarScreen from '../screens/MerchantCalendarScreen';

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<keyof TabParamList, { active: IoniconName; inactive: IoniconName }> = {
  Dashboard: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Orders: { active: 'receipt', inactive: 'receipt-outline' },
  Appointments: { active: 'calendar', inactive: 'calendar-outline' },
  Products: { active: 'grid', inactive: 'grid-outline' },
  Account: { active: 'person', inactive: 'person-outline' },
};

export default function TabNavigator() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { appointmentsEnabled } = useMerchantFeatures();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIcons[route.name as keyof TabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          ...styles.tabBar,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: t('dashboard') }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: t('orders') }} />
      {appointmentsEnabled && (
        <Tab.Screen name="Appointments" component={MerchantCalendarScreen} options={{ title: t('appointments') }} />
      )}
      <Tab.Screen name="Products" component={ProductsScreen} options={{ title: t('products') }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: t('account') }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 16 },
    }),
  },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  tabItem: { paddingTop: 6 },
});