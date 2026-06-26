import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Criticality, ServiceStatus } from "@prisma/client";

// GET /api/services?search=&status=&criticality=&sort=
// Supports search-by-name and filtering, used by the Service Health
// Dashboard and the search/filter requirement.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") as ServiceStatus | null;
  const criticality = searchParams.get("criticality") as Criticality | null;

  const services = await prisma.service.findMany({
    where: {
      name: search ? { contains: search, mode: "insensitive" } : undefined,
      status: status ?? undefined,
      criticality: criticality ?? undefined,
    },
    include: {
      _count: {
        select: { dependencies: true, dependents: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(services);
}

// POST /api/services - create a new service
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, owner, criticality } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Service name is required." },
      { status: 400 },
    );
  }

  const existing = await prisma.service.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: `A service named "${name}" already exists.` },
      { status: 409 },
    );
  }

  const service = await prisma.service.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      owner: owner?.trim() || null,
      criticality: criticality ?? "MEDIUM",
    },
  });

  return NextResponse.json(service, { status: 201 });
}
