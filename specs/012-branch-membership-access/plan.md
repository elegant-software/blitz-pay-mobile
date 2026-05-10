# Implementation Plan: Branch Membership Access

**Branch**: `012-branch-membership-access` | **Date**: 2026-05-11 | **Spec**: [spec.md](/Users/mehdi/MyProject/blitz-pay-prototype/specs/012-branch-membership-access/spec.md)
**Input**: Feature specification from `/specs/012-branch-membership-access/spec.md`

## Summary

Replace geolocation-derived branch scope with authorization-derived branch scope in the merchant portal so orders, product listing, and product editing use `Branch Membership` from authenticated claims as the source of truth. The implementation will extend the existing auth, orders, and merchant-products flows in `blitz-pay-merchant/`, introduce a single active authorized branch scope for the session, and keep durable terminology in `CONTEXT.md`.

## Technical Context

**Language/Version**: TypeScript 5.3, React 19.2, React Native 0.83.6, Expo SDK 55  
**Primary Dependencies**: Expo Secure Store, React Navigation 6, existing auth provider in `src/lib/auth.tsx`, existing observability helper, existing merchant orders and product service modules  
**Storage**: Expo Secure Store for session persistence; controlled in-memory state for authenticated user and active authorized branch scope  
**Testing**: `npm run lint` in `blitz-pay-merchant`, plus manual validation in Expo simulator/device; no real automated merchant test suite is currently configured  
**Target Platform**: iOS and Android Expo mobile app (`blitz-pay-merchant`)  
**Project Type**: Mobile app  
**Performance Goals**: Authorized branch scope should resolve during app/session initialization fast enough that branch-scoped screens remain immediately usable; orders and products should continue to load within the current mobile flow without introducing extra user wait states beyond current network-bound fetches  
**Constraints**: Branch Membership is the only access source for branch-scoped merchant data, geolocation must not grant access, German-default i18n with `de` and `en`, no token or PII leakage in logs, preserve Feature-Based + MVVM + Controlled State Management separation, no speculative abstraction layer  
**Scale/Scope**: One merchant portal app, one active authorized branch at a time, branch-scoped orders plus product view/create/update flows, no consumer-app changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **App targeting**: Scope is merchant-facing and stays in `blitz-pay-merchant/`, matching Constitution IX and business guidelines. Pass.
- **Architecture**: Changes must keep screen rendering in `src/screens`, orchestration in hooks/provider state, and backend access in service/lib modules. The plan extends existing auth/orders/product flows rather than moving logic into screens. Pass.
- **Observability**: Merchant-related backend calls already use structured logs in orders and products. New branch-membership resolution and authorization failures must preserve that standard without logging raw tokens or sensitive claims. Pass with explicit instrumentation requirement.
- **Security**: Access tokens remain in Expo Secure Store; branch parsing must avoid exposing raw token values in logs or UI. Pass.
- **i18n**: New branch-access and unauthorized-state strings must be added in both `de` and `en`. Pass.
- **Simplicity**: Reuse existing auth context and merchant service modules instead of creating a parallel authorization framework. Pass.
- **Native config**: No Android/iOS native changes are planned. Pass.

**Post-Design Re-Check**: Phase 1 artifacts keep the feature within the existing merchant app, introduce a single active authorized branch scope, preserve MVVM separation, and require observability and i18n for new user-visible flows. No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/012-branch-membership-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── branch-membership-access-ui.md
│   └── branch-membership-claims.md
└── tasks.md
```

### Source Code (repository root)

```text
blitz-pay-merchant/
├── CONTEXT.md
├── src/
│   ├── features/
│   │   └── orders/
│   │       ├── hooks/
│   │       │   ├── useMerchantOrderDetail.ts
│   │       │   └── useMerchantOrders.ts
│   │       ├── services/
│   │       │   └── orderService.ts
│   │       └── types/
│   │           └── order.ts
│   ├── lib/
│   │   ├── auth.tsx
│   │   ├── merchantProducts.ts
│   │   ├── observability.ts
│   │   └── translations.ts
│   ├── screens/
│   │   ├── OrderDetailScreen.tsx
│   │   ├── OrdersScreen.tsx
│   │   ├── ProductEditScreen.tsx
│   │   └── ProductsScreen.tsx
│   └── types.ts
└── package.json
```

**Structure Decision**: Implement inside the existing merchant portal code paths. Auth claim parsing and active branch resolution belong in `src/lib/auth.tsx` or an adjacent merchant-access helper, orders remain under `src/features/orders`, product fetching/mutation remains in `src/lib/merchantProducts.ts`, and screens consume an authorization-derived active branch scope instead of resolving nearby merchant scope locally.

## Complexity Tracking

No constitution exceptions or justified complexity deviations are required at planning time.
