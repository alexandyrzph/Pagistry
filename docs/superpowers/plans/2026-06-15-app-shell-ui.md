# App Shell & UI Implementation Plan (Spec 1, Plan 1B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's top navbar with a collapsible left **sidebar app shell** (workspace switcher + grouped IA + ⌘K command palette + profile menu), and build the all-new **settings / members / invites / account / invite-accept / activity** screens that consume the Plan 1A tenancy APIs.

**Architecture:** A Next 16 route group `app/(app)/` with one shared server `layout.tsx` that loads the tenancy context (via `lib/workspace.ts`) and renders `<Sidebar>` + `<main>`. The existing dashboard moves into the group and loses its header. Manager surfaces become routes inside the group. The editor, auth pages, onboarding, and public `/p` `/c` stay OUTSIDE the group (root layout only) and are untouched. Client interactivity (collapse, switcher, palette, forms) lives in focused client components; collapse state persists in a cookie for SSR-correct width.

**Tech Stack:** Next.js 16 (App Router, route groups, async params/cookies), React 19, Tailwind v4, framer-motion (already used), lucide-react icons, zustand (existing). Dependency-free command palette (mirror the existing `components/editor/CommandPalette.tsx` pattern). No new dependencies.

---

## Important environment notes

- **Not a git repo** — each task ends with a "Checkpoint" (save point), not a commit.
- **Verification is at runtime** (this is a UI plan): the project has no component-test setup (vitest is node-env for `lib/` logic only). Each task's gate is `npx tsc --noEmit` **plus** driving the running dev server in a browser/curl. Do NOT add vitest UI tests. A dev server runs on **:3000** (already started with the full Plan 1A tenancy backend) — the orchestrator manages it; restart only if asked.
- **Plan 1A is done:** these APIs exist and are workspace-scoped — `/api/workspaces` (GET/POST), `/api/workspaces/switch` (POST), `/api/workspaces/[id]` (PATCH/DELETE), `/api/workspaces/members` (GET/PATCH/DELETE), `/api/workspaces/invites` (GET/POST/DELETE), `/api/invites/[token]` (GET/POST), `/api/account` (PATCH), `/api/account/password` (POST), plus `/api/pages`, `/api/components`, `/api/assets`, `/api/submissions` (GET `?pageId=`). Server helpers: `requireUser()` (auth), `requireWorkspace()` → `{ user, workspace:{id,name,slug}, role }`, `getActiveWorkspace()`, `type Role`, `hasRole`.
- **Next dev gotcha:** `notFound()` returns HTTP 200 in `next dev` (404 in prod) — when verifying not-found, assert on content, not status.
- Existing pieces to reuse: `components/Brand.tsx` (`Logo`, `LogoMark`), `lib/utils.ts` (`cn`), `components/dashboard/Dashboard.tsx` (has its own `<header>` to remove), `components/dashboard/SubmissionsModal.tsx`.

---

## File structure

New:

- `app/(app)/layout.tsx` — server shell: loads tenancy context, renders Sidebar + main.
- `components/app-shell/Sidebar.tsx` — client sidebar (groups, collapse, mobile drawer, active highlight).
- `components/app-shell/nav.ts` — the nav IA data (groups + items + icons) — single source of truth.
- `components/app-shell/WorkspaceSwitcher.tsx` — client switcher (list/switch/create).
- `components/app-shell/SidebarProfile.tsx` — client profile menu (account, sign out).
- `components/app-shell/CommandPalette.tsx` — client ⌘K palette.
- `components/app-shell/SidebarToggleCookie.ts` — tiny helper to read/write the collapse cookie.
- `app/(app)/page.tsx` — Pages (moved dashboard).
- `app/(app)/activity/page.tsx`, `app/(app)/forms/page.tsx`, `app/(app)/components/page.tsx`, `app/(app)/assets/page.tsx` — manager pages.
- `app/(app)/cms/page.tsx`, `app/(app)/design/page.tsx`, `app/(app)/site/page.tsx` — hub pages linking into existing editor flows (deep managers = Plan 1C).
- `app/(app)/settings/page.tsx` + `components/app-shell/settings/*` — workspace settings (general/members/invites/danger).
- `app/(app)/account/page.tsx` + `components/app-shell/account/*` — account settings.
- `app/invite/[token]/page.tsx` + `components/app-shell/InviteAccept.tsx` — invite accept (OUTSIDE the group: standalone, may be hit pre-membership).
- `app/api/activity/route.ts` — GET workspace activity feed.

