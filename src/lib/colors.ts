// Centralized color + label mapping for status, criticality, and impact.
// Kept in one place so the legend, graph nodes, and panels never drift
// out of sync with each other.

import type { Criticality, ServiceStatus, ImpactStatus, DependencyType } from "@/types";

export const STATUS_COLOR: Record<ServiceStatus, string> = {
  HEALTHY: "#3ddc84",
  DEGRADED: "#f5a623",
  FAILED: "#ef4444",
};

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  HEALTHY: "Healthy",
  DEGRADED: "Degraded",
  FAILED: "Failed",
};

export const IMPACT_COLOR: Record<ImpactStatus, string> = {
  DIRECT: "#ef4444",
  INDIRECT: "#f5a623",
  DEGRADED: "#eab308",
};

export const IMPACT_LABEL: Record<ImpactStatus, string> = {
  DIRECT: "Directly failed",
  INDIRECT: "Indirectly broken",
  DEGRADED: "Degraded",
};

export const CRITICALITY_COLOR: Record<Criticality, string> = {
  LOW: "#5b9bd5",
  MEDIUM: "#9b8cf0",
  HIGH: "#f5a623",
  CRITICAL: "#ef4444",
};

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const DEPENDENCY_TYPE_LABEL: Record<DependencyType, string> = {
  HARD: "Hard",
  SOFT: "Soft",
};

export function severityToColor(score: number): string {
  if (score >= 80) return "#ef4444"; // red
  if (score >= 50) return "#f5a623"; // amber
  if (score >= 20) return "#eab308"; // yellow
  return "#5b9bd5"; // blue (low severity)
}

export function severityToLabel(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 50) return "High";
  if (score >= 20) return "Moderate";
  return "Low";
}
