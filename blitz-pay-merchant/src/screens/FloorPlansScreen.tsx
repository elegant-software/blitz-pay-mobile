import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing } from '../lib/theme';
import type { RootStackNav } from '../types';
import { useFloorPlans } from '../features/tables/hooks/useFloorPlans';
import {
  CenterState,
  ErrorBanner,
  TablesScreenFrame,
  tableStyles,
  useErrorText,
} from '../features/tables/components/TablesChrome';
import type { FloorPlan } from '../features/tables/types/table';

export default function FloorPlansScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const vm = useFloorPlans();
  const errorText = useErrorText();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const frame = (children: React.ReactNode) => (
    <TablesScreenFrame title={t('floor_plans_title')} onBack={() => navigation.goBack()}>{children}</TablesScreenFrame>
  );

  if (!vm.canManage) return frame(<CenterState icon="lock-closed-outline" text={t('tables_manager_only')} />);
  if (vm.loading) return frame(<CenterState loading text={t('loading')} />);
  if (vm.loadError) {
    return frame(
      <CenterState icon="alert-circle-outline" text={errorText(vm.loadError)} action={{ label: t('kpi_retry'), onPress: () => void vm.reload() }} />,
    );
  }

  const pickImage = async (plan: FloorPlan) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await vm.uploadImage(plan.id, asset.uri, asset.mimeType);
  };

  const remove = (plan: FloorPlan) => {
    Alert.alert(t('floor_plan_delete_title'), t('floor_plan_delete_body', { name: plan.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('floor_plan_delete_action'), style: 'destructive', onPress: () => void vm.remove(plan.id) },
    ]);
  };

  return frame(
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <View style={tableStyles.card}>
        <Text style={tableStyles.sectionTitle}>{t('floor_plan_create_title')}</Text>
        <Text style={tableStyles.hint}>{t('floor_plan_create_hint')}</Text>
        <View style={[tableStyles.row, styles.spaced]}>
          <TextInput
            style={[tableStyles.input, styles.flex]}
            value={newName}
            onChangeText={setNewName}
            placeholder={t('floor_plan_name_placeholder')}
            placeholderTextColor={colors.gray500}
            maxLength={40}
          />
          <TouchableOpacity
            style={[tableStyles.primaryBtn, (!newName.trim() || vm.busy) && tableStyles.disabled]}
            disabled={!newName.trim() || vm.busy}
            onPress={async () => {
              if (await vm.create(newName)) setNewName('');
            }}
          >
            <Ionicons name="add" size={18} color={colors.black} />
          </TouchableOpacity>
        </View>
      </View>

      <ErrorBanner error={vm.actionError} />

      {vm.floorPlans.length === 0 ? <Text style={styles.empty}>{t('floor_plans_empty')}</Text> : null}

      {vm.floorPlans.map((plan) => {
        const placedCount = vm.tables.filter((table) => table.placement?.floorPlanId === plan.id).length;
        return (
          <View key={plan.id} style={tableStyles.card}>
            <View style={tableStyles.row}>
              {editing?.id === plan.id ? (
                <>
                  <TextInput
                    style={[tableStyles.input, styles.flex]}
                    value={editing.name}
                    onChangeText={(name) => setEditing({ id: plan.id, name })}
                    maxLength={40}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.iconBtn}
                    disabled={!editing.name.trim() || vm.busy}
                    accessibilityLabel={t('save')}
                    onPress={async () => {
                      if (await vm.rename(plan.id, editing.name)) setEditing(null);
                    }}
                  >
                    <Ionicons name="checkmark" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.flex}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={tableStyles.hint}>
                      {plan.imageUrl ? t('floor_plan_tables_placed', { count: placedCount }) : t('floor_plan_no_photo')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEditing({ id: plan.id, name: plan.name })}
                    style={styles.iconBtn}
                    accessibilityLabel={t('floor_plan_rename_title')}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.gray700} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => remove(plan)} style={styles.iconBtn} accessibilityLabel={t('floor_plan_delete_action')}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
            <View style={[tableStyles.row, styles.spaced]}>
              <TouchableOpacity style={[tableStyles.secondaryBtn, styles.flex]} disabled={vm.busy} onPress={() => void pickImage(plan)}>
                <Ionicons name="image-outline" size={16} color={colors.onSurface} />
                <Text style={tableStyles.secondaryBtnText}>
                  {plan.imageUrl ? t('floor_plan_replace_photo') : t('floor_plan_upload_photo')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[tableStyles.primaryBtn, styles.flex]}
                onPress={() => navigation.navigate('FloorPlanEditor', { floorPlanId: plan.id })}
              >
                <Ionicons name="move-outline" size={16} color={colors.black} />
                <Text style={tableStyles.primaryBtnText}>{t('floor_plan_arrange')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  spaced: { marginTop: spacing.md },
  empty: { textAlign: 'center', color: colors.gray600, padding: spacing.lg },
  planName: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
