-- Add inceptionYear and founder columns to LiteraryPrize table
ALTER TABLE "LiteraryPrize" 
ADD COLUMN IF NOT EXISTS "inceptionYear" INTEGER,
ADD COLUMN IF NOT EXISTS "founder" TEXT;

-- Add missing unique constraint on inventaireUri
ALTER TABLE "LiteraryPrize" 
DROP CONSTRAINT IF EXISTS "LiteraryPrize_inventaireUri_key";

DROP INDEX IF EXISTS "LiteraryPrize_inventaireUri_key";

ALTER TABLE "LiteraryPrize" 
ADD CONSTRAINT "LiteraryPrize_inventaireUri_key" UNIQUE ("inventaireUri");
