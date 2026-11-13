import { fetchBackendVersion, formatUpdateLine, formatVersionLine } from '../services/versionService';

jest.mock('../../../lib/config', () => ({ config: { apiUrl: 'https://api.test/' } }));
jest.mock('../../../lib/observability', () => ({ observability: { warn: jest.fn() } }));

const request = jest.fn();
beforeEach(() => {
  global.fetch = request;
  request.mockReset();
});

test('reads build.version from the public actuator info endpoint', async () => {
  request.mockResolvedValue(new Response(JSON.stringify({ build: { version: 'v2.26.0' } })));
  expect(await fetchBackendVersion()).toBe('v2.26.0');
  expect(request).toHaveBeenCalledWith('https://api.test/actuator/info', { signal: expect.any(AbortSignal) });
});

test('fails soft on errors, non-2xx and missing build info', async () => {
  request.mockRejectedValueOnce(new Error('offline'));
  expect(await fetchBackendVersion()).toBeNull();
  request.mockResolvedValueOnce(new Response('{}', { status: 503 }));
  expect(await fetchBackendVersion()).toBeNull();
  request.mockResolvedValueOnce(new Response('{}'));
  expect(await fetchBackendVersion()).toBeNull();
});

test('formats app, build and backend versions with a single v prefix', () => {
  const info = { appVersion: '1.4.0', buildNumber: '42', backendVersion: 'v2.26.0', updateId: null, channel: null };
  expect(formatVersionLine(info, 'unknown')).toBe('App v1.4.0 (42) · API v2.26.0');
  expect(formatVersionLine({ ...info, buildNumber: null, backendVersion: null }, 'unknown')).toBe('App v1.4.0 · API unknown');
  expect(formatUpdateLine(info)).toBeNull();
  expect(formatUpdateLine({ ...info, updateId: '1a2b3c4d-5e6f', channel: 'production' })).toBe('Update 1a2b3c4d · production');
});
