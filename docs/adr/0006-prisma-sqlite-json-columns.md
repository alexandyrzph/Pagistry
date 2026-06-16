# 6. Prisma + SQLite with JSON-encoded string columns

- **Status:** Accepted
- **Date:** 2026-06-13

## Context

The product needs persistence for pages, components, sites, collections, assets,
users/sessions, workspaces, versions, and submissions. Much of this data is
inherently document-shaped (the block tree, design tokens, collection item
values) rather than relational. We wanted fast local development with zero
external services, type-safe queries, and an easy migration path.

## Decision

Use **Prisma** as the ORM over **SQLite** (`prisma/dev.db`), and store
document-shaped data as **JSON-encoded `String` columns**.

- Relational where it earns its keep: `User`, `Session`, `Workspace`,
  `Membership`, `Invite`, `Collection`/`CollectionItem`, `Page`/`PageVersion`/
  `Submission`/`PageThumbnail`.
- JSON-in-`String` where the shape is a document: `Page.content` (Block[]),
  `Page.theme`, `Site.header`/`footer`/`colors`/`textStyles`,
  `Collection.fields`/`detailTemplate`, `CollectionItem.data`,
  `Component.content`, `Submission.data`.
- (De)serialization and slug uniqueness are centralized (e.g.
  `lib/page-service.ts`); a Prisma singleton (`lib/prisma.ts`) is dev hot-reload
  safe.
- Schema is applied with `prisma db push` for the SQLite dev workflow.

## Consequences

- **Positive:** Zero-setup local dev (a file DB), type-safe queries, and the
  block tree round-trips as a single column matching the data model (ADR 0002).
- **Positive:** Adding fields to a block or collection item needs no migration —
  it's just JSON.
- **Negative:** JSON columns are opaque to the database: no SQL querying,
  indexing, or referential integrity on their contents. Validation is the
  application's job.
- **Negative:** SQLite has real limits (concurrency, no native JSON column type
  here, NULL-uniqueness quirks — see the `Site.workspaceId` note). Moving to
  Postgres later means a provider switch and revisiting these JSON columns.
- **Negative:** `db push` (vs. migrations) is convenient in dev but not a
  production migration strategy.

## Alternatives considered

- **Postgres + `jsonb` from day one.** More powerful (queryable JSON, real
  migrations) but adds an external dependency and setup cost not justified for the
  current stage; the Prisma abstraction keeps this switch open.
- **A document database (MongoDB).** Fits the tree shape but loses relational
  integrity for users/workspaces/memberships, which are genuinely relational.
- **Fully normalized block storage.** Rejected for the same reasons as ADR 0002:
  the tree is read/written whole.
