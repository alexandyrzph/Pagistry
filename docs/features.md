# Pagistry — Features

Pagistry is a full-stack, Divi/Webflow-style **visual page builder**. Build
responsive pages from a rich block library, manage content with a built-in CMS,
collaborate across workspaces, then **publish to a public URL** or **export
standalone HTML**.

This document is a complete catalogue of what the app can do. For the _why_
behind the design, see the [Architecture Decision Records](./adr/README.md); for
diagrams, see [architecture.md](./architecture.md).

---

## Table of contents

1. [The editor / canvas](#1-the-editor--canvas)
2. [Block library](#2-block-library)
3. [Inspector & styling](#3-inspector--styling)
4. [Responsive design](#4-responsive-design)
5. [Pages & dashboard](#5-pages--dashboard)
6. [Design system & site](#6-design-system--site)
7. [CMS / collections](#7-cms--collections)
8. [Reusable components](#8-reusable-components)
9. [Forms & submissions](#9-forms--submissions)
10. [Assets & media](#10-assets--media)
11. [AI assistance](#11-ai-assistance)
12. [Publishing & export](#12-publishing--export)
13. [Workspaces & collaboration](#13-workspaces--collaboration)
14. [Accounts & authentication](#14-accounts--authentication)
15. [Keyboard shortcuts](#15-keyboard-shortcuts)
16. [Route map](#16-route-map)

---

## 1. The editor / canvas

A real-time visual builder where content is rendered inside an **iframe canvas**,
so what you see matches the published page (including responsive CSS at the true
device width).

**Building**

- **Drag-and-drop** blocks from the palette onto the canvas; reorder and move
  blocks; drop into container slots (sections, columns).
- **Inline editing** directly on the canvas — click headings, hero copy, feature
  text, pricing, navbar, footer, and form labels to edit in place.
- **Rich text** for Text blocks: bold, italic, strikethrough, bullet/ordered
  lists, links — plus AI rewrite from the toolbar.
- **Section inserter** — searchable modal with wireframe previews and an AI
  shortcut for adding whole sections.

**Selecting**

- Click to select; **multi-select** with Shift/Cmd-click.
- **Floating selection toolbar**: drag handle, duplicate, delete, save as
  component (component instances also get Edit / Detach).
- **Selection breadcrumb** showing the ancestor path, or a **multi-select action
  bar** (duplicate, paste styles, delete).
- Hover outlines and block labels while editing.

**Editing operations**

- **Undo / redo** with a 100-step history.
- **Copy / cut / paste** blocks, **duplicate**, and **delete**.
- **Copy / paste styles** — lift a block's full responsive style set onto another.
- **Right-click context menu**: duplicate, copy, cut, paste, copy/paste styles,
  insert section below, move up/down, save as component, delete.

**Workspace UI**

- **Top bar**: inline page-title editing, AI, zoom, breakpoints, undo/redo, DOM
  tree, preview, version history, export HTML, save status, publish/unpublish.
- **Left rail panels**: Blocks, Layers, Pages, Site, Design, SEO, CMS.
- **Floating inspector** — draggable, resizable, and dockable.
- **Layers panel** — hierarchical tree to select, hover, and delete blocks.
- **DOM tree panel** — HTML-like view with tags/ids/classes (dock, full-width, or
  float).
- **Command palette (⌘K)** — insert any block, switch viewport, toggle preview,
  undo/redo, duplicate/delete, save, publish, export, go to dashboard.
- **Preview mode** — hides editor chrome and shows the real site header/footer.
- **Zoom** — in/out, presets (50–200%), **Fit to width**, and ⌘+/⌘-/⌘0.

**Saving**

- **Autosave** (debounced ~1.2s) plus manual save (⌘S).
- **Unsaved-changes guard** when switching pages or leaving the editor, including
  a browser unload warning.

**One editor, four modes** — the same editor shell powers pages, reusable
components, the site header/footer, and CMS detail templates.

---

## 2. Block library

**25 insertable blocks** across four categories, all from a central registry that
keeps the palette, canvas, and inspector in sync.

### Layout

| Block       | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Section** | Full-width container with background, spacing, border, and layout styles |
| **Columns** | Multi-column layout with presets: 1, 1-1, 1-1-1, 1-1-1-1, 1-2, 2-1       |
| **Spacer**  | Adjustable vertical space                                                |
| **Divider** | Horizontal rule with color, thickness, width, and line style             |

### Basic

| Block            | Description                                         |
| ---------------- | --------------------------------------------------- |
| **Heading**      | Text with level h1–h6                               |
| **Text**         | Rich-text paragraph (inline editing)                |
| **Button**       | Label, link, and alignment                          |
| **Image**        | Asset-picker source, alt text, object fit           |
| **Icon**         | 60 curated Lucide icons with size, color, alignment |
| **Video**        | YouTube, Vimeo, or MP4 URL                          |
| **List**         | Bulleted list with custom bullet icon and color     |
| **Quote**        | Quotation with author                               |
| **File**         | Downloadable file with title and description        |
| **Embed / HTML** | Raw HTML or iframe snippet                          |
| **Code**         | Code block with a language label                    |

### Sections

| Block              | Description                                           |
| ------------------ | ----------------------------------------------------- |
| **Navbar**         | Brand, nav links, and a CTA button                    |
| **Hero**           | Eyebrow, title, subtitle, button, alignment           |
| **Feature grid**   | 2/3/4-column features with icon, title, text          |
| **Pricing**        | Plans with price, period, feature list, featured flag |
| **Testimonial**    | Quote, author, role, avatar, 1–5 star rating          |
| **Stats**          | Value/label statistic items                           |
| **Call to action** | Title, subtitle, button                               |
| **Form**           | Contact form with configurable fields (see §9)        |
| **Footer**         | Brand, tagline, nav links, copyright                  |

### Dynamic

| Block               | Description                                  |
| ------------------- | -------------------------------------------- |
| **Collection List** | Renders items from a CMS collection (see §7) |

> Two internal block types support the system: **Column** (auto-created inside
> Columns) and **Component** (a synced instance of a saved component).

---

## 3. Inspector & styling

The inspector has two tabs: **Content** and **Style**.

**Content** — fields are defined per block and include text, textarea, code,
number, select, color, image, URL, boolean, icon, file, string-list, and
repeatable item lists. Every block also exposes:

- **HTML ID** and **CSS classes**
- **Text style** picker (apply or save a site-wide preset)
- **Copy / paste styles**

**Style groups** (shown per block as relevant):
| Group | Controls |
| --- | --- |
| **Typography** | Size, weight, color, line height, letter spacing, alignment, transform |
| **Spacing** | Padding & margin (linked or per side) |
| **Background** | Color, image, gradient |
| **Border** | Radius, width, style, color |
| **Effects** | Shadow presets, opacity |
| **Layout** | Max width, min height, display, align/justify, gap |

**Motion** — scroll animations per block: fade-up, fade-in, zoom-in, slide-left,
slide-right, with adjustable delay. Plays in preview and on published pages.

---

## 4. Responsive design

- **Three breakpoints**: desktop (≥1025px), tablet (641–1024px), mobile (≤640px).
- **Breakpoint switcher** with device presets (1920, 1440, 1024, 768, 430, 375,
  320px) and custom widths.
- **Per-breakpoint style overrides** — cascade desktop-first.
- **Per-breakpoint visibility** — hide a block on desktop, tablet, or mobile.
- **Device frame** preview with faux browser chrome showing the public URL.

---

## 5. Pages & dashboard

**Dashboard**

- Grid of page cards with **thumbnail previews** (with stale detection), live/draft
  badges, slug, and last-updated time.
- **Filter** (All / Live / Drafts) and **search** by title.
- **Create** from a template or blank; **delete** with confirmation.
- **View live** link for published pages.
- Per-page **submissions inbox** with a count badge.
- **Generate a page with AI** when AI is configured.

**Page templates**: Blank, Landing page, SaaS / Pricing, Portfolio.

**SEO panel** — meta title, meta description, Open Graph image, with a live social
share preview.

**Publishing** — publish/unpublish from the top bar; published pages are served at
`/p/{slug}`.

**Version history**

- Manual **Save version** snapshots.
- Automatic **"Published"** snapshot on each publish.
- Automatic **"Before restore"** snapshot when restoring.
- Restore content + theme, or delete versions.

---

## 6. Design system & site

**Per-page theme** — brand color (with shuffle), font (5 presets), corner radius
(6 presets).

**Site-wide shared styles**

- **Color styles** — named colors exposed as CSS variables and reusable anywhere.
- **Text styles** — named typography presets applied via the inspector.
- Managed in the editor **Design** rail or the standalone **/design** page.

**Site header & footer** — global block trees rendered on every published page and
CMS detail page; edited at `/site/header` and `/site/footer`.

---

## 7. CMS / collections

A built-in content management system for structured, reusable content.

- **Collections** with custom **fields**: text, textarea, image, URL, number,
  date, boolean.
- **Items** — add, edit, reorder, and delete entries with typed editors.
- **Detail pages** — enable per collection, design a template with `{{field}}`
  tokens at `/collection/[id]/template`, served publicly at `/c/{slug}/{item}`.
- **Collection List block** — pick a collection, choose grid/list layout and
  column count, set a limit, and **bind fields** to card slots (image, title,
  subtitle, text, link). Cards auto-link to their detail page.
- Managed via the editor **CMS panel**, the **/cms** pages, or the in-editor
  manager modal (Fields / Items / Detail tabs).

---

## 8. Reusable components

- **Save** any block (and its children) as a named, reusable component.
- **Insert** from the "My components" section of the Blocks panel or the
  **/components** page — by click or drag.
- **Synced instances** — editing the component at `/component/[id]` updates every
  instance across all pages.
- **Detach** — convert an instance into an independent local copy.

---

## 9. Forms & submissions

- **Form block** with configurable fields (text, email, tel, number, textarea) and
  per-field required flags; inline-editable title/description.
- Submissions are captured on **published pages** and stored per page.
- **View submissions** from the dashboard inbox or the aggregated **/forms** page.
- **CSV export** of a page's submissions.

---

## 10. Assets & media

- **Upload** images and files into a workspace-scoped media library.
- **Asset picker** modal used by image and file fields — browse, filter, and
  upload.
- **/assets** page — grid of uploaded files with previews, names, and sizes.

---

## 11. AI assistance

Powered by Anthropic or OpenAI (configurable; a mock mode exists for development).
Available to Editors and above.

- **Section generation** — describe a section and insert 1–3 generated blocks.
- **Full-page generation** — generate an entire page (from the editor or the
  dashboard).
- **Design styles** — Auto, Bold·Dark, Soft·Pastel, Editorial, Glass, Brutalist,
  Mono.
- **Text rewrite** — Improve writing, Make shorter, Make longer, Fix spelling &
  grammar, More professional, More casual.
- All AI output is sanitized against the block registry before insertion.

---

## 12. Publishing & export

**Published pages** (`/p/{slug}`) include page content, site header/footer, design
system CSS, responsive media queries, theme variables, synced components, live
collection data, scroll animations, and full **SEO metadata** (title, description,
Open Graph / Twitter tags, JSON-LD schema).

**Discoverability** — automatic `/sitemap.xml` (published pages) and `/robots.txt`.

**HTML export** — download a **self-contained `.html` file** with styling and
markup inlined, ready to host anywhere.

---

## 13. Workspaces & collaboration

Multi-tenant workspaces with role-based access.

**Roles**: OWNER > ADMIN > EDITOR > VIEWER.

| Role       | Can                                                                          |
| ---------- | ---------------------------------------------------------------------------- |
| **Viewer** | View the dashboard, pages, and assets                                        |
| **Editor** | Create/edit pages, CMS, components; publish; upload; use AI; manage versions |
| **Admin**  | Everything above, plus invite/manage members and rename the workspace        |
| **Owner**  | Everything above, plus delete the workspace                                  |

- **Workspace switcher** to move between workspaces.
- **Settings** (Admin+): rename workspace, manage members and roles, **invite by
  email** with a copyable invite link, and (Owner) delete the workspace.
- **Invite acceptance** via `/invite/{token}`.
- **Activity feed** — page created/published, invite sent, member joined — grouped
  by day.

---

## 14. Accounts & authentication

- **Sign up / log in** with email and password.
- **Password reset** via emailed (or displayed) reset link.
- **Onboarding** — a short guided product tour for new users.
- **Account settings** — update display name and change password (which
  invalidates other sessions).

---

## 15. Keyboard shortcuts

| Shortcut           | Action                 |
| ------------------ | ---------------------- |
| ⌘K                 | Command palette        |
| ⌘S                 | Save                   |
| ⌘Z / ⌘⇧Z           | Undo / Redo            |
| ⌘C / ⌘X / ⌘V       | Copy / Cut / Paste     |
| ⌘D                 | Duplicate              |
| ⌘⌥C / ⌘⌥V          | Copy / Paste styles    |
| ⌘+ / ⌘- / ⌘0       | Zoom in / out / reset  |
| Delete / Backspace | Delete selected        |
| Escape             | Deselect / close panel |

---

## 16. Route map

| Route                                                                       | Purpose                    |
| --------------------------------------------------------------------------- | -------------------------- |
| `/`                                                                         | Pages dashboard            |
| `/editor/[id]`                                                              | Page editor                |
| `/component/[id]`                                                           | Component editor           |
| `/site/header`, `/site/footer`                                              | Site header/footer editors |
| `/collection/[id]/template`                                                 | CMS detail template editor |
| `/p/[slug]`                                                                 | Published page             |
| `/c/[slug]/[item]`                                                          | Published CMS item detail  |
| `/design`, `/site`, `/cms`, `/components`, `/assets`, `/forms`, `/activity` | App sections               |
| `/settings`, `/account`                                                     | Workspace & user settings  |
| `/login`, `/signup`, `/forgot`, `/reset`, `/onboarding`, `/invite/[token]`  | Auth & onboarding          |

---

## At a glance

- **25** palette blocks across Layout, Basic, Sections, and Dynamic categories
- **4** starter templates plus AI full-page generation
- **3** responsive breakpoints with per-breakpoint overrides and visibility
- **6** style groups + motion/scroll animations
- Built-in **CMS**, **reusable components**, **forms**, **media library**
- **AI** section/page generation and text rewriting
- **Workspaces** with 4 roles, invites, and an activity feed
- **Publish** to a public URL or **export** self-contained HTML
