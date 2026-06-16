# Architecture Decision Records

This directory records the significant architectural decisions behind **Pagecraft**
(`dnd-pagebuilder`). Each record captures the context at the time, the decision
taken, and the consequences — so future contributors understand *why* the system
looks the way it does, not just *what* it does.

## Format

Records follow a lightweight [Nygard-style](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
ADR template: **Context → Decision → Consequences → Alternatives considered**.

- Files are numbered sequentially and never renumbered.
- A decision is never edited away; if it changes, add a new ADR that
**supersedes** the old one and update the status of both.

## Status legend


| Status       | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `Accepted`   | Decision is in effect and reflected in the codebase. |
| `Superseded` | Replaced by a later ADR (linked).                    |
| `Deprecated` | No longer recommended but still present.             |
| `Proposed`   | Under discussion, not yet implemented.               |


## Index


| #                                                | Title                                                         | Status   |
| ------------------------------------------------ | ------------------------------------------------------------- | -------- |
| [0001](0001-next-app-router-react-19.md)         | Next.js 16 App Router + React 19 as the application framework | Accepted |
| [0002](0002-recursive-json-block-tree.md)        | Pages as a recursive JSON block tree                          | Accepted |
| [0003](0003-central-block-registry.md)           | A central block registry as the single source of truth        | Accepted |
| [0004](0004-zustand-immutable-tree-undo-redo.md) | Zustand store with immutable tree ops and undo/redo           | Accepted |
| [0005](0005-dnd-kit-iframe-canvas.md)            | dnd-kit drag-and-drop inside an iframe canvas                 | Accepted |
| [0006](0006-prisma-sqlite-json-columns.md)       | Prisma + SQLite with JSON-encoded string columns              | Accepted |
| [0007](0007-workspace-multitenancy.md)           | Workspace-scoped multi-tenancy                                | Accepted |
| [0008](0008-cookie-session-auth-proxy-gate.md)   | Cookie sessions with an optimistic proxy gate                 | Accepted |
| [0009](0009-responsive-scoped-styles.md)         | Per-breakpoint styles compiled to scoped stylesheets          | Accepted |
| [0010](0010-zod-guarded-api-handlers.md)         | Zod-validated, role-guarded API handlers                      | Accepted |
| [0011](0011-vitest-no-eslint.md)                 | Vitest dual-project testing; no ESLint                        | Accepted |


