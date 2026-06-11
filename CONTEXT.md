# Order Payment

This context covers the shared commercial language for orders and payment orchestration across the shopper and merchant apps. It exists to keep cross-app order lifecycle rules explicit as the checkout flow moves from direct payment initiation to order-first payment handling.

## Language

**Order**:
A committed purchase record that exists before any payment provider flow begins.
_Avoid_: Basket, transaction

**QR Order Poll**:
The interval-based status check the merchant app performs on a newly created Order while its QR code is displayed, stopping on `paid` status or after 5 minutes (100 × 3 s intervals).
_Avoid_: Payment watch, order subscription, real-time update

**Editable Unpaid Order**:
An Order in `PENDING_PAYMENT` that may still be changed before payment starts.
_Avoid_: Draft order, open basket

**Order Editor**:
Either the shopper or the merchant operator acting on an Editable Unpaid Order.
_Avoid_: Owner, controller

**Delayed Payment Capability**:
A merchant-wide policy that makes checkout offer both immediate and delayed payment, with delayed payment preselected by default.
_Avoid_: Deferred payment method, branch override

**Merchant Editable Order**:
An Order whose existing line items may still be changed by the merchant while no payment attempt is in progress and before payment succeeds.
_Avoid_: Fulfillable edit, post-delivery edit

**Existing Item Edit**:
A change that only adjusts quantity or removes an item already present on the Order.
_Avoid_: Item substitution, price override, new item add

**Pre-Payment Order Edit**:
Any shopper or merchant change to an unpaid Order before payment starts, including adding items, changing quantity, or removing items.
_Avoid_: Paid-order edit, post-settlement edit

**Merchant Price Override**:
A merchant-set line-item price applied during a Pre-Payment Order Edit before payment starts.
_Avoid_: Shopper price edit, post-payment repricing

**Visible Order Refresh**:
An unpaid Order update that refreshes the current items and total in the UI with a visible non-blocking banner that attributes the change to the merchant.
_Avoid_: Silent refresh, review gate

**Merchant Visible Order Refresh**:
An unpaid Order update in `blitz-pay-merchant` that refreshes the current items and total with a visible non-blocking banner attributing the change to the shopper.
_Avoid_: Silent merchant refresh, blocking review

**OrderId**:
The single unique order identifier shown to users and used as the shared order reference across both apps.
_Avoid_: Order number, order reference

**Checkout Intent**:
The shopper's choice of `Pay now` or `Pay later` for an Order at checkout.
_Avoid_: Order type, fulfillment mode

**Payment Starter**:
The actor allowed to initiate payment for an Order.
_Avoid_: Approver, fulfiller

**Merchant-Initiated Order**:
An Order created by the merchant operator in `blitz-pay-merchant` from the product catalog before any shopper interaction, with **Checkout Intent** fixed to `PAY_NOW`, represented as a QR code the shopper scans to review, edit, and pay.
_Avoid_: Pre-built basket, merchant draft order, merchant checkout

**Merchant Order QR**:
The QR code generated from a **Merchant-Initiated Order** that encodes only the **OrderId** as `blitzpay://order/{orderId}`, so the shopper app can fetch and act on the live Order.
_Avoid_: Payment QR, basket QR, encoded item list

**Cancelled Empty Order**:
An Order that becomes `CANCELLED` because all existing items were removed before payment success.
_Avoid_: Empty basket, zero-total order

**Shopper Cancellation**:
The shopper action that explicitly cancels an unpaid Order before payment starts.
_Avoid_: Abandonment, implicit timeout

**Merchant Cancellation**:
The merchant action that explicitly cancels an unpaid Order before payment starts.
_Avoid_: Item wipeout, forced timeout

**Awaiting Payment**:
The merchant-visible state for an Order that exists but has not started payment yet.
_Avoid_: Processing, active order

**Payment Failed**:
The merchant-visible state for an Order whose latest payment attempt ended unsuccessfully.
_Avoid_: Awaiting payment, cancelled

**Manual Payment Follow-Up**:
The merchant-side operational responsibility to track an unpaid Order until it is paid or otherwise resolved.
_Avoid_: Auto expiry, unattended unpaid order

