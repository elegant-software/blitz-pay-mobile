import { useTheme } from "../lib/ThemeContext";
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { resolveFreshCoordinates, reverseGeocodeCoordinates } from '../lib/location';
import { radius, spacing, type ThemeColors } from '../lib/theme';
import { canManageAppearances } from '../features/appearances/hooks/useAppearances';
import { createAppearance, MerchantAppearanceError } from '../features/appearances/services/appearanceService';
import type { RootStackNav } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseLocal = (value: string) => new Date(value.replace(' ', 'T'));

export default function CreateAppearanceScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { user, activeBranchScope } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const startDefault = new Date();
  const [name, setName] = useState('');
  const [start, setStart] = useState(localInput(startDefault));
  const [end, setEnd] = useState(localInput(new Date(startDefault.getTime() + 6 * 3600000)));
  const [preview, setPreview] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const eligible = canManageAppearances(user, activeBranchScope);

  const prepare = async () => {
    const startDate = parseLocal(start);
    const endDate = parseLocal(end);
    const duration = endDate.getTime() - startDate.getTime();
    if (!name.trim() || name.trim().length > 60 || Number.isNaN(duration) || duration <= 0 || duration > 7 * 86400000 || startDate.getTime() > Date.now() + 30 * 86400000) {
      Alert.alert(t('merchant_appearance_validation_failed')); return;
    }
    setSaving(true);
    try {
      const coordinates = await resolveFreshCoordinates();
      const label = await reverseGeocodeCoordinates(coordinates.latitude, coordinates.longitude);
      setPreview({ ...coordinates, label: label ?? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}` });
    } catch {
      Alert.alert(t('merchant_appearance_location_failed'));
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!activeBranchScope || !preview) return;
    setSaving(true);
    try {
      const current = await resolveFreshCoordinates();
      await createAppearance({
        merchantId: activeBranchScope.merchantId, branchId: activeBranchScope.branchId, name: name.trim(),
        declaredLatitude: current.latitude, declaredLongitude: current.longitude,
        startTime: parseLocal(start).toISOString(), endTime: parseLocal(end).toISOString(),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert(e instanceof MerchantAppearanceError ? e.detail : t('merchant_appearance_create_failed'));
    } finally { setSaving(false); }
  };

  return <View style={[styles.container, { paddingTop: insets.top }]}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={24} /></TouchableOpacity><Text style={styles.title}>{t('merchant_appearance_create_title')}</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      {!eligible ? <Text style={styles.error}>{t('merchant_appearance_access_denied')}</Text> : <>
        <Text style={styles.label}>{t('merchant_appearance_name')}</Text><TextInput style={styles.input} value={name} maxLength={60} onChangeText={setName} />
        <Text style={styles.counter}>{name.length}/60</Text>
        <Text style={styles.label}>{t('merchant_appearance_start')}</Text><TextInput style={styles.input} value={start} onChangeText={setStart} placeholder="YYYY-MM-DD HH:MM" />
        <Text style={styles.label}>{t('merchant_appearance_end')}</Text><TextInput style={styles.input} value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD HH:MM" />
        {preview ? <View style={styles.preview}><Text style={styles.previewTitle}>{t('merchant_appearance_preview')}</Text><Text style={{ color: colors.onSurface }}>{name}</Text><Text style={{ color: colors.onSurface }}>{activeBranchScope?.branchName}</Text><Text style={{ color: colors.onSurface }}>{start} - {end}</Text><Text style={{ color: colors.onSurface }}>{preview.label}</Text></View> : null}
        <TouchableOpacity style={styles.button} disabled={saving} onPress={() => void (preview ? submit() : prepare())}>
          {saving ? <ActivityIndicator color={colors.black} /> : <Text style={styles.buttonText}>{preview ? t('confirm') : t('merchant_appearance_preview')}</Text>}
        </TouchableOpacity>
      </>}
    </ScrollView>
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.background },
  title: { color: colors.onSurface, fontSize: 21, fontWeight: '800' }, content: { padding: spacing.md, gap: spacing.sm }, label: { color: colors.onSurface, fontWeight: '700' },
  input: { backgroundColor: colors.cardBg, padding: spacing.md, borderRadius: radius.lg }, counter: { textAlign: 'right', color: colors.gray500 },
  preview: { backgroundColor: colors.cardBg, padding: spacing.md, borderRadius: radius.xl, gap: spacing.xs }, previewTitle: { color: colors.onSurface, fontWeight: '800' },
  button: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.full, alignItems: 'center' }, buttonText: { color: colors.onSurface, fontWeight: '700' }, error: { color: colors.error },
});
