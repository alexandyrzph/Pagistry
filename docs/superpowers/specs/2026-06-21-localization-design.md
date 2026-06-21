# Design: Localization / i18n — multi-language published sites

**Date:** 2026-06-21
**Status:** Draft (design) — pending implementation plan
**Scope:** Published-site localization for the multi-site page builder. Adds per-locale content to `Page`, `CollectionItem`, and the per-site `Site` (header/footer), serves them under a subpath locale prefix, and drafts translations with the existing AI route.
**Related specs:** multi-site model (`Site` is a first-class entity; locale config lives on `Site`; content is `siteId`-scoped — this spec depends on it), custom-domains (locale subpath sits _inside_ a Site's host) and e-commerce (localizing product content is a later phase that reuses this overlay).

---

## 1. Goal & scope

Let a site be published in several languages from a **single source of truth**. Localization is **per-site**: under the foundation's multi-site model a workspace owns many sites, and each one enables its own locale set — the Marketing, Blog, and Store sites in one workspace can each go multilingual independently (or not at all). The author builds the page once in the site's default locale; each additional locale stores only the text that differs. Visitors reach a language via a URL prefix (`example.com/fr/about`), search engines see proper `hreflang`/`lang` signals, and the author can ask AI to draft a whole locale in one click.

**Localizable content (in scope):**

- **Page block text** — the string props on blocks whose registry field `type` is `text` or `textarea`. Concretely: `heading.text`, `text.text` (rich-text HTML), `button.text`, `quote.text`/`quote.author`, `hero.eyebrow/title/subtitle/buttonText`, `features.title/subtitle` + each `items[i].title/text`, `pricing.title/subtitle` + `items[i].name/price/period/features/buttonText`, `testimonial.quote/author/role`, `stats.items[i].value/label`, `cta.title/subtitle/buttonText`, `footer.brand/tagline/copyright` + `links[]`, `navbar.brand/ctaText` + `links[]`, `list.items[]`, `image.alt`. The translatable set is **derived from the block registry**, never hand-listed (see §4), so it stays correct as blocks evolve.
- **SEO meta** — per-locale `metaTitle`, `metaDescription`, and an optional per-locale `ogImage`.
- **CMS item fields** — `CollectionItem.data` values whose `CollectionField.type` is `text` or `textarea`.
- **Global header & footer** — the `Site.header` / `Site.footer` block trees, localized with the same overlay mechanism (they are just block trees).

**Non-goals (note, don't build):**

- **RTL polish** — we will emit `dir="rtl"` on `<html>` for known RTL locales (ar/he/fa/ur) as a baseline, but per-block mirroring, logical-property auditing, and bidi-aware components are out of scope.
- **Number / currency / date formatting** — beyond setting `<html lang>` (which lets author-written copy and any `Intl`-based components behave). No automatic money/number reformatting of CMS values.
- **Localized URLs/slugs** — the slug stays identical across locales; the locale lives only in the prefix (see §7). No translated slugs, no per-locale routing tables.
- **Translating uploaded assets**, form-submission data, non-text props (URLs, colors, icons, numeric/boolean), `embed`/`code` block bodies, or per-locale layout/design differences.
- **Per-locale block add/remove or visibility** — a locale never changes the block tree's _shape_, only its text. (A field with no override falls back; it cannot be hidden per locale.)

---

## 2. Decisions & rationale

### URL strategy: subpath prefix, default locale unprefixed

One domain, a leading locale segment: `/<locale>/…`. **The default locale is unprefixed.**

- **Rule:** the default locale is served at the existing URLs (`/p/<slug>`, `/c/<slug>/<item>`, and — under a custom domain — `/<slug>`). Every non-default locale `L` is served at the same path with `/<L>` prepended (`/fr/p/<slug>`). Requesting the default locale _with_ its prefix (`/en/p/<slug>` when `en` is default) **301-redirects** to the canonical unprefixed URL.
- **Why unprefixed default:** zero migration — all already-published URLs keep working and remain the default-locale canonical; the primary market gets the cleanest URL; no forced redirect on the most-trafficked path. (Prefixing _all_ locales, including default, is the only real alternative; it is cleaner conceptually but breaks every existing link and adds a redirect on the busiest path. Rejected for those costs.)
- **Why subpath over the alternatives:**
  - **Subdomain (`fr.example.com`) / ccTLD (`example.fr`)** — needs DNS records and a TLS cert per locale, and collides with the per-site custom-domains model (each Site maps its own hostname(s) via the foundation's Host → Domain → Site routing). Heavier ops for no SEO advantage over subpaths. Rejected.
  - **Subpath** — single host, single cert, works unchanged under a custom domain (the locale segment is simply the first path segment after the host), and is the easiest to detect in `proxy.ts`. Chosen.

### Translation model: field-level sparse overrides + AI assist

The default-locale block tree (`Page.content`, `Site.header/footer`, `CollectionItem.data`) is the **source of truth**. Each other locale stores a **sparse map of overridden text values** keyed by block + field. At render the overrides overlay the base tree; any field with no override **falls back to the default locale**.

- **Why overrides over a copy-per-locale:** a `Page`-row-per-locale duplicates the entire block tree, so every structural edit (add a section, reorder, restyle) must fan out to N rows and inevitably drifts; it also multiplies `PageVersion` history and breaks the "edit once" mental model. Sparse overrides keep one canonical structure and store only deltas — small, no drift, and a partially-translated locale is automatically complete via fallback. Chosen.
- **Why AI-assisted:** the existing `/api/ai` route already has a fast, cheap "rewrite" path (Haiku / gpt-4o-mini) with a copy-editor system prompt and output sanitization. Adding a sibling "translate" mode lets the author draft an entire locale's overrides in one action, then hand-edit. Reuses provider selection, auth (`withRole("EDITOR")`), and the `lib/api/endpoints.ts` registry.

---

## 3. Data model

All new fields follow the codebase's existing convention of **JSON-encoded strings in SQLite TEXT columns** (`Page.content`, `Site.header`, `CollectionItem.data` are all JSON blobs today).

### 3.1 Locale config on `Site`

Under the foundation's multi-site model, `Site` is a first-class entity (a workspace has many) and already holds per-site config (header, footer, colors, textStyles) — the natural home for locale config. Putting `defaultLocale`/`locales` on `Site` makes the locale set **genuinely per-site**: two sites in the same workspace can enable different locales (Marketing in `["en","fr"]`, Store in `["en","es","de"]`), and a monolingual site simply leaves `locales` at `["en"]`.

```prisma
model Site {
  // … existing fields …
  defaultLocale String @default("en")   // BCP-47 base, e.g. "en"
  locales       String @default("[]")   // JSON string[] of ENABLED locales, INCLUDING default, e.g. ["en","fr","es"]
  i18n          String @default("{}")   // per-locale overrides for header+footer block trees
}
```

- `locales` is the allow-list the router and SEO layer validate against. The default locale is always a member.
- A locale code is a BCP-47 tag matched by `^[a-z]{2}(-[A-Z]{2})?$` (e.g. `fr`, `pt-BR`). We cap the enabled set at **20** locales (a soft product limit; see §3.4).
- `Site.i18n` shape: `{ [locale]: { [overrideKey]: string } }`, where `overrideKey` addresses a field inside the combined header+footer trees (block ids are unique across both). Same shape as page overrides (§3.2).

### 3.2 Per-locale overrides on `Page` and `CollectionItem`

**Recommendation: a sparse JSON `i18n` column** (chosen over a normalized `Translation` table — see §3.3).

```prisma
model Page {
  // … existing fields …
  i18n String @default("{}")   // { [locale]: { [overrideKey]: string } }
}

model CollectionItem {
  // … existing fields …
  i18n String @default("{}")   // { [locale]: { [fieldKey]: string } }
}
```

**Override-key scheme** (page / header / footer — block-addressed):

| Field kind                         | Key shape                       | Example                          |
| ---------------------------------- | ------------------------------- | -------------------------------- |
| Scalar text/textarea prop          | `<blockId>.<fieldKey>`          | `blk_3f.title`                   |
| `stringlist` entry (by index)      | `<blockId>.<fieldKey>[<i>]`     | `blk_nav.links[2]`               |
| `items` sub-field (by index)       | `<blockId>.<fieldKey>[<i>].<k>` | `blk_feat.items[0].text`         |
| Page SEO meta (reserved pseudo-id) | `$seo.<metaKey>`                | `$seo.metaTitle`, `$seo.ogImage` |

`CollectionItem.i18n` is flatter — its `data` is a flat `{ fieldKey: value }` map, so the override key is just `<fieldKey>` (e.g. `title`, `excerpt`). Only `text`/`textarea` `CollectionField`s are eligible.

Example `Page.i18n`:

```json
{
  "fr": {
    "blk_hero.title": "Construisez quelque chose de beau",
    "blk_hero.subtitle": "Une section héro moderne et épurée.",
    "blk_feat.items[0].text": "Conçu pour la vitesse.",
    "$seo.metaTitle": "Accueil — Acme"
  },
  "es": { "blk_hero.title": "Crea algo hermoso" }
}
```

Note `fr` here translates 4 fields and `es` only 1 — everything else falls back to the default locale. That sparseness is the whole point.

### 3.3 Why sparse JSON over a normalized `Translation` table

A normalized `Translation(entityType, entityId, locale, key, value)` table is the textbook alternative. We reject it for this app:

- **Read path is already a single row.** `/p/[slug]`, `/c/[slug]/[item]`, and `PageDocument` already load exactly one `Page` / `CollectionItem` / `Site`. The overlay is a pure in-memory merge over data we hold — **no extra query, no join, no N+1**. A table adds a per-render `WHERE entityId=? AND locale=?` fetch (and another for header/footer) on the hot public path.
- **Convention fit.** Page content, theme, header, footer, and CMS data are all JSON blobs here; overrides as JSON keep one mental model and one write on save.
- **Atomic writes & versioning.** Overrides ride along in the same row write, snapshot cleanly into `PageVersion` (extend it to carry `i18n`; see §9), and restore atomically.
- **Trade-offs acknowledged:** cross-entity queries ("every untranslated string in the site", shared translation memory) are easy with a table and awkward with blobs — but we don't need them at this scale; "untranslated" is computed in-app per page (§6). If a future translation-memory / vendor-export feature arrives, a normalized table can be **derived** from the blobs without changing the render contract.

### 3.4 Size & limits

A rich page has on the order of tens of translatable fields; each override is a short string. One locale's map is a few KB; 20 locales is well under SQLite's practical TEXT/blob ceiling (default `SQLITE_MAX_LENGTH` ~1e9 bytes). We still: cap enabled locales at 20; cap any single override string (reuse the rewrite cap of ~4000 chars per field); and skip writing empty/whitespace overrides (so the map only ever holds real deltas).

---

## 4. Override granularity & overlay algorithm

### 4.1 Discovering translatable fields (registry-driven)

A single pure helper, `lib/i18n/translatable.ts`, walks a `Block[]` tree and, for each block, consults `REGISTRY[block.type].fields` to decide which props are text. This is the same registry the AI prompt builder (`lib/ai.ts → describeField`) and the inspector already read, so it can never drift from the real blocks.

```
collectTranslatableFields(tree: Block[]): { key: string; value: string }[]
```

Rules per registry field on a block:

- `type === "text" | "textarea"` → emit `{ key: "<blockId>.<fieldKey>", value: String(prop) }`.
- `type === "stringlist"` → for each string entry `i`, emit `…<fieldKey>[<i>]`.
- `type === "items"` → for each entry `i`, for each `itemField` whose `type` is `text`/`textarea`, emit `…<fieldKey>[<i>].<subKey>`.
- All other field types (`url`, `color`, `image`, `icon`, `number`, `boolean`, `select`, `code`, `file`) → **skipped** (not translatable). `image.alt` is `type: "text"`, so alt text _is_ included; `image.src` is `type: "image"`, excluded.
- Recurse into `block.children`.

The same helper, run over `[...header, ...footer]`, yields the Site-level translatable set; run over a `CollectionField[]` + item `data`, the CMS set.

### 4.2 Overlay at render

A pure helper, `lib/i18n/overlay.ts`, mirrors the existing `applyTokens` (`lib/cms/cms-tokens.ts`) style — deep-clone the tree, substituting values:

```
applyLocaleOverlay(tree: Block[], overrides: Record<string, string>): Block[]
```

- Deep-clones each block (never mutates the cached/parsed base tree).
- For every translatable field path on the block (computed exactly as in §4.1), if `overrides[path]` is a non-empty string, replace that prop value; otherwise **leave the base value untouched** (= fallback to default locale).
- Recurses into children.
- For the default locale (or when `overrides` is empty), it is an identity clone — so the existing render is unchanged.

SEO overlay is separate and trivial: `metaTitle = overrides["$seo.metaTitle"] ?? page.metaTitle`, etc., in `generateMetadata`.

The contract: **structure comes from the base tree; only text values are swapped.** A missing key, a missing locale, or an unknown block id all degrade to the default value. This makes a half-translated page always renderable and never broken.

### 4.3 Where it plugs in

- `PageDocument` (`components/PageDocument.tsx`) — after `parseContent(page.content)`, if the active locale ≠ default, run `applyLocaleOverlay(tree, page.i18n[locale])`; likewise overlay `header`/`footer` with `site.i18n[locale]`. The active locale arrives as a prop (resolved in the route, §5).
- `/c/[slug]/[item]` — overlay item `data` (CMS map) _before_ `applyTokens(template, data)`, so tokens fill with translated values.

---

## 5. Routing

`proxy.ts` (Next 16's renamed middleware) currently runs on every navigation and only does an optimistic auth gate. Localization adds a **syntactic** locale strip in front of the existing logic.

Under the foundation, routing is **Host → Domain → Site**, then the locale strip sits _inside_ that Site's host: the first path segment after the host is the optional locale, validated against **that Site's** `Site.locales`.

**Constraint:** proxy runs at the edge and **cannot touch Prisma**, so it cannot resolve the host to a Site or validate a segment against that Site's `Site.locales`. It therefore does _syntactic_ detection only; the page route (which has DB access, and which already resolved Host → Site) does the _authoritative_ validation.

### 5.1 In `proxy.ts`

A pure, unit-testable helper `resolveLocalePrefix(pathname)` returns `{ locale, rest } | null`:

- Split the first path segment. If it matches the locale regex `^[a-z]{2}(-[A-Z]{2})?$` **and** is not a reserved top-level segment (`api`, `p`, `c`, `internal`, `editor`, `site`, `login`, `signup`, `forgot`, `reset`, `onboarding`, `invite`, `component`, `collection`), treat it as a locale; `rest` is the remainder (`/p/about`).
- Otherwise return `null` (no locale prefix).

When a prefix is found, proxy:

1. Clones request headers and sets `x-pc-locale: <locale>` (the documented `NextResponse.next({ request: { headers } })` / `rewrite(url, { request: { headers } })` pattern — _request_ headers, made available upstream, **not** response headers).
2. Rewrites to the stripped path: `NextResponse.rewrite(new URL(rest, req.url), { request: { headers } })` — the visitor keeps the pretty `/fr/p/about` URL while the underlying `/p/[slug]` route renders.
3. The public-path checks (`/p/`, `/c/`, `/internal/`) then evaluate against `rest`, so localized published pages stay public exactly like their unprefixed twins.

When no prefix is found, behavior is unchanged (default locale).

Proxy also sets a `pc_locale` cookie (non-authoritative, for the client locale switcher's persistence); the URL is always the source of truth.

> Implementation note: confirm the exact `NextResponse.rewrite(url, { request: { headers } })` signature against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (§"Setting Headers") before coding — Next 16 supports request-header injection on both `.next()` and `.rewrite()`.

### 5.2 In the page routes

`/p/[slug]` and `/c/[slug]/[item]` (and `PageDocument`) read the active locale from `headers()` → `x-pc-locale`, defaulting to the resolved Site's `Site.defaultLocale` when absent:

1. Resolve the host → `Site` (foundation: Host → Domain → Site), then load the `Page`/`Item` **within that site** (`siteId`-scoped — already happens).
2. Resolve `activeLocale` **against that Site's** `Site.locales`: if the header value is in `site.locales` → use it; if it equals that site's `defaultLocale` (i.e. someone hit `/en/…` when `en` is the site default) → `redirect` to the canonical unprefixed URL; if it is _not_ one of that site's locales → `notFound()` (a bogus `/zz/…`, or a locale enabled on a _different_ site in the workspace but not this one).
3. Overlay (§4.3) and render.

### 5.3 Resolution table

| Default locale | Request                | Resolves to                          |
| -------------- | ---------------------- | ------------------------------------ |
| `en`           | `/p/about`             | `en`, base content                   |
| `en`           | `/fr/p/about`          | `fr` overlay over base               |
| `en`           | `/en/p/about`          | 301 → `/p/about`                      |
| `en`           | `/zz/p/about`          | 404 (`zz` ∉ `Site.locales`)          |
| `en`           | `/fr/c/blog/<itemId>`  | `fr` overlay over item + template    |
| `en`           | `/` (custom domain)    | `en` home page (custom-domains spec) |
| `en`           | `/fr/` (custom domain) | `fr` home page                       |

### 5.4 Coexistence with custom domains

Under the foundation, a host resolves Host → `Domain` → `Site`, and the custom-domains spec maps that Site's root paths onto its published pages (e.g. `acme.com/about` → `/p/about`, scoped to the Site `acme.com` resolves to). Locale detection must run **first**: `acme.com/fr/about` → proxy strips `/fr`, sets `x-pc-locale=fr`, then the custom-domain rewrite maps `/about` → `/p/about`. The two are composable because both are pure path rewrites in `proxy.ts`; the spec will land the locale strip _before_ the domain map and share one `resolveLocalePrefix` helper. The only genuine ambiguity — a root segment that is _both_ a valid locale and a real page slug (`acme.com/fr` where that site has a page literally slugged `fr`) — is resolved at the route by checking **that Site's** `Site.locales` membership: a known locale for that site wins.

---

## 6. Editor UX

### 6.1 Locale switcher + translation mode

- A **locale dropdown** in the editor `TopBar`, populated from `Site.locales`, with the default locale labelled "Default" and a "Manage languages" entry that opens the Site settings (where `defaultLocale`/`locales` are edited).
- Selecting the default locale = normal editing (writes `Page.content`).
- Selecting a non-default locale puts the editor in **translation mode**:
  - A persistent banner: "Translating: Français — editing here changes the French version only."
  - The block tree, styles, layout, and all non-text controls are **read-only** (structure is shared; you cannot reshape a locale).
  - Inspector **text/textarea fields** (and inline rich-text editing of the `text` block) become editable and write to `Page.i18n[locale][key]` instead of `block.props`. The field's placeholder/ghost shows the default-locale value so the author sees the source.
- The same mode applies to header/footer editing (writes `Site.i18n[locale]`) and to CMS item editing (writes `CollectionItem.i18n[locale]`).

### 6.2 Untranslated indicators

Using `collectTranslatableFields` (§4.1) over the current tree vs. the locale's override map, the editor computes a per-field and per-page "untranslated" set:

- Each translatable field shows a small dot/badge when it has **no** override in the active locale (so it will fall back).
- The TopBar shows a "12 / 40 translated" progress affordance for the active locale.

### 6.3 AI "Translate page to <locale>"

A button in translation mode runs a batch draft:

1. `collectTranslatableFields(tree)` (plus header/footer/SEO) → `{ key, value }[]`.
2. POST `/api/ai` with `mode: "translate"`, `targetLocale`, `sourceLocale`, and the `{ key, value }` list (batched to respect token limits — chunk large pages).
3. The route returns `{ key, value }[]` of translations (§ below); the editor writes them all into `Page.i18n[locale]`, leaving every field **editable** afterward.
4. Untranslated indicators clear as overrides land. Existing overrides are preserved unless the author opts into "retranslate all".

### 6.4 `/api/ai` "translate" mode

Extend `app/api/ai/route.ts` with a third `mode` alongside `rewrite`/`page`/`generate`, on the cheap `REWRITE_MODEL` (Haiku / gpt-4o-mini):

- New `TRANSLATE_SYSTEM` in `lib/ai.ts`: "You are a professional website-copy translator. Translate each value from `<source>` to `<target>`, preserving meaning, tone, and any inline HTML tags and `{{tokens}}` exactly. Return only the translations." (Mirrors `REWRITE_SYSTEM`'s strictness.)
- Input is the `{ key, value }[]` (cap count + per-value length like rewrite's 4000-char slice); output parsed back to `{ key, value }[]`. Reuse `extractJsonArray` for a JSON-array response and validate keys against the request (drop unknown keys) so nothing untrusted reaches the tree.
- For the `text` block (rich-text HTML in `props.text`), the prompt must preserve tags; the result is sanitized on save through the same rich-text sanitizer the Text block already uses (no new XSS surface beyond existing inline editing).
- Add `endpoints.ai` is already present; no registry change needed (same `/api/ai`).

---

## 7. CMS localization

- **Storage:** `CollectionItem.i18n` = `{ [locale]: { [fieldKey]: string } }`, eligible fields = `CollectionField`s of type `text`/`textarea`.
- **Detail page (`/c/[slug]/[item]`):** resolve `activeLocale` (§5), build `mergedData = { ...baseData, ...item.i18n[locale] }`, then `applyTokens(template, mergedData)`. The detail _template_ itself (a block tree on `Collection.detailTemplate`) is localized like any page tree if it carries literal copy, but in practice it is mostly `{{token}}`s, so localizing the item data is what matters.
- **Collection List blocks** on a localized page render each card from locale-merged item data too (the `buildCollectionMap` step gains a locale-merge pass).
- **Slugs:** keep the **same** item URL across locales — `/fr/c/blog/<itemId>` and `/c/blog/<itemId>` address the same row; locale lives only in the prefix. (No per-locale slug column; aligns with §1 non-goals and keeps `CollectionItem` identity stable.)
- **Editor:** the CMS item editor gains the same locale switcher + AI translate action, scoped to that item's text fields.

---

## 8. SEO

- **`<html lang>` / `dir`:** `app/layout.tsx` reads `x-pc-locale` from `headers()` and sets `<html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>`. (Today it is static; make it locale-aware. The dashboard/auth routes simply get the default.)
- **`hreflang` alternates:** `generateMetadata` in `/p/[slug]` and `/c/[slug]/[item]` emits `alternates.languages` for every enabled locale plus `x-default`:

  ```ts
  alternates: {
    canonical: localizedUrl(activeLocale, slug),     // self-canonical per locale
    languages: {
      en: `${BASE}/p/${slug}`,
      fr: `${BASE}/fr/p/${slug}`,
      "x-default": `${BASE}/p/${slug}`,              // default locale
    },
  }
  ```

  A shared `lib/i18n/urls.ts` builds these from the active Site's `Site.defaultLocale` + `locales` (default unprefixed, others prefixed) — always within one Site's locale set and host — and is reused by the sitemap and the locale-switcher block. Under a custom domain, `BASE` is that Site's host (Host → Domain → Site, foundation).

- **`generateMetadata` per-locale meta:** overlay `metaTitle`/`metaDescription`/`ogImage` from `page.i18n[locale]` (the `$seo.*` keys, §3.2) before returning, and translate the JSON-LD `name`/`description` likewise.
- **Sitemap (`app/sitemap.ts`):** scoped to the Site being served (the foundation makes pages `siteId`-scoped and the sitemap host-resolved to a Site), for each of that site's published pages emit **one entry per locale enabled on that site** (default unprefixed, others prefixed), each carrying `alternates.languages` (Next's `MetadataRoute.Sitemap` supports an `alternates.languages` field). Extend the same way for CMS detail URLs in P4.
- **Locale-switcher BLOCK (public site):** a new registry block `localeSwitcher` (category Basic) that server-renders links to the **current path** in each locale enabled on the current Site, marking the active one. It reads the active Site's `Site.locales` + the active locale + the current pathname (passed through render context) and uses `lib/i18n/urls.ts` to build each target — so it lists exactly the languages that Site offers, on that Site's domain. Author-droppable into header/footer or any page. Locale display names via `Intl.DisplayNames` (open question §11 on overrideable labels).

---

## 9. Phasing

- **P1 — Foundation & routing.** Prisma: `Site.defaultLocale/locales/i18n`, `Page.i18n`, `CollectionItem.i18n` (+ migration). `resolveLocalePrefix` in `proxy.ts` with header injection + canonical redirect. Route-level locale resolution and `applyLocaleOverlay`/`collectTranslatableFields` helpers — but with **empty override maps**, so behavior is identical to today (base = default everywhere). Locale-aware `<html lang>`. Site-settings UI to set `defaultLocale` + manage `locales`.
- **P2 — Per-locale override editing + render overlay.** Editor locale switcher + translation mode (page + header/footer), inspector writes to `i18n` maps, untranslated indicators, overlay wired into `PageDocument`. Extend `PageVersion` to snapshot `i18n`.
- **P3 — AI auto-translate.** `/api/ai` `translate` mode + `TRANSLATE_SYSTEM`; "Translate page to <locale>" batch action; rich-text/token preservation + sanitize.
- **P4 — CMS, SEO surface, switcher block.** `CollectionItem.i18n` editing + localized detail/Collection List rendering; `hreflang` alternates, per-locale `generateMetadata`, sitemap per-locale URLs; the `localeSwitcher` public block.

---

## 10. Testing strategy

Pure functions first (the gate is `tsc --noEmit` + `vitest` + `eslint` flat-strict + `prettier`; **not** `next build` — it clobbers the live dev server).

**Vitest unit tests:**

- `collectTranslatableFields` — over a tree mixing `heading`/`text`/`button`/`features`(items)/`navbar`(stringlist): emits exactly the text/textarea keys with correct `[i]` and `[i].sub` shapes; excludes `url`/`color`/`image-src`/`code` fields; includes `image.alt`; recurses into children. Registry-driven so it self-updates.
- `applyLocaleOverlay` — overlay replaces only keyed fields; **missing key falls back** to base; missing locale = identity; nested children overlaid; `stringlist`/`items` index targeting; never mutates the input tree (assert base unchanged).
- `resolveLocalePrefix` — `/p/about` → `null` (default); `/fr/p/about` → `{locale:"fr", rest:"/p/about"}`; reserved first segment (`/api/...`, `/p/...`) → `null`; non-locale-shaped segment → `null`; `pt-BR` accepted.
- Route locale resolution — header in `locales` → that locale; header == default → canonical-redirect signal; unknown → notFound signal (test the pure resolver, not the route I/O).
- CMS merge — `{...baseData, ...item.i18n[locale]}` feeds `applyTokens` with translated values; untranslated fields fall back.
- `lib/i18n/urls.ts` — default unprefixed, others prefixed, `x-default` = default; round-trips with `resolveLocalePrefix`.
- Sitemap — with a mocked `prisma.page.findMany`, emits one URL per locale with correct `alternates.languages`.

---

## 11. Risks & open questions

- **Block-id stability.** Overrides key on `block.id`. Deleting/recreating a block orphans its overrides (harmless — they just never apply). Copy/paste makes fresh ids (`createBlock`/`uid`), so a pasted block is untranslated (acceptable). **Mitigation:** GC orphaned override keys on publish (drop keys whose block id no longer exists in the tree) to keep `i18n` lean.
- **Edge can't validate locales.** Syntactic detection in proxy + authoritative validation in the route is the accepted split; the only ambiguity (custom-domain root segment that is both a locale and a real slug) is resolved by `Site.locales` at the route (§5.4). Document clearly.
- **Mixed-language pages.** Fallback means an untranslated field renders in the default language inside an otherwise-translated page. This is standard i18n behavior and surfaced by the untranslated indicators; not a bug.
- **Rich-text translation.** `text` block stores HTML; AI must preserve tags and we re-sanitize on save. Malformed model output is dropped per-field (validate keys, sanitize values) rather than corrupting the tree.
- **AI cost / large pages.** Batching + per-field caps bound token use; very large pages chunk across requests. No streaming UI in P3 (just a spinner + progressive writes).
- **`hreflang` correctness.** Requires absolute, domain-correct URLs — must read the active Site's host (its custom domain vs the platform default), resolved Host → Domain → Site per the foundation. `lib/i18n/urls.ts` centralizes this; verify against the custom-domains spec's host resolution.
- **Open questions:** (a) overrideable locale **display labels** (Intl.DisplayNames vs author-set names per locale) — propose author-overrideable, default to Intl; (b) where per-locale `ogImage` lives — chosen: `$seo.ogImage` in the same `i18n` map; (c) should the AI translate `url`/`buttonHref` (e.g. to a localized external link)? — default no, links are shared; revisit if requested; (d) translating shared **component instances** — overrides key on the instance block id, so each placement translates independently (fine, but note shared components won't share translations — acceptable for v1); (e) RTL depth — baseline `dir` only in this spec, full RTL is a separate effort.
- **Related-spec coupling:** custom-domains owns host/root-path resolution that this spec's URL builder and proxy ordering depend on; e-commerce will localize product content by reusing `CollectionItem.i18n` (or an analogous `Product.i18n`) and the same overlay — keep the overlay helpers product-agnostic.
