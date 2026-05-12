const baseUrl = process.env.CONTRACT_TEST_BASE_URL ?? 'http://localhost:8090';

describe('blitz-pay-merchant contract tests', () => {
  it('POST /v1/payments/request returns 202 with paymentRequestId', async () => {
    const response = await fetch(`${baseUrl}/v1/payments/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentRequestId: null,
        orderId: 'ORDER-123',
        amountMinorUnits: 1099,
        currency: 'EUR',
        userDisplayName: 'Jane Doe',
        userEmail: 'jane.doe@example.com',
        redirectReturnUri: 'https://merchant.example.com/return',
      }),
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.paymentRequestId).toMatch(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    );
  });

  // Add one test per contract file in blitz-pay/src/contractTest/resources/contracts/.
});
