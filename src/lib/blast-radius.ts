/**
 * Core blast-radius simulation engine.
 *
 * This module is intentionally framework-agnostic: it takes plain graph data
 * (services + dependency edges) and a set of "failed" service IDs, and
 * returns the computed impact for every reachable service. It does not touch
 * Prisma or Next.js directly, which makes it trivial to unit test in
 * isolation and easy to reason about in the demo video.
 *
 * ALGORITHM SUMMARY
 * ------------------
 * 1. Build a reverse adjacency map: for each service, who depends on it?
 *    (We only need to walk "downstream" from a failure — i.e. towards the
 *    services that rely on the failed one — not upstream.)
 * 2. Run a multi-source BFS starting from all directly-failed services.
 *    - Traversing a HARD edge marks the next service INDIRECT (broken).
 *    - Traversing a SOFT edge marks the next service DEGRADED, UNLESS it is
 *      already reachable via a HARD path, in which case HARD wins.
 * 3. Track depth (hop count) and the path taken to reach each service, so
 *    the UI can show "why is this impacted" without recomputing anything.
 * 4. Score severity per impacted service using depth, the service's own
 *    criticality, and its fan-in (how many things depend on IT) — see
 *    `calculateSeverity` for the exact formula and Architecture.md for the
 *    reasoning behind each term.
 *
 * CIRCULAR DEPENDENCIES
 * ----------------------
 * This module assumes the graph it receives is already acyclic, because
 * cycle creation is rejected at write-time (see `wouldCreateCycle` in
 * dependency-graph.ts). BFS naturally handles revisits safely regardless
 * (a visited-set guard prevents infinite loops even if a cycle slipped
 * through), but the scoring/path logic assumes a DAG for path uniqueness.
 */

export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DependencyType = "HARD" | "SOFT";
export type ImpactStatus = "DIRECT" | "INDIRECT" | "DEGRADED";

export interface GraphService {
  id: string;
  name: string;
  criticality: Criticality;
}

export interface GraphEdge {
  dependentId: string; // depends on dependsOnId
  dependsOnId: string;
  type: DependencyType;
}

export interface SimulationInput {
  services: GraphService[];
  edges: GraphEdge[];
  failedServiceIds: string[];
}

export interface ImpactedServiceResult {
  serviceId: string;
  impactStatus: ImpactStatus;
  depth: number;
  severityScore: number;
  path: string[]; // ordered service IDs from the failed root to this service
}

export interface SimulationOutput {
  impacted: ImpactedServiceResult[];
  unaffectedServiceIds: string[];
  // BFS "wave" order, used by the frontend to animate the cascade step by step.
  waves: string[][];
}

const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.75,
  CRITICAL: 1.0,
};

/**
 * Severity formula (0-100), composed of three independently-explainable terms:
 *
 *   depthScore   = max(0, 100 - depth * 25)
 *     -> services right next to the failure score near 100; impact fades
 *        by 25 points per hop and bottoms out at 0 after 4 hops.
 *
 *   criticalityMultiplier = 0.5 + 0.5 * criticalityWeight(service)
 *     -> ranges 0.625 (LOW) to 1.0 (CRITICAL). A LOW-criticality service
 *        never scores below 62.5% of its raw depth score; a CRITICAL one
 *        keeps the full depth score. This avoids a LOW service ever
 *        rounding all the way down to "doesn't matter."
 *
 *   fanInMultiplier = min(1.5, 1 + fanInCount * 0.05)
 *     -> services that many other services depend on ("hub" services) get
 *        amplified, capped at 1.5x so one mega-hub can't blow the scale.
 *
 * Final score = depthScore * criticalityMultiplier * fanInMultiplier,
 * clamped to [0, 100].
 */
