-- Add isNotable column to Book table
-- A book is "notable" when it appears in both Wikidata (wdt:P800) and Inventaire.io (wdt:P50)
-- This value is set during author enrichment (discoverAuthorWorks) and avoids live Wikidata queries on each profile load.

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "isNotable" BOOLEAN NOT NULL DEFAULT false;

-- Index for fast notable works lookup per author
CREATE INDEX IF NOT EXISTS idx_book_author_is_notable ON "Book"("authorId", "isNotable") WHERE "isNotable" = true;
