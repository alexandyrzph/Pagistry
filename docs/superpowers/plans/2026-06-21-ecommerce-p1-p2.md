# E-commerce P1 + P2 (Catalog → Checkout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a Pagistry `Site` into a real storefront — define a product catalog, browse it on host-served `/store` pages, and take a real payment through Stripe Checkout that settles into a local `Order`.

**Architecture:** Commerce is enabled on a `Site` by a 1:1 `Store` satellite (`Store.siteId @unique`). Catalog/cart/order rows are **`siteId`-scoped** and resolve their workspace via `Site.workspaceId` (the foundation's `requireApiSite`). Each store-Site connects **its own** Stripe account via Connect (Standard); all Stripe calls run on that account (`{ stripeAccount }`). The local DB owns catalog + order **records**; Stripe owns **money/tax** math, mirrored back via `POST /api/webhooks/stripe`. Storefront `/store/*` routes resolve the store-Site from the request **host** (`resolveHostSite`), reusing the custom-domains layer; admin lives under `app/(app)/store/` scoped to the active site (`pc_site`).

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, async params, raw-body webhooks), Prisma 6 + SQLite, the `stripe` Node SDK (new dependency), React 19 context blocks, Vitest (node env), TypeScript strict, ESLint flat + Prettier.

**Spec:** `docs/superpowers/specs/2026-06-21-ecommerce-design.md` (P1+P2 of P1–P5). **Builds on:** multi-site model (`Site`, `withSite`/`withSiteRole`, `getActiveSite`) + custom domains (`resolveHostSite`, `requestHost`).

## Global Constraints

- **This is NOT vanilla Next.js** — read the relevant guide under `node_modules/next/dist/docs/` before using a Next API. Middleware is `proxy.ts`. Route `params` are `Promise`s (await them).
- **Stripe is the source of truth for money/tax; the local DB for catalog/order records.** Never trust client-sent prices — the checkout route re-reads `ProductVariant`; `Order` money fields come only from Stripe session totals. Stripe **secret** key + webhook secret are server-only env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); never exposed to the client.
- **Per-store Connect:** every Stripe call for a store passes `{ stripeAccount: store.stripeAccountId }`. Outbound writes that must not duplicate (checkout create) pass an `idempotencyKey`.
- **Webhook:** read the **raw body** (`await req.text()`), verify with `stripe.webhooks.constructEvent`; settlement is **idempotent** (`Order.stripeCheckoutSessionId @unique`).
- **Tenancy:** every product/cart/order/store query is `siteId`-scoped. Admin routes resolve the active store-Site via `withSite`/`withSiteRole`; storefront/cart/checkout routes resolve it from the **host** (`resolveHostSite`), never from a builder cookie (buyers aren't members).
- **Schema** applied with `npx prisma db push` then `npx prisma generate`; **restart `next dev`** after (cached Prisma client won't see new delegates).
- **Gate (before every commit):** `npx tsc --noEmit` && `npx vitest run` && `npx eslint .` && `npx prettier --check .`. Not `next build` while `next dev` runs. Stripe live paths (Connect, Checkout, webhooks) are verified **manually via the Stripe CLI**, NOT in the automated gate.
- **Code style:** no `eslint-disable`, no `any`/`as any`/`!`, **no explanatory/justification comments**; double quotes, semicolons, 2-space. Client HTTP via `lib/api/client` (`api`) + `lib/api/endpoints.ts`. Block Render components read data from React **context** (a `useProducts()`/`useCart()` hook), never from `BlockRenderProps`. Exclude `prisma/dev.db` + `.idea/` from every commit.
- **New env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` (absolute base for Stripe return/success/cancel URLs; falls back to `http://localhost:3000`).

---

## File Structure

**Create (P1):** `lib/commerce/pricing.ts`, `lib/commerce/stripe.ts`, `lib/commerce/sync.ts`, `lib/commerce/product-service.ts`, `components/store/products-context.tsx`, `components/blocks/commerce.defs.ts`, `components/blocks/product-grid.tsx`, `components/blocks/product.tsx`, `app/api/store/route.ts`, `app/api/store/connect/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/products/route.ts`, `app/api/products/[id]/route.ts`, `app/store/page.tsx`, `app/store/[handle]/page.tsx`, `app/(app)/store/page.tsx`, `components/store/StoreAdmin.tsx`, `components/store/ProductEditor.tsx`. Tests: `tests/commerce-pricing.test.ts`, `tests/commerce-product-service.test.ts`, `tests/commerce-blocks.test.ts`.

**Create (P2):** `lib/commerce/cart.ts`, `lib/commerce/cart-cookie.ts`, `lib/commerce/order.ts`, `components/store/cart-context.tsx`, `components/blocks/add-to-cart.tsx`, `components/blocks/cart.tsx`, `components/blocks/checkout.tsx`, `app/api/cart/route.ts`, `app/api/cart/items/route.ts`, `app/api/cart/items/[id]/route.ts`, `app/api/checkout/route.ts`, `app/store/checkout/success/page.tsx`, `app/store/checkout/cancel/page.tsx`. Tests: `tests/commerce-cart.test.ts`, `tests/commerce-order.test.ts`, `tests/commerce-webhook.test.ts`.

**Modify:** `prisma/schema.prisma` (8 models + `Site` relations), `lib/types.ts` (`BlockCategory` += `"Commerce"`), `lib/blocks/registry.ts` (register commerce blocks + category), `components/BlockRenderer.tsx` (thread `products`), `proxy.ts` (`/store/` allowlist), `lib/api/endpoints.ts` (commerce groups), `package.json` (`stripe` dep).

---

---

# PHASE 1 — Catalog, Stripe Connect, product pages

## Task 1: Commerce data model (P1 models)

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the P1 models + Site relations**

Add to `prisma/schema.prisma`. Add the four relations (`store Store?`, `products Product[]`, etc.) to the existing `Site` model's relation block.

```prisma
model Store {
  id              String   @id @default(cuid())
  siteId          String   @unique
  site            Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  stripeAccountId String?
  chargesEnabled  Boolean  @default(false)
  payoutsEnabled  Boolean  @default(false)
  currency        String   @default("usd")
  taxEnabled      Boolean  @default(false)
  shippingMode    String   @default("none")
  productTemplate String   @default("[]")
  successPath     String   @default("/store/checkout/success")
  cancelPath      String   @default("/store/checkout/cancel")
  webhookSecret   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Product {
  id              String   @id @default(cuid())
  siteId          String
  site            Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  handle          String
  title           String   @default("Untitled product")
  description     String   @default("")
  status          String   @default("draft")
  data            String   @default("{}")
  stripeProductId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  variants ProductVariant[]
  images   ProductImage[]

  @@unique([siteId, handle])
  @@index([siteId])
}

model ProductVariant {
  id              String   @id @default(cuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  siteId          String
  title           String   @default("Default")
  options         String   @default("{}")
  sku             String?
  priceAmount     Int      @default(0)
  currency        String   @default("usd")
  inventory       Int      @default(0)
  inventoryPolicy String   @default("deny")
  stripePriceId   String?
  position        Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([productId])
  @@index([siteId])
}

model ProductImage {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  assetId   String?
  url       String
  alt       String   @default("")
  position  Int      @default(0)
  createdAt DateTime @default(now())

  @@index([productId])
}
```

In `model Site { … }` add: `store Store?` and `products Product[]`.

- [ ] **Step 2: Push + regenerate**

Run: `npx prisma db push && npx prisma generate`
Expected: "in sync" + "Generated Prisma Client". (Restart `next dev` if running.)

- [ ] **Step 3: Confirm delegates**

Run: `npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); Promise.all([p.store.count(),p.product.count(),p.productVariant.count()]).then(r=>{console.log('ok',r); return p.\$disconnect()})"`
Expected: `ok [ 0, 0, 0 ]`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): commerce P1 models (Store, Product, ProductVariant, ProductImage)"
```

---

## Task 2: Pricing & variant helpers (pure, unit-tested)

**Files:** Create `lib/commerce/pricing.ts`, `tests/commerce-pricing.test.ts`

**Interfaces — Produces:**

- `formatMoney(minor: number, currency: string): string`
- `minVariantPrice(variants: { priceAmount: number; currency: string }[]): { amount: number; currency: string } | null`
- `parseOptions(json: string): Record<string, string>`
- `variantForOptions(variants: { id: string; options: string }[], selected: Record<string, string>): string | null` (returns the matching variant id, or null)

- [ ] **Step 1: Write the failing tests**

`tests/commerce-pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  formatMoney,
  minVariantPrice,
  parseOptions,
  variantForOptions,
} from "@/lib/commerce/pricing";

describe("formatMoney", () => {
  it("formats minor units by currency", () => {
    expect(formatMoney(1999, "usd")).toBe("$19.99");
    expect(formatMoney(0, "usd")).toBe("$0.00");
    expect(formatMoney(5000, "eur")).toBe("€50.00");
  });
});

describe("minVariantPrice", () => {
  it("returns the lowest price, or null for no variants", () => {
    expect(
      minVariantPrice([
        { priceAmount: 2000, currency: "usd" },
        { priceAmount: 1500, currency: "usd" },
      ]),
    ).toEqual({ amount: 1500, currency: "usd" });
    expect(minVariantPrice([])).toBeNull();
  });
});

