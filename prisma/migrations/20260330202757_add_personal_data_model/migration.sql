-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'PULL_PERSONAL_DATA';

-- CreateTable
CREATE TABLE "PersonalData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dirCalle" TEXT NOT NULL,
    "dirNro" TEXT NOT NULL,
    "dirPiso" TEXT,
    "dirDpto" TEXT,
    "descProvincia" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "codPostal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalData_userId_fiscalYear_key" ON "PersonalData"("userId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "PersonalData" ADD CONSTRAINT "PersonalData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
