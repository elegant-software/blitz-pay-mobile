import {
  clampFraction,
  dragFraction,
  exceedsBranchCapacity,
  fractionToPoint,
  hasUnpaidOrders,
  paymentStatusLabel,
  parseBulkTableNames,
  parseSeatsInput,
  pinCaption,
  pointToFraction,
  seatedCapacity,
  seatedFor,
  tableChairs,
  tablePinTone,
} from '../tableLogic';
import { classifyNfcError, ndefUriMessageSize, NfcWriteError } from '../nfcTag';

describe('placement maths', () => {
  it('clamps fractions into 0..1', () => {
    expect(clampFraction(-0.2)).toBe(0);
    expect(clampFraction(1.4)).toBe(1);
    expect(clampFraction(Number.NaN)).toBe(0);
    expect(clampFraction(0.25)).toBe(0.25);
  });

  it('round-trips a point through fractions independent of screen size', () => {
    const fraction = pointToFraction(150, 50, 300, 200);
    expect(fraction).toEqual({ x: 0.5, y: 0.25 });
    expect(fractionToPoint(fraction.x, fraction.y, 600, 400)).toEqual({ left: 300, top: 100 });
  });

  it('moves a pin by a drag delta and keeps it on the picture', () => {
    expect(dragFraction({ x: 0.5, y: 0.5 }, 30, -20, 300, 200)).toEqual({ x: 0.6, y: 0.4 });
    expect(dragFraction({ x: 0.9, y: 0.1 }, 100, -100, 300, 200)).toEqual({ x: 1, y: 0 });
    expect(dragFraction({ x: 0.3, y: 0.3 }, 10, 10, 0, 0)).toEqual({ x: 0.3, y: 0.3 });
  });
});

describe('table status', () => {
  const order = (paymentStatus: string) => ({
    orderId: 'o',
    pickupNumber: 1,
    totalAmountMinor: 100,
    currency: 'EUR',
    paymentStatus,
    preparationStatus: null,
    createdAt: '',
  });

  it('colours pins by status and payment', () => {
    expect(tablePinTone({ status: 'FREE', orders: [] })).toBe('free');
    expect(tablePinTone({ status: 'OCCUPIED', orders: [order('PAID'), order('CREATED')] })).toBe('unpaid');
    expect(tablePinTone({ status: 'OCCUPIED', orders: [order('PAID'), order('CANCELLED')] })).toBe('paid');
  });

  it('detects unpaid orders and labels payment status', () => {
    expect(hasUnpaidOrders({ orders: [order('PAID')] })).toBe(false);
    expect(hasUnpaidOrders({ orders: [order('FAILED')] })).toBe(true);
    expect(paymentStatusLabel('PAYMENT_INITIATED')).toBe('table_payment_in_progress');
    expect(paymentStatusLabel('CREATED')).toBe('table_payment_unpaid');
  });
});

describe('bulk table names', () => {
  it('expands ranges and splits lists', () => {
    expect(parseBulkTableNames('1-3, Bar\nTerrace 1-2')).toEqual(['1', '2', '3', 'Bar', 'Terrace 1', 'Terrace 2']);
  });

  it('drops blanks and duplicates', () => {
    expect(parseBulkTableNames(' , 5,5,\n')).toEqual(['5']);
  });
});

describe('seats and capacity', () => {
  it('parses the seats field', () => {
    expect(parseSeatsInput('')).toEqual({ valid: true, seats: null });
    expect(parseSeatsInput('4')).toEqual({ valid: true, seats: 4 });
    expect(parseSeatsInput('0').valid).toBe(false);
    expect(parseSeatsInput('51').valid).toBe(false);
    expect(parseSeatsInput('2.5').valid).toBe(false);
  });

  it('always shows seats on the pin caption', () => {
    expect(pinCaption('5', 4)).toBe('5 · 4');
    expect(pinCaption('5', null)).toBe('5 · ?');
  });

  it('warns only when seats on active tables exceed branch capacity', () => {
    const seated = seatedCapacity([
      { active: true, seats: 4 },
      { active: true, seats: null },
      { active: false, seats: 10 },
      { active: true, seats: 6 },
    ]);
    expect(seated).toBe(10);
    expect(exceedsBranchCapacity(seated, 8)).toBe(true);
    expect(exceedsBranchCapacity(seated, 10)).toBe(false);
    expect(exceedsBranchCapacity(seated, null)).toBe(false);
  });
});

describe('nfc tag', () => {
  it('sizes a Table Link record so it fits NTAG213', () => {
    // 4 header bytes + 1 prefix byte + "storefront.example.com/t/ABC234"
    expect(ndefUriMessageSize('https://storefront.example.com/t/ABC234')).toBe(4 + 1 + 31);
    expect(ndefUriMessageSize('https://storefront.example.com/t/ABC234')).toBeLessThan(137);
  });

  it('maps native error messages to user-facing reasons', () => {
    expect(classifyNfcError(new Error('Tag is read only'))).toBe('nfc_error_locked_tag');
    expect(classifyNfcError(new Error('user cancelled'))).toBe('nfc_error_cancelled');
    expect(classifyNfcError(new Error('exceeds capacity'))).toBe('nfc_error_tag_too_small');
    expect(classifyNfcError(new NfcWriteError('nfc_error_unsupported_tag', 'x'))).toBe('nfc_error_unsupported_tag');
    expect(classifyNfcError(new Error('io'))).toBe('nfc_error_write_failed');
  });
});

describe('drawn live floor', () => {
  it('puts one chair per seat round the table, seated guests first', () => {
    const chairs = tableChairs(4, 3);
    expect(chairs.map((chair) => [chair.cx, chair.cy])).toEqual([[30, 6], [54, 30], [30, 54], [6, 30]]);
    expect(chairs.map((chair) => chair.seated)).toEqual([true, true, true, false]);
    expect(tableChairs(null, 2)).toEqual([]);
    expect(tableChairs(40, 0)).toHaveLength(12);
  });

  it('says how long guests have been seated', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(seatedFor('2026-11-08T11:52:00Z', now)).toBe('8 min');
    expect(seatedFor('2026-11-08T10:50:00Z', now)).toBe('1 h 10');
    expect(seatedFor(null, now)).toBe('');
  });
});
