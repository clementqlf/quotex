# 📖 Quotex - Résumé Exécutif

> **Version** : 1.0  
> **Date** : 30 mai 2026  
> **Auteur** : Mistral Vibe

---

## 🎯 EN BREF

**Quotex** est une **application mobile cross-platform (iOS/Android)** qui permet aux utilisateurs de **scanner, organiser et découvrir des citations littéraires** de manière intelligente et sociale.

---

## ✨ VALEUR PROPOSÉE

### 🎨 Pour les Utilisateurs
- **Scan instantané** : Capturez des citations depuis des livres physiques via OCR ou ISBN
- **Organisation intelligente** : Classez vos citations par livre, auteur, thème
- **Enrichissement automatique** : Les métadonnées (couvertures, descriptions, biographies) sont ajoutées automatiquement
- **Découverte sociale** : Explorez les citations populaires et suivez vos auteurs préférés
- **Mode hors ligne** : Accédez à toutes vos données même sans connexion internet

### 💼 Pour le Business
- **Monétisation** : Liens d'achat affiliés (Amazon, Fnac, etc.)
- **Engagement** : Fonctionnalités sociales (likes, partages, suivi)
- **Rétention** : Synchronisation multi-appareils et mode hors ligne
- **Différenciation** : OCR avancé + enrichissement IA unique sur le marché

---

## 🏗️ ARCHITECTURE TECHNIQUE

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Expo)                         │
├─────────────────────────────────────────────────────────────┤
│  • React Native 0.83.6 + TypeScript                          │
│  • Expo SDK 55 (EAS Build)                                    │
│  • Expo Router (file-based routing)                         │
│  • State: React Context API                                  │
│  • UI: Reanimated, Gesture Handler, FlashList                 │
│  • Icons: Lucide React Native                                │
│  • OCR: ML Kit + Vision Camera                               │
│  • Storage: AsyncStorage (cache local)                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND (Supabase)                        │
├─────────────────────────────────────────────────────────────┤
│  • PostgreSQL Database                                        │
│  • Authentication (Google Sign-In, Email/Password)           │
│  • Edge Functions (API Serverless)                           │
│  • Storage (images, covers)                                   │
│  • Realtime Subscriptions                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────┤
│  • Inventaire.io → Métadonnées livres (FR)                    │
│  • Wikidata → Informations auteurs                            │
│  • OpenLibrary → Données bibliographiques                     │
│  • Groq → Génération IA (interprétations)                    │
│  • Wiktionary → Définitions de mots                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 STRUCTURE DU CODE

```
quotex/
├── app/                          # 📱 Routes (Expo Router)
│   ├── (app)/                    # Zone authentifiée
│   │   ├── index.tsx             # 3 onglets principaux
│   │   ├── quote-detail.tsx      # Détail citation
│   │   ├── book-detail.tsx       # Détail livre
│   │   ├── author-detail.tsx     # Détail auteur
│   │   ├── user-profile.tsx      # Profil utilisateur
│   │   ├── settings.tsx          # Paramètres
│   │   └── ...
│   └── (auth)/                   # Authentification
│       ├── login.tsx
│       └── register.tsx
│
├── src/                          # 🏗️ Logique Métier (FSD / Clean Arch)
│   ├── app/                      # ⚙️ Configuration & Providers globaux
│   │   └── providers/            # DataProvider, AuthContext, RepositoriesProvider
│   │
│   ├── entities/                 # 📦 DDD: Entités métier de base
│   │   ├── author/               # Modèles, Repositories, UI (AuthorDetail)
│   │   ├── book/                 # Modèles, API, UI (BookDetail)
│   │   ├── quote/                # Modèles, Repositories, Sync, UI
│   │   ├── theme/                # UI des thèmes de citations
│   │   └── user/                 # API Auth, Profil Utilisateur
│   │
│   ├── features/                 # ✨ Fonctionnalités & Écrans
│   │   ├── dictionary/           # Intégration dictionnaire (Wiktionary)
│   │   ├── edit-book/            # Modification avancée des blocs de livre
│   │   ├── my-quotes/            # 📱 Écran principal MyQuotesScreen
│   │   ├── prizes/               # Écran Prix Littéraires
│   │   ├── scanner/              # 📷 OCR (Vision Camera) + ISBN Scanner
│   │   ├── search/               # 🔍 Recherche globale (SearchScreen)
│   │   ├── social/               # 👥 Écran SocialFeedScreen
│   │   └── user-settings/        # ⚙️ Écran de paramètres (SettingsScreen)
│   │
│   └── shared/                   # 🔧 Code partagé
│       ├── api/                  # Clients externes (Supabase)
│       ├── config/               # Configuration
│       ├── lib/                  # Utilitaires, hooks partagés, gestion offline
│       ├── navigation/           # Typage et utilitaires de navigation
│       ├── platform/             # Code spécifique à la plateforme (iOS/Android/Web)
│       ├── theme/                # Design system (Couleurs, typographie)
│       └── ui/                   # Composants UI partagés, blocs modulaires
│
├── supabase/                     # ☁️ Backend
│   └── functions/                # Edge Functions
│       ├── quotes/
│       ├── authors/
│       ├── books/
│       └── _shared/entityMatcher.ts
│
└── assets/                       # 🎨 Ressources
```

