-- SECTION 4: Index Full-Text Search (GIN) pour la recherche (PRIORITÉ HAUTE)
-- ============================================================================

-- Recherche full-text dans le texte des citations (français)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_text_fts 
  ON "Quote" USING GIN (to_tsvector('french', text));

-- Recherche full-text dans les thèmes des citations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_theme_fts 
  ON "Quote" USING GIN (to_tsvector('french', theme));

-- Recherche full-text dans les titres de livres
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_title_fts 
  ON "Book" USING GIN (to_tsvector('french', title));

-- Recherche full-text dans les noms d'auteurs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_author_name_fts 
  ON "Author" USING GIN (to_tsvector('french', name));
=======
-- ============================================================================
-- SECTION 4: Index pour les requêtes fréquentes (PRIORITÉ HAUTE)
-- Ajoutés suite à l'audit Scope 3
-- ============================================================================

-- Index pour Review (requêtes par livre - utilisé dans reviews/index.ts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_bookid ON "Review"("bookId");

-- Index pour UserBlock (blocages - utilisé dans moderation/index.ts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userblock_blockerid ON "UserBlock"("blockerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userblock_blockedid ON "UserBlock"("blockedId");

-- Index pour Report (signalements - utilisé dans moderation/index.ts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_reporterid ON "Report"("reporterId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_reviewid ON "Report"("reviewId");

-- Index pour UserBook (filtre par status - utilisé dans les requêtes de bibliothèque)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userbook_userid_status ON "UserBook"("userId", status);

-- Index pour Like et UserQuote (requêtes par utilisateur)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_like_userid ON "Like"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userquote_userid ON "UserQuote"("userId");

-- ============================================================================
-- SECTION 5: Index Full-Text Search (GIN) pour la recherche (PRIORITÉ HAUTE)
-- ============================================================================

-- Recherche full-text dans le texte des citations (français)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_text_fts 
  ON "Quote" USING GIN (to_tsvector('french', text));

-- Recherche full-text dans les thèmes des citations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_theme_fts 
  ON "Quote" USING GIN (to_tsvector('french', theme));

-- Recherche full-text dans les titres de livres
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_title_fts 
  ON "Book" USING GIN (to_tsvector('french', title));

-- Recherche full-text dans les noms d'auteurs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_author_name_fts 
  ON "Author" USING GIN (to_tsvector('french', name));============================================================================
-- MIGRATION: Créer les index manquants pour optimiser les performances
-- Date: 2026-06-09
-- Généré par: Audit Mistral Vibe (Scope 3)
-- Description: Ajout de 30+ index pour résoudre les problèmes de performance
--              identifiés dans l'audit (N+1 queries, recherches lentes)
-- ============================================================================

-- ⚠️  IMPORTANT: Exécuter avec CREATE INDEX CONCURRENTLY pour éviter de bloquer les écritures
--     Cette commande peut prendre quelques minutes par index sur les grandes tables

-- ============================================================================
-- SECTION 1: Index B-tree pour les relations principales (PRIORITÉ CRITIQUE)
-- ============================================================================

-- Index pour la table Quote (utilisés dans TOUTES les requêtes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_userid ON "Quote"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_authorid ON "Quote"("authorId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_bookid ON "Quote"("bookId");

-- Index pour la table Book
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_authorid ON "Book"("authorId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_inventaireuri ON "Book"("inventaireUri");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_googleid ON "Book"("googleId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_openlibraryid ON "Book"("openLibraryId");

-- Index pour la table Profile (recherche par username)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_username ON "Profile"(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_id ON "Profile"(id);

-- ============================================================================
-- SECTION 2: Index pour les tables de jointure (PRIORITÉ CRITIQUE)
-- ============================================================================

-- UserBook: Relation utilisateur-livre
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userbook_userid_bookid ON "UserBook"("userId", "bookId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userbook_bookid ON "UserBook"("bookId");

-- UserQuote: Relation utilisateur-citation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userquote_userid_quoteid ON "UserQuote"("userId", "quoteId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userquote_quoteid ON "UserQuote"("quoteId");

-- Like: Relation utilisateur-like
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_like_userid_quoteid ON "Like"("userId", "quoteId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_like_quoteid ON "Like"("quoteId");

-- UserAuthor: Relation utilisateur-auteur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userauthor_userid_authorid ON "UserAuthor"("userId", "authorId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userauthor_authorid ON "UserAuthor"("authorId");

-- Edition: Relation livre-édition
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edition_bookid ON "Edition"("bookId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edition_isbn ON "Edition"(isbn);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edition_inventaireuri ON "Edition"("inventaireUri");

-- Laureate: Relation livre-prix littéraire
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laureate_bookid ON "Laureate"("bookId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laureate_prizeid ON "Laureate"("prizeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laureate_authorid ON "Laureate"("authorId");

-- ============================================================================
-- SECTION 3: Index pour les requêtes de tri fréquentes (PRIORITÉ MOYENNE)
-- ============================================================================

-- Tri des citations par date (descendant)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_date ON "Quote"("date" DESC);

-- Tri des livres par note (descendant)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_rating ON "Book"(rating DESC);

-- Tri des livres par année (descendant)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_year ON "Book"(year DESC);

-- ============================================================================
-- SECTION 4: Index Full-Text Search (GIN) pour la recherche (PRIORITÉ HAUTE)
-- ============================================================================

-- Recherche full-text dans le texte des citations (français)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_text_fts 
  ON "Quote" USING GIN (to_tsvector('french', text));

-- Recherche full-text dans les thèmes des citations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_theme_fts 
  ON "Quote" USING GIN (to_tsvector('french', theme));

-- Recherche full-text dans les titres de livres
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_title_fts 
  ON "Book" USING GIN (to_tsvector('french', title));

-- Recherche full-text dans les noms d'auteurs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_author_name_fts 
  ON "Author" USING GIN (to_tsvector('french', name));

-- ============================================================================
-- SECTION 5: Vérification des index créés
-- ============================================================================

-- Exécuter cette requête après la migration pour vérifier que tous les index existent:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
--   AND indexname LIKE 'idx_%'
-- ORDER BY indexname;

-- ============================================================================
-- SECTION 6: Statistiques d'utilisation (optionnel)
-- ============================================================================

-- Pour voir quels index sont réellement utilisés:
-- SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;

-- Pour voir les index jamais utilisés (à supprimer éventuellement):
-- SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;

-- ============================================================================
-- NOTES:
-- ============================================================================

-- 1. Les index GIN (full-text) nécessitent l'extension pg_trgm ou sont basés
--    sur to_tsvector qui est natif dans PostgreSQL.

-- 2. Pour les recherches ILIKE (case-insensitive), vous pouvez aussi créer:
--    CREATE EXTENSION IF NOT EXISTS pg_trgm;
--    CREATE INDEX idx_quote_text_trgm ON "Quote" USING gin (text gin_trgm_ops);

-- 3. Les index CONCURRENTLY ne bloquent pas les écritures mais peuvent échouer
--    si des modifications de structure sont faites simultanément.

-- 4. Temps estimé: 1-5 minutes par index sur les grandes tables (>100k lignes)

-- 5. Espace disque: ~10-30% de la taille des tables indexées

-- ============================================================================
-- Généré par Mistral Vibe - Co-Authored-By: Mistral Vibe <vibe@mistral.ai>
-- ============================================================================
