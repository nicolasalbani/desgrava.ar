-- CreateTable
CREATE TABLE "FamilyDependent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipoDoc" TEXT NOT NULL,
    "numeroDoc" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" TEXT,
    "parentesco" TEXT NOT NULL,
    "fechaUnion" TEXT,
    "porcentajeDed" TEXT,
    "cuitOtroDed" TEXT,
    "familiaCargo" BOOLEAN NOT NULL DEFAULT true,
    "residente" BOOLEAN NOT NULL DEFAULT true,
    "tieneIngresos" BOOLEAN NOT NULL DEFAULT false,
    "montoIngresos" DECIMAL(12,2),
    "mesDesde" INTEGER NOT NULL DEFAULT 1,
    "mesHasta" INTEGER NOT NULL DEFAULT 12,
    "proximosPeriodos" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyDependent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyDependent_userId_idx" ON "FamilyDependent"("userId");

-- AddForeignKey
ALTER TABLE "FamilyDependent" ADD CONSTRAINT "FamilyDependent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
