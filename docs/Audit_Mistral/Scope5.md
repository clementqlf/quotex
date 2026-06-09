# Audit Scope 5 : Sécurité & Conformité (UGC - App Store Guidelines)

Cet audit évalue l'architecture de la fonctionnalité d'avis selon les directives strictes de l'App Store pour les applications sociales (UGC) et les meilleures pratiques de sécurité.

## 1. Intégrité métier : Règle "1 avis / utilisateur / ouvrage"

* **Composant concerné :** `20260609_create_review_unique_constraint.sql`
* **Risque identifié :** Aucun.
* **Impact :** N/A
* **Statut :** **Conforme et sécurisé**. 
* **Preuve technique :** La règle est strictement forcée au niveau de la base de données via la contrainte `ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_bookId_key" UNIQUE ("userId", "bookId");`. Il est techniquement impossible pour un utilisateur d'insérer un doublon pour un même livre, même en effectuant des requêtes directes à l'API Supabase pour contourner l'UI.

## 2. Authentification : Protection contre l'usurpation d'identité

* **Composant concerné :** `supabase/functions/reviews/index.ts` & `20260609_create_rls_policies.sql`
* **Risque identifié :** Aucun.
* **Impact :** N/A
* **Statut :** **Conforme et sécurisé**.
* **Preuve technique :** Les flux (Edge Functions) valident l'identité via le token JWT backend (`requireAuth(req)`) et vérifient la propriété avant toute altération. Par exemple, pour les routes `PUT` et `DELETE` : `if (review[0].userId !== authUser.id) return error('Unauthorized', 403)`. De plus, les politiques RLS blindent la base avec `WITH CHECK (auth.uid() = "userId")`, empêchant l'usurpation même en cas d'attaque directe via l'API PostgREST exposée par Supabase.

---

## 3. Filtrage du contenu abusif (Contournement de la modération)

* **Composant/Fonction concerné :** `supabase/functions/reviews/index.ts` (Méthodes `POST` et `PUT` /reviews)
* **Risque identifié :** Contournement de règle. Le filtrage des mots interdits est délégué uniquement au client (qui récupère la liste via `GET /moderation/forbidden-words`). 
* **Impact :** Rejet App Store / Distribution de contenu abusif. Les guidelines Apple exigent un mécanisme robuste pour empêcher la publication de matériel répréhensible. Actuellement, un attaquant ou un utilisateur averti peut intercepter la requête réseau et envoyer un `POST` direct à l'API pour injecter des insultes dans le champ `comment`, car le backend insère les données brutes (`VALUES (${rating}, ${comment ?? null}...`) sans validation.
* **Correction recommandée :** 
Intégrer la validation des mots interdits directement dans l'Edge Function avant l'insertion en base de données.
```typescript
// À ajouter dans POST /reviews et PUT /reviews/:id
const forbidden = await sql`SELECT word FROM "ForbiddenWord"`;
const hasForbiddenWord = forbidden.some(fw => 
  comment && comment.toLowerCase().includes(fw.word.toLowerCase())
);
if (hasForbiddenWord) return error('Le contenu contient des termes non autorisés.', 400);
```

## 4. Masquage du contenu signalé et utilisateurs bloqués (UGC)

* **Composant/Fonction concerné :** `supabase/functions/reviews/index.ts` (Méthode `GET /reviews?bookId=...`)
* **Risque identifié :** Non-conformité UGC. Le masquage des avis signalés et des utilisateurs bloqués repose entièrement sur le client (via le endpoint de synchronisation `/moderation/sync`). 
* **Impact :** Rejet App Store. Apple exige un mécanisme de masquage immédiat et fiable pour l'utilisateur effectuant le signalement. Si le filtrage UI échoue, est contourné, ou prend du temps à se synchroniser, le backend continuera de distribuer le contenu abusif à l'utilisateur qui l'a expressément bloqué. C'est une cause majeure et fréquente de rejet lors de la review Apple.
* **Correction recommandée :** 
Adapter le endpoint `GET` pour accepter et utiliser le token d'authentification s'il est présent, afin de filtrer le contenu toxique directement à la source en SQL :
```typescript
// Récupérer l'utilisateur de manière optionnelle sur le GET
const authUser = await getOptionalAuth(req); // À implémenter dans _shared/auth.ts

// Modifier la requête SQL si l'utilisateur est connecté
const reviews = await sql`
  SELECT r.*, row_to_json(u) as user, row_to_json(b) as book
  FROM "Review" r
  LEFT JOIN "Profile" u ON u.id = r."userId"
  LEFT JOIN "Book" b ON b.id = r."bookId"
  WHERE r."bookId" = ${bookId}
  ${authUser ? sql`
    AND r."userId" NOT IN (SELECT "blockedId" FROM "UserBlock" WHERE "blockerId" = ${authUser.id})
    AND r.id NOT IN (SELECT "reviewId" FROM "Report" WHERE "reporterId" = ${authUser.id})
  ` : sql``}
  ORDER BY r."createdAt" DESC
`;
```
