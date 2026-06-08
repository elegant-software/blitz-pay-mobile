import {
  AppointmentError,
  bookMerchantAppointment,
} from '../features/appointments/services/appointmentService';
import { authedFetch } from '../lib/api';
import { observability } from '../lib/observability';

jest.mock('../lib/api', () => ({
  authedFetch: jest.fn(),
}));

jest.mock('../lib/observability', () => ({
  observability: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const request = {
  branchId: 'branch-1',
  productId: 'product-1',
  productCategoryId: 'category-1',
  startTime: '2026-06-06T10:00:00.000Z',
  employeeId: null,
  contactName: 'Jane Doe',
  contactEmail: null,
  contactPhone: null,
  note: null,
};

describe('appointment service observability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs appointment booking network failures before throwing a UI-safe error', async () => {
    jest.mocked(authedFetch).mockRejectedValueOnce(new Error('Network request failed'));

    await expect(bookMerchantAppointment('merchant-1', request)).rejects.toThrow(
      'appointment_book_failed',
    );

    expect(observability.info).toHaveBeenCalledWith('merchant_appointment_book_started', {
      merchantId: 'merchant-1',
      branchId: 'branch-1',
      productId: 'product-1',
      startTime: '2026-06-06T10:00:00.000Z',
    });
    expect(observability.error).toHaveBeenCalledWith('merchant_appointment_book_failed', {
      merchantId: 'merchant-1',
      branchId: 'branch-1',
      productId: 'product-1',
      startTime: '2026-06-06T10:00:00.000Z',
      reason: 'Network request failed',
    });
  });

  it('preserves and maps backend problem details for meaningful UI errors', async () => {
    jest.mocked(authedFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: 'No qualified employee available',
          status: 422,
          title: 'Unprocessable Entity',
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );

    await expect(bookMerchantAppointment('merchant-1', request)).rejects.toMatchObject({
      name: 'AppointmentError',
      i18nKey: 'appointment_no_qualified_employee',
      detail: 'No qualified employee available',
      status: 422,
    } satisfies Partial<AppointmentError>);

    expect(observability.error).toHaveBeenCalledWith('merchant_appointment_book_failed', {
      merchantId: 'merchant-1',
      branchId: 'branch-1',
      productId: 'product-1',
      startTime: '2026-06-06T10:00:00.000Z',
      status: 422,
      reason: 'No qualified employee available',
    });
  });
});