**Manual Settlement**:
The merchant action in `blitz-pay-merchant` that marks an unpaid Order as paid when payment happened outside `blitz-pay`.
_Avoid_: External payment sync, backoffice-only closure

**Manually Paid Order**:
A paid Order whose settlement was recorded by the merchant rather than completed through `blitz-pay`.
_Avoid_: Normal app payment, hidden settlement

**Manual Settlement Note**:
Optional merchant-entered context attached when recording Manual Settlement.
_Avoid_: Required reason code, mandatory settlement type

**Payment Source**:
The way a paid Order was settled: either `APP_PAYMENT` or `MANUAL_SETTLEMENT`.
_Avoid_: Order state, payment method timing

## Relationships

- An **Editable Unpaid Order** is exactly one **Order**
- An **Editable Unpaid Order** may be changed by one or more **Order Editors**
- An **Order Editor** may be the shopper in `blitz-pay` or the merchant operator in `blitz-pay-merchant`
- A **Merchant Editable Order** is exactly one **Order**
- An **Existing Item Edit** belongs to exactly one **Order**
- A **Pre-Payment Order Edit** belongs to exactly one unpaid **Order**
- A **Merchant Price Override** belongs to exactly one line item on an unpaid **Order**
- An **Order** has exactly one **OrderId**
- A **Visible Order Refresh** reflects exactly one updated **Order**
- A **Merchant Visible Order Refresh** reflects exactly one updated **Order**
- A **Delayed Payment Capability** applies to all branches of one merchant
- A merchant with **Delayed Payment Capability** exposes `Pay now` and `Pay later` at checkout, with `Pay later` selected by default but not enforced
- A **Checkout Intent** belongs to exactly one **Order**
- A **Checkout Intent** is fixed once the **Order** is created, unless a `Pay now` payment attempt fails
- A **Payment Starter** belongs to exactly one **Order**
- A **Cancelled Empty Order** is exactly one **Order**
- A **Shopper Cancellation** cancels exactly one unpaid **Order**
- A **Merchant Cancellation** cancels exactly one unpaid **Order**
- An **Awaiting Payment** state belongs to exactly one **Order**
- A **Payment Failed** state belongs to exactly one unpaid **Order**
- A **Manual Payment Follow-Up** belongs to exactly one unpaid **Order**
- A **Manual Settlement** completes exactly one unpaid **Order**
- A **Manually Paid Order** is exactly one paid **Order**
- A **Manual Settlement Note** belongs to at most one **Manual Settlement**
- A **Payment Source** belongs to exactly one paid **Order**
- `Pay now` chooses payment method first, then creates the **Order** and immediately initiates payment
- Choosing `Pay later` creates an **Editable Unpaid Order** at checkout
- `Pay later` creates the **Order** without initiating payment or selecting a payment method
- No **Order** exists before the shopper confirms checkout, unless the merchant creates a **Merchant-Initiated Order**
- In the base flow, `blitz-pay-merchant` does not create **Orders** directly; a **Merchant-Initiated Order** is the exception
- The shopper in `blitz-pay` is the only **Payment Starter**
- A **Merchant-Initiated Order** is composed from the merchant's product catalog with quantities, and has **Checkout Intent** fixed to `PAY_NOW`
- A **Merchant-Initiated Order** is created in `awaiting_payment` state and appears immediately in the **Merchant Action Queue**
- A **Merchant-Initiated Order** is surfaced to the shopper via a **Merchant Order QR** displayed inline on the Create Order screen after the order is persisted
- Scanning a **Merchant Order QR** in `blitz-pay` navigates to `OrderDetail` with the **OrderId**, where the shopper may perform a **Pre-Payment Order Edit** before proceeding to checkout
- A **Merchant-Initiated Order** that is never scanned does not expire automatically; **Manual Payment Follow-Up** applies
- A **Merchant-Initiated Order** follows the same **Awaiting Payment** / **Merchant Action Queue** lifecycle as any other unpaid **Order**
- The shopper sees the **OrderId** immediately after the **Order** is created
- After successful `Pay now` payment, `blitz-pay` shows the payment result screen first
- After `Pay later` order creation, `blitz-pay` opens the new order detail screen
- The shopper normally reopens a `Pay later` **Order** from Tresor / recent orders
- When resuming a `Pay later` **Order**, the shopper chooses a payment method at resume time
- Reopening a `Pay later` **Order** shows only the latest current order state
- The shopper sees **Payment Source** on paid orders
- The merchant sees the **OrderId** as soon as the **Order** appears in the merchant order list
- After `Pay later` order creation, `blitz-pay-merchant` shows the **Order** immediately in the merchant order list
- Before payment starts, the merchant sees the **Order** in **Awaiting Payment**
- After an unsuccessful payment attempt, the merchant sees the **Order** in **Payment Failed**
- The merchant sees the original **Checkout Intent** in order details only
- The merchant sees both current order state and **Payment Source** in order details
- After a `Pay now` failure, the shopper may keep the **Order** unpaid and return later
- After a `Pay now` failure, the original **Checkout Intent** stays `Pay now` while Tresor may still offer retry on the unpaid order
- Reopening a failed `Pay now` **Order** shows the latest order with visible failed-payment context and payment options
- Retrying a failed `Pay now` **Order** from Tresor prefers the last payment method but still allows the shopper to change it
- Editing a failed `Pay now` **Order** does not clear its failed-payment context
- **Visible Order Refresh** appears only on the open order detail screen
- **Merchant Visible Order Refresh** appears only on the open order detail screen
- An unpaid `Pay later` **Order** does not expire automatically
- The merchant owns **Manual Payment Follow-Up** for unpaid `Pay later` **Orders**
- A merchant may complete **Manual Settlement** in `blitz-pay-merchant` for an original `Pay later` **Order** and for a failed `Pay now` **Order**
- `blitz-pay` shows a **Manually Paid Order** as paid with a distinct manual-settlement label
- **Manual Settlement** locks the **Order** against further item edits
- Successful `Pay now` payment locks the **Order** against further item edits
- When **Manual Settlement** happens, `blitz-pay` immediately refreshes the **Order** to paid and removes payment actions
- When **Merchant Cancellation** happens, `blitz-pay` immediately refreshes the **Order** to cancelled and removes payment actions
- A **Manual Settlement** may include an optional **Manual Settlement Note**
- **Manual Payment Follow-Up** does not include merchant-triggered payment reminders in this version
- When the shopper starts payment later from Tresor, the merchant sees it only through normal order state refresh
- The shopper may change an **Editable Unpaid Order** only before payment starts
- The shopper may perform **Shopper Cancellation** before payment starts
- The merchant may perform **Merchant Cancellation** before payment starts
- The merchant may change a **Merchant Editable Order** only while no payment attempt is in progress and before payment succeeds
- Before payment starts, both shopper and merchant may perform a **Pre-Payment Order Edit**
- Before payment starts, the merchant may apply a **Merchant Price Override**
- Before payment starts, the shopper may not change item price
- A shopper-added item enters the unpaid **Order** at current catalog price unless the merchant later applies a **Merchant Price Override**
- Before payment starts, the shopper may still remove an item after a **Merchant Price Override**
- The shopper viewing an unpaid **Order** does not block merchant edits before payment starts
- The shopper may perform an **Existing Item Edit**
- The merchant may perform an **Existing Item Edit**
- An unpaid **Existing Item Edit** is shown to the shopper as a **Visible Order Refresh**
- A shopper-made unpaid **Existing Item Edit** is shown to the merchant as a **Merchant Visible Order Refresh**
- Removing the last remaining item turns the **Order** into a **Cancelled Empty Order**
- Before payment starts, existing orders may add new items in this version
- A merchant **Price Override** is shown in `blitz-pay` with a visible banner and updated line price and total
- Adding the same product twice before payment may create separate order lines
- **Merchant Price Override** applies per line, not across all lines of the same product

