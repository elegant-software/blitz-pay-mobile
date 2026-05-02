# Feature Specification: Order Payment Orchestration

**Feature Branch**: `[011-order-payment-orchestration]`  
**Created**: 2026-05-01  
**Status**: Draft  
**Input**: User description: "/Users/mehdi/MyProject/blitz-pay/api-docs/api-doc.yml we have order endpoint, the change we need to do all payment options rather than directly calling BrainTree, TrueLayer and Strip endpoint should create order with payment channel (selected by user) back-end after craeting order will take over this"

## Clarifications

### Session 2026-05-01

- Q: Should Vault/Tresor recent orders and resume-payment behavior be part of this feature or a separate spec? → A: Extend the current `011-order-payment-orchestration` spec
- Q: Which recent orders should appear in the Vault/Tresor view? → A: Show all orders from the last 7 days, with status and a resume-payment action only for unpaid ones
- Q: When the shopper taps resume in Tresor, should the app reopen recovery directly or first show order details? → A: Tapping resume only shows order details, and the user must manually choose a payment method again
- Q: Which order statuses should allow resume-payment from Tresor? → A: `PENDING_PAYMENT` and `PAYMENT_FAILED` orders are resumable
- Q: How should recent orders be sorted in Tresor? → A: Sort recent orders newest first by creation time
- Q: Should the merchant orders screen be tracked in this feature or a separate merchant spec? → A: Extend the current `011-order-payment-orchestration` spec
- Q: Can the merchant change order status in this feature? → A: Merchant orders screen is read-only in this feature; no status changes yet
- Q: Which filters should the merchant orders screen show? → A: `ALL`, `PROCESSING`, `COMPLETED`, and `CANCELLED`
- Q: What time window should the merchant orders screen show? → A: Show only today’s merchant orders
- Q: How should merchant orders be sorted? → A: Sort merchant orders newest first by creation time

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start Checkout Through Order Creation (Priority: P1)

As a shopper, I want my selected payment option to be submitted as part of order creation so that my checkout always starts from a confirmed order instead of jumping directly into a provider-specific payment flow.

**Why this priority**: This is the core behavior change. Without order-first checkout, payment orchestration stays fragmented and the backend cannot consistently manage the payment journey.

**Independent Test**: Can be fully tested by selecting products, choosing a payment option, and confirming that checkout first creates an order tied to that payment option before any provider-specific payment step begins.

**Acceptance Scenarios**:

1. **Given** the shopper has a valid basket and selects a supported payment option, **When** the shopper confirms checkout, **Then** the system creates an order that includes the selected payment option and returns an order reference for the payment journey.
2. **Given** the shopper has not selected a payment option, **When** the shopper attempts to confirm checkout, **Then** the system prevents order submission and explains that a payment option must be chosen first.
3. **Given** the selected payment option is not available for the current merchant or branch, **When** the shopper confirms checkout, **Then** the system blocks the order submission and prompts the shopper to choose an available option.

---

### User Story 2 - Let The System Orchestrate Payment After Order Creation (Priority: P2)

As a shopper, I want the system to take over payment processing after my order is created so that I do not depend on separate, channel-specific checkout entry points.

**Why this priority**: Central orchestration reduces inconsistent payment behavior and ensures every payment attempt is tied to a known order from the start.

**Independent Test**: Can be fully tested by creating an order with each supported payment option and verifying that the system starts the correct follow-up payment path from the created order without requiring a separate manual provider initiation step.

**Acceptance Scenarios**:

1. **Given** an order is created successfully with a supported payment option, **When** the order creation completes, **Then** the system immediately transitions the shopper into the next payment step associated with that order.
2. **Given** the payment handoff cannot start after the order is created, **When** the shopper remains in checkout, **Then** the system preserves the order reference, reports that payment could not continue, and allows a safe retry or recovery path.
3. **Given** the shopper returns to the order after an interrupted payment attempt, **When** the shopper reopens the in-progress checkout state, **Then** the system can determine the current payment state from the order rather than starting a duplicate payment blindly.

---

### User Story 3 - Track Order-Linked Payment Outcomes (Priority: P3)

As a shopper and operator, I want payment progress and final outcomes to stay linked to the created order so that failures, pending states, and completed payments can be understood from a single order reference.

**Why this priority**: Order-linked outcomes are required for supportability, payment recovery, and a coherent customer experience after the initial handoff.

**Independent Test**: Can be fully tested by creating orders that lead to success, failure, and pending outcomes and verifying that each outcome remains traceable through the same order reference.

