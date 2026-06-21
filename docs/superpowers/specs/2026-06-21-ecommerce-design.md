# Design: E-commerce (Stripe-native commerce on the Pagecraft page builder)

**Date:** 2026-06-21
**Status:** Draft (design) — pending implementation plans (this spec spawns several)
**Scope:** A full commerce capability layered onto the existing multi-site page builder: products, variants, inventory, cart, checkout, payments, orders, shipping, tax, discounts, and multi-currency. Commerce is enabled per **Site** — a `Site` becomes a store when commerce is turned on — and each store-site runs against its own connected Stripe account. A workspace can therefore own several sites, only some of which are stores.

This is a LARGE feature. The spec defines the target architecture and data model once, then phases the build (P1–P5). Each phase becomes its own implementation plan; do not try to land it all at once.

---

## 1. Goal & scope

### Goal

Let a workspace turn one of its Pagecraft **sites** into a real storefront: enable commerce on a `Site`, define a product catalog (with variants, images, inventory), drop product/grid/cart/checkout blocks onto that site's pages the same way the `collection` block works today, and take real payments through Stripe — with tax, shipping, discounts, and multi-currency handled correctly. Orders, inventory, and catalog are mirrored locally and scoped to the store-site; Stripe owns money and tax.

### What each phase includes (summary; full detail in §9)

- **P1 — Catalog & product pages.** `Store` (1:1 satellite of a `Site`), `Product`/`ProductVariant`/`ProductImage` models, admin catalog UI, Stripe Connect onboarding per store-site, product → Stripe Product/Price sync, `Product`/`ProductGrid` storefront blocks, product detail pages reusing the `app/c/[slug]/[item]` pattern.
- **P2 — Cart & checkout.** `Cart`/`CartItem`, Add-to-Cart + Cart + Checkout blocks, server cart endpoints, Stripe Checkout Session creation, `POST /api/webhooks/stripe` settling `Order`/`OrderItem`.
- **P3 — Inventory, shipping, tax, discounts.** Inventory decrement on order settlement, Stripe Tax, Checkout `shipping_options` (or local `ShippingRate`/zone), Stripe promotion codes.
- **P4 — Order management & customer accounts.** Orders dashboard, refunds, fulfillment status, Stripe customer portal / order history.
- **P5 — Multi-currency & advanced.** Stripe Adaptive Pricing, presentment currencies, subscriptions/advanced pricing if needed.

### Non-goals (for this spec)

- **Marketplace / multi-vendor per store.** One store == one store-`Site` == one connected Stripe account. (Connect itself is multi-tenant across sites/workspaces, but a single storefront is not a marketplace of independent sellers.)
- **Self-hosted payment processing / PCI scope.** We never touch raw card data; Stripe-hosted Checkout and the customer portal keep us out of PCI-DSS SAQ-A+ territory.
- **POS / in-person, warehouses / multi-location inventory, B2B price lists, RFQ.** These are the reasons to switch to Medusa later (§2); not built here.
- **Subscriptions / usage billing** beyond a P5 stub. The catalog model is one-time-purchase first.
- **Custom domains / localization** — owned by sibling specs (see §11). Storefront pages serve under whatever domain the custom-domains spec maps to the store-`Site` (host → `Domain` → `Site`); product content localizes per the localization spec in a later phase.

---

## 2. Decisions & rationale

### Decision: Stripe-native on the existing Prisma stack (LOCKED)

Build commerce directly on Prisma + SQLite, using Stripe as the source of truth for **payment, tax, and currency**, and the local DB as the source of truth for **catalog and order records**. Stripe's hosted surfaces do the heavy, compliance-sensitive work:

- **Stripe Checkout** (hosted) — card entry, 3DS/SCA, wallets (Apple/Google Pay), receipt emails.
- **Stripe Tax** — automatic tax calculation and registration-aware rates.
- **Checkout `shipping_options`** — shipping rate selection at checkout.
- **Promotion codes** — discount entry in the hosted UI.
- **Adaptive Pricing** — multi-currency presentment.
- **Customer portal** — self-serve order history / receipts / payment methods.
- **Webhooks** — the async settlement channel that drives our local `Order` records.

We mirror just enough catalog (`Product`/`ProductVariant`) into Stripe (`Product`/`Price`) so Checkout can reference real line items, and we mirror Stripe outcomes back into local `Order`/`OrderItem` via webhooks.

**Why:** It reuses everything we already have — the foundation's `siteId` content scoping and `Site`-resolved tenancy, role guards (`lib/auth/workspace.ts`, including the foundation's `requireApiSite`), the block registry, the `collection` binding pattern, the CMS detail-page mechanism, Asset uploads, and `/api/ai`. It adds one external dependency (the `stripe` SDK) and one webhook route, not a second backend. Compliance, fraud, SCA, and tax math — the parts that are genuinely hard and risky to own — stay with Stripe.

**Cost of the decision:** Stripe is now a hard runtime dependency for any store; the local DB and Stripe can drift (mitigated by treating webhooks as the reconciliation channel and storing Stripe ids on every mirrored row); and some commerce primitives we'd otherwise model (tax rules, presentment currency math) live in Stripe and are only reflected locally, not authored locally.