Modified:

- `app/page.tsx` — DELETED (moved into the group).
- `components/dashboard/Dashboard.tsx` — remove its `<header>`; expose the page-grid + actions for use inside the shell.

---

## Phase A — The shell frame

## Task 1: Sidebar collapse cookie helper + nav data

**Files:**

- Create: `components/app-shell/SidebarToggleCookie.ts`
- Create: `components/app-shell/nav.ts`

- [ ] **Step 1: `components/app-shell/nav.ts`** — the IA (single source of truth, used by both Sidebar and CommandPalette):

```ts
import {
  LayoutGrid,
  Component,
  Database,
  Image as ImageIcon,
  Palette,
  PanelTop,
  Inbox,
  Activity,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; external?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Build",
    items: [
      { href: "/", label: "Pages", icon: LayoutGrid },
      { href: "/components", label: "Components", icon: Component },
      { href: "/cms", label: "CMS", icon: Database },
      { href: "/assets", label: "Assets", icon: ImageIcon },
    ],
  },
  {
    title: "Brand",
    items: [
      { href: "/design", label: "Design", icon: Palette },
      { href: "/site", label: "Site", icon: PanelTop },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/forms", label: "Forms", icon: Inbox },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
];

/** Flat list of all nav items, for the command palette. */
export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
```

- [ ] **Step 2: `components/app-shell/SidebarToggleCookie.ts`** — cookie name + helpers:

```ts
export const SIDEBAR_COOKIE = "pc_sidebar"; // "collapsed" | "expanded"

/** Client-side toggle: writes the cookie so SSR matches on next load. */
export function setSidebarCookie(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=${60 * 60 * 24 * 365}`;
}
```

- [ ] **Step 3: Verify** `npx tsc --noEmit` is clean (the lucide-react icon imports must resolve; if any icon name differs in this lucide version, pick the closest existing export and keep the mapping).

- [ ] **Step 4: Checkpoint.**

---

## Task 2: The route-group server layout

**Files:**

- Create: `app/(app)/layout.tsx`
- Create: `components/app-shell/Sidebar.tsx` (minimal first; switcher/profile/palette added in Tasks 3-5)

- [ ] **Step 1: `app/(app)/layout.tsx`**

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { SIDEBAR_COOKIE } from "@/components/app-shell/SidebarToggleCookie";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  const ctx = await getActiveWorkspace();
  if (!ctx) redirect("/onboarding");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
  }));

  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-screen w-full bg-zinc-50">
      <Sidebar
        collapsed={collapsed}
        workspaces={workspaces}
        activeWorkspaceId={ctx.workspace.id}
        role={ctx.role}
        user={{ name: user.name, email: user.email }}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: `components/app-shell/Sidebar.tsx`** (full version — switcher/profile/palette are imported here and built in later tasks; write them as imports now and create stubs so this compiles, OR build Tasks 3-5 first then this. Recommended order: do Task 3,4,5 components first, then this. For now create the file with the full structure):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelLeft, Plus, Search, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav";
import { setSidebarCookie } from "./SidebarToggleCookie";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SidebarProfile } from "./SidebarProfile";
import { CommandPalette } from "./CommandPalette";

type WS = { id: string; name: string; slug: string; role: string };

export function Sidebar({
  collapsed: initialCollapsed,
  workspaces,
  activeWorkspaceId,
  role,
  user,
}: {
  collapsed: boolean;
  workspaces: WS[];
  activeWorkspaceId: string;
  role: string;
  user: { name: string; email: string };
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      setSidebarCookie(!c);
      return !c;
    });
  };
  const w = collapsed ? "w-[68px]" : "w-64";

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const rail = (
    <div
      className={cn(
        "flex h-full flex-col bg-zinc-950 text-zinc-300 transition-[width] duration-200",
        w,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3.5">
        <WorkspaceSwitcher collapsed={collapsed} workspaces={workspaces} activeId={active?.id} />
      </div>
      <div className="px-3 pb-2 space-y-1">
        <Link
          href="/?new=1"
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-white/10 px-2.5 py-2 text-sm font-medium text-white hover:bg-white/15",
            collapsed && "justify-center",
          )}
        >
          <Plus size={17} />
          {!collapsed && "New"}
        </Link>
        <button
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white",
            collapsed && "justify-center",
          )}
        >
          <Search size={17} />
          {!collapsed && <span className="flex-1 text-left">Search</span>}
          {!collapsed && <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘K</kbd>}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                {g.title}
              </p>
            )}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const act = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={collapsed ? it.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      act
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                      collapsed && "justify-center",
                    )}
                  >
                    <Icon size={17} />
                    {!collapsed && it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white",
            isActive("/settings") && "bg-white/10 text-white",
            collapsed && "justify-center",
          )}
        >
          <SettingsIcon collapsed={collapsed} />
        </Link>
        <SidebarProfile collapsed={collapsed} user={user} />
        <button
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? (
            <PanelLeft size={16} />
          ) : (
            <>
              <PanelLeftClose size={16} /> Collapse
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* desktop */}
      <aside className="sticky top-0 hidden h-screen shrink-0 md:block">{rail}</aside>
      {/* mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 hover:bg-zinc-100">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold">{active?.name}</span>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="absolute left-0 top-0 h-full"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
            >
              <div className="relative h-full">
                {rail}
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-3 text-zinc-400"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

function SettingsIcon({ collapsed }: { collapsed: boolean }) {
  const { Settings } = require("lucide-react");
  return (
    <>
      <Settings size={17} />
      {!collapsed && "Settings"}
    </>
  );
}
```

