import { authedFetch } from '../../../lib/api/authedFetch';
import { fetchActiveProducts, fetchProductCategories } from '../services/merchantCatalogService';

jest.mock('../../../lib/api/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

it('requests only a category within the selected branch and excludes inactive or mismatched products', async () => {
  const product = { productId: 'meal', branchId: 'branch', categoryId: 'food', name: 'Meal', unitPrice: 10, active: true };
  jest.mocked(authedFetch).mockResolvedValueOnce(json([
    product, { ...product, branchId: 'other' }, { ...product, categoryId: 'drinks' }, { ...product, active: false },
  ]));
  const products = await fetchActiveProducts('merchant', 'branch', 'food');
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/products?branchId=branch&categoryId=food', { headers: { 'Accept-Language': 'de' } });
  expect(products).toHaveLength(1);
  expect(products[0].productId).toBe('meal');
});

it('loads categories without downloading product records', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json([{ id: 'food', name: 'Food' }]));
  await expect(fetchProductCategories('merchant')).resolves.toEqual([{ id: 'food', name: 'Food' }]);
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/product-categories', { headers: { 'Accept-Language': 'de' } });
});

it('preserves actionable backend details when category access fails', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json({ detail: 'Catalog access denied.', code: 'FORBIDDEN' }, 403));
  await expect(fetchProductCategories('merchant')).rejects.toMatchObject({ detail: 'Catalog access denied.', status: 403, code: 'FORBIDDEN' });
});

it('requests English content while retaining products served in their original German language', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json([
    { productId: 'meal', branchId: 'branch', name: 'Kartoffelsuppe', description: 'Hausgemacht',
      language: 'de', unitPrice: 8.5, active: true },
  ]));
  const products = await fetchActiveProducts('merchant', 'branch', undefined, 'en');
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/products?branchId=branch',
    { headers: { 'Accept-Language': 'en' } });
  expect(products).toHaveLength(1);
  expect(products[0]).toMatchObject({ name: 'Kartoffelsuppe', description: 'Hausgemacht', unitPrice: 8.5 });
});