### Per-store-site Stripe Connect (LOCKED)

Each store-`Site` connects **its own** Stripe account via **Stripe Connect (Standard or Express)**. Funds settle to the merchant's account; the platform (Pagecraft) is the application. Because commerce is per-site, a workspace with two store-sites has two connected accounts — one per `Store`. Concretely:

- Store a `stripeAccountId` (the connected account, `acct_…`) on the store-site's `Store` row (`Store.siteId @unique`).
- All Stripe API calls for that store run **on behalf of the connected account** — via the `Stripe-Account` header (`stripeAccount` request option) for Standard, so products, prices, checkout sessions, and webhooks all belong to the merchant.
- Use **direct charges** on the connected account (simplest for Standard; the merchant is the merchant of record). An `application_fee_percent`/`application_fee_amount` can be attached if Pagecraft ever monetizes transactions; default 0 for P1–P4.
- Onboarding uses **Account Links** (hosted onboarding) to collect KYC; we never see banking details.

**Standard vs Express:** Standard is the default — the merchant owns a full Stripe dashboard, handles their own disputes/payouts, and Pagecraft stays thin. Express is the fallback if we later want to embed payouts/dashboards inside Pagecraft. The data model is identical (`stripeAccountId`); only the onboarding flow and dashboard ownership differ. Start with Standard.

### Alternative considered: Medusa v2 (DEFERRED)

[Medusa v2](https://medusajs.com) is an open-source headless commerce engine (Node service + Postgres) that ships warehouses/stock locations, multi-region pricing, B2B price lists, multi-channel/POS, fulfillment providers, and a full admin out of the box. It's the "right" answer if commerce becomes the product rather than a feature of the builder.

**Why deferred:** it's a *second backend* — a separate Node service, a Postgres database (we're on SQLite), and a sync layer between Medusa's catalog/orders and our page/CMS/site models. That's a large infra and operational step for a feature most workspaces will use in a basic single-region, single-warehouse way. Stripe-native covers that 90% with one SDK.

**When to switch to Medusa:** when we need any of — real multi-location/warehouse inventory, B2B customer-specific price lists, multi-channel/POS sharing one catalog, complex tax/fulfillment provider routing, or our own checkout UI with deep cart logic (bundles, gift cards, store credit). At that point Stripe becomes Medusa's payment provider and our blocks bind to Medusa's catalog instead of local Prisma models. The block/binding layer and admin UI designed here are the parts we'd keep; the data model would move behind Medusa.

---

## 3. Data model (new Prisma models)

All new models follow the existing schema conventions in `prisma/schema.prisma`: `cuid()` ids, JSON-as-`String` columns for flexible blobs (as `Page.content`, `Collection.fields`, `CollectionItem.data` already do), `DateTime` `createdAt`/`updatedAt`, and `onDelete: Cascade` on owned relations. Per the foundation model, commerce content scopes to a **`Site`** (or, equivalently, to its `Store`), not to a workspace: catalog/cart/order rows carry `siteId` (with `@@index([siteId])`) — or `storeId`, since `Store` is 1:1 with `Site` — and resolve their owning workspace through the `Site` row. The model bodies below use `siteId` as the scoping column; `storeId` is interchangeable wherever a row already joins to `Store`.

**Mirrored vs Stripe-owned** is called out per model. Rule of thumb: catalog and order *records* are ours; the `stripe*Id` columns are foreign keys into Stripe; money/tax *math* is Stripe's and only reflected here.

### Store settings (1:1 satellite of a Site)

