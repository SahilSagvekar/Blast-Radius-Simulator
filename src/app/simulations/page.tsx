"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import type { Simulation } from "@/types";
import { format } from "date-fns";

export default function SimulationHistoryPage() {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSimulations()
      .then(setSimulations)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load history."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this simulation? This cannot be undone.")) return;
    await api.deleteSimulation(id);
    setSimulations((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Loading history...
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
    <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold text-zinc-100 mb-1">Simulation history</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Past failure simulations, newest first. Click any row to revisit its
        results.
      </p>

      {simulations.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No simulations yet. Run one from the graph view.
        </p>
      ) : (
        <div className="space-y-2">
          {simulations.map((sim) => {
            const targetNames = sim.targets.map((t) => t.service.name).join(", ");
            return (
              <div
                key={sim.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors"
              >
                <Link href={`/simulations/${sim.id}`} className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">
                    {sim.name || `Failure: ${targetNames}`}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {format(new Date(sim.createdAt), "MMM d, yyyy 'at' h:mm a")} ·{" "}
                    {sim._count?.results ?? 0} services impacted
                  </p>
                </Link>
                <button
                  onClick={() => handleDelete(sim.id)}
                  className="text-xs text-zinc-600 hover:text-red-400 shrink-0"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
