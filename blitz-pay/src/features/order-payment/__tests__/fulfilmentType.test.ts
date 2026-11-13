import { defaultFulfilmentType, readyPickupMessageKey } from '../types/orderPayment';

describe('fulfilment type', () => {
  it('defaults to DINE_IN with a Table and TAKE_AWAY without', () => {
    expect(defaultFulfilmentType(true)).toBe('DINE_IN');
    expect(defaultFulfilmentType(false)).toBe('TAKE_AWAY');
  });

  it('brings only dine-in orders with a Table to the table', () => {
    expect(readyPickupMessageKey('DINE_IN', 'table-1')).toBe('order_ready_to_table');
    expect(readyPickupMessageKey('DINE_IN', null)).toBe('order_ready_at_counter');
    expect(readyPickupMessageKey('TAKE_AWAY', 'table-1')).toBe('order_ready_at_counter');
    expect(readyPickupMessageKey(null, 'table-1')).toBe('order_ready_at_counter');
  });
});
