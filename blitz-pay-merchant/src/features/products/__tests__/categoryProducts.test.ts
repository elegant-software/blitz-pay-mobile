import { authedFetch } from '../../../lib/api';
import { fetchBranchProducts, fetchProductCategories } from '../../../lib/merchantProducts';

jest.mock('../../../lib/api', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

it('filters by category and branch while keeping inactive products manageable', async () => {
  const product = { productId: 'meal', branchId: 'branch', categoryId: 'food', name: 'Meal', unitPrice: 10, active: false };
  jest.mocked(authedFetch).mockResolvedValueOnce(json([
    product, { ...product, branchId: 'other' }, { ...product, categoryId: 'drinks' },
  ]));
  await expect(fetchBranchProducts('merchant', 'branch', 'food')).resolves.toMatchObject([{ id: 'meal', active: false }]);
  expect(authedFetch).toHaveBeenLastCalledWith('/v1/merchants/merchant/products?branchId=branch&categoryId=food', { method: 'GET' });
});

it('loads category metadata separately from products', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json([{ id: 'food', name: 'Food' }]));
  await expect(fetchProductCategories('merchant')).resolves.toEqual([{ id: 'food', name: 'Food' }]);
});

it('preserves ProblemDetail text for the retry state', async () => {
  jest.mocked(authedFetch).mockResolvedValueOnce(json({ detail: 'Branch access denied.' }, 403));
  await expect(fetchBranchProducts('merchant', 'branch', 'food')).rejects.toMatchObject({ detail: 'Branch access denied.', status: 403 });
});
