"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useGraphData } from "@/lib/useGraphData";
import { GraphCanvas } from "@/components/GraphCanvas";
import { SimulationPanel } from "@/components/SimulationPanel";
import type { Simulation, SimulationRunResponse, ImpactStatus } from "@/types";

export default function SimulationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { services, dependencies, loading: graphLoading } = useGraphData();

  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPathServiceId, setSelectedPathServiceId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSimulation(params.id)
      .then(setSimulation)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Simulation not found."),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  // Reshape into the same SimulationRunResponse shape the live panel expects,
  // so we can reuse SimulationPanel/GraphCanvas without duplicating UI.
  const runResponse: SimulationRunResponse | null = useMemo(() => {
    if (!simulation) return null;
    const impactedIds = new Set(simulation.results.map((r) => r.serviceId));
    const unaffectedServiceIds = services
      .map((s) => s.id)
      .filter((id) => !impactedIds.has(id));
    return { simulation, waves: [], unaffectedServiceIds };
  }, [simulation, services]);

  const failedServiceIds = useMemo(
    () => new Set(simulation?.targets.map((t) => t.serviceId) ?? []),
    [simulation],
  );

  const simulationOverlay = useMemo(() => {
    if (!simulation) return null;
    const resultByServiceId = new Map<string, { impactStatus: ImpactStatus }>();
    for (const r of simulation.results) {
      if (r.impactStatus !== "DIRECT") {
        resultByServiceId.set(r.serviceId, { impactStatus: r.impactStatus });
      }
    }
    return { resultByServiceId, failedServiceIds };
  }, [simulation, failedServiceIds]);

  if (loading || graphLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Loading simulation...
      </div>
    );
  }

  if (error || !simulation || !runResponse) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red-400">
        {error ?? "Simulation not found."}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-200">
            {simulation.name || "Untitled simulation"}
          </p>
          <p className="text-xs text-zinc-500">
            Failed: {simulation.targets.map((t) => t.service.name).join(", ")}
          </p>
        </div>
        <button
          onClick={() => router.push("/simulations")}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Back to history
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <GraphCanvas
            services={services}
            dependencies={dependencies}
            selectedForFailure={new Set()}
            onNodeClick={(id) => setSelectedPathServiceId(id)}
            simulationOverlay={simulationOverlay}
          />
        </div>

        <SimulationPanel
          result={runResponse}
          services={services}
          onSelectPath={setSelectedPathServiceId}
          selectedPathServiceId={selectedPathServiceId}
          onClear={() => router.push("/simulations")}
        />
      </div>
    </div>
  );
}
