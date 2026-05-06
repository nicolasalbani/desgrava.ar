/*
  Warnings:

  - You are about to drop the column `fileData` on the `DomesticReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `fileMimeType` on the `DomesticReceipt` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `fileMimeType` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `fileData` on the `Presentacion` table. All the data in the column will be lost.
  - You are about to drop the column `fileMimeType` on the `Presentacion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DomesticReceipt" DROP COLUMN "fileData",
DROP COLUMN "fileMimeType",
ADD COLUMN     "fileStorageKey" TEXT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "fileData",
DROP COLUMN "fileMimeType",
ADD COLUMN     "fileStorageKey" TEXT;

-- AlterTable
ALTER TABLE "Presentacion" DROP COLUMN "fileData",
DROP COLUMN "fileMimeType",
ADD COLUMN     "fileStorageKey" TEXT;
