-- ============================================================================
-- MIGRATION: Créer les politiques RLS (Row Level Security)
-- Date: 2026-06-09
-- Généré par: Audit Mistral Vibe (Scope 3)
-- Description: Politiques de sécurité pour toutes les tables
--              Empêche l'accès non autorisé aux données
-- ============================================================================

-- ============================================================================
-- SECTION 1: Table Quote (Citations)
-- Note: La colonne userId est en majuscule, donc on utilise "userId" avec guillemets
-- ============================================================================

-- ✅ Lecture: Un utilisateur peut voir ses propres citations
DROP POLICY IF EXISTS "Users can view own quotes" ON "Quote";
CREATE POLICY "Users can view own quotes"
ON "Quote" FOR SELECT
USING (auth.uid() = "userId");

-- ✅ Lecture: Un utilisateur peut voir les citations publiques
DROP POLICY IF EXISTS "Users can view public quotes" ON "Quote";
CREATE POLICY "Users can view public quotes"
ON "Quote" FOR SELECT
USING ("isPublic" = true);

-- ✅ Création: Un utilisateur ne peut créer que ses propres citations
DROP POLICY IF EXISTS "Users can create quotes" ON "Quote";
CREATE POLICY "Users can create quotes"
ON "Quote" FOR INSERT
WITH CHECK (auth.uid() = "userId");

-- ✅ Mise à jour: Un utilisateur ne peut modifier que ses propres citations
DROP POLICY IF EXISTS "Users can update own quotes" ON "Quote";
CREATE POLICY "Users can update own quotes"
ON "Quote" FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ✅ Suppression: Un utilisateur ne peut supprimer que ses propres citations
DROP POLICY IF EXISTS "Users can delete own quotes" ON "Quote";
CREATE POLICY "Users can delete own quotes"
ON "Quote" FOR DELETE
USING (auth.uid() = "userId");

-- ============================================================================
-- SECTION 2: Table Profile (Profils utilisateurs)
-- Note: La colonne id est en minuscule, pas besoin de guillemets
-- ============================================================================

-- ✅ Lecture: Un utilisateur peut voir son propre profil
DROP POLICY IF EXISTS "Users can view own profile" ON "Profile";
CREATE POLICY "Users can view own profile"
ON "Profile" FOR SELECT
USING (auth.uid() = id);

-- ✅ Lecture: Un utilisateur peut voir les profils publics
DROP POLICY IF EXISTS "Users can view public profiles" ON "Profile";
CREATE POLICY "Users can view public profiles"
ON "Profile" FOR SELECT
USING ("isPublic" = true);

-- ✅ Mise à jour: Un utilisateur ne peut modifier que son propre profil
DROP POLICY IF EXISTS "Users can update own profile" ON "Profile";
CREATE POLICY "Users can update own profile"
ON "Profile" FOR UPDATE
USING (auth.uid() = id);

-- ============================================================================
-- SECTION 3: Table Book (Livres - Catalogue public)
-- ============================================================================

-- ✅ Lecture: Tout le monde peut voir les livres (catalogue public)
DROP POLICY IF EXISTS "Anyone can view books" ON "Book";
CREATE POLICY "Anyone can view books"
ON "Book" FOR SELECT
USING (true);

-- ❌ Écriture: Interdire la création/modification/suppression directe
--    (Les livres doivent être créés/modifiés via les Edge Functions)
DROP POLICY IF EXISTS "No direct book creation" ON "Book";
CREATE POLICY "No direct book creation"
ON "Book" FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct book updates" ON "Book";
CREATE POLICY "No direct book updates"
ON "Book" FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct book deletion" ON "Book";
CREATE POLICY "No direct book deletion"
ON "Book" FOR DELETE
USING (false);

-- ============================================================================
-- SECTION 4: Table Author (Auteurs - Catalogue public)
-- ============================================================================

-- ✅ Lecture: Tout le monde peut voir les auteurs (catalogue public)
DROP POLICY IF EXISTS "Anyone can view authors" ON "Author";
CREATE POLICY "Anyone can view authors"
ON "Author" FOR SELECT
USING (true);

