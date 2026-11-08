import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { DEFAULT_GUEST_COUNT, useTableCheckIn } from '../features/table-checkin/hooks/useTableCheckIn';

const MAX_GUESTS = 50;

export default function TableCheckInScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'TableCheckIn'>>();
  const insets = useSafeAreaInsets();
  const linkCode = route.params?.code;
  const [input, setInput] = useState('');
  const [guests, setGuests] = useState(DEFAULT_GUEST_COUNT);

  const onReady = useCallback(
    (params: RootStackParamList['Merchant']) => navigation.replace('Merchant', params),
    [navigation],
  );
  const { state, checkIn, confirmGuests } = useTableCheckIn(onReady);

  useEffect(() => {
    if (linkCode) void checkIn(linkCode);
  }, [checkIn, linkCode]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('table_checkin_title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        {state.phase === 'resolving' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.hint}>{t('table_checkin_resolving')}</Text>
          </View>
        ) : state.phase === 'guests' ? (
          <View style={styles.card}>
            <Ionicons name="people-outline" size={32} color={colors.secondary} />
            <Text style={styles.title}>{t('table_guests_question')}</Text>
            <Text style={styles.hint}>
              {state.checkIn.branchName || state.checkIn.merchantName} · {t('table_banner', { name: state.checkIn.tableName ?? '' })}
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                disabled={guests <= 1}
                accessibilityLabel={t('table_guests_decrease')}
                onPress={() => setGuests((value) => Math.max(1, value - 1))}
              >
                <Ionicons name="remove" size={22} color={colors.onSurface} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{guests}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                disabled={guests >= MAX_GUESTS}
                accessibilityLabel={t('table_guests_increase')}
                onPress={() => setGuests((value) => Math.min(MAX_GUESTS, value + 1))}
              >
                <Ionicons name="add" size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => confirmGuests(guests)}>
              <Text style={styles.primaryBtnText}>{t('table_guests_continue')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Ionicons name="restaurant-outline" size={32} color={colors.secondary} />
            <Text style={styles.title}>{t('table_code_enter_title')}</Text>
            <Text style={styles.hint}>{t('table_code_enter_hint')}</Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="ABC234"
              placeholderTextColor={colors.gray500}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={80}
              returnKeyType="go"
              onSubmitEditing={() => void checkIn(input)}
            />
            {state.phase === 'error' ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>
                  {state.detail || t(state.key as Parameters<typeof t>[0])}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.primaryBtn, !input.trim() && styles.disabled]}
              disabled={!input.trim()}
              onPress={() => void checkIn(input)}
            >
              <Text style={styles.primaryBtnText}>{t('table_code_enter_action')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  body: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.md },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.onSurface, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.onSurface,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  stepValue: { minWidth: 40, textAlign: 'center', fontSize: 32, fontWeight: '800', color: colors.onSurface },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
  disabled: { opacity: 0.5 },
  errorBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: `${colors.error}10`,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.onSurface },
});
