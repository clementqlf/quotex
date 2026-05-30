# 🔍 Audit de Performance & Conformité aux Standards — Quotex

> Audit réalisé le 24 mai 2026 sur le workspace `quotex` (React Native 0.83 / Expo 55 / TypeScript)

---

## Résumé exécutif

Le projet est **fonctionnel et bien structuré** (architecture Feature-Sliced Design). Cependant, plusieurs problèmes de performance significatifs et des écarts par rapport aux bonnes pratiques React Native ont été identifiés. Les **3 gains les plus impactants** seraient :

1. **Remplacer `ScrollView` par `FlashList`** dans MyQuotesScreen (critique pour la performance du scroll)
2. **Extraire les composants définis inline** (QuoteCard, BookCardItem, etc.) en composants mémorisés à part
3. **Supprimer les `console.log` de production** et les données statiques embarquées

---

## 📊 Catégories de l'audit

| Catégorie | Problèmes | Critique | Important | Modéré |
|-----------|-----------|----------|-----------|--------|
| 🚀 Performance des listes & rendus | 7 | 2 | 3 | 2 |
| 📦 Gestion de l'état & données | 6 | 1 | 3 | 2 |
| 🌐 Services API & réseau | 6 | 1 | 3 | 2 |
| 🏗️ Architecture & composants | 5 | 0 | 3 | 2 |
| 🔒 Sécurité | 3 | 2 | 1 | 0 |
| 🛠️ Outillage & DX | 4 | 0 | 2 | 2 |

---

## 🚀 1. Performance des Listes & Rendus

### 🔴 CRITIQUE — `ScrollView` au lieu de `FlashList` pour les listes de données

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L709-L811)

Tu utilises un `ScrollView` avec `.map()` pour afficher tes citations, livres, auteurs et thèmes. C'est le problème de performance **le plus critique** : tous les items sont rendus simultanément, même ceux hors de l'écran.

```tsx
// ❌ Actuel — TOUS les items sont rendus au montage
<ScrollView>
  {quotesToDisplay.map((quote) => (
    <QuoteCard key={quote.id} quote={quote} />
  ))}
</ScrollView>
```

```tsx
// ✅ Correctif — utiliser FlashList (déjà installé !)
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={quotesToDisplay}
  renderItem={({ item }) => <QuoteCard quote={item} />}
  estimatedItemSize={200}
  keyExtractor={(item) => item.id.toString()}
  refreshControl={<RefreshControl ... />}
/>
```

> [!IMPORTANT]
> Tu as **déjà `@shopify/flash-list` dans tes dépendances** (v2.0.2) mais tu ne l'utilises nulle part ! FlashList ne rend que les items visibles et recycle les vues → gain de mémoire et de fluidité de scroll énorme.

---

### 🔴 CRITIQUE — Composants définis inline qui se re-créent à chaque render

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L281-L468)

Les composants `QuoteCard`, `BookCardItem`, `AuthorCardItem`, `ThemeCardItem`, `QuoteActionModal` et `AddQuoteMenu` sont **définis à l'intérieur** du composant parent `MyQuotesScreen`. Cela signifie qu'ils sont **recréés à chaque render**, ce qui :
- Empêche toute mémoisation (`React.memo` inutile sur un composant inline)
- Détruit et recréé le DOM natif de chaque carte à chaque changement d'état
- Crée un nouveau composant `EnrichingSkeleton` dans `QuoteCard` (composant dans composant dans composant !)

```tsx
// ❌ Actuel — Composant inline
export default function MyQuotesScreen() {
  // ... état ...
  
  const QuoteCard = ({ quote }: { quote: Quote }) => { // recréé à chaque render
    const EnrichingSkeleton = () => { ... }; // DOUBLE inline !
    return (...)
  };
}
```

```tsx
// ✅ Correctif — Extraire dans des fichiers séparés
// src/entities/quote/ui/QuoteCard.tsx
const QuoteCard = React.memo(({ quote, onLike, onMenu, colors }: Props) => {
  return (...);
});
```

---

### 🟡 IMPORTANT — `Image` de React Native au lieu de `expo-image`

