"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "@/lib/api-client";
import type { Service, DependencyType } from "@/types";

interface AddDependencyModalProps {
  services: Service[];
  onClose: () => void;
  onCreated: () => void;
}

export function AddDependencyModal({
  services,
  onClose,
  onCreated,
}: AddDependencyModalProps) {
  const [dependentId, setDependentId] = useState("");
  const [dependsOnId, setDependsOnId] = useState("");
  const [type, setType] = useState<DependencyType>("HARD");
  const [error, setError] = useState<string | null>(null);
  const [cyclePath, setCyclePath] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dependentId || !dependsOnId) {
      setError("Select both services.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setCyclePath(null);
    try {
      await api.createDependency({ dependentId, dependsOnId, type });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const payload = err.payload as { cyclePath?: string[] } | null;
        if (payload?.cyclePath) setCyclePath(payload.cyclePath);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New dependency" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">
            Service (the one that depends on something)
          </label>
          <select
            value={dependentId}
            onChange={(e) => setDependentId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none"
          >
            <option value="">Select service...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-center text-xs text-zinc-500">depends on ↓</div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">
            Depends on (the service being relied upon)
          </label>
          <select
            value={dependsOnId}
            onChange={(e) => setDependsOnId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none"
          >
            <option value="">Select service...</option>
            {services
              .filter((s) => s.id !== dependentId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">Dependency type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("HARD")}
              className={`flex-1 text-sm py-1.5 rounded-md border ${
                type === "HARD"
                  ? "bg-red-950/40 border-red-800 text-red-300"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400"
              }`}
            >
              Hard
            </button>
            <button
              type="button"
              onClick={() => setType("SOFT")}
              className={`flex-1 text-sm py-1.5 rounded-md border ${
                type === "SOFT"
                  ? "bg-amber-950/40 border-amber-800 text-amber-300"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400"
              }`}
            >
              Soft
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1">
            Hard dependencies cascade failures (the dependent breaks). Soft
            dependencies only degrade the dependent.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 space-y-1">
            <p>{error}</p>
            {cyclePath && (
              <p className="font-mono text-[11px] text-red-300/80">
                {cyclePath.join(" → ")}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-900 font-medium hover:bg-white disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create dependency"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
