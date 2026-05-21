# ADR 0001: React Query for client-side data caching

**Status:** Accepted

## Context

Both apps (`blitz-pay` and `blitz-pay-merchant`) re-fetch all data from the REST API on every screen focus. The merchant app additionally polls orders every 5 seconds. This produces visible loading delays on every navigation — there is no in-memory cache.

The alternative considered was a WebSocket push model: load once, receive diffs from the server. This is the right long-term target but requires backend infrastructure that does not exist yet.

## Decision

Adopt **React Query (`@tanstack/react-query`)** in both apps as the data-fetching and cache layer.

- A single `QueryClient` wraps each app's navigator
- Stale times are defined as named constants (not hardcoded at call sites):
  - Orders list: 30 seconds
  - Order detail: 15 seconds
  - Products: 5 minutes
  - Branch / merchant names: 10 minutes
- The 5-second polling loop in `useMerchantOrders` and `useMerchantOrderDetail` is removed; React Query background revalidation replaces it
- Order mutations (`cancel`, `manual-settlement`, `add item`, etc.) call `invalidateQueries` on the affected order and list cache keys so data stays consistent after writes
- Products are persisted to `AsyncStorage` via `createAsyncStoragePersister` so cold-open shows last-known data instantly; orders are **not** persisted (merchant must always see a fresh list on cold open)

## Consequences

- Re-navigation to Orders or Products is instant (serves from cache, revalidates in background)
- Order list polling is eliminated; the stale window is 30 s instead of 5 s — acceptable given order arrival latency
- When the backend adds WebSocket support, React Query's `setQueryData` can be called from the socket event handler to push live diffs without changing the component layer
