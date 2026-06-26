# Architecture

## Overview

The Dependency Blast Radius Simulator is a single Next.js application
(frontend + backend in one codebase) backed by PostgreSQL via Prisma. There
is no separate microservice or message queue — for the scope of this
assessment (a single-team internal tool, not a multi-tenant SaaS), a
monolith is the right level of complexity. Splitting this into a separate
Express API and a Next.js frontend would have added deployment surface area
(two services to run, CORS configuration, two sets of environment
variables) without adding any capability the assessment asks for.

```
┌─────────────────────────────────────────────────┐
│                  Next.js App                     │
│                                                   │
│  ┌─────────────┐        ┌──────────────────────┐ │
│  │   Frontend   │  HTTP  │     API Routes        │ │
│  │  (React,     │ ─────► │  /api/services         │ │
│  │  React Flow) │        │  /api/dependencies      │ │
│  │              │ ◄───── │  /api/simulations        │ │
│  └─────────────┘  JSON  │  /api/graph                │ │
│                          └──────────────────────┘ │
│                                    │                │
│                                    ▼                │
│                          ┌──────────────────┐      │
│                          │   Prisma Client    │      │
│                          └──────────────────┘      │
└───────────────────────────────────┬─────────────────┘
                                     ▼
                          ┌───────────────────┐
                          │   PostgreSQL        │
                          └───────────────────┘
```

## Data model

Four tables: `Service`, `Dependency`, `Simulation`, `SimulationResult` (plus
a `SimulationTarget` join table). See `prisma/schema.prisma` for the full
schema with enums and indexes.

**Why PostgreSQL over a native graph database (e.g. Neo4j):** the dependency
graphs this tool models are realistically in the hundreds-to-low-thousands
of nodes/edges range for a single engineering org — well within what
adjacency-list queries in Postgres handle efficiently, especially with the
indexes on `dependentId`/`dependsOnId`. A graph database's main advantage is
fast arbitrary-depth traversal at very large scale (millions of nodes,
recursive Cypher queries). At this scale, that advantage doesn't outweigh
the cost of introducing a second database technology, a second set of
operational knowledge, and a second set of client libraries — particularly
when the actual traversal (the blast-radius BFS) happens in application
memory anyway, not as a database query. Postgres + Prisma was also the
pragmatic choice given it's a stack already used in production elsewhere,
which reduces the risk of unfamiliar-tool bugs under a tight deadline.

**Why a directional `Dependency` model with explicit `dependentId` /
`dependsOnId` fields**, rather than a generic `sourceId`/`targetId`: graph
edge direction is a classic source of confusion ("does the arrow point from
the failing thing or to it?"). Naming the fields after their semantic role
removes that ambiguity from every piece of code that touches the schema,
including six months from now when someone (possibly me) reads it cold.

**Why `HARD` vs `SOFT` dependency types:** the brief's blast-radius
description implies "if X fails, everything that depends on X is impacted."
A flat reachability model would mark every transitive dependent as equally
broken, which isn't how real systems behave — many services have caching,
retries, circuit breakers, or fallback behavior that mean a downstream
failure causes degradation, not a hard outage. Modeling this distinction
(see `src/lib/blast-radius.ts`) makes the simulation meaningfully more
useful and was a deliberate, defensible trade-off: it adds one enum and a
handful of lines of branching logic, in exchange for a result that's much
closer to how an SRE actually reasons about cascading failure.

**Why `SimulationResult` stores depth, severity, and the full path per
service** rather than just a list of impacted IDs: the brief explicitly asks
for "Dependency Path Exploration" (why is this service impacted?) and
"Historical Simulations" (revisit past results). Storing the computed path
and score at simulation time means revisiting history is a pure read — no
re-running the algorithm against what might be a since-changed graph. This
also makes history immutable and trustworthy: a simulation result reflects
exactly the graph topology at the time it ran, even if dependencies are
added or removed afterward.

## The blast-radius algorithm

Implemented in `src/lib/blast-radius.ts` as a pure function (no I/O), which
makes it trivial to reason about, unit test, and explain independent of the
database or HTTP layer.

**Step 1 — build reverse adjacency.** We only need to know, for any given
service, "who depends on me" — because failure propagates from a service to
the things that rely on it, not to the things it relies on. This is the
opposite direction from how the dependency is stored (`dependent depends on
dependsOn`), so we build a reverse map once per simulation run.

**Step 2 — multi-source BFS.** Starting from all directly-failed services
simultaneously (so a multi-service failure simulation works in one pass,
not N separate passes), we walk the reverse-adjacency graph outward in
waves. Each wave corresponds to one more hop of distance from the original
failure(s) — this wave structure is also what would drive a "watch the
cascade play out step by step" animation in the UI (see `waves` in
`SimulationOutput`).

**Step 3 — impact classification.** Traversing a HARD edge marks the
downstream service `INDIRECT` (treated as broken). Traversing a SOFT edge
marks it `DEGRADED`. If a service is reachable via both a HARD path and a
SOFT path (common in real graphs — e.g. one path through a critical
database, another through an optional cache), HARD always wins, since
that's the more severe outcome and ignoring it would understate risk.

**Step 4 — severity scoring**, the most interpretable part of the system by
design: every impacted service gets a 0–100 score built from three
independently-explainable multiplicative terms (see the full derivation
in code comments in `blast-radius.ts`):

- **Depth score** — `max(0, 100 - depth * 25)`. Closer to the failure means
  more severe; fades out by depth 4.
- **Criticality multiplier** — `0.5 + 0.5 * criticalityWeight`, ranging
  0.625× (LOW) to 1.0× (CRITICAL). A low-criticality service never drops to
  zero just for being low-criticality — it still matters that it broke —
  but a CRITICAL service keeps its full depth-based severity.
