# Tasks: Order Payment Orchestration

**Input**: Design documents from `/specs/011-order-payment-orchestration/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/orders-api.md`, `quickstart.md`

**Tests**: No explicit TDD or test-first requirement was specified in `spec.md`, so this task list focuses on implementation and validation tasks.

**Organization**: Tasks are grouped by user story so each increment can be implemented and verified independently across `blitz-pay/` and `blitz-pay-merchant/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (for example `US1`, `US2`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the consumer and merchant app structure for shared order-lifecycle work.

- [X] T001 Create the merchant orders feature folders in `blitz-pay-merchant/src/features/orders/{hooks,services,types}`
- [X] T002 [P] Extend consumer navigation contracts for order history and order detail routes in `blitz-pay/src/types.ts` and `blitz-pay/src/navigation/AppNavigator.tsx`
- [X] T003 [P] Extend merchant navigation contracts for backend-backed order list/detail flow in `blitz-pay-merchant/src/types.ts` and `blitz-pay-merchant/src/navigation/AppNavigator.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared order models, API access, hooks, and copy needed before any story can ship.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Expand shopper order domain models for recent-order, detail, and resume projections in `blitz-pay/src/features/order-payment/types/orderPayment.ts`
- [X] T005 [P] Add shopper order list and order detail API methods with observability in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts`
- [X] T006 [P] Add shopper order-history selectors and session helpers in `blitz-pay/src/features/order-payment/store/orderPaymentStore.ts`
- [X] T007 [P] Create merchant order domain types in `blitz-pay-merchant/src/features/orders/types/order.ts`
- [X] T008 [P] Create merchant order API mapping and observability in `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [X] T009 [P] Create merchant order list/detail hooks in `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrders.ts` and `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`
- [X] T010 Add shared shopper and merchant order translation keys in `blitz-pay/src/lib/translations.ts` and `blitz-pay-merchant/src/lib/translations.ts`

**Checkpoint**: Shared order contracts, state, and localization are ready for both apps.

---

## Phase 3: User Story 1 - Start Checkout Through Order Creation (Priority: P1) 🎯 MVP

**Goal**: Make order creation the first committed action in checkout and preserve the selected payment option on the created order.

**Independent Test**: From a populated basket, the shopper can only confirm after choosing an available payment option, and confirmation creates one order with merchant, branch, basket total, and payment channel before any provider flow starts.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Thread merchant, branch, basket, and active payment-channel context into checkout navigation in `blitz-pay/src/screens/MerchantScreen.tsx` and `blitz-pay/src/screens/ProductDetailScreen.tsx`
- [X] T012 [US1] Validate required payment selection and branch-supported channels before submit in `blitz-pay/src/screens/CheckoutScreen.tsx`
- [X] T013 [US1] Create the order from basket line items and selected channel through the shared orchestration hook in `blitz-pay/src/screens/CheckoutScreen.tsx` and `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`
- [X] T014 [US1] Persist the created order reference, basket snapshot, and duplicate-submit guard state in `blitz-pay/src/features/order-payment/store/orderPaymentStore.ts` and `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`
- [X] T015 [US1] Surface missing-selection, unavailable-channel, and order-create failure states in `blitz-pay/src/screens/CheckoutScreen.tsx` and `blitz-pay/src/lib/translations.ts`

**Checkpoint**: Checkout cannot bypass order creation, and every valid confirmation returns exactly one order reference.

---

## Phase 4: User Story 2 - Let The System Orchestrate Payment After Order Creation (Priority: P2)

**Goal**: Start each payment channel from the existing order context instead of directly from checkout.

**Independent Test**: After order creation, each supported channel starts from the saved order context, and a failed handoff preserves the same order reference for safe retry.

### Implementation for User Story 2

