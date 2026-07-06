-- Create Theme table
CREATE TABLE IF NOT EXISTS "Theme" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) UNIQUE NOT NULL,
  "color" VARCHAR(7),
  "icon" VARCHAR(50)
);

-- Create QuoteTheme junction table
CREATE TABLE IF NOT EXISTS "QuoteTheme" (
  "quoteId" INTEGER NOT NULL REFERENCES "Quote"("id") ON DELETE CASCADE,
  "themeId" INTEGER NOT NULL REFERENCES "Theme"("id") ON DELETE CASCADE,
  PRIMARY KEY ("quoteId", "themeId")
);

-- Enable RLS
ALTER TABLE "Theme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteTheme" ENABLE ROW LEVEL SECURITY;

-- Theme RLS Policies
DROP POLICY IF EXISTS "Anyone can select themes" ON "Theme";
CREATE POLICY "Anyone can select themes" ON "Theme"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert themes" ON "Theme";
CREATE POLICY "Authenticated users can insert themes" ON "Theme"
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- QuoteTheme RLS Policies
DROP POLICY IF EXISTS "Anyone can view quote themes" ON "QuoteTheme";
CREATE POLICY "Anyone can view quote themes" ON "QuoteTheme"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Quote" q 
      WHERE q.id = "quoteId" 
      AND (q."isPublic" = true OR q."userId" = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage themes for their own quotes" ON "QuoteTheme";
CREATE POLICY "Users can manage themes for their own quotes" ON "QuoteTheme"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Quote" q 
      WHERE q.id = "quoteId" 
      AND q."userId" = auth.uid()
    )
  );

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_quote_theme_quote_id" ON "QuoteTheme"("quoteId");
CREATE INDEX IF NOT EXISTS "idx_quote_theme_theme_id" ON "QuoteTheme"("themeId");

-- Migrate existing data
-- 1. Insert primary themes from Quote.theme
INSERT INTO "Theme" ("name")
SELECT DISTINCT "theme" 
FROM "Quote" 
WHERE "theme" IS NOT NULL AND "theme" != '' AND "theme" != 'Thème non renseigné'
ON CONFLICT ("name") DO NOTHING;

-- 2. Insert secondary themes from blockData.additionalThemes
INSERT INTO "Theme" ("name")
SELECT DISTINCT elem
FROM "Quote",
LATERAL jsonb_array_elements_text(
  CASE 
    WHEN "blockData" IS NOT NULL AND "blockData" != '' AND "blockData" LIKE '{%}' 
    THEN "blockData"::jsonb -> 'additionalThemes'
    ELSE NULL 
  END
) AS elem
WHERE elem IS NOT NULL AND elem != '' AND elem != 'Thème non renseigné'
ON CONFLICT ("name") DO NOTHING;

-- 3. Link primary themes in QuoteTheme
INSERT INTO "QuoteTheme" ("quoteId", "themeId")
SELECT q.id, t.id
FROM "Quote" q
JOIN "Theme" t ON t.name = q.theme
ON CONFLICT DO NOTHING;

-- 4. Link additional themes in QuoteTheme
INSERT INTO "QuoteTheme" ("quoteId", "themeId")
SELECT q.id, t.id
FROM "Quote" q,
LATERAL jsonb_array_elements_text(
  CASE 
    WHEN "blockData" IS NOT NULL AND "blockData" != '' AND "blockData" LIKE '{%}' 
    THEN "blockData"::jsonb -> 'additionalThemes'
    ELSE NULL 
  END
) AS elem
JOIN "Theme" t ON t.name = elem
ON CONFLICT DO NOTHING;
