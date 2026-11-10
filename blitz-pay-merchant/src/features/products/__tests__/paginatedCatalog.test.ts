import { authedFetch } from '../../../lib/api';
import { fetchCatalogProductPage, fetchBranchCatalogCategories, fetchProductDetail } from '../../../lib/merchantProducts';

jest.mock('../../../lib/api', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const product = { productId: 'meal', branchId: 'branch', categoryId: 'food', name: 'Meal', unitPrice: 10, active: false, imageUrl: 'detail.jpg', thumbnailUrl: 'thumb.jpg' };
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, hasMore: nextCursor !== null, limit: 24 });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

beforeEach(() => { jest.clearAllMocks(); });

it('requests management visibility and preserves ordering, inactive products, and both image sizes', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(page([product, { ...product, productId: 'second', name: 'Alphabetically earlier' }], 'next')));
  const result = await fetchCatalogProductPage('merchant', 'branch', { categoryId: 'food' });
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/catalog/products?branchId=branch&includeInactive=true&limit=24&categoryId=food', { method: 'GET' });
  expect(result.items.map(item => item.id)).toEqual(['meal', 'second']);
  expect(result.items[0]).toMatchObject({ active: false, imageUrl: 'detail.jpg', thumbnailUrl: 'thumb.jpg' });
});

it('encodes opaque cursors and filters uncategorized products while excluding other branches', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(page([{ ...product, categoryId: null, thumbnailUrl: null }, { ...product, branchId: 'other' }])));
  const result = await fetchCatalogProductPage('merchant', 'branch', { uncategorized: true, cursor: 'next+/=' });
  const url = new URL(jest.mocked(authedFetch).mock.calls[0][0], 'https://api.invalid');
  expect(url.searchParams.get('cursor')).toBe('next+/=');
  expect(url.searchParams.get('uncategorized')).toBe('true');
  expect(url.searchParams.has('categoryId')).toBe(false);
  expect(result.items).toHaveLength(1);
  expect(result.items[0].thumbnailUrl).toBeUndefined();
  expect(result.items[0].imageUrl).toBe('detail.jpg');
});

it.each([
  { items: [], hasMore: true, nextCursor: null, limit: 24 },
  { items: [], hasMore: false, nextCursor: 'unexpected', limit: 24 },
  { items: [], hasMore: true, nextCursor: 'same', limit: 24 },
  [],
])('rejects malformed pages and repeated cursors', async response => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json(response));
  await expect(fetchCatalogProductPage('merchant', 'branch', { cursor: 'same' })).rejects.toMatchObject({ key: 'merchant_products_load_failed' });
});

it('loads branch-specific management counts', async () => {
  const categories = { categories: [{ id: 'food', name: 'Food', productCount: 3 }], uncategorizedCount: 2, totalCount: 5 };
  jest.mocked(authedFetch).mockResolvedValueOnce(json(categories));
  await expect(fetchBranchCatalogCategories('merchant', 'branch')).resolves.toEqual(categories);
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/catalog/categories?branchId=branch&includeInactive=true', { method: 'GET' });
});

it('preserves backend permission/cursor reasons and stable codes', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json({ detail: 'Branch access denied.', code: 'CATALOG_ACCESS_DENIED' }, 403));
  await expect(fetchCatalogProductPage('merchant', 'branch')).rejects.toMatchObject({ detail: 'Branch access denied.', code: 'CATALOG_ACCESS_DENIED', status: 403 });
});

it('rejects product-detail responses outside the requested scope', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json({ ...product, branchId: 'other' }));
  await expect(fetchProductDetail('merchant', 'branch', 'meal')).rejects.toMatchObject({ key: 'merchant_product_load_failed' });
});
