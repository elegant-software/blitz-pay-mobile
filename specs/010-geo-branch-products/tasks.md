# Tasks: Geo Branch Products

**Input**: Design documents from `/specs/010-geo-branch-products/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The feature spec does not require a TDD-first workflow, so this task list emphasizes implementation plus lint/manual validation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared navigation and translation scaffolding used by the feature

- [X] T001 Add branch product management navigation params in `blitz-pay/src/types.ts`
- [X] T002 [P] Add German and English branch product management copy in `blitz-pay/src/lib/translations.ts`
- [X] T003 [P] Create product draft state scaffolding in `blitz-pay/src/features/merchant-catalog/store/productDraftStore.ts` and `blitz-pay/src/features/merchant-catalog/hooks/useProductDraft.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared merchant-catalog domain and services before story work begins

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [X] T004 Extend catalog domain models for nearby merchant context, branch sessions, product drafts, and mutation payloads in `blitz-pay/src/features/merchant-catalog/types/catalog.ts`
- [X] T005 Implement observed branch product API helpers for product detail, create, and update flows in `blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts`
- [X] T006 Update merchant catalog orchestration to expose branch session status, refresh controls, and blocked-state metadata in `blitz-pay/src/features/merchant-catalog/hooks/useMerchantCatalog.ts`
- [X] T007 Standardize merchant-catalog observability and remove raw debug logging in `blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts` and `blitz-pay/src/screens/MerchantScreen.tsx`

**Checkpoint**: Shared mobile catalog infrastructure is ready for independently testable story implementation

---

## Phase 3: User Story 1 - Resolve Branch Product Scope (Priority: P1) 🎯 MVP

**Goal**: Resolve one nearby merchant branch before exposing any branch product operations

**Independent Test**: Open the nearby-merchant product flow with a resolvable merchant and confirm the app selects one active branch, shows the branch name as primary context, and blocks product management when no branch can be resolved

### Implementation for User Story 1

- [X] T008 [US1] Update nearby merchant handoff to preserve merchant identity for branch product management in `blitz-pay/src/screens/ExploreScreen.tsx` and `blitz-pay/src/screens/MerchantScreen.tsx`
- [X] T009 [US1] Implement branch resolution, retry, and blocked-state presentation in `blitz-pay/src/screens/MerchantScreen.tsx`
- [X] T010 [US1] Surface branch resolution errors and no-branch messaging in `blitz-pay/src/screens/MerchantScreen.tsx` and `blitz-pay/src/lib/translations.ts`

**Checkpoint**: User Story 1 is functional when the app can reliably resolve or block branch-scoped product management from nearby merchant context

---

## Phase 4: User Story 2 - Review Branch Product Catalog (Priority: P2)

**Goal**: Show only the resolved branch's products with clear branch context and graceful empty/image fallback behavior

**Independent Test**: After branch resolution, open the merchant product view and verify the list contains only products for that branch, preserves branch context in empty states, and opens read-only product details without mixing other branches

### Implementation for User Story 2

- [X] T011 [P] [US2] Refine branch-only product list presentation and grouping in `blitz-pay/src/screens/MerchantScreen.tsx`
- [X] T012 [P] [US2] Extend branch-scoped read-only product detail presentation in `blitz-pay/src/screens/ProductDetailScreen.tsx`
- [X] T013 [US2] Add empty-state, missing-image, and unavailable-metadata fallback behavior in `blitz-pay/src/screens/MerchantScreen.tsx` and `blitz-pay/src/screens/ProductDetailScreen.tsx`

**Checkpoint**: User Story 2 is functional when operators can review the resolved branch catalog independently of create/update workflows

---

## Phase 5: User Story 3 - Add Branch Products (Priority: P3)

**Goal**: Allow operators to create a new product inside the resolved branch without leaving the nearby-merchant flow

**Independent Test**: With a resolved editable branch, launch the add-product flow, submit required fields, and verify the new product appears in the same branch list; invalid input must block save without clearing the draft

### Implementation for User Story 3

- [X] T014 [P] [US3] Implement create-mode draft actions, validation state, and branch locking in `blitz-pay/src/features/merchant-catalog/store/productDraftStore.ts` and `blitz-pay/src/features/merchant-catalog/hooks/useProductDraft.ts`
- [X] T015 [P] [US3] Add branch product create request mapping and multipart payload handling in `blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts`
- [X] T016 [US3] Create the add-product screen flow in `blitz-pay/src/screens/ProductEditorScreen.tsx` and register it in `blitz-pay/src/types.ts`
- [X] T017 [US3] Launch the add-product flow and refresh the resolved branch catalog after save in `blitz-pay/src/screens/MerchantScreen.tsx`
- [X] T018 [US3] Add create-flow validation, blocked-branch messaging, and success/failure copy in `blitz-pay/src/screens/ProductEditorScreen.tsx` and `blitz-pay/src/lib/translations.ts`

**Checkpoint**: User Story 3 is functional when operators can add a new product to the active branch and immediately see it in the refreshed branch catalog