**Acceptance Scenarios**:

1. **Given** a payment completes successfully for a created order, **When** the final outcome is available, **Then** the order reflects a successful payment outcome and the shopper sees a corresponding success state.
2. **Given** a payment fails after the order is created, **When** the failure is reported, **Then** the order remains available with a failed payment outcome and the shopper sees guidance for the next action.
3. **Given** a payment remains pending beyond the initial checkout step, **When** the shopper checks the order status later, **Then** the system shows the latest known payment state for that order without losing the original order reference.

---

### User Story 4 - Review Recent Orders In Tresor And Resume Unpaid Orders (Priority: P3)

As a shopper, I want to see my recent orders in the Tresor screen and continue payment for unpaid ones so that I can recover interrupted purchases without starting over.

**Why this priority**: Order-first checkout only becomes fully recoverable in the consumer app if shoppers can find recent orders and act on unpaid ones from Tresor.

**Independent Test**: Can be fully tested by opening Tresor, confirming that all orders from the last 7 days appear newest-first with status and detail access, and verifying that only unpaid orders show a resume-payment action.

**Acceptance Scenarios**:

1. **Given** the shopper opens Tresor, **When** they have orders created within the last 7 days, **Then** the system shows all such orders with their latest payment or order status.
2. **Given** a recent order is already paid, **When** the shopper views it in Tresor, **Then** the order is visible with its status but does not offer a resume-payment action.
3. **Given** a recent order is unpaid or still recoverable, **When** the shopper views it in Tresor, **Then** the order is visible with its status and a resume-payment action that opens the order details view rather than directly launching a payment provider flow.
4. **Given** the shopper has multiple recent orders in Tresor, **When** the list is shown, **Then** the orders are sorted newest first by creation time.

---

### User Story 5 - Review Today’s Merchant Orders With Filters (Priority: P3)

As a merchant operator, I want to see today’s orders in the merchant orders screen with status-based filtering so that I can monitor order progress without editing order state in this feature.

**Why this priority**: Order-first checkout becomes operationally useful only if merchants can inspect incoming orders and separate active work from completed work in the merchant app.

**Independent Test**: Can be fully tested by opening the merchant orders screen, confirming that only today’s orders are listed newest-first with their statuses, and verifying that filtering changes the visible list without offering any status-edit action.

**Acceptance Scenarios**:

1. **Given** the merchant opens the orders screen, **When** orders created today are available, **Then** the system shows a list of those orders with their latest known status.
2. **Given** the merchant uses one of the supported filters `ALL`, `PROCESSING`, `COMPLETED`, or `CANCELLED`, **When** the filter is applied, **Then** the system updates the list to show only orders matching that filter.
3. **Given** the merchant views an individual order, **When** they inspect the order details, **Then** the system shows the order status but does not offer any action to change it in this feature.
4. **Given** the merchant has multiple matching orders, **When** the list is shown, **Then** the orders are sorted newest first by creation time.

### Edge Cases

