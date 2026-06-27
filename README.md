# 📖 Quotex — Carnet de Citations Intelligent

Quotex est une application mobile moderne développée avec **React Native** (via **Expo**) et **Supabase**, conçue pour numériser (via OCR), collecter, organiser et partager des citations de livres physiques ou numériques.

Ce projet applique les principes de développement **Offline-First**, suit l'architecture **Feature-Sliced Design (FSD)**, et intègre des outils d'IA et de numérisation de texte à la volée.

---

## 🚀 Fonctionnalités Principales

*   **Scanner OCR Intégré** : Numérisation de citations directement depuis l'appareil photo ou une image de la galerie (via ML Kit & Vision Camera).
*   **Gestion Offline-First** : Expérience fluide sans connexion internet (cache local, synchronisation différée avec Supabase).
*   **Organisation des Citations** : Association automatique des citations à des livres et auteurs, avec un système de tags et de favoris.
*   **Avis & Commentaires** : Système d'avis de livres (limité à *1 avis unique par utilisateur et par ouvrage* via des contraintes PostgreSQL).
*   **Aspect Social & Partage** : Fonctionnalités UGC (User Generated Content) avec modération immédiate (masquage/signalement de contenus).

---

## 🛠️ Stack Technique

*   **Framework** : [Expo SDK 56](https://expo.dev) / React Native
*   **Routing** : Expo Router (Navigation basée sur les fichiers)
*   **Base de Données & Auth** : [Supabase](https://supabase.com) (PostgreSQL, Row Level Security, Auth Google Sign-in)
*   **Gestion d'État (State Management)** :
    *   *Server State* : [TanStack Query v5](https://tanstack.com/query) (React Query)
    *   *Global UI State* : [Zustand](https://github.com/pmndrs/zustand) (Auth, Thème)
    *   *Local State* : `useState` et `useReducer` standard
*   **Composants & Rendu Graphique** :
    *   `@shopify/flash-list` (Rendu de listes haute performance)
    *   `expo-image` (Chargement et cache d'images optimisés)
    *   `react-native-reanimated` & `@shopify/react-native-skia` (Animations et graphismes fluides)
*   **Qualité & Validation** :
    *   [Jest](https://jestjs.io) & `@testing-library/react-native` (Tests unitaires et d'intégration)
    *   [Maestro](https://maestro.mobile.dev) (Tests End-to-End)

---

## 🏗️ Architecture : Feature-Sliced Design (FSD)

Le projet est structuré selon la méthodologie FSD pour garantir une modularité maximale et éviter le couplage fort.

```bash
├── app/                  # Points d'entrée des routes (Expo Router) - Logique métier INTERDITE ici.
└── src/
    ├── app/              # Configuration globale de l'app (Providers React Query, Auth, Thème)
    ├── entities/         # Logique métier pure & Modèles de données (ex: Book, Author, Quote, User)
    │   └── [entity]/     # ui/ (composants), model/ (hooks, store), lib/ (utilitaires)
    ├── features/         # Fonctionnalités interactives complexes (ex: scanner, social, edit-book)
    ├── shared/           # Utilitaires réutilisables, composants UI atomiques (Button, Card), types
```

---

## ⚙️ Installation et Lancement

### 1. Prérequis

*   Node.js (LTS recommandé)
*   Supabase CLI (pour la génération locale de types)
*   Un simulateur iOS (Xcode) ou Android (Android Studio), ou l'application **Expo Go** sur votre téléphone.

### 2. Configuration des Variables d'Environnement

Copiez le fichier `.env.example` et renommez-le en `.env` :

```bash
cp .env.example .env
```

Remplissez les clés d'API avec vos valeurs Supabase :
*   `EXPO_PUBLIC_SUPABASE_URL`
*   `EXPO_PUBLIC_SUPABASE_ANON_KEY`
*   `EXPO_PUBLIC_API_BASE_URL`

### 3. Lancement de l'application

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement Expo
npm run start
```

*   Appuyez sur `i` pour lancer sur le simulateur iOS.
*   Appuyez sur `a` pour lancer sur l'émulateur Android.

---

## 🔧 Commandes & Scripts Utilitaires

Le dossier [scripts/](file:///Users/chantreau/quotex/scripts) contient des automatisations clés pour le projet.

| Commande | Description | Fichier source |
| :--- | :--- | :--- |
| `npm run types:generate` | Régénère les types TypeScript de Supabase dans `src/shared/types/database.ts` | [generate-supabase-types.sh](file:///Users/chantreau/quotex/scripts/generate-supabase-types.sh) |
| `npm run channels:create` | Crée les canaux de mise à jour EAS | [create-channels.sh](file:///Users/chantreau/quotex/scripts/create-channels.sh) |
| `npm run test` | Exécute les tests unitaires et d'intégration avec Jest | `jest.config.js` |
| `npm run lint` | Valide la syntaxe et la conformité du code | `eslint.config.js` |

> [!TIP]
> Pour générer un fichier `.ipa` iOS de test signé avec un compte Apple gratuit, consultez la procédure détaillée dans [export.md](file:///Users/chantreau/quotex/export.md).

---

## 🤖 Directives Importantes pour les Agents IA (LLM)

Si vous êtes une IA (Claude, Antigravity, Copilot, etc.) et que vous m'aidez à coder, **lisez attentivement et respectez scrupuleusement les règles suivantes** :

### 1. Philosophie de Développement
*   **KISS (Keep It Simple, Stupid)** : Priorité absolue à la lisibilité et à la simplicité. Évitez les abstractions prématurées et les architectures trop complexes.
*   **Offline-First** : Chaque interaction avec les données doit être conçue pour fonctionner hors ligne.
*   **Audit Chirurgical** : Ne proposez pas de refactoring cosmétique ou de modifications globales gratuites. Vos modifications doivent corriger un bug précis, optimiser les performances de manière mesurable ou implémenter une fonctionnalité validée.
*   **Typage Strict** : Le type `any` est interdit. Utilisez des types stricts et exploitez les types Supabase générés automatiquement dans `src/shared/types/database.ts`.

### 2. Règles sur la Gestion d'État
*   **Server State (Supabase)** : Passez obligatoirement par **TanStack Query**. Ne stockez jamais d'états serveur dans un store global Zustand ou des `useState` locaux complexes.
*   **UI State** : Utilisez **Zustand** uniquement pour l'état applicatif global (ex: Auth, Thème). Privilégiez `useState` ou `useReducer` pour les états locaux d'interface.
*   **Prop Drilling** : Évitez de passer des props sur trop de niveaux. Utilisez la Context API uniquement pour l'injection de dépendances.

### 3. Performances & Rendu Mobile
*   Pour les listes de données, utilisez exclusivement **`@shopify/flash-list`** au lieu de `FlatList`.
*   Pour les images distantes, privilégiez le composant `Image` d'**`expo-image`** pour bénéficier d'un cache performant.
*   **Memoization** : N'ajoutez `useMemo` et `useCallback` que s'il y a un problème de performance avéré (re-renders coûteux bloquant le thread UI). Ne les utilisez pas par défaut.

### 4. Processus de Modification du Code
1.  **Vérifier le risque de réécriture** : Si vos modifications proposées modifient plus de **20%** d'un fichier existant, signalez-le à l'utilisateur avant d'éditer.
2.  **Justification Technique** : Fournissez une explication claire et factuelle pour chaque modification importante.
3.  **Respect de la stabilité** : Si une portion de code fonctionne correctement et respecte le principe KISS, n'y touchez pas.
4.  **Consultez la documentation locale** : Référez-vous toujours aux fichiers de référence [architecture.md](file:///Users/chantreau/quotex/architecture.md) et [claude.md](file:///Users/chantreau/quotex/claude.md) avant d'entamer une modification structurante.
