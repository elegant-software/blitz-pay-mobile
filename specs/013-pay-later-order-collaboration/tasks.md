# Tasks: Pay Later Order Collaboration

**Input**: Design documents from `/specs/013-pay-later-order-collaboration/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual validation and `npm run lint` are required by the plan; no separate automated test-writing tasks are generated because the specification did not explicitly request TDD or new automated test coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Consumer app: `blitz-pay/src/`
- Merchant app: `blitz-pay-merchant/src/`
- Feature docs: `specs/013-pay-later-order-collaboration/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature scaffolding and documentation touchpoints shared by both apps.

- [ ] T001 Update feature tracking references and local spec pointers in `.specify/feature.json` and `specs/013-pay-later-order-collaboration/quickstart.md`
- [X] T002 [P] Review and align existing order-payment and merchant-orders translation keys in `blitz-pay/src/lib/translations.ts` and `blitz-pay-merchant/src/lib/translations.ts`
- [X] T003 [P] Inventory current order-payment and merchant-order feature entry points in `blitz-pay/src/features/order-payment/` and `blitz-pay-merchant/src/features/orders/` for planned touchpoints

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, state, and service contracts that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define shared consumer order collaboration types in `blitz-pay/src/features/order-payment/types/orderPayment.ts`
- [X] T005 [P] Define merchant order collaboration and manual-settlement types in `blitz-pay-merchant/src/features/orders/types/order.ts`
- [X] T006 Extend consumer order-payment service parsing and request helpers for checkout intent, payment source, and unpaid-order mutation payloads in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts`
- [X] T007 Extend merchant order service parsing and mutation helpers for awaiting-payment, payment-failed, checkout intent, and manual settlement in `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [X] T008 Update consumer order-payment store shape for collaborative unpaid-order state, banners, and retry metadata in `blitz-pay/src/features/order-payment/store/orderPaymentStore.ts`
- [X] T009 Add or extend merchant order detail/viewmodel state for collaborative refresh and settlement actions in `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`
- [X] T010 Add foundational i18n keys for checkout timing, collaboration banners, manual settlement, payment source, and merchant unpaid states in `blitz-pay/src/lib/translations.ts` and `blitz-pay-merchant/src/lib/translations.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Choose Pay Now Or Pay Later At Checkout (Priority: P1) 🎯 MVP

**Goal**: Surface delayed-payment capability in checkout, default to `Pay later`, and route `Pay now` / `Pay later` through the correct immediate next screens.

**Independent Test**: Open checkout for a delayed-payment merchant, verify both timing choices appear with `Pay later` preselected, confirm `Pay later` lands on order detail with `OrderId`, and confirm `Pay now` still reaches the payment-result path.

- [X] T011 [US1] Extend checkout viewmodel orchestration for `Pay now` and `Pay later` timing choices in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`
- [X] T012 [US1] Update checkout UI to render delayed-payment capability and default `Pay later` selection in `blitz-pay/src/screens/CheckoutScreen.tsx`
- [X] T013 [US1] Route successful `Pay later` order creation to order detail and keep successful `Pay now` routed through result/progress screens in `blitz-pay/src/screens/CheckoutScreen.tsx`
- [X] T014 [P] [US1] Show `OrderId` immediately in consumer order detail and payment result surfaces in `blitz-pay/src/screens/OrderDetailScreen.tsx` and `blitz-pay/src/screens/PaymentResultScreen.tsx`
- [X] T015 [US1] Add request/failure/result observability for checkout-intent selection and delayed-payment order creation in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts` and `blitz-pay/src/screens/CheckoutScreen.tsx`

**Checkpoint**: User Story 1 should be independently functional and demonstrable

---

## Phase 4: User Story 2 - Collaborate On An Unpaid Order Before Payment Starts (Priority: P1)

**Goal**: Let shopper and merchant edit the same unpaid order before payment starts, including item changes, merchant repricing, and cross-app update banners.

**Independent Test**: Create a `Pay later` order, open it in both apps, change items from each side before payment starts, and verify the order updates in place with the correct visible non-blocking banner.

- [ ] T016 [US2] Implement consumer unpaid-order mutation actions and remote-refresh handling in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`
- [ ] T017 [US2] Update consumer order detail UI for add/remove/change item flows, line-level repricing display, and merchant-attributed banners in `blitz-pay/src/screens/OrderDetailScreen.tsx`
- [ ] T018 [US2] Implement merchant unpaid-order mutation actions, line price override, and shopper-refresh handling in `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`
- [ ] T019 [US2] Update merchant order detail UI for add/remove/change item flows, manual price override entry, and shopper-attributed banners in `blitz-pay-merchant/src/screens/OrderDetailScreen.tsx`
- [ ] T020 [P] [US2] Extend consumer and merchant order services to support add-item, quantity-change, remove-item, and cancel requests in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts` and `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [ ] T021 [US2] Ensure edit blocking when payment is in progress and final-line removal becomes cancellation in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts` and `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`
- [ ] T022 [US2] Add observability for unpaid-order edits, price overrides, remote refreshes, and edit-block rejections in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`, `blitz-pay/src/screens/OrderDetailScreen.tsx`, `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`, and `blitz-pay-merchant/src/features/orders/services/orderService.ts`

