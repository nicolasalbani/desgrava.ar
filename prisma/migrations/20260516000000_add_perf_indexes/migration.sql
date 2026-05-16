-- add-perf-indexes: composite indexes that back the dashboard's hot read paths
--
-- These use plain `CREATE INDEX IF NOT EXISTS` rather than CONCURRENTLY
-- because Prisma's migration runner wraps each migration file in a single
-- transaction, and `CREATE INDEX CONCURRENTLY` cannot run inside one
-- (Postgres error 25001). On the current data volume the brief table lock
-- during index creation is acceptable. If/when these tables get large
-- enough that the lock window matters, drop the new indexes and re-create
-- them with `CREATE INDEX CONCURRENTLY` manually against `DIRECT_URL`
-- outside Prisma's runner.

-- Backs the main /api/comprobantes list query (user + year filter, newest first)
CREATE INDEX IF NOT EXISTS "Invoice_userId_fiscalYear_invoiceDate_idx"
  ON "Invoice" ("userId", "fiscalYear", "invoiceDate" DESC);

-- Backs the panel's category-filtered counts and groupBy
CREATE INDEX IF NOT EXISTS "Invoice_userId_fiscalYear_deductionCategory_idx"
  ON "Invoice" ("userId", "fiscalYear", "deductionCategory");

-- Backs the polled GET /api/automatizacion and the per-type active-job lookup
CREATE INDEX IF NOT EXISTS "AutomationJob_userId_jobType_status_idx"
  ON "AutomationJob" ("userId", "jobType", "status");

-- Backs the recibos list filter (year + status pair)
CREATE INDEX IF NOT EXISTS "DomesticReceipt_userId_fiscalYear_siradiqStatus_idx"
  ON "DomesticReceipt" ("userId", "fiscalYear", "siradiqStatus");
