import { useLanguage } from '../../../lib/LanguageContext';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  clearBasket,
  getBasketSnapshot,
  markBasketValidated,
  setBasketMerchantContext,
  setBasketProductQuantity,
  subscribeBasket,
} from '../store/basketStore';
import type { CheckoutContext } from '../types/basket';
import type { ActiveProduct } from '../../merchant-catalog/types/catalog';
import { revalidateBasketItems } from '../../merchant-catalog/services/merchantCatalogService';

export function useBasket() {
  const { language } = useLanguage();
  const basket = useSyncExternalStore(subscribeBasket, getBasketSnapshot, getBasketSnapshot);

  const itemCount = useMemo(
    () => basket.items.reduce((sum, item) => sum + item.quantity, 0),
    [basket.items],
  );
  const subtotal = useMemo(
    () => basket.items.reduce((sum, item) => sum + item.lineTotal, 0),
    [basket.items],
  );

  const quantityByProductId = useMemo(() => {
    const quantities: Record<string, number> = {};
    for (const item of basket.items) {
      quantities[item.productId] = item.quantity;
    }
    return quantities;
  }, [basket.items]);

  const setMerchantContext = useCallback(
    (context: { merchantId: string; merchantName: string; branchId: string; branchName?: string }) => {
      setBasketMerchantContext(context);
    },
    [],
  );

  const setProductQuantity = useCallback(
    (context: { merchantId: string; merchantName: string; branchId: string; branchName?: string }, product: ActiveProduct, quantity: number) => {
      setBasketProductQuantity(context, product, quantity);
    },
    [],
  );

  const buildCheckoutContext = useCallback(async (): Promise<CheckoutContext> => {
    if (!basket.merchantId || !basket.merchantName || !basket.branchId || basket.items.length === 0) {
      throw new Error('basket_empty');
    }

    const validation = await revalidateBasketItems(basket.merchantId, basket.branchId, basket.items, language);
    if (!validation.valid) {
      throw new Error('basket_refresh_required');
    }

    const now = new Date().toISOString();
    markBasketValidated(now);

    return {
      merchantId: basket.merchantId,
      merchantName: basket.merchantName,
      branchId: basket.branchId,
      branchName: basket.branchName,
      amount: subtotal,
      currency: basket.currency,
      itemCount,
      itemSummary: basket.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '),
      basketItems: basket.items.map((item) => ({
        productId: item.productId,
        merchantId: item.merchantId,
        branchId: item.branchId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        imageUrl: item.imageUrl,
      })),
    };
  }, [basket, itemCount, subtotal, language]);

  return {
    basket,
    itemCount,
    subtotal,
    quantityByProductId,
    setMerchantContext,
    setProductQuantity,
    clearBasket,
    buildCheckoutContext,
  };
}
