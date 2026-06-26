-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "ImpactStatus" AS ENUM ('DIRECT', 'INDIRECT', 'DEGRADED', 'UNAFFECTED');

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM',
    "status" "ServiceStatus" NOT NULL DEFAULT 'HEALTHY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "dependentId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'HARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationTarget" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "SimulationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationResult" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "impactStatus" "ImpactStatus" NOT NULL,
    "depth" INTEGER NOT NULL,
    "severityScore" DOUBLE PRECISION NOT NULL,
    "path" JSONB NOT NULL,

    CONSTRAINT "SimulationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "Service"("status");

-- CreateIndex
CREATE INDEX "Service_criticality_idx" ON "Service"("criticality");

-- CreateIndex
CREATE INDEX "Dependency_dependentId_idx" ON "Dependency"("dependentId");

-- CreateIndex
CREATE INDEX "Dependency_dependsOnId_idx" ON "Dependency"("dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_dependentId_dependsOnId_key" ON "Dependency"("dependentId", "dependsOnId");

-- CreateIndex
CREATE INDEX "Simulation_createdAt_idx" ON "Simulation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationTarget_simulationId_serviceId_key" ON "SimulationTarget"("simulationId", "serviceId");

-- CreateIndex
CREATE INDEX "SimulationResult_simulationId_idx" ON "SimulationResult"("simulationId");

-- CreateIndex
CREATE INDEX "SimulationResult_impactStatus_idx" ON "SimulationResult"("impactStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationResult_simulationId_serviceId_key" ON "SimulationResult"("simulationId", "serviceId");

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationTarget" ADD CONSTRAINT "SimulationTarget_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationTarget" ADD CONSTRAINT "SimulationTarget_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResult" ADD CONSTRAINT "SimulationResult_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResult" ADD CONSTRAINT "SimulationResult_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