---

## Phase 6: User Story 4 - Update Branch Products (Priority: P4)

**Goal**: Allow operators to edit an existing branch product with stale-context protection and draft preservation on failure

**Independent Test**: Open an existing branch product, launch the edit flow with prefilled values, save a valid update, and verify the branch catalog refreshes; stale branch/product state must block silent overwrite

### Implementation for User Story 4

- [X] T019 [P] [US4] Extend draft state for update-mode prefills, dirty tracking, and retry preservation in `blitz-pay/src/features/merchant-catalog/store/productDraftStore.ts` and `blitz-pay/src/features/merchant-catalog/hooks/useProductDraft.ts`
- [X] T020 [P] [US4] Add product detail fetch, update submission, and stale-data conflict handling in `blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts`
- [X] T021 [US4] Wire branch product edit entry from `blitz-pay/src/screens/ProductDetailScreen.tsx` into `blitz-pay/src/screens/ProductEditorScreen.tsx` and update navigation types in `blitz-pay/src/types.ts`
- [X] T022 [US4] Implement update submit, retry, and refresh-required UX in `blitz-pay/src/screens/ProductEditorScreen.tsx` and `blitz-pay/src/features/merchant-catalog/hooks/useMerchantCatalog.ts`
- [X] T023 [US4] Refresh merchant and product detail views after successful updates in `blitz-pay/src/screens/MerchantScreen.tsx` and `blitz-pay/src/screens/ProductDetailScreen.tsx`

**Checkpoint**: User Story 4 is functional when operators can safely update an existing branch product and see the saved result without stale overwrites

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish validation, cleanup, and end-to-end verification across all stories

- [X] T024 [P] Finalize request/failure/result observability coverage for branch resolution and product mutations in `blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts`, `blitz-pay/src/features/merchant-catalog/hooks/useMerchantCatalog.ts`, and `blitz-pay/src/screens/ProductEditorScreen.tsx`
- [X] T025 [P] Clean up copy, navigation labels, and temporary debug remnants in `blitz-pay/src/lib/translations.ts`, `blitz-pay/src/screens/MerchantScreen.tsx`, `blitz-pay/src/screens/ProductDetailScreen.tsx`, and `blitz-pay/src/screens/ProductEditorScreen.tsx`
- [ ] T026 Run quickstart validation and type checks using `specs/010-geo-branch-products/quickstart.md` and `blitz-pay/package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies, can start immediately
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all story work
- **Phase 3: US1**: Depends on Phase 2 and is the MVP entry point
- **Phase 4: US2**: Depends on US1 because branch resolution and branch context display must exist first
- **Phase 5: US3**: Depends on US1 and US2 because creation happens inside the resolved branch catalog experience
- **Phase 6: US4**: Depends on US2 and US3 because it reuses the branch-scoped editor flow and refreshed catalog state
- **Phase 7: Polish**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1**: No dependency on other user stories after Foundational
- **US2**: Depends on US1 branch resolution and blocked-state handling
- **US3**: Depends on US1 branch scope and US2 catalog visibility
- **US4**: Depends on US2 catalog review and US3 editor/create flow scaffolding

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`
- `T011` and `T012` can run in parallel within US2
- `T014` and `T015` can run in parallel within US3
- `T019` and `T020` can run in parallel within US4
- `T024` and `T025` can run in parallel during polish

---

## Parallel Example: User Story 3

```bash
Task: "Implement create-mode draft actions, validation state, and branch locking in blitz-pay/src/features/merchant-catalog/store/productDraftStore.ts and blitz-pay/src/features/merchant-catalog/hooks/useProductDraft.ts"
Task: "Add branch product create request mapping and multipart payload handling in blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts"
```

---

## Parallel Example: User Story 4

```bash
Task: "Extend draft state for update-mode prefills, dirty tracking, and retry preservation in blitz-pay/src/features/merchant-catalog/store/productDraftStore.ts and blitz-pay/src/features/merchant-catalog/hooks/useProductDraft.ts"
Task: "Add product detail fetch, update submission, and stale-data conflict handling in blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate nearby merchant branch resolution and blocked states before expanding scope

### Incremental Delivery

1. Finish Setup + Foundational to stabilize the shared mobile catalog layer
2. Deliver US1 to establish correct branch scope
3. Deliver US2 to make the branch catalog independently reviewable
4. Deliver US3 to add branch-scoped creation
5. Deliver US4 to complete safe update behavior
6. Finish with observability, cleanup, and quickstart validation

### Parallel Team Strategy

1. One developer completes Phase 1 and Phase 2
2. After US1 lands, a second developer can take US2 while another prepares US3 service/store work
3. After US3 editor scaffolding lands, US4 can proceed in parallel with polish preparation

---

## Notes

- All tasks follow the required checklist format with task ID, optional parallel marker, story label where required, and exact file paths
- The suggested MVP scope is **User Story 1** only
- Keep new user-facing copy in both German and English
- Preserve MVVM separation: screens/components for UI, hooks for orchestration, services for API/data mapping
