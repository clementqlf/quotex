-- Refactor Laureate table: remove denormalized columns, use FK references only

-- Step 1: Clear existing data (structure is changing)
DELETE FROM "public"."Laureate";

-- Step 2: Drop old unique constraint based on authorName
DROP INDEX IF EXISTS "Laureate_prizeId_year_authorName_key";

-- Step 3: Drop denormalized columns (data now lives in Author/Book tables)
ALTER TABLE "public"."Laureate" DROP COLUMN IF EXISTS "authorName";
ALTER TABLE "public"."Laureate" DROP COLUMN IF EXISTS "bookTitle";
ALTER TABLE "public"."Laureate" DROP COLUMN IF EXISTS "authorQid";
ALTER TABLE "public"."Laureate" DROP COLUMN IF EXISTS "workQid";
ALTER TABLE "public"."Laureate" DROP COLUMN IF EXISTS "coverUrl";

-- Step 4: Make authorId NOT NULL (always created during sync now)
ALTER TABLE "public"."Laureate" ALTER COLUMN "authorId" SET NOT NULL;

-- Step 5: New unique constraint based on FK
CREATE UNIQUE INDEX "Laureate_prizeId_year_authorId_key" ON "public"."Laureate"("prizeId", "year", "authorId");