- [X] T016 [P] [US2] Add order-based Stripe handoff request handling in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts` and `blitz-pay/src/hooks/useStripePayment.ts`
- [X] T017 [P] [US2] Add order-based PayPal/Braintree handoff handling in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts` and `blitz-pay/src/hooks/useBraintreePayPal.ts`
- [X] T018 [US2] Refactor TrueLayer handoff to start from saved order context with required observability boundaries in `blitz-pay/src/lib/truelayer.ts`
- [X] T019 [US2] Route post-create handoff, retry, and recovery through the shared order-payment hook in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`
- [X] T020 [US2] Update checkout and processing navigation to use order-based handoff state in `blitz-pay/src/screens/CheckoutScreen.tsx` and `blitz-pay/src/screens/PaymentProcessingScreen.tsx`

**Checkpoint**: Payment initiation always starts from an existing order and retry never creates a second order.

---

## Phase 5: User Story 3 - Track Order-Linked Payment Outcomes (Priority: P3)

**Goal**: Keep pending, failed, cancelled, and successful outcomes tied to the same order reference across recovery and result screens.

**Independent Test**: Given an order created in checkout, success, failure, cancellation, and pending states all remain visible through the same order-linked context across processing, pending, and result screens.

### Implementation for User Story 3

- [X] T021 [P] [US3] Extend payment result domain types with order-linked outcome metadata in `blitz-pay/src/lib/payments/types.ts` and `blitz-pay/src/lib/payments/failureReasons.ts`
- [X] T022 [P] [US3] Update order-aware payment polling and fallback reads in `blitz-pay/src/lib/payments/paymentStatusClient.ts` and `blitz-pay/src/lib/payments/paymentResultTracker.ts`
- [ ] T023 [US3] Update payment recovery hooks to prefer existing order-linked attempts in `blitz-pay/src/hooks/usePaymentResult.ts` and `blitz-pay/src/lib/payments/recoverInFlight.ts`
- [X] T024 [US3] Surface order reference and next-action guidance on pending and result screens in `blitz-pay/src/screens/PaymentPendingScreen.tsx` and `blitz-pay/src/screens/PaymentResultScreen.tsx`
- [X] T025 [US3] Add request, failure, and result observability for order-linked outcome transitions in `blitz-pay/src/lib/payments/paymentStatusClient.ts` and `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`

**Checkpoint**: All shopper-visible payment outcomes remain traceable to one order reference and can be recovered safely.

---

## Phase 6: User Story 4 - Review Recent Orders In Tresor And Resume Unpaid Orders (Priority: P3)

**Goal**: Show the shopper’s recent orders in Vault/Tresor and allow manual payment recovery from order details for resumable orders.

**Independent Test**: Opening Vault shows all orders from the last 7 days newest-first, only `PENDING_PAYMENT` and `PAYMENT_FAILED` entries expose resume-payment, and tapping resume opens order details before any provider action.

### Implementation for User Story 4

- [X] T026 [P] [US4] Add shopper recent-order list and resumable-order selectors in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts` and `blitz-pay/src/features/order-payment/store/orderPaymentStore.ts`
- [X] T027 [P] [US4] Create the shopper order detail screen and route wiring in `blitz-pay/src/screens/OrderDetailScreen.tsx`, `blitz-pay/src/types.ts`, and `blitz-pay/src/navigation/AppNavigator.tsx`
- [X] T028 [US4] Replace placeholder Vault content with backend-backed recent orders, 7-day filtering, and newest-first sorting in `blitz-pay/src/screens/VaultScreen.tsx`
- [X] T029 [US4] Wire Vault order taps to order details and show resume-payment only for `PENDING_PAYMENT` and `PAYMENT_FAILED` in `blitz-pay/src/screens/VaultScreen.tsx`
- [X] T030 [US4] Implement manual resume-payment from shopper order details through the shared order hook in `blitz-pay/src/screens/OrderDetailScreen.tsx` and `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`
- [X] T031 [US4] Add shopper loading, empty, and error states for Vault and order details in `blitz-pay/src/screens/VaultScreen.tsx`, `blitz-pay/src/screens/OrderDetailScreen.tsx`, and `blitz-pay/src/lib/translations.ts`

**Checkpoint**: Vault/Tresor becomes a usable recovery surface for unpaid recent orders without auto-launching a provider.

---

## Phase 7: User Story 5 - Review Today’s Merchant Orders With Filters (Priority: P3)

**Goal**: Replace mock merchant orders with a read-only backend-backed today view and status filters.

**Independent Test**: Opening the merchant orders screen shows only today’s orders newest-first, filters `ALL`, `PROCESSING`, `COMPLETED`, and `CANCELLED` work, and the detail screen stays read-only.

### Implementation for User Story 5

- [X] T032 [P] [US5] Replace mock merchant orders with backend-backed today/filter data in `blitz-pay-merchant/src/screens/OrdersScreen.tsx` and `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrders.ts`
- [X] T033 [P] [US5] Map canonical backend order states into merchant status presentation in `blitz-pay-merchant/src/features/orders/services/orderService.ts` and `blitz-pay-merchant/src/types.ts`
- [X] T034 [US5] Implement `ALL`, `PROCESSING`, `COMPLETED`, and `CANCELLED` filters plus newest-first sorting in `blitz-pay-merchant/src/screens/OrdersScreen.tsx`
- [X] T035 [US5] Update merchant order detail to load backend order data and keep it read-only in `blitz-pay-merchant/src/screens/OrderDetailScreen.tsx` and `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`
- [X] T036 [US5] Add merchant loading, empty, and filter-state copy in `blitz-pay-merchant/src/screens/OrdersScreen.tsx` and `blitz-pay-merchant/src/lib/translations.ts`
- [X] T037 [US5] Add merchant order request, failure, and result observability in `blitz-pay-merchant/src/features/orders/services/orderService.ts` and `blitz-pay-merchant/src/screens/OrdersScreen.tsx`

**Checkpoint**: Merchant operators can inspect today’s orders from backend data without any status-edit action.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cross-app hardening and validation.

