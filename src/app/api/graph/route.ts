import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/graph - single call that returns the full services + edges
// dataset needed to render the React Flow canvas. Combining these into one
// request avoids a waterfall of two round trips on initial page load.
export async function GET() {
  const [services, dependencies] = await Promise.all([
    prisma.service.findMany({
      include: {
        _count: { select: { dependencies: true, dependents: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.dependency.findMany(),
  ]);

  return NextResponse.json({ services, dependencies });
}
