# Tasks: Branch Membership Access

**Input**: Design documents from `/specs/012-branch-membership-access/`
**Prerequisites**: [plan.md](/Users/mehdi/MyProject/blitz-pay-prototype/specs/012-branch-membership-access/plan.md), [spec.md](/Users/mehdi/MyProject/blitz-pay-prototype/specs/012-branch-membership-access/spec.md), [research.md](/Users/mehdi/MyProject/blitz-pay-prototype/specs/012-branch-membership-access/research.md), [data-model.md](/Users/mehdi/MyProject/blitz-pay-prototype/specs/012-branch-membership-access/data-model.md), [contracts/](/Users/mehdi/MyProject/blitz-pay-prototype/specs/012-branch-membership-access/contracts)

**Tests**: Manual validation and `npm run lint` in `blitz-pay-merchant/`. No explicit automated test tasks are included because the feature spec did not request TDD or contract-test work and the merchant app currently has no active automated test suite.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., `US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature workspace and align the merchant portal domain context with the active spec.

- [X] T001 Verify the active feature pointer and planning artifacts in `.specify/feature.json` and `specs/012-branch-membership-access/`
- [X] T002 Review and preserve durable domain language in `blitz-pay-merchant/CONTEXT.md` while keeping implementation details in `specs/012-branch-membership-access/spec.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the authorization-derived branch scope foundation that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement branch-group parsing and normalized branch-membership helpers in `blitz-pay-merchant/src/lib/auth.tsx`
- [X] T004 Extend `UserProfile` and `AuthState` with branch-membership and active-branch-scope fields in `blitz-pay-merchant/src/lib/auth.tsx`
- [X] T005 Implement active authorized branch resolution, invalidation, and retry handling in `blitz-pay-merchant/src/lib/auth.tsx`
- [X] T006 [P] Add structured observability for branch-membership resolution and active-scope failures in `blitz-pay-merchant/src/lib/auth.tsx`
- [X] T007 [P] Add German and English branch-access translation keys in `blitz-pay-merchant/src/lib/translations.ts`

**Checkpoint**: Authorization-derived branch scope is available to screens and services; user story work can now begin.

---

## Phase 3: User Story 1 - Open Only Authorized Branch Orders (Priority: P1) 🎯 MVP

**Goal**: Make the merchant orders experience use Branch Membership instead of geolocation so only authorized branch orders can be listed and opened.

**Independent Test**: Sign in with a merchant user authorized for one branch, open Orders while physically near a different branch, and verify that the list and detail flow only use the authorized branch.

### Implementation for User Story 1

- [X] T008 [US1] Refactor `blitz-pay-merchant/src/screens/OrdersScreen.tsx` to consume active authorized branch scope instead of `resolveCurrentCoordinates()` and `resolveNearbyMerchantScope()`
- [X] T009 [US1] Update `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrders.ts` to block unauthorized states and reload from active authorized branch scope
- [X] T010 [US1] Tighten order-list request handling and branch validation in `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [X] T011 [US1] Enforce active-branch-aware order detail loading in `blitz-pay-merchant/src/features/orders/hooks/useMerchantOrderDetail.ts` and `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [X] T012 [US1] Add unauthorized, missing-scope, and stale-scope order UI states in `blitz-pay-merchant/src/screens/OrdersScreen.tsx`
- [ ] T013 [US1] Run branch-authorized order validation from `specs/012-branch-membership-access/quickstart.md` and `npm run lint` in `blitz-pay-merchant/package.json`

**Checkpoint**: User Story 1 should be fully functional and independently testable.

---

## Phase 4: User Story 2 - Manage Products Within Authorized Branch Scope (Priority: P2)

**Goal**: Make product listing and editing use the authorized branch scope so product reads and writes cannot follow nearby-branch geolocation.

**Independent Test**: Sign in with a merchant user, open Products, then create and edit products while physically near another branch and verify that all product operations stay within the authorized branch.

### Implementation for User Story 2

- [X] T014 [US2] Replace geolocation-derived scope loading with active authorized branch scope in `blitz-pay-merchant/src/screens/ProductsScreen.tsx`
- [X] T015 [US2] Replace geolocation-derived scope loading with active authorized branch scope in `blitz-pay-merchant/src/screens/ProductEditScreen.tsx`
- [X] T016 [US2] Add active-branch validation helpers for product reads and writes in `blitz-pay-merchant/src/lib/merchantProducts.ts`
- [X] T017 [US2] Ensure product fetch, create, and update calls use only the active authorized branch identifiers in `blitz-pay-merchant/src/lib/merchantProducts.ts`
- [X] T018 [US2] Add unauthorized and unresolved branch blocked states for product list and product edit flows in `blitz-pay-merchant/src/screens/ProductsScreen.tsx` and `blitz-pay-merchant/src/screens/ProductEditScreen.tsx`
- [ ] T019 [US2] Run authorized-branch product validation from `specs/012-branch-membership-access/quickstart.md` and `npm run lint` in `blitz-pay-merchant/package.json`

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Understand Active Branch Scope Clearly (Priority: P3)

