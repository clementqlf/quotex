-- Migration: Ajouter une contrainte UNIQUE sur (query, type) de la table SearchCache
-- 1. Nettoyer les doublons potentiels existants en conservant uniquement le plus récent
DELETE FROM "SearchCache" a
USING "SearchCache" b
WHERE a.id < b.id
  AND a."query" = b."query"
  AND a."type" = b."type";

-- 2. Supprimer la contrainte ou l'index si existant pour éviter les conflits
ALTER TABLE "SearchCache" DROP CONSTRAINT IF EXISTS "SearchCache_query_type_key";
DROP INDEX IF EXISTS "SearchCache_query_type_key";

-- 3. Ajouter la contrainte UNIQUE sur les colonnes "query" et "type"
ALTER TABLE "SearchCache" ADD CONSTRAINT "SearchCache_query_type_key" UNIQUE ("query", "type");