---

## 🎯 FONCTIONNALITÉS PRINCIPALES

### 1. 📱 Scan OCR en Temps Réel
- **Technologie** : react-native-vision-camera + @react-native-ml-kit/text-recognition
- **Fonctionnalités** :
  - Détection automatique de texte dans le cadre de la caméra
  - Sélection manuelle de zones de texte
  - Reconstruction intelligente du texte (sauts de ligne, espaces)
  - Détection de l'orientation du livre
  - Zoom et recadrage

### 2. 📚 Scan ISBN
- **Technologie** : react-native-vision-camera-ocr-plus (barcode scanner)
- **Fonctionnalités** :
  - Scan des codes-barres ISBN-10 et ISBN-13
  - Recherche automatique dans les bases de données
  - Récupération des métadonnées du livre
  - Suggestions de livres similaires

### 3. ☁️ Synchronisation Hors Ligne
- **Mécanisme** :
  1. Toutes les modifications sont sauvegardées dans AsyncStorage
  2. `useNetworkSync` détecte les changements de statut réseau
  3. `DataProvider` synchronise avec Supabase dès que le réseau est disponible
- **Fonctionnalités** :
  - Mode hors ligne complet
  - Synchronisation automatique en arrière-plan
  - Résolution de conflits (à vérifier)
  - Indicateurs de statut de synchronisation

### 4. 🔍 Enrichissement Automatique
- **Workflow** :
  1. Utilisateur ajoute une citation avec un titre/auteur approximatif
  2. `entityMatcher.ts` tente de matcher avec les APIs externes
  3. Récupération des métadonnées complètes
  4. Mise à jour automatique de l'entité
- **Sources** : Inventaire.io, Wikidata, OpenLibrary, Groq

### 5. 🧩 Système de Blocs Modulaires
- **Concept** : Chaque type de contenu est un bloc indépendant et personnalisable
- **Blocs disponibles** :
  - Informations livre/auteur
  - Définitions de mots
  - Livres/auteurs similaires
  - Notes personnelles
  - Citations sauvegardées
  - Liens d'achat
  - Éditions
- **Personnalisation** : Réorganisation par glisser-déposer

### 6. 👥 Réseau Social
- **Fonctionnalités** :
  - Feed de citations populaires
  - Suivi d'auteurs et de livres
  - Système de likes et sauvegardes
  - Profils utilisateurs
  - Partage de citations

---

## 🔒 SÉCURITÉ

### ✅ Bonnes Pratiques
- Authentification via Google Sign-In + Supabase Auth
- Tokens stockés dans AsyncStorage avec persistSession
- Plugin custom `withSecureWebView` pour la sécurité des WebViews
- Justificatifs clairs pour les permissions (caméra, photos)

### ⚠️ Points à Améliorer
- **Clé Supabase anon key en clair** dans app.json → **RISQUE DE SÉCURITÉ**
- Vérifier les **Row Level Security (RLS)** dans Supabase
- Audit des permissions des **Edge Functions**
- Validation des inputs dans les Edge Functions

---

## ⚡ PERFORMANCES

### ✅ Optimisations
- FlashList pour les listes longues
- Reanimated pour les animations (UI thread)
- Memoization (useMemo, useCallback, React.memo)
- Lazy loading des données
- Images optimisées avec expo-image

### ⚠️ Points à Vérifier
- Consommation CPU/GPU pendant le scan OCR
- Memory leaks dans les workflows complexes
- Taille du bundle (55+ dépendances)
- Performances sur appareils anciens

---

## 📊 STATISTIQUES TECHNIQUES

