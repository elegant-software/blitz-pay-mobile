import React from 'react';
import GlassTabBar from './GlassTabBar';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
  const { appointmentsEnabled } = useMerchantFeatures();

  return (
    <Tab.Navigator
      tabBar={props => <GlassTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIcons[route.name as keyof TabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
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
