import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateFailure } from "@/lib/blast-radius";

// GET /api/simulations - history list, newest first
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 50);

  const simulations = await prisma.simulation.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      targets: { include: { service: { select: { id: true, name: true } } } },
      _count: { select: { results: true } },
    },
  });

  return NextResponse.json(simulations);
}

// POST /api/simulations - run a new simulation against the *current* graph
// state and persist both the inputs and the computed results.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { failedServiceIds, name, description } = body;

  if (
    !Array.isArray(failedServiceIds) ||
    failedServiceIds.length === 0 ||
    failedServiceIds.some((id: unknown) => typeof id !== "string")
  ) {
    return NextResponse.json(
      { error: "failedServiceIds must be a non-empty array of service IDs." },
      { status: 400 },
    );
  }

  const [services, edges] = await Promise.all([
    prisma.service.findMany({ select: { id: true, name: true, criticality: true } }),
    prisma.dependency.findMany({
      select: { dependentId: true, dependsOnId: true, type: true },
    }),
  ]);

  const validIds = new Set(services.map((s: { id: string }) => s.id));
  const invalidIds = failedServiceIds.filter((id: string) => !validIds.has(id));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Unknown service IDs: ${invalidIds.join(", ")}` },
      { status: 400 },
    );
  }

  const output = simulateFailure({ services, edges, failedServiceIds });

  // Persist the simulation, its target inputs, and every impacted result
  // in a single transaction so history is always internally consistent.
  const simulation = await prisma.$transaction(async (tx) => {
    const created = await tx.simulation.create({
      data: {
        name: name?.trim() || null,
        description: description?.trim() || null,
        targets: {
          create: failedServiceIds.map((serviceId: string) => ({ serviceId })),
        },
        results: {
          create: output.impacted.map((r) => ({
            serviceId: r.serviceId,
            impactStatus: r.impactStatus,
            depth: r.depth,
            severityScore: r.severityScore,
            path: r.path,
          })),
        },
      },
      include: {
        targets: { include: { service: { select: { id: true, name: true } } } },
        results: { include: { service: true } },
      },
    });
    return created;
  });

  return NextResponse.json(
    { simulation, waves: output.waves, unaffectedServiceIds: output.unaffectedServiceIds },
    { status: 201 },
  );
}
