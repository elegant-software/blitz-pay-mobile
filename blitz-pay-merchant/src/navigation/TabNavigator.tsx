import { useTheme } from '../lib/ThemeContext';
import React, { createRef, useRef } from 'react';
import { View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassTabBar, { GLASS_TAB_BAR_HEIGHT } from './GlassTabBar';
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

const tabIcons: Record<
  keyof TabParamList,
  { active: IoniconName; inactive: IoniconName }
> = {
  Dashboard: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Orders: { active: 'receipt', inactive: 'receipt-outline' },
  Appointments: { active: 'calendar', inactive: 'calendar-outline' },
  Products: { active: 'grid', inactive: 'grid-outline' },
  Account: { active: 'person', inactive: 'person-outline' },
};

export default function TabNavigator() {
  const { colors } = useTheme();
  const blurTargets = useRef(
    new Map<string, React.RefObject<React.ComponentRef<typeof View> | null>>(),
  );
  const getBlurTarget = (key: string) => {
    let target = blurTargets.current.get(key);
    if (!target) {
      target = createRef<React.ComponentRef<typeof View>>();
      blurTargets.current.set(key, target);
    }
    return target;
  };

  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { appointmentsEnabled } = useMerchantFeatures();

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <GlassTabBar
          {...props}
          blurTarget={getBlurTarget(props.state.routes[props.state.index].key)}
        />
      )}
      screenLayout={({ children, route }) => (
        <BlurTargetView ref={getBlurTarget(route.key)} style={{ flex: 1 }}>
          {children}
        </BlurTargetView>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIcons[route.name as keyof TabParamList];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          position: 'absolute',
          height: GLASS_TAB_BAR_HEIGHT + Math.max(insets.bottom, 10),
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t('dashboard') }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: t('orders') }}
      />
      {appointmentsEnabled && (
        <Tab.Screen
          name="Appointments"
          component={MerchantCalendarScreen}
          options={{ title: t('appointments') }}
        />
      )}
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: t('products') }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: t('account') }}
      />
    </Tab.Navigator>
  );
}
