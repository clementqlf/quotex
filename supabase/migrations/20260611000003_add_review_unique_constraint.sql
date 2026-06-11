-- ============================================================================
-- MIGRATION: Contrainte UNIQUE pour 1 avis / utilisateur / livre + colonne isAdmin
-- Date: 2026-06-10
-- Criticité: CRITIQUE - Évite le spam et la manipulation des notes
-- Généré par: Audit Mistral Vibe (Scope 5 v2)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Ajout de la colonne isAdmin sur Profile
-- ============================================================================

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "isAdmin" boolean DEFAULT false;

-- ============================================================================
-- SECTION 2: Contrainte UNIQUE sur Review(userId, bookId)
-- ============================================================================

-- 1. Vérifier les doublons existants
-- Cette requête permet d'identifier les doublons avant suppression
SELECT "userId", "bookId", COUNT(*) as count, array_agg(id ORDER BY "createdAt" DESC) as ids
FROM "Review"
GROUP BY "userId", "bookId"
HAVING COUNT(*) > 1;

-- 2. Supprimer les doublons (garder le plus récent)
-- ON CONFLICT ne fonctionnera pas sans la contrainte, donc on utilise une requête directe
DELETE FROM "Review"
WHERE id NOT IN (
  SELECT MAX(id)
  FROM "Review"
  GROUP BY "userId", "bookId"
);

-- Vérification post-suppression
SELECT "userId", "bookId", COUNT(*) as count
FROM "Review"
GROUP BY "userId", "bookId"
HAVING COUNT(*) > 1;

-- 3. Créer la contrainte UNIQUE
ALTER TABLE "Review"
ADD CONSTRAINT "Review_userId_bookId_key"
UNIQUE ("userId", "bookId");

-- 4. Vérification finale
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'Review' AND tc.constraint_type = 'UNIQUE';

-- ============================================================================
-- Vérification complète
-- ============================================================================

-- Vérifier que la colonne isAdmin existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profile' AND column_name = 'isadmin';

-- Vérifier que la contrainte UNIQUE existe
SELECT conname, conrelid::regclass
FROM pg_constraint
WHERE conrelid = '"Review"'::regclass AND contype = 'u';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- Cette migration corrige un problème critique identifié dans l'audit Scope 5 v2:
-- - Empêche un utilisateur de créer plusieurs avis pour le même livre
-- - Ajoute la colonne isAdmin nécessaire pour les fonctions de modération
-- - Conforme à Apple App Store Guidelines Section 4.3 (Spam prevention)
-- ============================================================================
