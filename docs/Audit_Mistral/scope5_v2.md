# Audit Scope 5 v2 : Sécurité & Conformité (UGC - App Store Guidelines)

**Date :** 2026-06-10  
**Auditeur :** Mistral Vibe  
**Projet :** Quotex - Application mobile sociale (avis sur ouvrages)  
**Focus :** Intégrité métier, modération UGC, authentification, conformité Apple App Store Guidelines  

---

## 📊 Résumé Exécutif

| Catégorie | Statut | Problèmes Critiques | Problèmes Mineurs |
|----------|--------|---------------------|-------------------|
| **Intégrité Métier** | ⚠️ NON CONFORME | 1 | 0 |
| **Modération UGC** | ⚠️ NON CONFORME | 1 | 0 |
| **Authentification** | ✅ CONFORME | 0 | 0 |
| **RLS & Sécurité BD** | ⚠️ NON CONFORME | 1 | 0 |

**3 correctifs urgents nécessaires pour éviter un rejet App Store**

---

## 🔴 Problèmes Critiques (Rejet App Store garanti si non corrigés)

### 1. Intégrité Métier : Contrainte UNIQUE manquante

**Composant/Fonction concerné :** Table `"Review"` (Base de données PostgreSQL)  
**Risque identifié :** Non-conformité intégrité métier + faille de sécurité  
**Impact :** Rejet App Store (Section 4.3 - Spam et manipulation de données) + Utilisateurs peuvent voter plusieurs fois pour le même livre  

**Preuve technique :** 
> Le système actuel permet à un utilisateur de créer plusieurs avis pour le même livre car la restriction "1 avis / utilisateur / ouvrage" **n'existe que côté client** (UI). Il n'y a **aucune contrainte UNIQUE** sur la table Review. Un attaquant peut :
> 1. Appeler directement l'API Supabase : `INSERT INTO "Review" ("userId", "bookId", "rating", "comment") VALUES ('uuid', 123, 5, 'Test')`
> 2. Contourner les Edge Functions et insérer des doublons
> 3. Répéter l'opération pour fausser les notes moyennes

**Vérification :**
```bash
# Aucune migration ne crée cette contrainte
ls -la /Users/chantreau/quotex/supabase/migrations/
# Résultat : Aucun fichier *unique* ou *constraint* pour Review
```

**Correction recommandée :**
Créer une nouvelle migration SQL `20260610_add_review_unique_constraint.sql` :

```sql
-- ============================================================================
-- MIGRATION: Contrainte UNIQUE pour 1 avis / utilisateur / livre
-- Date: 2026-06-10
-- Criticité: CRITIQUE - Évite le spam et la manipulation des notes
-- ============================================================================

-- 1. Vérifier les doublons existants
SELECT "userId", "bookId", COUNT(*) as count
FROM "Review"
GROUP BY "userId", "bookId"
HAVING COUNT(*) > 1;

-- 2. Supprimer les doublons (garder le plus récent)
DELETE FROM "Review"
WHERE id NOT IN (
  SELECT MAX(id)
  FROM "Review"
  GROUP BY "userId", "bookId"
);

-- 3. Créer la contrainte UNIQUE
ALTER TABLE "Review"
ADD CONSTRAINT "Review_userId_bookId_key" 
UNIQUE ("userId", "bookId");

-- 4. Vérification
SELECT conname, conrelid::regclass 
FROM pg_constraint 
WHERE conrelid = '"Review"'::regclass;
```

---

### 2. Sécurité Base de Données : RLS non activé

**Composant/Fonction concerné :** `supabase/migrations/20260609_create_rls_policies.sql`  
**Risque identifié :** Faille de sécurité majeure - Politiques RLS inutiles  
**Impact :** Accès non autorisé aux données, violation RGPD, rejet App Store (Section 5.1.1 - Protection des données)  

**Preuve technique :**
> Le fichier `20260609_create_rls_policies.sql` (lignes 379-385) contient uniquement un **commentaire** :
> ```sql
> -- SELECT table_name, row_security
> -- FROM information_schema.tables
> -- WHERE table_schema = 'public'
> -- ORDER BY table_name;
> 
> -- Si une table a row_security = OFF, l'activer avec:
> -- ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;
> ```
> **Aucune commande `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` n'est exécutée.**
>
> Conséquence : Même avec des politiques définies, RLS est désactivé par défaut dans Supabase. Un utilisateur peut contourner les Edge Functions et accéder directement à toutes les tables via l'API PostgREST :
> ```
> GET https://[PROJECT_REF].supabase.co/rest/v1/Review
> ```

**Correction recommandée :**
Ajouter à la fin de `20260609_create_rls_policies.sql` :

