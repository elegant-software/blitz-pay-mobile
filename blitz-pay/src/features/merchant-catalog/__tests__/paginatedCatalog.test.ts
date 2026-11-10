import { authedFetch } from '../../../lib/api/authedFetch';
import { fetchCatalogProductPage, fetchBranchCatalogCategories, fetchCatalogProductDetail } from '../services/merchantCatalogService';

jest.mock('../../../lib/api/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const product = { productId: 'meal', branchId: 'branch', categoryId: 'food', name: 'Meal', unitPrice: 10, active: true, imageUrl: 'detail.jpg', thumbnailUrl: 'thumb.jpg' };
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, hasMore: nextCursor !== null, limit: 24 });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => { jest.clearAllMocks(); });

it('requests a scoped page and keeps backend ordering and separate thumbnail/detail images', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(page([product, { ...product, productId: 'second', name: 'Alphabetically earlier' }], 'next+/=')));
  const result = await fetchCatalogProductPage('merchant', 'branch', { categoryId: 'food' });
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/catalog/products?branchId=branch&limit=24&categoryId=food', { headers: { 'Accept-Language': 'de' } });
  expect(result.items.map(item => item.productId)).toEqual(['meal', 'second']);
  expect(result.items[0]).toMatchObject({ imageUrl: 'detail.jpg', thumbnailUrl: 'thumb.jpg' });
  expect(result.nextCursor).toBe('next+/=');
});

it('encodes opaque cursors and requests uncategorized products without inventing a category ID', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(page([{ ...product, categoryId: null, thumbnailUrl: null }])));
  const result = await fetchCatalogProductPage('merchant', 'branch', { uncategorized: true, cursor: 'next+/=' });
  const path = jest.mocked(authedFetch).mock.calls[0][0];
  const url = new URL(path, 'https://api.invalid');
  expect(url.searchParams.get('cursor')).toBe('next+/=');
  expect(url.searchParams.get('uncategorized')).toBe('true');
  expect(url.searchParams.has('categoryId')).toBe(false);
  expect(url.searchParams.has('includeInactive')).toBe(false);
  expect(result.items[0].thumbnailUrl).toBeUndefined();
  expect(result.items[0].imageUrl).toBe('detail.jpg');
  expect(result.hasMore).toBe(false);
});

it('excludes inactive products and products outside the requested branch/category', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(page([product, { ...product, active: false }, { ...product, branchId: 'other' }, { ...product, categoryId: 'drinks' }])));
  expect((await fetchCatalogProductPage('merchant', 'branch', { categoryId: 'food' })).items).toHaveLength(1);
});

it.each([
  { items: [], hasMore: true, nextCursor: null, limit: 24 },
  { items: [], hasMore: false, nextCursor: 'unexpected', limit: 24 },
  { items: [], hasMore: true, nextCursor: 'same', limit: 24 },
  [],
])('rejects malformed pages and cursors that would cause endless pagination', async response => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(response));
  await expect(fetchCatalogProductPage('merchant', 'branch', { cursor: 'same' })).rejects.toMatchObject({ i18nKey: 'merchant_catalog_load_failed' });
});

it('loads only branch categories and preserves counts', async () => {
  const categories = { categories: [{ id: 'food', name: 'Food', productCount: 3 }], uncategorizedCount: 2, totalCount: 5 };
  jest.mocked(authedFetch).mockResolvedValueOnce(json(categories));
  await expect(fetchBranchCatalogCategories('merchant', 'branch')).resolves.toEqual(categories);
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/catalog/categories?branchId=branch', { headers: { 'Accept-Language': 'de' } });
});

it('preserves backend details and cursor error codes for recovery', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json({ detail: 'Start this catalog again.', code: 'INVALID_CATALOG_CURSOR' }, 400));
  await expect(fetchCatalogProductPage('merchant', 'branch', { cursor: 'expired' })).rejects.toMatchObject({ detail: 'Start this catalog again.', code: 'INVALID_CATALOG_CURSOR', status: 400 });
});

it('refreshes one product image without fetching the whole catalog', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(product));
  await expect(fetchCatalogProductDetail('merchant', 'branch', 'meal')).resolves.toMatchObject({ imageUrl: 'detail.jpg', thumbnailUrl: 'thumb.jpg' });
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/products/meal?branchId=branch', { headers: { 'Accept-Language': 'de' } });
});
