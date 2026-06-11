-- ============================================================================
-- MIGRATION: Créer le trigger pour la synchronisation automatique de likesCount
-- Date: 2026-06-09
-- Généré par: Audit Mistral Vibe (Scope 3)
-- Description: Trigger pour maintenir likesCount cohérent dans Quote
--              lorsqu'un Like est ajouté ou supprimé
-- ============================================================================

-- ⚠️  IMPORTANT: Ce trigger remplace la logique manuelle dans quotes/index.ts
--     Après application, vous pouvez simplifier le code Edge Function

-- ============================================================================
-- SECTION 1: Fonction de déclenchement
-- ============================================================================

CREATE OR REPLACE FUNCTION update_quote_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Sur INSERT dans Like: incrémenter likesCount de la Quote correspondante
  IF TG_OP = 'INSERT' THEN
    UPDATE "Quote" 
    SET "likesCount" = "likesCount" + 1 
    WHERE id = NEW."quoteId";
    RETURN NEW;
  
  -- Sur DELETE dans Like: décrémenter likesCount de la Quote correspondante
  -- GREATEST(0, ...) empêche d'avoir un nombre négatif
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "Quote" 
    SET "likesCount" = GREATEST(0, "likesCount" - 1) 
    WHERE id = OLD."quoteId";
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 2: Déclencheurs (Triggers)
-- ============================================================================

-- Trigger après INSERT sur Like
DROP TRIGGER IF EXISTS trg_like_insert_update_quote ON "Like";
CREATE TRIGGER trg_like_insert_update_quote
  AFTER INSERT ON "Like"
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_likes_count();

-- Trigger après DELETE sur Like
DROP TRIGGER IF EXISTS trg_like_delete_update_quote ON "Like";
CREATE TRIGGER trg_like_delete_update_quote
  AFTER DELETE ON "Like"
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_likes_count();

-- ============================================================================
-- SECTION 3: Correction des données existantes (si nécessaire)
-- ============================================================================

-- Cette section corrige les incohérences existantes entre Like et likesCount
-- À exécuter UNE SEULE FOIS après la création du trigger

-- DO $$
-- DECLARE
--   quote_record RECORD;
--   like_count INT;
-- BEGIN
--   FOR quote_record IN SELECT id FROM "Quote" LOOP
--     SELECT COUNT(*) INTO like_count 
--     FROM "Like" 
--     WHERE "quoteId" = quote_record.id;
--     
--     UPDATE "Quote" 
--     SET "likesCount" = like_count 
--     WHERE id = quote_record.id;
--   END LOOP;
--   
--   RAISE NOTICE 'Synchronisation terminée: likesCount mis à jour pour toutes les Quote';
-- END $$;

-- ============================================================================
-- SECTION 4: Vérification
-- ============================================================================

-- Pour vérifier que le trigger fonctionne:
-- 1. Insérer un Like:
--    INSERT INTO "Like" ("userId", "quoteId", "createdAt") VALUES ('uuid', quote_id, now());
-- 2. Vérifier que likesCount a été incrémenté:
--    SELECT "likesCount" FROM "Quote" WHERE id = quote_id;
-- 3. Supprimer le Like:
--    DELETE FROM "Like" WHERE "userId" = 'uuid' AND "quoteId" = quote_id;
-- 4. Vérifier que likesCount a été décrémenté

-- Pour lister les triggers:
-- SELECT tgname, tgrelid::regclass, tgfoid::regproc, tgtype, tgenabled
-- FROM pg_trigger
-- WHERE tgname LIKE 'trg_like%';

-- ============================================================================
-- NOTES:
-- ============================================================================

-- 1. Le trigger utilise AFTER pour s'assurer que l'INSERT/DELETE dans Like
--    a bien eu lieu avant de mettre à jour Quote

-- 2. FOR EACH ROW signifie que le trigger s'exécute pour chaque ligne affectée

-- 3. SECURITY DEFINER permet à la fonction de s'exécuter avec les droits
--    du créateur de la fonction (nécessaire si RLS est activé)

-- 4. Après application de ce trigger, vous pouvez simplifier le code dans
--    quotes/index.ts en supprimant les UPDATE manuels de likesCount

-- ============================================================================
-- Généré par Mistral Vibe - Co-Authored-By: Mistral Vibe <vibe@mistral.ai>
-- ============================================================================
