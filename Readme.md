# Dependency Blast Radius Simulator

A tool for modeling service dependencies in a distributed system, visualizing
the dependency graph, and simulating failures to see exactly what breaks,
how badly, and why.

## Tech stack

- **Framework:** Next.js 16 (App Router), single application for both
  frontend and backend (API routes) — no separate backend service.
- **Language:** TypeScript throughout.
- **Database:** PostgreSQL via Prisma.
- **Graph visualization:** React Flow.
- **Styling:** Tailwind CSS.

See `Architecture.md` for the reasoning behind these choices and the design
of the blast-radius algorithm itself.

## Prerequisites

- Node.js 18.18+ (Next.js 16 requirement)
- A PostgreSQL database (local install, Docker, or a hosted instance like
  Supabase/Neon/Railway)

## Installation

```bash
npm install
```

This also pulls down the Prisma engine binaries from Prisma's CDN as part of
`postinstall` — an internet connection is required for this step (some
sandboxed environments without broad network access may need to run this on
a machine with normal internet access first).

## Environment configuration

Copy the example below into a `.env` file at the project root:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/blast_radius?schema=public"
```

Replace with your actual Postgres connection string. If you don't have
Postgres running locally, the fastest way to get one is:

```bash
docker run --name blast-radius-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blast_radius -p 5432:5432 -d postgres:16
```

which matches the default `.env` already checked into this repo.

## Database setup

Generate the Prisma client and run the initial migration:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

This creates all four tables (`Service`, `Dependency`, `Simulation`,
`SimulationResult`) plus their enums and indexes.

### Seeding sample data (optional but recommended)

A seed script populates a realistic 16-service e-commerce-style dependency
graph (database, cache, auth, catalog, cart, orders, payments,
notifications, analytics, and a couple of frontend/gateway services), with
a deliberate mix of HARD and SOFT dependencies and a multi-hop chain —
useful so a failure simulation has something interesting to show right
away, including in the demo video.

```bash
npx prisma db seed
```

(equivalent to `npm run seed`). Safe to re-run — it upserts by name, so
running it twice won't create duplicates. Alternatively, skip this and use
the UI's "+ New service" / "+ New dependency" buttons to build your own
graph from scratch.

## Running the application

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

- **`/`** — the main graph view: create services and dependencies, click
  nodes (or use the sidebar) to mark services as failed, and run a
  simulation.
- **`/simulations`** — history of past simulations.
- **`/simulations/[id]`** — replay a specific past simulation on the graph.

## Running tests

This project does not include an automated test suite (see `Agent.md` and
`Architecture.md` for the reasoning given the assessment's time constraints).
The core algorithm in `src/lib/blast-radius.ts` is a pure function with no
I/O, which makes it straightforward to unit test with any test runner
(Vitest/Jest) if extended — see "Future improvements" in `Architecture.md`.

## Building for production

```bash
npm run build
npm run start
```

## Assumptions made

- **Single-tenant, no auth.** The assessment brief doesn't mention multiple
  organizations or user accounts, so there's no login system. Every visitor
  sees the same shared graph and simulation history.
- **Dependency direction.** "Service A depends on Service B" means a failure
  in B can impact A — not the other way around. The UI's dependency form
  is explicit about which dropdown is which to avoid ambiguity.
- **Hard vs. soft dependencies.** The brief doesn't specify dependency
  "weight," so I introduced a HARD/SOFT distinction: a HARD dependency
  cascades failure (the dependent is marked broken), a SOFT dependency only
  degrades the dependent. This was a judgment call to make the simulation
  meaningfully more realistic than a flat reachability check — real systems
  have retries, fallbacks, and caching that mean not every dependency
  failure is fatal.
- **Real-time updates** are implemented as animated client-side state
  transitions after a single simulation API call, rather than a persistent
  WebSocket/SSE connection. See `Architecture.md` for the reasoning.
- **No automated tests** were written given the 72-hour window; testing
  effort instead went into manually verifying the algorithm's output against
  hand-traced graphs (see `Agent.md`).
# Blast-Radius-Simulator
# Blast-Radius-Simulator