Commerce is enabled on a `Site` by giving it a `Store` row. Rather than push commerce columns onto every `Site` (most sites aren't stores), add a 1:1 `Store` satellite keyed by `siteId @unique` — present only for sites that sell, so non-store sites carry no commerce columns. A `Site` *is* a store exactly when a `Store` row exists for it; that row holds the store settings and the connected `stripeAccountId`:

```
model Store {
  id                String   @id @default(cuid())
  siteId            String   @unique            // the Site this store is enabled on
  stripeAccountId   String?              // acct_… connected account (Connect)
  chargesEnabled    Boolean  @default(false)  // mirrored from account.charges_enabled
  payoutsEnabled    Boolean  @default(false)
  currency          String   @default("usd")  // store default / settlement currency
  taxEnabled        Boolean  @default(false)   // Stripe Tax automatic
  shippingMode      String   @default("none")  // "none" | "stripe" | "local"
  webhookSecret     String?              // per-connected-account webhook signing secret if used
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

`stripeAccountId`, `chargesEnabled`, `payoutsEnabled` are **mirrored from Stripe** (set during Connect onboarding and on `account.updated` webhooks). Everything else is local config. The owning workspace (for role checks) is reached via `Store.siteId → Site.workspaceId`, exactly as the foundation's `requireApiSite` resolves it.

### Product

```
model Product {
  id              String   @id @default(cuid())
  siteId          String                       // the store-Site this product belongs to
  handle          String                       // URL slug, unique per site
  title           String   @default("Untitled product")
  description     String   @default("")        // rich text / markdown
  status          String   @default("draft")   // "draft" | "active" | "archived"
  // attributes for binding/filtering (mirrors CollectionItem.data flexibility)
  data            String   @default("{}")       // JSON: arbitrary product fields (vendor, type, tags…)
  stripeProductId String?                       // prod_… (mirror)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  variants ProductVariant[]
  images   ProductImage[]

  @@unique([siteId, handle])
  @@index([siteId])
}
```

Local-owned. `stripeProductId` is the only Stripe-owned column. `handle` is the storefront URL key (see §4 product detail route) and is unique within the store-site. `data` lets us bind arbitrary attributes onto storefront cards the same way `CollectionItem.data` does today.

### ProductVariant

```
model ProductVariant {
  id             String   @id @default(cuid())
  productId      String
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  siteId         String                          // denormalized for direct scoping
  title          String   @default("Default")    // "Small / Black"
  options        String   @default("{}")          // JSON: { Size: "S", Color: "Black" }
  sku            String?
  priceAmount    Int      @default(0)             // minor units (cents)
  currency       String   @default("usd")
  inventory      Int      @default(0)             // on-hand; -1 == untracked
  inventoryPolicy String  @default("deny")        // "deny" | "continue" (oversell)
  stripePriceId  String?                          // price_… (mirror)
  position       Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([productId])
  @@index([siteId])
}
```

Local-owned except `stripePriceId`. **Price is stored locally as the authoring source** and pushed to Stripe as a Price; Stripe Prices are immutable, so an edit creates a new Price and repoints `stripePriceId` (the old Price is archived, not mutated). `inventory` is the mirrored-but-locally-authoritative on-hand count (Stripe doesn't track inventory). A product with no real variants still has one `Default` variant — keeps cart/line-item logic uniform (every line item references a variant).

### ProductImage (Asset reference)

```
model ProductImage {
  id          String   @id @default(cuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  assetId     String?                         // FK into existing Asset model
  url         String                          // denormalized for fast render
  alt         String   @default("")
  position    Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([productId])
}
```

Reuses the existing `Asset` model + `/api/upload` + `AssetPicker`. `url` is denormalized so the storefront renders without a join (same trade Pagecraft already makes elsewhere). Images can be pushed to the Stripe Product `images[]` so Checkout shows them.

### Cart + CartItem

```
model Cart {
  id           String   @id @default(cuid())
  siteId       String                          // the store-Site this cart belongs to
  token        String   @unique               // anonymous cart id, stored in a cookie
  email        String?
  currency     String   @default("usd")
  status       String   @default("open")      // "open" | "converted" | "abandoned"
  stripeCheckoutSessionId String?             // cs_… once checkout starts (mirror)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  items CartItem[]

  @@index([siteId])
}

model CartItem {
  id          String   @id @default(cuid())
  cartId      String
  cart        Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId   String                           // ProductVariant.id (no FK cascade — keep on variant delete)
  quantity    Int      @default(1)
  // priced at add-time for display; checkout re-reads variant for authority
  unitAmount  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([cartId])
}
```

Local-owned. The cart is a server record keyed by an anonymous `token` cookie (a sibling to `pc_ws`, e.g. `pc_cart`), so a cart survives reloads and is readable server-side at checkout. The client also keeps an optimistic copy (see §5). `unitAmount` is a display snapshot; the **checkout step re-reads the variant** so price/stock can't be tampered with client-side.

### Order + OrderItem

```
model Order {
  id                 String   @id @default(cuid())
  siteId             String                       // the store-Site this order belongs to
  number             Int                          // human order number, per-store-site sequence
  email              String
  status             String   @default("pending") // "pending" | "paid" | "fulfilled" | "cancelled" | "refunded"
  currency           String   @default("usd")
  subtotalAmount     Int      @default(0)
  shippingAmount     Int      @default(0)
  taxAmount          Int      @default(0)
  discountAmount     Int      @default(0)
  totalAmount        Int      @default(0)
  shippingAddress    String   @default("{}")       // JSON snapshot from Stripe
  // Stripe linkage (all mirrored / Stripe-owned)
  stripeCheckoutSessionId String? @unique
  stripePaymentIntentId   String?
  stripeCustomerId        String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  items OrderItem[]

  @@unique([siteId, number])
  @@index([siteId])
  @@index([stripePaymentIntentId])
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId   String                          // snapshot reference
  productTitle String                         // denormalized snapshot (product may change later)
  variantTitle String
  sku         String?
  quantity    Int
  unitAmount  Int
  createdAt   DateTime @default(now())

  @@index([orderId])
}
```

`Order` is a **mirror of a settled Stripe Checkout Session / PaymentIntent**, created by the webhook handler — but it's also the canonical local record for the merchant's order history and inventory. The money fields are copied from Stripe's computed amounts (we don't recompute tax/shipping locally). `OrderItem` snapshots title/price so historical orders stay accurate when the catalog later changes. `@@unique([siteId, number])` plus `stripeCheckoutSessionId @unique` give us idempotency anchors (§8).

### Discounts / promotions — delegate to Stripe (thin local mirror)

Default: **don't model discount logic locally.** Create Stripe **Coupons + Promotion Codes** on the connected account; Checkout collects the code and applies it. Mirror just enough to list/manage them in the admin:

```
model DiscountCode {
  id                 String   @id @default(cuid())
  siteId             String                       // the store-Site this code belongs to
  code               String                       // human code shown to buyers
  stripePromotionCodeId String?                   // promo_… (Stripe-owned)
  stripeCouponId        String?                   // coupon math lives in Stripe
  active             Boolean  @default(true)
  createdAt          DateTime @default(now())

  @@unique([siteId, code])
  @@index([siteId])
}
```

The discount *math* (percent/amount, currency restrictions, expiry, usage limits) is **Stripe-owned**; we mirror identifiers + the human code so the admin can list and deactivate them. Order discount totals come back on the settled session.

### ShippingRate / zone — Stripe-first, local optional

If `Store.shippingMode == "stripe"`: create Stripe **Shipping Rates** and reference their ids in Checkout `shipping_options`; mirror a thin row for admin listing. If `"local"`: author rates locally and pass them as `shipping_options` line data at session-create time (still rendered by Stripe Checkout). Zones gate which rates apply per destination country.

```
model ShippingRate {
  id              String   @id @default(cuid())
  siteId          String                         // the store-Site this rate belongs to
  name            String                         // "Standard", "Express"
  amount          Int      @default(0)           // minor units
  currency        String   @default("usd")
  countries       String   @default("[]")        // JSON: ISO country codes this rate serves ([] == all)
  minDeliveryDays Int?
  maxDeliveryDays Int?
  stripeShippingRateId String?                    // shr_… when shippingMode == "stripe"
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@index([siteId])
}
```

### Stripe id columns — summary

Per the brief, every mirrored entity carries its Stripe foreign key: `Store.stripeAccountId`, `Product.stripeProductId`, `ProductVariant.stripePriceId`, `Cart.stripeCheckoutSessionId`, `Order.stripeCheckoutSessionId` / `stripePaymentIntentId` / `stripeCustomerId`, `DiscountCode.stripePromotionCodeId`/`stripeCouponId`, `ShippingRate.stripeShippingRateId`. These are the join points for webhook reconciliation and the "Stripe is source of truth for money" boundary.

---

## 4. Storefront blocks & product pages

New blocks register exactly like the existing ones: a `*.defs.ts` exporting `BlockDefinition[]` (type, label, icon, category, `defaultProps`, `defaultStyles`, `fields`/`CustomContent`, `styleGroups`, `Render`), added to `ALL_BLOCKS` in `lib/blocks/registry.ts` and slotted into a new **"Commerce"** entry in `CATEGORIES`. Render components live in `components/blocks/`. Each render component receives `BlockRenderProps` (`lib/blocks/registry-types.ts`).

### Data context (mirror the `collection` pattern)

The `collection` block reads its data from a React context (`useCollections()` / `CollectionsProvider`) that the editor and `BlockRenderer` populate, rather than fetching. We add a parallel **`ProductsProvider` / `useProducts()`** context carrying a `siteId`-scoped product map (id → product + variants + images), built server-side the same way `buildCollectionMap` builds the collection map in `lib/cms/collection-service.ts`. Storefront pages and the editor preview pass it into `BlockRenderer` alongside `components`/`collections`.

### New blocks

1. **ProductGrid / ProductList** (`commerce` category) — the commerce twin of the `collection` block. Binds a product set (all active, or filtered by tag/collection) to a card template; cards link to the product detail page by `handle`. Reuses the binding/inspector idea: a `CustomContent` inspector picks which product fields map to card slots (image, title, price, badge). Default cards show image + title + formatted price (min variant price). Layout/columns props identical to `collection`.

2. **Product (single)** — renders one product: gallery (from `ProductImage[]`), title, description (rich text), price, a **variant selector** (option dropdowns derived from `ProductVariant.options`), quantity, and an embedded **Add-to-Cart**. On product detail pages it binds to the current product via `{{token}}` substitution (see below); on a marketing page it can target a specific product by id.

3. **AddToCartButton** — a button bound to a `variantId` (+ quantity). Client component; calls the server cart API (`POST /api/cart/items`), updates the cart context, and opens a cart drawer. Honors `inventoryPolicy` (disabled / "out of stock" when `inventory == 0` and policy is `deny`). Styleable via the standard button style groups.

4. **Cart** — renders the current cart (line items, quantities, editable qty, remove, subtotal). A drawer variant and a full-page variant. Reads cart context; mutations hit `/api/cart/*`. Shows a "Checkout" CTA.

5. **Checkout** — not a custom payment form. It's a button/section that calls `POST /api/checkout` to create a **Stripe Checkout Session** for the current cart and **redirects** the browser to `session.url`. All card entry, tax, shipping selection, and promo entry happen on Stripe's hosted page. After payment Stripe redirects back to a configurable success/cancel URL (a Pagecraft page).

### Product detail pages (reuse `app/c/[slug]/[item]`)

The CMS detail mechanism is the exact pattern to reuse. Today `app/c/[slug]/[item]/page.tsx`:

1. loads a `Collection` by `slug` (must have `detailEnabled`),
2. loads the `CollectionItem` by id,
3. parses the per-collection `detailTemplate` block tree,
4. runs `applyTokens(template, data)` (`lib/cms/cms-tokens.ts`) to fill `{{field}}` placeholders,
5. renders header + filled tree + footer via `BlockRenderer`, scoped to the collection's `siteId`.

**Proposed product route: `app/store/[handle]/page.tsx`.** It mirrors that file almost line-for-line, but the store-`Site` comes from the request host (custom-domains spec: host → `Domain` → `Site`), so the lookups are scoped to that site:

1. resolve the store-`Site` from the host, then load `Product` by `(siteId, handle)` where `status == "active"`,
2. build a token data object from the product (title, description, price, image, plus `data` attributes and a serialized variant list),
3. render a **per-store product detail template** — a block tree authored in the admin (a `Store.productTemplate` JSON column, the direct analog of `Collection.detailTemplate`) — with `applyTokens` filling `{{title}}`, `{{price}}`, etc., and a **Product block** inside it providing the interactive variant selector + Add-to-Cart (the interactive bits the token system can't express are real blocks, not tokens),
4. wrap with the site's header/footer and design-system CSS exactly as the CMS detail page does (`designSystemCss` + `responsiveCss`, `parseDesignSystem(site)`), using the store-`Site`'s own tokens.

A **storefront index** at `app/store/page.tsx` (or any normal page on the store-site hosting a `ProductGrid` block) lists that site's products. Both `/store` routes must be added to the **public allowlist in `proxy.ts`** next to `/p/` and `/c/` (they're buyer-facing, not builder pages). Like the existing public pages, they're `export const dynamic = "force-dynamic"`.

> Alternative considered: extend the CMS detail mechanism itself (treat products as a special Collection). Rejected — products need typed price/inventory/variant structure and Stripe sync that the generic `CollectionItem.data` blob doesn't model well. A dedicated route + models is cleaner, while still *reusing the rendering pattern*.

---

## 5. Key flows (step-by-step)

### 5.1 Catalog management + Stripe sync

1. Editor+ opens the admin Products UI, creates a `Product` (+ at least a `Default` `ProductVariant`), uploads images via the existing `Asset`/`/api/upload` pipeline, optionally generates a description via `POST /api/ai` (reuse the existing rewrite/generate path — a "Generate description" action that sends product attributes as the prompt).
2. On save (`POST /api/products`, guarded by the site's workspace role — `withRole("EDITOR")` resolved through `requireApiSite`), we write local rows, then **sync to Stripe on the store-site's connected account**: upsert a Stripe `Product` (store `stripeProductId`), and for each variant create/repoint a Stripe `Price` (store `stripePriceId`). All Stripe calls pass `{ stripeAccount: store.stripeAccountId }` where `store` is the `Site`'s `Store` row.
3. Price edits create a **new** immutable Stripe Price and archive the old one (never mutate). Inventory edits are local-only (Stripe has no inventory concept).
4. Sync is best-effort + retryable: if Stripe is unreachable, the product saves locally with `stripeProductId == null` and a "needs sync" flag; a retry action (or a small reconcile job) completes the sync. A product can't be sold until it has a `stripePriceId`.

### 5.2 Stripe Connect onboarding (per store-site)

1. In the store-site's Store Settings, an OWNER/ADMIN (of the site's workspace) clicks "Connect Stripe". `POST /api/store/connect` creates a Connect account (Standard) for that store-`Site` if none exists, stores `stripeAccountId` on the site's `Store` row, then creates an **Account Link** and returns its URL.
2. Browser redirects to Stripe-hosted onboarding (KYC, bank). On return, Stripe hits the configured return URL; we re-fetch the account and mirror `chargesEnabled`/`payoutsEnabled`.
3. An `account.updated` webhook keeps `chargesEnabled`/`payoutsEnabled` current. The storefront refuses checkout (and the admin shows a banner) until `chargesEnabled == true`.

### 5.3 Cart (client store + server cart)

1. First add-to-cart with no `pc_cart` cookie: `POST /api/cart/items` creates a `Cart` (anonymous `token`), sets the `pc_cart` cookie, adds a `CartItem`. The client holds an optimistic copy in a cart context/store for instant UI; the server cart is authoritative.
2. Quantity/remove mutate via `/api/cart/items/[id]`; the server clamps quantity to available inventory when policy is `deny`.
3. Cart is `siteId`-scoped via the storefront's store-`Site` (resolved from the request host → `Domain` → `Site`), independent of the builder's `pc_ws`/`pc_site` cookies — buyers are not authenticated members.

### 5.4 Checkout → Stripe → webhook → Order

1. Buyer clicks Checkout. `POST /api/checkout` loads the server cart, **re-reads each variant** for current price/stock (authority), and builds a **Stripe Checkout Session** on the store-site's connected account with: `line_items` referencing `stripePriceId` × quantity, `mode: "payment"`, `automatic_tax: { enabled: store.taxEnabled }`, `shipping_options` (§6), `allow_promotion_codes: true`, `success_url`/`cancel_url` (Pagecraft pages on the store-site), `customer_creation`, and `metadata: { cartId, siteId }`. Store `cart.stripeCheckoutSessionId`. Return `session.url`; the Checkout block redirects there.
2. Buyer completes payment on Stripe's hosted page (tax, shipping, promo all handled there).
3. Stripe fires **`checkout.session.completed`** to `POST /api/webhooks/stripe`. The handler **verifies the signature** (§8), looks up the cart via `metadata.cartId` (and the session id), and **idempotently** creates an `Order` + `OrderItem`s from the session's line items and computed totals (`amount_subtotal`, `total_details.amount_tax`, `amount_shipping`, `total_details.amount_discount`, `amount_total`), copies the shipping address and `stripePaymentIntentId`/`stripeCustomerId`, assigns the next per-store-site `number`, marks the cart `converted`, and **decrements inventory** for each line (transactional; §8). Send a confirmation (reuse any existing mail path, or rely on Stripe receipt emails in P2).
4. Buyer is redirected to `success_url`; that page reads the order by session id and shows confirmation. (The order may settle a beat after redirect — the success page tolerates "processing".)

### 5.5 Refunds

From the store-site's Orders dashboard, OWNER/ADMIN issues a refund: `POST /api/orders/[id]/refund` creates a Stripe Refund against `stripePaymentIntentId` (full or partial) on the store-site's connected account. The **`charge.refunded`** webhook updates `Order.status` → `refunded` and (optionally) restocks inventory. Stripe is authoritative for the refund; we mirror status.

### 5.6 Customer order history

Two options, sequenced:

- **P4 default — Stripe customer portal.** Link buyers to the hosted customer portal (configured per connected account) for receipts/order history. No local accounts needed. **Dependency:** requires `stripeCustomerId` on the order (set at checkout via `customer_creation`).
- **Later — buyer-account tie-in.** If/when the storefront gains buyer accounts (a separate concern from workspace `Membership`, which is for builders), we can show order history natively by querying the store-site's local `Order`s for the signed-in buyer's email. This **depends on a buyer-auth concept that does not exist today** — flagged as an open question (§11), not built in P4.

---

## 6. Tax, shipping, discounts, multi-currency mapping

| Capability | Stripe primitive | How it maps here |
|---|---|---|
| **Tax** | **Stripe Tax** (`automatic_tax.enabled` on the Checkout Session) | Toggled by `Store.taxEnabled`. Stripe computes tax from the buyer's address and the merchant's registrations at checkout. We **never compute tax locally**; `Order.taxAmount` is copied from `total_details.amount_tax`. Merchant manages registrations in their Stripe dashboard (Standard Connect). |
| **Shipping** | Checkout **`shipping_options`** (+ `shipping_address_collection`) | `Store.shippingMode`: `"stripe"` → reference mirrored `ShippingRate.stripeShippingRateId`; `"local"` → pass rate data inline at session create; `"none"` → digital/no shipping. `ShippingRate.countries` gates options by destination. `Order.shippingAmount` ← `amount_shipping`. |
| **Discounts** | **Coupons + Promotion Codes** | `allow_promotion_codes: true` lets buyers enter codes on Stripe's page. `DiscountCode` mirrors id + human code for admin listing; discount math is Stripe-owned. `Order.discountAmount` ← `total_details.amount_discount`. |
| **Multi-currency** | **Adaptive Pricing** (presentment currencies) | Enabled on the connected account; Stripe presents prices in the buyer's local currency at checkout from our single authored price. `Order.currency` records the settlement currency. P5 may add explicit per-currency authored prices if Adaptive Pricing's auto-conversion isn't enough. Local prices stay authored in `Store.currency`; presentment is Stripe's job. |

The throughline: we **author** catalog + base price + shipping/discount intent locally, **delegate** tax/currency/discount math + hosted UI to Stripe, and **record** the computed money outcomes back onto `Order`.

---

## 7. Admin UI

New admin surface under `app/(app)/` (sibling to existing `cms`, `design`, `settings`, `site`), e.g. `app/(app)/store/`. The store admin is scoped to the **active site** (the builder's `pc_site` context) and only appears for sites with commerce enabled (a `Store` row). All pages are builder pages — gated by `proxy.ts` session + the foundation's `requireApiSite` (which resolves the site's workspace), and each mutation route is `withRole(...)`-guarded through that site.

- **Products** — list/create/edit the active site's products; per-product variant editor (options → variants matrix, price, sku, inventory), image manager (AssetPicker), status (draft/active/archived), "Generate description" (→ `/api/ai`), and a per-variant Stripe sync indicator. Editor+ to mutate.
- **Orders** — dashboard of `Order`s for the active store-site: number, date, email, total, status; detail view with line items, shipping address, Stripe links, and refund action. Editor+ to view; ADMIN+ to refund.
- **Discounts** — list/create promotion codes (proxied to Stripe), activate/deactivate. ADMIN+.
- **Store Settings** — Stripe Connect status + "Connect/Manage" (OWNER/ADMIN only), default currency, tax toggle, shipping mode + `ShippingRate` editor, product detail template entry point (opens the editor on `Store.productTemplate`, like editing a collection detail template), success/cancel page selection. OWNER/ADMIN.

**Role mapping** (reusing `Role`/`ROLE_RANK` from `lib/auth/workspace.ts`; roles are the buyer's-site **workspace** roles, resolved through `requireApiSite`, since per-site roles are a future foundation enhancement):

- VIEWER — read catalog/orders.
- EDITOR — manage catalog (products/variants/inventory/images), edit product template, add commerce blocks to pages.
- ADMIN — refunds, discounts, shipping/tax/store settings.
- OWNER — connect/disconnect Stripe, dangerous store-level actions.

`api/endpoints.ts` gains a `store`/`products`/`orders`/`cart`/`checkout` group (e.g. `products.list`, `products.byId(id)`, `products.variants(id)`, `cart.items`, `checkout.create`, `orders.refund(id)`, `store.connect`), consumed via the existing axios `api` client.

---

## 8. Security, permissions, integrity

- **Tenancy.** Every product/order/cart/store query is `siteId`-scoped (the store-`Site`); the owning workspace for role checks is resolved through `Site.workspaceId` (`requireApiSite`). Admin routes resolve the active store-site from `pc_site` (within the `pc_ws` workspace) via the foundation guards; storefront/cart routes resolve the store-site from the request host (host → `Domain` → `Site`), not from a builder session — buyers aren't members. Carts are isolated by the opaque `pc_cart` token.
- **Role guards.** Mutations use `withRole`/`requireApiRole` (`lib/api/api-handler.ts`); read endpoints use `withWorkspace`. Public storefront read endpoints (catalog, cart) are intentionally unauthenticated but workspace-scoped and rate-limit-eligible.
- **Webhook signature verification.** `POST /api/webhooks/stripe` reads the **raw body** (Next 16 route handler: read `await req.text()`, do not pre-parse JSON) and verifies via `stripe.webhooks.constructEvent(rawBody, sig, secret)`. Reject (400) on bad signature. The route is under `/api`, already exempt from the `proxy.ts` session gate. Connect events may arrive with an account context — verify against the platform endpoint secret (and per-account secret if used).
- **Idempotency.** Webhooks retry; settlement must be safe to replay. Use `Order.stripeCheckoutSessionId @unique` (and/or a processed-event log keyed by Stripe event id) so a duplicate `checkout.session.completed` is a no-op. Outbound Stripe writes (checkout create, refunds) pass an **Idempotency-Key** so client retries don't double-charge.
- **Inventory race conditions.** Two webhooks (or a webhook + manual edit) must not over-decrement. Decrement inside a Prisma `$transaction` with a guarded conditional update (`UPDATE … SET inventory = inventory - qty WHERE inventory >= qty` semantics). SQLite serializes writes, which helps, but the order-creation + decrement must be one transaction so a partially-applied order can't exist. Oversell is bounded by checking stock at checkout-session creation *and* at settlement; if stock ran out between (rare, since Checkout sessions are short-lived), the policy decides (deny → flag the order for manual resolution; `continue` → allow backorder).
- **Money authority.** Never trust client-sent prices. The checkout route re-derives line items from `ProductVariant`/`stripePriceId`; `Order` money fields come only from Stripe's computed session totals.
- **No secrets in the client.** The Stripe **secret key** and webhook secret are server-only env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); only `stripeAccountId` and publishable identifiers are ever exposed.

---

## 9. Phasing / milestones

Each phase is a self-contained implementation plan with its own gate. Land them in order.

- **P1 — Catalog + product blocks + product pages + Stripe Connect.**
  Models: `Store` (1:1 satellite of a `Site` via `siteId @unique` — enabling commerce on a site), `Product`, `ProductVariant`, `ProductImage` (all `siteId`-scoped). Admin Products UI (scoped to the active site) + image upload + AI descriptions. Connect onboarding per store-site (`/api/store/connect`, account-link return, `account.updated`). Product↔Stripe Product/Price sync on the store-site's account. `ProductsProvider`/`useProducts`. `ProductGrid` + `Product` blocks. `app/store/[handle]` + `app/store` routes resolving the store-site from the host; `proxy.ts` allowlist. **No payments yet** — products are browseable.

- **P2 — Cart + Checkout + Order webhooks.**
  Models: `Cart`, `CartItem`, `Order`, `OrderItem`. `pc_cart` cookie + cart context. AddToCart/Cart/Checkout blocks. `/api/cart/*`, `/api/checkout` (Checkout Session). `/api/webhooks/stripe` with signature verification + idempotent `checkout.session.completed` → `Order`. Success/cancel pages. **End-to-end paid purchase works.**

- **P3 — Inventory + shipping + tax + discounts.**
  Inventory decrement on settlement (transactional, race-safe) + stock UI in admin. `Store.taxEnabled` → `automatic_tax`. `ShippingRate`/zones + `shipping_options` (stripe/local modes). `DiscountCode` mirror + `allow_promotion_codes`. Order totals carry tax/shipping/discount.

- **P4 — Order management + customer accounts.**
  Orders dashboard + detail + fulfillment status. Refunds (`/api/orders/[id]/refund`, `charge.refunded`). Stripe customer portal link for buyer order history.

- **P5 — Multi-currency + advanced.**
  Adaptive Pricing / presentment currencies; optional explicit per-currency prices; subscriptions stub if needed.

> This spec is the umbrella; expect P1, P2, and P3 to each become a separate `docs/superpowers/plans/` plan, with P4/P5 scoped once P1–P3 land.

---

## 10. Testing strategy

Gate stays the project standard: **`tsc --noEmit` + `vitest` + `eslint` (flat strict, no `eslint-disable`) + prettier**, with **no explanatory/justification comments** in code (this prose spec is the exception). Do **not** run `next build` against the live dev tree (see the project's "next build clobbers dev" note); tsc + vitest is the real gate.

Framework-free logic gets unit tests, the way `lib/cms/cms.ts` is tested in isolation:

- **Cart math** — line totals, subtotal, quantity clamping to inventory, currency consistency.
- **Pricing/variant** — option→variant resolution, min-price for grid cards, minor-unit formatting per currency.
- **Inventory** — decrement guard (no negative under `deny`), `continue` backorder, race-safe transactional helper (pure function over a fake store + a transaction integration test).
- **Webhook handler** — signature-verified event parsing, idempotent order creation (replay a duplicate `checkout.session.completed` → exactly one `Order`), money-field mapping from session totals, `account.updated`/`charge.refunded` reducers. Stripe SDK calls are mocked; the *handler logic* is unit-tested.
- **Token fill for product template** — `applyTokens` over product data (reuses the existing `cms-tokens` test approach).
- **Block defs** — each new block's `defaultProps`/`defaultStyles`/registry registration sanity (mirrors how `collection.defs` is structured).

**Live Stripe path** is verified manually with the **Stripe CLI** (`stripe listen --forward-to localhost:.../api/webhooks/stripe`, `stripe trigger checkout.session.completed`) and Stripe **test mode** + a **test connected account** — not in the automated gate.

---

## 11. Risks & open questions

- **Buyer accounts vs builder members.** §5.6's native order history needs a *buyer* identity, which doesn't exist (`Membership`/`User` are for builders). P4 ships the Stripe customer portal to avoid building buyer auth now; native accounts are a deferred, separate spec. **Open.**
- **Local↔Stripe drift.** Prices, products, and inventory can diverge if a webhook is missed or a Stripe-side edit happens. Mitigation: webhooks are the reconciliation channel + a manual "resync" action; consider a periodic reconcile job. **Open: do we need scheduled reconciliation, or is on-demand enough?**
- **SQLite under store load.** SQLite serializes writes; high-frequency webhook settlement + inventory decrements could contend. Fine for typical small-store volume; a busy store is another reason to graduate (Postgres, or Medusa per §2). **Watch.**
- **Stripe Tax registration burden.** Stripe computes tax but the merchant must register in jurisdictions. We surface status; we can't do it for them. **Document for merchants.**
- **Adaptive Pricing availability/fees.** Presentment-currency conversion has FX fees and isn't enabled everywhere; P5 must confirm per-account eligibility and possibly fall back to explicit per-currency prices. **Open.**
- **Connect charge type & application fees.** Defaulting to direct charges, Standard, zero platform fee. If Pagecraft later monetizes per-transaction, revisit charge type (destination vs direct) and `application_fee`. **Decision deferred.**
- **Refund → inventory restock policy.** Always restock, or merchant-configurable? Defaulting to optional/manual restock to avoid restocking damaged returns automatically. **Open.**

### Related specs

- **Multi-site model (foundation — dependency)** — commerce is enabled on a `Site`: the `Store` model is a 1:1 satellite of `Site` (`Store.siteId @unique`), and all catalog/cart/order rows are `siteId`-scoped. This spec relies on that foundation's `Site` entity, `requireApiSite` guard (workspace resolved via `Site.workspaceId`), and active-site (`pc_site`) builder context. A `Site` is a store exactly when it has a `Store` row.
- **Custom domains** — the storefront (`/store/*`) serves under the domain that spec maps to the store-`Site` (host → `Domain` → `Site`); this spec relies on that host→site resolution to scope catalog/cart/order reads. The `app/store/*` routes plug into that resolution.
- **Localization** — `Product`/`ProductVariant`/template content can be localized per the localization spec in a later phase (locale config lives on the store-`Site`); the `data` JSON blob and template-token approach are localization-friendly, but per-locale catalog is out of scope here.