| Métrique | Valeur |
|----------|--------|
| **Langage** | TypeScript |
| **Framework** | React Native + Expo |
| **Lignes de code** | ~5,000+ (à estimer) |
| **Nombre de fichiers** | ~100+ |
| **Dépendances npm** | 55+ |
| **Edge Functions** | 10+ |
| **Entités** | 4 (Quote, Book, Author, User) |
| **Blocs modulaires** | 15+ |
| **Couverture tests** | ~10-20% (à estimer) |

---

## 🎯 POINTS FORTS

1. **Architecture Solide** : DDD + Clean Architecture bien implémentés
2. **Modularité** : Système de blocs très flexible et extensible
3. **Fonctionnalités Innovantes** : OCR avancé + enrichissement IA
4. **Mode Hors Ligne** : Expérience complète sans connexion
5. **Code Bien Structuré** : Séparation claire des responsabilités
6. **Technologies Modernes** : Stack à jour (Expo 55, RN 0.83)

---

## ⚠️ POINTS À AMÉLIORER

### 🔴 Critique
1. **Sécurité** : Clé Supabase exposée dans app.json
2. **DataProvider** : God Object (~400+ lignes, trop de responsabilités - refonte vers `RepositoriesProvider` initiée)
3. **Resolution de conflits** : Algorithme de sync à vérifier

### 🟡 Haute Priorité
1. **Tests** : Couverture insuffisante (peu de tests E2E/intégration)
2. **Performances OCR** : Optimisation nécessaire sur appareils anciens
3. **Documentation** : Manque de JSDoc sur les fonctions complexes

### 🟢 Moyenne Priorité
1. **Couplage avec Supabase** : Difficile de changer de backend
2. **Complexité des hooks** : Certains hooks sont trop complexes
3. **Internationalisation** : Pas de préparation pour le multi-langues

---

## 🚀 RECOMMANDATIONS STRATÉGIQUES

### Phase 1 : Urgent (1-2 semaines)
- [ ] **Corriger la sécurité** : Masquer la clé Supabase, auditer les RLS
- [ ] **Fix les bugs critiques** : Vérifier la sync hors ligne, gestion des conflits
- [ ] **Optimiser le bundle** : Analyser et réduire la taille

### Phase 2 : Haute Priorité (2-4 semaines)
- [ ] **Améliorer les tests** : Ajouter des tests E2E avec Detox
- [ ] **Refactor DataProvider** : Poursuivre le découpage (via `RepositoriesProvider`, `QuoteProvider`, etc.)
- [ ] **Optimiser l'OCR** : Réduire la consommation CPU/GPU

### Phase 3 : Moyenne Priorité (1-2 mois)
- [ ] **Abstraction du backend** : Créer une couche d'abstraction
- [ ] **Améliorer l'UX** : Feedback utilisateur, animations
- [ ] **Documentation complète** : JSDoc, README, architecture

### Phase 4 : Long Terme
- [ ] **Ajout de fonctionnalités** : Recommandations personnalisées, export PDF
- [ ] **Monétisation** : Intégration de publicités ou abonnements premium
- [ ] **Internationalisation** : Support multi-langues

---

## 📝 CHECKLIST POUR AUDIT

- [ ] **Sécurité** : Audit complet (RLS, Edge Functions, clés API)
- [ ] **Stabilité** : Test des scénarios edge cases (hors ligne, conflits)
- [ ] **Performances** : Profiling CPU/mémoire, optimisation du bundle
- [ ] **Architecture** : Vérification du DDD, séparation des concerns
- [ ] **Code Quality** : Revues de code, détection des code smells
- [ ] **Tests** : Couverture, qualité, performance des tests
- [ ] **UX/UI** : Expérience utilisateur, accessibilité
- [ ] **Backend** : Audit des Edge Functions, base de données

---

## 🔗 LIENS UTILES

- **Repository** : `/Users/chantreau/quotex`
- **Documentation** : Voir `doc/` directory
- **Expo** : https://expo.dev
- **Supabase** : https://supabase.com
- **ML Kit** : https://developers.google.com/ml-kit

---

## 📞 CONTACTS

- **Développeur** : [À compléter]
- **Équipe** : [À compléter]
- **Product Owner** : [À compléter]

---

> **Généré par** : Mistral Vibe  
> **Date** : 30 mai 2026  
> **Version** : 1.0

*Ce document est une synthèse de l'analyse complète disponible dans `QUOTEX_ANALYSE_ET_PROMPT_AUDIT.md`*
