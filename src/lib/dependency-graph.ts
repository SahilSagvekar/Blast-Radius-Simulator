/**
 * Graph validation helpers used when creating/editing dependencies.
 *
 * Circular dependency detection runs BEFORE a new edge is persisted (see
 * the POST /api/dependencies route). We check: "if I add edge
 * (dependentId -> dependsOnId), does the graph now contain a cycle?"
 *
 * This is equivalent to asking: "is dependentId already reachable FROM
 * dependsOnId?" If dependsOnId can already reach dependentId through
 * existing edges, adding this new edge would close a loop.
 *
 * We do a simple DFS from dependsOnId, walking forward along existing
 * "depends on" edges, and check whether we ever reach dependentId.
 */

export interface SimpleEdge {
  dependentId: string;
  dependsOnId: string;
}

export function wouldCreateCycle(
  existingEdges: SimpleEdge[],
  newEdge: SimpleEdge,
): boolean {
  // Self-dependency is trivially a cycle.
  if (newEdge.dependentId === newEdge.dependsOnId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of existingEdges) {
    if (!adjacency.has(edge.dependentId)) adjacency.set(edge.dependentId, []);
    adjacency.get(edge.dependentId)!.push(edge.dependsOnId);
  }

  // Question: starting from newEdge.dependsOnId, walking "depends on" edges
  // forward, can we reach newEdge.dependentId? If so, dependentId already
  // (transitively) depends on something that depends on dependsOnId's chain
  // back to dependentId — adding the new edge would close the loop.
  const visited = new Set<string>();
  const stack = [newEdge.dependsOnId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newEdge.dependentId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      if (!visited.has(next)) stack.push(next);
    }
  }

  return false;
}

/**
 * Returns the full cycle path (for a clear error message) if adding newEdge
 * would create one, otherwise null. Used by the API to tell the user exactly
 * which chain of services causes the conflict.
 */
export function findCyclePath(
  existingEdges: SimpleEdge[],
  newEdge: SimpleEdge,
): string[] | null {
  if (newEdge.dependentId === newEdge.dependsOnId) {
    return [newEdge.dependentId, newEdge.dependentId];
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of existingEdges) {
    if (!adjacency.has(edge.dependentId)) adjacency.set(edge.dependentId, []);
    adjacency.get(edge.dependentId)!.push(edge.dependsOnId);
  }

  // DFS with path tracking from dependsOnId, looking for dependentId.
  const path: string[] = [];
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    path.push(node);
    if (node === newEdge.dependentId) return true;
    visited.add(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!visited.has(next) && dfs(next)) return true;
    }

    path.pop();
    return false;
  }

  if (dfs(newEdge.dependsOnId)) {
    return [newEdge.dependentId, ...path];
  }
  return null;
}
