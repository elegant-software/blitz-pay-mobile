# Deepening Opportunities

Architectural friction found in the BlitzPay monorepo. Each candidate is described in terms of locality and leverage — the goal is modules with small interfaces that hide a lot of behaviour.

---

## 1. Order data in `blitz-pay` has no real seam

**Files:** `blitz-pay/src/features/order-payment/store/orderPaymentStore.ts`, `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts`, `blitz-pay/src/screens/OrderDetailScreen.tsx`, `blitz-pay/src/screens/VaultScreen.tsx`

**Problem:** Order data lives in three places simultaneously — the REST API, an in-memory `orderPaymentStore`, and component local state. Mutations (cancel, add item, quantity change) update the in-memory store and call the API, but don't invalidate anything else. `VaultScreen` fetches recent orders directly into component state; `OrderDetailScreen` reads the store but re-fetches on mount anyway. The deletion test is damning: delete `orderPaymentStore` and every caller rewrites their own caching.

The merchant app already has a real seam here — React Query with `invalidateQueries` after mutations. The consumer app does not, despite ADR-0001 calling for it.

**Solution:** Migrate `blitz-pay` orders (Order list, Order detail) into React Query, matching the merchant app's pattern. Mutations call `invalidateQueries`. `orderPaymentStore` is retired; its in-flight payment session state moves into the query cache as `queryClient.setQueryData`.

**Benefits:** Order reads and writes have one place. Mutations concentrate in the query client instead of spreading across hooks and stores. The interface shrinks to `useOrder(orderId)` and `useRecentOrders()` — callers stop knowing about store vs. API.

---

## 2. `useOrderPayment` embeds three implicit provider state machines

**Files:** `blitz-pay/src/features/order-payment/hooks/useOrderPayment.ts` (~400 lines), `blitz-pay/src/lib/payments/paymentResultTracker.ts`, `blitz-pay/src/hooks/usePaymentResult.ts`

**Problem:** The hook has three branches — TrueLayer, Stripe, Braintree — each re-implementing the same steps: refresh token, create session, start tracker, decide whether to navigate to `PaymentProcessing` or `PaymentResult`. Card payments might skip `PaymentProcessing` entirely (synchronous result); bank payments always pass through it. This branching is implicit — callers don't see it.

Additionally, `paymentResultTracker` has a dual integration contract: a returned Promise *and* a subscription callback. Callers need both to cover all outcomes. The deletion test: delete `paymentResultTracker` and the payment-status-polling complexity moves into `usePaymentResult.ts` — it was earning its keep, but its interface leaks too much (Promise + subscribe + applyPush + applyRecoveredResult + cancel).

**Solution:** Extract a `PaymentOrchestrator` module (one deep seam) that accepts a `CheckoutIntent` and routes to the provider-specific adapter. The common post-attempt workflow (session patching, tracker start, navigation decision) lives once inside the orchestrator. `paymentResultTracker` becomes an internal adapter rather than a public module.

**Benefits:** Provider adapters become individually testable. The navigation decision is concentrated in one place instead of three. The interface to callers collapses to `startPayment(intent, orderId)` → observable result.

---

## 3. Geofence has an 11-method interface for a 2-capability module

**Files:** `blitz-pay/src/hooks/useGeofence.ts`, `blitz-pay/src/services/geofence.ts`

**Problem:** `useGeofence()` exports 11 fields/methods: `isMonitoring`, `isPolling`, `config`, `enable`, `disable`, `enablePolling`, `disablePolling`, `permissionStatus`, `error`, `needsSettingsForBackground`, `openSettings`. Callers must understand that native geofencing and polling are two parallel tasks, that `enable()` falls back to polling internally, and that `needsSettingsForBackground` is a computed flag that tells callers to call `openSettings()`.

The fallback from native geofencing to polling is hidden inside `startGeofencing()` — the service makes a decision that the hook surface accidentally exposes through `isPolling`. The interface is nearly as wide as the implementation.

**Solution:** Deepen the module: expose one capability (`monitoring: on/off`) and hide the native-vs-polling decision entirely inside the implementation. The seam becomes: `enable()` → `'ok' | 'permission_needed'`, `disable()`, `isActive`. If native geofencing works, great; if not, polling silently takes over. Remove `isPolling`, `enablePolling`, `disablePolling` from the public interface.

**Benefits:** Callers (currently `AccountScreen`) stop knowing that two task systems exist. The locality of the fallback decision moves entirely into `geofence.ts`. Tests can verify that "enable returns ok" without caring which transport was used.

---

## 4. The HTTP fetch surface has no single seam

**Files:** `blitz-pay/src/lib/auth.tsx` (raw fetch), `blitz-pay/src/services/geofence.ts` (raw fetch with manual token read), `blitz-pay/src/screens/SignupScreen.tsx` (raw fetch), `blitz-pay-merchant/src/lib/auth.tsx` (raw fetch), `blitz-pay-merchant/src/features/orders/services/orderService.ts` (`authedFetch`), `blitz-pay/src/features/merchant-catalog/services/merchantCatalogService.ts` (`fetchMerchantCommerceJson`)

**Problem:** Five distinct fetch patterns: raw `fetch()`, `authedFetch()`, `fetchMerchantCommerceJson()`, direct Keycloak calls, and background-task reads from storage. Token injection, header setup, 401 handling, and retry logic are re-implemented in each. The background geofence task reads the token from storage directly and doesn't know if it's expired.

**Solution:** One `api.ts` module per app (a single deep seam) — `authedGet`, `authedPost`, `authedPatch`, `authedDelete`. Token retrieval and refresh live once inside. Background tasks get a standalone `getValidToken()` export that guarantees freshness. All other modules stop touching auth headers.

**Benefits:** 401 handling is one place. Adding request logging, rate-limit retries, or offline queuing happens in one adapter. Tests stub one seam rather than five.

---

## 5. `useNearbyMerchants` relies on a mutable storage marker instead of a seam

**Files:** `blitz-pay/src/features/nearby-merchants/hooks/useNearbyMerchants.ts`, `blitz-pay/src/lib/nearbyMerchantRefreshMarker.ts`

**Problem:** The geofence background task writes a "refresh needed" marker to storage; `useNearbyMerchants` reads it on every focus. This is a hidden coupling between two modules that never share a type — the coordination signal is a raw storage key. The deletion test: delete the marker module and the hook stops refreshing after geofence events, silently. No type checker catches it.

**Solution:** Replace the storage marker with a React Query query key that the geofence task invalidates via `queryClient.invalidateQueries(['nearby-merchants'])`. The seam is the query key, not a storage slot. `useNearbyMerchants` becomes a plain `useQuery` — it doesn't need to know about the geofence event source.

**Benefits:** The coupling becomes explicit (a query key is a first-class identifier). The hook's focus-check for the marker disappears. Any future trigger (WebSocket push, manual refresh) calls `invalidateQueries` at the same seam.