## Example dialogue

> **Dev:** "If the shopper updates quantity in `blitz-pay` while the merchant changes the same unpaid order in `blitz-pay-merchant`, do we lock one side?"
> **Domain expert:** "No. It stays an **Editable Unpaid Order** until payment starts, and both sides may edit it."

> **Dev:** "When a merchant allows delayed payment, should checkout still offer immediate payment?"
> **Domain expert:** "Yes. The merchant's **Delayed Payment Capability** shows `Pay now` and `Pay later`, but `Pay later` is the default."

> **Dev:** "Can the merchant still change the order after payment starts?"
> **Domain expert:** "Yes, but only until payment succeeds, and only for existing items."

> **Dev:** "What counts as editing an item on the order?"
> **Domain expert:** "Only changing quantity or deleting the item. No new items and no price changes."

> **Dev:** "If an unpaid order changes while the shopper is still in the flow, do we stop them with a review step?"
> **Domain expert:** "No. Refresh the current items and total, but do not show a separate review state."

> **Dev:** "Do we show both order number and order id in the apps?"
> **Domain expert:** "No. There is only one user-visible identifier, the **OrderId**."

> **Dev:** "When does the shopper first see the OrderId?"
> **Domain expert:** "Immediately after the order is created, even before payment succeeds."

> **Dev:** "When does the merchant first see the OrderId?"
> **Domain expert:** "In the orders list as soon as the order appears."

