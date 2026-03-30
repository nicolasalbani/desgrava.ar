-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('PERSONAL', 'FOUNDERS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'CANCELLED', 'PAST_DUE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "billingFrequency" "BillingFrequency",
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "mercadoPagoPreapprovalId" TEXT,
    "trialReminder7DaySentAt" TIMESTAMP(3),
    "trialReminder1DaySentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_mercadoPagoPreapprovalId_key" ON "Subscription"("mercadoPagoPreapprovalId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