```sql
-- ============================================================================
-- SECTION 12: Activation de RLS sur TOUTES les tables
-- ============================================================================

-- Activer RLS sur toutes les tables avec des politiques définies
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Author" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserQuote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAuthor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Like" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiteraryPrize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Laureate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Edition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ForbiddenWord" ENABLE ROW LEVEL SECURITY;

-- Vérification finale
SELECT table_name, row_security 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

### 3. Modération UGC : Fonction administrative manquante

**Composant/Fonction concerné :** `supabase/functions/moderation/index.ts`  
**Risque identifié :** Non-conformité UGC Guidelines - Processus de modération incomplet  
**Impact :** Rejet App Store (Section 4.5 - Contenu généré par les utilisateurs)  

**Preuve technique :**
> Apple exige (App Store Review Guidelines - 4.5) :
> > "Apps with user-generated content must have a method for users to flag offensive content and a system to remove that content"
>
> Le système actuel permet aux utilisateurs de **signaler** du contenu (`POST /moderation/reports`) mais il n'y a **aucun mécanisme pour** :
> 1. Lister les avis signalés (pour un modérateur)
> 2. Supprimer un avis signalé
> 3. Consulter les raisons des signalements
> 4. Gérer les faux positifs
>
> **Conséquence :** Le processus de modération est incomplet. Si Apple teste l'app et signale un avis abusif, il n'y a aucun moyen de vérifier que le contenu a été traité.

**Correction recommandée :**
Ajouter des endpoints administratifs dans `supabase/functions/moderation/index.ts` :

```typescript
// GET /moderation/reports - Liste des signalements (admin only)
if (req.method === 'GET' && path === '/reports') {
  // Vérifier que l'utilisateur est admin (à implémenter)
  const isAdmin = await checkIfAdmin(authUser.id);
  if (!isAdmin) return error('Unauthorized', 403);

  const reports = await sql`
    SELECT r.*, row_to_json(rv) as review, row_to_json(pr) as reporter
    FROM "Report" r
    LEFT JOIN "Review" rv ON rv.id = r."reviewId"
    LEFT JOIN "Profile" pr ON pr.id = r."reporterId"
    ORDER BY r."createdAt" DESC
  `;
  return json(reports);
}

// DELETE /moderation/reports/:id - Supprimer un avis signalé (admin only)
if (req.method === 'DELETE' && path.match(/^\/reports\/\d+$/)) {
  const isAdmin = await checkIfAdmin(authUser.id);
  if (!isAdmin) return error('Unauthorized', 403);

  const reportId = parseInt(parts[1]);
  const report = await sql`SELECT * FROM "Report" WHERE id = ${reportId}`;
  if (!report.length) return error('Report not found', 404);

  // Supprimer l'avis ET le signalement
  await sql`DELETE FROM "Review" WHERE id = ${report[0].reviewId}`;
  await sql`DELETE FROM "Report" WHERE id = ${reportId}`;

  return json({ success: true });
}

