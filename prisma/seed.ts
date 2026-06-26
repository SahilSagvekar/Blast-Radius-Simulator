/**
 * Seed script: populates a realistic sample dependency graph so the app
 * isn't empty on first run. Run with: npx prisma db seed
 * (configured via the "prisma.seed" field in package.json)
 *
 * The graph models a small e-commerce-style platform with a deliberate
 * mix of depth, fan-in ("hub" services), and HARD vs SOFT dependencies,
 * so a failure simulation produces visually interesting, demo-worthy
 * results (multiple severity levels, a couple of degraded-only services,
 * and a clear multi-hop cascade).
 */

import { PrismaClient, Criticality, DependencyType } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedService {
  name: string;
  description: string;
  owner: string;
  criticality: Criticality;
}

const services: SeedService[] = [
  { name: "postgres-primary", description: "Primary relational database", owner: "Platform", criticality: Criticality.CRITICAL },
  { name: "redis-cache", description: "Shared caching layer", owner: "Platform", criticality: Criticality.HIGH },
  { name: "auth-service", description: "Authentication & session management", owner: "Identity", criticality: Criticality.CRITICAL },
  { name: "user-service", description: "User profile and account management", owner: "Identity", criticality: Criticality.HIGH },
  { name: "catalog-service", description: "Product catalog and search", owner: "Commerce", criticality: Criticality.HIGH },
  { name: "inventory-service", description: "Stock levels and warehouse sync", owner: "Commerce", criticality: Criticality.HIGH },
  { name: "pricing-service", description: "Dynamic pricing and discounts", owner: "Commerce", criticality: Criticality.MEDIUM },
  { name: "cart-service", description: "Shopping cart state", owner: "Commerce", criticality: Criticality.HIGH },
  { name: "order-service", description: "Order placement and lifecycle", owner: "Commerce", criticality: Criticality.CRITICAL },
  { name: "payment-gateway", description: "Third-party payment processing integration", owner: "Payments", criticality: Criticality.CRITICAL },
  { name: "notification-service", description: "Email and push notifications", owner: "Growth", criticality: Criticality.MEDIUM },
  { name: "analytics-pipeline", description: "Event tracking and analytics ingestion", owner: "Data", criticality: Criticality.LOW },
  { name: "recommendation-engine", description: "Personalized product recommendations", owner: "Data", criticality: Criticality.LOW },
  { name: "api-gateway", description: "Public-facing API gateway / BFF", owner: "Platform", criticality: Criticality.CRITICAL },
  { name: "web-frontend", description: "Customer-facing storefront web app", owner: "Frontend", criticality: Criticality.HIGH },
  { name: "admin-dashboard", description: "Internal operations dashboard", owner: "Platform", criticality: Criticality.MEDIUM },
];

// dependent depends on dependsOn
const dependencies: { dependent: string; dependsOn: string; type: DependencyType }[] = [
  // Core data layer
  { dependent: "auth-service", dependsOn: "postgres-primary", type: DependencyType.HARD },
  { dependent: "user-service", dependsOn: "postgres-primary", type: DependencyType.HARD },
  { dependent: "catalog-service", dependsOn: "postgres-primary", type: DependencyType.HARD },
  { dependent: "inventory-service", dependsOn: "postgres-primary", type: DependencyType.HARD },
  { dependent: "order-service", dependsOn: "postgres-primary", type: DependencyType.HARD },

  // Caching (mostly soft — services can fall back to the DB, just slower)
  { dependent: "catalog-service", dependsOn: "redis-cache", type: DependencyType.SOFT },
  { dependent: "pricing-service", dependsOn: "redis-cache", type: DependencyType.SOFT },
  { dependent: "auth-service", dependsOn: "redis-cache", type: DependencyType.HARD }, // sessions live in redis — hard dependency

  // Identity chain
  { dependent: "user-service", dependsOn: "auth-service", type: DependencyType.HARD },
  { dependent: "cart-service", dependsOn: "auth-service", type: DependencyType.HARD },
  { dependent: "order-service", dependsOn: "auth-service", type: DependencyType.HARD },

  // Commerce chain
  { dependent: "pricing-service", dependsOn: "catalog-service", type: DependencyType.HARD },
  { dependent: "cart-service", dependsOn: "catalog-service", type: DependencyType.HARD },
  { dependent: "cart-service", dependsOn: "pricing-service", type: DependencyType.HARD },
  { dependent: "cart-service", dependsOn: "inventory-service", type: DependencyType.SOFT }, // can show stale stock briefly
  { dependent: "order-service", dependsOn: "cart-service", type: DependencyType.HARD },
  { dependent: "order-service", dependsOn: "inventory-service", type: DependencyType.HARD },
  { dependent: "order-service", dependsOn: "payment-gateway", type: DependencyType.HARD },

  // Notifications & analytics (soft consumers, shouldn't break checkout)
  { dependent: "notification-service", dependsOn: "order-service", type: DependencyType.SOFT },
  { dependent: "notification-service", dependsOn: "user-service", type: DependencyType.SOFT },
  { dependent: "analytics-pipeline", dependsOn: "order-service", type: DependencyType.SOFT },
  { dependent: "recommendation-engine", dependsOn: "analytics-pipeline", type: DependencyType.SOFT },
  { dependent: "recommendation-engine", dependsOn: "catalog-service", type: DependencyType.HARD },

  // Edge / presentation layer
  { dependent: "api-gateway", dependsOn: "auth-service", type: DependencyType.HARD },
  { dependent: "api-gateway", dependsOn: "user-service", type: DependencyType.HARD },
  { dependent: "api-gateway", dependsOn: "catalog-service", type: DependencyType.HARD },
  { dependent: "api-gateway", dependsOn: "cart-service", type: DependencyType.HARD },
  { dependent: "api-gateway", dependsOn: "order-service", type: DependencyType.HARD },
  { dependent: "api-gateway", dependsOn: "recommendation-engine", type: DependencyType.SOFT },
  { dependent: "web-frontend", dependsOn: "api-gateway", type: DependencyType.HARD },
  { dependent: "admin-dashboard", dependsOn: "api-gateway", type: DependencyType.HARD },
  { dependent: "admin-dashboard", dependsOn: "inventory-service", type: DependencyType.HARD },
];

async function main() {
  console.log("Seeding services...");
  const nameToId = new Map<string, string>();

  for (const service of services) {
    const created = await prisma.service.upsert({
      where: { name: service.name },
      update: {},
      create: service,
    });
    nameToId.set(service.name, created.id);
  }

  console.log(`Created/verified ${services.length} services.`);

  console.log("Seeding dependencies...");
  let createdCount = 0;
  for (const dep of dependencies) {
    const dependentId = nameToId.get(dep.dependent);
    const dependsOnId = nameToId.get(dep.dependsOn);
    if (!dependentId || !dependsOnId) {
      console.warn(`Skipping dependency referencing unknown service: ${dep.dependent} -> ${dep.dependsOn}`);
      continue;
    }
    await prisma.dependency.upsert({
      where: { dependentId_dependsOnId: { dependentId, dependsOnId } },
      update: { type: dep.type },
      create: { dependentId, dependsOnId, type: dep.type },
    });
    createdCount++;
  }

  console.log(`Created/verified ${createdCount} dependencies.`);
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