(Note: replace the `require("lucide-react")` shim with a normal top `import { Settings as SettingsLucide }` and render it — the `require` is shown only to keep this snippet self-contained; use a clean top-level import.)

- [ ] **Step 3:** Build Tasks 3, 4, 5 (WorkspaceSwitcher, SidebarProfile, CommandPalette) — this file imports them. If implementing this task first, create minimal stub components that render a placeholder so `tsc` passes, then flesh them out in their tasks.

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean. (Runtime verification happens once the dashboard is relocated in Task 6.)

- [ ] **Step 5: Checkpoint.**

---

## Task 3: WorkspaceSwitcher

**Files:**

- Create: `components/app-shell/WorkspaceSwitcher.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type WS = { id: string; name: string; slug: string; role: string };

export function WorkspaceSwitcher({
  collapsed,
  workspaces,
  activeId,
}: {
  collapsed: boolean;
  workspaces: WS[];
  activeId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const initials = (active?.name || "W").trim().slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    setBusy(true);
    await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
    setBusy(false);
    setOpen(false);
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    const ws = await res.json();
    if (ws?.id) {
      await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ws.id }),
      });
      router.refresh();
    }
    setBusy(false);
    setCreating(false);
    setName("");
    setOpen(false);
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/5",
          collapsed && "justify-center",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
          {initials}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white">
            {active?.name}
          </span>
        )}
        {!collapsed && <ChevronsUpDown size={15} className="text-zinc-500" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Workspaces
          </p>
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => switchTo(w.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold text-white">
                {w.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{w.name}</span>
              <span className="text-[10px] uppercase text-zinc-400">{w.role}</span>
              {w.id === active?.id && <Check size={14} className="text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-100" />
          {creating ? (
            <div className="p-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Workspace name"
                className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={create}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : "Create"}
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <Plus size={15} /> New workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean.
- [ ] **Step 3: Checkpoint.**

---

## Task 4: SidebarProfile

**Files:**

- Create: `components/app-shell/SidebarProfile.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCog, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarProfile({
  collapsed,
  user,
}: {
  collapsed: boolean;
  user: { name: string; email: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  const initials = (user.name || user.email).trim().slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  async function logout() {
    setOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5",
          collapsed && "justify-center",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">
          {initials}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-left text-sm text-zinc-300">
            {user.name || user.email}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl">
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-zinc-800">
              {user.name || "Your account"}
            </p>
            <p className="truncate text-xs text-zinc-400">{user.email}</p>
          </div>
          <Link
            href="/account"
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <UserCog size={15} className="text-zinc-400" /> Account settings
          </Link>
          <button
            onClick={logout}
            disabled={out}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          >
            {out ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <LogOut size={15} className="text-zinc-400" />
            )}{" "}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean.
- [ ] **Step 3: Checkpoint.**

---

## Task 5: Command palette (⌘K)

**Files:**

- Create: `components/app-shell/CommandPalette.tsx`

- [ ] **Step 1: Implement** (dependency-free; navigates to nav destinations + quick actions; fetches the workspace's pages for direct jump)

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { ALL_NAV } from "./nav";

type Cmd = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [pages, setPages] = useState<{ id: string; title: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setSel(0);
      return;
    }
    inputRef.current?.focus();
    fetch("/api/pages")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPages(d.map((p: any) => ({ id: p.id, title: p.title }))))
      .catch(() => {});
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const nav: Cmd[] = ALL_NAV.map((n) => ({
      id: "nav:" + n.href,
      label: n.label,
      hint: "Go to",
      run: go(n.href),
    }));
    const actions: Cmd[] = [
      { id: "act:settings", label: "Workspace settings", hint: "Action", run: go("/settings") },
      { id: "act:account", label: "Account settings", hint: "Action", run: go("/account") },
      {
        id: "act:members",
        label: "Invite a teammate",
        hint: "Action",
        run: go("/settings#members"),
      },
    ];
    const pageCmds: Cmd[] = pages.map((p) => ({
      id: "page:" + p.id,
      label: p.title,
      hint: "Edit page",
      run: () => {
        onClose();
        router.push(`/editor/${p.id}`);
      },
    }));
    return [...nav, ...actions, ...pageCmds];
  }, [pages, router, onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands.slice(0, 12);
    return commands.filter((c) => c.label.toLowerCase().includes(s)).slice(0, 20);
  }, [q, commands]);

  useEffect(() => {
    setSel(0);
  }, [q]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[sel]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-zinc-900/40 p-4 pt-[15vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4">
              <Search size={17} className="text-zinc-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search pages, sections, actions…"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-zinc-400"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-400">No results</p>
              )}
              {filtered.map((c, i) => (
                <button
                  key={c.id}
                  onMouseEnter={() => setSel(i)}
                  onClick={c.run}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${i === sel ? "bg-indigo-50 text-indigo-900" : "text-zinc-700"}`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    {c.hint}
                    {i === sel && <CornerDownLeft size={12} />}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean.
- [ ] **Step 3: Checkpoint.**

---

## Task 6: Relocate the dashboard into the shell

**Files:**

- Create: `app/(app)/page.tsx`
- Delete: `app/page.tsx`
- Modify: `components/dashboard/Dashboard.tsx`

- [ ] **Step 1: Move the page** — create `app/(app)/page.tsx` with the EXACT current contents of `app/page.tsx` (the workspace-scoped dashboard query from Plan 1A), then delete `app/page.tsx`.

- [ ] **Step 2: Remove the Dashboard's own chrome** — in `components/dashboard/Dashboard.tsx`, delete the entire `<header>…</header>` block (the top bar with Logo / workspace chip / Generate / New page / UserMenu — those now live in the sidebar). Keep the `<main>` content (heading, search, page grid, modals). Change the outer wrapper from `min-h-full w-full bg-zinc-50` to just `w-full` (the shell provides the bg). Move the **"New page"** and **"Generate with AI"** buttons into the page's content header (next to the "Your pages" heading) so they remain reachable. Remove the now-unused `UserMenu` component and its `ChevronDown/LogOut` imports. Keep the `user` prop optional or drop it if unused after removing UserMenu.

- [ ] **Step 3: Wire the sidebar "New" affordance** — the sidebar's New button links to `/?new=1`. In the relocated dashboard, read `useSearchParams()` and auto-open the template modal when `new=1` is present (then clear it). (Small `useEffect`.)

- [ ] **Step 4: Runtime verify** — open `http://localhost:3000/` signed in: the **dark sidebar** renders with the workspace switcher, grouped nav, Settings + profile; the page grid shows your pages in `<main>`; collapsing persists across reload (cookie); ⌘K opens the palette and can jump to a page; the workspace switcher lists "Acme Inc" and can create/switch a workspace (creating one shows an empty grid). Capture a screenshot.

- [ ] **Step 5: Checkpoint.**

---

## Phase B — Account & workspace management screens

## Task 7: Account settings page

**Files:**

- Create: `app/(app)/account/page.tsx`
- Create: `components/app-shell/account/AccountForm.tsx`

- [ ] **Step 1: `app/(app)/account/page.tsx`** (server — passes current user in)

```tsx
import { requireUser } from "@/lib/auth";
import { requireWorkspace } from "@/lib/workspace";
import { AccountForm } from "@/components/app-shell/account/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  await requireWorkspace();
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Account</h1>
      <p className="mt-1 text-sm text-zinc-500">Manage your personal profile and security.</p>
      <AccountForm initialName={user.name} email={user.email} />
    </div>
  );
}
```

- [ ] **Step 2: `components/app-shell/account/AccountForm.tsx`** — profile (name) + security (password) + sign-out-everywhere note. Uses `PATCH /api/account` and `POST /api/account/password`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {desc && <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AccountForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameOk, setNameOk] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameOk(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingName(false);
    if (res.ok) {
      setNameOk(true);
      router.refresh();
      setTimeout(() => setNameOk(false), 1500);
    }
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: cur, next }),
    });
    const d = await res.json().catch(() => ({}));
    setPwBusy(false);
    setPwMsg(
      res.ok
        ? { ok: true, text: "Password updated. Other sessions were signed out." }
        : { ok: false, text: d.error || "Failed" },
    );
    if (res.ok) {
      setCur("");
      setNext("");
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

  return (
    <>
      <Card title="Profile">
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Email</label>
            <input className={input + " bg-zinc-50 text-zinc-400"} value={email} disabled />
          </div>
          <button
            disabled={savingName}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingName ? (
              <Loader2 size={15} className="animate-spin" />
            ) : nameOk ? (
              <Check size={15} />
            ) : null}{" "}
            Save
          </button>
        </form>
      </Card>
      <Card title="Password" desc="Changing your password signs out your other sessions.">
        <form onSubmit={savePw} className="space-y-3">
          <input
            className={input}
            type="password"
            placeholder="Current password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            required
          />
          <input
            className={input}
            type="password"
            placeholder="New password (min 8)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
          {pwMsg && (
            <p className={pwMsg.ok ? "text-xs text-emerald-600" : "text-xs text-red-600"}>
              {pwMsg.text}
            </p>
          )}
          <button
            disabled={pwBusy}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pwBusy && <Loader2 size={15} className="animate-spin" />} Update password
          </button>
        </form>
      </Card>
    </>
  );
}
```

- [ ] **Step 3: Runtime verify** — `/account`: change name (persists + reflects in sidebar profile after refresh); change password with wrong current → error; with correct + 8+ chars → success message.

- [ ] **Step 4: Checkpoint.**

---

## Task 8: Workspace settings page (general / members / invites / danger)

**Files:**

- Create: `app/(app)/settings/page.tsx`
- Create: `components/app-shell/settings/SettingsClient.tsx`

- [ ] **Step 1: `app/(app)/settings/page.tsx`** (server — gates by role, passes context)

```tsx
import { redirect } from "next/navigation";
import { requireWorkspace, hasRole } from "@/lib/workspace";
import { SettingsClient } from "@/components/app-shell/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { workspace, role } = await requireWorkspace();
  if (!hasRole(role as any, "ADMIN")) redirect("/"); // only admins+ manage the workspace
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Workspace settings</h1>
      <p className="mt-1 text-sm text-zinc-500">{workspace.name}</p>
      <SettingsClient workspace={workspace} role={role} />
    </div>
  );
}
```

- [ ] **Step 2: `components/app-shell/settings/SettingsClient.tsx`** — tabs: General (rename via `PATCH /api/workspaces/[id]`), Members (`GET/PATCH/DELETE /api/workspaces/members`), Invites (`GET/POST/DELETE /api/workspaces/invites`, show the returned link), Danger (delete via `DELETE /api/workspaces/[id]`, OWNER only). Full code:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, Trash2 } from "lucide-react";

type WS = { id: string; name: string; slug: string };
type Member = { membershipId: string; userId: string; name: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; token: string; expiresAt: string };
const ROLES = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];
const input =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

export function SettingsClient({ workspace, role }: { workspace: WS; role: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "members" | "invites" | "danger">("general");
  return (
    <>
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {(["general", "members", "invites", "danger"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-indigo-600 text-indigo-700" : "text-zinc-500 hover:text-zinc-800"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="py-6">
        {tab === "general" && <General workspace={workspace} onSaved={() => router.refresh()} />}
        {tab === "members" && <Members />}
        {tab === "invites" && <Invites />}
        {tab === "danger" && <Danger workspace={workspace} role={role} />}
      </div>
    </>
  );
}

function General({ workspace, onSaved }: { workspace: WS; onSaved: () => void }) {
  const [name, setName] = useState(workspace.name);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setOk(false);
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      onSaved();
      setTimeout(() => setOk(false), 1500);
    }
  }
  return (
    <form onSubmit={save} className="max-w-sm space-y-3">
      <label className="block text-xs font-medium text-zinc-600">Workspace name</label>
      <input className={input + " w-full"} value={name} onChange={(e) => setName(e.target.value)} />
      <button
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : ok ? <Check size={15} /> : null}{" "}
        Save
      </button>
    </form>
  );
}

function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const load = () =>
    fetch("/api/workspaces/members")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setMembers(d));
  useEffect(() => {
    load();
  }, []);
  async function changeRole(m: Member, role: string) {
    await fetch("/api/workspaces/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ membershipId: m.membershipId, role }),
    });
    load();
  }
  async function remove(m: Member) {
    if (!confirm(`Remove ${m.email}?`)) return;
    await fetch(`/api/workspaces/members?membershipId=${m.membershipId}`, { method: "DELETE" });
    load();
  }
  return (
    <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
      {members.map((m) => (
        <div key={m.membershipId} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            {(m.name || m.email).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800">{m.name || "—"}</p>
            <p className="truncate text-xs text-zinc-400">{m.email}</p>
          </div>
          <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} className={input}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={() => remove(m)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const load = () =>
    fetch("/api/workspaces/invites")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setInvites(d));
  useEffect(() => {
    load();
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setLink("");
    const res = await fetch("/api/workspaces/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setLink(d.inviteUrl);
      setEmail("");
      load();
    } else setErr(d.error || "Failed");
  }
  async function revoke(id: string) {
    await fetch(`/api/workspaces/invites?id=${id}`, { method: "DELETE" });
    load();
  }
  return (
    <div className="space-y-5">
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600">Invite by email</label>
          <input
            className={input + " w-full"}
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
          {["VIEWER", "EDITOR", "ADMIN"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Invite
        </button>
      </form>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {link && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-1.5 text-xs font-medium text-emerald-800">
            No email service configured — share this invite link:
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2">
            <code className="min-w-0 flex-1 truncate text-xs text-zinc-600">{link}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-700">{i.email}</p>
                <p className="text-xs text-zinc-400">{i.role} · pending</p>
              </div>
              <button
                onClick={() => revoke(i.id)}
                className="text-xs font-medium text-red-500 hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Danger({ workspace, role }: { workspace: WS; role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function del() {
    if (
      !confirm(`Delete "${workspace.name}"? This permanently removes its pages, CMS, and assets.`)
    )
      return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setErr(d.error || "Failed");
      setBusy(false);
    }
  }
  if (role !== "OWNER")
    return (
      <p className="text-sm text-zinc-500">Only the workspace owner can delete the workspace.</p>
    );
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <h3 className="text-sm font-semibold text-red-800">Delete this workspace</h3>
      <p className="mt-1 text-xs text-red-600">
        Permanent. You must have another workspace to switch to.
      </p>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      <button
        onClick={del}
        disabled={busy}
        className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete
        workspace
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Runtime verify** (use a second test account for member tests) — General rename reflects in the switcher; Members lists you as OWNER and a role change persists; Invites creates a link, and revoking removes it; Danger is OWNER-only and refuses your last workspace. Verify a VIEWER/EDITOR is redirected away from `/settings`.

- [ ] **Step 4: Checkpoint.**

---

## Task 9: Invite-accept page

**Files:**

- Create: `app/invite/[token]/page.tsx` (OUTSIDE the `(app)` group — standalone)
- Create: `components/app-shell/InviteAccept.tsx`

- [ ] **Step 1: `app/invite/[token]/page.tsx`** (server passes the token; requires login — proxy already redirects logged-out users to /login?next=/invite/<token>)

```tsx
import { requireUser } from "@/lib/auth";
import { InviteAccept } from "@/components/app-shell/InviteAccept";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <InviteAccept token={token} />
    </div>
  );
}
```

- [ ] **Step 2: `components/app-shell/InviteAccept.tsx`** — previews via `GET /api/invites/[token]`, accepts via `POST`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function InviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<{
    valid: boolean;
    workspaceName?: string;
    role?: string;
    email?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ valid: false }));
  }, [token]);

  async function accept() {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setErr(d.error || "Could not accept");
      setBusy(false);
    }
  }

  if (!state) return <Loader2 className="animate-spin text-zinc-400" />;
  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
      {state.valid ? (
        <>
          <h1 className="text-xl font-bold text-zinc-900">Join {state.workspaceName}</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            You've been invited as <span className="font-medium">{state.role}</span>.
          </p>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <button
            onClick={accept}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Accept invitation
          </button>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-zinc-900">Invite unavailable</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            This invitation is invalid, expired, or already used.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 text-sm font-semibold text-indigo-600"
          >
            Go to dashboard
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Runtime verify** (two accounts) — create an invite in Settings → Invites, open the link in a second account → see "Join …" → Accept → lands on the dashboard scoped to the joined workspace. A wrong-email account sees the 403 surfaced as "Could not accept".

- [ ] **Step 4: Checkpoint.**

---

## Phase C — Manager pages

## Task 10: Activity API + page

**Files:**

- Create: `app/api/activity/route.ts`
- Create: `app/(app)/activity/page.tsx`

- [ ] **Step 1: `app/api/activity/route.ts`** (the read endpoint missing from Plan 1A)

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireApiWorkspace();
  if ("response" in a) return a.response;
  const events = await prisma.activityEvent.findMany({
    where: { workspaceId: a.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // resolve actor names in one query
  const actorIds = [...new Set(events.map((e) => e.actorId))];
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      type: e.type,
      targetId: e.targetId,
      meta: safe(e.meta),
      actor: byId.get(e.actorId)?.name || byId.get(e.actorId)?.email || "Someone",
      createdAt: e.createdAt.toISOString(),
    })),
  );
}
function safe(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: `app/(app)/activity/page.tsx`** — client page that fetches + renders a timeline. Map `type` → human verb (`page.created` → "created a page", `page.published` → "published a page", `invite.sent` → "invited someone", `member.joined` → "joined the workspace"). Group by day. Use a contextual empty state ("Activity will appear here as your team builds.") when empty. (Write a focused client component inline in the page file.)

- [ ] **Step 3: Runtime verify** — `/activity` shows recent events (create/publish a page, then refresh — entries appear with your name + relative time). Empty workspace shows the empty state.

- [ ] **Step 4: Checkpoint.**

---

## Task 11: Forms, Components, Assets list pages

**Files:**

- Create: `app/(app)/forms/page.tsx`
- Create: `app/(app)/components/page.tsx`
- Create: `app/(app)/assets/page.tsx`

- [ ] **Step 1: `app/(app)/forms/page.tsx`** — server: list the workspace's pages that have submissions, with counts, linking each to a submissions view. Reuse `components/dashboard/SubmissionsModal.tsx` (it already takes `{ page: {id,title} }`). Render a client wrapper that lists pages (from a `GET /api/pages` fetch or a server query) and opens the existing `SubmissionsModal` on click. Contextual empty state when no submissions exist.

```tsx
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { FormsClient } from "@/components/app-shell/FormsClient";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const { workspace } = await requireWorkspace();
  const pages = await prisma.page.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
  const dto = pages.map((p) => ({ id: p.id, title: p.title, count: p._count.submissions }));
  return <FormsClient pages={dto} />;
}
```

Create `components/app-shell/FormsClient.tsx`: a page wrapper (heading "Forms", list of pages with a submission count badge; clicking a page with count>0 opens `<SubmissionsModal page={{id,title}} onClose=… />`). Empty state if all counts are 0.

- [ ] **Step 2: `app/(app)/components/page.tsx`** — server: list the workspace's reusable components (`prisma.component.findMany({ where: { workspaceId } })`), each linking to `/component/[id]`. Card grid mirroring the dashboard style. Empty state with a short explainer ("Save any section as a reusable component from the editor.").

- [ ] **Step 3: `app/(app)/assets/page.tsx`** — server: list the workspace's assets (`prisma.asset.findMany({ where: { workspaceId } })`), render an image/file grid (thumb for images via `<img src={a.url}>`, file icon otherwise, name + size). Empty state ("Upload images and files from any editor's asset picker."). Read-only browser is fine for 1B.

- [ ] **Step 4: Runtime verify** — each page renders the workspace's data (or its empty state); `/components` cards open the component editor; `/forms` opens the submissions modal for a page that has entries.

- [ ] **Step 5: Checkpoint.**

---

## Task 12: CMS / Design / Site hub pages

**Files:**

- Create: `app/(app)/cms/page.tsx`
- Create: `app/(app)/design/page.tsx`
- Create: `app/(app)/site/page.tsx`

These three managers currently live inside the editor (Plan 1C will promote them to full standalone tools). For 1B they are clean hub pages so the nav is complete and nothing 404s.

- [ ] **Step 1: `app/(app)/cms/page.tsx`** — server: list the workspace's collections (`prisma.collection.findMany({ where: { workspaceId } })`) with item counts; each row links to `/collection/[id]/template` (the existing detail-template editor). Header explains "Collections power dynamic content." Empty state ("Create collections from the CMS panel inside the editor.") — include a CTA button linking to the first page's editor or the dashboard.

- [ ] **Step 2: `app/(app)/site/page.tsx`** — server page (no heavy data): two cards, "Header" → links to `/site/header`, "Footer" → links to `/site/footer` (the existing region editors). Short explainer that these render on every published page.

- [ ] **Step 3: `app/(app)/design/page.tsx`** — server page: an explainer card for the design system (shared colors + text styles) with a CTA "Open the Design panel" that links into a page editor (e.g., the first page `/editor/<id>` — fetch one page id server-side; if none, link to `/`). Note in a code comment that Plan 1C will render the standalone design-system manager here.

- [ ] **Step 4: Runtime verify** — `/cms`, `/site`, `/design` all render (no 404), their links navigate to the existing editor flows, and the sidebar highlights the active item.

- [ ] **Step 5: Checkpoint.**

---

## Task 13: Final polish + full runtime sweep

- [ ] **Step 1:** `npx tsc --noEmit` clean; `npm test` still green (67 — no unit tests changed, but confirm nothing broke imports).

- [ ] **Step 2: Full shell runtime sweep** (signed in):
  - Sidebar renders dark rail on every `(app)` route; active item highlights correctly per route.
  - Collapse toggles to an icon rail and **persists across reload**; tooltips show on hover when collapsed.
  - Mobile (`< 768px`): top bar + drawer open/close.
  - ⌘K opens anywhere in the shell; arrow keys + Enter navigate; jumps to a page editor.
  - Workspace switcher: switch changes scoped content; create makes a new empty workspace and switches to it.
  - Profile menu → Account settings + Sign out work.
  - `/account`, `/settings` (all four tabs), `/activity`, `/forms`, `/components`, `/assets`, `/cms`, `/design`, `/site` all render with content or a contextual empty state.
  - Editor (`/editor/[id]`) still opens full-screen with NO sidebar (outside the group).
  - `/login`, `/onboarding` unaffected (no sidebar).
  - Invite flow end-to-end via a second account.
  - Screenshots: expanded shell, collapsed rail, command palette, settings/members, an empty manager page.

- [ ] **Step 3: Checkpoint** — Plan 1B complete. (Plan 1C promotes Design/Site/CMS panels into full standalone managers.)

---

## Self-review (author check against the spec)

- **Spec §3 sidebar app shell** (route group, server layout, collapse+cookie, mobile drawer, active highlight, dark rail) → Tasks 1, 2, 6.
- **Spec §3 workspace switcher (top) + profile (bottom)** → Tasks 3, 4.
- **Spec §3 ⌘K command palette** → Task 5.
- **Spec §3 grouped IA Build/Brand/Grow** → Task 1 (`nav.ts`) + Task 2.
- **Spec §4 manager pages** → Pages (Task 6), Forms/Components/Assets (Task 11), Activity (Task 10, incl. the read API that Plan 1A omitted), CMS/Design/Site hubs (Task 12, with full promotion deferred to Plan 1C — explicitly noted).
- **Spec §5 members/invites + settings/account screens** → Tasks 7, 8, 9 (consume the Plan 1A APIs; role-gated; on-screen invite link).
- **Spec §6 verification** → runtime sweeps per task + Task 13.
- **Deferred to Plan 1C:** standalone Design/Site/CMS managers (currently editor panels). **Deferred to later workstreams:** billing UI, realtime collaboration, the rename + final dark palette.

**Type/route consistency:** the sidebar/layout pass `{ id, name, slug, role }` workspaces and `{ name, email }` user consistently; nav hrefs in `nav.ts` match the created routes; settings/account/invite components call the exact Plan 1A endpoints and shapes (`membershipId`, `inviteUrl`, `{ current, next }`); the `(app)` group holds only shell routes while editor/auth/onboarding/public stay outside.