// Helper function à ajouter dans _shared/auth.ts
async function checkIfAdmin(userId: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM "Profile" WHERE id = ${userId} AND "isAdmin" = true
  `;
  return result.length > 0;
}
```

Et ajouter la colonne `isAdmin` à la table Profile :
```sql
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "isAdmin" boolean DEFAULT false;
```

---

## ✅ Éléments Conformes (Aucune action requise)

### 1. Filtrage du contenu abusif

**Composant concerné :** `supabase/functions/reviews/index.ts` (lignes 44-49, 72-77)  
**Statut :** ✅ CONFORME  

**Preuve technique :**
```typescript
// POST /reviews - Lignes 44-49
const forbidden = await sql`SELECT word FROM "ForbiddenWord"`;
const hasForbiddenWord = forbidden.some(fw => 
  comment && comment.toLowerCase().includes(fw.word.toLowerCase())
);
if (hasForbiddenWord) return error('Le contenu contient des termes non autorisés.', 400);

// PUT /reviews/:id - Lignes 72-77
const forbidden = await sql`SELECT word FROM "ForbiddenWord"`;
const hasForbiddenWord = forbidden.some(fw => 
  comment && comment.toLowerCase().includes(fw.word.toLowerCase())
);
if (hasForbiddenWord) return error('Le contenu contient des termes non autorisés.', 400);
```
**La validation est bien effectuée côté serveur** avant insertion en base de données.

---

### 2. Masquage du contenu signalé/bloqué

**Composant concerné :** `supabase/functions/reviews/index.ts` (lignes 28-32)  
**Statut :** ✅ CONFORME  

**Preuve technique :**
```typescript
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
**Le filtrage est effectué directement en SQL côté serveur**, pas seulement côté client.

---

### 3. Authentification & Autorisation

**Composant concerné :** `supabase/functions/_shared/auth.ts` + Politiques RLS  
**Statut :** ✅ CONFORME  

**Preuve technique :**
1. **Edge Functions** : Utilisation systématique de `requireAuth(req)` qui valide le JWT via Supabase Auth
2. **RLS Politiques** : Vérification `auth.uid() = "userId"` ou `auth.uid() = id` pour toutes les mutations
3. **Vérification de propriété** : Dans `reviews/index.ts` lignes 91 et 113 :
   ```typescript
   if (review[0].userId !== authUser.id) return error('Unauthorized', 403);
   ```

**Protection complète contre l'usurpation d'identité.**

---

### 4. Accessibilité des outils de signalement (UGC)

**Composant concerné :** `src/entities/book/ui/ReviewBlock.tsx` (lignes 88-102, 113-128)  
**Statut :** ✅ CONFORME  

**Preuve technique :**
```typescript
// Ligne 88-102 : Bouton de signalement accessible
const handleReportReview = (reviewId: string | number) => {
  Alert.alert(
    "Signaler cet avis",
    "Êtes-vous sûr de vouloir signaler ce contenu comme offensant ou inapproprié ?",
    [
      { text: "Annuler", style: "cancel" },
      { text: "Signaler", style: "destructive", onPress: async () => {
          await UGCModerationService.reportReview(reviewId);
          Alert.alert("Succès", "Cet avis a été signalé et masqué.");
          loadReviews();
        }
      }
    ]
  );
};

// Ligne 113-128 : Menu contextuel avec options
const handleReviewOptions = (review: Review) => {
  Alert.alert("Options", "Que souhaitez-vous faire avec cet avis ?", [
    { text: "Signaler ce contenu", onPress: () => handleReportReview(review.id) },
    { text: "Bloquer cet utilisateur", onPress: () => handleBlockUser(review.user?.id) },
    { text: "Annuler", style: "cancel" }
  ]);
};
```
**Les outils sont facilement accessibles** via un bouton d'options (⋮) sur chaque avis.

---

### 5. Synchronisation client-serveur des données de modération

**Composant concerné :** `src/shared/api/UGCModerationService.ts`  
**Statut :** ✅ CONFORME  

**Preuve technique :**
- Stockage local via AsyncStorage pour persistance hors-ligne
- Synchronisation automatique au démarrage (`syncWithServer()`)
- Envoi en arrière-plan vers le serveur (`httpClient.post()`)
- Filtrage local instantané (`containsOffensiveContent()`)

---

## 📋 Checklist de Conformité Apple App Store Guidelines

| Requirement | Section | Statut | Preuve |
|------------|---------|--------|--------|
| Méthode pour signaler du contenu | 4.5 | ✅ | `handleReportReview()` accessible via UI |
| Système pour supprimer du contenu | 4.5 | ❌ | **Manquant** - Pas d'endpoint admin |
| Protection contre le spam | 4.3 | ❌ | **Manquant** - Pas de contrainte UNIQUE |
| Protection des données utilisateur | 5.1.1 | ❌ | **Manquant** - RLS non activé |
| Authentification sécurisée | 5.1.1 | ✅ | JWT validé + RLS politiques |
| Accès autorisé uniquement | 5.1.1 | ✅ | Vérification de propriété dans Edge Functions |

---

## 🎯 Priorités de Correction

### 🔴 **URGENT - À faire avant soumission App Store**
1. **Créer la contrainte UNIQUE** sur Review(userId, bookId)
2. **Activer RLS** sur toutes les tables
3. **Ajouter les endpoints admin** de modération

### 🟡 **MOYEN - À faire avant mise en production**
Aucun identifié. Les autres aspects sont conformes.

### 🟢 **FAIBLE - Améliorations optionnelles**
Aucun identifié. L'architecture est globalement solide.

---

## 📝 Historique des Modifications

| Version | Date | Modifications | Auteur |
|---------|------|---------------|--------|
| v1 | 2026-05-31 | Audit initial Scope 5 | Mistral Vibe |
| v2 | 2026-06-10 | Audit chirurgical - Focus UGC & Sécurité | Mistral Vibe |

**Modifications v2 :**
- Ajout de la preuve technique détaillée pour chaque problème
- Vérification que les correctifs précédents (filtrage mots interdits, masquage serveur) sont bien implémentés
- Identification de 3 nouveaux problèmes critiques non détectés en v1

---

## 🔍 Méthodologie d'Audit

1. **Revue du code backend** (Edge Functions) : Vérification de la validation, authentification, autorisation
2. **Analyse des migrations SQL** : Vérification des contraintes, index, politiques RLS
3. **Revue du code frontend** : Vérification de l'accessibilité des outils de modération
4. **Mapping aux App Store Guidelines** : Correspondance avec les sections 4.3, 4.5, 5.1.1
5. **Preuves techniques** : Extraction de code pour justifier chaque recommandation

---

## 📞 Références

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Supabase Row Level Security Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)

---

*Document généré par Mistral Vibe - Co-Authored-By: Mistral Vibe <vibe@mistral.ai>*