> **Dev:** "Does Pay now create a different order than Pay later?"
> **Domain expert:** "No. Both create the order first; Pay now then starts payment, while Pay later stops after order creation."

> **Dev:** "Can either side edit the order after Pay now has already started processing?"
> **Domain expert:** "No. Edits are blocked while payment is in progress."

> **Dev:** "Who is allowed to start payment for a Pay later order?"
> **Domain expert:** "Only the shopper in blitz-pay. The merchant app does not have payment capability."

> **Dev:** "What if the merchant or shopper deletes the last remaining item?"
> **Domain expert:** "Then the order is cancelled. We do not keep an empty order payable."

> **Dev:** "Is Pay later a forced merchant policy or just the default choice?"
> **Domain expert:** "Just the default. The shopper can still switch to Pay now."

> **Dev:** "How does the shopper usually come back to a Pay later order?"
> **Domain expert:** "From Tresor or recent orders, not by typing the OrderId."

> **Dev:** "How should the merchant app label a Pay later order before payment starts?"
> **Domain expert:** "Show it as Awaiting Payment, not as generic processing."

> **Dev:** "When the shopper resumes a Pay later order, do they pick the payment method then?"
> **Domain expert:** "Yes. Pay later delays payment timing, not payment-method choice."

> **Dev:** "What if a Pay later order stays unpaid for a long time?"
> **Domain expert:** "The merchant handles it manually. The system does not auto-cancel just because time passed."

> **Dev:** "If the customer pays outside blitz-pay, can the merchant still close the order in the merchant app?"
> **Domain expert:** "Yes. The merchant can mark it as paid manually in blitz-pay-merchant."

> **Dev:** "How should the shopper see an order the merchant marked as paid manually?"
> **Domain expert:** "Show it as paid, but clearly label it as manual settlement rather than an in-app payment."

> **Dev:** "After manual settlement, can anyone still edit the order?"
> **Domain expert:** "No. A manually paid order is locked."

> **Dev:** "What if the shopper is viewing the order while the merchant marks it paid manually?"
> **Domain expert:** "Refresh it immediately to paid and remove any payment action so the shopper cannot pay again."

> **Dev:** "Does the merchant have to explain manual settlement?"
> **Domain expert:** "No. A note is allowed, but it is optional."

> **Dev:** "When the shopper reopens a changed Pay later order, do we show history or just the latest state?"
> **Domain expert:** "Just the latest state."

> **Dev:** "Can the merchant switch an order from Pay later to Pay now after creation?"
> **Domain expert:** "No. Checkout intent is fixed once the order exists."

> **Dev:** "Can the shopper cancel a Pay later order directly before payment starts?"
> **Domain expert:** "Yes. The shopper may cancel it explicitly."

> **Dev:** "Can the merchant cancel an unpaid order directly before payment starts?"
> **Domain expert:** "Yes. The merchant may cancel it explicitly."

> **Dev:** "What should the shopper see if the merchant cancels the order while it is still open in blitz-pay?"
> **Domain expert:** "Refresh it immediately to cancelled and remove any payment action."

> **Dev:** "How should the merchant app show an order after a Pay now attempt fails?"
> **Domain expert:** "Use a distinct Payment Failed state, not the same state as a never-started payment."

> **Dev:** "After a Pay now failure, can the shopper leave the order unpaid and come back later?"
> **Domain expert:** "Yes. The failed order can remain unpaid for later recovery."

