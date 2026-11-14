# BlitzPay

BlitzPay is split into two React Native / Expo mobile apps that share the same design system, auth layer (Keycloak ROPC), and backend API.

| App | Directory | Who uses it |
|-----|-----------|-------------|
| **BlitzPay** | `blitz-pay/` | Consumers — QR payments, merchant discovery, voice assistant, wallet |
| **BlitzPay Merchant** | `blitz-pay-merchant/` | Merchants — dashboard, orders, products, payments, QR generation |

---

## Related Repositories

| Repository | Description |
|---|---|
| blitz-pay (backend) | Spring Boot / Kotlin backend — payments, merchants, orders |
| blitzpay-admin-dashboard | Angular admin dashboard |
| blitz-pay-merchant | React Native merchant app |
| blitz-pay (shopper app) | React Native shopper app |

---

## blitz-pay (Consumer App)

**Prerequisites:** Node.js, npm, Android/iOS device or simulator

```bash
cd blitz-pay
cp .env.example .env      # fill in Keycloak/API values
npm install
npm run ios               # iOS Simulator
npm run android           # Android Emulator
npm run start             # Expo Go / Dev Client
```

### Auth bypass (demo / dev)

Set `EXPO_PUBLIC_AUTH_BYPASS=true` in `blitz-pay/.env` to skip Keycloak and auto-login as a dev user.

### Environment variables

| Key | Description |
|-----|-------------|
| `EXPO_PUBLIC_KEYCLOAK_URL` | Keycloak server URL (e.g. `http://localhost:8080`) |
| `EXPO_PUBLIC_KEYCLOAK_REALM` | Keycloak realm: `blitzpay-customers` (shopper app) or `blitzpay-business` (merchant app); CI sets it per app |
| `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` | Keycloak public client ID (e.g. `blitzpay-spa`) |
| `EXPO_PUBLIC_AUTH_BYPASS` | `true` to skip Keycloak entirely |
| `EXPO_PUBLIC_API_URL` | Backend API base URL |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_…`) |
| `EXPO_PUBLIC_OBSERVABILITY_ENABLED` | Enable mobile log forwarding to OTLP |

See `blitz-pay/.env.example` for the full list.

### Screens

Login, Signup, Explore, Assistant (voice), Vault, Account, Merchant, Checkout, MyQRCode, QRScanner, Invoices, SendInvoice, Notifications, PaymentProcessing, PaymentResult, PaymentPending, InvoicePdfPreview, ProductDetail

### Stripe testing

- Requires a native dev build (`npx expo run:ios` / `run:android`) — not compatible with standard Expo Go.
- Test card success: `4242 4242 4242 4242`
- Test card 3D Secure: `4000 0027 6000 3184`

---

## blitz-pay-merchant (Merchant Portal)

**Prerequisites:** Node.js, npm, Android/iOS device or simulator

```bash
cd blitz-pay-merchant
cp .env.example .env      # fill in Keycloak/API values
npm install
npm run ios
npm run android
npm run start
```

### Auth bypass (demo / dev)

Set `EXPO_PUBLIC_AUTH_BYPASS=true` in `blitz-pay-merchant/.env`.

### Environment variables

| Key | Description |
|-----|-------------|
| `EXPO_PUBLIC_KEYCLOAK_URL` | Keycloak server URL |
| `EXPO_PUBLIC_KEYCLOAK_REALM` | Keycloak realm (`blitzpay-business`) |
| `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` | Keycloak client ID (e.g. `blitzpay-merchant-spa`) |
| `EXPO_PUBLIC_AUTH_BYPASS` | `true` to skip Keycloak entirely |
| `EXPO_PUBLIC_API_URL` | Backend API base URL |

See `blitz-pay-merchant/.env.example` for the full list.

### Screens

| Tab | Stack / modal screens |
|-----|-----------------------|
| Dashboard (revenue, stats, recent orders) | Login |
| Orders (filterable list, status badges) | OrderDetail (mark complete / cancel) |
| Products (active toggle, add/edit) | ProductEdit (name, price, SKU, stock) |
| Account (settings, language, logout) | MerchantQRCode (dynamic QR + share) |
| | PaymentsHistory |
| | Notifications |

> All data is currently mocked. Wire `src/lib/config.ts` → `EXPO_PUBLIC_API_URL` to connect to a real backend.

---

## Clean rebuild (both apps)

If Metro or Expo ignores recent changes, clear caches and restart:

```bash
rm -rf .expo node_modules/.cache
npx expo start --clear
```

To force a full native rebuild:

```bash
npx expo run:ios
npx expo run:android
```

---

## EAS builds (blitz-pay)

### Prerequisites

`blitz-pay/eas.json` must exist. Generate it once:

```bash
cd blitz-pay && npx eas build:configure
```

The `preview` profile uses `ios.simulator: true` so CI builds don't require signing credentials. For a real device build, run `npx eas credentials` interactively first.

### Async build script (recommended)

```bash
cd blitz-pay
npm run build:eas:async                    # default: production profile, all platforms
npm run build:eas:async:clear-cache        # same but clears EAS cache first
```

Optional flags: `--profile <profile>`, `--platforms ios,android`, `--poll-ms <ms>`

### GitHub Actions

Workflow: `.github/workflows/cd-build-mobile-app.yml`

- Defaults to `./blitz-pay`. Pass `app-directory: ./blitz-pay-merchant` to build the merchant app.
- Duplicate-build guard: skips EAS if a build with the same version/profile/platform is already running.
- `release-notes-tag` (default `latest`): resolves to a GitHub release tag and stamps the Expo app version before EAS build.

### Sync env to GitHub Actions

```bash
./.github/scripts/sync-mobile-env-to-github.sh
# Options:
#   --env-file <path>          use a different .env file
#   --repo <owner/name>        target a different repo
#   --environment <name>       write environment-scoped vars (e.g. staging)
```

`EXPO_PUBLIC_*` keys are stored as GitHub Variables; all others as GitHub Secrets.

---

## OpenTelemetry / Grafana (blitz-pay)

1. Set mobile flags in `blitz-pay/.env`:
   - `EXPO_PUBLIC_OBSERVABILITY_ENABLED=true`
   - `EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT=production`
2. Logs are batched on-device and posted to `POST /api/observability/mobile-logs` on the backend, then forwarded as OTLP logs.
3. Query in Grafana Explore by `service.name="blitzpay-mobile"` and `deployment.environment`.

## Invoice downloads after payment

The merchant app shows a private invoice download link and a QR code on the payment-success and
order-detail screens. The shopper app shows a download button on paid order details; scanning the
merchant's invoice QR code with the shopper app's scanner opens the invoice in the app.
Links expire after 30 minutes; use **Refresh invoice** to renew them. Invoice availability and
download errors have retry actions.
