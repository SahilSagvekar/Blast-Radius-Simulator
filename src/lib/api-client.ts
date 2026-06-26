// Minimal fetch wrapper. Kept deliberately simple (no React Query, no SWR)
// since this app's data needs are modest — a handful of endpoints, no
// complex caching/invalidation requirements. Components call these and
// manage their own loading/error state with useState.

import type { Service, Dependency, Simulation, SimulationRunResponse } from "@/types";

class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // ignore parse failure
    }
    const message =
      (payload as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return res.json();
}

export const api = {
  // Services
  listServices: (params?: { search?: string; status?: string; criticality?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.criticality) qs.set("criticality", params.criticality);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Service[]>(`/api/services${suffix}`);
  },
  createService: (data: Partial<Service>) =>
    request<Service>("/api/services", { method: "POST", body: JSON.stringify(data) }),
  updateService: (id: string, data: Partial<Service>) =>
    request<Service>(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteService: (id: string) =>
    request<{ success: true }>(`/api/services/${id}`, { method: "DELETE" }),

  // Dependencies
  listDependencies: () => request<Dependency[]>("/api/dependencies"),
  createDependency: (data: { dependentId: string; dependsOnId: string; type?: string }) =>
    request<Dependency>("/api/dependencies", { method: "POST", body: JSON.stringify(data) }),
  deleteDependency: (id: string) =>
    request<{ success: true }>(`/api/dependencies/${id}`, { method: "DELETE" }),

  // Combined graph fetch
  getGraph: () => request<{ services: Service[]; dependencies: Dependency[] }>("/api/graph"),

  // Simulations
  listSimulations: () => request<Simulation[]>("/api/simulations"),
  getSimulation: (id: string) => request<Simulation>(`/api/simulations/${id}`),
  runSimulation: (data: { failedServiceIds: string[]; name?: string; description?: string }) =>
    request<SimulationRunResponse>("/api/simulations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteSimulation: (id: string) =>
    request<{ success: true }>(`/api/simulations/${id}`, { method: "DELETE" }),
};

export { ApiError };
