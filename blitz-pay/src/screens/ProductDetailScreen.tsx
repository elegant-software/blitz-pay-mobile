import { useLocalizedProduct } from '../features/merchant-catalog/hooks/useLocalizedProduct';
import React from 'react';
import { ProductImage } from '../features/merchant-catalog/components/ProductImage';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { useBasket } from '../features/basket/hooks/useBasket';
import { resolveImageUri } from '../lib/imageUri';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';

export default function ProductDetailScreen() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const insets = useSafeAreaInsets();

  const {
    productId,
    name: initialName,
    description: initialDescription,
    unitPrice,
    imageUrl,
    merchantId,
    merchantName,
    branchId,
    branchName,
    categoryName: initialCategoryName,
    productCode,
  } = route.params;

  const localized = useLocalizedProduct(merchantId, branchId, productId);
  const name = localized.product?.name ?? initialName;
  const description = localized.product ? localized.product.description : initialDescription;
  const categoryName = localized.product ? localized.product.categoryName : initialCategoryName;
  const product = { productId, merchantId, name, description, unitPrice, imageUrl, branchId, active: true };
  const { quantityByProductId, setProductQuantity } = useBasket();
  const quantity = quantityByProductId[productId] ?? 0;

  const productImage = resolveImageUri(imageUrl);

  const handleChange = (delta: number) => {
    setProductQuantity(
      { merchantId, merchantName, branchId, branchName },
      product,
      Math.max(0, quantity + delta),
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {productImage ? (
          <ProductImage
            merchantId={merchantId}
            branchId={branchId}
            productId={productId}
            source={{
              uri: productImage.uri,
              headers: productImage.needsAuth && token ? { Authorization: `Bearer ${token}` } : undefined,
            }}
            style={styles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="cube-outline" size={64} color={colors.gray400} />
          </View>
        )}

        <View style={styles.body}>
          {localized.error ? (
            <View accessibilityRole="alert">
              <Text>{localized.errorDetail ?? t('merchant_catalog_load_failed')}</Text>
              <TouchableOpacity onPress={() => { void localized.retry(); }}>
                <Text>{t('language_content_retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.productName}>{name}</Text>
          <Text style={styles.productPrice}>€{unitPrice.toFixed(2)}</Text>

          {(categoryName || productCode != null) ? (
            <View style={styles.metaRow}>
              {categoryName ? (
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeLabel}>{t('product_category')}</Text>
                  <Text style={styles.metaBadgeValue}>{categoryName}</Text>
                </View>
              ) : null}
              {productCode != null ? (
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeLabel}>{t('product_code')}</Text>
                  <Text style={styles.metaBadgeValue}>#{productCode}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>{t('product_description')}</Text>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.quantityRow}>
          <TouchableOpacity style={styles.quantityBtn} onPress={() => handleChange(-1)}>
            <Ionicons name="remove" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.quantityValue}>{quantity}</Text>
          <TouchableOpacity style={styles.quantityBtn} onPress={() => handleChange(1)}>
            <Ionicons name="add" size={22} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            if (quantity === 0) handleChange(1);
            navigation.goBack();
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="basket-outline" size={18} color={colors.black} />
          <Text style={styles.addBtnText}>
            {quantity === 0 ? t('add_to_basket') : t('update_basket')}
          </Text>
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
  heroImage: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surface,
  },
  heroPlaceholder: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  productName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
  },
  productPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadow.sm,
  },
  metaBadgeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaBadgeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  descriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.sm,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 15,
    color: colors.onSurface,
    lineHeight: 22,
  },
  bottomBar: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quantityBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
  },
});
