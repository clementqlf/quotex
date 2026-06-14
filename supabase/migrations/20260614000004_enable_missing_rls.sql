-- Migration: Enable Row Level Security (RLS) on remaining unrestricted tables
-- Date: 2026-06-14

-- 1. Enable RLS on ForbiddenWord and UserBlock (policies already created in previous migrations)
ALTER TABLE "ForbiddenWord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBlock" ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on Report
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;

-- Policies for Report:
DROP POLICY IF EXISTS "Users can view own reports" ON "Report";
CREATE POLICY "Users can view own reports"
ON "Report" FOR SELECT
TO authenticated
USING (auth.uid() = "reporterId");

DROP POLICY IF EXISTS "Users can create reports" ON "Report";
CREATE POLICY "Users can create reports"
ON "Report" FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = "reporterId");

-- 3. Enable RLS on SearchCache (accessed only via Edge Functions using direct DB connection, no public API access needed)
ALTER TABLE "SearchCache" ENABLE ROW LEVEL SECURITY;

-- 4. Enable RLS on _SimilarAuthors and _SimilarBooks (allow public select, deny public write)
ALTER TABLE "_SimilarAuthors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_SimilarBooks" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view similar authors" ON "_SimilarAuthors";
CREATE POLICY "Anyone can view similar authors"
ON "_SimilarAuthors" FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can view similar books" ON "_SimilarBooks";
CREATE POLICY "Anyone can view similar books"
ON "_SimilarBooks" FOR SELECT
USING (true);
