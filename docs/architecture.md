# Pagecraft — Architecture Diagrams

Visual companion to the [Architecture Decision Records](./adr/README.md). All
diagrams are [Mermaid](https://mermaid.js.org) so they render on GitHub and in
most Markdown viewers. For a whiteboard-style version, the same models import
cleanly into [Excalidraw](https://excalidraw.com) via its Mermaid-to-Excalidraw
feature.

---

## 1. System context (C4 level 1)

How the system sits between its users and the outside world.

```mermaid
graph TB
    builder["Builder / Editor<br/>(authenticated user)"]
    visitor["Public visitor<br/>(anonymous)"]
    admin["Workspace owner/admin"]

    subgraph pagecraft["Pagecraft (Next.js 16 app)"]
        editor["Editor SPA"]
        public["Public page renderer<br/>/p, /c"]
        api["API route handlers<br/>/api/*"]
    end

    db[("SQLite via Prisma<br/>pages, workspaces, CMS…")]
    ai["LLM providers<br/>(Anthropic / OpenAI)"]
    files["Local file storage<br/>public/uploads"]
    shot["Headless Chromium<br/>(Playwright thumbnails)"]

    builder --> editor
    admin --> editor
    visitor --> public

    editor --> api
    public --> db
    api --> db
    api --> ai
    api --> files
    api --> shot
    shot --> public
```

---

## 2. Container / module view

The major code areas and how they depend on each other. Mirrors ADRs
[0001](./adr/0001-next-app-router-react-19.md)–[0011](./adr/0011-vitest-no-eslint.md).

```mermaid
graph LR
    subgraph client["Client (browser)"]
        ed["components/editor/*<br/>DnD canvas + inspector"]
        stores["store/*<br/>Zustand: tree, ui, zoom"]
        ed <--> stores
    end

    subgraph server["Server (Next.js)"]
        pages["app/(app), app/editor<br/>server pages"]
        pub["app/p, app/c<br/>public pages"]
        routes["app/api/*<br/>route handlers"]
        proxy["proxy.ts<br/>optimistic auth gate"]
    end

    subgraph domain["Domain logic (lib/)"]
        registry["blocks/registry.ts"]
        tree["blocks/tree.ts<br/>pure tree ops"]
        styles["blocks/styles.ts<br/>style resolver"]
        export["blocks/export-html.ts"]
        authz["auth/*, api/api-handler.ts"]
        obs["observability/*"]
    end

    renderer["components/BlockRenderer.tsx"]
    prisma[("Prisma + SQLite")]

    ed --> registry
    ed --> tree
    stores --> tree
    ed --> renderer
    pub --> renderer
    renderer --> registry
    renderer --> styles

    routes --> authz
    routes --> obs
    authz --> prisma
    pages --> authz
    routes --> prisma
    export --> styles
    proxy -.guards.-> pages
```

---

## 3. Request lifecycle — authenticated API call

End-to-end path of an autosave `PUT /api/pages/:id`, including the two-layer auth
([ADR 0008](./adr/0008-cookie-session-auth-proxy-gate.md)) and observability
([ADR 0010](./adr/0010-zod-guarded-api-handlers.md)).

```mermaid
sequenceDiagram
    autonumber
    participant C as Editor (client)
    participant P as proxy.ts
    participant R as Route handler
    participant O as instrumentApi (obs)
    participant G as withRole / withWorkspace
    participant Z as Zod schema
    participant DB as Prisma/SQLite

    C->>P: PUT /api/pages/:id (cookie pc_session)
    Note over P: /api is never gated here<br/>(handlers enforce auth)
    P-->>R: pass through
    R->>O: instrumentApi("/api/pages/:id", req, fn)
    O->>O: start span, trace_id, timer
    O->>G: withRole("EDITOR", fn)
    G->>DB: resolve session + membership
    alt not authorized
        G-->>O: 401/403 Response
        O->>O: authz_total{denied}, http_*{status}
        O-->>C: error + x-trace-id
    else authorized
        G->>Z: parseBody(req, schema)
        Z-->>G: typed data (or 400)
        G->>DB: page.updateMany(scoped by workspaceId)
        DB-->>G: result
        G-->>O: 200 Response
        O->>O: http_requests_total, http_request_duration_ms, request log
        O-->>C: page JSON + x-trace-id
    end
```

---

## 4. Editor data flow — block tree, state, undo/redo

How a drag/edit mutates state ([ADR 0002](./adr/0002-recursive-json-block-tree.md),
[ADR 0004](./adr/0004-zustand-immutable-tree-undo-redo.md)).

```mermaid
flowchart TD
    drag["User drags / edits in canvas"] --> action["Editor action<br/>addBlock / moveExisting / setProp / setStyle"]
    action --> pureops["lib/blocks/tree.ts<br/>pure immutable op → new tree"]
    pureops --> store["Zustand editor-store<br/>present = newTree"]
    store --> history{"coalesce with<br/>last edit?"}
    history -- no --> push["push prev tree → past[]<br/>clear future[]"]
    history -- yes --> merge["replace top of past[]"]
    store --> render["EditorBlock + BlockRenderer<br/>re-render via selectors"]
    store --> autosave["debounced autosave"]
    autosave --> api["PUT /api/pages/:id"]
    undo["⌘Z"] --> popPast["past.pop() → present<br/>present → future"]
    redo["⌘⇧Z"] --> popFuture["future.pop() → present"]
    popPast --> render
    popFuture --> render
```

---

## 5. Drag-and-drop across the iframe boundary

The most intricate piece ([ADR 0005](./adr/0005-dnd-kit-iframe-canvas.md)):
content lives in an iframe, chrome lives in the parent, coordinates are mapped
and zoom-scaled.

```mermaid
sequenceDiagram
    autonumber
    participant U as Pointer
    participant DK as dnd-kit (parent doc)
    participant IF as CanvasFrame (iframe)
    participant OV as CanvasOverlay (parent)
    participant ST as editor-store

    U->>DK: dragStart (palette item / existing block)
    DK->>IF: set iframe pointer-events:none
    Note over DK,IF: parent keeps receiving pointer events
    U->>DK: dragMove
    DK->>IF: read droppable rects (iframe geometry)
    DK->>OV: map iframe coords → parent, scale by zoom
    OV->>U: draw insertion indicator + ghost
    U->>DK: dragEnd
    DK->>ST: addBlock / moveExisting(targetId, index)
    ST->>IF: restore pointer-events
    ST->>OV: refresh selection chrome
```

---

## 6. Data model (ER)

Tenant-scoped relational core + JSON document columns
([ADR 0006](./adr/0006-prisma-sqlite-json-columns.md),
[ADR 0007](./adr/0007-workspace-multitenancy.md)).

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ Membership : joins
    Workspace ||--o{ Membership : has
    Workspace ||--o{ Invite : has
    Workspace ||--o| Site : owns
    Workspace ||--o{ Page : contains
    Workspace ||--o{ Component : contains
    Workspace ||--o{ Collection : contains
    Workspace ||--o{ Asset : contains
    Page ||--o{ PageVersion : snapshots
    Page ||--o| PageThumbnail : preview
    Page ||--o{ Submission : receives
    Collection ||--o{ CollectionItem : contains

    Page {
        string id PK
        string slug UK
        string content "JSON Block[]"
        string theme "JSON"
        string workspaceId FK
        bool published
    }
    Workspace {
        string id PK
        string slug UK
    }
    Membership {
        string userId FK
        string workspaceId FK
        enum role "OWNER|ADMIN|EDITOR|VIEWER"
    }
    Site {
        string workspaceId UK
        string header "JSON Block[]"
        string footer "JSON Block[]"
    }
```

---

## 7. Observability pipeline

What the app emits and where it goes
([details](./observability.md)).

```mermaid
flowchart LR
    subgraph app["Pagecraft process"]
        code["Route handlers + domain"]
        log["logger<br/>structured JSON"]
        met["metrics registry<br/>counters + histograms"]
        tr["trace<br/>AsyncLocalStorage spans"]
        code --> log
        code --> met
        code --> tr
        tr --> log
    end

    log --> stdout["stdout (JSON lines)"]
    stdout --> collector["Log shipper<br/>(Vector / Fluent Bit)"]
    collector --> loki["Loki / ELK"]

    met --> scrape["/api/internal/metrics<br/>(Prometheus text)"]
    scrape --> prom["Prometheus"]
    prom --> graf["Grafana dashboards<br/>+ alerts"]

    tr -. OTLP-ready .-> otel["OpenTelemetry Collector"]
    otel --> tempo["Tempo / Jaeger"]

    health["/api/internal/health"] --> uptime["Uptime checks / LB probe"]
```

---

## 8. Deployment topology (target)

```mermaid
graph TB
    user["Users"] --> cdn["CDN / Edge<br/>static assets, /_next"]
    cdn --> app["Next.js server<br/>(Node runtime)"]
    app --> dbp[("Postgres<br/>(prod target — see ADR 0006)")]
    app --> obj["Object storage<br/>(uploads — S3-compatible)"]
    app --> queue["Job runner<br/>(thumbnail screenshots)"]
    app --> metrics["Prometheus scrape"]
    app --> logs["stdout → log pipeline"]
    metrics --> graf["Grafana"]
```

> The current dev stack runs everything in one Node process with SQLite and the
> local filesystem. The boxes above are the production-shaped targets the code is
> structured to grow into (Prisma provider swap, pluggable storage, externalized
> screenshot job).
