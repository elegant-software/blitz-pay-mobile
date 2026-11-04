import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { useFloorPlans } from '../features/tables/hooks/useFloorPlans';
import { DraggableTablePin, FloorPlanCanvas } from '../features/tables/components/FloorPlanCanvas';
import { pinCaption } from '../features/tables/tableLogic';
import {
  CenterState,
  ErrorBanner,
  TablesScreenFrame,
  tableStyles,
} from '../features/tables/components/TablesChrome';

export default function FloorPlanEditorScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const { floorPlanId } = useRoute<RouteProp<RootStackParamList, 'FloorPlanEditor'>>().params;
  const vm = useFloorPlans();
  const plan = vm.floorPlans.find((candidate) => candidate.id === floorPlanId) ?? null;

  const frame = (title: string, children: React.ReactNode) => (
    <TablesScreenFrame title={title} onBack={() => navigation.goBack()}>{children}</TablesScreenFrame>
  );

  if (!vm.canManage) return frame(t('floor_plans_title'), <CenterState icon="lock-closed-outline" text={t('tables_manager_only')} />);
  if (vm.loading) return frame(t('floor_plans_title'), <CenterState loading text={t('loading')} />);
  if (!plan) return frame(t('floor_plans_title'), <CenterState icon="alert-circle-outline" text={t('floor_plan_not_found')} />);

  const placed = vm.tables.filter((table) => table.placement?.floorPlanId === plan.id);
  const notHere = vm.tables.filter((table) => table.placement?.floorPlanId !== plan.id);

  return frame(
    plan.name,
    // The canvas stays outside the ScrollView so dragging a pin never scrolls the page.
    <View style={styles.flex}>
      <ErrorBanner error={vm.actionError} />
      <View style={tableStyles.card}>
        <Text style={tableStyles.hint}>{plan.imageUrl ? t('floor_plan_editor_hint') : t('floor_plan_editor_needs_photo')}</Text>
        <View style={styles.canvasWrap}>
          <FloorPlanCanvas imageUrl={plan.imageUrl} emptyLabel={t('floor_plan_no_photo')}>
            {(size) =>
              placed.map((table) => (
                <DraggableTablePin
                  key={table.id}
                  label={table.name}
                  seats={table.seats}
                  x={table.placement!.x}
                  y={table.placement!.y}
                  size={size}
                  onDrop={(fraction) => void vm.place(table.id, plan.id, fraction.x, fraction.y)}
                  onLongPress={() =>
                    Alert.alert(t('table_unplace_title'), t('table_unplace_body', { name: table.name }), [
                      { text: t('cancel'), style: 'cancel' },
                      { text: t('table_unplace_action'), style: 'destructive', onPress: () => void vm.unplace(table.id) },
                    ])
                  }
                />
              ))
            }
          </FloorPlanCanvas>
        </View>
      </View>

      {plan.imageUrl ? (
        <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={tableStyles.card}>
          <Text style={tableStyles.sectionTitle}>{t('floor_plan_tray_title')}</Text>
          {notHere.length === 0 ? <Text style={tableStyles.hint}>{t('floor_plan_tray_empty')}</Text> : null}
          <View style={styles.tray}>
            {notHere.map((table) => (
              <TouchableOpacity
                key={table.id}
                style={[styles.chip, table.placement && styles.chipElsewhere]}
                disabled={vm.busy}
                onPress={() => void vm.place(table.id, plan.id, 0.5, 0.5)}
              >
                <Text style={styles.chipText}>{pinCaption(table.name, table.seats)}</Text>
                {table.placement ? <Text style={styles.chipSub}>{t('table_on_other_plan')}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </ScrollView>
      ) : null}
    </View>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  canvasWrap: { marginTop: spacing.md },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: `${colors.secondary}15`,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
  },
  chipElsewhere: { borderStyle: 'dashed' },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.secondary },
  chipSub: { fontSize: 10, color: colors.gray600 },
});