> **Dev:** "When the shopper reopens a failed Pay now order, should they still see that payment failed?"
> **Domain expert:** "Yes. Show the failed-payment context and the available payment options."

> **Dev:** "If someone edits the order after a Pay now failure, does that clear the failed-payment state?"
> **Domain expert:** "No. The failed-payment context stays visible until a later outcome replaces it."

> **Dev:** "Can the merchant send a payment reminder from the app for an unpaid order?"
> **Domain expert:** "No. Not in this version."

> **Dev:** "Should the merchant see whether the order started as Pay now or Pay later?"
> **Domain expert:** "Yes, but only in order details."

> **Dev:** "If the merchant changes the unpaid order, should the shopper be told?"
> **Domain expert:** "Yes. Refresh the order and show a visible non-blocking change banner."

> **Dev:** "Should the change banner say who made the change?"
> **Domain expert:** "Yes. It should say the merchant updated the order."

> **Dev:** "Should the merchant also be told when the shopper changes the unpaid order?"
> **Domain expert:** "Yes. Show a visible non-blocking banner that the customer updated the order."

> **Dev:** "Where should these update banners appear?"
> **Domain expert:** "Only on the open order detail screen."

> **Dev:** "When the shopper chooses Pay later at checkout, do they still pick a payment method then?"
> **Domain expert:** "No. Pay later creates the order only; payment method is chosen later when payment starts."

> **Dev:** "When the shopper chooses Pay now, when do they pick the payment method?"
> **Domain expert:** "Before order creation. Then the order is created and payment starts immediately."

> **Dev:** "If the shopper switches between Pay later and Pay now, or backs out before confirming, do we still create an order?"
> **Domain expert:** "No. No order exists until checkout is confirmed."

> **Dev:** "After Pay later creates the order, where should the shopper land?"
> **Domain expert:** "On the new order detail screen."

> **Dev:** "After Pay now succeeds, where should the shopper land first?"
> **Domain expert:** "On the payment result screen first, with the OrderId visible there."

> **Dev:** "After successful Pay now payment, can the merchant still change anything on the order?"
> **Domain expert:** "No. Once the shopper paid, nothing can be changed."

> **Dev:** "Should the merchant see only paid status, or also how the order was paid?"
> **Domain expert:** "Show both the current state and the payment source in order details."

> **Dev:** "Should the shopper also see how a paid order was settled?"
> **Domain expert:** "Yes. Show the payment source in blitz-pay too."

> **Dev:** "How many payment-source values do we actually need here?"
> **Domain expert:** "Just two: APP_PAYMENT and MANUAL_SETTLEMENT."

> **Dev:** "Can the merchant manually settle any unpaid order, or only Pay later ones?"
> **Domain expert:** "Pay later orders can be manually settled, and failed Pay now orders can be manually settled too."

> **Dev:** "If a failed Pay now order is manually settled, should the shopper still see the failed-payment state as current?"
> **Domain expert:** "No. Once manual settlement closes it, show it as paid with MANUAL_SETTLEMENT."

> **Dev:** "After Pay now fails, does the order become Pay later?"
> **Domain expert:** "No. It keeps its original Pay now intent, but the shopper can retry later from Tresor."

> **Dev:** "When the shopper retries a failed Pay now order from Tresor, do they have to pick a method again?"
> **Domain expert:** "Prefer the last method, but still let the shopper change it."

> **Dev:** "When a Pay later order is created, when does the merchant first see it?"
> **Domain expert:** "Immediately in the merchant order list."

> **Dev:** "Can the merchant app create this kind of order directly too?"
> **Domain expert:** "No. The merchant app only receives and manages shopper-created orders in this feature."

> **Dev:** "Can the merchant add new items to an existing order?"
> **Domain expert:** "Before payment starts, both shopper and merchant can add new items too."

> **Dev:** "If a new item is added before payment, who determines its price?"
> **Domain expert:** "The merchant can override the price before payment starts."

> **Dev:** "Can the shopper change price too?"
> **Domain expert:** "No. Only the merchant can override price."

> **Dev:** "If the merchant changes price before payment, what does the shopper see?"
> **Domain expert:** "Show a visible banner and the updated line price and total."

> **Dev:** "If the shopper adds a new item before payment, does it need merchant confirmation for price first?"
> **Domain expert:** "No. It enters at catalog price by default, and the merchant may override it later."

