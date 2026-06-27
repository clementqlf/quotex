-- Migration: Add isVerified to Book and Author
ALTER TABLE "Author" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for performance in sorting/filtering
CREATE INDEX IF NOT EXISTS "idx_author_is_verified" ON "Author"("isVerified");
CREATE INDEX IF NOT EXISTS "idx_book_is_verified" ON "Book"("isVerified");

-- Retroactive update for existing data
UPDATE "Author" SET "isVerified" = true WHERE "inventaireUri" IS NOT NULL;
UPDATE "Book" SET "isVerified" = true WHERE "inventaireUri" IS NOT NULL OR "googleId" IS NOT NULL OR "openLibraryId" IS NOT NULL;
