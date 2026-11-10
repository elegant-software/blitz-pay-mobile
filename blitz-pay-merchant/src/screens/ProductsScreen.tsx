import React from 'react';
import { ProductImage } from '../features/products/components/ProductImage';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { useMerchantCatalogBrowser } from '../features/products/hooks/useMerchantCatalogBrowser';
import { CatalogCategories } from '../features/products/components/CatalogCategories';
import { CatalogListFooter } from '../features/products/components/CatalogListFooter';
import { CatalogSkeleton } from '../features/products/components/CatalogSkeleton';
import type { RootStackNav } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}


export default function ProductsScreen() {
  const { t } = useLanguage();
  const { activeBranchScope, branchScopeError, retryBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const { products, loading, refreshing, errorKey, errorDetail, categories, uncategorizedCount, categoryId, selectCategory, reload, loadingMore, hasMore, loadMore, pageErrorKey, pageErrorDetail, retry } = useMerchantCatalogBrowser(activeBranchScope, branchScopeError);


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('products')}</Text>
          {activeBranchScope?.merchantName || activeBranchScope?.branchName ? (
            <Text style={styles.subtitle}>
              {[activeBranchScope.merchantName, activeBranchScope.branchName].filter(Boolean).join(' · ')}
            </Text>
          ) : (
            <Text style={styles.subtitle}>{t('merchant_branch_scope_pending')}</Text>
          )}
        </View>
        {refreshing ? <ActivityIndicator color={colors.primary} style={styles.refreshIndicator} /> : null}
        <TouchableOpacity
          style={[styles.addBtn, !activeBranchScope?.branchId && styles.addBtnDisabled]}
          onPress={() => activeBranchScope?.branchId && navigation.navigate('ProductEdit', { mode: 'create' })}
          disabled={!activeBranchScope?.branchId}
        >
          <Ionicons name="add" size={20} color={colors.black} />
          <Text style={styles.addBtnText}>{t('add_product')}</Text>
        </TouchableOpacity>
      </View>

      <CatalogCategories uncategorizedCount={uncategorizedCount} categories={categories} selectedId={categoryId} onSelect={selectCategory} />
      <FlatList
        key={JSON.stringify([activeBranchScope?.merchantId, activeBranchScope?.branchId, categoryId])}
        data={loading || errorKey ? [] : products}
        keyExtractor={product => product.id}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={() => void reload()}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 90 + insets.bottom, paddingTop: spacing.sm }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<CatalogListFooter loading={loadingMore} hasMore={hasMore} onLoadMore={loadMore}
          error={pageErrorDetail ?? (pageErrorKey ? t(pageErrorKey as Parameters<typeof t>[0]) : undefined)}
          onRetry={() => void retry()} />}
        ListEmptyComponent={<>
          {loading ? (
            <CatalogSkeleton />
          ) : errorKey ? (
            <View style={[styles.stateCard, shadow.sm]}>
              <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
              <Text style={styles.stateTitle}>{errorDetail ?? t(errorKey as Parameters<typeof t>[0])}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => void (branchScopeError ? retryBranchScope() : reload())}
              >
                <Text style={styles.retryBtnText}>{t('retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : products.length === 0 ? (
            <View style={[styles.stateCard, shadow.sm]}>
              <Ionicons name="cube-outline" size={24} color={colors.gray500} />
              <Text style={styles.stateTitle}>{t(categoryId ? 'catalog_category_empty' : 'merchant_products_empty')}</Text>
              {categoryId ? <Text style={styles.stateTitle}>{t('catalog_category_empty_hint')}</Text> : null}
            </View>
          ) : null}
        </>}
        renderItem={({ item: product }) => (
          <TouchableOpacity
            style={[styles.productCard, shadow.sm, !product.active && styles.productCardInactive]}
            onPress={() => navigation.navigate('ProductEdit', { productId: product.id, mode: 'edit' })}
            activeOpacity={0.7}
          >
            <View style={styles.productLeft}>
              {product.thumbnailUrl || product.imageUrl ? (
                <ProductImage variant="thumbnail" merchantId={activeBranchScope?.merchantId} branchId={product.branchId} productId={product.id}
                  source={{ uri: product.thumbnailUrl ?? product.imageUrl }} style={styles.productIcon} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.productIcon, { backgroundColor: product.active ? `${colors.primary}15` : colors.surface }]}>
                  <Ionicons name="cube-outline" size={22} color={product.active ? colors.primary : colors.gray400} />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={[styles.productName, !product.active && styles.textMuted]}>{product.name}</Text>
                {product.categoryName ? <Text style={styles.productMeta}>{product.categoryName}</Text> : null}
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
        )}
      />
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
  refreshIndicator: { marginLeft: 'auto', marginRight: spacing.sm },
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
