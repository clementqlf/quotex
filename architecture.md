# 🏗️ Architecture et Règles de Développement : Quotex

Ce document définit les principes architecturaux et les règles de développement pour le projet **Quotex**. Il doit être utilisé comme contexte primaire par toute IA assistant au développement.

---

## 1. Philosophie et Principes Clés

*   **KISS (Keep It Simple, Stupid)** : Priorité absolue à la lisibilité et à la simplicité. Pas d'abstraction inutile.
*   **Audit Chirurgical** : Toute modification doit être justifiée par un gain concret (performance, bug, sécurité). Pas de "nettoyage cosmétique" invasif.
*   **Offline-First** : Toute fonctionnalité doit être pensée pour fonctionner sans réseau (cache local + synchronisation).
*   **Typage Strict** : TypeScript est obligatoire. Le type `any` est proscrit.

---

## 2. Structure du Code (FSD - Feature-Sliced Design)

Le projet suit une approche modulaire. Chaque fonctionnalité est co-localisée (composants, hooks, tests, styles au même endroit).

*   `app/` : Routage et pages uniquement (Expo Router). Aucune logique métier ici.
*   `src/entities/` : Modèles de domaine et logique pure des données (ex: `Book`, `Quote`).
*   `src/features/` : Logique métier spécifique (ex: `scanner`, `moderation`). C'est ici que réside la complexité.
*   `src/shared/` : Utilitaires transverses, `lib` (formatage, parsers), composants UI atomiques.

---

## 3. Gestion de l'État (State Management)

*   **Server State (API/Supabase)** : Obligatoirement via **TanStack Query** (React Query). Ne jamais stocker de données serveur dans un store global ou un `useState` complexe.
*   **UI State** :
    *   **État global** (Auth, Thème) : **Zustand** uniquement.
    *   **État local** : `useState` / `useReducer` dans le composant concerné.
*   **Prop Drilling** : À proscrire. Utiliser la Context API uniquement pour l'injection de dépendances (Providers).

---

## 4. Performance & Optimisation

*   **Listes** : Utiliser impérativement `@shopify/flash-list` au lieu de `FlatList`.
*   **Images** : Utiliser `react-native-fast-image` pour la mise en cache.
*   **Memoization** : `useMemo` et `useCallback` doivent être justifiés par un besoin de performance réel (évitement de re-renders lourds), pas par défaut.

---

## 5. Qualité et Tests

*   **Tests Unitaires (Jest)** : Obligatoires pour toute logique métier dans `src/entities/` et `src/shared/lib/` (parsers, calculs, validations).
*   **Tests E2E (Maestro)** : Pour valider les flux utilisateurs critiques (`Scan` -> `Enregistrement` -> `Listes`).
*   **Conformité (UGC/App Store)** :
    *   La règle "1 avis / utilisateur / ouvrage" doit être forcée au niveau Base de Données (contrainte PostgreSQL `UNIQUE`).
    *   Le système de modération doit permettre une action immédiate (masquage).

---

## 6. Règle d'or pour l'IA

Avant de proposer une modification massive :

1.  **Vérifier le risque de réécriture** : Si le changement nécessite une réécriture de plus de **20%** du fichier, le signaler d'abord sans l'appliquer.
2.  **Justifier techniquement** : Chaque proposition doit être accompagnée d'une preuve ou d'un raisonnement technique solide (ex: *"ce re-render bloque le thread UI"*).
3.  **Priorité au fonctionnement** : Si le code est stable et KISS, ne rien toucher.
