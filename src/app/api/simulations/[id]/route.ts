import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/simulations/:id - full detail for replaying a past simulation,
// including per-service path/severity so "Dependency Path Exploration"
// works without recomputation.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const simulation = await prisma.simulation.findUnique({
    where: { id },
    include: {
      targets: { include: { service: true } },
      results: {
        include: { service: true },
        orderBy: { severityScore: "desc" },
      },
    },
  });

  if (!simulation) {
    return NextResponse.json(
      { error: "Simulation not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(simulation);
}

// DELETE /api/simulations/:id - remove a simulation from history
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const existing = await prisma.simulation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Simulation not found." },
      { status: 404 },
    );
  }

  await prisma.simulation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
