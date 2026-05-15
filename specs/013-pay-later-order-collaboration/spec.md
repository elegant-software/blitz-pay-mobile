# Feature Specification: Pay Later Order Collaboration

**Feature Branch**: `[013-pay-later-order-collaboration]`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Create a Spec Kit feature for blitz-pay and blitz-pay-merchant based on the latest shared order-payment context, including pay now/pay later choice, unpaid-order editing across both apps, merchant manual settlement, and shared order visibility."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Pay Now Or Pay Later At Checkout (Priority: P1)

As a shopper, I want checkout to show both `Pay now` and `Pay later` when the merchant supports delayed payment so I can either pay immediately or create the order first and pay later.

**Why this priority**: This is the entry point to the new experience. Without the checkout choice, none of the delayed-payment collaboration flow exists in the apps.

**Independent Test**: Open checkout for a merchant that supports delayed payment, verify `Pay later` is selected by default, switch to `Pay now`, and confirm each path produces the correct immediate next screen.

**Acceptance Scenarios**:

1. **Given** the merchant supports delayed payment, **When** the shopper reaches checkout, **Then** the app shows both `Pay now` and `Pay later`, with `Pay later` preselected by default.
2. **Given** the shopper confirms `Pay later`, **When** the order is created successfully, **Then** the shopper is taken to the new order detail screen with the `OrderId` visible immediately.
3. **Given** the shopper confirms `Pay now`, **When** the order is created successfully and payment succeeds, **Then** the shopper sees the payment result screen first with the `OrderId` visible there.
4. **Given** the shopper changes payment timing or leaves checkout before confirming, **When** no confirmation is submitted, **Then** no order is created.

---

### User Story 2 - Collaborate On An Unpaid Order Before Payment Starts (Priority: P1)

As a shopper or merchant, I want to adjust an unpaid order before payment starts so the order can reflect the real items and prices the customer should pay for.

**Why this priority**: Delayed payment is only operationally useful if the unpaid order can still be shaped collaboratively before payment begins.

**Independent Test**: Create a `Pay later` order, open it in both apps, add items, change quantities, remove items, and apply a merchant price override before payment starts, verifying both apps show the latest order state.

**Acceptance Scenarios**:

1. **Given** an unpaid order with no payment in progress, **When** the shopper changes quantities, removes items, or adds new items in `blitz-pay`, **Then** the same order is updated rather than replaced.
2. **Given** an unpaid order with no payment in progress, **When** the merchant changes quantities, removes items, adds new items, or overrides line price in `blitz-pay-merchant`, **Then** the same order is updated rather than replaced.
3. **Given** the shopper has an unpaid order detail screen open, **When** the merchant edits the order before payment starts, **Then** the shopper sees the latest order state plus a visible non-blocking banner that the merchant updated the order.
4. **Given** the merchant has an unpaid order detail screen open, **When** the shopper edits the order before payment starts, **Then** the merchant sees the latest order state plus a visible non-blocking banner that the customer updated the order.
5. **Given** payment is already in progress for the order, **When** either side attempts to edit it, **Then** the app does not allow the edit.

---

### User Story 3 - Manage Unpaid Order Outcomes Across Both Apps (Priority: P2)

As a shopper or merchant, I want unpaid orders to move cleanly into cancelled, failed, paid, or manually settled outcomes so both apps always show the same current truth.

**Why this priority**: Once delayed payment exists, the apps need shared rules for what ends editing, what removes payment actions, and how non-app settlement is represented.

**Independent Test**: Exercise unpaid-order cancellation, failed payment retry, merchant manual settlement, and successful payment, then verify both apps show the same current state and remove actions when the order is no longer payable.

**Acceptance Scenarios**:

1. **Given** a shopper or merchant cancels an unpaid order before payment starts, **When** the other app is viewing that order, **Then** it refreshes to cancelled and removes payment actions.
2. **Given** a `Pay now` payment attempt fails, **When** the shopper reopens the order later, **Then** the order remains unpaid, shows failed-payment context, and still offers retry.
3. **Given** a merchant marks a qualifying unpaid order as paid manually, **When** the shopper or merchant reads that order again, **Then** the order is shown as paid with manual-settlement meaning rather than as an in-app payment.
4. **Given** a successful in-app payment or manual settlement has completed, **When** either side opens the order, **Then** the order is locked against further item edits.

---

### User Story 4 - Resume And Pay Later From Tresor (Priority: P2)

