# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BlitzPay is split into two React Native / Expo mobile products:

- **`blitz-pay/`** — Consumer app: QR payments, merchant discovery, voice assistant, wallet
- **`blitz-pay-merchant/`** — Merchant portal: dashboard, orders, products, payments, QR generation

Both share the same design tokens (colors, spacing, radius, shadow) and auth pattern (Keycloak ROPC via native `fetch`).

The root of this repo contains only shared docs (`specs/`, `docs/`, `CLAUDE.md`, etc.). The web SPA prototype has been removed.

---

## blitz-pay (Consumer App)

### Commands
```bash
cd blitz-pay
cp .env.example .env   # fill in Keycloak values (or EXPO_PUBLIC_AUTH_BYPASS=true)
npm install
npm run ios            # iOS Simulator
npm run android        # Android Emulator
npm run start          # Expo Go / Dev Client
npm run lint           # TypeScript type check
```

### Architecture
- **Framework**: Expo SDK 55, React Native 0.83.6
- **Navigation**: React Navigation v6 — `NativeStackNavigator` + `BottomTabNavigator` (4 tabs: Explore, Assistant, Vault, Account)
- **Auth**: Keycloak ROPC; tokens in `expo-secure-store`; biometric via `expo-local-authentication`
- **QR scanning**: `expo-camera` `CameraView` with `onBarcodeScanned`
- **QR display**: `react-native-qrcode-svg`
- **Voice assistant**: `expo-audio` + Gemini API
- **Payments**: TrueLayer (bank), Stripe (card), Braintree/PayPal
- **Geofence**: `expo-location` + `expo-task-manager` for nearby-merchant alerts
- **i18n**: `useLanguage()` from `src/lib/LanguageContext.tsx`; translations in `src/lib/translations.ts`; default German
- **Design tokens**: `src/lib/theme.ts` — primary #00C2FF, secondary #5856D6

### Screen inventory (`blitz-pay/src/screens/`)
Login, Signup, Explore, Assistant, Vault, Account, Merchant, Checkout, MyQRCode, QRScanner, Invoices, SendInvoice, Notifications, PaymentProcessing, PaymentResult, PaymentPending, InvoicePdfPreview, ProductDetail

### Auth bypass for demos
Set `EXPO_PUBLIC_AUTH_BYPASS=true` in `blitz-pay/.env`.

---

## blitz-pay-merchant (Merchant Portal)

### Commands
```bash
cd blitz-pay-merchant
cp .env.example .env   # fill in Keycloak values (or EXPO_PUBLIC_AUTH_BYPASS=true)
npm install
npm run ios
npm run android
npm run start
npm run lint
```

### Architecture
Same stack as blitz-pay. No payment SDKs (Stripe/TrueLayer/Braintree), no voice/geofence.

- **Tabs**: Dashboard, Orders, Products, Account
- **Stack screens**: Login, OrderDetail, ProductEdit, MerchantQRCode, PaymentsHistory, Notifications
- **Tables & Floor** (Account → Tables & Floor): FloorView (live floor over the `/floor/events` SSE stream), TableDetail (Guest Count, clear, Tap to Pay, confirm cash); Merchant Manager only: Tables, TableSettings (QR, NFC write + lock via `react-native-nfc-manager`), FloorPlans, FloorPlanEditor
- **i18n**: `useLanguage()` from `src/lib/LanguageContext.tsx`; merchant-specific translation keys in `src/lib/translations.ts`
- **Design tokens**: identical `src/lib/theme.ts`
- **Auth**: same Keycloak ROPC pattern; separate session key `blitzpay_merchant_session`

### Adding a new screen
1. Create `blitz-pay-merchant/src/screens/NewScreen.tsx`
2. Add the route to `RootStackParamList` or `TabParamList` in `src/types.ts`
3. Register in `src/navigation/AppNavigator.tsx` (stack) or `src/navigation/TabNavigator.tsx` (tab)

### Auth bypass for demos
Set `EXPO_PUBLIC_AUTH_BYPASS=true` in `blitz-pay-merchant/.env`.

---

## Shared patterns

**Auth flow**: ROPC grant → `expo-secure-store` → proactive refresh 60s before expiry. `AuthProvider` wraps the navigator; `useAuth()` returns `{ initialized, authenticated, token, user, login, loginWithBiometric, logout, enrollBiometric }`.

**i18n**: `LanguageProvider` at root; `t('key')` via `useLanguage()`; both `de` and `en` translations required.

**Design system**: colors, spacing, radius, shadow exported from `src/lib/theme.ts` — identical in both apps.

**CI**: `.github/workflows/cd-build-mobile-app.yml` defaults to `./blitz-pay`. Pass `app-directory: ./blitz-pay-merchant` to build the merchant app.

**GitHub Actions conventions**: file prefixes (`ci-`, `cd-`, `release-`, `pr-`, `cleanup-`, `automation-`), `name: <Category> · <What>`, a `run-name` on dispatch/schedule workflows, a `name:` on every job, and results in the job summary. Follow [`docs/github-actions-conventions.md`](https://github.com/elegant-software/elegant-ci-cd-pipeline/blob/main/docs/github-actions-conventions.md) in `elegant-ci-cd-pipeline` for any new or changed workflow.

## Recent Changes
- Renamed `mobile/` → `blitz-pay/` (consumer app)
- Created `blitz-pay-merchant/` (merchant portal — Dashboard, Orders, Products, Payments, QR, Account)
- Removed root web SPA (Vite/React/Tailwind) — both products are now pure React Native / Expo
- Updated CI workflow defaults from `./mobile` to `./blitz-pay`