import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { useLanguage } from '../lib/LanguageContext';
import type { TabParamList } from '../types';

import ExploreScreen from '../screens/ExploreScreen';
import AppointmentsTabScreen from '../screens/AppointmentsTabScreen';
import VaultScreen from '../screens/VaultScreen';
import AccountScreen from '../screens/AccountScreen';

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<keyof TabParamList, { active: IoniconName; inactive: IoniconName }> = {
  Explore: { active: 'compass', inactive: 'compass-outline' },
  Appointments: { active: 'calendar', inactive: 'calendar-outline' },
  Vault: { active: 'wallet', inactive: 'wallet-outline' },
  Account: { active: 'person', inactive: 'person-outline' },
};

export default function TabNavigator() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const tabLabels: Record<keyof TabParamList, string> = {
    Explore: t('explore'),
    Appointments: t('tab_appointments'),
    Vault: t('vault'),
    Account: t('account'),
  };

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
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: tabLabels.Explore }} />
      <Tab.Screen name="Appointments" component={AppointmentsTabScreen} options={{ title: tabLabels.Appointments }} />
      <Tab.Screen name="Vault" component={VaultScreen} options={{ title: tabLabels.Vault }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: tabLabels.Account }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tabItem: {
    paddingTop: 6,
  },
});