export function calculateSeverity(params: {
  depth: number;
  criticality: Criticality;
  fanInCount: number;
}): number {
  const { depth, criticality, fanInCount } = params;
  const depthScore = Math.max(0, 100 - depth * 25);
  const criticalityMultiplier = 0.5 + 0.5 * CRITICALITY_WEIGHT[criticality];
  const fanInMultiplier = Math.min(1.5, 1 + fanInCount * 0.05);
  const raw = depthScore * criticalityMultiplier * fanInMultiplier;
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

/**
 * Runs the blast radius simulation. Pure function: no I/O, no DB.
 */
export function simulateFailure(input: SimulationInput): SimulationOutput {
  const { services, edges, failedServiceIds } = input;

  const serviceById = new Map(services.map((s) => [s.id, s]));

  // Reverse adjacency: serviceId -> list of {dependent, edgeType} that rely on it.
  const dependents = new Map<
    string,
    { dependentId: string; type: DependencyType }[]
  >();
  // Fan-in count: how many services directly depend on this one (any edge type).
  const fanIn = new Map<string, number>();

  for (const edge of edges) {
    if (!dependents.has(edge.dependsOnId)) dependents.set(edge.dependsOnId, []);
    dependents.get(edge.dependsOnId)!.push({
      dependentId: edge.dependentId,
      type: edge.type,
    });
    fanIn.set(edge.dependsOnId, (fanIn.get(edge.dependsOnId) ?? 0) + 1);
  }

  type QueueItem = {
    serviceId: string;
    depth: number;
    status: ImpactStatus;
    path: string[];
  };

  const visited = new Map<string, ImpactedServiceResult>();
  const waves: string[][] = [];
  let queue: QueueItem[] = failedServiceIds
    .filter((id) => serviceById.has(id))
    .map((id) => ({ serviceId: id, depth: 0, status: "DIRECT", path: [id] }));

  // Seed wave 0 with the directly-failed services immediately.
  for (const item of queue) {
    visited.set(item.serviceId, {
      serviceId: item.serviceId,
      impactStatus: "DIRECT",
      depth: 0,
      severityScore: 100, // directly failed = max severity by definition
      path: item.path,
    });
  }
  if (queue.length > 0) waves.push(queue.map((q) => q.serviceId));

  while (queue.length > 0) {
    const nextWave: QueueItem[] = [];
    const nextWaveIds: string[] = [];

    for (const current of queue) {
      const downstream = dependents.get(current.serviceId) ?? [];

      for (const edge of downstream) {
        const candidateStatus: ImpactStatus =
          edge.type === "HARD" || current.status === "DIRECT" || current.status === "INDIRECT"
            ? edge.type === "HARD"
              ? "INDIRECT"
              : "DEGRADED"
            : "DEGRADED";

        const existing = visited.get(edge.dependentId);

        // HARD/INDIRECT impact always takes priority over DEGRADED if a service
        // is reachable both ways; otherwise first-arrival (shallowest depth) wins.
        if (existing) {
          const existingIsWeaker =
            existing.impactStatus === "DEGRADED" && candidateStatus === "INDIRECT";
          if (!existingIsWeaker) continue;
        }

        const depth = current.depth + 1;
        const path = [...current.path, edge.dependentId];
        const criticality = serviceById.get(edge.dependentId)?.criticality ?? "MEDIUM";
        const severityScore = calculateSeverity({
          depth,
          criticality,
          fanInCount: fanIn.get(edge.dependentId) ?? 0,
        });

        const result: ImpactedServiceResult = {
          serviceId: edge.dependentId,
          impactStatus: candidateStatus,
          depth,
          severityScore,
          path,
        };

        visited.set(edge.dependentId, result);
        nextWave.push({
          serviceId: edge.dependentId,
          depth,
          status: candidateStatus,
          path,
        });
        nextWaveIds.push(edge.dependentId);
      }
    }

    if (nextWaveIds.length > 0) waves.push(nextWaveIds);
    queue = nextWave;
  }

  const impacted = Array.from(visited.values()).sort(
    (a, b) => b.severityScore - a.severityScore,
  );
  const impactedIds = new Set(impacted.map((r) => r.serviceId));
  const unaffectedServiceIds = services
    .map((s) => s.id)
    .filter((id) => !impactedIds.has(id));

  return { impacted, unaffectedServiceIds, waves };
}
