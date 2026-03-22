/*
  Warnings:

  - You are about to drop the column `skipArcaDialogs` on the `UserPreference` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserPreference" DROP COLUMN "skipArcaDialogs",
ADD COLUMN     "skippedArcaDialogs" TEXT[] DEFAULT ARRAY[]::TEXT[];
