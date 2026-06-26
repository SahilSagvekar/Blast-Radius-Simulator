import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/services/:id - includes resolved dependency/dependent service names
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      dependencies: { include: { dependsOn: true } },
      dependents: { include: { dependent: true } },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  return NextResponse.json(service);
}

// PATCH /api/services/:id - partial update
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { name, description, owner, criticality, status } = body;

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  if (name && name !== existing.name) {
    const nameTaken = await prisma.service.findUnique({ where: { name } });
    if (nameTaken) {
      return NextResponse.json(
        { error: `A service named "${name}" already exists.` },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.service.update({
    where: { id },
    data: {
      name: name ?? undefined,
      description: description ?? undefined,
      owner: owner ?? undefined,
      criticality: criticality ?? undefined,
      status: status ?? undefined,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/services/:id - cascades to dependencies (see schema onDelete: Cascade)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