As a shopper, I want Tresor to help me return to unpaid or failed orders later so I can continue payment without losing the order context.

**Why this priority**: The consumer delayed-payment journey depends on a clear recovery path after the original checkout moment has passed.

**Independent Test**: Create a `Pay later` order and a failed `Pay now` order, reopen both from Tresor, and verify the order detail flow and payment actions follow the latest state correctly.

**Acceptance Scenarios**:

1. **Given** a shopper has a `Pay later` order, **When** they reopen it from Tresor, **Then** the app shows the latest current order state and lets the shopper choose a payment method at that time.
2. **Given** a shopper reopens a failed `Pay now` order from Tresor, **When** retry is available, **Then** the app prefers the last payment method but still allows the shopper to change it.
3. **Given** the merchant changed the order before the shopper reopened it, **When** the shopper returns from Tresor, **Then** the shopper sees only the latest order state rather than a change-history comparison view.
4. **Given** the order has already been cancelled or manually settled by the merchant, **When** the shopper opens it from Tresor, **Then** the app no longer offers payment actions.

---

### User Story 5 - Give Merchant Operators Operational Visibility And Control (Priority: P3)

As a merchant operator, I want the merchant app to show new delayed-payment orders immediately and expose the order context needed to follow them through to payment or manual resolution.

**Why this priority**: Merchant-side visibility is what turns delayed payment from a shopper-only concept into an operational workflow.

**Independent Test**: Create `Pay later`, failed `Pay now`, successfully paid, and manually settled orders, then verify the merchant app list and detail screens present the expected order state, `OrderId`, checkout intent, and payment source.

**Acceptance Scenarios**:

1. **Given** a shopper creates a `Pay later` order, **When** the merchant opens the orders list, **Then** the order appears immediately with `OrderId` visible and an awaiting-payment meaning.
2. **Given** a `Pay now` attempt fails, **When** the merchant opens that order, **Then** the merchant sees a payment-failed meaning rather than the same state as a never-started payment.
3. **Given** the merchant opens order details for a paid order, **When** the order was paid in the app or manually settled, **Then** the merchant can see both the current state and the payment source.
4. **Given** the merchant opens order details for an unpaid order, **When** the order originally started as `Pay now` or `Pay later`, **Then** the merchant can see that original checkout intent in order details.

### Edge Cases

