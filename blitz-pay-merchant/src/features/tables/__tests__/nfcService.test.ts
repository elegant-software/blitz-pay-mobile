import { getNfcAvailability, writeAndLockTableLink } from '../services/nfcService';
import { NfcWriteError } from '../nfcTag';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// A binary built without the native module: the library throws as soon as it is imported.
jest.mock('react-native-nfc-manager', () => {
  throw new Error("TurboModuleRegistry.getEnforcing(...): 'NfcManager' could not be found");
});

describe('nfcService without the native NFC module', () => {
  it('reports NFC as unsupported instead of crashing', async () => {
    await expect(getNfcAvailability()).resolves.toBe('unsupported');
  });

  it('refuses to write with a write error', async () => {
    await expect(writeAndLockTableLink('https://storefront.example/t/ABC123', 'hold')).rejects.toBeInstanceOf(NfcWriteError);
  });
});
