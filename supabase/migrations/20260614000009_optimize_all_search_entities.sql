-- ============================================================================
-- MIGRATION: Optimisation de toutes les recherches locales
-- Date: 2026-06-14
-- Description: Crée des index GIN trigrammes insensibles aux accents et à la
--              casse pour les Auteurs, Livres, Thèmes de citations, et Prix.
-- ============================================================================

-- 1. Index pour Author.name
CREATE INDEX IF NOT EXISTS idx_author_name_unaccent_trgm
  ON "Author" USING GIN (public.immutable_unaccent(lower(name)) gin_trgm_ops);

-- 2. Index pour Book.title
CREATE INDEX IF NOT EXISTS idx_book_title_unaccent_trgm
  ON "Book" USING GIN (public.immutable_unaccent(lower(title)) gin_trgm_ops);

-- 3. Index pour Quote.theme
CREATE INDEX IF NOT EXISTS idx_quote_theme_unaccent_trgm
  ON "Quote" USING GIN (public.immutable_unaccent(lower(theme)) gin_trgm_ops);

-- 4. Index pour LiteraryPrize.name
CREATE INDEX IF NOT EXISTS idx_literaryprize_name_unaccent_trgm
  ON "LiteraryPrize" USING GIN (public.immutable_unaccent(lower(name)) gin_trgm_ops);
