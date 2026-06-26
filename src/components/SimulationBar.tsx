"use client";

import { useState } from "react";

interface SimulationBarProps {
  selectedCount: number;
  onRun: (name?: string) => void;
  onClearSelection: () => void;
  running: boolean;
}

export function SimulationBar({
  selectedCount,
  onRun,
  onClearSelection,
  running,
}: SimulationBarProps) {
  const [name, setName] = useState("");

  if (selectedCount === 0) {
    return (
      <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 text-xs text-zinc-500">
        Click services on the graph or in the sidebar to mark them as failed,
        then run a simulation.
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 border-b border-zinc-800 bg-red-950/20 flex items-center gap-3">
      <span className="text-xs text-red-300">
        {selectedCount} service{selectedCount === 1 ? "" : "s"} marked for failure
      </span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Simulation name (optional)"
        className="text-xs bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none flex-1 max-w-xs"
      />
      <button
        onClick={onClearSelection}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Clear
      </button>
      <button
        onClick={() => onRun(name || undefined)}
        disabled={running}
        className="text-xs px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50"
      >
        {running ? "Running..." : "Run simulation"}
      </button>
    </div>
  );
}
