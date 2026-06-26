"use client";

import { useState, useMemo, useCallback } from "react";
import { useGraphData } from "@/lib/useGraphData";
import { GraphCanvas } from "@/components/GraphCanvas";
import { ServiceSidebar } from "@/components/ServiceSidebar";
import { HealthStrip } from "@/components/HealthStrip";
import { SimulationBar } from "@/components/SimulationBar";
import { SimulationPanel } from "@/components/SimulationPanel";
import { AddServiceModal } from "@/components/AddServiceModal";
import { AddDependencyModal } from "@/components/AddDependencyModal";
import { api, ApiError } from "@/lib/api-client";
import type { SimulationRunResponse, ImpactStatus } from "@/types";

export default function GraphPage() {
  const { services, dependencies, loading, error, refresh } = useGraphData();

  const [selectedForFailure, setSelectedForFailure] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationRunResponse | null>(
    null,
  );
  const [selectedPathServiceId, setSelectedPathServiceId] = useState<string | null>(null);

  const [showAddService, setShowAddService] = useState(false);
  const [showAddDependency, setShowAddDependency] = useState(false);

  const toggleSelect = useCallback((serviceId: string) => {
    setSimulationResult(null);
    setSelectedPathServiceId(null);
    setSelectedForFailure((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }, []);

  const handleRun = useCallback(
    async (name?: string) => {
      setRunning(true);
      setRunError(null);
      try {
        const result = await api.runSimulation({
          failedServiceIds: Array.from(selectedForFailure),
          name,
        });
        setSimulationResult(result);
      } catch (err) {
        setRunError(err instanceof ApiError ? err.message : "Simulation failed to run.");
      } finally {
        setRunning(false);
      }
    },
    [selectedForFailure],
  );

  const simulationOverlay = useMemo(() => {
    if (!simulationResult) return null;
    const resultByServiceId = new Map<string, { impactStatus: ImpactStatus }>();
    for (const r of simulationResult.simulation.results) {
      if (r.impactStatus !== "DIRECT") {
        resultByServiceId.set(r.serviceId, { impactStatus: r.impactStatus });
      }
    }
    return {
      resultByServiceId,
      failedServiceIds: new Set(selectedForFailure),
    };
  }, [simulationResult, selectedForFailure]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Loading graph...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <HealthStrip services={services} />
      <SimulationBar
        selectedCount={selectedForFailure.size}
        onRun={handleRun}
        onClearSelection={() => {
          setSelectedForFailure(new Set());
          setSimulationResult(null);
        }}
        running={running}
      />
      {runError && (
        <div className="px-4 py-2 bg-red-950/30 border-b border-red-900 text-xs text-red-300">
          {runError}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <ServiceSidebar
          services={services}
          selectedForFailure={selectedForFailure}
          onToggleSelect={toggleSelect}
          onAddServiceClick={() => setShowAddService(true)}
          onAddDependencyClick={() => setShowAddDependency(true)}
        />

        <div className="flex-1 relative">
          {services.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-500">
              No services yet. Add one to get started.
            </div>
          ) : (
            <GraphCanvas
              services={services}
              dependencies={dependencies}
              selectedForFailure={selectedForFailure}
              onNodeClick={toggleSelect}
              simulationOverlay={simulationOverlay}
            />
          )}
        </div>

        {simulationResult && (
          <SimulationPanel
            result={simulationResult}
            services={services}
            onSelectPath={setSelectedPathServiceId}
            selectedPathServiceId={selectedPathServiceId}
            onClear={() => {
              setSimulationResult(null);
              setSelectedPathServiceId(null);
            }}
          />
        )}
      </div>

      {showAddService && (
        <AddServiceModal
          onClose={() => setShowAddService(false)}
          onCreated={refresh}
        />
      )}
      {showAddDependency && (
        <AddDependencyModal
          services={services}
          onClose={() => setShowAddDependency(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