> **Dev:** "If the merchant overrides the price, can the shopper still remove that item before payment?"
> **Domain expert:** "Yes. Price override does not prevent the shopper from removing it."

> **Dev:** "When the shopper later starts payment from Tresor, does the merchant get a special alert?"
> **Domain expert:** "No. The merchant sees it through normal order state refresh only."

> **Dev:** "If the shopper currently has the unpaid order open, can the merchant still edit it?"
> **Domain expert:** "Yes. The order stays editable until payment starts."

> **Dev:** "If the same product is added twice before payment, do we merge it into one line?"
> **Domain expert:** "No. Keep separate lines."

> **Dev:** "If the same product appears on two lines, does price override affect both?"
> **Domain expert:** "No. Price override applies only to the specific line."

## Flagged ambiguities

- "edit order" was ambiguous between changing an unpaid basket-like order and changing a paid order — resolved: only an **Editable Unpaid Order** may be changed
- "delayed payment allowed" was ambiguous between an optional checkout choice and a merchant policy — resolved: it is a **Delayed Payment Capability** that adds both checkout choices and defaults to `Pay later`
- "merchant can edit before delivery" conflicted with the earlier unpaid-only rule — resolved: shopper edits end before payment starts, merchant edits end at payment success
- "merchant can edit until payment succeeds" conflicted with blocking edits during active payment — resolved: edits are blocked whenever payment is in progress
- "edit everything" was ambiguous — resolved: both actors may only perform an **Existing Item Edit**
- "order updated" handling was ambiguous — resolved: unpaid changes use a **Visible Order Refresh** in the shopper app
- "order number" and "order id" were both used for the same identifier — resolved: the domain has only **OrderId**
- "both apps can edit" was ambiguous about payment authority — resolved: only `blitz-pay` may initiate payment
- "delete item" was ambiguous for the last remaining line — resolved: deleting the final item cancels the order
- merchant pre-payment status was ambiguous — resolved: use **Awaiting Payment** rather than generic processing
- unpaid order lifetime was ambiguous — resolved: there is no automatic expiry; the merchant owns **Manual Payment Follow-Up**
- "merchant will make sure all got paid" was ambiguous about system representation — resolved: the merchant app supports **Manual Settlement**
- paid status presentation was ambiguous for non-app payments — resolved: `blitz-pay` distinguishes a **Manually Paid Order**
- post-settlement editability was ambiguous — resolved: **Manual Settlement** locks the order
- concurrent shopper payment versus manual settlement was ambiguous — resolved: **Manual Settlement** immediately removes shopper payment actions
- manual settlement audit detail was ambiguous — resolved: **Manual Settlement Note** is optional
- shopper resume presentation after merchant edits was ambiguous — resolved: reopening shows only the latest order state
- payment timing ownership was ambiguous after order creation — resolved: **Checkout Intent** is fixed once the order exists, except failed `Pay now` orders may remain unpaid for later recovery
- shopper reopen semantics were ambiguous after failed `Pay now` — resolved: reopening keeps visible failed-payment context
- failed-payment history after later item edits was ambiguous — resolved: item edits do not clear failed-payment context
- merchant unpaid follow-up tooling was ambiguous — resolved: no merchant-triggered reminder flow in this version
- merchant visibility of original payment timing was ambiguous — resolved: show **Checkout Intent** in order details only
- merchant edit attribution was ambiguous in the shopper app — resolved: **Visible Order Refresh** explicitly attributes the change to the merchant
- shopper edit attribution was ambiguous in the merchant app — resolved: use **Merchant Visible Order Refresh**
- update-banner placement was ambiguous — resolved: show refresh banners only on open order detail screens
- pay-later checkout flow was ambiguous about payment-method selection — resolved: initial `Pay later` checkout skips payment-method choice
- pay-now checkout flow was ambiguous about payment-method timing — resolved: payment method is chosen before order creation
- pre-confirm checkout state was ambiguous — resolved: no order exists until checkout is confirmed
- post-create shopper navigation was ambiguous for `Pay later` — resolved: open the new order detail screen
- post-payment shopper navigation was ambiguous for successful `Pay now` — resolved: show the payment result screen first
- post-payment merchant editability was ambiguous — resolved: successful `Pay now` fully locks the order
- merchant paid-order context was ambiguous — resolved: order details show both state and **Payment Source**
- shopper paid-order context was ambiguous — resolved: `blitz-pay` also shows **Payment Source**
- payment-source granularity was ambiguous — resolved: **Payment Source** has only `APP_PAYMENT` and `MANUAL_SETTLEMENT`
- manual settlement eligibility was ambiguous — resolved: **Manual Settlement** is allowed for original `Pay later` orders and failed `Pay now` orders
- failed-payment versus later manual settlement was ambiguous — resolved: **Manual Settlement** replaces failed-payment as the active state
- failed `Pay now` recovery semantics were ambiguous — resolved: original **Checkout Intent** stays `Pay now`, while Tresor may still offer retry
- failed `Pay now` retry method selection was ambiguous — resolved: default to the last method but allow change
- merchant visibility timing for new `Pay later` orders was ambiguous — resolved: show them immediately in the merchant order list
- order origination was ambiguous — resolved: orders are shopper-created only in this feature
- order edit scope was ambiguous for composition changes — resolved: before payment starts, both shopper and merchant may add new items
- pricing authority for pre-payment additions was ambiguous — resolved: the merchant may apply **Merchant Price Override**
- shopper pricing authority was ambiguous — resolved: only the merchant may override price
- shopper visibility of merchant repricing was ambiguous — resolved: show a visible banner plus updated line price and total
- shopper-added item pricing was ambiguous — resolved: use catalog price by default, with optional later **Merchant Price Override**
- shopper removal rights after merchant repricing were ambiguous — resolved: repriced items may still be removed before payment
- merchant awareness of shopper-initiated later payment was ambiguous — resolved: no special notification beyond normal order refresh
- open order viewing was ambiguous for merchant edit rights — resolved: viewing does not block merchant edits before payment starts
- duplicate product additions were ambiguous — resolved: the same product may appear on separate lines before payment
- line-level repricing scope was ambiguous — resolved: **Merchant Price Override** applies per line only
- shopper cancellation path was ambiguous — resolved: unpaid orders may be ended by **Shopper Cancellation**
- merchant cancellation path was ambiguous — resolved: unpaid orders may also be ended by **Merchant Cancellation**
- concurrent shopper activity versus merchant cancellation was ambiguous — resolved: **Merchant Cancellation** immediately removes shopper payment actions
- merchant unpaid-state semantics were ambiguous after failed payment — resolved: use **Payment Failed** distinct from **Awaiting Payment**

