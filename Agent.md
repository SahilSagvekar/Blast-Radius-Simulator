# Agent.md — AI Usage & Development Approach

## Tooling

This project was built with Claude (Anthropic) as a pair-programming
assistant, working directly in a sandboxed development environment with
file read/write and shell access. I directed the architecture and reviewed
every file produced.

## Workflow

1. **Discussion before code.** Before any code was written, I asked
   clarifying questions about scope and discussed trade-offs (database
   choice, visualization library, real-time update strategy) until the
   architecture was settled. This is reflected in the order of work below.
2. **Backend first, frontend second.** The Prisma schema, the core
   blast-radius algorithm, cycle detection, and all API routes were
   written and reasoned through before any UI component, on the principle
   that the algorithm is the part of this assessment that actually needs
   to be correct and defensible — the UI's job is to make that correctness
   visible.
3. **Algorithm verification by hand-tracing**, not automated tests (see
   "What I would test" below). Before trusting the severity formula, I had
   the assistant run a standalone script (not part of the app) plugging in
   a small hand-constructed graph (`Database -> Auth -> API -> Frontend`,
   plus a soft `Frontend -> Analytics` edge) and checked that the resulting
   severity numbers behaved sensibly at each depth/criticality combination
   before relying on the formula inside the actual app.
4. **Iterative typecheck/lint passes.** After the API routes and frontend
   were both in place, `tsc --noEmit` and `eslint` were run across the
   codebase to catch real bugs (two implicit-`any` parameters, one
   React-hooks lint violation around async data fetching in `useEffect`)
   before moving on. Both were fixed and re-verified.

## Prompts and direction given to the assistant

Representative examples of the actual instructions given during this build
(paraphrased from the real session):

- "Use PostgreSQL + Prisma" (explicit instruction, matches my existing
  production stack — I wanted a database I could defend fluently).
- "Recommend the visualization library and real-time update approach" — I
  asked the assistant to make and justify this call rather than deciding it
  myself, since I wanted to see the trade-off reasoning spelled out before
  committing engineering time to either direction.
- "Keep things simple" — given as the one explicit constraint before
  building began, after I'd reviewed the proposed architecture. This shaped
  several downstream decisions: a single Next.js app instead of a separate
  backend service, no WebSocket layer, a simple column-based graph layout
  instead of a heavier layout library.
- Mid-build check-ins on interaction model (click-to-select vs. a separate
  picker panel — I chose "both") and UI polish level (clean/functional over
  maximal visual investment), both decided before the relevant components
  were built so they wouldn't need rework.

## What the AI was used for

- Scaffolding the Next.js project and installing dependencies.
- Writing the Prisma schema, all API routes, the blast-radius algorithm,
  cycle-detection logic, and all React components.
- Drafting this documentation set (Readme/Architecture/Agent), based on
  decisions made during the build, not invented after the fact.

## What I understand and can defend

Everything in `Architecture.md` reflects real design reasoning I reviewed
and agreed with during the build — in particular:

- **Why the dependency edges are directional and named the way they are**
  (`dependentId`/`dependsOnId`), and which direction failure actually
  propagates in the BFS (reverse of how the edge is stored).
- **The exact severity formula** and why each of its three terms
  (depth, criticality, fan-in) is structured the way it is, including why
  the fan-in multiplier is capped at 1.5×.
- **Why HARD vs. SOFT dependency types exist** and how that distinction
  changes the BFS classification logic (`INDIRECT` vs. `DEGRADED`, and why
  HARD always wins over SOFT when both paths exist to the same service).
- **Why cycle detection runs as a DFS from the proposed `dependsOnId`
  looking for the proposed `dependentId`**, rather than some other
  formulation, and why that's equivalent to "would this edge close a loop."
- **Why there's no WebSocket layer** despite the brief mentioning real-time
  updates, and specifically how I'd extend the system to add one if true
  multi-user live collaboration were required later.
- **Why Postgres was chosen over a graph database** for this problem's
  realistic scale, and where that decision would need to be revisited.

## What I would test, given more time

No automated test suite exists due to the 72-hour constraint. If extending
this:

- Unit tests for `simulateFailure` (pure function, no I/O) against a set of
  hand-constructed graphs: linear chains, diamond-shaped dependency graphs
  (two paths converging on one service), graphs mixing HARD and SOFT edges
  to the same target, and multi-service simultaneous failures.
- Unit tests for `wouldCreateCycle`/`findCyclePath` against graphs with and
  without existing cycles, including self-dependency and longer chains.
- Integration tests against the API routes using a test database, covering
  the validation paths (duplicate dependency, cycle rejection, unknown
  service IDs in a simulation request).
- I did not have the assistant generate a test suite I hadn't reviewed and
  wouldn't be able to defend the coverage decisions for — given the time
  available, manual verification of the algorithm's core logic (see
  workflow step 3 above) was the higher-value use of that time.
