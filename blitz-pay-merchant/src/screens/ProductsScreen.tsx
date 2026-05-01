import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { observability } from '../lib/observability';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { resolveCurrentCoordinates } from '../lib/location';
import {
  fetchBranchProducts,
  type MerchantScope,
  MerchantProductError,
  resolveNearbyMerchantScope,
} from '../lib/merchantProducts';
import type { RootStackNav, Product } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}


function groupByCategory(products: Product[], uncategorizedLabel: string): { category: string; items: Product[] }[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.categoryName ?? uncategorizedLabel;
    const existing = map.get(key);
    if (existing) existing.push(p);
    else map.set(key, [p]);
  }
  const groups = Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  groups.sort((a, b) => {
    if (a.category === uncategorizedLabel) return 1;
    if (b.category === uncategorizedLabel) return -1;
    return a.category.localeCompare(b.category);
  });
  return groups;
}

export default function ProductsScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [merchantScope, setMerchantScope] = useState<MerchantScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      const coords = await resolveCurrentCoordinates();
      const activeScope = await resolveNearbyMerchantScope(coords);

      const branchProducts = await fetchBranchProducts(activeScope.merchantId, activeScope.branchId);
      setMerchantScope(activeScope);
      setBranchId(activeScope.branchId);
      setBranchName(activeScope.branchName);
      setProducts(branchProducts);
      setLoading(false);
    } catch (error) {
      observability.warn('merchant_products_branch_resolution_failed', {
        merchantId: merchantScope?.merchantId ?? null,
        reason: error instanceof Error ? error.message : 'unknown_error',
      });
      setMerchantScope(null);
      setProducts([]);
      setBranchId(null);
      setBranchName(null);
      setErrorKey(error instanceof MerchantProductError ? error.key : 'merchant_products_load_failed');
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

  const groups = groupByCategory(products, t('product_uncategorized'));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('products')}</Text>
          <Text style={styles.subtitle}>
            {branchName ? `${t('merchant_branch_scope')}: ${branchName}` : t('merchant_branch_scope_pending')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, !branchId && styles.addBtnDisabled]}
          onPress={() => branchId && navigation.navigate('ProductEdit', { mode: 'create' })}
          disabled={!branchId}
        >
          <Ionicons name="add" size={20} color={colors.black} />
          <Text style={styles.addBtnText}>{t('add_product')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 90 + insets.bottom, paddingTop: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[styles.stateCard, shadow.sm]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateTitle}>{t('merchant_products_loading')}</Text>
          </View>
        ) : errorKey ? (
          <View style={[styles.stateCard, shadow.sm]}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
            <Text style={styles.stateTitle}>{t(errorKey as Parameters<typeof t>[0])}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadProducts}>
              <Text style={styles.retryBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <View style={[styles.stateCard, shadow.sm]}>
            <Ionicons name="cube-outline" size={24} color={colors.gray500} />
            <Text style={styles.stateTitle}>{t('merchant_products_empty')}</Text>
          </View>
        ) : (
          groups.map(({ category, items }) => (
            <View key={category}>
              <Text style={styles.categoryHeader}>{category}</Text>
              {items.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.productCard, shadow.sm, !product.active && styles.productCardInactive]}
                  onPress={() => navigation.navigate('ProductEdit', { productId: product.id, mode: 'edit' })}
                  activeOpacity={0.7}
                >
                  <View style={styles.productLeft}>
                    <View style={[styles.productIcon, { backgroundColor: product.active ? `${colors.primary}15` : colors.surface }]}>
                      <Ionicons name="cube-outline" size={22} color={product.active ? colors.primary : colors.gray400} />
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, !product.active && styles.textMuted]}>{product.name}</Text>
                      {product.productCode != null ? <Text style={styles.productMeta}>#{product.productCode}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.productRight}>
                    <Text style={[styles.productPrice, !product.active && styles.textMuted]}>
                      {formatCurrency(product.unitPrice)}
                    </Text>
                    <Text style={[styles.productStatus, !product.active && styles.productStatusInactive]}>
                      {product.active ? t('product_status_active') : t('product_status_inactive')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.gray600 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  stateCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
  },
  stateTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.xs, backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  categoryHeader: {
    fontSize: 13, fontWeight: '700', color: colors.gray500,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.md, marginBottom: spacing.xs, paddingLeft: 2,
  },
  productCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  productCardInactive: { opacity: 0.65 },
  productLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  productIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  productMeta: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  textMuted: { color: colors.gray400 },
  productRight: { alignItems: 'flex-end', gap: 4 },
  productPrice: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  productStatus: { fontSize: 11, color: colors.success, fontWeight: '600' },
  productStatusInactive: { color: colors.error },
});
