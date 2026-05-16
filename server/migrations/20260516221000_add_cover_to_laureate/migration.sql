-- Add coverUrl column to Laureate table
ALTER TABLE "public"."Laureate" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
