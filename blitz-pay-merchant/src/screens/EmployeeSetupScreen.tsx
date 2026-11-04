import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import {
  fetchEmployees,
  createEmployee,
  renameEmployee,
  activateEmployee,
  deactivateEmployee,
  type EmployeeResponse,
} from '../features/appointments/services/employeeService';

export default function EmployeeSetupScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const merchantId = activeBranchScope?.merchantId ?? null;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<EmployeeResponse | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: employees, isLoading, error, refetch } = useQuery({
    queryKey: merchantId ? ['employees', merchantId] : ['employees', 'missing'],
    queryFn: () => fetchEmployees(merchantId!),
    enabled: !!merchantId,
    staleTime: 30_000,
  });

  const invalidate = () => {
    if (merchantId) void queryClient.invalidateQueries({ queryKey: ['employees', merchantId] });
  };

  const createMutation = useMutation({
    mutationFn: () => createEmployee(merchantId!, newName.trim()),
    onSuccess: () => {
      setShowAddModal(false);
      setNewName('');
      setActionError(null);
      invalidate();
    },
    onError: () => setActionError(t('employee_setup_create_failed')),
  });

  const renameMutation = useMutation({
    mutationFn: () => renameEmployee(merchantId!, renameTarget!.id, renameValue.trim()),
    onSuccess: () => {
      setRenameTarget(null);
      setRenameValue('');
      setActionError(null);
      invalidate();
    },
    onError: () => setActionError(t('employee_setup_rename_failed')),
  });

  const activateMutation = useMutation({
    mutationFn: (employeeId: string) => activateEmployee(merchantId!, employeeId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => setActionError(t('employee_setup_activate_failed')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (employeeId: string) => deactivateEmployee(merchantId!, employeeId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => {
      if (err.message === 'employee_deactivate_has_future_bookings') {
        setActionError(t('employee_setup_deactivate_has_future_bookings'));
      } else {
        setActionError(t('employee_setup_deactivate_failed'));
      }
    },
  });

  function confirmDeactivate(employee: EmployeeResponse) {
    Alert.alert(
      t('employee_setup_deactivate_confirm_title'),
      t('employee_setup_deactivate_confirm_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('employee_setup_deactivate'),
          style: 'destructive',
          onPress: () => void deactivateMutation.mutateAsync(employee.id),
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior="padding">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('employee_setup_title')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setNewName('');
            setActionError(null);
            setShowAddModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {actionError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.errorBannerText}>{actionError}</Text>
          <TouchableOpacity onPress={() => setActionError(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('employee_setup_loading')}</Text>
        </View>
      ) : error || !merchantId ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.centerTitle}>{t('error')}</Text>
          <Text style={styles.centerText}>{t('employee_setup_load_failed')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : employees && employees.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="people-outline" size={48} color={colors.gray300} />
          <Text style={styles.centerTitle}>{t('employee_setup_title')}</Text>
          <Text style={styles.centerText}>{t('employee_setup_empty')}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setNewName('');
              setActionError(null);
              setShowAddModal(true);
            }}
          >
            <Text style={styles.retryBtnText}>{t('employee_setup_add')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: 40 + insets.bottom,
            gap: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {(employees ?? []).map((emp) => (
            <EmployeeRow
              key={emp.id}
              employee={emp}
              merchantId={merchantId!}
              onRename={() => {
                setRenameTarget(emp);
                setRenameValue(emp.name);
                setActionError(null);
              }}
              onActivate={() => void activateMutation.mutateAsync(emp.id)}
              onDeactivate={() => confirmDeactivate(emp)}
              onViewDetail={() =>
                navigation.navigate('EmployeeDetail', {
                  employeeId: emp.id,
                  merchantId: merchantId!,
                  employeeName: emp.name,
                })
              }
            />
          ))}
        </ScrollView>
      )}

      {/* Add Employee Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.modalTitle}>{t('employee_setup_add')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('employee_setup_name_placeholder')}
              placeholderTextColor={colors.gray400}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (newName.trim()) void createMutation.mutateAsync();
              }}
            />
            {actionError ? (
              <Text style={styles.modalError}>{actionError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, createMutation.isPending && styles.btnDisabled]}
              onPress={() => {
                if (newName.trim()) void createMutation.mutateAsync();
              }}
              disabled={createMutation.isPending || !newName.trim()}
              activeOpacity={0.85}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : null}
              <Text style={styles.modalPrimaryBtnText}>{t('confirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={() => setShowAddModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDismissBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameTarget(null)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.modalTitle}>{renameTarget?.name ?? ''}</Text>
            <TextInput
              style={styles.modalInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t('employee_setup_name_placeholder')}
              placeholderTextColor={colors.gray400}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (renameValue.trim()) void renameMutation.mutateAsync();
              }}
            />
            {actionError ? (
              <Text style={styles.modalError}>{actionError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, renameMutation.isPending && styles.btnDisabled]}
              onPress={() => {
                if (renameValue.trim()) void renameMutation.mutateAsync();
              }}
              disabled={renameMutation.isPending || !renameValue.trim()}
              activeOpacity={0.85}
            >
              {renameMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : null}
              <Text style={styles.modalPrimaryBtnText}>{t('save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={() => setRenameTarget(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDismissBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function EmployeeRow({
  employee,
  merchantId: _merchantId,
  onRename,
  onActivate,
  onDeactivate,
  onViewDetail,
}: {
  employee: EmployeeResponse;
  merchantId: string;
  onRename: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onViewDetail: () => void;
}) {
  const { t } = useLanguage();
  const statusColor = employee.active ? colors.success : colors.gray400;

  return (
    <TouchableOpacity
      style={[styles.employeeCard, shadow.sm]}
      onPress={onViewDetail}
      activeOpacity={0.8}
    >
      <View style={styles.employeeCardLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.employeeCardText}>
          <Text style={styles.employeeName}>{employee.name}</Text>
          <Text style={[styles.employeeStatus, { color: statusColor }]}>
            {employee.active ? t('employee_setup_active') : t('employee_setup_inactive')}
          </Text>
        </View>
      </View>
      <View style={styles.employeeCardActions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onRename}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.gray600} />
        </TouchableOpacity>
        {employee.active ? (
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnDestructive]}
            onPress={onDeactivate}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="pause-circle-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnSuccess]}
            onPress={onActivate}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle-outline" size={18} color={colors.success} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.error}10`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.error}20`,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.onSurface },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  centerTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  centerText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: { color: colors.onPrimary, fontWeight: '700' },
  employeeCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  employeeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  employeeCardText: { flex: 1 },
  employeeName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  employeeStatus: { fontSize: 12, marginTop: 2 },
  employeeCardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDestructive: { backgroundColor: `${colors.error}10` },
  iconBtnSuccess: { backgroundColor: `${colors.success}10` },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.onSurface,
  },
  modalError: { fontSize: 13, color: colors.error },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.55 },
  modalPrimaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  modalDismissBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  modalDismissBtnText: { fontSize: 15, color: colors.gray600 },
});
