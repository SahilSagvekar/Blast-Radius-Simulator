"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { Service, Dependency } from "@/types";

export function useGraphData() {
  const [services, setServices] = useState<Service[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGraph();
      setServices(data.services);
      setDependencies(data.dependencies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // refresh() sets loading/error/data state, but it's an async fetch
    // triggered on mount (not a synchronous setState in the effect body),
    // which is the standard "load data when this hook mounts" pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { services, dependencies, loading, error, refresh };
}
