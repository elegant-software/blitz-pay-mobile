import { clearBasket, getBasketSnapshot, localizeBasketProducts, setBasketProductQuantity } from '../store/basketStore';
import type { ActiveProduct } from '../../merchant-catalog/types/catalog';

const context = { merchantId: 'merchant', branchId: 'branch', merchantName: 'Merchant' };
const product: ActiveProduct = {
  merchantId: 'merchant', branchId: 'branch', productId: 'meal', name: 'Original',
  description: 'Original description', unitPrice: 12.5, active: true,
};
beforeEach(() => clearBasket());

test('translation updates only text and preserves basket identity, quantities, prices and totals', () => {
  setBasketProductQuantity(context, product, 3);
  const before = getBasketSnapshot();
  localizeBasketProducts('merchant', 'branch', [{ ...product, name: 'Translated', description: undefined, unitPrice: 99 }]);
  const after = getBasketSnapshot();
  expect(after.items[0]).toEqual({ ...before.items[0], productName: 'Translated', description: undefined });
  expect(after.merchantId).toBe(before.merchantId);
  expect(after.branchId).toBe(before.branchId);
  expect(after.currency).toBe(before.currency);
  expect(after.items[0].lineTotal).toBe(37.5);
});

test('catalog results from another branch cannot change the basket', () => {
  setBasketProductQuantity(context, product, 2);
  const before = getBasketSnapshot();
  localizeBasketProducts('merchant', 'other', [{ ...product, name: 'Wrong branch' }]);
  expect(getBasketSnapshot()).toBe(before);
});

test('untranslated or unavailable products remain in the basket', () => {
  setBasketProductQuantity(context, product, 2);
  const before = getBasketSnapshot();
  localizeBasketProducts('merchant', 'branch', []);
  expect(getBasketSnapshot()).toBe(before);
});

