-- ============================================================================
-- MIGRATION: Index GIN trigram insensible aux accents et à la casse
-- Date: 2026-06-14
-- Description: Active l'extension unaccent, crée une fonction wrapper
--              IMMUTABLE pour unaccent (requis pour les index fonctionnels),
--              supprime les anciens index de la migration 07 et crée des index
--              optimisés utilisant le wrapper.
-- ============================================================================

-- 1. Activer l'extension unaccent dans le schéma extensions
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- 2. Créer le wrapper IMMUTABLE pour unaccent
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $function$
  SELECT extensions.unaccent(text);
$function$;

-- 3. Supprimer les index basiques précédents
DROP INDEX IF EXISTS idx_profile_username_trgm;
DROP INDEX IF EXISTS idx_profile_name_trgm;

-- 4. Créer les nouveaux index insensibles aux accents et à la casse
CREATE INDEX IF NOT EXISTS idx_profile_username_unaccent_trgm
  ON "Profile" USING GIN (public.immutable_unaccent(lower(username)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profile_name_unaccent_trgm
  ON "Profile" USING GIN (public.immutable_unaccent(lower(COALESCE(name, ''))) gin_trgm_ops);