describe("parseOptions / variantForOptions", () => {
  it("parses options json and resolves the matching variant", () => {
    expect(parseOptions('{"Size":"S"}')).toEqual({ Size: "S" });
    expect(parseOptions("nonsense")).toEqual({});
    const variants = [
      { id: "v1", options: '{"Size":"S","Color":"Black"}' },
      { id: "v2", options: '{"Size":"M","Color":"Black"}' },
    ];
    expect(variantForOptions(variants, { Size: "M", Color: "Black" })).toBe("v2");
    expect(variantForOptions(variants, { Size: "L", Color: "Black" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run tests/commerce-pricing.test.ts`

- [ ] **Step 3: Implement `lib/commerce/pricing.ts`**

```ts
export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);
}

export function minVariantPrice(
  variants: { priceAmount: number; currency: string }[],
): { amount: number; currency: string } | null {
  if (variants.length === 0) return null;
  let best = variants[0];
  for (const v of variants) if (v.priceAmount < best.priceAmount) best = v;
  return { amount: best.priceAmount, currency: best.currency };
}

export function parseOptions(json: string): Record<string, string> {
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) out[k] = String(val);
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function variantForOptions(
  variants: { id: string; options: string }[],
  selected: Record<string, string>,
): string | null {
  const keys = Object.keys(selected);
  for (const v of variants) {
    const opts = parseOptions(v.options);
    if (keys.every((k) => opts[k] === selected[k])) return v.id;
  }
  return null;
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run tests/commerce-pricing.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/commerce/pricing.ts tests/commerce-pricing.test.ts
git commit -m "feat(commerce): pricing + variant resolution helpers"
```

---

## Task 3: Stripe client + Connect onboarding + webhook skeleton

**Files:** Create `lib/commerce/stripe.ts`, `app/api/store/route.ts`, `app/api/store/connect/route.ts`, `app/api/webhooks/stripe/route.ts`; modify `package.json`, `lib/api/endpoints.ts`.

**Interfaces — Produces:** `getStripe(): Stripe`, `appUrl(path: string): string`, `requireStore(ctx)` helper used by later tasks (returns the active site's `Store`, creating it if missing).

- [ ] **Step 1: Install the Stripe SDK**

Run: `npm install stripe`
Expected: `stripe` added to `dependencies`.

- [ ] **Step 2: Stripe client + url helper — `lib/commerce/stripe.ts`**

```ts
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}

export function appUrl(path: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
```

(Use the SDK's default pinned `apiVersion` — do not hardcode one; the installed `stripe` package types determine the call shapes. Verify call signatures against `node_modules/stripe` types.)

- [ ] **Step 3: Store read/update + Connect — `app/api/store/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSite(async (ctx) => {
    const store = await prisma.store.findUnique({ where: { siteId: ctx.site.id } });
    return json({ store });
  });
}

export async function PATCH(req: Request) {
  return withSiteRole("ADMIN", async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body?.currency === "string") data.currency = body.currency.toLowerCase();
    if (typeof body?.taxEnabled === "boolean") data.taxEnabled = body.taxEnabled;
    if (typeof body?.shippingMode === "string") data.shippingMode = body.shippingMode;
    if (typeof body?.productTemplate === "string") data.productTemplate = body.productTemplate;
    const store = await prisma.store.upsert({
      where: { siteId: ctx.site.id },
      update: data,
      create: { siteId: ctx.site.id, ...data },
    });
    return json({ store });
  });
}
```

- [ ] **Step 4: Connect onboarding — `app/api/store/connect/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { withSiteRole } from "@/lib/api/api-handler";
import { json } from "@/lib/api/api-response";
import { getStripe, appUrl } from "@/lib/commerce/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  return withSiteRole("OWNER", async (ctx) => {
    const stripe = getStripe();
    let store = await prisma.store.upsert({
      where: { siteId: ctx.site.id },
      update: {},
      create: { siteId: ctx.site.id },
    });
    if (!store.stripeAccountId) {
      const account = await stripe.accounts.create({ type: "standard" });
      store = await prisma.store.update({
        where: { siteId: ctx.site.id },
        data: { stripeAccountId: account.id },
      });
    }
    const link = await stripe.accountLinks.create({
      account: store.stripeAccountId,
      refresh_url: appUrl("/store?connect=refresh"),
      return_url: appUrl("/store?connect=return"),
      type: "account_onboarding",
    });
    return json({ url: link.url });
  });
}
```

- [ ] **Step 5: Webhook route (raw body + signature) handling `account.updated` — `app/api/webhooks/stripe/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/commerce/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new Response("Missing signature", { status: 400 });
  const raw = await req.text();
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "account.updated") {
    const account = event.data.object as {
      id: string;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
    };
    await prisma.store.updateMany({
      where: { stripeAccountId: account.id },
      data: {
        chargesEnabled: !!account.charges_enabled,
        payoutsEnabled: !!account.payouts_enabled,
      },
    });
  }

  return new Response(null, { status: 200 });
}
```

- [ ] **Step 6: Register endpoints**

In `lib/api/endpoints.ts`, add to `endpoints`:

```ts
  store: {
    root: "/api/store",
    connect: "/api/store/connect",
  },
```

- [ ] **Step 7: Gate + commit.** Run: `npx tsc --noEmit && npx eslint app/api/store app/api/webhooks lib/commerce && npx prettier --check .`

```bash
git add lib/commerce/stripe.ts app/api/store app/api/webhooks lib/api/endpoints.ts package.json package-lock.json
git commit -m "feat(commerce): Stripe client + Connect onboarding + webhook (account.updated)"
```

(Manual smoke deferred to Task 15's Stripe-CLI section. tsc + eslint are the gate here.)

---

## Task 4: Product/variant CRUD API + Stripe sync

**Files:** Create `lib/commerce/sync.ts`, `app/api/products/route.ts`, `app/api/products/[id]/route.ts`; modify `lib/api/endpoints.ts`.

**Interfaces — Consumes:** `getStripe`, `withSite`/`withSiteRole`, `json`/`created`/`badRequest`/`notFound`. **Produces:** `syncProductToStripe(siteId, productId): Promise<void>` (best-effort; sets `stripeProductId`/`stripePriceId`).

- [ ] **Step 1: Stripe sync helper — `lib/commerce/sync.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/commerce/stripe";

export async function syncProductToStripe(siteId: string, productId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { siteId } });
  if (!store?.stripeAccountId) return;
  const product = await prisma.product.findFirst({
    where: { id: productId, siteId },
    include: { variants: true, images: true },
  });
  if (!product) return;
  const stripe = getStripe();
  const opts = { stripeAccount: store.stripeAccountId };

  const params = {
    name: product.title,
    description: product.description || undefined,
    images: product.images.map((i) => i.url).slice(0, 8),
  };
  const stripeProductId = product.stripeProductId
    ? (await stripe.products.update(product.stripeProductId, params, opts)).id
    : (await stripe.products.create(params, opts)).id;
  if (stripeProductId !== product.stripeProductId) {
    await prisma.product.update({ where: { id: product.id }, data: { stripeProductId } });
  }

  for (const variant of product.variants) {
    const needsPrice = !variant.stripePriceId;
    if (!needsPrice) continue;
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: variant.priceAmount,
        currency: variant.currency,
      },
      opts,
    );
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stripePriceId: price.id },
    });
  }
}
```

(Price edits create a NEW immutable Price and repoint — the admin clears `stripePriceId` on a price change so this re-creates it; archiving the old Price is a P3 refinement.)

- [ ] **Step 2: Write the failing test for product creation** (`tests/commerce-product-service.test.ts` will also cover Task 5; here add the create/handle-uniqueness behavior). Because the route needs `withSite` mocked, follow the `vi.hoisted` mock pattern used in `tests/domains-api.test.ts` (record the role arg; assert `EDITOR`). Stub Stripe sync by mocking `@/lib/commerce/sync` so no network call happens:

```ts
import { describe, it, expect, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const state = vi.hoisted(() => ({ siteId: "", roleCalls: [] as string[] }));
vi.mock("@/lib/api/api-handler", () => ({
  withSite: (fn: (c: { site: { id: string } }) => unknown) => fn({ site: { id: state.siteId } }),
  withSiteRole: (min: string, fn: (c: { site: { id: string } }) => unknown) => {
    state.roleCalls.push(min);
    return fn({ site: { id: state.siteId } });
  },
}));
vi.mock("@/lib/commerce/sync", () => ({ syncProductToStripe: vi.fn(async () => {}) }));

const prisma = new PrismaClient();
const wsIds: string[] = [];
afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

describe("POST /api/products", () => {
  it("creates a product with a Default variant and rejects a duplicate handle", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    state.siteId = site.id;
    const { POST } = await import("@/app/api/products/route");

    const ok = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: JSON.stringify({ title: "Tee", handle: "tee" }),
      }),
    );
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.product.handle).toBe("tee");
    expect(body.product.variants.length).toBe(1);
    expect(state.roleCalls).toContain("EDITOR");

    const dup = await POST(
      new Request("http://x/api/products", {
        method: "POST",
        body: JSON.stringify({ title: "Tee2", handle: "tee" }),
      }),
    );
    expect(dup.status).toBe(409);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.** Run: `npx vitest run tests/commerce-product-service.test.ts`

