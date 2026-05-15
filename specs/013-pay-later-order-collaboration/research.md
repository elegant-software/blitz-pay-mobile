# Research: Pay Later Order Collaboration

## Decision: Treat delayed payment as a merchant-wide checkout capability that defaults to `Pay later`

### Rationale
- The shared domain language defines delayed payment as a merchant-wide capability rather than a branch override.
- The shopper experience needs a deterministic checkout rule: when the merchant supports delayed payment, show both `Pay now` and `Pay later`, with `Pay later` preselected by default.
- Keeping the capability merchant-wide avoids new branch-specific checkout logic in both apps.

### Alternatives Considered
1. Make delayed payment branch-specific. Rejected because it conflicts with the current merchant-wide offering model and would add branch override complexity.
2. Force `Pay later` whenever delayed payment is enabled. Rejected because the clarified behavior keeps immediate payment available as an explicit shopper choice.

## Decision: Keep payment initiation exclusive to `blitz-pay/`

### Rationale
- The shared context defines the shopper app as the only payment starter.
- Merchant-side unpaid-order management can be useful without embedding payment-provider UI or device payment capability into `blitz-pay-merchant/`.
- This preserves the existing provider integration surface in the consumer app and avoids duplicating money-path code in the merchant app.

### Alternatives Considered
1. Allow the merchant app to start payment. Rejected because it expands payment capability, device setup, and security scope in the merchant app.
2. Move all payment-start logic to backend-only invisible orchestration. Rejected because the shopper still needs to complete app-side provider flows.

## Decision: Allow collaborative unpaid-order editing before payment starts, but block edits during payment in progress

### Rationale
- The feature’s value depends on both shopper and merchant being able to shape an unpaid order before payment.
- Once payment is in progress, continuing to edit the order would create ambiguity around what the active payment attempt actually covers.
- Blocking edits during payment in progress is simpler than trying to cancel and recreate payment automatically on every mid-flow edit.

### Alternatives Considered
1. Block all merchant edits while the shopper is merely viewing the order. Rejected because the chosen collaboration model allows both sides to keep working until payment actually starts.
2. Let edits continue during payment and silently reconcile totals. Rejected because it is financially risky and hard to explain to users.

## Decision: Surface cross-app order changes through visible non-blocking banners on detail screens only

### Rationale
- The domain language now requires merchant-attributed and shopper-attributed refresh banners when the other side changes an unpaid order.
- Detail-screen-only banners give both sides immediate context without introducing a separate notification center or list-level unread state.
- Non-blocking banners maintain momentum while still making order changes explicit.

### Alternatives Considered
1. Silent refresh only. Rejected because price and item changes would be too opaque to the other actor.
2. Blocking review gate after each remote change. Rejected because it adds friction and interrupts active editing.
3. Persistent list-level notification badges. Rejected because this feature does not include a broader notification workflow.

## Decision: Preserve failed `Pay now` context while keeping the order retryable from Tresor

### Rationale
- A failed immediate-payment order still needs to remain unpaid and recoverable later.
- The original checkout intent should stay truthful (`Pay now`), while Tresor can still offer retry on the unpaid order.
- Keeping failed-payment context visible helps the shopper understand why they are retrying rather than treating the order as a never-attempted `Pay later` order.

### Alternatives Considered
1. Convert failed `Pay now` orders into ordinary `Pay later` orders. Rejected because it rewrites the original intent and loses useful payment history meaning.
2. Force immediate retry only. Rejected because it breaks the stated requirement to return later from Tresor.

## Decision: Represent external resolution through manual settlement and a separate payment source

### Rationale
- The merchant needs a way to close qualifying unpaid orders when the customer pays outside `blitz-pay`.
- Once manual settlement exists, paid state alone is insufficient; both apps need to show whether the order was settled by app payment or by manual settlement.
- Treating manual settlement as a paid outcome that locks the order keeps financial finality consistent with successful in-app payment.

### Alternatives Considered
1. Hide manual settlement behind a backend-only state change with no UI distinction. Rejected because the apps would not be able to explain why the order became paid.
2. Allow manual settlement only for original `Pay later` orders. Rejected because the clarified behavior also allows manual settlement for failed `Pay now` orders that remain unpaid.