**Checkpoint**: User Stories 1 and 2 should both work independently

---

## Phase 5: User Story 3 - Manage Unpaid Order Outcomes Across Both Apps (Priority: P2)

**Goal**: Support cancellation, failed-payment recovery semantics, manual settlement, and paid-order locking consistently across consumer and merchant apps.

**Independent Test**: Cancel an unpaid order, fail a `Pay now` attempt, manually settle a qualifying unpaid order, and confirm both apps reflect the same active state and remove edit/payment actions as required.

- [ ] T023 [US3] Implement shopper and merchant unpaid-order cancellation flows in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`, `blitz-pay/src/screens/OrderDetailScreen.tsx`, `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`, and `blitz-pay-merchant/src/screens/OrderDetailScreen.tsx`
- [ ] T024 [US3] Implement merchant manual-settlement action flow and optional note capture in `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts` and `blitz-pay-merchant/src/screens/OrderDetailScreen.tsx`
- [ ] T025 [P] [US3] Present payment source and manual-settlement meaning on paid orders in `blitz-pay/src/screens/OrderDetailScreen.tsx`, `blitz-pay/src/screens/PaymentResultScreen.tsx`, and `blitz-pay-merchant/src/screens/OrderDetailScreen.tsx`
- [ ] T026 [US3] Lock consumer and merchant order-edit actions after successful app payment or manual settlement in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts` and `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`
- [ ] T027 [US3] Handle active-screen refresh to paid/cancelled states when merchant cancellation or manual settlement occurs in `blitz-pay/src/screens/OrderDetailScreen.tsx` and `blitz-pay/src/features/order-payment/store/orderPaymentStore.ts`
- [ ] T028 [US3] Add observability for cancellation, manual settlement, state-lock enforcement, and payment-source presentation in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts` and `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts`

**Checkpoint**: User Stories 1 through 3 should now be independently functional

---

## Phase 6: User Story 4 - Resume And Pay Later From Tresor (Priority: P2)

**Goal**: Let shoppers reopen unpaid or failed orders from Tresor, see the latest state, and continue payment with the right retry behavior.

**Independent Test**: Reopen a `Pay later` order and a failed `Pay now` order from Tresor, verify latest-state-only display, payment-action availability, and retry payment-method preference behavior.

- [ ] T029 [US4] Extend recent-order mapping and resume metadata handling in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts`
- [ ] T030 [US4] Update Tresor order list and resume actions for delayed-payment and failed-payment states in `blitz-pay/src/screens/VaultScreen.tsx`
- [ ] T031 [US4] Preserve failed `Pay now` context and preferred last payment method on retry in `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts` and `blitz-pay/src/lib/payments/paymentResultTracker.ts`
- [ ] T032 [US4] Ensure reopened orders show latest state only, with no history comparison gate, in `blitz-pay/src/screens/OrderDetailScreen.tsx`
- [ ] T033 [US4] Add observability for Tresor reopen, retry-selection, and resume-state refresh in `blitz-pay/src/screens/VaultScreen.tsx` and `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`

**Checkpoint**: User Stories 1 through 4 should now work independently

---

## Phase 7: User Story 5 - Give Merchant Operators Operational Visibility And Control (Priority: P3)

**Goal**: Surface delayed-payment orders immediately in the merchant app and expose the order-state, checkout-intent, and payment-source context operators need for follow-up.

**Independent Test**: Create `Pay later`, failed `Pay now`, paid, and manually settled orders and verify merchant list/detail screens show `OrderId`, awaiting-payment vs failed-payment meaning, checkout intent in detail, and payment source on paid orders.

