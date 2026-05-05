# Quickstart: Order Payment Orchestration

## Setup

1. In `blitz-pay/`, ensure the consumer app can authenticate and reach the backend order and payment endpoints.
2. In `blitz-pay-merchant/`, ensure the merchant app can authenticate and reach the same backend API with merchant-scoped order access.
3. Confirm the backend environment exposes:
   - `POST /v1/orders`
   - `GET /v1/orders/{orderId}`
   - payment-provider handoff endpoints already used by the consumer app
   - merchant order list endpoint defined in [orders-api.md](contracts/orders-api.md)

## Consumer Validation Flow

1. Start the consumer app:

```bash
cd blitz-pay
npm start
```

2. Open a nearby merchant, add items to the basket, and proceed to checkout.
3. Select each supported payment method (`bank`, `card`, `paypal`) and confirm:
   - an order is created before provider-specific flow starts
   - the created order id is preserved on processing/result screens
   - provider handoff reuses the created order
4. Open Vault/Tresor and confirm:
   - all orders from the last 7 days are listed
   - list is newest first
   - only `PENDING_PAYMENT` and `PAYMENT_FAILED` orders show resume-payment
   - tapping resume opens order details first, not the provider directly

## Merchant Validation Flow

1. Start the merchant app:

```bash
cd blitz-pay-merchant
npm start
```

2. Open the orders screen and confirm:
   - only today’s backend orders are shown
   - the list is newest first
   - filters `ALL`, `PROCESSING`, `COMPLETED`, and `CANCELLED` work
   - tapping an order opens a read-only detail view
   - no status-change action is available

## Verification

Run type-checking before implementation is considered complete:

```bash
cd blitz-pay && npm run lint
cd ../blitz-pay-merchant && npm run lint
```

Manual verification is still required for:
- payment handoff and recovery across all supported payment channels
- Vault/Tresor resume behavior for unpaid orders
- merchant empty/filter states and read-only navigation
