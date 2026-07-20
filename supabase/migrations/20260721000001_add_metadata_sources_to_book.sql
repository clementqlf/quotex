-- Migration: Add metadataSources (JSONB) to Book
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "metadataSources" JSONB DEFAULT '{}'::jsonb;
