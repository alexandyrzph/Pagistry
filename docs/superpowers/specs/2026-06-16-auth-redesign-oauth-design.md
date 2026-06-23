# Auth redesign + OAuth (Project ① of the onboarding work)

**Date:** 2026-06-16
**Status:** Approved — ready for implementation plan
**Reference:** the current `/login` screenshot (purple split-screen + doodle) — being replaced.

## Goal

Replace the doodle split-screen login/register with a distinctive **centered frosted-glass
card over a full-bleed downloaded wallpaper**, and add **working Google + GitHub OAuth**
(env-gated, mirroring the app's AI-provider gating). All four auth pages
(login/signup/forgot/reset) share one component, so they all get the new look.

This is **Project ①** of a two-project decomposition. **Project ②** (workspace onboarding:
public workspaces, request-access, create-workspace flow with image upload) is a later,
separate cycle and is out of scope here.

## Decisions (from brainstorming)

- **Layout:** centered card on a full-bleed wallpaper (not split-screen, not off-center).
- **OAuth:** full working flow, env-gated; Google + GitHub.
- **Background:** one downloaded, free-license (Unsplash, no-attribution) wallpaper.
- **Schema:** `User.passwordHash` becomes nullable; add an `OAuthAccount` model.
- **Linking:** auto-link an OAuth identity to an existing user only when the provider's
  email is **verified**; otherwise create a new user.
- **Seam for ②:** after successful auth, if the user has no workspace → redirect to
  `/onboarding/workspace`. Until ② ships, signup/OAuth still auto-creates a workspace, so
  this branch never triggers and nothing breaks.
- Keep `doodles.tsx` (the onboarding tour still uses it); just stop using it in auth.

## Existing building blocks (reused)

- `components/auth/AuthScreen.tsx` — the one shared split-screen; rebuilt here. Modes:
  `login | signup | forgot | reset`. Submits to `/api/auth/{mode}`; on success routes to
  `data.onboarded ? (next || "/") : "/onboarding"`.
- `lib/auth/auth.ts` — `createSession(userId)`, `hashPassword`, `verifyPassword`,
  `newToken`, `getCurrentUser`. Opaque `pc_session` httpOnly cookie, 30-day.
- `app/api/auth/signup/route.ts` — creates user (`passwordHash`), `createSession`,
  `createWorkspace(user.id, "<name>'s Workspace")`, returns `{ ok, onboarded: false }`.
- `lib/auth/workspace.ts` — `createWorkspace(userId, name)`.
- `/api/ai` env-gating pattern (`available()` reads `process.env.*`) — mirrored for OAuth.
- `APP_URL` env (default `http://localhost:3000`) — used to build OAuth redirect URIs.

## Visual / layout

Rebuild `AuthScreen.tsx` as a full-screen background with a centered card:

- **Background:** `<div>` covering the viewport with `background-image: url(/auth/<file>)`
  `cover`/`center`, plus an overlay layer (`linear-gradient` dark tint) and a faint grain/
  noise layer so the card and any text always read. No `next/image` (CSS background).
- **Card:** centered, ~max-w-md, frosted (`bg-white/95` or solid white with ring + shadow),
  rounded-2xl, generous padding. Contents top→bottom:
  1. Pagistry logo mark + wordmark.
  2. Heading + subtext per mode (login: "Welcome back" / "Sign in to your Pagistry
     workspace."; signup: "Create your account" / short subtext; forgot/reset: existing copy).
  3. **OAuth button row** (only on login + signup; rendered only for configured providers):
     "Continue with Google", "Continue with GitHub" — white buttons, provider glyph, hairline
     border. Hidden entirely when no providers configured.
  4. **Divider** "or continue with email" (shown only when ≥1 OAuth provider is configured).
  5. Email / password fields (forgot: email only; reset: password only) — current field set.
  6. Primary action button (ink/zinc-900, matches the app's primary style).
  7. Footer link toggling login↔signup (and the existing forgot/back links).
- Remove the doodle and the stray top-right "N" avatar.
- Polished, professional, accessible (labels, focus rings, `aria` on icon-only elements).

## Wallpaper asset

- Download **one** image from a free/no-attribution source (Unsplash) into
  `public/auth/login-bg.jpg` (committed). Dark, abstract/architectural, premium.
- Implementation uses `curl` against a stable `images.unsplash.com/photo-...` URL (Unsplash
  License: free to use, no attribution/permission required). The plan pins an exact URL.
- If the download fails offline, the overlay-gradient background still renders (graceful
  fallback — the card never sits on a blank/broken background).

## OAuth — data model

Prisma migration (`prisma db push`, no migrations dir):

```prisma
model User {
  // ...
  passwordHash String?   // was required; now nullable (OAuth users have none)
  // ...
  oauthAccounts OAuthAccount[]
}

model OAuthAccount {
  id                String   @id @default(cuid())
  provider          String   // "google" | "github"
  providerAccountId String   // the provider's stable user id
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt         DateTime @default(now())
  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

`verifyPassword` already returns false for an empty/blank stored hash, so a null password
can never authenticate via the email/password path — confirm/keep that guard.

## OAuth — provider module (`lib/auth/oauth.ts`, pure where possible)

- `OAUTH_PROVIDERS`: per-provider config — `authorizeUrl`, `tokenUrl`, `userInfoUrl`,
  `scope`, env-var names. Google: scope `openid email profile`. GitHub: scope
  `read:user user:email`.
- `oauthProviders(): ("google"|"github")[]` — returns providers whose `*_CLIENT_ID` and
  `*_CLIENT_SECRET` are both set (pure read of `process.env`).
- `redirectUri(provider)` → `${process.env.APP_URL || "http://localhost:3000"}/api/auth/oauth/${provider}/callback`.
- `buildAuthorizeUrl(provider, state)` → the consent URL with `client_id`, `redirect_uri`,
  `response_type=code`, `scope`, `state` (pure, given a provider + state).
- `exchangeCode(provider, code)` → POST to tokenUrl, returns access token (network).
- `fetchProfile(provider, accessToken)` → returns normalized
  `{ providerAccountId: string; email: string | null; emailVerified: boolean; name: string }`
  (network). For GitHub, also calls `/user/emails` to get the primary verified email.
- `normalizeGoogleProfile(raw)` / `normalizeGithubProfile(rawUser, rawEmails)` — **pure**
  functions that map each provider's JSON shape to the normalized profile (unit-tested).
- **State (CSRF):** `signState(payload)` / `verifyState(token)` — HMAC over a random nonce +
  optional `next`, with a short TTL (e.g. 10 min), using `process.env.AUTH_SECRET ||
"dev-auth-secret-change-me"` (same dev-fallback convention as the thumbnail token helper).
  Pure, unit-tested.

## OAuth — routes

- `GET /api/auth/oauth/[provider]` — validate provider is configured (else redirect
  `/login?error=provider_unavailable`); mint `state`; set it in a short-lived httpOnly cookie
  (`pc_oauth_state`); 302 to `buildAuthorizeUrl`.
- `GET /api/auth/oauth/[provider]/callback` — read `code` + `state` from query; verify
  `state` against the cookie (CSRF); clear the cookie; `exchangeCode`; `fetchProfile`; then:
  1. If an `OAuthAccount{provider, providerAccountId}` exists → sign in that user.
  2. Else if `email` is present and **verified** and a `User{email}` exists → create an
     `OAuthAccount` linking it, sign in.
  3. Else → create a new `User` (null password, name/email from profile), create an
     `OAuthAccount`, auto-create their workspace (`createWorkspace`), so behavior matches
     email signup.
     Then `createSession(user.id)` and 302 to `user.onboardedAt ? "/" : "/onboarding"`.
     Any failure (denied, bad state, token/profile error) → 302 `/login?error=<reason>`.
- `GET /api/auth/providers` — returns `{ providers: ("google"|"github")[] }` for the UI.

## UI wiring

- `AuthScreen` fetches `/api/auth/providers` on mount; renders only configured OAuth buttons.
  Each button is a plain link to `/api/auth/oauth/<provider>` (a full-page navigation; carries
  `?next=` if present). The divider + buttons hide entirely when no providers are configured.
- `/login` reads `?error=` and shows a friendly inline message
  (e.g. `oauth_denied` → "Sign-in was cancelled.", `oauth_failed` → "Could not sign in with
  that provider. Please try again.").

## Error handling

- Email/password flows unchanged.
- OAuth errors never 500 to the user: the callback catches and redirects to `/login?error=`.
- Provider HTTP failures are logged server-side; the user sees the friendly message.

## Testing (gate = `tsc` + `vitest`, no `next build`)

- **Unit:** `oauthProviders()` (all combos of env presence); `signState`/`verifyState`
  (valid, tampered, expired); `buildAuthorizeUrl` (correct params/encoding);
  `normalizeGoogleProfile` + `normalizeGithubProfile` (incl. GitHub primary-verified-email
  selection and the unverified case).
- **Dom:** `AuthScreen` renders Google + GitHub buttons when `providers` includes them and
  hides them (+ the divider) when empty; renders the email/password fields per mode.
- **Manual (checklist, not in the gate):** real round-trip for each provider after adding
  credentials; verified-email linking; new-user creation + workspace; error redirects.

## Out of scope (deferred to Project ②)

Public workspaces + visibility, `WorkspaceAccessRequest` + approval, the create-workspace
onboarding layout + workspace image upload, the "no workspace → request access/create"
landing, and changing the signup auto-create-workspace behavior.
