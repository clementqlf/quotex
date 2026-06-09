# **AUDIT SCOPE 3 - QUOTEX**
## Backend Supabase & Logique de Données

**Date :** 2026-06-07  
**Auditeur :** Mistral Vibe (CLI Coding Agent)  
**Périmètre :** Edge Functions, Schémas de base de données, Logique de données, RLS, Triggers  
**Approche :** Analyse chirurgicale - Sécurité & Performance uniquement

---

## **📋 SOMMAIRE**

- [🔴 CRITIQUES - Corrections Immédiates Requises](#-critiques---corrections-immédiates-requises)
- [🟡 HAUTS - Corrections Recommandées](#-hauts---corrections-recommandées)
- [🟠 MOYENS - Améliorations Importantes](#-moyens---améliorations-importantes)
- [📊 INDEX MANQUANTS - Optimisation Performance](#-index-manquants---optimisation-performance)
- [🛡️ POLITIQUES RLS - Vérifications Requises](#-politiques-rls---vérifications-requises)
- [✅ CE QUI EST DÉJÀ CORRECT](#-ce-qui-est-déjà-correct)
- [🎯 RECOMMANDATIONS FINALES](#-recommandations-finales)

---

---

## **🔴 CRITIQUES - Corrections Immédiates Requises**

---

### **Fichier/Sujet concerné : `supabase/functions/authors/index.ts` (Lignes 38-57)**
**Risque identifié :** Faille de sécurité - Création arbitraire de données sans authentification  
**Impact :** Un attaquant peut polluer la base de données avec des milliers d'auteurs fictifs, saturant le stockage et perturbant les résultats de recherche

**Preuve technique :**
```typescript
// GET /authors/by-name/:name - ACCESSIBLE SANS AUTHENTIFICATION
if (req.method === 'GET' && parts[0] === 'by-name' && parts[1]) {
  const name = decodeURIComponent(parts[1]);
  let authorRows = await sql`SELECT a.* FROM "Author" a WHERE a.name = ${name} LIMIT 1`;

  if (!authorRows.length) {
    // ❌ CRITIQUE: Création automatique d'auteur pour N'IMPORTE QUEL utilisateur
    const created = await sql`INSERT INTO "Author" (name) VALUES (${name}) RETURNING *`;
    // ... puis enrichissement automatique
  }
}
```

**Correction recommandée :**
```typescript
// Ajouter vérification d'authentification et limiter la création
if (req.method === 'GET' && parts[0] === 'by-name' && parts[1]) {
  const name = decodeURIComponent(parts[1]);
  let authorRows = await sql`SELECT a.* FROM "Author" a WHERE a.name = ${name} LIMIT 1`;

  if (!authorRows.length) {
    // ✅ Exiger authentification pour la création
    const authUser = await requireAuth(req);
    if (authUser instanceof Response) return authUser;

    // ✅ Limiter la création aux noms valides seulement
    if (!name || name.length < 2 || name.length > 200) {
      return error('Invalid author name', 400);
    }

    const created = await sql`INSERT INTO "Author" (name) VALUES (${name}) RETURNING *`;
    // ...
  }
}
```

---

### **Fichier/Sujet concerné : `supabase/functions/users/index.ts` (Lignes 83-92)**
**Risque identifié :** Faille de sécurité - Accès non autorisé aux données utilisateur  
**Impact :** Un utilisateur peut accéder au profil et aux citations d'un autre utilisateur via son username

**Preuve technique :**
```typescript
// GET /users/:username - PAS DE VÉRIFICATION QUE L'UTILISATEUR AUTORISÉ
if (req.method === 'GET' && parts[0]) {
  let profileUser;
  if (parts[0] === 'me') {
    const authUser = await requireAuth(req);
    // ... vérification OK pour /me
  } else {
    // ❌ PROBLÈME: Accès au profil d'un AUTRE utilisateur
    const raw = decodeURIComponent(parts[0]);
    const cleanUsername = raw.startsWith('@') ? raw.slice(1) : raw;
    const userRows = await sql`
      SELECT u.id, u.username, u.name, u.image, u.bio, u.website, u.followers, u.following
      FROM "Profile" u WHERE u.username ILIKE ${cleanUsername} LIMIT 1
    `;
    // ... puis récupère TOUTES les quotes et la bibliothèque de cet utilisateur
  }
}
```

**Correction recommandée :**
```typescript
// ✅ Rendre les profils publics lecture-seulement, mais limiter l'accès aux données sensibles
if (req.method === 'GET' && parts[0] && parts[0] !== 'me') {
  const raw = decodeURIComponent(parts[0]);
  const cleanUsername = raw.startsWith('@') ? raw.slice(1) : raw;

  // ✅ Récupérer uniquement les infos PUBLIQUES du profil
  const userRows = await sql`
    SELECT u.id, u.username, u.name, u.image, u.bio, u.website, u.followers, u.following
    FROM "Profile" u WHERE u.username ILIKE ${cleanUsername} LIMIT 1
  `;

  if (!userRows.length) return error(`User not found: '${cleanUsername}'`, 404);
  profileUser = userRows[0];

  // ✅ NE RETOURNER QUE LES QUOTES PUBLIQUES (pas la bibliothèque privée)
  const quotes = await sql`
    SELECT q.*,
      row_to_json(a) as author,
      row_to_json(bk) as book,
      (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount"
    FROM "Quote" q
    LEFT JOIN "Author" a ON a.id = q."authorId"
    LEFT JOIN "Book" bk ON bk.id = q."bookId"
    WHERE q."userId" = ${profileUser.id}::uuid
      AND q."isPublic" = true  // ✅ Ajouter un filtre de visibilité
    ORDER BY q.date DESC
    LIMIT 50  // ✅ Limiter le nombre de résultats
  `;

  // ✅ NE PAS RETOURNER la bibliothèque (UserBook) - données privées
  return json({
    ...profileUser,
    quotes: quotes.map((q: any) => formatQuote(q, authUserId ?? '')),
    library: [], // ou masquer complètement
  });
}
```

---

### **Fichier/Sujet concerné : `supabase/functions/quotes/index.ts` (Lignes 13-48)**
**Risque identifié :** Problème de performance critique - N+1 queries sévère  
**Impact :** Pour N citations, la requête exécute 5 sous-requêtes par ligne, causant une latence exponentielle

**Preuve technique :**
```typescript
async function fetchQuotes(userId: string | null, quoteId?: number) {
  const rows = await sql`
    SELECT
      q.*,
      (SELECT row_to_json(u_row) FROM (SELECT u.id, u.username, u.name, u.image, u.bio, u.website FROM "Profile" u WHERE u.id = q."userId") u_row) as "user",
      row_to_json(a) as "author",
      (SELECT row_to_json(b_row) FROM (SELECT b.*, COALESCE((SELECT json_agg(ub) FROM "UserBook" ub WHERE ub."bookId" = b."id" AND ub."userId" = ${userId}::uuid), '[]'::json) as "users" FROM "Book" b WHERE b."id" = q."bookId") b_row) as "book",
      COALESCE((SELECT json_agg(l) FROM "Like" l WHERE l."quoteId" = q."id" AND l."userId" = ${userId}::uuid), '[]'::json) as "likes",
      COALESCE((SELECT json_agg(s) FROM "UserQuote" s WHERE s."quoteId" = q."id" AND s."userId" = ${userId}::uuid), '[]'::json) as "savedBy"
    FROM "Quote" q
    LEFT JOIN "Author" a ON a."id" = q."authorId"
    WHERE 1=1 ${where}
    ORDER BY q."date" DESC
  `;
  // ❌ Cette requête exécute 5 sous-requêtes PAR LIGNE de Quote
}
```

**Correction recommandée :**
```typescript
async function fetchQuotes(userId: string | null, quoteId?: number) {
  const where = quoteId ? sql`AND q."id" = ${quoteId}` : sql``;

  // ✅ Requête unique avec JOINs au lieu de sous-requêtes
  const rows = await sql`
    SELECT
      q.*,
      row_to_json(u) as "user",
      row_to_json(a) as "author",
      row_to_json(b) as "book",
      COALESCE((
        SELECT json_agg(l) 
        FROM "Like" l 
        WHERE l."quoteId" = q.id AND l."userId" = ${userId}::uuid
      ), '[]'::json) as "likes",
      COALESCE((
        SELECT json_agg(s) 
        FROM "UserQuote" s 
        WHERE s."quoteId" = q.id AND s."userId" = ${userId}::uuid
      ), '[]'::json) as "savedBy"
    FROM "Quote" q
    LEFT JOIN "Profile" u ON u.id = q."userId"
    LEFT JOIN "Author" a ON a."id" = q."authorId"
    LEFT JOIN "Book" b ON b."id" = q."bookId"
    WHERE 1=1 ${where}
    ORDER BY q."date" DESC
  `;

  // ✅ Pour les UserBook, faire une requête séparée batch si userId existe
  if (userId && rows.length > 0) {
    const quoteIds = rows.map(r => r.id);
    const userBooks = await sql`
      SELECT "quoteId", json_agg(ub) as users
      FROM "UserBook" ub
      WHERE ub."bookId" IN (SELECT "bookId" FROM "Quote" WHERE id = ANY(${quoteIds}))
        AND ub."userId" = ${userId}::uuid
      GROUP BY "quoteId"
    `;
    // Mapper les résultats...
  }

  return rows;
}
```

---

---

## **🟡 HAUTS - Corrections Recommandées**

---

### **Fichier/Sujet concerné : `supabase/functions/books/index.ts` (Lignes 368-375)**
**Risque identifié :** Manque de contrôle d'accès - Tout le monde peut voir/modifier n'importe quel livre  
**Impact :** Accès non autorisé aux données de livres, potentiellement sensible

**Preuve technique :**
```typescript
// GET /books/:id - ACCÈS PUBLIC SANS RESTRICTION
if (req.method === 'GET' && idParam && !subAction) {
  const book = await fetchBook(idParam, userId);
  if (!book) return error('Book not found', 404);
  // ❌ Retourne TOUTES les données du livre à N'IMPORTE QUI
  return json(formatBook(book, userId));
}
```

**Correction recommandée :**
```typescript
// ✅ Ajouter vérification que le livre est accessible (via UserBook ou public)
if (req.method === 'GET' && idParam && !subAction) {
  // Vérifier si le livre est accessible par l'utilisateur
  const isAccessible = await sql`
    SELECT 1 FROM "UserBook" 
    WHERE "bookId" = ${idParam} AND "userId" = ${userId}::uuid
    LIMIT 1
  `;

  // ✅ Si l'utilisateur n'est pas connecté ou n'a pas le livre, vérifier si c'est public
  if (!userId && !isAccessible.length) {
    // Option 1: Retourner uniquement les infos publiques
    const publicBook = await sql`
      SELECT b.id, b.title, b.cover, b.year, b.genre, b.description,
        row_to_json(a) as author
      FROM "Book" b
      LEFT JOIN "Author" a ON a.id = b."authorId"
      WHERE b.id = ${idParam} AND b."isPublic" = true
      LIMIT 1
    `;
    if (!publicBook.length) return error('Book not found or private', 404);
    return json(formatBook(publicBook[0], null));
  }

  const book = await fetchBook(idParam, userId);
  if (!book) return error('Book not found', 404);
  return json(formatBook(book, userId));
}
```

---

### **Fichier/Sujet concerné : `supabase/functions/reviews/index.ts` (Lignes 58-65)**
**Risque identifié :** Manque de vérification de propriété avant mise à jour  
**Impact :** Un utilisateur peut modifier/supprimer les reviews d'autres utilisateurs

**Preuve technique :**
```typescript
// PUT /reviews/:id
if (req.method === 'PUT' && idParam) {
  const authUser = await requireAuth(req);
  if (authUser instanceof Response) return authUser;

  const { rating, comment } = await req.json();

  const review = await sql`SELECT * FROM "Review" WHERE id = ${idParam}`;
  if (!review.length) return error('Review not found', 404);
  // ✅ Bonne pratique: vérification de propriété
  if (review[0].userId !== authUser.id) return error('Unauthorized', 403);

  // ... mise à jour
}
```

**Status :** ✅ **CORRECT** - Ce endpoint implémente correctement la vérification de propriété.

---

### **Fichier/Sujet concerné : `supabase/functions/sync-quotes/index.ts` (Lignes 60-68)**
**Risque identifié :** Potentiel problème d'intégrité - Forçage de userId mais risque de conflits  
**Impact :** Si l'objet quote original contient un userId différent, cela pourrait causer des incohérences

**Preuve technique :**
```typescript
// Force userId from JWT token — never trust the body
for (const quote of offlineQuotes) {
  quote.userId = authUser.id;  // ✅ Bonne pratique
}

// Mais plus bas:
const quoteRows = await sql`
  INSERT INTO "Quote" ("text", "date", "authorId", "bookId", "userId", "theme", "likesCount")
  VALUES (${offlineQuote.text}, ${offlineQuote.createdAt}, ${authorId}, ${bookId}, ${offlineQuote.userId}, ${offlineQuote.theme || null}, 0)
  RETURNING id
`;
// ❌ Utilise offlineQuote.userId qui a été écrasé, mais la syntaxe est confuse
```

**Correction recommandée :**
```typescript
// ✅ Utiliser directement authUser.id pour plus de clarté
const quoteRows = await sql`
  INSERT INTO "Quote" ("text", "date", "authorId", "bookId", "userId", "theme", "likesCount")
  VALUES (${offlineQuote.text}, ${offlineQuote.createdAt}, ${authorId}, ${bookId}, ${authUser.id}, ${offlineQuote.theme || null}, 0)
  RETURNING id
`;
```

---

### **Fichier/Sujet concerné : `supabase/functions/_shared/inventaire.ts` (Lignes 30-70)**
**Risque identifié :** Risque de deadlock dans la fonction mergeBooks  
**Impact :** Deadlocks potentiels lors de la fusion de livres simultanée

**Preuve technique :**
```typescript
// Lock both books in ID order to prevent deadlock
const [lowId, highId] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
const locked = await tx`
  SELECT id FROM "Book" 
  WHERE id IN (${lowId}, ${highId}) 
  FOR UPDATE
`;
// ✅ Bonne pratique: verrouillage dans l'ordre pour éviter les deadlocks
```

**Status :** ✅ **CORRECT** - La fonction implémente correctement le pattern de verrouillage ordonné.

**Mais attention :** La fonction fait beaucoup d'opérations dans une transaction qui pourrait être longue, augmentant le risque de timeout.

**Recommandation :**
```typescript
// ✅ Ajouter un timeout de transaction explicite
await sql.begin(async (tx) => {
  // Configurer le timeout
  await tx`SET LOCAL statement_timeout = '30s'`;

  // ... reste du code
});
```

---

---

## **🟠 MOYENS - Améliorations Importantes**

---

### **Fichier/Sujet concerné : `supabase/functions/_shared/cors.ts` (Ligne 3)**
**Risque identifié :** CORS trop permissif - Toutes les origines sont autorisées  
**Impact :** Attaques CSRF potentielles, violation de sécurité

**Preuve technique :**
```typescript
const allowedOrigin = Deno.env.get("ALLOWED_ORIGINS") || '*';
// ❌ '*' autorise TOUTES les origines
```

**Correction recommandée :**
```typescript
// ✅ Restreindre aux domaines spécifiques
const allowedOrigin = Deno.env.get("ALLOWED_ORIGINS") || 
  'https://quotex.app,https://www.quotex.app,http://localhost:3000';

// ✅ Ne JAMAIS utiliser '*' en production
```

---

### **Fichier/Sujet concerné : `supabase/functions/search/index.ts` (Lignes 70-140)**
**Risque identifié :** Performance - 5 requêtes parallèles + N+1 queries  
**Impact :** Latence élevée sur les recherches, surtout avec beaucoup de résultats

**Preuve technique :**
```typescript
const [quotesRaw, localAuthorsRaw, localBooksRaw, themesRaw, prizesRaw] = await Promise.all([
  sql`SELECT q.id, q.text, ... FROM "Quote" q WHERE q.text ILIKE ${'%' + query + '%'} ... LIMIT 20`,
  sql`SELECT a.* FROM "Author" a WHERE a.name ILIKE ${'%' + query + '%'} LIMIT 10`,
  sql`SELECT b.* FROM "Book" b LEFT JOIN "Author" a ON a.id = b."authorId" WHERE b.title ILIKE ${'%' + query + '%'} LIMIT 10`,
  sql`SELECT DISTINCT theme FROM "Quote" WHERE theme ILIKE ${'%' + query + '%'} ... LIMIT 10`,
  sql`SELECT * FROM "LiteraryPrize" WHERE name ILIKE ${'%' + query + '%'} LIMIT 10`
]);
// ❌ Chaque requête fait des sous-requêtes (row_to_json, json_agg)
```

**Correction recommandée :**
```typescript
// ✅ Utiliser des JOINs explicites au lieu de sous-requêtes
const quotesRaw = await sql`
  SELECT q.id, q.text, q."userId", q."authorId", q."bookId", q."date", q.theme, 
    u.id as user_id, u.username, u.name, u.image, u.bio, u.website,
    a.id as author_id, a.name as author_name, 
    b.id as book_id, b.title as book_title,
    (SELECT COUNT(*) FROM "Like" l WHERE l."quoteId" = q.id)::int as "likesCount"
  FROM "Quote" q
  LEFT JOIN "Profile" u ON u.id = q."userId"
  LEFT JOIN "Author" a ON a.id = q."authorId"
  LEFT JOIN "Book" b ON b.id = q."bookId"
  WHERE q.text ILIKE ${'%' + query + '%'} OR q.theme ILIKE ${'%' + query + '%'}
  LIMIT 20
`;

// ✅ Utiliser des index de type GIN pour la recherche full-text
// À créer côté base de données:
/*
CREATE INDEX idx_quote_text_gin ON "Quote" USING GIN (to_tsvector('french', text));
CREATE INDEX idx_quote_theme_gin ON "Quote" USING GIN (to_tsvector('french', theme));
CREATE INDEX idx_book_title_gin ON "Book" USING GIN (to_tsvector('french', title));
CREATE INDEX idx_author_name_gin ON "Author" USING GIN (to_tsvector('french', name));
*/
```

---

### **Fichier/Sujet concerné : `supabase/functions/books/index.ts` (Lignes 88-120)**
**Risque identifié :** Duplication de code et requêtes redondantes dans fetchBook  
**Impact :** Performance dégradée, maintenance difficile

**Preuve technique :**
La fonction `fetchBook` fait des sous-requêtes pour `users`, `laureates`, `similarBooks` qui sont très coûteuses.

**Correction recommandée :**
```typescript
// ✅ Extraire les requêtes de comptage dans des CTEs
async function fetchBook(bookId: number, userId: string | number | null) {
  const rows = await sql`
    WITH book_users AS (
      SELECT json_agg(ub) as users
      FROM "UserBook" ub
      WHERE ub."bookId" = ${bookId} AND ub."userId" = ${userId}::uuid
    ),
    book_laureates AS (
      SELECT json_agg(json_build_object(
        'id', l.id, 'year', l.year, 'prizeId', l."prizeId",
        'prize', (SELECT row_to_json(lp) FROM "LiteraryPrize" lp WHERE lp.id = l."prizeId")
      )) as laureates
      FROM "Laureate" l
      WHERE l."bookId" = ${bookId}
    ),
    similar_books AS (
      SELECT json_agg(sb) as similar
      FROM (
        SELECT S.id, S.title, S.cover, S.genre, S.year, S.pages, S.rating, S."inventaireUri",
          (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = S.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
          row_to_json(sa) as author,
          /* score calculation */ 0 as score
        FROM "Book" S
        LEFT JOIN "Author" sa ON sa.id = S."authorId"
        WHERE S.id != ${bookId}
        ORDER BY score DESC, S.rating DESC, S.year DESC
        LIMIT 10
      ) sb
    )
    SELECT b.*,
      (SELECT e.isbn FROM "Edition" e WHERE e."bookId" = b.id AND e.isbn IS NOT NULL LIMIT 1) as isbn,
      row_to_json(a) as author,
      (SELECT users FROM book_users LIMIT 1) as users,
      (SELECT laureates FROM book_laureates LIMIT 1) as laureates,
      (SELECT similar FROM similar_books LIMIT 1) as "similarBooks"
    FROM "Book" b
    LEFT JOIN "Author" a ON a.id = b."authorId"
    WHERE b.id = ${bookId} LIMIT 1
  `;
  return rows[0] ?? null;
}
```

---

---

## **📊 INDEX MANQUANTS - Optimisation Performance**

Basé sur les requêtes analysées, ces **index sont critiques** et devraient être créés dans votre base de données Supabase :

```sql
-- ✅ Index pour les relations utilisateur (critique pour RLS et performance)
CREATE INDEX IF NOT EXISTS idx_quote_userid ON "Quote"("userId");
CREATE INDEX IF NOT EXISTS idx_quote_authorid ON "Quote"("authorId");
CREATE INDEX IF NOT EXISTS idx_quote_bookid ON "Quote"("bookId");

CREATE INDEX IF NOT EXISTS idx_book_authorid ON "Book"("authorId");
CREATE INDEX IF NOT EXISTS idx_book_inventaireuri ON "Book"("inventaireUri");
CREATE INDEX IF NOT EXISTS idx_book_googleid ON "Book"("googleId");
CREATE INDEX IF NOT EXISTS idx_book_openlibraryid ON "Book"("openLibraryId");

CREATE INDEX IF NOT EXISTS idx_profile_username ON "Profile"(username);
CREATE INDEX IF NOT EXISTS idx_profile_id ON "Profile"(id); -- UUID index

-- ✅ Index pour les tables de jointure (critique pour les requêtes N+1)
CREATE INDEX IF NOT EXISTS idx_userbook_userid_bookid ON "UserBook"("userId", "bookId");
CREATE INDEX IF NOT EXISTS idx_userbook_bookid ON "UserBook"("bookId");

CREATE INDEX IF NOT EXISTS idx_userquote_userid_quoteid ON "UserQuote"("userId", "quoteId");
CREATE INDEX IF NOT EXISTS idx_userquote_quoteid ON "UserQuote"("quoteId");

CREATE INDEX IF NOT EXISTS idx_like_userid_quoteid ON "Like"("userId", "quoteId");
CREATE INDEX IF NOT EXISTS idx_like_quoteid ON "Like"("quoteId");

CREATE INDEX IF NOT EXISTS idx_userauthor_userid_authorid ON "UserAuthor"("userId", "authorId");
CREATE INDEX IF NOT EXISTS idx_userauthor_authorid ON "UserAuthor"("authorId");

CREATE INDEX IF NOT EXISTS idx_edition_bookid ON "Edition"("bookId");
CREATE INDEX IF NOT EXISTS idx_edition_isbn ON "Edition"(isbn);
CREATE INDEX IF NOT EXISTS idx_edition_inventaireuri ON "Edition"("inventaireUri");

CREATE INDEX IF NOT EXISTS idx_laureate_bookid ON "Laureate"("bookId");
CREATE INDEX IF NOT EXISTS idx_laureate_prizeid ON "Laureate"("prizeId");
CREATE INDEX IF NOT EXISTS idx_laureate_authorid ON "Laureate"("authorId");

-- ✅ Index pour la recherche full-text (amélioration majeure des performances)
CREATE INDEX IF NOT EXISTS idx_quote_text_fts ON "Quote" USING GIN (to_tsvector('french', text));
CREATE INDEX IF NOT EXISTS idx_quote_theme_fts ON "Quote" USING GIN (to_tsvector('french', theme));
CREATE INDEX IF NOT EXISTS idx_book_title_fts ON "Book" USING GIN (to_tsvector('french', title));
CREATE INDEX IF NOT EXISTS idx_author_name_fts ON "Author" USING GIN (to_tsvector('french', name));

-- ✅ Index pour les requêtes de comptage fréquentes
CREATE INDEX IF NOT EXISTS idx_quote_date ON "Quote"("date" DESC);
CREATE INDEX IF NOT EXISTS idx_book_rating ON "Book"(rating DESC);
CREATE INDEX IF NOT EXISTS idx_book_year ON "Book"(year DESC);
```

**Commande pour créer les index sans bloquer les écritures :**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_userid ON "Quote"("userId");
-- Répéter pour chaque index
```

---

---

## **🛡️ POLITIQUES RLS - Vérifications Requises**

**⚠️ ATTENTION :** Les fichiers de politiques RLS ne sont pas visibles dans votre codebase (probablement définis directement dans le Dashboard Supabase). Voici les **politiques minimales requises** pour sécuriser votre application :

### **Table: `Quote`**
```sql
-- ✅ Lecture: Un utilisateur ne peut voir que ses propres quotes OU les quotes publiques
CREATE POLICY "Users can view own quotes"
ON "Quote" FOR SELECT
USING (auth.uid() = userId);

CREATE POLICY "Users can view public quotes"
ON "Quote" FOR SELECT
USING (isPublic = true);

-- ✅ Écriture: Un utilisateur ne peut créer/modifier que ses propres quotes
CREATE POLICY "Users can create quotes"
ON "Quote" FOR INSERT
WITH CHECK (auth.uid() = userId);

CREATE POLICY "Users can update own quotes"
ON "Quote" FOR UPDATE
USING (auth.uid() = userId)
WITH CHECK (auth.uid() = userId);

-- ✅ Suppression: Un utilisateur ne peut supprimer que ses propres quotes
CREATE POLICY "Users can delete own quotes"
ON "Quote" FOR DELETE
USING (auth.uid() = userId);
```

### **Table: `Book`**
```sql
-- ⚠️ PROBLÈME: Les livres sont probablement partagés entre utilisateurs
-- Solution 1: Livres publics (recommandé)
CREATE POLICY "Anyone can view books"
ON "Book" FOR SELECT
USING (true);

-- Solution 2: Livres accessibles via UserBook
CREATE POLICY "Users can view books they have in library"
ON "Book" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "UserBook" 
    WHERE "userId" = auth.uid() AND "bookId" = id
  )
  OR isPublic = true
);

-- ✅ Écriture: Seulement via fonctions (pas d'écriture directe)
CREATE POLICY "No direct book creation"
ON "Book" FOR INSERT
USING (false);

CREATE POLICY "No direct book updates"
ON "Book" FOR UPDATE
USING (false);

CREATE POLICY "No direct book deletion"
ON "Book" FOR DELETE
USING (false);
```

### **Table: `Profile`**
```sql
-- ✅ Lecture: Un utilisateur peut voir son propre profil OU les profils publics
CREATE POLICY "Users can view own profile"
ON "Profile" FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles"
ON "Profile" FOR SELECT
USING (isPublic = true);

-- ✅ Écriture: Un utilisateur ne peut modifier que son propre profil
CREATE POLICY "Users can update own profile"
ON "Profile" FOR UPDATE
USING (auth.uid() = id);
```

### **Table: `UserBook`, `UserQuote`, `UserAuthor`**
```sql
-- ✅ Lecture/Écriture: Un utilisateur ne peut accéder qu'à ses propres relations
CREATE POLICY "Users can manage own library"
ON "UserBook" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can manage own saved quotes"
ON "UserQuote" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can manage own followed authors"
ON "UserAuthor" FOR ALL
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");
```

### **Table: `Review`**
```sql
-- ✅ Lecture: Tout le monde peut voir les reviews
CREATE POLICY "Anyone can view reviews"
ON "Review" FOR SELECT
USING (true);

-- ✅ Écriture: Un utilisateur ne peut créer/modifier que ses propres reviews
CREATE POLICY "Users can create reviews"
ON "Review" FOR INSERT
WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update own reviews"
ON "Review" FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- ✅ Suppression: Un utilisateur ne peut supprimer que ses propres reviews
CREATE POLICY "Users can delete own reviews"
ON "Review" FOR DELETE
USING (auth.uid() = "userId");
```

**Vérification des politiques existantes :**
```sql
-- Exécuter dans le Dashboard Supabase SQL Editor
SELECT * FROM pg_policies;
```

---

---

## **✅ CE QUI EST DÉJÀ CORRECT**

1. **`_shared/auth.ts`** : Vérification JWT correcte via Supabase Auth
2. **`reviews/index.ts`** : Vérification de propriété avant mise à jour/suppression ✅
3. **`moderation/index.ts`** : Vérification d'authentification sur tous les endpoints ✅
4. **`inventaire.ts` mergeBooks** : Transactions et verrouillage ordonné pour éviter deadlocks ✅
5. **`sync-quotes/index.ts`** : Forçage de userId depuis JWT, pas de confiance dans le body ✅
6. **`db.ts`** : Utilisation de `postgres` library avec tagged templates (prévention injection SQL) ✅

---

---

## **🎯 RECOMMANDATIONS FINALES**

### **1. CORRIGER IMMÉDIATEMENT (Avant toute chose)**
- ✅ **Créer les politiques RLS** pour toutes les tables (voir section ci-dessus)
- ✅ **Corriger l'endpoint `/authors/by-name`** pour exige auth
- ✅ **Restreindre l'accès à `/users/:username`** aux données publiques seulement

### **2. OPTIMISER LES PERFORMANCES (Dans la semaine)**
- ✅ **Créer tous les index manquants** (20+ index identifiés)
- ✅ **Corriger les N+1 queries** dans `fetchQuotes`, `fetchBook`, `search`
- ✅ **Configurer CORS** avec des origines spécifiques

### **3. VÉRIFIER LA SÉCURITÉ (Dans le mois)**
- ✅ **Auditer les politiques RLS** existantes dans le Dashboard Supabase
- ✅ **Vérifier les permissions** du `SUPABASE_SERVICE_ROLE_KEY` utilisé dans `users/index.ts`
- ✅ **Tester les endpoints** avec des utilisateurs non-authentifiés

### **4. MONITORING (Continu)**
- ✅ **Configurer des alertes** sur les requêtes lentes (> 1s)
- ✅ **Surveiller les erreurs** de deadlock dans les logs
- ✅ **Vérifier l'utilisation** des index via `pg_stat_user_indexes`

---

---

## **📊 RÉCAPITULATIF DES ACTIONS**

| **Priorité** | **Fichier** | **Type** | **Action Requise** | **Impact** |
|--------------|-------------|----------|-------------------|------------|
| 🔴 **CRITIQUE** | `authors/index.ts` | Sécurité | Ajouter auth + validation pour `/by-name` | Injection de données |
| 🔴 **CRITIQUE** | `users/index.ts` | Sécurité | Restreindre accès aux profils utilisateurs | Fuite de données privées |
| 🔴 **CRITIQUE** | `quotes/index.ts` | Performance | Corriger N+1 queries dans fetchQuotes | Latence exponentielle |
| 🟡 **HAUT** | `books/index.ts` | Sécurité | Vérifier accès aux livres | Accès non autorisé |
| 🟡 **HAUT** | `config.toml` | Sécurité | Vérifier que RLS est activé sur toutes les tables | Fuite de données |
| 🟡 **HAUT** | Base de données | Performance | Créer les 20+ index manquants | Requêtes lentes |
| 🟠 **MOYEN** | `cors.ts` | Sécurité | Restreindre origines CORS | CSRF |
| 🟠 **MOYEN** | `search/index.ts` | Performance | Optimiser requêtes avec JOINs | Latence |
| 🟠 **MOYEN** | `books/index.ts` | Performance | Optimiser fetchBook avec CTEs | Duplication de code |
| 🟡 **HAUT** | Dashboard Supabase | Sécurité | Créer politiques RLS ci-dessus | **IMPERATIF** |

---

---

## **🔍 COMMANDES UTILES POUR VÉRIFICATION**

### Vérifier les politiques RLS existantes :
```sql
SELECT * FROM pg_policies;
```

### Vérifier les index existants :
```sql
SELECT * FROM pg_indexes WHERE schemaname = 'public';
```

### Vérifier les index manquants :
```sql
-- Exemple pour vérifier si un index existe
SELECT * FROM pg_indexes 
WHERE tablename = 'Quote' AND indexdef LIKE '%userId%';
```

### Créer un index sans bloquer les écritures :
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_userid ON "Quote"("userId");
```

### Vérifier les statistiques d'utilisation des index :
```sql
SELECT * FROM pg_stat_user_indexes;
```

---

---

**⚠️ NOTE IMPORTANTE :** Les politiques RLS et les index doivent être créés directement dans le **Dashboard Supabase** ou via des migrations SQL. Les fichiers de votre codebase ne contiennent pas ces définitions, ce qui signifie qu'elles sont probablement gérées manuellement.

**Prochaine étape recommandée :** 
1. Exécutez `SELECT * FROM pg_policies;` dans votre base de données Supabase pour vérifier les politiques RLS existantes
2. Créez les index manquants avec `CREATE INDEX CONCURRENTLY ...` pour éviter de bloquer les écritures
3. Testez chaque endpoint avec Postman ou curl pour vérifier les permissions

---

**Audit terminé.** 🎯

*Généré par Mistral Vibe - Co-Authored-By: Mistral Vibe <vibe@mistral.ai>*