## Consumer Discovery

This context also covers how the shopper-facing BlitzPay app talks about merchant discovery and branch selection. It keeps live branch appearances distinct from generic nearby merchant discovery.

### Language

**Merchant Branch**:
The concrete branch a shopper can browse and check out against.
_Avoid_: Store, outlet, merchant location

**Nearby Merchant**:
A merchant returned for a shopper's position because it has at least one active branch location within the search radius.
_Avoid_: Live branch, appearance, happening now item

**Appearance**:
A time-bounded live presence of a Merchant Branch belonging to a Mobile Merchant that is happening now or scheduled for later.
_Avoid_: Nearby merchant, event, branch location

**Active Appearance**:
An Appearance whose time window is active now, optionally filtered by shopper proximity.
_Avoid_: Nearby merchant, open branch

**Appearance Branch Selection**:
The rule that a shopper who enters through an Active Appearance is scoped to that Appearance's Merchant Branch, even if another branch of the same merchant is nearer.
_Avoid_: Nearest branch fallback

### Relationships

- A **Nearby Merchant** has one or more **Merchant Branches**
- An **Appearance** belongs to exactly one **Merchant Branch**
- Only a Mobile Merchant may have **Appearances**
- An **Active Appearance** is one currently active **Appearance**
- **Appearance Branch Selection** chooses exactly one **Merchant Branch** from the tapped **Active Appearance**

### Flagged ambiguities

- "Happening now" means **Active Appearances**, not generic **Nearby Merchants**

### Example dialogue

> **Dev:** "The shopper tapped a happening-now card for Branch B, but Branch A is slightly nearer. Which branch should open?"
> **Domain expert:** "Branch B. A happening-now card is an Active Appearance, so Appearance Branch Selection wins over nearest-branch fallback."
