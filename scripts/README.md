# Scripts Quotex

Ce dossier contient des scripts utilitaires pour le projet Quotex.

## 📋 Liste des scripts

| Script | Description | Commande |
|--------|-------------|----------|
| `generate-supabase-types.sh` | Génère les types TypeScript de la base de données Supabase | `npm run types:generate` |
| `create-channels.sh` | Crée les canaux EAS | `npm run channels:create` |
| `patch-gradle-foojay.js` | Patch pour Gradle (exécuté automatiquement au postinstall) | - |
| `run-e2e.sh` | Exécute les tests E2E | `npm run eas:update:dev` |

---

## 🔧 Script : Génération des types Supabase

### Prérequis

1. **CLI Supabase installé**
   ```bash
   npm install -g supabase
   ```

2. **Access Token Supabase**
   - Soit connectez-vous via :
     ```bash
     supabase login
     ```
   - Soit définissez la variable d'environnement :
     ```bash
     export SUPABASE_ACCESS_TOKEN=your-access-token
     ```

### Utilisation

#### Option 1 : Via npm (recommandé)
```bash
npm run types:generate
```

#### Option 2 : Directement avec le script
```bash
./scripts/generate-supabase-types.sh
```

#### Option 3 : Avec URL personnalisée
```bash
SUPABASE_URL=https://your-project.supabase.co ./scripts/generate-supabase-types.sh
```

### Comment ça marche ?

1. Le script extrait le **project-id** depuis `EXPO_PUBLIC_SUPABASE_URL` ou depuis l'argument
2. Il utilise le CLI Supabase pour générer les types TypeScript
3. Il écrit le résultat dans `src/shared/types/database.ts`

### Variables d'environnement

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase | ✅ (ou passer en argument) |
| `SUPABASE_ACCESS_TOKEN` | Access token pour l'API Supabase | ✅ |

---

## 🎯 Bonnes pratiques

- **Générez les types après chaque modification du schéma** de la base de données
- **Ne modifiez pas manuellement** `src/shared/types/database.ts` - il sera écrasé
- **Commitez le fichier généré** pour que toute l'équipe ait les bons types

---

## ⚠️ Dépannage

### Erreur : "CLI Supabase non installé"
```bash
npm install -g supabase
```

### Erreur : "Access token requis"
```bash
supabase login
# ou
supabase login --token your-access-token
```

### Erreur : "Project-id non trouvé"
Vérifiez que `EXPO_PUBLIC_SUPABASE_URL` est bien définie dans votre `.env` :
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
```

### Le fichier n'est pas généré
- Vérifiez que vous avez un access token valide
- Vérifiez que le project-id est correct
- Essayez de lancer manuellement :
  ```bash
  npx supabase gen types typescript --project-id YOUR_PROJECT_ID
  ```
