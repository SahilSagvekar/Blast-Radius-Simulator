import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/dependencies/:id - remove a dependency edge
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const existing = await prisma.dependency.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Dependency not found." },
      { status: 404 },
    );
  }

  await prisma.dependency.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
