import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires PrismaClient to be constructed with an explicit driver
// adapter rather than reading DATABASE_URL implicitly from schema.prisma.
// See prisma.config.ts for the CLI-side (migrate/seed) connection config,
// which is configured separately from this runtime client.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in your database connection string.",
  );
}

// Standard Next.js dev-mode singleton pattern: prevents creating a new
// PrismaClient (and a new connection pool) on every hot-reload, which
// otherwise exhausts Postgres connections during local development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}