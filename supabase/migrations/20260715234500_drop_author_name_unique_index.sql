-- Migration: Drop unique index on Author(name) to allow homonyms
DROP INDEX IF EXISTS "Author_name_key";
