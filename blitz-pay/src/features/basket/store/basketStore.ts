import type { ActiveProduct } from '../../merchant-catalog/types/catalog';
import type { BasketItem, BasketState } from '../types/basket';

type MerchantContext = {
  merchantId: string;
  merchantName: string;
  branchId: string;
  branchName?: string;
};

const listeners = new Set<() => void>();

let state: BasketState = {
  currency: 'EUR',
  items: [],
};

function emit() {
  listeners.forEach((listener) => listener());
}

function mergeState(next: Partial<BasketState>) {
  state = { ...state, ...next };
  emit();
}

function normalizeItem(context: MerchantContext, product: ActiveProduct, quantity: number): BasketItem {
  return {
    productId: product.productId,
    productName: product.name,
    branchId: context.branchId,
    merchantId: context.merchantId,
    unitPrice: product.unitPrice,
    quantity,
    lineTotal: product.unitPrice * quantity,
    description: product.description,
    imageUrl: product.imageUrl,
  };
}

export function subscribeBasket(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBasketSnapshot(): BasketState {
  return state;
}

export function setBasketMerchantContext(context: MerchantContext) {
  const shouldReset =
    state.merchantId != null &&
    (state.merchantId !== context.merchantId || state.branchId !== context.branchId);

  state = {
    merchantId: context.merchantId,
    merchantName: context.merchantName,
    branchId: context.branchId,
    branchName: context.branchName,
    currency: state.currency,
    items: shouldReset ? [] : state.items,
    lastValidatedAt: state.lastValidatedAt,
  };
  emit();
}

export function setBasketProductQuantity(
  context: MerchantContext,
  product: ActiveProduct,
  quantity: number,
) {
  setBasketMerchantContext(context);

  const nextItems = state.items.filter((item) => item.productId !== product.productId);
  if (quantity > 0) {
    nextItems.push(normalizeItem(context, product, quantity));
  }

  state = {
    ...state,
    items: nextItems.sort((a, b) => a.productName.localeCompare(b.productName)),
  };
  emit();
}

export function clearBasket() {
  mergeState({ items: [], lastValidatedAt: undefined });
}

export function markBasketValidated(timestamp: string) {
  mergeState({ lastValidatedAt: timestamp });
}

export function localizeBasketProducts(merchantId: string, branchId: string, products: ActiveProduct[]) {
  if (state.merchantId !== merchantId || state.branchId !== branchId) return;
  const byId = new Map(products.map(product => [product.productId, product]));
  let changed = false;
  const items = state.items.map(item => {
    const product = byId.get(item.productId);
    if (!product || (item.productName === product.name && item.description === product.description)) return item;
    changed = true;
    return { ...item, productName: product.name, description: product.description };
  });
  if (changed) mergeState({ items });
}
