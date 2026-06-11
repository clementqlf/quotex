# Migrations Supabase - Index Manquants

Ce dossier contient les scripts pour créer les index manquants identifiés dans l'audit Scope 3.

## 📁 Fichiers

| Fichier | Description |
|---------|-------------|
| `20260609_create_missing_indexes.sql` | Fichier SQL avec tous les index (à exécuter manuellement dans le Dashboard) |
| `create-indexes.js` | Script Node.js pour créer les index un par un via l'API |
| `.env.local` | **⚠️ NE JAMAIS COMMITER** - Contient la SERVICE_ROLE_KEY |

## 🚀 Méthode 1 : Utiliser le script Node.js (Recommandé)

### Prérequis
- Node.js 16+ installé
- La clé `SERVICE_ROLE_KEY` configurée dans `.env.local`

### Installation
```bash
# Depuis la racine du projet
cd /Users/chantreau/quotex

# Installer node-fetch (si Node < 18)
npm install node-fetch
```

### Exécution
```bash
cd supabase/migrations
node create-indexes.js
```

### Ce que fait le script
- ✅ Exécute chaque index **un par un** (évite l'erreur de transaction)
- ✅ Vérifie si l'index existe déjà avant de le créer
- ✅ Affiche la progression en temps réel
- ✅ Attend 2 secondes entre chaque index
- ✅ Génère un rapport final

## 🚀 Méthode 2 : Exécuter manuellement dans le Dashboard Supabase

1. Allez dans **Supabase Dashboard → SQL Editor**
2. Copiez **une commande à la fois** depuis `20260609_create_missing_indexes.sql`
3. Exécutez chaque commande individuellement
4. Attendez que chaque index soit créé avant de passer à la suivante

### Exemple
```sql
-- Exécuter cette commande seule
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_userid ON "Quote"("userId");

-- Puis attendre 2 secondes et exécuter la suivante
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_authorid ON "Quote"("authorId");
```

## 📊 Liste des index par priorité

### 🔴 Priorité 1 : Critiques (utilisés dans TOUTES les requêtes)
- `idx_quote_userid` - Quote par utilisateur
- `idx_quote_authorid` - Quote par auteur
- `idx_quote_bookid` - Quote par livre
- `idx_book_authorid` - Livre par auteur

### 🟡 Priorité 2 : Tables de jointure
- `idx_userbook_userid_bookid` - Bibliothèque utilisateur
- `idx_userbook_bookid` - Livres dans les bibliothèques
- `idx_like_quoteid` - Likes par citation
- `idx_userquote_quoteid` - Citations sauvegardées
- `idx_userauthor_userid_authorid` - Auteurs suivis
- `idx_edition_bookid` - Éditions par livre
- `idx_laureate_bookid` - Prix littéraires par livre

### 🟢 Priorité 3 : Index de tri
- `idx_quote_date` - Citations par date
- `idx_book_rating` - Livres par note
- `idx_book_year` - Livres par année

### 🔵 Priorité 4 : Recherche full-text (GIN)
- `idx_quote_text_fts` - Recherche dans le texte des citations
- `idx_quote_theme_fts` - Recherche dans les thèmes
- `idx_book_title_fts` - Recherche dans les titres de livres
- `idx_author_name_fts` - Recherche dans les noms d'auteurs

## ⏱️ Temps estimé

| Méthode | Temps estimé | Complexité |
|---------|--------------|------------|
| Script Node.js | 15-30 minutes | ⭐⭐ |
| Manuel (Dashboard) | 20-40 minutes | ⭐ |

## 🔒 Sécurité

⚠️ **LA SERVICE_ROLE_KEY DONNE UN ACCÈS COMPLET À VOTRE BASE DE DONNÉES**

- ✅ **OK** : Stocker dans `.env.local` (exclu du Git)
- ❌ **INTERDIT** : Stocker dans le code source ou dans un fichier commité
- ❌ **INTERDIT** : Partager cette clé ou l'envoyer par email

Le fichier `.env.local` est déjà ajouté au `.gitignore` et ne sera pas commité.

## 📝 Vérification

Après avoir créé les index, exécutez cette requête pour vérifier :

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

## 📊 Statistiques d'utilisation

Pour voir quels index sont utilisés :

```sql
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

## 🎯 Impact attendu

| Requête | Avant | Après | Amélioration |
|---------|-------|-------|--------------|
| `GET /quotes` | 500ms | 50ms | **10x plus rapide** |
| `GET /search?q=amour` | 800ms | 50ms | **16x plus rapide** |
| `GET /users/username` | 300ms | 30ms | **10x plus rapide** |

## 🛠️ Dépannage

### Erreur : "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"
**Solution** : Utilisez le script Node.js ou exécutez chaque commande individuellement.

### Erreur : "permission denied for schema public"
**Solution** : Vérifiez que votre SERVICE_ROLE_KEY est correcte.

### Erreur : "index already exists"
**Solution** : Le script vérifie déjà si l'index existe. Vous pouvez ignorer cette erreur.

## 📚 Documentation Supabase

- [Index PostgreSQL](https://supabase.com/docs/guides/database/postgres/performance#indexes)
- [Service Role Key](https://supabase.com/docs/guides/auth/service-role)
