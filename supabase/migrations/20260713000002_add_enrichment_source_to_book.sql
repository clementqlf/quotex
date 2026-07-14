-- Migration: Add enrichmentSource to Book
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "enrichmentSource" TEXT;

-- Create index for performance in sorting/filtering
CREATE INDEX IF NOT EXISTS "idx_book_enrichment_source" ON "Book"("enrichmentSource");

-- Retroactive update for existing books
UPDATE "Book"
SET "enrichmentSource" = 
  CASE 
    WHEN "inventaireUri" IS NOT NULL AND "inventaireUri" != '' THEN 'inventaire'
    WHEN "googleId" IS NOT NULL AND "googleId" != '' THEN 'googlebooks'
    WHEN "openLibraryId" IS NOT NULL AND "openLibraryId" != '' THEN 'openlibrary'
    ELSE NULL
  END
WHERE "enrichmentSource" IS NULL;
