-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Set all existing users as onboarded
UPDATE "User" SET "onboardingCompleted" = true;
