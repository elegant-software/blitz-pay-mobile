# Implementation Plan: Geo Branch Products

**Branch**: `010-nearby-merchant-product-management` | **Date**: 2026-04-30 | **Spec**: [spec.md](/Users/mehdi/MyProject/blitz-pay-prototype/specs/010-geo-branch-products/spec.md)
**Input**: Feature specification from `/specs/010-geo-branch-products/spec.md`

## Summary

Add a geolocation-driven product-management flow to the `blitz-pay` mobile app so the product page resolves one nearby merchant branch, loads only that branch's catalog, and supports branch-scoped product viewing, adding, and updating using the existing merchant-commerce API and the repo's feature-based MVVM structure.

## Technical Context

**Language/Version**: TypeScript 5.3, React 19.2, React Native 0.83.6, Expo SDK 55  
**Primary Dependencies**: React Navigation 6, Expo Location, Expo Secure Store, existing `fetchMerchantCommerceJson` API wrapper, existing `merchant-catalog` and `basket` feature modules  
**Storage**: Expo Secure Store for auth/session state; controlled in-memory feature state for merchant branch context, product drafts, and basket state  
**Testing**: `npm run lint`, `npm test`, targeted mobile flow validation in Expo simulator/device  
**Target Platform**: iOS and Android Expo mobile app (`blitz-pay`)  
**Project Type**: Mobile app  
**Performance Goals**: Nearby branch context should resolve quickly enough to support the spec goal of branch confirmation within 20 seconds; product list refresh after create/update should feel immediate in-session  
**Constraints**: Geolocation-first merchant discovery, single active branch scope, no cross-branch product mixing, German-default i18n with `de` and `en`, no PII/secrets in logs, preserve MVVM layer separation, avoid speculative abstractions  
**Scale/Scope**: One consumer mobile feature area, one merchant branch at a time, branch-scoped product viewing plus add/update operations only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Architecture**: Must stay inside the Feature-Based + MVVM + Controlled State Management pattern from [docs/architecture.md](/Users/mehdi/MyProject/blitz-pay-prototype/docs/architecture.md). Product-management UI belongs in screens/components, orchestration in hooks, and API/data mapping in services. Pass.
- **Observability**: Although this is not a payment-provider flow, merchant-related backend calls still need request/failure/result boundary logging per repo business guidelines. The implementation plan includes observability for branch resolution and product mutation calls, with no PII or secret leakage. Pass with explicit instrumentation requirement.
- **Config**: API base/version handling must continue to flow through existing config and API wrappers rather than inline service URLs. Pass.
- **i18n**: Any new user-facing text must be added to both `de` and `en`, with German as default. Pass.
- **Simplicity**: Extend the existing `merchant-catalog` feature instead of introducing a parallel product-management stack. Pass.
- **Native config**: No direct native Android/iOS changes are planned. Pass.

**Post-Design Re-Check**: Phase 1 artifacts keep the feature within the existing mobile architecture, preserve single-branch scope, and require observability plus i18n on all new user-visible flows. No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/010-geo-branch-products/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── geo-branch-products-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
blitz-pay/
├── src/
│   ├── features/
│   │   ├── basket/
│   │   │   ├── hooks/
│   │   │   ├── store/
│   │   │   └── types/
│   │   ├── merchant-catalog/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   └── nearby-merchants/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types/
│   ├── lib/
│   │   ├── api/
│   │   ├── observability.ts
│   │   ├── translations.ts
│   │   └── imageUri.ts
│   ├── screens/
│   │   ├── ExploreScreen.tsx
│   │   ├── MerchantScreen.tsx
│   │   └── ProductDetailScreen.tsx
│   └── types.ts
└── package.json
```

**Structure Decision**: Implement inside `blitz-pay/src/features/merchant-catalog` and related mobile screens. Reuse `nearby-merchants` for location-derived merchant context and keep any editable product workflow state inside the mobile feature/store pattern instead of introducing a new app or backend layer.

## Complexity Tracking

No constitution exceptions or justified complexity deviations are required at planning time.
