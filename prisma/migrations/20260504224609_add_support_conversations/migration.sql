-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "conversationId" TEXT;

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "pageUrl" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportConversation_userId_lastMessageAt_idx" ON "SupportConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_conversationId_key" ON "SupportTicket"("conversationId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one SupportConversation per existing SupportTicket, derived id keeps the link unambiguous
INSERT INTO "SupportConversation" ("id", "userId", "title", "pageUrl", "messages", "createdAt", "updatedAt", "lastMessageAt")
SELECT
    'conv_' || t."id",
    t."userId",
    t."subject",
    t."pageUrl",
    t."conversationLog",
    t."createdAt",
    t."updatedAt",
    t."updatedAt"
FROM "SupportTicket" t
WHERE t."conversationId" IS NULL;

UPDATE "SupportTicket"
SET "conversationId" = 'conv_' || "id"
WHERE "conversationId" IS NULL;
