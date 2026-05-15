# Implementation Plan: Pay Later Order Collaboration

**Branch**: `013-pay-later-order-collaboration` | **Date**: 2026-05-15 | **Spec**: [specs/013-pay-later-order-collaboration/spec.md](spec.md)
**Input**: Feature specification from `/specs/013-pay-later-order-collaboration/spec.md`

## Summary

Extend the existing order-payment experience in `blitz-pay/` and `blitz-pay-merchant/` so a merchant-wide delayed-payment capability produces a dual checkout choice (`Pay now` / `Pay later`), shared unpaid-order editing across both apps, merchant manual settlement, and richer order-state presentation. The implementation keeps payment initiation in `blitz-pay/`, adds collaboration and state refresh behavior around unpaid orders, and upgrades merchant order visibility from read-only status review into operational unpaid-order management.

## Technical Context

**Language/Version**: TypeScript 5.3, React 19.2, React Native 0.83.6, Expo SDK 55  
**Primary Dependencies**: Expo, React Navigation 6, `expo-secure-store`, existing `authedFetch` wrappers, existing TrueLayer / Stripe / Braintree integrations, existing observability helpers, existing order-payment and merchant-orders feature modules  
**Storage**: Backend order/payment APIs; `expo-secure-store` for auth session and in-flight payment persistence; controlled in-memory feature stores for basket, order session, and merchant order detail state  
**Testing**: `npm run lint` in `blitz-pay/` and `blitz-pay-merchant/`; targeted manual validation in Expo simulator/web for checkout, order detail, Tresor, and merchant orders  
**Target Platform**: Expo mobile apps for iOS, Android, and web (`blitz-pay/` and `blitz-pay-merchant/`)  
**Project Type**: Dual mobile-app frontend feature spanning consumer and merchant apps  
**Performance Goals**: Delayed-payment checkout choice renders without perceptible lag; unpaid-order edits reflect in the active order detail on next refresh; merchant and shopper order detail surfaces keep the latest order state visible without requiring full app restart  
**Constraints**: Money-path observability on request/failure/result boundaries; no PII in logs; i18n strings in both German and English; architecture must stay feature-based + MVVM + controlled state; payment remains startable only from `blitz-pay/`; no new push/reminder workflow in this version  
**Scale/Scope**: One shared order lifecycle, two checkout timing choices, shopper recovery through Tresor, merchant operational follow-up, and synchronized order detail behavior across both apps

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Money-path observability preserved: delayed-payment checkout, unpaid-order mutation reads, manual settlement refresh, and payment retry paths must keep request/failure/result logging and log raw provider/backend reasons before UI mapping.
- [x] Env/config single source of truth preserved: payment-provider environment config stays in existing config modules; this feature adds no inline provider environment switching.
- [x] Architecture pattern preserved: consumer work remains in feature/viewmodel/service/store slices under `blitz-pay/src/features/`; merchant work remains under dedicated merchant orders feature modules rather than embedding backend calls directly in screens.
- [x] i18n rule acknowledged: all new shopper and merchant strings for checkout intent, order state, payment source, banners, and manual settlement must land in both `de` and `en`.
- [x] Product targeting is explicit: shopper flows change in `blitz-pay/`; operator flows change in `blitz-pay-merchant/`.

## Project Structure

### Documentation (this feature)

```text
specs/013-pay-later-order-collaboration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── order-collaboration.md
└── tasks.md
```

### Source Code (repository root)

```text
blitz-pay/
├── src/
│   ├── features/
│   │   ├── basket/
│   │   ├── merchant-catalog/
│   │   └── order-payment/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── store/
│   │       └── types/
│   ├── lib/
│   │   ├── notifications/
│   │   ├── payments/
│   │   ├── translations.ts
│   │   └── observability.ts
│   └── screens/
│       ├── CheckoutScreen.tsx
│       ├── OrderDetailScreen.tsx
│       ├── PaymentProcessingScreen.tsx
│       ├── PaymentResultScreen.tsx
│       ├── PaymentPendingScreen.tsx
│       └── VaultScreen.tsx
└── package.json

blitz-pay-merchant/
├── src/
│   ├── features/
│   │   └── orders/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── observability.ts
│   │   └── translations.ts
│   └── screens/
│       ├── OrderDetailScreen.tsx
│       └── OrdersScreen.tsx
└── package.json
```

**Structure Decision**: Keep consumer delayed-payment behavior inside the existing `blitz-pay/src/features/order-payment/` slice and related screens, while extending `blitz-pay-merchant/src/features/orders/` to cover unpaid-order collaboration and manual settlement. Shared contract assumptions for the apps live in `specs/013-pay-later-order-collaboration/contracts/order-collaboration.md`; no new shared runtime package is required.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