- [ ] **Step 4: Implement `app/api/products/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, created, badRequest } from "@/lib/api/api-response";
import { slugify } from "@/lib/utils";
import { syncProductToStripe } from "@/lib/commerce/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  return withSite(async (ctx) => {
    const products = await prisma.product.findMany({
      where: { siteId: ctx.site.id },
      include: {
        variants: { orderBy: { position: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ products });
  });
}

export async function POST(req: Request) {
  return withSiteRole("EDITOR", async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim() || "Untitled product";
    const handle = slugify(String(body?.handle ?? title)).slice(0, 80);
    if (!handle) return badRequest("Invalid handle");
    const existing = await prisma.product.findUnique({
      where: { siteId_handle: { siteId: ctx.site.id, handle } },
    });
    if (existing) return json({ error: "That handle is already in use" }, 409);
    const product = await prisma.product.create({
      data: {
        siteId: ctx.site.id,
        handle,
        title,
        variants: { create: { siteId: ctx.site.id, title: "Default" } },
      },
      include: { variants: true, images: true },
    });
    await syncProductToStripe(ctx.site.id, product.id).catch(() => {});
    return created({ product });
  });
}
```

- [ ] **Step 5: Implement `app/api/products/[id]/route.ts`** (GET one, PATCH product + variants/images, DELETE)

```ts
import { prisma } from "@/lib/prisma";
import { withSite, withSiteRole } from "@/lib/api/api-handler";
import { json, notFound } from "@/lib/api/api-response";
import { syncProductToStripe } from "@/lib/commerce/sync";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSite(async (ctx) => {
    const product = await prisma.product.findFirst({
      where: { id, siteId: ctx.site.id },
      include: {
        variants: { orderBy: { position: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
    });
    if (!product) return notFound();
    return json({ product });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("EDITOR", async (ctx) => {
    const product = await prisma.product.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!product) return notFound();
    const body = await req.json().catch(() => ({}));

    const data: Record<string, unknown> = {};
    if (typeof body?.title === "string") data.title = body.title;
    if (typeof body?.description === "string") data.description = body.description;
    if (typeof body?.status === "string") data.status = body.status;
    if (typeof body?.data === "string") data.data = body.data;
    if (Object.keys(data).length) await prisma.product.update({ where: { id }, data });

    if (Array.isArray(body?.variants)) {
      for (const v of body.variants) {
        if (typeof v?.id !== "string") continue;
        const priceChanged = typeof v?.priceAmount === "number";
        await prisma.productVariant.updateMany({
          where: { id: v.id, siteId: ctx.site.id },
          data: {
            ...(typeof v.title === "string" ? { title: v.title } : {}),
            ...(typeof v.options === "string" ? { options: v.options } : {}),
            ...(typeof v.sku === "string" ? { sku: v.sku } : {}),
            ...(typeof v.priceAmount === "number" ? { priceAmount: v.priceAmount } : {}),
            ...(typeof v.inventory === "number" ? { inventory: v.inventory } : {}),
            ...(typeof v.inventoryPolicy === "string"
              ? { inventoryPolicy: v.inventoryPolicy }
              : {}),
            ...(priceChanged ? { stripePriceId: null } : {}),
          },
        });
      }
    }

    if (Array.isArray(body?.images)) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      await prisma.productImage.createMany({
        data: body.images
          .filter((im: { url?: unknown }) => typeof im?.url === "string")
          .map((im: { url: string; alt?: string }, idx: number) => ({
            productId: id,
            url: im.url,
            alt: typeof im.alt === "string" ? im.alt : "",
            position: idx,
          })),
      });
    }

    await syncProductToStripe(ctx.site.id, id).catch(() => {});
    const updated = await prisma.product.findFirst({
      where: { id, siteId: ctx.site.id },
      include: {
        variants: { orderBy: { position: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
    });
    return json({ product: updated });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSiteRole("EDITOR", async (ctx) => {
    const product = await prisma.product.findFirst({ where: { id, siteId: ctx.site.id } });
    if (!product) return notFound();
    await prisma.product.delete({ where: { id } });
    return json({ ok: true });
  });
}
```

- [ ] **Step 6: Run — expect PASS.** Run: `npx vitest run tests/commerce-product-service.test.ts`

- [ ] **Step 7: Register endpoints + gate + commit**

In `lib/api/endpoints.ts` add:

```ts
  products: {
    list: "/api/products",
    byId: (id: string) => `/api/products/${id}`,
  },
```

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`

```bash
git add lib/commerce/sync.ts app/api/products lib/api/endpoints.ts tests/commerce-product-service.test.ts
git commit -m "feat(commerce): product/variant CRUD API + best-effort Stripe sync"
```

---

## Task 5: Product data layer + provider + BlockRenderer threading

**Files:** Create `lib/commerce/product-service.ts`, `components/store/products-context.tsx`; modify `components/BlockRenderer.tsx`. Test: extend `tests/commerce-product-service.test.ts`.

**Interfaces — Produces:** `type StoreProduct` + `type ProductMap = Record<string, StoreProduct>`; `buildProductMap(rows): ProductMap`; `ProductsProvider`, `useProducts()`.

- [ ] **Step 1: Write the failing test for `buildProductMap`** (append to `tests/commerce-product-service.test.ts`):

```ts
import { buildProductMap } from "@/lib/commerce/product-service";