- What happens when the shopper changes the selected payment option immediately before confirming checkout?
- What happens when order creation succeeds but the follow-up payment handoff fails before the shopper reaches the next payment step?
- How does the system prevent duplicate orders when the shopper taps confirm multiple times or retries after a slow response?
- What happens when a payment option was shown earlier in checkout but becomes unavailable before order submission?
- How does the system handle an order whose payment remains pending long enough that the shopper leaves and later returns to the app?
- What statuses count as unpaid or still recoverable for the Tresor resume-payment action?
- What should the merchant orders screen show when no orders match the selected filter?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require the shopper to choose one supported payment option before checkout can be confirmed.
- **FR-002**: The system MUST create an order as the first committed checkout action for all supported payment options.
- **FR-003**: The created order MUST include the shopper’s selected payment option so the system can determine how payment should proceed next.
- **FR-004**: The system MUST reject checkout confirmation when the selected payment option is not supported for the current merchant or branch.
- **FR-005**: The system MUST return or preserve an order reference immediately after successful order creation so the payment journey can be resumed or investigated later.
- **FR-006**: After order creation, the system MUST initiate the appropriate payment flow based on the selected payment option without requiring a separate direct payment start path per option.
- **FR-007**: The system MUST keep payment initiation tied to the created order so that every payment attempt can be traced back to a single order reference.
- **FR-008**: If payment initiation cannot proceed after order creation, the system MUST keep the order available, present a clear failure state, and allow a safe recovery path that does not create an unintended duplicate order.
- **FR-009**: The system MUST support recovery for interrupted or incomplete payment attempts by determining the current payment state from the existing order before starting a new payment attempt.
- **FR-010**: The system MUST represent at least pending, successful, and failed payment outcomes against the created order.
- **FR-011**: The shopper MUST be able to see which order a payment outcome belongs to when checkout completes, fails, or remains pending.
- **FR-012**: The system MUST prevent duplicate checkout submissions from creating multiple active orders for the same shopper action unless the shopper explicitly starts a new purchase attempt.
- **FR-013**: The system MUST preserve merchant, branch, basket total, and selected payment option context on the order so downstream payment handling uses the same commercial context the shopper confirmed.
- **FR-014**: When a payment option becomes unavailable between selection and confirmation, the system MUST stop order submission and require the shopper to choose a currently available option.
- **FR-015**: The system MUST include the consumer `blitz-pay` Vault/Tresor experience for recent order visibility and resume-payment behavior as part of this order-payment feature rather than as a separate feature scope.
- **FR-016**: The system MUST show all orders from the last 7 days in the consumer Vault/Tresor screen, including each order’s latest known order or payment status.
- **FR-017**: The system MUST show a resume-payment action only for recent orders whose payment is not yet completed and remains recoverable.
- **FR-018**: When the shopper selects the resume-payment action from Vault/Tresor, the system MUST open the order details view first and require the shopper to manually choose the next payment action rather than immediately launching the last payment provider flow.
- **FR-019**: The system MUST treat `PENDING_PAYMENT` and `PAYMENT_FAILED` orders as resumable in Vault/Tresor and MUST NOT offer resume-payment for already paid or cancelled orders.
- **FR-020**: The system MUST sort recent Vault/Tresor orders newest first by order creation time.
- **FR-021**: The system MUST include the merchant-facing `blitz-pay-merchant` orders screen behavior for order visibility and filtering as part of this feature scope rather than as a separate feature.
- **FR-022**: The system MUST keep the merchant-facing orders screen read-only in this feature and MUST NOT allow merchants to change order status from the app yet.
- **FR-023**: The system MUST provide merchant order filters for `ALL`, `PROCESSING`, `COMPLETED`, and `CANCELLED` in the merchant orders screen.
- **FR-024**: The system MUST show only orders created on the current day in the merchant orders screen for this feature.
- **FR-025**: The system MUST sort merchant orders newest first by order creation time.

### Key Entities *(include if feature involves data)*

- **Order**: A committed purchase record created from the shopper’s basket, including merchant context, branch context, order reference, confirmed total, and selected payment option.
- **Payment Option Selection**: The shopper’s chosen way to pay for the order, subject to merchant or branch availability rules.
- **Payment Attempt**: The payment processing lifecycle associated with one order, including initiation, interruption, retry, pending state, success, or failure.
- **Payment Outcome**: The latest known status of the order-linked payment, including whether the payment is pending, successful, or failed.
- **Merchant Order View**: A merchant-facing representation of orders in `blitz-pay-merchant`, including status display and filterable list behavior without status-edit actions in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new checkout attempts across supported payment options begin with successful order creation or a clear pre-submission validation failure; none bypass order creation to start payment directly.
- **SC-002**: At least 95% of shoppers who already have a valid basket and an available payment option can submit checkout and receive an order reference within 30 seconds.
- **SC-003**: 100% of payment outcomes shown to shoppers can be traced to a single order reference for support and recovery purposes.
- **SC-004**: In retry scenarios caused by interrupted payment initiation, 100% of recovery attempts reuse or reference the existing order instead of silently creating a duplicate active order.
- **SC-005**: At least 90% of shoppers in usability validation can complete checkout with their preferred payment option on the first attempt without needing to understand provider-specific payment entry points.

## Assumptions

- The feature applies to the consumer checkout flow in `blitz-pay/`, where shoppers currently choose among multiple payment options.
- The feature scope also includes the consumer Vault/Tresor screen in `blitz-pay/` for recent order history and resume-payment access tied to the same order lifecycle.
- The feature scope also includes the merchant-facing orders screen in `blitz-pay-merchant/` for merchant order visibility tied to the same order lifecycle.
- The current checkout experience already has a basket total, merchant context, and branch context available at the moment the shopper confirms payment.
- The backend already owns or will own the responsibility for mapping a selected payment option to the corresponding downstream payment handling.
- Existing supported payment options remain available to shoppers, but they are initiated through the order-first checkout flow rather than through separate direct entry points.
- Order creation and payment outcome retrieval continue to require the existing authenticated user context and do not introduce a guest checkout flow in this feature.
