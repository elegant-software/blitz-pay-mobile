import { isSoftDecline } from '../terminalErrors';

describe('isSoftDecline', () => {
  it('treats PIN-required decline codes as soft declines', () => {
    expect(isSoftDecline({ apiError: { declineCode: 'online_or_offline_pin_required' } })).toBe(true);
    expect(isSoftDecline({ apiError: { declineCode: 'offline_pin_required' } })).toBe(true);
  });

  it('treats other declines and errors without a decline code as final', () => {
    expect(isSoftDecline({ apiError: { declineCode: 'insufficient_funds' } })).toBe(false);
    expect(isSoftDecline({ apiError: { declineCode: '' } })).toBe(false);
    expect(isSoftDecline({})).toBe(false);
    expect(isSoftDecline(undefined)).toBe(false);
  });
});
