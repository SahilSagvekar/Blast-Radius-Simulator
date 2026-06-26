"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "@/lib/api-client";
import type { Criticality } from "@/types";

interface AddServiceModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function AddServiceModal({ onClose, onCreated }: AddServiceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [criticality, setCriticality] = useState<Criticality>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Service name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createService({ name, description, owner, criticality });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New service" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. payments-api"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this service do?"
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Owner</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Team or person"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Criticality</label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value as Criticality)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200 focus:outline-none"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

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
            {submitting ? "Creating..." : "Create service"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
