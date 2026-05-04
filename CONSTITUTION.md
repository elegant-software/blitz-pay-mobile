# BlitzPay Constitution

Binding rules for anyone (human or agent) changing this codebase. Supersedes ad-hoc preferences. Amendments require a PR that updates this file and `AGENTS.md` together.

## References

- [`docs/references/business-guidelines.md`](docs/references/business-guidelines.md) — merchant business rules for geolocation-driven discovery, branch-first naming, logo usage, and merchant observability expectations.

## Core Principles

### I. Observability is Non-Negotiable on Money Paths
Every code path that moves money, initiates a payment, or talks to a payment provider (TrueLayer, Keycloak token exchange, backend payment-init endpoints) MUST emit structured telemetry via `observability` (`mobile/src/lib/observability.ts`) at three points:

1. **Request boundary** — before the outbound call, log intent (`event`, non-PII params, correlation id if present).
2. **Failure boundary** — every `catch` block and every non-2xx branch must call `observability.error` or `observability.warn` with: the step name, the raw provider reason/code, HTTP status, and response body snippet when available. Never swallow a provider's native `reason` field.
3. **Result boundary** — log terminal success/cancel/failure outcomes so funnels can be reconstructed from logs alone.

Rationale: Payment failures are invisible without this. The symptom "TrueLayer payment is not possible" is unactionable when the SDK's `result.reason`, the backend's error body, and the failing step are all discarded.

**Minimum instrumentation required in `mobile/src/lib/truelayer.ts`:**
- `createPaymentRequest`: log on network throw, log the response body on non-2xx (not just status), log on `normalizePaymentResponse` validation failure.
- `TrueLayerPaymentsSDKWrapper.configure` / `.processPayment`: log attempt + log `result.type` and `result.reason` before re-throwing in `normalizeResult`.
- `CheckoutScreen.handleConfirm` catch: `observability.error('checkout_failed', { method, message })`.

**Forbidden:**
- `catch (e) {}` with no log.
- Mapping a provider error to a user-facing i18n key *without* first logging the underlying reason.
- Logging PII: no raw PAN, no CVV, no full access tokens, no IBAN. Log last-4 and hashes only.

### II. Never Swallow Provider Reasons
When wrapping a third-party SDK error into a domain error (e.g. `truelayer_failed`), the original `reason`/`code`/`message` MUST be logged to observability **before** the wrapper throws. The domain error is for the UI; the raw reason is for the operator.

### III. Single Source of Truth for Env Config
Payment config (`trueLayerEnvironment`, `trueLayerRedirectScheme`, `trueLayerPaymentsUrl`) lives in `mobile/src/lib/config.ts`, sourced from `EXPO_PUBLIC_*`. Never hardcode URLs, schemes, or environment selectors inline. Changing environment (Sandbox ↔ Production) must not require a code edit.

### IV. Native Build Config is Code-Reviewed
Android/iOS native config (Gradle, Info.plist, deployment target, desugar library version) is modified **only** via Expo config plugins (`mobile/plugins/*`) or `app.json`. Direct edits to generated `android/` or `ios/` folders are allowed only as a temporary hotfix and must be mirrored back into the plugin in the same PR. Version bumps of SDK-required native deps (e.g. `desugar_jdk_libs`, `kotlin`, `minSdkVersion`) are tracked against the upstream SDK's release notes.

### V. Auth Screens Have No App Chrome
`'login'` and `'signup'` stay in the header / bottom-nav / floating-avatar exclusion lists (see `App.tsx`). Auth state is gated by `{ initialized, authenticated }` from `useAuth()` — not by ad-hoc route guards.

### VI. Web and Mobile Stay in Lockstep on i18n
Any user-facing string added to one of `src/lib/translations.ts` (web) or `mobile/src/lib/translations.ts` (mobile) must ship with both `de` and `en` values. Default language is German. No inline English literals in JSX/TSX.

### VIII. Architecture Pattern is Non-Negotiable
All React Native / Expo code in this repo follows the **Feature-Based + MVVM + Controlled State Management** pattern documented in [`docs/architecture.md`](docs/architecture.md). The three layers — View (screens/components), ViewModel (hooks), Model (services) — must stay separated. State is owned in per-feature stores under `store/`; direct mutation from Views is forbidden. New features must mirror the folder structure defined there.

### VII. Simplicity Over Abstraction
Three similar lines beat a premature abstraction. No framework-ish helpers, feature flags, or compatibility shims until a second real caller exists. Remove dead code instead of deprecating it.

### IX. App Targeting Must Follow Product Intent
Changes must be applied to the product that matches the business domain named in the request. Merchant-facing features, fixes, and catalog/admin workflows belong in `blitz-pay-merchant/`. Consumer-facing discovery, checkout, payment, and shopper flows belong in `blitz-pay/`. If the target app is ambiguous, stop and confirm before editing code.

## Security & Compliance Requirements

- Tokens: access token in `sessionStorage` (web) / `expo-secure-store` (mobile). Never in plain `localStorage`, never in a log line, never in a query string.
- Biometric enrollment flag is non-authoritative (`localStorage` / device-only). Server-side WebAuthn credential is the source of truth.
- Server-side secrets must never be exposed to the client. Any variable used by the client is prefixed `VITE_` (web) or `EXPO_PUBLIC_` (mobile); anything else stays on the backend only.
- TrueLayer redirect URIs must be registered in the TrueLayer console before shipping. Scheme/host/path come from `config.ts` — mismatches are a common "payment not possible" root cause and MUST be logged explicitly (`observability.error('truelayer_redirect_mismatch', { expected, actual })`).

## Development Workflow

- `npm run lint` (type check) must pass before PR.
- UI changes: run the dev server and verify the golden path in a browser / simulator before reporting complete. Type-check green ≠ feature green.
- Commits follow the existing `feat(scope): ...` / `fix(scope): ...` / `ci: ...` style visible in `git log`.
- Do not `git push`, open PRs, or merge without explicit user instruction.
- Specs live under `specs/NNN-slug/`. Spec-kit workflow: `speckit.specify` → `speckit.plan` → `speckit.tasks` → `speckit.implement`.

## Governance

This constitution supersedes informal preferences and prior conversation context. When a rule here conflicts with a newer instruction, follow the newer instruction **and** propose an amendment PR. Agents operating on this repo must read `AGENTS.md` before writing code.

**Version**: 0.1.0 | **Ratified**: 2026-04-14 | **Last Amended**: 2026-04-14