- **Fan-in multiplier** — `min(1.5, 1 + fanInCount * 0.05)`. Services many
  other services depend on ("hub" services) get amplified up to 1.5×, since
  their failure compounds — but the multiplier is capped so one mega-hub
  doesn't blow out the 0–100 scale.

This was chosen over a black-box or ML-style score because the assessment
explicitly values being able to explain design decisions — a formula with
three named, independently-tunable terms is something I can walk through
line by line in the demo and defend the reasoning behind each coefficient,
whereas a more "clever" composite score would be harder to justify under
questioning and harder to tune later.

## Circular dependency detection

Implemented in `src/lib/dependency-graph.ts`, run synchronously at
dependency-creation time (`POST /api/dependencies`), before the edge is
persisted. The check asks: "starting from the proposed dependsOn service,
can we already reach the proposed dependent service by walking existing
edges forward?" If yes, adding the new edge would close a loop, so the
request is rejected with `409 Conflict` and the actual cycle path
(resolved to readable service names) is returned in the response so the
user can see exactly which existing chain conflicts.

This is a straightforward DFS, O(V+E) per check, run only on the (rare,
human-paced) write path — performance was never a concern here, clarity
was. A more sophisticated approach (maintaining a topological order
incrementally) wasn't worth the added complexity for a check that happens
once per dependency creation, not in any hot path.

## Real-time updates: client-side simulation, not WebSockets

The brief asks for state to "update dynamically during simulations without
requiring page refreshes." This is satisfied here by computing the entire
simulation result in one backend request, then animating the result
client-side (the `waves` array exists specifically to support a wave-by-wave
reveal animation on the graph).

I deliberately did not add a WebSocket/SSE layer. The stated requirement is
satisfied without it — no page refresh is needed, and updates appear live to
the person running the simulation. True server-push would only add value if
multiple users needed to watch the same simulation unfold together in real
time, which the brief doesn't ask for. Adding Socket.io or SSE here would
mean connection lifecycle management, reconnection handling, and
server-side broadcast logic — real engineering complexity that has to be
maintained and explained, in exchange for capability nobody asked for. I'd
rather spend that complexity budget on the parts of the system that are
actually being evaluated: the algorithm, the data model, and the UI's
ability to make the results legible.

**How this would extend to true multi-user live collaboration:** the
`Simulation`/`SimulationResult` write already happens server-side in one
transaction; the natural extension is to broadcast that transaction's
result over a WebSocket channel keyed by simulation ID (or a shared "room")
immediately after the `$transaction` commits in `POST /api/simulations`, so
every connected client renders the same wave-by-wave animation in sync
instead of only the requester.

## Scalability considerations

- **Indexes** on `Dependency.dependentId`, `Dependency.dependsOnId`, and
  `SimulationResult.simulationId` keep the common queries (build adjacency,
  fetch a simulation's results) index-backed rather than full-table scans.
- **The BFS algorithm is O(V + E)** per simulation run — linear in graph
  size, which comfortably handles graphs far larger than a single
  engineering org would realistically produce (thousands of services).
- **The combined `/api/graph` endpoint** fetches services and dependencies
  in parallel (`Promise.all`) in one round trip, avoiding a request
  waterfall on initial page load — the same pattern used for E8's dashboard
  endpoints in production.
- If this needed to scale to a very large multi-org dataset, the next
  bottleneck would be the in-memory BFS becoming a poor fit — at that point
  pushing the traversal into a recursive CTE in Postgres, or migrating to a
  graph database, would become the right trade-off. That point is well
  beyond this tool's realistic scope.

## Failure handling strategies

- **Dependency writes are validated before persistence**: cycle detection
  and duplicate-edge checks both run before any database write, so the
  graph can never enter an invalid state through the API.
- **Simulation runs validate all input service IDs exist** before running
  the algorithm, returning a `400` with the specific invalid IDs rather than
  failing silently or throwing an unhandled exception.
- **Simulation persistence is transactional** (`prisma.$transaction`): the
  `Simulation`, its `SimulationTarget` rows, and all `SimulationResult` rows
  are written atomically, so a partial/inconsistent simulation record can
  never exist if a write fails partway through.
- **Cascading deletes** (`onDelete: Cascade` on dependency/result/target
  foreign keys) mean deleting a service cleans up everything that referenced
  it, rather than leaving orphaned rows.
- **API errors return structured JSON** (`{ error, ...details }`) with
  appropriate HTTP status codes (400 for invalid input, 404 for missing
  resources, 409 for conflicts like cycles/duplicates), which the frontend
  surfaces directly to the user rather than a generic failure message.

## Known limitations / future improvements

- No automated test suite — see `Agent.md` for how correctness was verified
  manually instead, given the time constraint. The algorithm's pure-function
  design (`simulateFailure` takes plain data, returns plain data, no I/O)
  means it would be straightforward to add Vitest unit tests against
  hand-constructed graphs as a follow-up.
- No authentication/authorization — every user shares one graph. Adding
  multi-tenancy would mean adding an `Organization` model and scoping every
  query by it; the schema's flat structure makes this a additive change,
  not a rewrite.
- The graph layout algorithm (`computeLayout` in `GraphCanvas.tsx`) is a
  simple deterministic column layout based on dependency depth, not a full
  force-directed or dagre-based layout. This was a conscious simplification
  given time constraints — it produces a readable, non-overlapping layout
  for the graph sizes this tool targets, but would benefit from a proper
  layout library (e.g. `dagre` or `elkjs`) for very large or densely
  connected graphs.
