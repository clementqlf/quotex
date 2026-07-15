-- Migration: Remove unique constraint on Author(name) to allow homonyms
ALTER TABLE "Author" DROP CONSTRAINT IF EXISTS "Author_name_key";
