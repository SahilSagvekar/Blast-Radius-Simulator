"use client";

import type { SimulationRunResponse, Service } from "@/types";
import { IMPACT_COLOR, IMPACT_LABEL, severityToColor, severityToLabel } from "@/lib/colors";

interface SimulationPanelProps {
  result: SimulationRunResponse;
  services: Service[];
  onSelectPath: (serviceId: string | null) => void;
  selectedPathServiceId: string | null;
  onClear: () => void;
  onSaveName?: (name: string) => void;
}

export function SimulationPanel({
  result,
  services,
  onSelectPath,
  selectedPathServiceId,
  onClear,
}: SimulationPanelProps) {
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const { results } = result.simulation;
  const totalImpacted = results.length;
  const directCount = results.filter((r) => r.impactStatus === "DIRECT").length;
  const indirectCount = results.filter((r) => r.impactStatus === "INDIRECT").length;
  const degradedCount = results.filter((r) => r.impactStatus === "DEGRADED").length;

  const selectedResult = selectedPathServiceId
    ? results.find((r) => r.serviceId === selectedPathServiceId)
    : null;

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Simulation result</h3>
        <button
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Clear
        </button>
      </div>

      <div className="p-3 border-b border-zinc-800 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-400">{directCount}</p>
          <p className="text-[10px] text-zinc-500">Direct</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-amber-400">{indirectCount}</p>
          <p className="text-[10px] text-zinc-500">Indirect</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-yellow-500">{degradedCount}</p>
          <p className="text-[10px] text-zinc-500">Degraded</p>
        </div>
      </div>

      <p className="px-3 py-2 text-[11px] text-zinc-500 border-b border-zinc-800">
        {totalImpacted} of {services.length} services impacted ·{" "}
        {result.unaffectedServiceIds.length} unaffected
      </p>

      {selectedResult && (
        <div className="px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/60">
          <p className="text-[11px] text-zinc-500 mb-1">Dependency path</p>
          <p className="text-xs font-mono text-zinc-300 leading-relaxed">
            {selectedResult.path
              .map((id) => serviceById.get(id)?.name ?? id)
              .join(" → ")}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {results.map((r) => {
          const service = serviceById.get(r.serviceId);
          if (!service) return null;
          const isSelected = selectedPathServiceId === r.serviceId;
          return (
            <button
              key={r.serviceId}
              onClick={() => onSelectPath(isSelected ? null : r.serviceId)}
              className={`w-full text-left px-3 py-2 border-b border-zinc-900 hover:bg-zinc-900 transition-colors ${
                isSelected ? "bg-zinc-900" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-200 truncate">{service.name}</span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: IMPACT_COLOR[r.impactStatus],
                    background: `${IMPACT_COLOR[r.impactStatus]}1a`,
                  }}
                >
                  {IMPACT_LABEL[r.impactStatus]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.severityScore}%`,
                      background: severityToColor(r.severityScore),
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-mono shrink-0"
                  style={{ color: severityToColor(r.severityScore) }}
                >
                  {severityToLabel(r.severityScore)} · {r.depth} hop
                  {r.depth === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
