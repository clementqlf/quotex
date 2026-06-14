-- ============================================================================
-- MIGRATION: Index GIN trigram pour la recherche d'utilisateurs
-- Date: 2026-06-14
-- Description: Optimise la recherche par username et nom (ILIKE '%...%')
--              grâce aux index trigram de pg_trgm (déjà activé).
--              Sans ces index, ILIKE '%query%' fait un seq scan complet.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profile_username_trgm
  ON "Profile" USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profile_name_trgm
  ON "Profile" USING GIN (name gin_trgm_ops);