- [X] T034 [US5] Update merchant order list mapping and filtering for delayed-payment visibility, awaiting-payment meaning, and payment-failed meaning in `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [X] T035 [US5] Update merchant orders list UI to show immediate `Pay later` arrivals and the new unpaid-state distinctions in `blitz-pay-merchant/src/screens/OrdersScreen.tsx`
- [X] T036 [US5] Present checkout intent and payment source in merchant order detail without expanding list-level noise in `blitz-pay-merchant/src/screens/OrderDetailScreen.tsx`
- [X] T037 [US5] Remove the earlier read-only assumption from merchant order flow behavior where it conflicts with unpaid-order collaboration in `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts` and related merchant order UI
- [X] T038 [US5] Add observability for merchant order list state-mapping and manual follow-up surfaces in `blitz-pay-merchant/src/features/orders/services/orderService.ts` and `blitz-pay-merchant/src/screens/OrdersScreen.tsx`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-story cleanup affecting both apps.

- [X] T039 [P] Run `npm run lint` in `blitz-pay/` and fix any consumer app type or lint issues
- [X] T040 [P] Run `npm run lint` in `blitz-pay-merchant/` and fix any merchant app type or lint issues
- [ ] T041 Validate the delayed-payment quickstart scenarios manually across both apps using `specs/013-pay-later-order-collaboration/quickstart.md`
- [ ] T042 Review i18n coverage, observability calls, and order-state wording across both apps in `blitz-pay/src/lib/translations.ts`, `blitz-pay-merchant/src/lib/translations.ts`, and touched order/payment flows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phases 3-7)**: Depend on Foundational completion
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; defines the checkout timing entry point
- **User Story 2 (P1)**: Starts after Foundational; depends on shared order types/services but is otherwise independently testable from US1 once unpaid order creation exists
- **User Story 3 (P2)**: Depends on the collaborative unpaid-order foundation from US2
- **User Story 4 (P2)**: Depends on order state and retry metadata from US1 and US3
- **User Story 5 (P3)**: Depends on merchant order service/state extensions from Foundational and uses outcomes established in US2-US3

### Within Each User Story

- Service and store updates precede dependent screen wiring
- Consumer and merchant tasks touching the same runtime files stay sequential
- Cross-app state/presentation checks happen after the underlying mutation logic exists

### Parallel Opportunities

- T002 and T003 can run in parallel
- T004 and T005 can run in parallel
- T020 consumer and merchant service changes can be implemented in parallel if coordinated by file boundary
- T025 paid-order presentation tasks can be split across consumer and merchant files in parallel
- T039 and T040 can run in parallel

---

## Parallel Example: User Story 2

```bash
# Parallel service/type work once foundational context is ready:
Task: "Define merchant order collaboration and manual-settlement types in blitz-pay-merchant/src/features/orders/types/order.ts"
Task: "Define shared consumer order collaboration types in blitz-pay/src/features/order-payment/types/orderPayment.ts"

# Parallel paid-state presentation tasks later:
Task: "Present payment source and manual-settlement meaning on paid orders in blitz-pay/src/screens/OrderDetailScreen.tsx and blitz-pay/src/screens/PaymentResultScreen.tsx"
Task: "Present payment source alongside current state in blitz-pay-merchant/src/screens/OrderDetailScreen.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm delayed-payment checkout choice and the two immediate landing flows work

### Incremental Delivery

1. Finish Setup + Foundational
2. Deliver User Story 1 for visible checkout timing choice
3. Add User Story 2 for unpaid-order collaboration
4. Add User Story 3 for cancellation/manual settlement and paid locking
5. Add User Story 4 for Tresor recovery and retry
6. Add User Story 5 for merchant operational visibility polish

### Parallel Team Strategy

With multiple developers after Foundational:

1. Developer A: consumer checkout and Tresor work (US1, US4)
2. Developer B: consumer and merchant collaborative order detail flows (US2, US3)
3. Developer C: merchant list/detail operational visibility polish (US5)

---

## Notes

- [P] tasks touch different files or app targets and can be coordinated in parallel
- User story labels map directly to the feature spec for traceability
- The backend contract dependencies described in `contracts/order-collaboration.md` are assumed available or mocked during frontend implementation
- Manual validation remains mandatory because this feature changes active shopper and merchant flows across both apps