**Goal**: Make the active authorized branch explicit across the merchant portal so users understand that access is authorization-driven, not location-driven.

**Independent Test**: Sign in with one or more branch memberships and verify that branch-scoped screens show the active authorized branch clearly and show dedicated branch-access messaging when scope is missing or invalid.

### Implementation for User Story 3

- [X] T020 [P] [US3] Add shared branch-scope presentation and messaging helpers in `blitz-pay-merchant/src/lib/auth.tsx`
- [X] T021 [P] [US3] Update active branch scope labels and explanatory copy in `blitz-pay-merchant/src/screens/OrdersScreen.tsx`
- [X] T022 [P] [US3] Update active branch scope labels and explanatory copy in `blitz-pay-merchant/src/screens/ProductsScreen.tsx`
- [X] T023 [US3] Update branch-scope copy and invalid-scope handling in `blitz-pay-merchant/src/screens/ProductEditScreen.tsx`
- [X] T024 [US3] Reconcile branch-access messaging with durable terminology in `blitz-pay-merchant/CONTEXT.md` and `blitz-pay-merchant/src/lib/translations.ts`
- [ ] T025 [US3] Run multi-membership and zero-membership UX validation from `specs/012-branch-membership-access/quickstart.md` and `npm run lint` in `blitz-pay-merchant/package.json`

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize cross-story behavior, validation, and feature bookkeeping.

- [X] T026 [P] Review branch-access observability coverage across `blitz-pay-merchant/src/lib/auth.tsx`, `blitz-pay-merchant/src/lib/merchantProducts.ts`, and `blitz-pay-merchant/src/features/orders/services/orderService.ts`
- [X] T027 Verify final translation completeness in `blitz-pay-merchant/src/lib/translations.ts` and remove any outdated geolocation-based branch-access copy from branch-scoped screens
- [X] T028 Mark completed implementation tasks and validation notes in `specs/012-branch-membership-access/tasks.md` as work finishes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user story work.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; establishes the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and should follow User Story 1 because it reuses the same active authorized branch foundation.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and should follow User Stories 1 and 2 because it refines shared scope messaging across those screens.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational, but benefits from the active authorized branch behavior introduced in US1.
- **User Story 3 (P3)**: Can start after Foundational, but should be finalized after US1 and US2 because it refines shared branch-scope UX.

### Within Each User Story

- Active authorized branch resolution must be available before any branch-scoped screen refactor.
- Screen consumption changes should happen before final user-facing validation for that story.
- Service validation must be in place before final quickstart validation.

### Parallel Opportunities

- `T006` and `T007` can run in parallel once the auth-state shape from `T004` is understood.
- `T020`, `T021`, and `T022` can run in parallel because they touch separate concerns and files.
- Cross-cutting review work in `T026` and translation cleanup in `T027` can run in parallel during polish.

---

## Parallel Example: User Story 3

```bash
# Launch shared UX and messaging work together:
Task: "Add shared branch-scope presentation and messaging helpers in blitz-pay-merchant/src/lib/auth.tsx"
Task: "Update active branch scope labels and explanatory copy in blitz-pay-merchant/src/screens/OrdersScreen.tsx"
Task: "Update active branch scope labels and explanatory copy in blitz-pay-merchant/src/screens/ProductsScreen.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate authorized-branch orders independently

### Incremental Delivery

1. Complete Setup + Foundational to establish branch-membership-derived scope
2. Deliver User Story 1 for authorized orders
3. Deliver User Story 2 for authorized product list and edit flows
4. Deliver User Story 3 for explicit branch-scope messaging and multi-membership UX
5. Finish polish and final validation

### Suggested MVP Scope

The suggested MVP is **User Story 1 only** because it removes the highest-risk authorization issue first by preventing order access from following physical proximity.

---

## Notes

- All tasks follow the required checklist format with task ID, optional parallel marker, required story label for story phases, and explicit file paths.
- No automated test tasks are included because the specification did not request TDD and the merchant app currently relies on lint plus manual flow validation.
- Each user story remains independently testable using the validation flow captured in `specs/012-branch-membership-access/quickstart.md`.
- Manual validation tasks `T013`, `T019`, and `T025` remain open because the feature was not exercised in an Expo simulator/device during this implementation run.
