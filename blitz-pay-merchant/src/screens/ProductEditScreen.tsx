import React, { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Switch, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { observability } from '../lib/observability';
import { resolveCurrentCoordinates } from '../lib/location';
import { colors, spacing, radius, shadow } from '../lib/theme';
import {
  createMerchantProduct,
  fetchBranchProducts,
  fetchProductDetail,
  type MerchantScope,
  MerchantProductError,
  resolveNearbyMerchantScope,
  updateMerchantProduct,
} from '../lib/merchantProducts';
import type { Product, RootStackParamList } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'ProductEdit'>;

type FormState = {
  branchId: string;
  branchName: string;
  name: string;
  description: string;
  price: string;
  imageUri: string;
  category: string;
  productCode: string;
  active: boolean;
};


export default function ProductEditScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const isEdit = route.params.mode === 'edit';

  const [form, setForm] = useState<FormState>({
    branchId: '',
    branchName: '',
    name: '',
    description: '',
    price: '',
    imageUri: '',
    category: '',
    productCode: '',
    active: true,
  });
  const [merchantScope, setMerchantScope] = useState<MerchantScope | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorKey(null);

      try {
        const coords = await resolveCurrentCoordinates();
        const activeScope = await resolveNearbyMerchantScope(coords);
        if (!active) return;
        setMerchantScope(activeScope);

        // Load existing categories from branch products for the dropdown
        fetchBranchProducts(activeScope.merchantId, activeScope.branchId)
          .then((products) => {
            const seen = new Set<string>();
            const cats: string[] = [];
            for (const p of products) {
              if (p.categoryName && !seen.has(p.categoryName)) {
                seen.add(p.categoryName);
                cats.push(p.categoryName);
              }
            }
            if (active) setCategories(cats.sort());
          })
          .catch(() => {}); // non-critical, dropdown just shows no options

        if (!isEdit || !route.params.productId) {
          setForm({
            branchId: activeScope.branchId,
            branchName: activeScope.branchName,
            name: '',
            description: '',
            price: '',
            imageUri: '',
            category: '',
            productCode: '',
            active: true,
          });
          setLoading(false);
          return;
        }

        const product = await fetchProductDetail(
          activeScope.merchantId,
          activeScope.branchId,
          route.params.productId,
        );
        if (!active) return;
        hydrateForm(product, activeScope.branchName);
        setLoading(false);
      } catch (error) {
        if (!active) return;
        observability.warn('merchant_product_branch_resolution_failed', {
          merchantId: merchantScope?.merchantId ?? null,
          productId: route.params.productId ?? null,
          reason: error instanceof Error ? error.message : 'unknown_error',
        });
        setMerchantScope(null);
        setErrorKey(error instanceof MerchantProductError ? error.key : 'merchant_product_load_failed');
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isEdit, route.params.productId]);

  function hydrateForm(product: Product, currentBranchName: string) {
    setForm({
      branchId: product.branchId ?? '',
      branchName: currentBranchName,
      name: product.name,
      description: product.description ?? '',
      price: product.unitPrice.toFixed(2),
      imageUri: product.imageUrl ?? '',
      category: product.categoryName ?? '',
      productCode: product.productCode != null ? String(product.productCode) : '',
      active: product.active,
    });
  }

  const canSave = useMemo(() => {
    if (!form.branchId) return false;
    if (!form.name.trim()) return false;
    const parsedPrice = Number(form.price.replace(',', '.'));
    return Number.isFinite(parsedPrice) && parsedPrice > 0;
  }, [form.branchId, form.name, form.price]);

  const handleSave = async () => {
    if (!merchantScope?.merchantId || !canSave) {
      setErrorKey('merchant_product_validation_failed');
      return;
    }

    setSaving(true);
    setErrorKey(null);
    try {
      const input = {
        branchId: form.branchId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        unitPrice: Number(form.price.replace(',', '.')).toFixed(2),
        imageUri: form.imageUri.trim() || undefined,
        categoryName: form.category.trim() || undefined,
        productCode: form.productCode.trim() || undefined,
        active: form.active,
      };

      if (isEdit && route.params.productId) {
        await updateMerchantProduct(merchantScope.merchantId, route.params.productId, input);
      } else {
        await createMerchantProduct(merchantScope.merchantId, input);
      }
      navigation.goBack();
    } catch (error) {
      setErrorKey(error instanceof MerchantProductError ? error.key : 'merchant_product_save_failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errorKey) setErrorKey(null);
  };

  const handlePickImage = () => {
    Alert.alert(t('product_image'), undefined, [
      {
        text: t('product_image_take_photo'),
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            handleChange('imageUri', result.assets[0].uri);
          }
        },
      },
      {
        text: t('product_image_choose_library'),
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            handleChange('imageUri', result.assets[0].uri);
          }
        },
      },
      ...(form.imageUri ? [{
        text: t('product_image_remove'),
        style: 'destructive' as const,
        onPress: () => handleChange('imageUri', ''),
      }] : []),
      { text: t('cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? t('edit_product') : t('add_product')}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? <ActivityIndicator size="small" color={colors.black} /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>{t('merchant_product_loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, shadow.sm]}>
            <Text style={styles.scopeLabel}>{t('merchant_branch_scope')}</Text>
            <Text style={styles.scopeValue}>{form.branchName || '—'}</Text>
          </View>

          <View style={[styles.card, shadow.sm]}>
            <Field label={t('product_name')} required>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => handleChange('name', v)}
                placeholder="Espresso"
                placeholderTextColor={colors.gray400}
              />
            </Field>

            <Field label={t('product_category')}>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setCategoryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownText, !form.category && styles.dropdownPlaceholder]}>
                  {form.category || t('product_category')}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.gray400} />
              </TouchableOpacity>
            </Field>

            <Field label={t('product_code')}>
              <TextInput
                style={styles.input}
                value={form.productCode}
                onChangeText={(v) => handleChange('productCode', v)}
                placeholder="e.g. PROD-001"
                placeholderTextColor={colors.gray400}
                autoCapitalize="characters"
              />
            </Field>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('product_active')}</Text>
              <Switch
                value={form.active}
                onValueChange={(v) => handleChange('active', v)}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <Field label={t('product_description')}>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.description}
                onChangeText={(v) => handleChange('description', v)}
                placeholder={t('product_description')}
                placeholderTextColor={colors.gray400}
                multiline
                numberOfLines={4}
              />
            </Field>

            <Field label={`${t('product_price')} (EUR)`} required>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={(v) => handleChange('price', v)}
                placeholder="0.00"
                placeholderTextColor={colors.gray400}
                keyboardType="decimal-pad"
              />
            </Field>

            <Field label={t('product_image')}>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={18} color={colors.secondary} />
                <Text style={styles.imagePickerText}>
                  {form.imageUri ? t('product_image_choose_library') : t('product_image_take_photo')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
              </TouchableOpacity>
              {form.imageUri ? (
                <Image source={{ uri: form.imageUri }} style={styles.previewImage} resizeMode="cover" />
              ) : null}
            </Field>

            {errorKey ? <Text style={styles.errorText}>{t(errorKey as Parameters<typeof t>[0])}</Text> : null}
          </View>
        </ScrollView>
      )}
      <Modal visible={categoryModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCategoryModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('product_category')}</Text>
            <FlatList
              data={categories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, form.category === item && styles.modalOptionSelected]}
                  onPress={() => { handleChange('category', item); setCategoryModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, form.category === item && styles.modalOptionTextSelected]}>
                    {item}
                  </Text>
                  {form.category === item && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>{t('merchant_products_empty')}</Text>
              }
            />
            {form.category ? (
              <TouchableOpacity
                style={styles.modalClearBtn}
                onPress={() => { handleChange('category', ''); setCategoryModalVisible(false); }}
              >
                <Text style={styles.modalClearText}>{t('product_image_remove').replace('Image', 'Category')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginBottom: 6 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  saveBtn: {
    minWidth: 72, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  stateCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.xl,
  },
  stateText: { fontSize: 14, color: colors.onSurface, textAlign: 'center' },
  scroll: { padding: spacing.md },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  scopeLabel: { fontSize: 12, fontWeight: '700', color: colors.gray600, textTransform: 'uppercase' },
  scopeValue: { marginTop: 6, fontSize: 16, fontWeight: '700', color: colors.onSurface },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 15, color: colors.onSurface,
    borderWidth: 1, borderColor: colors.gray200,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.gray200,
  },
  dropdownText: { fontSize: 15, color: colors.onSurface, flex: 1 },
  dropdownPlaceholder: { color: colors.gray400 },
  modalOverlay: {
    flex: 1, backgroundColor: colors.overlayDark, justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm, paddingBottom: spacing.xl, maxHeight: '60%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray300,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '700', color: colors.onSurface,
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalOptionSelected: { backgroundColor: `${colors.primary}10` },
  modalOptionText: { fontSize: 15, color: colors.onSurface },
  modalOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  modalEmpty: {
    fontSize: 14, color: colors.gray500, textAlign: 'center',
    padding: spacing.lg,
  },
  modalClearBtn: {
    marginTop: spacing.sm, marginHorizontal: spacing.lg,
    padding: spacing.md, alignItems: 'center',
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.error,
  },
  modalClearText: { fontSize: 14, fontWeight: '600', color: colors.error },
  imagePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.gray200,
  },
  imagePickerText: { flex: 1, fontSize: 15, color: colors.onSurface },
  previewImage: { width: '100%', height: 180, borderRadius: radius.lg, backgroundColor: colors.surface, marginTop: spacing.sm },
  errorText: { marginTop: spacing.md, fontSize: 12, color: colors.error },
});
