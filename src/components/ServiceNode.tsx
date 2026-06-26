"use client";

import { Handle, Position } from "reactflow";
import { STATUS_COLOR, CRITICALITY_COLOR } from "@/lib/colors";
import type { Criticality, ServiceStatus } from "@/types";

export interface ServiceNodeData {
  name: string;
  status: ServiceStatus;
  criticality: Criticality;
  owner: string | null;
  selectedForFailure: boolean;
  // When a simulation result is being displayed on the graph:
  simulationBadge?: { label: string; color: string } | null;
  dimmed?: boolean;
}

export function ServiceNode({ data }: { data: ServiceNodeData }) {
  const statusColor = STATUS_COLOR[data.status];
  const criticalityColor = CRITICALITY_COLOR[data.criticality];

  return (
    <div
      className="rounded-lg border-2 px-4 py-3 min-w-[160px] transition-all duration-300"
      style={{
        background: "#15171c",
        borderColor: data.selectedForFailure
          ? "#ef4444"
          : data.simulationBadge?.color ?? "#2a2d36",
        boxShadow: data.selectedForFailure
          ? "0 0 0 3px rgba(239,68,68,0.35)"
          : data.simulationBadge
            ? `0 0 0 3px ${data.simulationBadge.color}33`
            : "none",
        opacity: data.dimmed ? 0.35 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#555" }} />

      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[13px] font-semibold text-zinc-100 truncate">
          {data.name}
        </span>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor }}
          title={data.status}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
          style={{
            color: criticalityColor,
            background: `${criticalityColor}1a`,
            border: `1px solid ${criticalityColor}44`,
          }}
        >
          {data.criticality}
        </span>
        {data.owner && (
          <span className="text-[10px] text-zinc-500 truncate">{data.owner}</span>
        )}
      </div>

      {data.simulationBadge && (
        <div
          className="mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded inline-block"
          style={{
            color: data.simulationBadge.color,
            background: `${data.simulationBadge.color}1a`,
          }}
        >
          {data.simulationBadge.label}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: "#555" }} />
    </div>
  );
}