describe("buildProductMap", () => {
  it("shapes rows into an id-keyed product map with parsed variants", () => {
    const map = buildProductMap([
      {
        id: "p1",
        handle: "tee",
        title: "Tee",
        description: "",
        status: "active",
        data: '{"vendor":"Acme"}',
        images: [{ url: "/a.png", alt: "", position: 0 }],
        variants: [
          {
            id: "v1",
            title: "S",
            options: '{"Size":"S"}',
            priceAmount: 1500,
            currency: "usd",
            inventory: 3,
            inventoryPolicy: "deny",
          },
        ],
      },
    ]);
    expect(map.p1.handle).toBe("tee");
    expect(map.p1.data.vendor).toBe("Acme");
    expect(map.p1.variants[0].priceAmount).toBe(1500);
    expect(map.p1.minPrice).toEqual({ amount: 1500, currency: "usd" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run tests/commerce-product-service.test.ts`

- [ ] **Step 3: Implement `lib/commerce/product-service.ts`**

```ts
import { minVariantPrice, parseOptions } from "@/lib/commerce/pricing";

export type StoreVariant = {
  id: string;
  title: string;
  options: Record<string, string>;
  priceAmount: number;
  currency: string;
  inventory: number;
  inventoryPolicy: string;
};

export type StoreProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  data: Record<string, string>;
  images: { url: string; alt: string }[];
  variants: StoreVariant[];
  minPrice: { amount: number; currency: string } | null;
};

export type ProductMap = Record<string, StoreProduct>;

type Row = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  data: string;
  images: { url: string; alt: string; position: number }[];
  variants: {
    id: string;
    title: string;
    options: string;
    priceAmount: number;
    currency: string;
    inventory: number;
    inventoryPolicy: string;
  }[];
};

function parseData(s: string): Record<string, string> {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) out[k] = String(val);
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function buildProductMap(rows: Row[]): ProductMap {
  const map: ProductMap = {};
  for (const r of rows) {
    const variants = r.variants.map((v) => ({
      id: v.id,
      title: v.title,
      options: parseOptions(v.options),
      priceAmount: v.priceAmount,
      currency: v.currency,
      inventory: v.inventory,
      inventoryPolicy: v.inventoryPolicy,
    }));
    map[r.id] = {
      id: r.id,
      handle: r.handle,
      title: r.title,
      description: r.description,
      status: r.status,
      data: parseData(r.data),
      images: r.images.map((i) => ({ url: i.url, alt: i.alt })),
      variants,
      minPrice: minVariantPrice(variants),
    };
  }
  return map;
}
```

- [ ] **Step 4: Implement `components/store/products-context.tsx`**

```tsx
"use client";

import { createContext, useContext } from "react";
import type { ProductMap } from "@/lib/commerce/product-service";

const ProductsCtx = createContext<{ map: ProductMap }>({ map: {} });

export const ProductsProvider = ProductsCtx.Provider;
export const useProducts = () => useContext(ProductsCtx);
```

- [ ] **Step 5: Thread `products` through `BlockRenderer`**

In `components/BlockRenderer.tsx`: import `ProductsProvider` + `ProductMap`, add an optional `products?: ProductMap` prop, and wrap the rendered subtree in `<ProductsProvider value={{ map: products ?? {} }}>` exactly as `CollectionsProvider` already wraps it (nest the two providers). Mirror the existing collections wrapping — do not change the collections behavior.

- [ ] **Step 6: Run + gate + commit.** Run: `npx vitest run tests/commerce-product-service.test.ts && npx tsc --noEmit && npx eslint .`

```bash
git add lib/commerce/product-service.ts components/store/products-context.tsx components/BlockRenderer.tsx tests/commerce-product-service.test.ts
git commit -m "feat(commerce): product map service + ProductsProvider + BlockRenderer threading"
```

---

## Task 6: Storefront blocks — ProductGrid + Product

**Files:** Create `components/blocks/commerce.defs.ts`, `components/blocks/product-grid.tsx`, `components/blocks/product.tsx`; modify `lib/types.ts`, `lib/blocks/registry.ts`. Test: `tests/commerce-blocks.test.ts`.

**Interfaces — Consumes:** `useProducts`, `formatMoney`, `BlockRenderProps`.

- [ ] **Step 1: Add the `"Commerce"` block category**

In `lib/types.ts`, change `BlockCategory` to include `"Commerce"`:

```ts
export type BlockCategory = "Layout" | "Basic" | "Sections" | "Dynamic" | "Commerce";
```

- [ ] **Step 2: Write the failing block-defs test — `tests/commerce-blocks.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { commerceBlocks } from "@/components/blocks/commerce.defs";

describe("commerce block defs", () => {
  it("registers product-grid and product with Commerce category and required fields", () => {
    const types = commerceBlocks.map((b) => b.type);
    expect(types).toEqual(["product-grid", "product"]);
    for (const b of commerceBlocks) {
      expect(b.category).toBe("Commerce");
      expect(typeof b.label).toBe("string");
      expect(b.defaultProps).toBeTypeOf("object");
      expect(b.defaultStyles).toBeTypeOf("object");
      expect(typeof b.Render).toBe("function");
    }
  });
});
```

- [ ] **Step 3: Run — expect FAIL.** Run: `npx vitest run tests/commerce-blocks.test.ts`

- [ ] **Step 4: Implement `components/blocks/product-grid.tsx`** (lists products from context, links to `/store/<handle>`)

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { useProducts } from "@/components/store/products-context";
import { formatMoney } from "@/lib/commerce/pricing";

export function ProductGridBlock({ block, editable, style, className, id }: BlockRenderProps) {
  const { map } = useProducts();
  const { columns = "3" } = block.props as { columns?: string };
  const products = Object.values(map).filter((p) => p.status === "active");
  const cols = Math.max(1, Math.min(Number(columns) || 3, 4));

  if (products.length === 0) {
    if (!editable) return null;
    return (
      <section id={id} className={cn("w-full", className)} style={style}>
        <div className="mx-auto max-w-6xl px-6 py-16 text-center text-sm text-slate-400">
          No active products yet — add products in the Store admin.
        </div>
      </section>
    );
  }

  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div
        className="mx-auto grid max-w-6xl gap-6 px-6 py-16"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {products.map((p) => {
          const href = editable ? undefined : `/store/${p.handle}`;
          const Tag = (href ? "a" : "div") as React.ElementType;
          return (
            <Tag
              key={p.id}
              {...(href ? { href } : {})}
              className="group flex flex-col overflow-hidden border border-slate-200 bg-white no-underline shadow-sm transition-shadow hover:shadow-md"
              style={{ borderRadius: "var(--pc-radius, 16px)" }}
            >
              {p.images[0] && (
                <div className="aspect-[4/5] w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.images[0].url}
                    alt={p.images[0].alt || p.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
                {p.minPrice && (
                  <div className="mt-1 text-sm text-slate-500">
                    {formatMoney(p.minPrice.amount, p.minPrice.currency)}
                  </div>
                )}
              </div>
            </Tag>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Implement `components/blocks/product.tsx`** (single product: gallery, title, description, price, variant selector — display only in P1; the interactive Add-to-Cart wires in P2 Task 12)

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { useProducts } from "@/components/store/products-context";
import { formatMoney, variantForOptions } from "@/lib/commerce/pricing";

export function ProductBlock({ block, editable, style, className, id }: BlockRenderProps) {
  const { map } = useProducts();
  const { productId = "" } = block.props as { productId?: string };
  const product = productId ? map[productId] : Object.values(map)[0];
  const [selected, setSelected] = useState<Record<string, string>>({});

  if (!product) {
    if (!editable) return null;
    return (
      <section id={id} className={cn("w-full", className)} style={style}>
        <div className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-slate-400">
          Product block — open this on a product page, or pick a product in the inspector.
        </div>
      </section>
    );
  }

  const optionNames = Array.from(new Set(product.variants.flatMap((v) => Object.keys(v.options))));
  const matchedId = variantForOptions(product.variants, selected) ?? product.variants[0]?.id;
  const matched = product.variants.find((v) => v.id === matchedId) ?? product.variants[0];

  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-slate-100">
          {product.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0].url}
              alt={product.images[0].alt || product.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{product.title}</h1>
          {matched && (
            <div className="mt-2 text-xl text-slate-700">
              {formatMoney(matched.priceAmount, matched.currency)}
            </div>
          )}
          {product.description && (
            <p className="mt-4 whitespace-pre-line text-slate-600">{product.description}</p>
          )}
          {optionNames.map((name) => {
            const values = Array.from(
              new Set(product.variants.map((v) => v.options[name]).filter(Boolean)),
            );
            return (
              <div key={name} className="mt-6">
                <label className="text-sm font-medium text-slate-700">{name}</label>
                <select
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={selected[name] ?? ""}
                  onChange={(e) => setSelected((s) => ({ ...s, [name]: e.target.value }))}
                >
                  <option value="">Select {name}</option>
                  {values.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <div className="mt-8 text-xs text-slate-400" data-variant-id={matched?.id}>
            {matched && matched.inventory === 0 && matched.inventoryPolicy === "deny"
              ? "Out of stock"
              : "In stock"}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Implement `components/blocks/commerce.defs.ts`**

```ts
import { ShoppingBag, Package } from "lucide-react";
import type { BlockDefinition } from "@/lib/blocks/registry-types";
import { ProductGridBlock } from "./product-grid";
import { ProductBlock } from "./product";

export const commerceBlocks: BlockDefinition[] = [
  {
    type: "product-grid",
    label: "Product Grid",
    icon: ShoppingBag,
    category: "Commerce",
    description: "Show this store's active products in a grid",
    defaultProps: { columns: "3" },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      {
        key: "columns",
        label: "Columns",
        type: "select",
        options: [
          { label: "2", value: "2" },
          { label: "3", value: "3" },
          { label: "4", value: "4" },
        ],
      },
    ],
    styleGroups: ["background", "spacing"],
    Render: ProductGridBlock,
  },
  {
    type: "product",
    label: "Product",
    icon: Package,
    category: "Commerce",
    description: "Render a single product with variant selector",
    defaultProps: { productId: "" },
    defaultStyles: { desktop: { backgroundColor: "#ffffff" } },
    fields: [
      {
        key: "productId",
        label: "Product ID",
        type: "text",
        placeholder: "leave blank on a product page",
      },
    ],
    styleGroups: ["background", "spacing"],
    Render: ProductBlock,
  },
];
```

(Confirm `SettingField.type` values — `"select"`, `"text"` — against `lib/types.ts`'s `FieldType`; adjust the field `type` strings to the exact union members.)

- [ ] **Step 7: Register in `lib/blocks/registry.ts`**

Import `commerceBlocks`, spread into `ALL_BLOCKS`, and add to `CATEGORIES`:

```ts
  { name: "Commerce", types: ["product-grid", "product"] },
```

- [ ] **Step 8: Run + gate + commit.** Run: `npx vitest run tests/commerce-blocks.test.ts && npx tsc --noEmit && npx eslint . && npx prettier --check .`

```bash
git add lib/types.ts lib/blocks/registry.ts components/blocks/commerce.defs.ts components/blocks/product-grid.tsx components/blocks/product.tsx tests/commerce-blocks.test.ts
git commit -m "feat(commerce): ProductGrid + Product storefront blocks (Commerce category)"
```

---

## Task 7: Storefront routes + proxy allowlist

**Files:** Create `app/store/page.tsx`, `app/store/[handle]/page.tsx`; modify `proxy.ts`.

- [ ] **Step 1: Allowlist `/store/` in `proxy.ts`**

In `proxy.ts`, add `"/store/"` and `"/store"` to BOTH the app-host public early-return (next to `/p/`, `/c/`) AND ensure `customDomainRewrite` passes `/store` through unchanged. For `customDomainRewrite` (in `lib/domains/host.ts`), add `"/store"` to the `PASSTHROUGH` prefixes so a custom-domain `/store/<handle>` is NOT rewritten to `/p/...`. (Add a host-test case to `tests/domains-host.test.ts`: `customDomainRewrite("/store/tee")` → `null`.)

In `proxy.ts`'s app-host branch, add `pathname.startsWith("/store")` to the never-gate condition alongside `/p/`, `/c/`, `/internal/`.

- [ ] **Step 2: Storefront index — `app/store/page.tsx`** (host → site → active products → ProductGrid context)

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/request-host";
import { getActiveSite } from "@/lib/auth/site";
import { buildProductMap } from "@/lib/commerce/product-service";
import { parseContent } from "@/lib/page-service";
import { parseDesignSystem, designSystemCss } from "@/lib/design/design-system";
import { responsiveCss } from "@/lib/blocks/styles";
import { ProductsProvider } from "@/components/store/products-context";
import { BlockRenderer } from "@/components/BlockRenderer";

export const dynamic = "force-dynamic";

async function resolveStoreSiteId(): Promise<string | null> {
  const resolved = await resolveHostSite(await requestHost());
  if (resolved) return resolved.siteId;
  const ctx = await getActiveSite();
  return ctx?.site.id ?? null;
}

export default async function StoreIndex() {
  const siteId = await resolveStoreSiteId();
  if (!siteId) notFound();
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  const store = await prisma.store.findUnique({ where: { siteId } });
  if (!site || !store) notFound();

  const products = await prisma.product.findMany({
    where: { siteId, status: "active" },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const map = buildProductMap(products);

  const header = parseContent(site.header);
  const footer = parseContent(site.footer);
  const grid = [
    { id: "store-grid", type: "product-grid", props: { columns: "3" }, styles: {}, children: [] },
  ];
  const ds = parseDesignSystem(site);
  const css =
    designSystemCss(ds.colors, ds.textStyles) +
    "\n" +
    responsiveCss([...header, ...grid, ...footer]);

  return (
    <ProductsProvider value={{ map }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main>
        {header.length > 0 && (
          <BlockRenderer
            tree={header}
            viewport="desktop"
            animate
            inlineStyles={false}
            products={map}
          />
        )}
        <BlockRenderer tree={grid} viewport="desktop" animate inlineStyles={false} products={map} />
        {footer.length > 0 && (
          <BlockRenderer
            tree={footer}
            viewport="desktop"
            animate
            inlineStyles={false}
            products={map}
          />
        )}
      </main>
    </ProductsProvider>
  );
}
```

(Confirm `parseContent`, `parseDesignSystem`, `designSystemCss`, `responsiveCss` import paths against `app/c/[slug]/[item]/page.tsx` — reuse exactly what it imports. The `ProductsProvider` wrap is belt-and-suspenders with `BlockRenderer`'s own provider; keep both consistent with how the CMS page wraps collections.)

- [ ] **Step 3: Product detail — `app/store/[handle]/page.tsx`** (host → site → product by handle → `Store.productTemplate` filled with tokens + a `product` block)

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/request-host";
import { getActiveSite } from "@/lib/auth/site";
import { buildProductMap } from "@/lib/commerce/product-service";
import { formatMoney } from "@/lib/commerce/pricing";
import { parseContent } from "@/lib/page-service";
import { applyTokens } from "@/lib/cms/cms-tokens";
import { parseDesignSystem, designSystemCss } from "@/lib/design/design-system";
import { responsiveCss } from "@/lib/blocks/styles";
import { ProductsProvider } from "@/components/store/products-context";
import { BlockRenderer } from "@/components/BlockRenderer";

export const dynamic = "force-dynamic";

async function resolveStoreSiteId(): Promise<string | null> {
  const resolved = await resolveHostSite(await requestHost());
  if (resolved) return resolved.siteId;
  const ctx = await getActiveSite();
  return ctx?.site.id ?? null;
}

export default async function ProductDetail({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const siteId = await resolveStoreSiteId();
  if (!siteId) notFound();
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  const store = await prisma.store.findUnique({ where: { siteId } });
  if (!site || !store) notFound();

  const product = await prisma.product.findFirst({
    where: { siteId, handle, status: "active" },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product) notFound();

  const map = buildProductMap([product]);
  const sp = map[product.id];
  const tokenData: Record<string, string> = {
    title: sp.title,
    description: sp.description,
    price: sp.minPrice ? formatMoney(sp.minPrice.amount, sp.minPrice.currency) : "",
    image: sp.images[0]?.url ?? "",
    ...sp.data,
  };

  const templateRaw = parseContent(store.productTemplate);
  const template = templateRaw.length
    ? templateRaw
    : [
        {
          id: "auto-product",
          type: "product",
          props: { productId: product.id },
          styles: {},
          children: [],
        },
      ];
  const tree = applyTokens(template, tokenData);

  const header = parseContent(site.header);
  const footer = parseContent(site.footer);
  const ds = parseDesignSystem(site);
  const css =
    designSystemCss(ds.colors, ds.textStyles) +
    "\n" +
    responsiveCss([...header, ...tree, ...footer]);

  return (
    <ProductsProvider value={{ map }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main>
        {header.length > 0 && (
          <BlockRenderer
            tree={header}
            viewport="desktop"
            animate
            inlineStyles={false}
            products={map}
          />
        )}
        <BlockRenderer tree={tree} viewport="desktop" animate inlineStyles={false} products={map} />
        {footer.length > 0 && (
          <BlockRenderer
            tree={footer}
            viewport="desktop"
            animate
            inlineStyles={false}
            products={map}
          />
        )}
      </main>
    </ProductsProvider>
  );
}
```

- [ ] **Step 4: Gate + commit.** Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`

```bash
git add app/store proxy.ts lib/domains/host.ts tests/domains-host.test.ts
git commit -m "feat(commerce): host-scoped /store index + product detail routes + proxy allowlist"
```

---

## Task 8: Store admin (Products + Store settings)

**Files:** Create `app/(app)/store/page.tsx`, `components/store/StoreAdmin.tsx`, `components/store/ProductEditor.tsx`.

This is the builder-side catalog manager — server page guarded by `getActiveSite`, handing off to a client manager that uses `api` + `endpoints`. Keep it lean and functional.

- [ ] **Step 1: Server page — `app/(app)/store/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveSite } from "@/lib/auth/site";
import { StoreAdmin } from "@/components/store/StoreAdmin";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const ctx = await getActiveSite();
  if (!ctx) redirect("/onboarding");
  const store = await prisma.store.findUnique({ where: { siteId: ctx.site.id } });
  const products = await prisma.product.findMany({
    where: { siteId: ctx.site.id },
    include: {
      variants: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <StoreAdmin initialStore={store} initialProducts={JSON.parse(JSON.stringify(products))} />;
}
```

- [ ] **Step 2: Client manager — `components/store/StoreAdmin.tsx`** (Connect status + product list + create; opens `ProductEditor`)

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { ProductEditor, type EditableProduct } from "./ProductEditor";

type Store = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  currency: string;
  taxEnabled: boolean;
} | null;

export function StoreAdmin({
  initialStore,
  initialProducts,
}: {
  initialStore: Store;
  initialProducts: EditableProduct[];
}) {
  const [store] = useState<Store>(initialStore);
  const [products, setProducts] = useState<EditableProduct[]>(initialProducts);
  const [editing, setEditing] = useState<EditableProduct | null>(null);

  async function connect() {
    const { data } = await api.post<{ url: string }>(endpoints.store.connect, {});
    window.location.href = data.url;
  }
  async function create() {
    const title = window.prompt("Product title", "New product");
    if (!title) return;
    const { data } = await api.post<{ product: EditableProduct }>(endpoints.products.list, {
      title,
    });
    setProducts((p) => [data.product, ...p]);
    setEditing(data.product);
  }
  async function refresh() {
    const { data } = await api.get<{ products: EditableProduct[] }>(endpoints.products.list);
    setProducts(data.products);
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Store</h1>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white" onClick={create}>
          New product
        </button>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-medium">Stripe</div>
        {store?.chargesEnabled ? (
          <div className="mt-1 text-sm text-green-600">Connected — charges enabled</div>
        ) : (
          <button className="mt-2 rounded-lg border px-3 py-1.5 text-sm" onClick={connect}>
            {store?.stripeAccountId ? "Finish Stripe onboarding" : "Connect Stripe"}
          </button>
        )}
      </div>

      <div className="divide-y rounded-xl border border-slate-200">
        {products.map((p) => (
          <button
            key={p.id}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50"
            onClick={() => setEditing(p)}
          >
            <span className="font-medium">{p.title}</span>
            <span className="text-xs uppercase text-slate-400">{p.status}</span>
          </button>
        ))}
        {products.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">No products yet.</div>
        )}
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Product editor — `components/store/ProductEditor.tsx`** (title/description/status, the Default variant's price + inventory, an image URL via `AssetPicker`, AI description; saves via `PATCH /api/products/[id]`)

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { AssetPicker } from "@/components/editor/AssetPicker";

export type EditableProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  variants: { id: string; title: string; priceAmount: number; inventory: number }[];
  images: { url: string; alt: string }[];
};

export function ProductEditor({
  product,
  onClose,
}: {
  product: EditableProduct;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [status, setStatus] = useState(product.status);
  const [price, setPrice] = useState((product.variants[0]?.priceAmount ?? 0) / 100);
  const [inventory, setInventory] = useState(product.variants[0]?.inventory ?? 0);
  const [images, setImages] = useState(product.images);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await api.patch(endpoints.products.byId(product.id), {
      title,
      description,
      status,
      variants: [{ id: product.variants[0]?.id, priceAmount: Math.round(price * 100), inventory }],
      images,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Edit product</h2>
        <label className="block text-sm font-medium">Title</label>
        <input
          className="mt-1 mb-3 w-full rounded-lg border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="mt-1 mb-3 w-full rounded-lg border px-3 py-2"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Price</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Inventory</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={inventory}
              onChange={(e) => setInventory(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Status</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => setPicking(true)}
          >
            Add image
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={im.url} alt={im.alt} className="h-16 w-16 rounded object-cover" />
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <AssetPicker
        open={picking}
        kind="image"
        onClose={() => setPicking(false)}
        onSelect={(url) => {
          setImages((im) => [...im, { url, alt: "" }]);
          setPicking(false);
        }}
      />
    </div>
  );
}
```

(`AssetPicker.onSelect` yields only a URL — `ProductImage.assetId` stays null, `url` is the denormalized render value, which is all the storefront needs. The "Generate description" → `/api/ai` action is a follow-up; not required for the P1 gate.)

- [ ] **Step 4: Add the Store nav entry** wherever the app sidebar lists `cms`/`design`/`settings` (mirror an existing entry; link to `/store`). Find the sidebar nav file and add the item with a `ShoppingBag` icon.

- [ ] **Step 5: Gate + commit.** Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`

```bash
git add "app/(app)/store" components/store/StoreAdmin.tsx components/store/ProductEditor.tsx
git commit -m "feat(commerce): store admin — products manager + Stripe connect status"
```

> **End of P1.** A store-Site has a catalog; products sync to Stripe; `/store` + `/store/<handle>` browse them on the store's host. No payment yet.

---

---

# PHASE 2 — Cart, Checkout, Order settlement

## Task 9: Commerce P2 models (Cart, CartItem, Order, OrderItem)

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the models** (+ `Site` relations `carts Cart[]`, `orders Order[]`)

```prisma
model Cart {
  id                      String   @id @default(cuid())
  siteId                  String
  site                    Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  token                   String   @unique
  email                   String?
  currency                String   @default("usd")
  status                  String   @default("open")
  stripeCheckoutSessionId String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  items CartItem[]

  @@index([siteId])
}

model CartItem {
  id         String   @id @default(cuid())
  cartId     String
  cart       Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId  String
  quantity   Int      @default(1)
  unitAmount Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([cartId])
}

model Order {
  id                      String   @id @default(cuid())
  siteId                  String
  site                    Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  number                  Int
  email                   String
  status                  String   @default("pending")
  currency                String   @default("usd")
  subtotalAmount          Int      @default(0)
  shippingAmount          Int      @default(0)
  taxAmount               Int      @default(0)
  discountAmount          Int      @default(0)
  totalAmount             Int      @default(0)
  shippingAddress         String   @default("{}")
  stripeCheckoutSessionId String?  @unique
  stripePaymentIntentId   String?
  stripeCustomerId        String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  items OrderItem[]

  @@unique([siteId, number])
  @@index([siteId])
  @@index([stripePaymentIntentId])
}

model OrderItem {
  id           String   @id @default(cuid())
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId    String
  productTitle String
  variantTitle String
  sku          String?
  quantity     Int
  unitAmount   Int
  createdAt    DateTime @default(now())

  @@index([orderId])
}
```

- [ ] **Step 2: Push + regenerate + confirm.** Run: `npx prisma db push && npx prisma generate` then `npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); Promise.all([p.cart.count(),p.order.count()]).then(r=>{console.log('ok',r);return p.\$disconnect()})"` → `ok [ 0, 0 ]`.

- [ ] **Step 3: Commit.** `git add prisma/schema.prisma && git commit -m "feat(db): commerce P2 models (Cart, CartItem, Order, OrderItem)"`

---

## Task 10: Cart math helpers (pure, unit-tested)

**Files:** Create `lib/commerce/cart.ts`, `tests/commerce-cart.test.ts`

**Interfaces — Produces:** `cartSubtotal(items)`, `clampQuantity(requested, available, policy)`, `cartLineCount(items)`.

- [ ] **Step 1: Write the failing tests — `tests/commerce-cart.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { cartSubtotal, clampQuantity, cartLineCount } from "@/lib/commerce/cart";

describe("cart math", () => {
  it("sums line totals", () => {
    expect(
      cartSubtotal([
        { unitAmount: 1500, quantity: 2 },
        { unitAmount: 500, quantity: 1 },
      ]),
    ).toBe(3500);
    expect(cartSubtotal([])).toBe(0);
  });
  it("counts total units", () => {
    expect(cartLineCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });
  it("clamps quantity to available stock under deny, allows under continue", () => {
    expect(clampQuantity(5, 3, "deny")).toBe(3);
    expect(clampQuantity(2, 3, "deny")).toBe(2);
    expect(clampQuantity(5, 3, "continue")).toBe(5);
    expect(clampQuantity(5, -1, "deny")).toBe(5);
    expect(clampQuantity(0, 3, "deny")).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run tests/commerce-cart.test.ts`

- [ ] **Step 3: Implement `lib/commerce/cart.ts`**

```ts
export function cartSubtotal(items: { unitAmount: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
}

export function cartLineCount(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function clampQuantity(requested: number, available: number, policy: string): number {
  const q = Math.max(1, Math.floor(requested));
  if (policy === "continue" || available < 0) return q;
  return Math.min(q, Math.max(1, available));
}
```

- [ ] **Step 4: Run — expect PASS, commit.** Run: `npx vitest run tests/commerce-cart.test.ts`

```bash
git add lib/commerce/cart.ts tests/commerce-cart.test.ts
git commit -m "feat(commerce): cart math helpers (subtotal, line count, quantity clamp)"
```

---

## Task 11: Cart API + `pc_cart` cookie

**Files:** Create `lib/commerce/cart-cookie.ts`, `app/api/cart/route.ts`, `app/api/cart/items/route.ts`, `app/api/cart/items/[id]/route.ts`; modify `lib/api/endpoints.ts`.

Carts are resolved from the **host** (store-Site) + the opaque `pc_cart` token cookie — not a builder session.

**Interfaces — Produces:** `getOrCreateCart(siteId): Promise<Cart>` (reads/sets `pc_cart`), `getCart(siteId): Promise<Cart | null>`, `storeSiteIdFromHost(): Promise<string | null>`.

- [ ] **Step 1: Cart resolution — `lib/commerce/cart-cookie.ts`**

```ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveHostSite } from "@/lib/domains/resolve";
import { requestHost } from "@/lib/domains/request-host";
import { getActiveSite } from "@/lib/auth/site";

const CART_COOKIE = "pc_cart";

export async function storeSiteIdFromHost(): Promise<string | null> {
  const resolved = await resolveHostSite(await requestHost());
  if (resolved) return resolved.siteId;
  const ctx = await getActiveSite();
  return ctx?.site.id ?? null;
}

export async function getCart(siteId: string) {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return null;
  return prisma.cart.findFirst({
    where: { token, siteId, status: "open" },
    include: { items: true },
  });
}

export async function getOrCreateCart(siteId: string) {
  const existing = await getCart(siteId);
  if (existing) return existing;
  const jar = await cookies();
  const cart = await prisma.cart.create({ data: { siteId } });
  jar.set(CART_COOKIE, cart.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return prisma.cart.findUnique({ where: { id: cart.id }, include: { items: true } });
}
```

(`Cart.token` is `@unique` with a `cuid()` default — set it via the model default; if the schema needs an explicit default, add `@default(cuid())` to `Cart.token` in Task 9. **Add `@default(cuid())` to `Cart.token` now if not present.**)

- [ ] **Step 2: Cart GET — `app/api/cart/route.ts`**

```ts
import { json, notFound } from "@/lib/api/api-response";
import { storeSiteIdFromHost, getCart } from "@/lib/commerce/cart-cookie";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const cart = await getCart(siteId);
  return json({ cart: cart ?? { items: [] } });
}
```

- [ ] **Step 3: Add item — `app/api/cart/items/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound } from "@/lib/api/api-response";
import { storeSiteIdFromHost, getOrCreateCart } from "@/lib/commerce/cart-cookie";
import { clampQuantity } from "@/lib/commerce/cart";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const body = await req.json().catch(() => ({}));
  const variantId = String(body?.variantId ?? "");
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, siteId } });
  if (!variant) return badRequest("Unknown variant");

  const cart = await getOrCreateCart(siteId);
  if (!cart) return badRequest("No cart");
  const requested = Number(body?.quantity ?? 1);
  const existing = cart.items.find((i) => i.variantId === variantId);
  const desired = (existing?.quantity ?? 0) + requested;
  const qty = clampQuantity(desired, variant.inventory, variant.inventoryPolicy);

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: qty, unitAmount: variant.priceAmount },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId, quantity: qty, unitAmount: variant.priceAmount },
    });
  }
  const updated = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: true },
  });
  return json({ cart: updated });
}
```

- [ ] **Step 4: Update/remove item — `app/api/cart/items/[id]/route.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { json, notFound } from "@/lib/api/api-response";
import { storeSiteIdFromHost, getCart } from "@/lib/commerce/cart-cookie";
import { clampQuantity } from "@/lib/commerce/cart";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const cart = await getCart(siteId);
  const item = cart?.items.find((i) => i.id === id);
  if (!cart || !item) return notFound();
  const variant = await prisma.productVariant.findFirst({ where: { id: item.variantId, siteId } });
  const body = await req.json().catch(() => ({}));
  const qty = clampQuantity(
    Number(body?.quantity ?? 1),
    variant?.inventory ?? -1,
    variant?.inventoryPolicy ?? "deny",
  );
  await prisma.cartItem.update({ where: { id }, data: { quantity: qty } });
  const updated = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: true },
  });
  return json({ cart: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const cart = await getCart(siteId);
  const item = cart?.items.find((i) => i.id === id);
  if (!cart || !item) return notFound();
  await prisma.cartItem.delete({ where: { id } });
  const updated = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: { items: true },
  });
  return json({ cart: updated });
}
```

- [ ] **Step 5: Register endpoints + gate + commit**

In `lib/api/endpoints.ts`:

```ts
  cart: {
    root: "/api/cart",
    items: "/api/cart/items",
    item: (id: string) => `/api/cart/items/${id}`,
  },
```

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`

```bash
git add lib/commerce/cart-cookie.ts app/api/cart lib/api/endpoints.ts prisma/schema.prisma
git commit -m "feat(commerce): server cart API + pc_cart cookie (host-scoped)"
```

---

## Task 12: Cart context + AddToCart/Cart/Checkout blocks

**Files:** Create `components/store/cart-context.tsx`, `components/blocks/add-to-cart.tsx`, `components/blocks/cart.tsx`, `components/blocks/checkout.tsx`; modify `components/blocks/commerce.defs.ts`, `lib/blocks/registry.ts`, `components/blocks/product.tsx` (wire the selected variant into an AddToCart). Extend `tests/commerce-blocks.test.ts` for the three new defs.

**Interfaces — Produces:** `CartProvider`, `useCart()` (`{ cart, addItem, updateItem, removeItem, refresh }`).

- [ ] **Step 1: Cart context — `components/store/cart-context.tsx`**

```tsx
"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export type ClientCart = {
  id?: string;
  items: { id: string; variantId: string; quantity: number; unitAmount: number }[];
};

type Ctx = {
  cart: ClientCart;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartCtx = createContext<Ctx>({
  cart: { items: [] },
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  refresh: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<ClientCart>({ items: [] });
  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    const { data } = await api.post<{ cart: ClientCart }>(endpoints.cart.items, {
      variantId,
      quantity,
    });
    setCart(data.cart);
  }, []);
  const updateItem = useCallback(async (id: string, quantity: number) => {
    const { data } = await api.patch<{ cart: ClientCart }>(endpoints.cart.item(id), { quantity });
    setCart(data.cart);
  }, []);
  const removeItem = useCallback(async (id: string) => {
    const { data } = await api.delete<{ cart: ClientCart }>(endpoints.cart.item(id));
    setCart(data.cart);
  }, []);
  const refresh = useCallback(async () => {
    const { data } = await api.get<{ cart: ClientCart }>(endpoints.cart.root);
    setCart(data.cart);
  }, []);
  return (
    <CartCtx.Provider value={{ cart, addItem, updateItem, removeItem, refresh }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
```

Wrap the storefront `<main>` in `app/store/page.tsx` and `app/store/[handle]/page.tsx` with `<CartProvider>` (inside `ProductsProvider`).

- [ ] **Step 2: AddToCart — `components/blocks/add-to-cart.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { useCart } from "@/components/store/cart-context";

export function AddToCartBlock({ block, editable, style, className, id }: BlockRenderProps) {
  const { addItem } = useCart();
  const { variantId = "", label = "Add to cart" } = block.props as {
    variantId?: string;
    label?: string;
  };
  return (
    <button
      id={id}
      className={cn(
        "rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50",
        className,
      )}
      style={style}
      disabled={editable || !variantId}
      onClick={() => variantId && addItem(variantId, 1)}
    >
      {String(label)}
    </button>
  );
}
```

- [ ] **Step 3: Cart block — `components/blocks/cart.tsx`** (line items, qty edit, remove, subtotal)

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { useCart } from "@/components/store/cart-context";
import { cartSubtotal } from "@/lib/commerce/cart";
import { formatMoney } from "@/lib/commerce/pricing";

export function CartBlock({ style, className, id }: BlockRenderProps) {
  const { cart, updateItem, removeItem } = useCart();
  const subtotal = cartSubtotal(cart.items);
  return (
    <section id={id} className={cn("w-full", className)} style={style}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        {cart.items.length === 0 ? (
          <p className="text-center text-sm text-slate-400">Your cart is empty.</p>
        ) : (
          <>
            {cart.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between border-b py-3">
                <span className="text-sm">{i.variantId.slice(0, 6)}</span>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    className="w-16 rounded border px-2 py-1"
                    value={i.quantity}
                    onChange={(e) => updateItem(i.id, Number(e.target.value))}
                  />
                  <span className="w-20 text-right text-sm">
                    {formatMoney(i.unitAmount * i.quantity, "usd")}
                  </span>
                  <button className="text-xs text-red-500" onClick={() => removeItem(i.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="mt-4 flex justify-between text-base font-semibold">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, "usd")}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Checkout block — `components/blocks/checkout.tsx`** (POST `/api/checkout` → redirect to `session.url`)

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";
import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export function CheckoutBlock({ block, editable, style, className, id }: BlockRenderProps) {
  const { label = "Checkout" } = block.props as { label?: string };
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const { data } = await api.post<{ url: string }>(endpoints.checkout.create, {});
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      id={id}
      className={cn(
        "rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white disabled:opacity-50",
        className,
      )}
      style={style}
      disabled={editable || busy}
      onClick={go}
    >
      {busy ? "Redirecting…" : String(label)}
    </button>
  );
}
```

- [ ] **Step 5: Register the three blocks** — add their defs to `components/blocks/commerce.defs.ts` (types `add-to-cart`, `cart`, `checkout`, category `"Commerce"`, with `label`/`variantId` props as used above), spread already happens via `commerceBlocks`, and extend the `CATEGORIES` Commerce `types` array in `registry.ts` to `["product-grid", "product", "add-to-cart", "cart", "checkout"]`. Update the `tests/commerce-blocks.test.ts` expected `types` array accordingly.

- [ ] **Step 6: Wire the Product block's selected variant** — in `components/blocks/product.tsx`, render an `AddToCartBlock`-style button using the resolved `matched.id` (call `useCart().addItem(matched.id)`), replacing the static "in stock" line with a real add-to-cart button (disabled when out of stock under `deny`).

- [ ] **Step 7: Gate + commit.** Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`

```bash
git add components/store/cart-context.tsx components/blocks/add-to-cart.tsx components/blocks/cart.tsx components/blocks/checkout.tsx components/blocks/commerce.defs.ts components/blocks/product.tsx lib/blocks/registry.ts app/store tests/commerce-blocks.test.ts
git commit -m "feat(commerce): cart context + AddToCart/Cart/Checkout blocks"
```

---

## Task 13: Checkout API (Stripe Checkout Session)

**Files:** Create `app/api/checkout/route.ts`; modify `lib/api/endpoints.ts`.

- [ ] **Step 1: Implement `app/api/checkout/route.ts`** (re-read variants for authority, build session on the connected account)

```ts
import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound } from "@/lib/api/api-response";
import { getStripe, appUrl } from "@/lib/commerce/stripe";
import { storeSiteIdFromHost, getCart } from "@/lib/commerce/cart-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const siteId = await storeSiteIdFromHost();
  if (!siteId) return notFound();
  const store = await prisma.store.findUnique({ where: { siteId } });
  if (!store?.stripeAccountId || !store.chargesEnabled)
    return badRequest("Store not ready for checkout");
  const cart = await getCart(siteId);
  if (!cart || cart.items.length === 0) return badRequest("Cart is empty");

  const line_items = [];
  for (const item of cart.items) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: item.variantId, siteId },
    });
    if (!variant?.stripePriceId) return badRequest("A product is not purchasable yet");
    line_items.push({ price: variant.stripePriceId, quantity: item.quantity });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items,
      automatic_tax: { enabled: store.taxEnabled },
      allow_promotion_codes: true,
      success_url: appUrl(`${store.successPath}?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: appUrl(store.cancelPath),
      customer_creation: "always",
      metadata: { cartId: cart.id, siteId },
    },
    {
      stripeAccount: store.stripeAccountId,
      idempotencyKey: `checkout_${cart.id}_${cart.items.length}`,
    },
  );
  await prisma.cart.update({
    where: { id: cart.id },
    data: { stripeCheckoutSessionId: session.id },
  });
  return json({ url: session.url });
}
```

- [ ] **Step 2: Register endpoint + gate + commit**

In `lib/api/endpoints.ts`:

```ts
  checkout: { create: "/api/checkout" },
```

Run: `npx tsc --noEmit && npx eslint app/api/checkout lib/api/endpoints.ts && npx prettier --check .`

```bash
git add app/api/checkout lib/api/endpoints.ts
git commit -m "feat(commerce): checkout API — Stripe Checkout Session on the connected account"
```

---

## Task 14: Webhook settlement (`checkout.session.completed` → Order)

**Files:** Create `lib/commerce/order.ts`; modify `app/api/webhooks/stripe/route.ts`. Tests: `tests/commerce-order.test.ts`, `tests/commerce-webhook.test.ts`.

**Interfaces — Produces:** `settleCheckout(session): Promise<{ created: boolean }>` — idempotent Order creation from a completed Checkout Session payload.

- [ ] **Step 1: Write the failing idempotency test — `tests/commerce-order.test.ts`** (real DB; replay → exactly one order)

```ts
import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { settleCheckout } from "@/lib/commerce/order";

const prisma = new PrismaClient();
const wsIds: string[] = [];
afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.$disconnect();
});

function sessionPayload(cartId: string, siteId: string, sessionId: string) {
  return {
    id: sessionId,
    customer_details: { email: "buyer@example.com" },
    customer: "cus_1",
    payment_intent: "pi_1",
    currency: "usd",
    amount_subtotal: 3000,
    amount_total: 3300,
    total_details: { amount_tax: 300, amount_discount: 0, amount_shipping: 0 },
    shipping_details: { address: { city: "Sofia" } },
    metadata: { cartId, siteId },
  };
}

describe("settleCheckout", () => {
  it("creates exactly one order on replay (idempotent) and converts the cart", async () => {
    const ws = await prisma.workspace.create({ data: { name: "T", slug: `t-${Date.now()}` } });
    wsIds.push(ws.id);
    const site = await prisma.site.create({ data: { workspaceId: ws.id, name: "S", handle: "s" } });
    const product = await prisma.product.create({
      data: { siteId: site.id, handle: "tee", title: "Tee" },
    });
    const variant = await prisma.productVariant.create({
      data: {
        siteId: site.id,
        productId: product.id,
        title: "Default",
        priceAmount: 1500,
        inventory: 10,
      },
    });
    const cart = await prisma.cart.create({ data: { siteId: site.id } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId: variant.id, quantity: 2, unitAmount: 1500 },
    });

    const payload = sessionPayload(cart.id, site.id, `cs_${Date.now()}`);
    const r1 = await settleCheckout(payload);
    const r2 = await settleCheckout(payload);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    const orders = await prisma.order.findMany({ where: { siteId: site.id } });
    expect(orders.length).toBe(1);
    expect(orders[0].totalAmount).toBe(3300);
    expect(orders[0].taxAmount).toBe(300);
    const reread = await prisma.cart.findUnique({ where: { id: cart.id } });
    expect(reread?.status).toBe("converted");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run tests/commerce-order.test.ts`

- [ ] **Step 3: Implement `lib/commerce/order.ts`**

```ts
import { prisma } from "@/lib/prisma";

type Session = {
  id: string;
  customer_details?: { email?: string | null } | null;
  customer?: string | null;
  payment_intent?: string | null;
  currency?: string | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  total_details?: {
    amount_tax?: number | null;
    amount_discount?: number | null;
    amount_shipping?: number | null;
  } | null;
  shipping_details?: unknown;
  metadata?: { cartId?: string; siteId?: string } | null;
};

export async function settleCheckout(session: Session): Promise<{ created: boolean }> {
  const siteId = session.metadata?.siteId;
  const cartId = session.metadata?.cartId;
  if (!siteId || !cartId) return { created: false };

  const existing = await prisma.order.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });
  if (existing) return { created: false };

  const cart = await prisma.cart.findFirst({
    where: { id: cartId, siteId },
    include: { items: true },
  });
  if (!cart) return { created: false };

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: cart.items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const vmap = new Map(variants.map((v) => [v.id, v]));

  try {
    await prisma.$transaction(async (tx) => {
      const agg = await tx.order.aggregate({ where: { siteId }, _max: { number: true } });
      const number = (agg._max.number ?? 0) + 1;
      await tx.order.create({
        data: {
          siteId,
          number,
          email: session.customer_details?.email ?? "",
          status: "paid",
          currency: session.currency ?? "usd",
          subtotalAmount: session.amount_subtotal ?? 0,
          taxAmount: session.total_details?.amount_tax ?? 0,
          shippingAmount: session.total_details?.amount_shipping ?? 0,
          discountAmount: session.total_details?.amount_discount ?? 0,
          totalAmount: session.amount_total ?? 0,
          shippingAddress: JSON.stringify(session.shipping_details ?? {}),
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent ?? null,
          stripeCustomerId: session.customer ?? null,
          items: {
            create: cart.items.map((i) => {
              const v = vmap.get(i.variantId);
              return {
                variantId: i.variantId,
                productTitle: v?.product.title ?? "",
                variantTitle: v?.title ?? "",
                sku: v?.sku ?? null,
                quantity: i.quantity,
                unitAmount: i.unitAmount,
              };
            }),
          },
        },
      });
      for (const i of cart.items) {
        const v = vmap.get(i.variantId);
        if (v && v.inventory >= 0) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: { inventory: Math.max(0, v.inventory - i.quantity) },
          });
        }
      }
      await tx.cart.update({ where: { id: cart.id }, data: { status: "converted" } });
    });
    return { created: true };
  } catch {
    return { created: false };
  }
}
```

(The `@@unique` on `stripeCheckoutSessionId` makes a concurrent duplicate insert throw — the catch treats it as already-settled, returning `{ created: false }`. The pre-check `findUnique` handles the common replay case without throwing.)

- [ ] **Step 4: Extend the webhook — `app/api/webhooks/stripe/route.ts`** add, after the `account.updated` branch:

```ts
if (event.type === "checkout.session.completed") {
  const { settleCheckout } = await import("@/lib/commerce/order");
  await settleCheckout(event.data.object as Parameters<typeof settleCheckout>[0]);
}
```

- [ ] **Step 5: Webhook handler test — `tests/commerce-webhook.test.ts`** (mock `getStripe().webhooks.constructEvent` to return a crafted event; assert a bad signature → 400, a valid `checkout.session.completed` calls settlement). Mock `@/lib/commerce/stripe` and `@/lib/commerce/order`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const constructEvent = vi.fn();
const settle = vi.fn(async () => ({ created: true }));
vi.mock("@/lib/commerce/stripe", () => ({ getStripe: () => ({ webhooks: { constructEvent } }) }));
vi.mock("@/lib/commerce/order", () => ({ settleCheckout: settle }));

import { POST } from "@/app/api/webhooks/stripe/route";

beforeEach(() => {
  constructEvent.mockReset();
  settle.mockClear();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

function req(body: string, sig: string | null) {
  return new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    headers: sig ? { "stripe-signature": sig } : {},
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  it("400s without a signature", async () => {
    expect((await POST(req("{}", null))).status).toBe(400);
  });
  it("400s on an invalid signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad");
    });
    expect((await POST(req("{}", "sig"))).status).toBe(400);
  });
  it("settles a checkout.session.completed event", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", metadata: {} } },
    });
    const res = await POST(req("{}", "sig"));
    expect(res.status).toBe(200);
    expect(settle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 6: Run — expect PASS, gate, commit.** Run: `npx vitest run tests/commerce-order.test.ts tests/commerce-webhook.test.ts && npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .`

```bash
git add lib/commerce/order.ts app/api/webhooks/stripe/route.ts tests/commerce-order.test.ts tests/commerce-webhook.test.ts
git commit -m "feat(commerce): webhook settlement — idempotent Order + inventory decrement"
```

---

## Task 15: Success/cancel pages + end-to-end verification

**Files:** Create `app/store/checkout/success/page.tsx`, `app/store/checkout/cancel/page.tsx`.

- [ ] **Step 1: Success page — `app/store/checkout/success/page.tsx`** (reads order by session id; tolerates "still processing")

```tsx
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const order = session_id
    ? await prisma.order.findUnique({ where: { stripeCheckoutSessionId: session_id } })
    : null;
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Thank you!</h1>
      {order ? (
        <p className="mt-3 text-slate-600">Your order #{order.number} is confirmed.</p>
      ) : (
        <p className="mt-3 text-slate-600">
          Your payment is processing — your confirmation will appear shortly.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Cancel page — `app/store/checkout/cancel/page.tsx`**

```tsx
export const dynamic = "force-dynamic";

export default function CheckoutCancel() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
      <p className="mt-3 text-slate-600">
        Your cart is still saved — you can finish whenever you're ready.
      </p>
    </main>
  );
}
```

(The `/store/checkout/*` paths are already covered by the `/store` proxy allowlist from Task 7.)

- [ ] **Step 3: Final gate.** Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npx prettier --check .` — all green.

- [ ] **Step 4: Manual end-to-end (Stripe CLI — documented, NOT in the automated gate)**

1. Set env: `STRIPE_SECRET_KEY` (test mode), `APP_URL=http://localhost:3000`. Start `next dev`.
2. `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → copy the `whsec_…` into `STRIPE_WEBHOOK_SECRET`, restart dev.
3. Enable commerce on the active site (create a `Store` row — POST `/api/store` PATCH or the admin). Connect a **test** Stripe account via the admin "Connect Stripe" (use Stripe test onboarding). Confirm `account.updated` flips `chargesEnabled`.
4. Create a product with a price (admin) → confirm a Stripe Product/Price appears on the connected account (`stripeProductId`/`stripePriceId` set), set status `active`.
5. Visit `/store` (host = the store-site's domain, or app host as fallback) → add to cart → Checkout → complete payment with `4242 4242 4242 4242`.
6. Confirm `checkout.session.completed` settles an `Order` (number 1), the cart is `converted`, inventory decremented, and the success page shows the order. Replay the event (`stripe events resend <id>`) → still exactly one order.

- [ ] **Step 5: Commit**

```bash
git add app/store/checkout
git commit -m "feat(commerce): checkout success + cancel pages"
```

> **End of P2.** A buyer can browse a store-Site's catalog on its host, add to cart, and complete a real Stripe payment that settles into a local `Order` with decremented inventory.

---

## Out of scope (later phases — do NOT build here)

- **P3:** Stripe Tax wiring beyond the `automatic_tax` toggle, `ShippingRate`/zones + `shipping_options`, `DiscountCode` admin, archive-old-Price on edit.
- **P4:** Orders dashboard + detail + fulfillment, refunds (`/api/orders/[id]/refund`, `charge.refunded`), Stripe customer portal.
- **P5:** Adaptive Pricing / multi-currency, subscriptions.
- The "Generate description" AI action (reuses `/api/ai`) and a richer per-product variant matrix editor are admin-polish follow-ups.

## Self-review notes

- **Spec coverage:** §3 models → Tasks 1, 9; §5.1 catalog+sync → Task 4; §5.2 Connect → Task 3; §5.3 cart → Tasks 11–12; §5.4 checkout→webhook→Order → Tasks 13–14; §4 blocks + product pages → Tasks 5–8, 12; §8 security (siteId scoping, webhook raw-body+signature, money authority via variant re-read, idempotency via `stripeCheckoutSessionId @unique`, inventory in a `$transaction`) → Tasks 3, 13, 14; §7 admin → Task 8; §10 testing (cart/pricing/inventory/webhook unit tests) → Tasks 2, 10, 14. P3–P5 explicitly deferred.
- **Type consistency:** `getStripe`/`appUrl` (T3) consumed in T4, T13; `syncProductToStripe` (T4) in T4 routes; `buildProductMap`/`ProductMap`/`StoreProduct` (T5) in T6, T7; `ProductsProvider`/`useProducts` (T5) in T6, T7; `formatMoney`/`variantForOptions`/`minVariantPrice` (T2) in T5, T6, T7; `getOrCreateCart`/`getCart`/`storeSiteIdFromHost` (T11) in T13; `clampQuantity`/`cartSubtotal` (T10) in T11, T12; `settleCheckout` (T14) in the webhook; `useCart`/`CartProvider` (T12) in T6's product block + T12 blocks; `endpoints.{store,products,cart,checkout}` registered in T3/T4/T11/T13.
- **Confirm at execution (flagged for implementers):** the exact `SettingField.type`/`FieldType` union members in `lib/types.ts` (Task 6 block `fields`); the precise import paths for `parseContent`/`parseDesignSystem`/`designSystemCss`/`responsiveCss`/`slugify` (copy from `app/c/[slug]/[item]/page.tsx` + an existing route); the Stripe SDK call signatures against the installed `node_modules/stripe` types (`accounts.create`, `accountLinks.create`, `prices.create`, `checkout.sessions.create`, `webhooks.constructEvent`); `Cart.token` needs `@default(cuid())` (add in Task 9/11); the app sidebar nav file for the Store entry (Task 8). None of these change the design — they are local lookups the implementer resolves against current code.
