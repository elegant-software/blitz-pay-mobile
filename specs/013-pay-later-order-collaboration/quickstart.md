# Quickstart: Pay Later Order Collaboration

## Prerequisites

- `blitz-pay/` and `blitz-pay-merchant/` both running against a backend that exposes delayed-payment capability and collaborative order APIs.
- A merchant configured to support delayed payment.
- One shopper account and one merchant operator account with access to the same branch.

## Scenario 1: Create A Pay Later Order

1. In `blitz-pay`, open a merchant that supports delayed payment.
2. Add products to the basket and proceed to checkout.
3. Verify `Pay now` and `Pay later` are both visible and `Pay later` is selected by default.
4. Confirm checkout.
5. Expected:
   - order is created
   - shopper lands on order detail
   - `OrderId` is visible immediately
   - merchant sees the same order appear in `blitz-pay-merchant`

## Scenario 2: Cross-App Unpaid Order Edit

1. Keep the new unpaid order open in `blitz-pay`.
2. Open the same order detail in `blitz-pay-merchant`.
3. In the merchant app, change quantity or add a new item before payment starts.
4. Expected:
   - shopper order detail refreshes to the latest order state
   - shopper sees a visible non-blocking merchant update banner
   - payment actions remain available because payment has not started yet

## Scenario 3: Retry Failed Pay Now From Tresor

1. In `blitz-pay`, create a `Pay now` order and force the payment attempt to fail.
2. Leave the flow and reopen the order from Tresor.
3. Expected:
   - failed-payment context remains visible
   - retry is available
   - the last payment method is preferred but can be changed

## Scenario 4: Manual Settlement

1. Create a qualifying unpaid order (`Pay later` or failed `Pay now`).
2. In `blitz-pay-merchant`, mark the order as manually settled and optionally enter a note.
3. Expected:
   - merchant sees the order as paid with manual-settlement meaning
   - shopper order detail refreshes to paid if currently open
   - payment actions disappear
   - no further item edits are allowed
