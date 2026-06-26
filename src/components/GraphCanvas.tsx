"use client";

import { useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { ServiceNode, type ServiceNodeData } from "./ServiceNode";
import type { Service, Dependency, ImpactStatus } from "@/types";
import { IMPACT_COLOR } from "@/lib/colors";

const nodeTypes = { service: ServiceNode };

interface SimulationOverlay {
  // serviceId -> impact info, when viewing a simulation's results
  resultByServiceId: Map<string, { impactStatus: ImpactStatus }>;
  failedServiceIds: Set<string>;
}

interface GraphCanvasProps {
  services: Service[];
  dependencies: Dependency[];
  selectedForFailure: Set<string>;
  onNodeClick: (serviceId: string) => void;
  simulationOverlay?: SimulationOverlay | null;
}

// Simple deterministic layered layout: places nodes in columns based on
// topological depth (services with no dependencies on the left, services
// that depend on many things further right). This avoids pulling in a
// heavier layout library (e.g. dagre) for what's ultimately a modest graph
// size in this assessment's scope, while still looking organized rather
// than randomly scattered.
function computeLayout(
  services: Service[],
  dependencies: Dependency[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const dependsOnMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!dependsOnMap.has(dep.dependentId)) dependsOnMap.set(dep.dependentId, []);
    dependsOnMap.get(dep.dependentId)!.push(dep.dependsOnId);
  }

  // Depth = longest chain of dependencies below this service (memoized DFS).
  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();

  function depthOf(serviceId: string): number {
    if (depthCache.has(serviceId)) return depthCache.get(serviceId)!;
    if (visiting.has(serviceId)) return 0; // guard against unexpected cycles
    visiting.add(serviceId);

    const deps = dependsOnMap.get(serviceId) ?? [];
    const depth = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(depthOf));

    visiting.delete(serviceId);
    depthCache.set(serviceId, depth);
    return depth;
  }

  const byDepth = new Map<number, string[]>();
  for (const service of services) {
    const d = depthOf(service.id);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(service.id);
  }

  const COL_WIDTH = 260;
  const ROW_HEIGHT = 110;

  for (const [depth, ids] of byDepth.entries()) {
    ids.forEach((id, i) => {
      positions.set(id, { x: depth * COL_WIDTH, y: i * ROW_HEIGHT });
    });
  }

  return positions;
}

export function GraphCanvas({
  services,
  dependencies,
  selectedForFailure,
  onNodeClick,
  simulationOverlay,
}: GraphCanvasProps) {
  const positions = useMemo(
    () => computeLayout(services, dependencies),
    [services, dependencies],
  );

  const nodes: Node<ServiceNodeData>[] = useMemo(() => {
    return services.map((service) => {
      const pos = positions.get(service.id) ?? { x: 0, y: 0 };
      const result = simulationOverlay?.resultByServiceId.get(service.id);
      const isFailedTarget = simulationOverlay?.failedServiceIds.has(service.id);

      let simulationBadge: ServiceNodeData["simulationBadge"] = null;
      if (isFailedTarget) {
        simulationBadge = { label: "FAILED (input)", color: "#ef4444" };
      } else if (result) {
        simulationBadge = {
          label: result.impactStatus,
          color: IMPACT_COLOR[result.impactStatus],
        };
      }

      const dimmed = Boolean(
        simulationOverlay && !isFailedTarget && !result,
      );

      return {
        id: service.id,
        type: "service",
        position: pos,
        data: {
          name: service.name,
          status: service.status,
          criticality: service.criticality,
          owner: service.owner,
          selectedForFailure: selectedForFailure.has(service.id),
          simulationBadge,
          dimmed,
        },
      };
    });
  }, [services, positions, selectedForFailure, simulationOverlay]);

  const edges: Edge[] = useMemo(() => {
    return dependencies.map((dep) => {
      const isSoft = dep.type === "SOFT";
      const involvedInImpact =
        simulationOverlay &&
        (simulationOverlay.resultByServiceId.has(dep.dependentId) ||
          simulationOverlay.failedServiceIds.has(dep.dependentId)) &&
        (simulationOverlay.resultByServiceId.has(dep.dependsOnId) ||
          simulationOverlay.failedServiceIds.has(dep.dependsOnId));

      return {
        id: dep.id,
        source: dep.dependsOnId, // failure flows from "dependsOn" -> "dependent"
        target: dep.dependentId,
        animated: Boolean(involvedInImpact),
        style: {
          stroke: involvedInImpact ? "#ef4444" : isSoft ? "#52525b" : "#71717a",
          strokeWidth: involvedInImpact ? 2.5 : 1.5,
          strokeDasharray: isSoft ? "4 3" : undefined,
          opacity: simulationOverlay && !involvedInImpact ? 0.25 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: involvedInImpact ? "#ef4444" : isSoft ? "#52525b" : "#71717a",
        },
      };
    });
  }, [dependencies, simulationOverlay]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#27272a" gap={24} />
        <Controls className="!bg-zinc-900 !border-zinc-700" />
        <MiniMap
          className="!bg-zinc-900"
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={(n) => {
            const data = n.data as ServiceNodeData;
            return data.simulationBadge?.color ?? "#52525b";
          }}
        />
      </ReactFlow>
    </div>
  );
}