**Fichiers** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L10), [SearchScreen.tsx](file:///Users/chantreau/quotex/src/pages/SearchScreen.tsx#L9), [QuoteDetailModal.tsx](file:///Users/chantreau/quotex/src/entities/quote/ui/QuoteDetailModal.tsx#L10), [ScanScreen.tsx](file:///Users/chantreau/quotex/src/pages/ScanScreen.tsx#L7)

Tu importes `Image` depuis `react-native` dans la plupart des fichiers, alors que `expo-image` (déjà installé et utilisé dans [BookDetail.tsx](file:///Users/chantreau/quotex/src/entities/book/ui/BookDetail.tsx#L9)) offre :
- **Cache disque automatique** (pas de re-téléchargement)
- **Transitions et placeholders** natifs
- **Recyclage des vues** en listes
- **Meilleure gestion de la mémoire** (important avec les couvertures de livres)

```tsx
// ❌ 
import { Image } from 'react-native';

// ✅ 
import { Image } from 'expo-image';
```

---

### 🟡 IMPORTANT — Calculs dérivés non mémorisés

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L148-L154)

```tsx
// ❌ Recalculé à chaque render (pas de useMemo)
const authors = [...new Set(myQuotes.map(q => getAuthorName(q.author)))];
const books = [...new Set(myQuotes.map(q => getBookTitle(q.book)))];
const years = [...new Set(
  myQuotes
    .map(q => bookDescriptions[getBookTitle(q.book)]?.year)
    .filter((year): year is number => !!year)
)].sort((a, b) => b - a);
```

```tsx
// ✅ Mémoiser ces calculs
const authors = useMemo(() => 
  [...new Set(myQuotes.map(q => getAuthorName(q.author)))], 
  [myQuotes]
);
```

---

### 🟡 IMPORTANT — `bookDescriptions` dans le dep array de `useMemo`

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L567)

```tsx
}, [myQuotes, allBooks, bookDescriptions]); // ← bookDescriptions est un IMPORT STATIQUE
```

`bookDescriptions` est un objet exporté depuis [staticData.ts](file:///Users/chantreau/quotex/src/shared/api/staticData.ts#L98). Sa référence ne change **jamais**. L'inclure dans les deps ne fait pas de mal mais est trompeur — ça laisse penser qu'il peut changer dynamiquement.

---

### 🟠 MODÉRÉ — Stats des onglets recalculées à chaque render

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L687)

```tsx
// ❌ Crée un nouveau Set à chaque render
<Text style={styles.statValue}>{new Set(myQuotes.map(q => q.book)).size}</Text>
```

```tsx
// ✅ Mémoiser
const bookCount = useMemo(() => new Set(myQuotes.map(q => getBookTitle(q.book))).size, [myQuotes]);
```

---

### 🟠 MODÉRÉ — `useEffect` + `setQuotesToDisplay` au lieu de `useMemo`

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L53-L204)

```tsx
// ❌ Pattern anti : état dérivé stocké avec useState + useEffect pour le synchroniser
const [quotesToDisplay, setQuotesToDisplay] = useState(myQuotes);

useEffect(() => {
  let filtered = [...myQuotes];
  // ... filtrage ...
  setQuotesToDisplay(filtered);
}, [myQuotes, activeFilters]);
```

Ce pattern cause **deux renders** : un avec les anciennes données, un avec les nouvelles. Utiliser `useMemo` ne provoque qu'un seul render :

```tsx
// ✅ 
const quotesToDisplay = useMemo(() => {
  let filtered = [...myQuotes];
  // ... logique de filtrage identique ...
  return filtered;
}, [myQuotes, activeFilters, allBooks]);
```

---

## 📦 2. Gestion de l'État & Données

### 🔴 CRITIQUE — Refreshes en cascade non-batchés

**Fichiers** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L81-L88), [DataProvider.tsx](file:///Users/chantreau/quotex/src/app/providers/DataProvider.tsx#L164-L177)

```tsx
// ❌ Dans MyQuotesScreen — 3 fetches indépendants à chaque focus
useEffect(() => {
  if (isScreenFocused && isFocused) {
    setTabIndex(0);
    refreshQuotes();  // fetch /quotes
    refreshAuthors(); // fetch /authors
    refreshBooks();   // fetch /books
  }
}, [isScreenFocused, isFocused]);
```

```tsx
// ❌ Dans DataProvider.updateQuote — RE-FETCH des 3 endpoints après une simple mise à jour
const updateQuote = useCallback(async (id: number, updates: Partial<Quote>) => {
  setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  await quoteService.updateQuote(id, updates);
  
  // ← Pourquoi refetcher TOUT après une simple édition ??
  await Promise.all([
    refreshQuotes('updateQuote complete'),
    refreshAuthors('updateQuote complete'),
    refreshBooks('updateQuote complete')
  ]);
}, []);
```

> [!WARNING]
> `updateQuote` fait **1 PATCH + 3 GET** réseau à chaque modification. C'est excessif. Il suffit de mettre à jour la quote localement (déjà fait avec l'optimistic update). Le refresh global devrait être limité au pull-to-refresh ou à un timer.

