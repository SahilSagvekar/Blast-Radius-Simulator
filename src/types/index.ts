// Shared frontend types. These mirror the Prisma enums/shapes but are kept
// separate so components don't need to import @prisma/client directly.

export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ServiceStatus = "HEALTHY" | "DEGRADED" | "FAILED";
export type DependencyType = "HARD" | "SOFT";
export type ImpactStatus = "DIRECT" | "INDIRECT" | "DEGRADED";

export interface Service {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  criticality: Criticality;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { dependencies: number; dependents: number };
}

export interface Dependency {
  id: string;
  dependentId: string;
  dependsOnId: string;
  type: DependencyType;
  createdAt: string;
  dependent?: { id: string; name: string };
  dependsOn?: { id: string; name: string };
}

export interface SimulationResultRow {
  id: string;
  serviceId: string;
  impactStatus: ImpactStatus;
  depth: number;
  severityScore: number;
  path: string[];
  service: Service;
}

export interface SimulationTargetRow {
  id: string;
  serviceId: string;
  service: { id: string; name: string };
}

export interface Simulation {
  id: string;
  name: string | null;
  description: string | null;
  createdAt: string;
  targets: SimulationTargetRow[];
  results: SimulationResultRow[];
  _count?: { results: number };
}

export interface SimulationRunResponse {
  simulation: Simulation;
  waves: string[][];
  unaffectedServiceIds: string[];
}
