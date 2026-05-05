# Implementation Plan: Order Payment Orchestration

**Branch**: `011-order-payment-orchestration` | **Date**: 2026-05-01 | **Spec**: [specs/011-order-payment-orchestration/spec.md](spec.md)
**Input**: Feature specification from `/specs/011-order-payment-orchestration/spec.md`

## Summary

Complete the order-first payment flow in the consumer app and extend the same order lifecycle into order-history surfaces for both products. In `blitz-pay/`, checkout, payment recovery, and Vault/Tresor must consistently create, read, and resume backend-owned orders. In `blitz-pay-merchant/`, the orders screen must stop relying on local mock data and render today’s backend orders with read-only detail access and status filters.

## Technical Context

**Language/Version**: TypeScript 5.3, React 19.2, React Native 0.83.6, Expo SDK 55  
**Primary Dependencies**: Expo, React Navigation 6, `expo-secure-store`, existing `authedFetch` wrappers, existing TrueLayer / Stripe / Braintree integrations, existing observability helpers  
**Storage**: Backend order/payment APIs; `expo-secure-store` for auth session and in-flight payment persistence; in-memory feature stores for checkout and order session state  
**Testing**: `npm run lint` in `blitz-pay/` and `blitz-pay-merchant/`; targeted manual validation in Expo simulator/web for checkout, Vault/Tresor, and merchant orders  
**Target Platform**: Expo mobile apps for iOS, Android, and web (`blitz-pay/` and `blitz-pay-merchant/`)  
**Project Type**: Dual mobile-app frontend feature spanning consumer and merchant apps  
**Performance Goals**: Order creation or validation failure returned within 30 seconds; recent/today order lists render without perceptible delay for normal daily merchant volume; payment recovery preserves existing order instead of duplicate creation  
**Constraints**: No direct provider start before order creation; money-path observability at request/failure/result boundaries; no PII in logs; i18n strings in both German and English; merchant orders remain read-only in this feature; architecture must stay feature-based + MVVM + controlled state  
**Scale/Scope**: One shared backend order lifecycle, three consumer surfaces (`CheckoutScreen`, `VaultScreen`, payment result/progress), and one merchant order management surface (`OrdersScreen`, `OrderDetailScreen`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Money-path observability preserved: consumer order creation, payment handoff, order fetch, and payment status lookup already use `observability`; any new order read/resume paths must keep request/failure/result logging and include raw provider/backend reasons before UI mapping.
- [x] Env/config single source of truth preserved: payment provider configuration remains in existing config modules; this feature adds no inline provider environment switching.
- [x] Architecture pattern preserved: consumer work stays in `features/order-payment`, `features/basket`, `features/merchant-catalog`, and screen/viewmodel/service boundaries; merchant work introduces a dedicated orders feature/service path rather than embedding backend calls directly in screens.
- [x] i18n rule acknowledged: new Vault/Tresor and merchant order strings must land in both `de` and `en` translation maps.
- [x] Product targeting is explicit: shopper flows change in `blitz-pay/`; operator flows change in `blitz-pay-merchant/`.

## Project Structure

### Documentation (this feature)

```text
specs/011-order-payment-orchestration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── orders-api.md
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
│   │   └── payments/
│   └── screens/
│       ├── CheckoutScreen.tsx
│       ├── PaymentProcessingScreen.tsx
│       ├── PaymentResultScreen.tsx
│       └── VaultScreen.tsx
└── package.json

blitz-pay-merchant/
├── src/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── merchantProducts.ts
│   │   ├── observability.ts
│   │   └── translations.ts
│   ├── navigation/
│   │   └── AppNavigator.tsx
│   ├── screens/
│   │   ├── OrderDetailScreen.tsx
│   │   └── OrdersScreen.tsx
│   └── types.ts
└── package.json
```

**Structure Decision**: Keep consumer order orchestration inside the existing `blitz-pay/src/features/order-payment/` slice and add merchant order retrieval through a dedicated merchant-side service/viewmodel path. Shared backend contract decisions live only in `specs/011-order-payment-orchestration/contracts/orders-api.md`; no new shared runtime package is needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
