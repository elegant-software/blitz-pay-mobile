import { fetchSignupVerticals, registerMerchant, registerAndSignIn, MerchantRegistrationError } from '../features/auth/services/merchantRegistration';
import { observability } from '../lib/observability';
jest.mock('../lib/config', () => ({config: {apiUrl: 'https://api.example.test'}}));
jest.mock('../lib/observability', () => ({observability: {info: jest.fn(), warn: jest.fn(), error: jest.fn()}}));
const request = {ownerName: 'Alex Example', merchantName: 'Example Studio', email: 'alex@example.test',
  password: 'FixturePass205!', businessType: 'RETAIL', operatingCountry: 'DE'};
const result = {userId: '20500000-0000-0000-0000-000000000001', merchantId: '20500000-0000-0000-0000-000000000002',
  requiresBranchSetup: true, emailVerificationRequired: false, verificationEmailSent: false};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
describe('merchant registration', () => {
  beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); });
  it('loads the live business catalogue without sending credentials', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response([{code: 'RETAIL', displayName: 'Retail'}]));
    expect(await fetchSignupVerticals()).toEqual([{code: 'RETAIL', displayName: 'Retail'}]);
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/v1/merchants/verticals', expect.objectContaining({method: 'GET'}));
  });
  it('does not silently convert catalogue failure into an empty list', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response({detail: 'Catalogue unavailable'}, 503));
    await expect(fetchSignupVerticals()).rejects.toMatchObject({detail: 'Catalogue unavailable', status: 503});
    expect(observability.error).toHaveBeenCalled();
  });
  it('reports empty catalogues and network failures visibly', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response([]));
    await expect(fetchSignupVerticals()).rejects.toMatchObject({i18nKey: 'registration_no_business_types'});
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('Network failed'));
    await expect(fetchSignupVerticals()).rejects.toMatchObject({i18nKey: 'network_error'});
    expect(observability.error).toHaveBeenLastCalledWith('merchant_signup_verticals_failed', {
      url: 'https://api.example.test/v1/merchants/verticals', reason: 'network_error', providerReason: 'Network failed',
    });
  });
  it('explains when the server still protects the signup catalogue', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response('', {status: 401}));
    await expect(fetchSignupVerticals()).rejects.toMatchObject({i18nKey: 'registration_service_unavailable', status: 401});
    expect(observability.error).toHaveBeenLastCalledWith('merchant_signup_verticals_failed', expect.objectContaining({
      url: 'https://api.example.test/v1/merchants/verticals', status: 401,
    }));
  });
  it('uses the versioned contract, normalizes input and never logs credentials', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(result, 201));
    await expect(registerMerchant({...request, email: ' ALEX@EXAMPLE.TEST ', operatingCountry: 'de'})).resolves.toEqual(result);
    const [url, init] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/merchant-registrations');
    expect(JSON.parse(init!.body as string)).toEqual({...request, email: 'alex@example.test'});
    expect(JSON.stringify(jest.mocked(observability.info).mock.calls)).not.toContain(request.password);
    expect(JSON.stringify(jest.mocked(observability.info).mock.calls)).not.toContain(request.email);
  });
  it('preserves safe backend details and redacts echoed credentials from diagnostics', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response({error: 'email_conflict', detail: 'Account exists: '+request.email+' '+request.password}, 409));
    await expect(registerMerchant(request)).rejects.toBeInstanceOf(MerchantRegistrationError);
    const logged = JSON.stringify(jest.mocked(observability.error).mock.calls);
    expect(logged).not.toContain(request.email);
    expect(logged).not.toContain(request.password);
  });
  it('does not report a created account as failed if automatic login fails', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(result, 201));
    const login = jest.fn().mockRejectedValue(new Error('account_locked'));
    await expect(registerAndSignIn(request, login)).resolves.toMatchObject({outcome: 'login_required', registration: result});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('respects email verification rather than attempting a password login too early', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response({...result, emailVerificationRequired: true, verificationEmailSent: true}, 201));
    const login = jest.fn();
    await expect(registerAndSignIn(request, login)).resolves.toMatchObject({outcome: 'verification_required'});
    expect(login).not.toHaveBeenCalled();
  });
  it('logs network failure and rejects an invalid success response', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(registerMerchant(request)).rejects.toMatchObject({i18nKey: 'network_error'});
    jest.mocked(fetch).mockResolvedValueOnce(response({}, 201));
    await expect(registerMerchant(request)).rejects.toMatchObject({i18nKey: 'registration_failed'});
  });
  it('redacts credentials from thrown network errors', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error('Failed '+request.email+' '+request.password));
    await expect(registerMerchant(request)).rejects.toMatchObject({i18nKey: 'network_error'});
    const logged = JSON.stringify(jest.mocked(observability.error).mock.calls);
    expect(logged).not.toContain(request.email);
    expect(logged).not.toContain(request.password);
    expect(logged).toContain('[REDACTED]');
  });
});
