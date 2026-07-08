-- Safely clean up duplicates (if any) keeping the latest entry
DELETE FROM "Edition" a USING "Edition" b
WHERE a.id < b.id AND a."inventaireUri" = b."inventaireUri";

-- Drop the redundant non-unique index
DROP INDEX IF EXISTS idx_edition_inventaireuri;

-- Drop existing unique constraint/index if they exist (helps sync dev database)
ALTER TABLE "Edition" DROP CONSTRAINT IF EXISTS "Edition_inventaireUri_key";
DROP INDEX IF EXISTS "Edition_inventaireUri_key";

-- Add the unique constraint on inventaireUri
ALTER TABLE "Edition"
ADD CONSTRAINT "Edition_inventaireUri_key" UNIQUE ("inventaireUri");
