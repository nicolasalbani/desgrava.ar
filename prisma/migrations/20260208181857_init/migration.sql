-- CreateEnum
CREATE TYPE "DeductionCategory" AS ENUM ('ALQUILER_VIVIENDA', 'CUOTAS_MEDICO_ASISTENCIALES', 'GASTOS_MEDICOS', 'PRIMAS_SEGURO_MUERTE', 'DONACIONES', 'SERVICIO_DOMESTICO', 'INTERESES_HIPOTECARIOS', 'HONORARIOS_ASISTENCIA_SANITARIA', 'GASTOS_EDUCATIVOS', 'GASTOS_SEPELIO', 'INDUMENTARIA_EQUIPAMIENTO', 'VEHICULO', 'VIANDAS_TRANSPORTE', 'HERRAMIENTAS_EDUCATIVAS');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'NOTA_DEBITO_A', 'NOTA_DEBITO_B', 'NOTA_DEBITO_C', 'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C', 'RECIBO', 'TICKET');

-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('MANUAL', 'PDF', 'OCR');

-- CreateEnum
CREATE TYPE "SiradiqStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'PREVIEW_READY', 'CONFIRMED', 'SUBMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('VALIDATE_CREDENTIALS', 'SUBMIT_INVOICE', 'BULK_SUBMIT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ArcaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "encryptedClave" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deductionCategory" "DeductionCategory" NOT NULL,
    "providerCuit" TEXT NOT NULL,
    "providerName" TEXT,
    "invoiceType" "InvoiceType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalMonth" INTEGER NOT NULL,
    "description" TEXT,
    "source" "InvoiceSource" NOT NULL DEFAULT 'MANUAL',
    "ocrConfidence" DOUBLE PRECISION,
    "siradiqStatus" "SiradiqStatus" NOT NULL DEFAULT 'PENDING',
    "originalFilename" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "jobType" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "screenshotUrl" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoMode" BOOLEAN NOT NULL DEFAULT false,
    "defaultFiscalYear" INTEGER,
    "notifications" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "ArcaCredential_userId_key" ON "ArcaCredential"("userId");

-- CreateIndex
CREATE INDEX "Invoice_userId_fiscalYear_idx" ON "Invoice"("userId", "fiscalYear");

-- CreateIndex
CREATE INDEX "Invoice_userId_siradiqStatus_idx" ON "Invoice"("userId", "siradiqStatus");

-- CreateIndex
CREATE INDEX "AutomationJob_userId_status_idx" ON "AutomationJob"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcaCredential" ADD CONSTRAINT "ArcaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