-- ❌ Écriture: Interdire la modification directe
DROP POLICY IF EXISTS "No direct author updates" ON "Author";
CREATE POLICY "No direct author updates"
ON "Author" FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct author deletion" ON "Author";
CREATE POLICY "No direct author deletion"
ON "Author" FOR DELETE
USING (false);

-- ============================================================================
-- SECTION 5: Tables de relation utilisateur
-- Note: Toutes ces tables ont "userId" en majuscule
-- ============================================================================

-- ✅ UserBook: Un utilisateur ne peut gérer que sa propre bibliothèque
DROP POLICY IF EXISTS "Users can manage own library" ON "UserBook";
CREATE POLICY "Users can manage own library"
ON "UserBook" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ✅ UserQuote: Un utilisateur ne peut gérer que ses propres citations sauvegardées
DROP POLICY IF EXISTS "Users can manage own saved quotes" ON "UserQuote";
CREATE POLICY "Users can manage own saved quotes"
ON "UserQuote" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ✅ UserAuthor: Un utilisateur ne peut gérer que ses propres auteurs suivis
DROP POLICY IF EXISTS "Users can manage own followed authors" ON "UserAuthor";
CREATE POLICY "Users can manage own followed authors"
ON "UserAuthor" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ✅ Like: Un utilisateur ne peut gérer que ses propres likes
DROP POLICY IF EXISTS "Users can manage own likes" ON "Like";
CREATE POLICY "Users can manage own likes"
ON "Like" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ============================================================================
-- SECTION 6: Table Review (Avis sur les livres)
-- Note: La colonne userId est en majuscule
-- ============================================================================

-- ✅ Lecture: Tout le monde peut voir les avis
DROP POLICY IF EXISTS "Anyone can view reviews" ON "Review";
CREATE POLICY "Anyone can view reviews"
ON "Review" FOR SELECT
USING (true);

-- ✅ Création: Un utilisateur ne peut créer que ses propres avis
DROP POLICY IF EXISTS "Users can create reviews" ON "Review";
CREATE POLICY "Users can create reviews"
ON "Review" FOR INSERT
WITH CHECK (auth.uid() = "userId");

-- ✅ Mise à jour: Un utilisateur ne peut modifier que ses propres avis
DROP POLICY IF EXISTS "Users can update own reviews" ON "Review";
CREATE POLICY "Users can update own reviews"
ON "Review" FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ✅ Suppression: Un utilisateur ne peut supprimer que ses propres avis
DROP POLICY IF EXISTS "Users can delete own reviews" ON "Review";
CREATE POLICY "Users can delete own reviews"
ON "Review" FOR DELETE
USING (auth.uid() = "userId");

-- ============================================================================
-- SECTION 7: Table LiteraryPrize (Prix littéraires - Catalogue public)
-- ============================================================================

-- ✅ Lecture: Tout le monde peut voir les prix littéraires
DROP POLICY IF EXISTS "Anyone can view literary prizes" ON "LiteraryPrize";
CREATE POLICY "Anyone can view literary prizes"
ON "LiteraryPrize" FOR SELECT
USING (true);

-- ============================================================================
-- SECTION 8: Table Laureate (Lauréats)
-- ============================================================================

-- ✅ Lecture: Tout le monde peut voir les lauréats
DROP POLICY IF EXISTS "Anyone can view laureates" ON "Laureate";
CREATE POLICY "Anyone can view laureates"
ON "Laureate" FOR SELECT
USING (true);

-- ============================================================================
-- SECTION 9: Table Edition (Éditions)
-- ============================================================================

-- ✅ Lecture: Tout le monde peut voir les éditions
DROP POLICY IF EXISTS "Anyone can view editions" ON "Edition";
CREATE POLICY "Anyone can view editions"
ON "Edition" FOR SELECT
USING (true);

-- ============================================================================
-- SECTION 10: Activation de RLS sur toutes les tables
-- ============================================================================

ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Author" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserQuote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAuthor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Like" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiteraryPrize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Laureate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Edition" ENABLE ROW LEVEL SECURITY;
