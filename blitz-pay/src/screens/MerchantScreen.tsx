import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { useMerchantCatalog } from '../features/merchant-catalog/hooks/useMerchantCatalog';
import { useBasket } from '../features/basket/hooks/useBasket';
import { resolveImageUri } from '../lib/imageUri';
import { observability } from '../lib/observability';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import type { ActiveProduct, MerchantBranch } from '../features/merchant-catalog/types/catalog';

type ProductRowProps = {
  product: ActiveProduct;
  quantity: number;
  token: string | null;
  merchantId: string | undefined;
  merchantName: string;
  branch: MerchantBranch | null;
  onPress: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
};

function ProductRow({ product, quantity, token, merchantId, branch, onPress, onDecrement, onIncrement }: ProductRowProps) {
  const productImage = resolveImageUri(product.imageUrl);
  const imageMeta = summarizeImageUri(productImage?.uri);
  return (
    <TouchableOpacity style={styles.productRow} activeOpacity={0.75} onPress={onPress}>
      {productImage ? (
        <Image
          source={{
            uri: productImage.uri,
            headers: productImage.needsAuth && token ? { Authorization: `Bearer ${token}` } : undefined,
          }}
          style={styles.productImage}
          resizeMode="cover"
          onLoadStart={() => {
            observability.info('merchant_product_image_load_started', {
              merchantId: merchantId ?? null,
              branchId: branch?.branchId ?? null,
              productId: product.productId,
              imageHost: imageMeta.host,
              imagePath: imageMeta.path,
            });
          }}
          onLoad={() => {
            observability.info('merchant_product_image_loaded', {
              merchantId: merchantId ?? null,
              branchId: branch?.branchId ?? null,
              productId: product.productId,
              imageHost: imageMeta.host,
              imagePath: imageMeta.path,
            });
          }}
          onError={(event) => {
            observability.warn('merchant_product_image_failed', {
              merchantId: merchantId ?? null,
              branchId: branch?.branchId ?? null,
              productId: product.productId,
              imageHost: imageMeta.host,
              imagePath: imageMeta.path,
              reason: event.nativeEvent.error ?? 'unknown_image_error',
            });
          }}
        />
      ) : (
        <View style={styles.productIcon}>
          <Ionicons name="cube-outline" size={20} color={colors.gray600} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        {(product.categoryName || product.productCode != null) ? (
          <View style={styles.productTags}>
            {product.categoryName ? (
              <Text style={styles.productCategory}>{product.categoryName}</Text>
            ) : null}
            {product.productCode != null ? (
              <Text style={styles.productCodeBadge}>#{product.productCode}</Text>
            ) : null}
          </View>
        ) : null}
        {product.description ? <Text style={styles.productDesc}>{product.description}</Text> : null}
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>€{product.unitPrice.toFixed(2)}</Text>
        </View>
      </View>
      <View style={styles.quantityBox}>
        <TouchableOpacity style={styles.quantityButton} onPress={onDecrement}>
          <Ionicons name="remove" size={18} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.quantityValue}>{quantity}</Text>
        <TouchableOpacity style={styles.quantityButton} onPress={onIncrement}>
          <Ionicons name="add" size={18} color={colors.onSurface} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function summarizeImageUri(uri?: string): { host: string | null; path: string | null } {
  if (!uri) return { host: null, path: null };
  try {
    const parsed = new URL(uri);
    return {
      host: parsed.host,
      path: parsed.pathname.slice(0, 160),
    };
  } catch {
    return {
      host: null,
      path: uri.slice(0, 160),
    };
  }
}

export default function MerchantScreen() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Merchant'>>();
  const insets = useSafeAreaInsets();
  const merchantName = route.params?.merchantName ?? 'Merchant';
  const merchantId = route.params?.merchantId;
  const initialMerchantLogoUrl = route.params?.merchantLogoUrl;
  const merchantDistance = route.params?.distanceMeters;
  const { loading, errorKey, branch, merchantLogoUrl, products, retry } = useMerchantCatalog({ merchantId, merchantName });
  const { itemCount, subtotal, quantityByProductId, setMerchantContext, setProductQuantity, buildCheckoutContext } = useBasket();
  const [basketError, setBasketError] = useState<string | null>(null);
  const visibleBranchName = branch?.name ?? merchantName;
  const visibleLogoUrl = branch?.imageUrl ?? merchantLogoUrl ?? initialMerchantLogoUrl;

  // Group products: categorized first (sorted alphabetically), uncategorized at the end
  const categoryGroups: { name: string; items: typeof products }[] = [];
  const uncategorizedProducts: typeof products = [];
  {
    const grouped: Record<string, typeof products> = {};
    for (const p of products) {
      if (p.categoryName) {
        (grouped[p.categoryName] ??= []).push(p);
      } else {
        uncategorizedProducts.push(p);
      }
    }
    for (const name of Object.keys(grouped).sort((a, b) => a.localeCompare(b))) {
      categoryGroups.push({ name, items: grouped[name] });
    }
  }

  useEffect(() => {
    if (merchantId && branch) {
      setMerchantContext({
        merchantId,
        merchantName,
        branchId: branch.branchId,
        branchName: branch.name,
      });
    }
  }, [branch, merchantId, merchantName, setMerchantContext]);

  const handleCheckout = async () => {
    setBasketError(null);
    try {
      const checkoutContext = await buildCheckoutContext();
      navigation.navigate('Checkout', {
        amount: checkoutContext.amount,
        merchantName: checkoutContext.merchantName,
        merchantId: checkoutContext.merchantId,
        branchId: checkoutContext.branchId,
        branchName: checkoutContext.branchName,
        merchantLogoUrl: visibleLogoUrl,
        activePaymentChannels: branch?.activePaymentChannels ?? [],
        basketSummary: checkoutContext.itemSummary,
        basketItemCount: checkoutContext.itemCount,
        basketItems: checkoutContext.basketItems,
      });
    } catch (err) {
      setBasketError(err instanceof Error ? err.message : 'basket_empty');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{visibleBranchName}</Text>
        <TouchableOpacity style={styles.shareBtn} hitSlop={12}>
          <Ionicons name="share-outline" size={22} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          {visibleLogoUrl ? (
            <Image source={{ uri: visibleLogoUrl }} style={styles.bannerLogo} resizeMode="contain" />
          ) : (
            <View style={styles.bannerIcon}>
              <Ionicons name="storefront" size={40} color={colors.secondary} />
            </View>
          )}
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerName}>{visibleBranchName}</Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.verifiedText}>{t('blitz_verified')}</Text>
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="navigate-outline" size={13} color={colors.gray600} />
              <Text style={styles.ratingText}>
                {merchantName}
                {merchantDistance != null
                  ? ` · ${merchantDistance < 1000 ? `${Math.round(merchantDistance)} m` : `${(merchantDistance / 1000).toFixed(1)} km`}`
                  : ''}
              </Text>
            </View>
            {branch?.addressSummary ? <Text style={styles.branchAddress}>{branch.addressSummary}</Text> : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateTitle}>{t('merchant_catalog_loading')}</Text>
          </View>
        ) : errorKey ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.secondary} />
            <Text style={styles.stateTitle}>{t(errorKey as Parameters<typeof t>[0])}</Text>
            <TouchableOpacity style={styles.retryAction} onPress={retry}>
              <Text style={styles.retryActionText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="cube-outline" size={24} color={colors.secondary} />
            <Text style={styles.stateTitle}>{t('merchant_products_empty_title')}</Text>
            <Text style={styles.stateBody}>{t('merchant_products_empty_body')}</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('more_from_merchant')}</Text>

            {categoryGroups.map(({ name, items }) => (
              <View key={name}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryHeaderText}>{name}</Text>
                </View>
                {items.map((product) => (
                  <ProductRow
                    key={product.productId}
                    product={product}
                    quantity={quantityByProductId[product.productId] ?? 0}
                    token={token}
                    merchantId={merchantId}
                    merchantName={merchantName}
                    branch={branch}
                    onPress={() => {
                      if (!merchantId || !branch) return;
                      navigation.navigate('ProductDetail', {
                        productId: product.productId,
                        name: product.name,
                        description: product.description,
                        unitPrice: product.unitPrice,
                        imageUrl: product.imageUrl,
                        merchantId,
                        merchantName,
                        branchId: branch.branchId,
                        branchName: branch.name,
                        merchantLogoUrl: visibleLogoUrl,
                        categoryName: product.categoryName,
                        productCode: product.productCode,
                      });
                    }}
                    onDecrement={() => {
                      if (!merchantId || !branch) return;
                      setProductQuantity(
                        { merchantId, merchantName, branchId: branch.branchId, branchName: branch.name },
                        product,
                        Math.max(0, (quantityByProductId[product.productId] ?? 0) - 1),
                      );
                    }}
                    onIncrement={() => {
                      if (!merchantId || !branch) return;
                      setProductQuantity(
                        { merchantId, merchantName, branchId: branch.branchId, branchName: branch.name },
                        product,
                        (quantityByProductId[product.productId] ?? 0) + 1,
                      );
                    }}
                  />
                ))}
              </View>
            ))}

            {uncategorizedProducts.map((product) => (
              <ProductRow
                key={product.productId}
                product={product}
                quantity={quantityByProductId[product.productId] ?? 0}
                token={token}
                merchantId={merchantId}
                merchantName={merchantName}
                branch={branch}
                onPress={() => {
                  if (!merchantId || !branch) return;
                  navigation.navigate('ProductDetail', {
                    productId: product.productId,
                    name: product.name,
                    description: product.description,
                    unitPrice: product.unitPrice,
                    imageUrl: product.imageUrl,
                    merchantId,
                    merchantName,
                    branchId: branch.branchId,
                    branchName: branch.name,
                    merchantLogoUrl: visibleLogoUrl,
                    categoryName: product.categoryName,
                    productCode: product.productCode,
                  });
                }}
                onDecrement={() => {
                  if (!merchantId || !branch) return;
                  setProductQuantity(
                    { merchantId, merchantName, branchId: branch.branchId, branchName: branch.name },
                    product,
                    Math.max(0, (quantityByProductId[product.productId] ?? 0) - 1),
                  );
                }}
                onIncrement={() => {
                  if (!merchantId || !branch) return;
                  setProductQuantity(
                    { merchantId, merchantName, branchId: branch.branchId, branchName: branch.name },
                    product,
                    (quantityByProductId[product.productId] ?? 0) + 1,
                  );
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.basketCard}>
            <Text style={styles.sectionTitle}>{t('basket_total')}</Text>
            <Text style={styles.basketMeta}>{t('selected_items_count', { count: itemCount })}</Text>
            <Text style={styles.basketTotal}>€{subtotal.toFixed(2)}</Text>
            {basketError ? <Text style={styles.basketError}>{t(basketError as Parameters<typeof t>[0])}</Text> : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.payNowLargeBtn}
          onPress={handleCheckout}
          activeOpacity={0.85}
        >
          <Ionicons name="flash" size={18} color={colors.black} />
          <Text style={styles.payNowLargeBtnText}>{t('proceed_to_checkout')}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  backBtn: {},
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  shareBtn: {},
  banner: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  bannerIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: `${colors.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  bannerLogo: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  bannerInfo: { flex: 1, justifyContent: 'center' },
  bannerName: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  verifiedText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, color: colors.gray600 },
  branchAddress: { fontSize: 12, color: colors.gray600, marginTop: 4 },
  section: { padding: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: spacing.sm,
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  categoryHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    marginBottom: spacing.xs,
  },
  categoryHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  productTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  productCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  productCodeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray600,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  productDesc: { fontSize: 12, color: colors.gray600, marginTop: 1 },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  productPrice: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  basketCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.sm,
  },
  basketMeta: {
    fontSize: 13,
    color: colors.gray600,
  },
  basketTotal: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    marginTop: spacing.xs,
  },
  basketError: {
    marginTop: spacing.sm,
    color: colors.error,
    fontSize: 13,
  },
  stateCard: {
    margin: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 13,
    color: colors.gray600,
    textAlign: 'center',
  },
  retryAction: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryActionText: {
    color: colors.black,
    fontWeight: '700',
  },
  bottomBar: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  payNowLargeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  payNowLargeBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
});
