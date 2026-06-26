import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCyclePath } from "@/lib/dependency-graph";

// GET /api/dependencies - full edge list, used to hydrate the graph view
export async function GET() {
  const dependencies = await prisma.dependency.findMany({
    include: {
      dependent: { select: { id: true, name: true } },
      dependsOn: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(dependencies);
}

// POST /api/dependencies - create a new dependency edge.
// Rejects the request if it would introduce a circular dependency.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dependentId, dependsOnId, type } = body;

  if (!dependentId || !dependsOnId) {
    return NextResponse.json(
      { error: "Both dependentId and dependsOnId are required." },
      { status: 400 },
    );
  }

  if (dependentId === dependsOnId) {
    return NextResponse.json(
      { error: "A service cannot depend on itself." },
      { status: 400 },
    );
  }

  const [dependent, dependsOn] = await Promise.all([
    prisma.service.findUnique({ where: { id: dependentId } }),
    prisma.service.findUnique({ where: { id: dependsOnId } }),
  ]);

  if (!dependent || !dependsOn) {
    return NextResponse.json(
      { error: "One or both services do not exist." },
      { status: 404 },
    );
  }

  const existingEdges = await prisma.dependency.findMany({
    select: { dependentId: true, dependsOnId: true },
  });

  const cyclePath = findCyclePath(existingEdges, { dependentId, dependsOnId });
  if (cyclePath) {
    // Resolve IDs to names for a readable error message.
    const services = await prisma.service.findMany({
      where: { id: { in: cyclePath } },
      select: { id: true, name: true },
    });
    const nameById = new Map(
      services.map((s: { id: string; name: string }) => [s.id, s.name]),
    );
    const readablePath = cyclePath.map((id) => nameById.get(id) ?? id);

    return NextResponse.json(
      {
        error: "This dependency would create a circular reference.",
        cyclePath: readablePath,
      },
      { status: 409 },
    );
  }

  const duplicate = await prisma.dependency.findUnique({
    where: { dependentId_dependsOnId: { dependentId, dependsOnId } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "This dependency already exists." },
      { status: 409 },
    );
  }

  const dependency = await prisma.dependency.create({
    data: { dependentId, dependsOnId, type: type ?? "HARD" },
    include: {
      dependent: { select: { id: true, name: true } },
      dependsOn: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(dependency, { status: 201 });
}