- [ ] T038 [P] Reconcile implemented shopper and merchant order contracts in `specs/011-order-payment-orchestration/contracts/orders-api.md` and `specs/011-order-payment-orchestration/quickstart.md`
- [ ] T039 Harden edge-case handling for duplicate submits, empty filters, and stale resume state in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`, `blitz-pay/src/screens/VaultScreen.tsx`, and `blitz-pay-merchant/src/screens/OrdersScreen.tsx`
- [X] T040 Run lint validation in `blitz-pay/package.json` and `blitz-pay-merchant/package.json`
- [ ] T041 Exercise the quickstart validation flows in `blitz-pay/src/screens/CheckoutScreen.tsx`, `blitz-pay/src/screens/VaultScreen.tsx`, and `blitz-pay-merchant/src/screens/OrdersScreen.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers the MVP.
- **US2 (Phase 4)**: Depends on US1 because payment handoff requires an existing created-order flow.
- **US3 (Phase 5)**: Depends on US2 because outcome tracking must resolve order-linked handoff results.
- **US4 (Phase 6)**: Depends on Foundational and benefits from US1-US3; recent-order display can start after Foundational, but resumable recovery should ship after US3.
- **US5 (Phase 7)**: Depends on Foundational only; can proceed in parallel with consumer P3 work once shared contracts exist.
- **Polish (Phase 8)**: Depends on all stories targeted for release.

### User Story Dependencies

- **US1**: No dependency on later stories; first shippable increment.
- **US2**: Requires the order reference and selected channel persistence from US1.
- **US3**: Requires order-based handoff from US2.
- **US4**: Requires shopper order reads from Foundational and should reuse the outcome model from US3 for resume behavior.
- **US5**: Independent of shopper Vault work after Foundational, but shares the backend order contract.

### Within Each User Story

- Types and route contracts before hooks and services.
- Hooks and services before screen integration.
- Screen integration before lint/manual validation.
- Observability and translation coverage must be complete before the story is considered done.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T005`, `T006`, `T007`, `T008`, and `T009` can run in parallel after `T004`.
- `T016` and `T017` can run in parallel inside US2 before `T018` and `T019`.
- `T021` and `T022` can run in parallel inside US3 before `T023`.
- `T026` and `T027` can run in parallel inside US4 before `T028`.
- `T032` and `T033` can run in parallel inside US5 before `T034`.

---

## Parallel Examples

### User Story 1

```bash
Task: "Thread merchant, branch, basket, and active payment-channel context into checkout navigation in blitz-pay/src/screens/MerchantScreen.tsx and blitz-pay/src/screens/ProductDetailScreen.tsx"
Task: "Validate required payment selection and branch-supported channels before submit in blitz-pay/src/screens/CheckoutScreen.tsx"
```

### User Story 2

```bash
Task: "Add order-based Stripe handoff request handling in blitz-pay/src/features/order-payment/services/orderPaymentService.ts and blitz-pay/src/hooks/useStripePayment.ts"
Task: "Add order-based PayPal/Braintree handoff handling in blitz-pay/src/features/order-payment/services/orderPaymentService.ts and blitz-pay/src/hooks/useBraintreePayPal.ts"
```

### User Story 3

```bash
Task: "Extend payment result domain types with order-linked outcome metadata in blitz-pay/src/lib/payments/types.ts and blitz-pay/src/lib/payments/failureReasons.ts"
Task: "Update order-aware payment polling and fallback reads in blitz-pay/src/lib/payments/paymentStatusClient.ts and blitz-pay/src/lib/payments/paymentResultTracker.ts"
```

### User Story 4

```bash
Task: "Add shopper recent-order list and resumable-order selectors in blitz-pay/src/features/order-payment/services/orderPaymentService.ts and blitz-pay/src/features/order-payment/store/orderPaymentStore.ts"
Task: "Create the shopper order detail screen and route wiring in blitz-pay/src/screens/OrderDetailScreen.tsx, blitz-pay/src/types.ts, and blitz-pay/src/navigation/AppNavigator.tsx"
```

### User Story 5

```bash
Task: "Replace mock merchant orders with backend-backed today/filter data in blitz-pay-merchant/src/screens/OrdersScreen.tsx and blitz-pay-merchant/src/features/orders/hooks/useMerchantOrders.ts"
Task: "Map canonical backend order states into merchant status presentation in blitz-pay-merchant/src/features/orders/services/orderService.ts and blitz-pay-merchant/src/types.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate that checkout now creates and preserves one order before payment starts.

### Incremental Delivery

1. Ship US1 to establish order-first checkout.
2. Add US2 to move every payment channel behind order-based orchestration.
3. Add US3 to complete order-linked payment recovery and result tracking.
4. Add US4 to expose shopper recent-order visibility and manual resume.
5. Add US5 to replace mock merchant orders with backend-backed today filters.

### Parallel Team Strategy

1. One developer owns shared contracts, types, and API access in Phases 1-2.
2. After Foundational, one developer can continue shopper checkout/payment work while another builds merchant order retrieval.
3. Vault/Tresor and merchant order UI can proceed in parallel once the shared order reads are stable.

---

## Notes

- This task list reflects the current clarified scope: three consumer payment stories, one consumer Vault/Tresor story, and one merchant orders story.
- Merchant order status mutation is intentionally excluded from this feature.
- All tasks follow the required checklist format with sequential IDs, optional `[P]` markers, and `[US#]` labels only in user-story phases.
