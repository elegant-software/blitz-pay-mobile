import { useLanguage } from '../../../lib/LanguageContext';
import type { InfiniteData, InfiniteQueryObserverOptions } from '@tanstack/react-query';
import { InfiniteQueryObserver, QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCatalogBrowser } from '../hooks/useCatalogBrowser';
import { fetchCatalogProductPage, MerchantCatalogError } from '../services/merchantCatalogService';
import type { CatalogProductPage } from '../types/catalog';

jest.mock('../../../lib/LanguageContext', () => ({ useLanguage: jest.fn(() => ({ language: 'de' })) }));
jest.mock('react', () => ({ ...jest.requireActual('react'), useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: jest.fn(), useInfiniteQuery: jest.fn() }));
jest.mock('../store/catalogBrowserStore', () => ({ useCatalogSelection: () => ({ categoryId: 'food', selectCategory: jest.fn() }) }));
jest.mock('../../../lib/queryClient', () => ({ STALE_TIMES: { PRODUCTS: 300000 } }));
jest.mock('../../../lib/api/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../services/merchantCatalogService', () => ({ ...jest.requireActual('../services/merchantCatalogService'), fetchCatalogProductPage: jest.fn() }));

type PageOptions = InfiniteQueryObserverOptions<CatalogProductPage, Error, InfiniteData<CatalogProductPage>, readonly unknown[], string | undefined>;
let options: PageOptions;
let client: QueryClient;
const makePage = (id: string, nextCursor: string | null): CatalogProductPage => ({
  items: [{ productId: id, merchantId: 'merchant', branchId: 'branch', name: id, unitPrice: 10, active: true }],
  hasMore: nextCursor !== null, nextCursor, limit: 24,
});

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(useQuery).mockReturnValue({
    data: { categories: [{ id: 'food', name: 'Food', productCount: 25 }], uncategorizedCount: 0, totalCount: 25 },
    refetch: jest.fn(),
  } as never);
  jest.mocked(useInfiniteQuery).mockImplementation(value => {
    options = value as unknown as PageOptions;
    return { refetch: jest.fn(), fetchNextPage: jest.fn() } as never;
  });
  useCatalogBrowser('merchant', 'branch');
});

afterEach(() => { client.clear(); });

it('follows backend cursors and keeps the loaded first page after a next-page failure', async () => {
  jest.mocked(fetchCatalogProductPage).mockResolvedValueOnce(makePage('first', 'next'))
    .mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(makePage('second', null));
  const observer = new InfiniteQueryObserver(client, options);
  await observer.refetch();
  await observer.fetchNextPage();
  let pages = observer.getCurrentResult().data?.pages as CatalogProductPage[];
  expect(pages.flatMap(page => page.items)).toHaveLength(1);
  expect(observer.getCurrentResult().isFetchNextPageError).toBe(true);
  await observer.fetchNextPage();
  pages = observer.getCurrentResult().data?.pages as CatalogProductPage[];
  expect(pages).toHaveLength(2);
  expect(observer.getCurrentResult().hasNextPage).toBe(false);
  expect(jest.mocked(fetchCatalogProductPage).mock.calls[1][2]).toMatchObject({ categoryId: 'food', cursor: 'next' });
  observer.destroy();
});

it('uses independent caches when the selected category changes during an in-flight request', async () => {
  let resolveFood!: (value: CatalogProductPage) => void;
  jest.mocked(fetchCatalogProductPage).mockImplementation((_merchant, _branch, filter) => filter?.categoryId === 'drinks'
    ? Promise.resolve(makePage('drink', null))
    : new Promise(resolve => { resolveFood = resolve; }));
  const food = new InfiniteQueryObserver(client, options);
  const pending = food.refetch();
  const drinksOptions = { ...options, queryKey: [...['catalog-pages-v1', 'merchant', 'branch'], 'drinks'],
    queryFn: () => fetchCatalogProductPage('merchant', 'branch', { categoryId: 'drinks' }) };
  const drinks = new InfiniteQueryObserver(client, drinksOptions);
  await drinks.refetch();
  resolveFood(makePage('meal', null));
  await pending;
  expect((drinks.getCurrentResult().data?.pages as CatalogProductPage[])[0].items[0].name).toBe('drink');
  expect((food.getCurrentResult().data?.pages as CatalogProductPage[])[0].items[0].name).toBe('meal');
  food.destroy(); drinks.destroy();
});

it('reuses cached category pages without showing an initial loading state', async () => {
  jest.mocked(fetchCatalogProductPage).mockResolvedValueOnce(makePage('first', null));
  const first = new InfiniteQueryObserver(client, options);
  await first.refetch();
  first.destroy();
  const returning = new InfiniteQueryObserver(client, options);
  expect(returning.getCurrentResult().isPending).toBe(false);
  expect(returning.getCurrentResult().data?.pages).toHaveLength(1);
  expect(fetchCatalogProductPage).toHaveBeenCalledTimes(1);
  returning.destroy();
});

it('offers a full refresh when the backend rejects a cursor', async () => {
  const refetch = jest.fn();
  const fetchNextPage = jest.fn();
  jest.mocked(useInfiniteQuery).mockReturnValue({
    data: { pages: [makePage('first', 'next')], pageParams: [undefined] },
    error: new MerchantCatalogError('merchant_catalog_load_failed', 'Restart catalog', 400, 'INVALID_CATALOG_CURSOR'),
    isFetchNextPageError: true, refetch, fetchNextPage,
  } as never);
  const result = useCatalogBrowser('merchant', 'branch');
  expect(result.errorKey).toBeNull();
  expect(result.pageErrorDetail).toBe('Restart catalog');
  expect(result.products).toHaveLength(1);
  await result.retry();
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it('shows an initial category failure once without duplicating it in the pagination footer', () => {
  jest.mocked(useQuery).mockReturnValue({
    error: new MerchantCatalogError('merchant_catalog_load_failed', 'Catalog unavailable', 404),
    refetch: jest.fn(),
  } as never);
  const result = useCatalogBrowser('merchant', 'branch');
  expect(result.errorKey).toBe('merchant_catalog_load_failed');
  expect(result.errorDetail).toBe('Catalog unavailable');
  expect(result.pageErrorKey).toBeNull();
  expect(result.pageErrorDetail).toBeUndefined();
});

it('separates language caches so a late German response cannot replace English content', async () => {
  let resolveGerman!: (value: CatalogProductPage) => void;
  jest.mocked(fetchCatalogProductPage).mockImplementation((_merchant, _branch, _filter, language) => language === 'en'
    ? Promise.resolve(makePage('English text', null))
    : new Promise(resolve => { resolveGerman = resolve; }));
  const german = new InfiniteQueryObserver(client, options);
  const pending = german.refetch();
  jest.mocked(useLanguage).mockReturnValue({ language: 'en' } as never);
  useCatalogBrowser('merchant', 'branch');
  const english = new InfiniteQueryObserver(client, options);
  await english.refetch();
  resolveGerman(makePage('Deutscher Text', null));
  await pending;
  expect((english.getCurrentResult().data?.pages as CatalogProductPage[])[0].items[0].name).toBe('English text');
  expect(fetchCatalogProductPage).toHaveBeenLastCalledWith('merchant', 'branch', expect.any(Object), 'en');
  german.destroy(); english.destroy();
});
