import { createMerchantOrder, fetchMerchantOrders } from '../services/orderService';
import { getFulfilmentTypeLabelKey, parseFulfilmentType } from '../orderPresentation';
import { translations } from '../../../lib/translations';

jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../../lib/api', () => ({ authedFetch: jest.fn() }));

import { authedFetch } from '../../../lib/api';

const mockFetch = authedFetch as jest.Mock;

const rawOrder = {
  orderId: 'o1',
  merchantId: 'm1',
  branchId: 'b1',
  currency: 'EUR',
  createdAt: '2026-01-01T10:00:00Z',
};

function respond(body: unknown) {
  mockFetch.mockResolvedValue({ ok: true, json: async () => body });
}

function sentBody(): Record<string, unknown> {
  return JSON.parse(mockFetch.mock.calls[0][1].body);
}

beforeEach(() => mockFetch.mockReset());

describe('createMerchantOrder fulfilmentType', () => {
  it('sends the chosen fulfilment type for walk-in orders', async () => {
    respond({ ...rawOrder, fulfilmentType: 'TAKE_AWAY' });
    await createMerchantOrder('m1', 'b1', [], { fulfilmentType: 'TAKE_AWAY' });
    expect(sentBody().fulfilmentType).toBe('TAKE_AWAY');
    respond(rawOrder);
    mockFetch.mockClear();
    await createMerchantOrder('m1', 'b1', [], { fulfilmentType: 'DINE_IN' });
    expect(sentBody().fulfilmentType).toBe('DINE_IN');
  });

  it('never sends it for invoice orders', async () => {
    respond(rawOrder);
    await createMerchantOrder('m1', 'b1', [], { targetShopperId: 's1', fulfilmentType: 'DINE_IN' });
    expect(sentBody()).not.toHaveProperty('fulfilmentType');
  });
});

describe('fulfilment type parsing', () => {
  it('maps the order response and treats unknown/missing as null', async () => {
    respond([{ ...rawOrder, fulfilmentType: 'DINE_IN' }, { ...rawOrder, orderId: 'o2', fulfilmentType: null }, { ...rawOrder, orderId: 'o3' }]);
    const orders = await fetchMerchantOrders('b1');
    const byId = Object.fromEntries(orders.map((o) => [o.orderId, o.fulfilmentType]));
    expect(byId).toEqual({ o1: 'DINE_IN', o2: null, o3: null });
    expect(parseFulfilmentType('BOGUS')).toBeNull();
  });

  it('labels are translated in every locale', () => {
    for (const locale of Object.values(translations)) {
      const t = locale as Record<string, string>;
      expect(t[getFulfilmentTypeLabelKey('TAKE_AWAY')]).toBeTruthy();
      expect(t[getFulfilmentTypeLabelKey('DINE_IN')]).toBeTruthy();
    }
    expect(translations.en.fulfilment_type_take_away).toBe('Take-away');
    expect(translations.en.fulfilment_type_dine_in).toBe('In restaurant');
  });
});