- What happens when the shopper selects `Pay later`, but the order becomes cancelled before they reopen it from Tresor?
- What happens when the merchant applies a price override to one of several separate lines for the same product before payment starts?
- What happens when either side removes the last remaining item from an unpaid order?
- What happens when the merchant manually settles an order while the shopper is currently viewing its detail screen?
- What happens when a failed `Pay now` order is edited before the shopper retries payment?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The consumer app MUST show both `Pay now` and `Pay later` at checkout when the merchant supports delayed payment.
- **FR-002**: The consumer app MUST default the checkout choice to `Pay later` when delayed payment is available.
- **FR-003**: When the shopper confirms `Pay later`, the app MUST create the order without forcing payment-method selection at that moment.
- **FR-004**: After successful `Pay later` order creation, the consumer app MUST open the new order detail screen and show the `OrderId` immediately.
- **FR-005**: When the shopper confirms `Pay now`, the app MUST collect payment method before order creation and then start payment immediately from the created order.
- **FR-006**: After successful `Pay now` payment, the consumer app MUST show the payment result screen first and MUST show the `OrderId` there.
- **FR-007**: Before payment starts, both shopper and merchant MUST be able to update the same unpaid order rather than creating a replacement order.
- **FR-008**: Before payment starts, both shopper and merchant MUST be able to add new items, change quantities, and remove items from the unpaid order.
- **FR-009**: Before payment starts, only the merchant MUST be able to override line-item price.
- **FR-010**: Shopper-added items MUST use the current catalog price by default unless the merchant later overrides that line price.
- **FR-011**: The apps MUST allow the same product to appear on separate unpaid-order lines and MUST treat merchant price override as line-specific rather than product-wide.
- **FR-012**: The shopper MUST still be able to remove an item before payment starts even after the merchant has overridden that line's price.
- **FR-013**: The shopper viewing an unpaid order MUST NOT block merchant edits before payment starts.
- **FR-014**: The consumer app MUST show a visible non-blocking merchant-attributed update banner on the open order detail screen when the merchant changes an unpaid order.
- **FR-015**: The merchant app MUST show a visible non-blocking customer-attributed update banner on the open order detail screen when the shopper changes an unpaid order.
- **FR-016**: Update banners MUST appear only on the open order detail screen and MUST NOT become a separate list-level notification system in this version.
- **FR-017**: If payment is in progress, the apps MUST block further order edits until the payment attempt resolves.
- **FR-018**: If the final remaining item is removed, the order MUST become cancelled and MUST no longer be payable.
- **FR-019**: The shopper MUST be able to cancel an unpaid order explicitly before payment starts.
- **FR-020**: The merchant MUST be able to cancel an unpaid order explicitly before payment starts.
- **FR-021**: If the merchant cancels an unpaid order while the shopper is viewing it, the consumer app MUST refresh the order to cancelled and remove payment actions immediately.
- **FR-022**: Tresor MUST remain the normal shopper path to reopen unpaid or failed orders later.
- **FR-023**: When reopening a `Pay later` order from Tresor, the shopper MUST choose a payment method at resume time.
- **FR-024**: When retrying a failed `Pay now` order from Tresor, the app MUST prefer the last payment method but still allow the shopper to change it.
- **FR-025**: A failed `Pay now` order MUST keep visible failed-payment context when reopened until a later outcome replaces it.
- **FR-026**: Editing a failed `Pay now` order before retry MUST NOT clear the failed-payment context by itself.
- **FR-027**: The merchant app MUST show `Pay later` orders in the order list immediately after creation.
- **FR-028**: Before payment starts, the merchant app MUST distinguish awaiting-payment meaning from failed-payment meaning.
- **FR-029**: The merchant app MUST show original checkout intent in order details only.
- **FR-030**: The merchant app MUST show payment source alongside current order state in paid-order details.
- **FR-031**: The consumer app MUST also show payment source on paid orders.
- **FR-032**: Payment source for this feature MUST distinguish only app payment and manual settlement.
- **FR-033**: The merchant app MUST support manual settlement for original `Pay later` orders and for failed `Pay now` orders that remain unpaid.
- **FR-034**: Manual settlement MAY include an optional note and MUST lock the order against further item edits.
- **FR-035**: When manual settlement happens while the shopper is viewing the order, the consumer app MUST refresh to paid immediately and remove payment actions.
- **FR-036**: Once an order is paid successfully in the app or manually settled by the merchant, both apps MUST treat the order as fully locked for item edits.
- **FR-037**: When a failed `Pay now` order is later manually settled, the active presentation MUST become paid with manual-settlement meaning rather than continuing to present failed-payment as the current main state.
- **FR-038**: The merchant app MUST NOT send special payment reminders in this version; merchant follow-up remains manual.

### Key Entities *(include if feature involves data)*

- **Checkout Intent**: The shopper's choice between immediate payment and delayed payment for a specific order.
- **Editable Unpaid Order**: An order that exists but has not yet started payment, and may still be changed by both apps.
- **Pre-Payment Order Edit**: A shopper or merchant change to an unpaid order before payment starts, including add-item, quantity change, remove-item, and merchant repricing actions.
- **Merchant Price Override**: A merchant-controlled line-specific price adjustment applied before payment starts.
- **Manual Settlement**: A merchant-recorded paid outcome for a qualifying unpaid order that was settled outside the shopper app.
- **Payment Source**: The user-visible source of a paid order outcome, distinguishing app payment from manual settlement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of supported delayed-payment checkouts show both `Pay now` and `Pay later`, with `Pay later` preselected by default.
- **SC-002**: 100% of confirmed `Pay later` checkouts create an order and land the shopper on that order's detail screen without asking for payment method first.
- **SC-003**: 100% of shopper and merchant edits made before payment starts update the same unpaid order rather than forcing a new order to be created.
- **SC-004**: 100% of merchant manual settlements and merchant cancellations remove shopper payment actions the next time the current order state refreshes.
- **SC-005**: 100% of paid-order presentations in both apps distinguish app payment from manual settlement.
- **SC-006**: At least 90% of usability-tested shoppers can reopen a `Pay later` or failed `Pay now` order from Tresor and understand how to continue without assistance.

## Assumptions

- The backend will expose the order state, checkout intent, delayed-payment capability, payment source, and unpaid-order mutation contracts needed by the apps.
- The consumer app remains the only place where payment can actually be started.
- The merchant app in this feature manages shopper-created orders only and does not originate equivalent customer orders itself.
- The shopper and merchant apps both refresh from the backend's latest order state rather than maintaining a separate audit history view in the client.
- Detailed notification workflows beyond open-screen refresh behavior are out of scope for this version.
