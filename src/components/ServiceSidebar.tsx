"use client";

import { useMemo, useState } from "react";
import type { Service, Criticality, ServiceStatus } from "@/types";
import { STATUS_COLOR, CRITICALITY_COLOR } from "@/lib/colors";

interface ServiceSidebarProps {
  services: Service[];
  selectedForFailure: Set<string>;
  onToggleSelect: (serviceId: string) => void;
  onAddServiceClick: () => void;
  onAddDependencyClick: () => void;
}

const STATUS_OPTIONS: (ServiceStatus | "ALL")[] = ["ALL", "HEALTHY", "DEGRADED", "FAILED"];
const CRITICALITY_OPTIONS: (Criticality | "ALL")[] = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function ServiceSidebar({
  services,
  selectedForFailure,
  onToggleSelect,
  onAddServiceClick,
  onAddDependencyClick,
}: ServiceSidebarProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "ALL">("ALL");
  const [criticalityFilter, setCriticalityFilter] = useState<Criticality | "ALL">("ALL");

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (criticalityFilter !== "ALL" && s.criticality !== criticalityFilter) return false;
      return true;
    });
  }, [services, search, statusFilter, criticalityFilter]);

  return (
    <div className="w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-1.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ServiceStatus | "ALL")}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "ALL" ? "All statuses" : opt}
              </option>
            ))}
          </select>
          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value as Criticality | "ALL")}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            {CRITICALITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "ALL" ? "All criticality" : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-600 p-4 text-center">
            No services match your filters.
          </p>
        ) : (
          filtered.map((service) => {
            const isSelected = selectedForFailure.has(service.id);
            return (
              <button
                key={service.id}
                onClick={() => onToggleSelect(service.id)}
                className={`w-full text-left px-3 py-2 border-b border-zinc-900 hover:bg-zinc-900 transition-colors ${
                  isSelected ? "bg-red-950/40" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-200 truncate">{service.name}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: STATUS_COLOR[service.status] }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[10px] font-mono uppercase"
                    style={{ color: CRITICALITY_COLOR[service.criticality] }}
                  >
                    {service.criticality}
                  </span>
                  {service.owner && (
                    <span className="text-[10px] text-zinc-600 truncate">
                      {service.owner}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-zinc-800 space-y-2">
        <button
          onClick={onAddServiceClick}
          className="w-full text-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-md py-1.5 transition-colors"
        >
          + New service
        </button>
        <button
          onClick={onAddDependencyClick}
          className="w-full text-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-md py-1.5 transition-colors"
        >
          + New dependency
        </button>
      </div>
    </div>
  );
}