**Recommandation** : Créer un seul `refreshAll()` qui fait un unique `Promise.all` et utiliser une logique de cache-invalidation au lieu de tout refetcher.

---

### 🟡 IMPORTANT — Le polling de 5s pendant l'enrichissement

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L104-L127)

```tsx
interval = setInterval(() => {
  refreshQuotes(); // Appelle GET /quotes toutes les 5 secondes !
}, 5000);
```

Un polling de 5s fait un appel réseau complet avec parsing JSON, mise à jour du state global, et re-render de toute la liste. **Mieux** : utiliser des WebSockets/SSE ou du long-polling côté serveur, ou au minimum augmenter l'intervalle à 10-15s et utiliser un endpoint léger qui ne renvoie que le statut des quotes en cours d'enrichissement.

---

### 🟡 IMPORTANT — DataProvider `contextValue` change trop souvent

**Fichier** : [DataProvider.tsx](file:///Users/chantreau/quotex/src/app/providers/DataProvider.tsx#L251-L285)

Le `useMemo` du context dépend de `quotes`, `authors`, et `books`. Chaque refresh change ces arrays → **nouveau objet context** → **re-render de TOUS les consumers**, même ceux qui n'utilisent que `addQuote` ou `getBookById`.

```tsx
// ✅ Solution : séparer en plusieurs contextes
// DataQueryContext → quotes, authors, books (les données qui changent)
// DataMutationContext → addQuote, deleteQuote, etc. (les fonctions qui changent rarement)
```

Ou utiliser un state manager comme Zustand qui offre une sélection fine (`useStore(s => s.quotes)`).

---

### 🟡 IMPORTANT — Duplication de la logique addQuote

**Fichiers** : [DataProvider.tsx](file:///Users/chantreau/quotex/src/app/providers/DataProvider.tsx#L187-L214) et [QuoteService.ts](file:///Users/chantreau/quotex/src/entities/quote/api/QuoteService.ts#L241-L288)

Les deux fichiers font un optimistic update local indépendamment. La quote est ajoutée **deux fois localement** (une fois dans DataProvider state, une fois dans AsyncStorage via QuoteService), puis les données sont re-fetchées complètement.

---

### 🟠 MODÉRÉ — `bookDescriptions` statique toujours chargé en mémoire

**Fichier** : [staticData.ts](file:///Users/chantreau/quotex/src/shared/api/staticData.ts)

Ce fichier de 14 Ko contient des données hardcodées (descriptions de livres, auteurs, citations). Maintenant que tu as un vrai backend Supabase, ces données sont **dupliquées** et potentiellement **incohérentes** avec la base de données.

**Recommandation** : Migrer toutes les données statiques vers le backend et supprimer [staticData.ts](file:///Users/chantreau/quotex/src/shared/api/staticData.ts). Ça réduit aussi la taille du bundle JS.

---

### 🟠 MODÉRÉ — Pas de gestion d'erreur globale

Aucun error boundary React n'est en place. Si un composant crash (ex: JSON.parse d'un param invalide), l'app plante complètement.

```tsx
// ✅ Ajouter dans _layout.tsx
import { ErrorBoundary } from 'react-error-boundary';
```

---

## 🌐 3. Services API & Réseau

### 🔴 CRITIQUE — `getBookByTitle` fetche TOUS les livres

**Fichier** : [AuthorService.ts](file:///Users/chantreau/quotex/src/entities/author/api/AuthorService.ts#L107-L129)

```tsx
// ❌ Pour trouver UN livre, on fetch TOUTE la liste !
async getBookByTitle(title: string): Promise<Book | undefined> {
  const response = await fetch(`${this.API_URL}/books?t=${Date.now()}`, { headers });
  const books = await response.json();
  const book = books.find((b: any) => b.title === title); // filtre côté client !
}
```

**Correction** : Utiliser un endpoint dédié côté serveur :
```tsx
const response = await fetch(
  `${this.API_URL}/books/by-title/${encodeURIComponent(title)}`, 
  { headers }
);
```

---

### 🟡 IMPORTANT — Mapping des réponses API dupliqué partout

**Fichier** : [QuoteService.ts](file:///Users/chantreau/quotex/src/entities/quote/api/QuoteService.ts)

Le même code de mapping `(q: any) => ({ id: q.id, text: q.text, ... })` est copié-collé dans [getQuotes](file:///Users/chantreau/quotex/src/entities/quote/api/QuoteService.ts#L72-L87), [getQuoteById](file:///Users/chantreau/quotex/src/entities/quote/api/QuoteService.ts#L125-L140), et [analyzeQuote](file:///Users/chantreau/quotex/src/entities/quote/api/QuoteService.ts#L342-L357).

```tsx
// ✅ Extraire une fonction de mapping
private mapQuoteFromServer(q: any): Quote {
  return {
    id: q.id,
    text: q.text,
    book: q.book,
    author: q.author,
    theme: q.theme,
    likesCount: q.likesCount || 0,
    isLiked: q.isLiked || false,
    date: q.date || new Date().toISOString(),
    isSaved: q.isSaved || false,
    comments: q.comments || 0,
    blockData: q.blockData ? (typeof q.blockData === 'string' ? JSON.parse(q.blockData) : q.blockData) : {},
    user: q.user,
    aiInterpretation: q.aiInterpretation,
  };
}
```

De même pour `buyLinks` parsing dans [AuthorService.ts](file:///Users/chantreau/quotex/src/entities/author/api/AuthorService.ts) (dupliqué ~8 fois).

---

### 🟡 IMPORTANT — Pas de AbortController pour les navigations rapides

**Fichier** : [BookDetail.tsx](file:///Users/chantreau/quotex/src/entities/book/ui/BookDetail.tsx#L151-L285)

`loadMetadata` fait jusqu'à 4 requêtes réseau séquentielles. Si l'utilisateur navigue rapidement entre les livres, les anciens fetches continuent en arrière-plan et tentent de `setBookInfo` sur un composant potentiellement démonté ou avec un autre livre affiché.

```tsx
// ✅ Utiliser AbortController
React.useEffect(() => {
  const controller = new AbortController();
  loadMetadata(controller.signal);
  return () => controller.abort();
}, [bookId, bookTitleParam]);
```

---

### 🟡 IMPORTANT — `require()` dynamiques dans les composants

**Fichier** : [BookDetail.tsx](file:///Users/chantreau/quotex/src/entities/book/ui/BookDetail.tsx#L196-L253)

```tsx
// ❌ require() dans un callback async !
const token = await require('@/src/entities/user/api/AuthService').authService.getToken();
const { API_BASE_URL: BASE_URL } = require('@/src/shared/config/api');
```

```tsx
// Et aussi :
onPress={() => require('expo-router').router.back()}  // L613, L630, L652
```

Les `require()` dynamiques empêchent le tree-shaking de Metro et sont imprévisibles au runtime. Utiliser des imports normaux en haut du fichier.

---

### 🟠 MODÉRÉ — Pas de timeout sur la plupart des fetches

Seul `getQuotes` a un `AbortController` avec timeout de 10s. Toutes les autres requêtes (`getBookByTitle`, `getAuthorByName`, import, enrichissement...) n'ont **aucun timeout** → risque de bloquer l'UI indéfiniment si le serveur ne répond pas.

---

### 🟠 MODÉRÉ — Cache-busting inutile avec timestamp

**Fichier** : [AuthorService.ts](file:///Users/chantreau/quotex/src/entities/author/api/AuthorService.ts#L111)

```tsx
const response = await fetch(`${this.API_URL}/books?t=${Date.now()}`, { headers });
```

Ajouter `?t=timestamp` empêche tout cache HTTP et force un re-téléchargement complet à chaque appel. Mieux : utiliser les headers `Cache-Control` côté serveur.

---

## 🏗️ 4. Architecture & Composants

### 🟡 IMPORTANT — Fichiers de page monolithiques (>1000 lignes)

| Fichier | Lignes | Taille |
|---------|--------|--------|
| [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx) | 1 404 | 47 Ko |
| [QuoteDetailModal.tsx](file:///Users/chantreau/quotex/src/entities/quote/ui/QuoteDetailModal.tsx) | 1 429 | 50 Ko |
| [BookDetail.tsx](file:///Users/chantreau/quotex/src/entities/book/ui/BookDetail.tsx) | 1 344 | 48 Ko |
| [ScanScreen.tsx](file:///Users/chantreau/quotex/src/pages/ScanScreen.tsx) | 1 166 | 39 Ko |

**Chaque fichier contient** : logique métier + UI + styles + modales + composants enfants. Ces fichiers devraient être découpés en 3-5 fichiers chacun :

```
pages/MyQuotesScreen/
├── MyQuotesScreen.tsx       (composant principal, ~200 lignes)
├── QuoteCard.tsx            (composant carte)
├── BookCardItem.tsx          
├── FilterModal.tsx          
├── useMyQuotesFilters.ts    (hook custom pour la logique de filtrage)
└── styles.ts                (les styles)
```

---

### 🟡 IMPORTANT — Styles inline et objets créés dans le JSX

**Fichiers multiples**

```tsx
// ❌ Nouvel objet créé à chaque render
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>

// ❌ Même problème avec les objets dynamiques dans les styles
style={[styles.statusBadge, {
  backgroundColor: getStatusColor(book.readingStatus) + '15',
  borderColor: getStatusColor(book.readingStatus) + '40',
}]}
```

Chaque objet inline crée une nouvelle référence → la comparaison de style échoue → le bridge natif met à jour inutilement les propriétés de la vue.

```tsx
// ✅ Utiliser des styles prédéfinis ou useMemo pour les styles dynamiques
const statusStyle = useMemo(() => ({
  backgroundColor: getStatusColor(book.readingStatus) + '15',
  borderColor: getStatusColor(book.readingStatus) + '40',
}), [book.readingStatus]);
```

---

### 🟡 IMPORTANT — `handleShare` inline dans le JSX

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L352-L365)

```tsx
// ❌ Définition d'une fonction async DANS le onPress DANS un composant inline
<TouchableOpacity onPress={() => {
  const handleShare = async () => {
    try {
      const authorName = getAuthorName(quote.author);
      const message = `"${quote.text}"\n- ${authorName}\n(via Quotex)`;
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  handleShare();
}}>
```

---

### 🟠 MODÉRÉ — Typage `any` abusif

Nombreuses occurrences de `any` à travers le code :
- `const BookCardItem = ({ book }: { book: any })` — [L376](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L376)
- `const AuthorCardItem = ({ author }: { author: any })` — [L421](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L421)
- `const ThemeCardItem = ({ theme }: { theme: any })` — [L449](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L449)
- `(q as any).isEnriching` — [L92-L93](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L92-L93)
- Types dans les services : `data: any[]`, `payload: any`

**Recommandation** : Créer des interfaces dédiées (`BookCardData`, `AuthorCardData`) et supprimer les `as any`.

---

### 🟠 MODÉRÉ — `useIsFocused` et `tabIndex` redondants

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L56-L88)

```tsx
const { tabIndex, setTabIndex } = useTabIndex();
const isFocused = tabIndex === 0;        // ← focus géré manuellement via un contexte
const isScreenFocused = useIsFocused();  // ← focus géré par React Navigation

useEffect(() => {
  if (isScreenFocused && isFocused) { ... }  // ← double check
}, [isScreenFocused, isFocused]);
```

Deux systèmes de focus coexistent. Simplifier en utilisant un seul mécanisme (soit le `TabContext`, soit `useIsFocused`).

---

## 🔒 5. Sécurité

### 🔴 CRITIQUE — Clé Supabase anon commise dans le code source

**Fichier** : [supabase.ts](file:///Users/chantreau/quotex/src/shared/api/supabase.ts#L8)

```tsx
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

> [!CAUTION]
> La clé `anon` Supabase est **hardcodée** dans le code source et potentiellement commise dans Git. Même si c'est la clé publique (anon), elle devrait être dans une variable d'environnement pour faciliter la rotation et la gestion multi-environnements.

```tsx
// ✅ Utiliser expo-constants
import Constants from 'expo-constants';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
```

---

### 🔴 CRITIQUE — URL de l'API et IP locale hardcodées

**Fichier** : [api.ts](file:///Users/chantreau/quotex/src/shared/config/api.ts#L5-L16)

```tsx
const SUPABASE_FUNCTIONS_URL = 'https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1';
const LOCAL_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  ios: 'http://192.168.0.183:3000',  // ← IP privée hardcodée
});
```

**Recommandation** : Utiliser `expo-constants` et `app.json` extra pour les variables d'environnement. L'IP locale change selon le réseau.

---

### 🟡 IMPORTANT — `addQuote` dans staticData.ts mute des exports

**Fichier** : [staticData.ts](file:///Users/chantreau/quotex/src/shared/api/staticData.ts#L205-L338)

```tsx
export let localQuotesDB = [...];  // ← `let` + mutation directe
export let globalQuotesDB = [...];

export const addQuote = (...) => {
  localQuotesDB.unshift(newLocalQuote);  // mutation d'un export !
  globalQuotesDB.unshift(newGlobalQuote);
};
```

Muter des `export let` est un anti-pattern dangereux. Si ce code de seeding n'est plus nécessaire avec le backend Supabase, il devrait être supprimé.

---

## 🛠️ 6. Outillage & DX

### 🟡 IMPORTANT — `console.log` omniprésents en production

Quasiment tous les services et composants contiennent des `console.log` de debug :

```
[MyQuotesScreen] Polling active. Items enriching: ...
[ScanScreen] handleTakePhoto: scanLockRef.current set to true
DataProvider: refreshQuotes called (Reason: ...)
Fetching quotes from: https://...
Server response: 15 quotes
```

En production, ces logs :
- Ralentissent le JS thread (sérialisation des objets)
- Exposent des informations sensibles (URLs, tokens partiels)
- Polluent la console de debug

```tsx
// ✅ Solution simple : babel plugin
// babel.config.js
plugins: [
  'react-native-reanimated/plugin',
  ['transform-remove-console', { exclude: ['error', 'warn'] }]  // ← ajouter
],
```

---

### 🟡 IMPORTANT — Fichiers de test orphelins à la racine

**Fichiers** : [test_isbn.js](file:///Users/chantreau/quotex/test_isbn.js), [test_isbn2.js](file:///Users/chantreau/quotex/test_isbn2.js), [test_search.js](file:///Users/chantreau/quotex/test_search.js)

Ces fichiers de test manuels ne font pas partie d'un framework de test. Ils devraient être dans un dossier `__tests__/` ou supprimés au profit de vrais tests unitaires/intégration.

---

### 🟠 MODÉRÉ — Pas de tests automatisés

Aucun test unitaire ou d'intégration n'est configuré. Pour une app de cette taille, il serait pertinent d'avoir au minimum :
- Tests unitaires des services (QuoteService, AuthorService)
- Tests des helpers (dataHelpers, dateUtils)
- Tests snapshot des composants clés

---

### 🟠 MODÉRÉ — Code mort et commenté

**Fichier** : [ScanScreen.tsx](file:///Users/chantreau/quotex/src/pages/ScanScreen.tsx#L477-L499) — Bloc de ~25 lignes de code commenté (ancienne animation `Animated`)

**Fichier** : [MyQuotesScreen.tsx](file:///Users/chantreau/quotex/src/pages/MyQuotesScreen.tsx#L206-L209) — Fonction wrapper vide

```tsx
const handleDeleteQuote = (id: number) => {
  deleteQuote(id);  // wrapper inutile
};
```

---

## 📋 Plan de priorité d'implémentation

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Remplacer `ScrollView.map()` → `FlashList` dans MyQuotesScreen | 🟢 Énorme | 🟡 Moyen |
| 2 | Extraire les composants inline (QuoteCard, etc.) + `React.memo` | 🟢 Grand | 🟡 Moyen |
| 3 | Remplacer `Image` (RN) → `Image` (expo-image) partout | 🟢 Grand | 🟢 Facile |
| 4 | Remplacer `useState + useEffect` par `useMemo` pour `quotesToDisplay` | 🟢 Grand | 🟢 Facile |
| 5 | Réduire les refresh en cascade dans DataProvider | 🟢 Grand | 🟡 Moyen |
| 6 | Ajouter AbortController aux fetches de navigation | 🟡 Moyen | 🟢 Facile |
| 7 | Supprimer les `console.log` (babel plugin) | 🟡 Moyen | 🟢 Facile |
| 8 | Variables d'environnement pour les clés | 🟡 Moyen | 🟢 Facile |
| 9 | Extraire une fonction de mapping API commune | 🟡 Moyen | 🟢 Facile |
| 10 | Supprimer les `require()` dynamiques dans BookDetail | 🟡 Moyen | 🟢 Facile |
| 11 | Découper les fichiers monolithiques | 🟡 Moyen | 🔴 Important |
| 12 | Migrer staticData.ts vers le backend | 🟠 Modéré | 🟡 Moyen |
| 13 | Ajouter ErrorBoundary | 🟠 Modéré | 🟢 Facile |
| 14 | Mettre en place un framework de tests | 🟠 Modéré | 🔴 Important |

---

> [!TIP]
> Les corrections 1 à 4 couvrent **~70% du gain de performance** et peuvent être faites en une session de travail. Si tu veux que je commence à implémenter certains de ces changements, dis-moi par lesquels tu veux commencer !
