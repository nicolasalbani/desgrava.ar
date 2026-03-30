-- Seed FOUNDERS subscriptions for all existing users who don't have one yet
INSERT INTO "Subscription" ("id", "userId", "plan", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  'FOUNDERS'::"SubscriptionPlan",
  'ACTIVE'::"SubscriptionStatus",
  NOW(),
  NOW()
FROM "User" u
LEFT JOIN "Subscription" s ON s."userId" = u."id"
WHERE s."id" IS NULL;
