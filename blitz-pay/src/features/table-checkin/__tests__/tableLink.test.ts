import { hostOf, normalizeTableCode, parseTableLink, toMerchantParams } from '../tableLink';

const STOREFRONT = 'https://shop.example.test';

describe('table codes', () => {
  it('normalises typed codes', () => {
    expect(normalizeTableCode(' abc-234 ')).toBe('ABC234');
    expect(normalizeTableCode('ABC23')).toBeNull();
    // 0, O, 1, I and L are never part of a Table Code
    expect(normalizeTableCode('AB0234')).toBeNull();
    expect(normalizeTableCode('ABL234')).toBeNull();
  });

  it('reads the host of the storefront URL', () => {
    expect(hostOf('https://Shop.Example.test:8443/x')).toBe('shop.example.test:8443');
    expect(hostOf(null)).toBeNull();
  });
});

describe('table links', () => {
  it('accepts storefront links, the app scheme and bare codes', () => {
    expect(parseTableLink('https://shop.example.test/t/ABC234', STOREFRONT, 'blitzpay')).toBe('ABC234');
    expect(parseTableLink('https://SHOP.example.test/t/abc234/?utm=qr', STOREFRONT, 'blitzpay')).toBe('ABC234');
    expect(parseTableLink('blitzpay://t/ABC234', STOREFRONT, 'blitzpay')).toBe('ABC234');
    expect(parseTableLink('abc234', STOREFRONT, 'blitzpay')).toBe('ABC234');
  });

  it('rejects links on other hosts or paths', () => {
    expect(parseTableLink('https://evil.example/t/ABC234', STOREFRONT, 'blitzpay')).toBeNull();
    expect(parseTableLink('https://shop.example.test/m/ABC234', STOREFRONT, 'blitzpay')).toBeNull();
    expect(parseTableLink('https://shop.example.test/t/ABC234', null, 'blitzpay')).toBeNull();
    expect(parseTableLink('blitzpay://order/123', STOREFRONT, 'blitzpay')).toBeNull();
  });
});

describe('check-in target', () => {
  const base = {
    merchantId: 'm',
    merchantName: 'Café',
    branchId: 'b',
    branchName: 'Mitte',
    tableId: 't',
    tableName: '5',
    active: true,
    occupied: false,
  };

  it('opens the branch with the table and guest count', () => {
    expect(toMerchantParams(base, 'ABC234', 3)).toEqual({
      merchantId: 'm',
      merchantName: 'Café',
      branchId: 'b',
      branchName: 'Mitte',
      tableCode: 'ABC234',
      tableName: '5',
      guestCount: 3,
    });
  });

  it('falls back to counter pickup for a deactivated table', () => {
    const params = toMerchantParams({ ...base, active: false, tableId: null, tableName: null }, 'ABC234');
    expect(params).toEqual({ merchantId: 'm', merchantName: 'Café', branchId: 'b', branchName: 'Mitte', counterPickup: true });
  });
});
