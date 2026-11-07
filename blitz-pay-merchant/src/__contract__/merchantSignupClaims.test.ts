import { merchantIdFromGroups, isMerchantGroup } from '../features/auth/services/merchantSignupClaims';
describe('merchant signup group scope', () => {
  const id = '20500000-0000-0000-0000-000000000001';
  it('recognizes an owner membership before the first branch exists', () => {
    expect(isMerchantGroup('/merchants/merchant_'+id)).toBe(true);
    expect(merchantIdFromGroups(['/merchants/merchant_'+id])).toBe(id);
  });
  it('does not derive a tenant from role groups or ambiguous merchant memberships', () => {
    expect(merchantIdFromGroups(['/merchant-app-users/merchant_manager'])).toBeNull();
    expect(merchantIdFromGroups(['/merchants/merchant_'+id, '/merchants/merchant_20500000-0000-0000-0000-000000000002'])).toBeNull();
    expect(isMerchantGroup('/merchants/merchant_'+id+'/branch_other')).toBe(false);
  });
});
