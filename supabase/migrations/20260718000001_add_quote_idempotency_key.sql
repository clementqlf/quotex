-- Migration: Add idempotencyKey to Quote for server-side deduplication
-- Prevents duplicate quotes when the client retries a failed sync operation.
-- The client sends a stable UUID (OperationQueue operation id) as the idempotency key.
-- The server uses ON CONFLICT to return the existing quote instead of inserting a new one.

ALTER TABLE "Quote"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- Partial unique index: only enforces uniqueness when the key is set.
-- NULL values are intentionally excluded (quotes created without a key are not deduplicated).
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_idempotency_key
  ON "Quote" ("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
