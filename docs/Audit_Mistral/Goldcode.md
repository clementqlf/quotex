# **AUDIT ARCHITECTURAL QUOTEX - GOLDCODE**

*Généré par Mistral Vibe - 23 Juin 2026*
*Conformité : React Native, Expo SDK récent, TypeScript Strict, Development Build*

---

## **🎯 OBJECTIF DE L'AUDIT**

Évaluer la maintenabilité, la performance réelle et la conformité architecturale selon les principes :
- **FSD & Co-location** : Structure par fonctionnalités
- **State Management** : TanStack Query (Server State) / Zustand (UI State partagé)
- **Performance** : FlashList, expo-image, optimisations justifiées
- **Solidité UGC** : Contraintes DB > Logique UI
- **Typage Strict** : Pas de `any` sur données externes
- **KISS** : Pas de refactorisation massive si >20% de réécriture

---

## **🔴 CRITIQUE - À CORRIGER EN PRIORITÉ**

---

### **FSD & Co-location**

**Fichier concerné :** `src/entities/book/ui/useBookDetailController.ts`
**Problème architectural/technique :** Fuite de logique métier + imports croisés entre features
**Justification technique :** Lignes 1-14 : imports directs de `features/scanner`, `features/edit-book`, `features/search`, `features/dictionary`. Lignes 29-49 : ouverture de modales de features depuis une entity. Mélange des couches (UI controller dans entity, ouverture de modales depuis features)
**Correction recommandée :**
```typescript
// Déplacer la logique modale dans shared/ui/modals/ ou utiliser des callbacks injectés
// Extraire useBookDataHook (data only) et useBookActionsHook (actions) séparément
```

---

**Fichier concerné :** `src/shared/ui/blocks/BlockDispatcher.tsx`
**Problème architectural/technique :** `ReviewBlock` dans entities/book/ au lieu de entities/review/
**Justification technique :** Ligne 2 : `import ReviewBlock from '@/src/entities/book/ui/ReviewBlock';` - La logique d'avis (UGC) devrait être isolée dans son propre domaine entity
**Correction recommandée :**
```typescript
// Créer src/entities/review/ui/ReviewBlock.tsx et y déplacer le composant
// Mettre à jour tous les imports
```

---

**Fichier concerné :** `src/entities/quote/ui/QuoteDetailModal.tsx`
**Problème architectural/technique :** 5 imports directs depuis features (app-tour, dictionary, edit-book, scanner, search)
**Justification technique :** Lignes 1, 41-45 : imports de `InteractiveTooltip`, `WordSelectionModal`, `AddBlockModal`, `ScanPreviewModal`, `ResourceSearchModal`
**Correction recommandée :**
```typescript
// Extraire les composants modaux dans shared/ui/modals/ avec injection de dépendances
// ou créer des hooks headless dans entities/ qui appellent les features
```

---

---

## **🔴 CRITIQUE - STATE MANAGEMENT**

---

### **Server State mal géré (doit être TanStack Query)**

**Fichier concerné :** `src/entities/quote/ui/QuoteDetailModal.tsx:346-347`
**Problème architectural/technique :** `useState` pour données API fetchées
**Justification technique :**
```typescript
const [fetchedBook, setFetchedBook] = React.useState<Book | null>(null);
const [fetchedAuthor, setFetchedAuthor] = React.useState<Author | null>(null);
```
Lignes 530-580 : useEffect avec fetch manuel et gestion d'erreur complexe. Risque de race conditions et pas de caching.
**Correction recommandée :**
```typescript
const { data: fetchedBook } = useQuery({
  queryKey: ['book', quote.bookId],
  queryFn: () => bookService.getById(quote.bookId),
  enabled: !!quote?.bookId,
  staleTime: 5 * 60 * 1000
});
const { data: fetchedAuthor } = useQuery({
  queryKey: ['author', quote.authorId],
  queryFn: () => authorService.getById(quote.authorId),
  enabled: !!quote?.authorId,
  staleTime: 5 * 60 * 1000
});
```

---

**Fichier concerné :** `src/entities/book/ui/useBookDetailController.ts:73-74`
**Problème architectural/technique :** `useState` + useEffect manuel pour Book/Author avec logique de charging complexe
**Justification technique :**
```typescript
const [bookInfo, setBookInfo] = useState<Book | null>(null);
const [authorInfo, setAuthorInfo] = useState<Author | null>(null);
```
Lignes 110-152 : useEffect avec 4 dépendances, fetch séquentiel, gestion de loading manuelle. Duplication avec QuoteDetailModal.
**Correction recommandée :**
```typescript
const { data: bookInfo, isLoading: isLoadingBook } = useQuery({
  queryKey: ['book', bookId, bookTitleParam, inventaireUriParam],
  queryFn: () => loadBookDetailData({ bookId, bookTitle: bookTitleParam, inventaireUri: inventaireUriParam }),
  enabled: !!bookId || !!bookTitleParam
});
```

**Fichier concerné :** `src/features/prizes/ui/PrizeDetailScreen.tsx:117`
**Problème architectural/technique :** `useState` pour LiteraryPrize avec fetch manuel
**Justification technique :**
```typescript
const [prize, setPrize] = useState<LiteraryPrize | null>(null);
```
Lignes 130-180 : fetch manuel sans cancellation, pas de retry, pas de caching. Risque de mémoire leak.
**Correction recommandée :**
```typescript
const { data: prize, isLoading, error } = useQuery({
  queryKey: ['prize', prizeId],
  queryFn: () => prizeService.getById(prizeId),
  enabled: !!prizeId,
  retry: 2
});
```

---

**Fichier concerné :** `src/features/quote/model/useRandomQuoteFlow.ts:50`
**Problème architectural/technique :** `useState` pour Quote random avec refetch manuel
**Justification technique :**
```typescript
const [randomQuote, setRandomQuote] = useState<Quote | null>(null);
```
Lignes 54-79 : fetch manuel avec setInterval. Pas de déduplication des requêtes.
**Correction recommandée :**
```typescript
const { data: randomQuote } = useQuery({
  queryKey: ['random-quote'],
  queryFn: () => quoteService.getRandom(),
  refetchInterval: 30000,
  refetchOnMount: true
});
```

---

**Fichier concerné :** `src/entities/author/ui/AuthorDetail.tsx:124-125`
**Problème architectural/technique :** `useState` pour Author + Books avec fetch manuel
**Justification technique :**
```typescript
const [authorInfo, setAuthorInfo] = React.useState<Author | null>(author || null);
const [authorBooks, setAuthorBooks] = React.useState<Book[]>([]);
```
Lignes 134-200 : 3 useEffect séparés pour fetch author, books, works. Pas de coordination entre les requêtes.
**Correction recommandée :**
```typescript
const { data: authorInfo } = useQuery({ queryKey: ['author', id], queryFn: () => authorService.getById(id), enabled: !!id });
const { data: authorBooks } = useQuery({ queryKey: ['author-books', id], queryFn: () => bookService.getByAuthor(id), enabled: !!id });
const { data: allWorks } = useQuery({ queryKey: ['author-works', id], queryFn: () => authorService.getWorks(id), enabled: !!id });
```

---

**Fichier concerné :** `src/features/search/ui/SearchScreen.tsx:43`
**Problème architectural/technique :** `useState` pour SearchResults avec fetch manuel
**Justification technique :**
```typescript
const [results, setResults] = useState<SearchResults>({ quotes: [], authors: [], books: [], themes: [], prizes: [], users: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] });
```
Lignes 80-150 : logique de recherche complexe avec debounce manuel, cancellation difficile.
**Correction recommandée :**
```typescript
const { data: results = emptyResults, isFetching } = useQuery({
  queryKey: ['search', query, searchType],
  queryFn: () => searchService.search({ query, type: searchType }),
  enabled: !!query && query.length >= 2,
  staleTime: 30000
});
```

---

### **UI State partagé : Zustand non utilisé**

**Fichier concerné :** `src/app/providers/AuthContext.tsx:31-33`
**Problème architectural/technique :** Context API + useState pour state global Auth
**Justification technique :**
```typescript
const [user, setUser] = useState<User | null>(null);
const [token, setToken] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);
```
State partagé entre toute l'app, nécessite QueryClient.clear() à la déconnexion. Pas de persistage automatique.
**Correction recommandée :**
```typescript
// src/shared/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User | null, token: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, token: null, isLoading: true,
      setAuth: (user, token) => set({ user, token, isLoading: false }),
      clearAuth: () => set({ user: null, token: null, isLoading: false })
    }),
    { name: 'auth-storage' }
  )
);
```

---

**Fichier concerné :** `src/app/providers/ThemeContext.tsx:20`
**Problème architectural/technique :** Context API + useState + AsyncStorage manuel pour Theme
**Justification technique :**
```typescript
const [themePreference, setThemePreferenceState] = useState<ThemePreference>('auto');
```
Lignes 25-40 : logique de synchronisation manuelle avec AsyncStorage. Pas de middleware de persistage.
**Correction recommandée :**
```typescript
// src/shared/stores/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'auto',
      setPreference: (pref) => set({ preference: pref })
    }),
    { name: 'theme-storage' }
  )
);
```

---

---

## **⚠️ PERFORMANCE - OPTIMISATIONS**

---

**Fichier concerné :** `src/features/my-quotes/ui/MyQuotesScreen.tsx:463-476`
**Problème architectural/technique :** useMemo avec dépendance fonction (anti-pattern)
**Justification technique :**
```typescript
const authors = useMemo(() => getAuthors(), [getAuthors]);
const books = useMemo(() => getBooksData(), [getBooksData]);
const bookCount = useMemo(() => getBookCount(), [getBookCount]);
const themes = useMemo(() => getThemes(), [getThemes]);
```
`getAuthors` etc. sont des fonctions recréées à chaque render. useMemo ne sert à rien ici et peut causer des re-renders inutiles.
**Correction recommandée :**
```typescript
// Supprimer useMemo - les appels de fonction sont déjà memoïzés par React si les dépendances sont stables
const authors = getAuthors();
const books = getBooksData();
```

---

**Fichier concerné :** `src/features/my-quotes/ui/MyQuotesScreen.tsx:812,840,868,896`
**Problème architectural/technique :** FlashList sans `estimatedItemSize` ni `removeClippedSubviews`
**Justification technique :** 4 instances de FlashList sans props de performance. Sans `estimatedItemSize`, FlashList mesure chaque item au premier rendu (saccades). Sans `removeClippedSubviews`, les items hors écran sont rendus (mémoire gaspillée).
**Correction recommandée :**
```typescript
<FlashList
  data={filteredQuotes}
  renderItem={renderQuoteItem}
  keyExtractor={(item) => `quote-${item.id}`}
  estimatedItemSize={QUOTE_CARD_HEIGHT}
  removeClippedSubviews={true}
  getItemType={(item) => item.type}
/>
```

---

**Fichier concerné :** `src/features/search/ui/ResourceSearchModal.tsx:165`
**Problème architectural/technique :** FlashList sans optimisation
**Justification technique :** FlashList pour résultats de recherche (50+ items potentiels) sans `estimatedItemSize` ni `removeClippedSubviews`
**Correction recommandée :**
```typescript
<FlashList
  data={filteredResults}
  renderItem={renderResultItem}
  keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
  estimatedItemSize={80}
  removeClippedSubviews={true}
/>
```

---

**Fichier concerné :** `src/features/prizes/ui/PrizeDetailScreen.tsx:387`
**Problème architectural/technique :** FlashList sans optimisation
**Justification technique :** FlashList pour lauréats sans props de performance
**Correction recommandée :**
```typescript
<FlashList
  data={winners}
  renderItem={renderWinnerItem}
  keyExtractor={(item) => `winner-${item.id}`}
  estimatedItemSize={100}
  removeClippedSubviews={true}
  horizontal={true}
/>
```

---

**Fichier concerné :** `src/entities/author/ui/AuthorDetail.tsx:764,840`
**Problème architectural/technique :** FlashList sans optimisation (2 instances)
**Justification technique :** FlashList pour similar books et saved quotes sans `estimatedItemSize`
**Correction recommandée :**
```typescript
<FlashList
  data={similarBooks}
  renderItem={renderBookItem}
  keyExtractor={(item) => `similar-book-${item.id}`}
  estimatedItemSize={150}
  removeClippedSubviews={true}
  horizontal={true}
/>
```

---

**Fichier concerné :** `src/entities/user/ui/UserProfile.tsx:1008`
**Problème architectural/technique :** FlashList sans optimisation
**Justification technique :** FlashList pour quotes utilisateur sans props de performance
**Correction recommandée :**
```typescript
<FlashList
  data={userQuotes}
  renderItem={renderQuoteItem}
  keyExtractor={(item) => `user-quote-${item.id}`}
  estimatedItemSize={200}
  removeClippedSubviews={true}
  numColumns={2}
/>
```

---

---

## **✅ CONFORME - SOLIDITÉ UGC**

---

**Fichier concerné :** `src/supabase/migrations/20260611000003_add_review_unique_constraint.sql:41-43`
**Problème architectural/technique :** Aucun - Contrainte DB conforme
**Justification technique :**
```sql
ALTER TABLE "Review"
ADD CONSTRAINT "Review_userId_bookId_key"
UNIQUE ("userId", "bookId");
```
La règle "1 avis / utilisateur / ouvrage" est bien enforcée en base de données.
**Correction recommandée :** ❌ Aucune - déjà conforme

---

**Fichier concerné :** `src/supabase/functions/reviews/index.ts`
**Problème architectural/technique :** Pas de gestion explicite de l'erreur 409 pour doublon
**Justification technique :** POST /reviews (lignes 46-73) n'implémente pas de check pré-INSERT ni ne capture l'erreur de contrainte unique pour retourner un message utilisateur clair
**Correction recommandée :**
```typescript
// Dans la fonction Supabase, avant INSERT :
const { data: existing } = await supabase
  .from('Review')
  .select('id')
  .eq('userId', authUser.id)
  .eq('bookId', bookId)
  .maybeSingle();

if (existing) {
  throw new Error('Vous avez déjà publié un avis pour ce livre');
}
// Ou capturer l'erreur de contrainte :
try {
  const { data, error } = await supabase.from('Review').insert(review);
  if (error?.code === '23505') { // UNIQUE_VIOLATION
    throw new Error('Vous avez déjà publié un avis pour ce livre');
  }
} catch (err) {
  // ...
}
```

---

---

## **🔴 CRITIQUE - TYPAGE STRICT**

---

### **Données Externes (API Inventaire.io)**

**Fichier concerné :** `src/shared/api/InventaireService.ts:15,29,41,54`
**Problème architectural/technique :** Types `any` pour réponses API externes critiques
**Justification technique :**
```typescript
export const getInventaireImageUrl = (imageObj: any): string | null => {
export const resolveInventaireEntity = (entities: Record<string, any>, uri: string): any | null => {
export const fetchInventaireEntities = async (uris: string[], props?: string): Promise<Record<string, any>> => {
export const fetchInventaireEditions = async (workUri: string): Promise<any[]> => {
```
Ces fonctions sont utilisées dans le flow principal (scan, recherche, enrichissement). Un `any` ici peut causer des plantages en production si la structure change.
**Correction recommandée :**
```typescript
interface InventaireImage {
  url?: string;
  file?: string;
  thumbnail?: string;
}

interface InventaireEntity {
  uri: string;
  type: 'work' | 'author' | 'series';
  label?: string;
  title?: string;
  description?: string;
  image?: InventaireImage | string;
  cover?: InventaireImage | string;
  authors?: string[];
  authorUris?: string[];
  year?: number;
  pages?: number;
}

export const getInventaireImageUrl = (imageObj: InventaireImage | string | null): string | null => {
  if (!imageObj) return null;
  if (typeof imageObj === 'string') return imageObj;
  return imageObj.url || imageObj.thumbnail || null;
};

export const resolveInventaireEntity = (
  entities: Record<string, InventaireEntity>,
  uri: string
): InventaireEntity | null => {
```

---

**Fichier concerné :** `src/shared/api/HttpClient.ts:108,127,136,159,167,175`
**Problème architectural/technique :** Types `any` et casts dangereux
**Justification technique :**
```typescript
return null as any;  // Lignes 108, 127
return (await response.text()) as any;  // Ligne 136
body: any,  // Lignes 159, 167, 175
```
`as any` cache des erreurs de typage. Si l'API retourne une structure inattendue, le code plantera en runtime sans avertissement.
**Correction recommandée :**
```typescript
// Générique safe
public async post<T, BodyType = unknown>(
  path: string,
  body: BodyType,
  options?: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> {
  // ...
  return this.request<T>('POST', path, { ...options, body });
}

// Ne JAMAIS utiliser 'as any' - utiliser unknown et validation
private async parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return json as T; // Cast safe si T est correct
  } catch {
    throw new Error(`Failed to parse response: ${text}`);
  }
}
```

---

**Fichier concerné :** `src/shared/api/staticData.ts:211,213`
**Problème architectural/technique :** `any[]` pour bases de données locales
**Justification technique :**
```typescript
export const localQuotesDB: any[] = [];
export const globalQuotesDB: any[] = [];
```
Ces bases sont utilisées pour le storage local et la synchronisation. Un typage incorrect peut causer des corruption de données.
**Correction recommandée :**
```typescript
export const localQuotesDB: Quote[] = [];
export const globalQuotesDB: Quote[] = [];
```

---

**Fichier concerné :** `src/shared/types/api-contracts.ts:44`
**Problème architectural/technique :** `payload?: any` dans OfflineOperationContract
**Justification technique :**
```typescript
export interface OfflineOperationContract {
  // ...
  payload?: any;
}
```
Ce type est utilisé pour la queue d'opérations offline. Un `any` ici empêche toute validation des données avant synchronisation.
**Correction recommandée :**
```typescript
type OperationPayload =
  | { type: 'LIKE'; quoteId: number }
  | { type: 'UNLIKE'; quoteId: number }
  | { type: 'SAVE'; quoteId: number }
  | { type: 'UNSAVE'; quoteId: number }
  | { type: 'CREATE_QUOTE'; quote: Partial<Quote> }
  | { type: 'UPDATE_QUOTE'; quoteId: number; data: Partial<Quote> }
  | { type: 'DELETE_QUOTE'; quoteId: number };

export interface OfflineOperationContract {
  id: string;
  type: OperationType;
  entityId: number | string;
  entityType: EntityType;
  payload: OperationPayload;
  createdAt: number;
  retryCount: number;
}
```

---

**Fichier concerné :** `src/features/search/api/SearchService.ts:11-15`
**Problème architectural/technique :** `any[]` pour résultats Inventaire
**Justification technique :**
```typescript
prizes: any[];
inventaireWorks?: any[];
inventaireAuthors?: any[];
inventairePrizes?: any[];
```
Ces champs sont utilisés dans les résultats de recherche affichés à l'utilisateur. Un typage incorrect peut causer des crashes sur accès à des propriétés inexistantes.
**Correction recommandée :**
```typescript
interface SearchResults {
  quotes: Quote[];
  authors: Author[];
  books: Book[];
  themes: Theme[];
  prizes: LiteraryPrize[];
  users: User[];
  inventaireWorks?: InventaireWork[];
  inventaireAuthors?: InventaireAuthor[];
  inventairePrizes?: InventairePrize[];
}
```

---

**Fichier concerné :** `src/shared/ui/blocks/SimilarBooksBlock.tsx:10`
**Problème architectural/technique :** Prop type `any[]` pour books
**Justification technique :**
```typescript
interface SimilarBooksBlockProps {
  books: (Book | any)[];
}
```
Acceptation de `any` dans les props expose le composant à des données malformées.
**Correction recommandée :**
```typescript
interface SimilarBooksBlockProps {
  books: Book[];
}
```

---

**Fichier concerné :** `src/features/scanner/model/useScanController.ts:46-47`
**Problème architectural/technique :** Types `any` pour device et format
**Justification technique :**
```typescript
device: any;
format: any;
```
Utilisés avec react-native-vision-camera. Peut causer des erreurs si les propriétés attendues ne sont pas présentes.
**Correction recommandée :**
```typescript
import type { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';

device: CameraDevice | null;
format: CameraDeviceFormat | null;
```

---

**Fichier concerné :** `src/features/scanner/model/mlKitParser.ts`
**Problème architectural/technique :** Types `any` pour résultats OCR/ML Kit
**Justification technique :** Analyse ML Kit (OCR) avec `any` - risque élevé de plantage si le format change
**Correction recommandée :**
```typescript
interface MLKitTextBlock {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  cornerPoints?: { x: number; y: number }[];
}

interface MLKitTextElement {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface MLKitResult {
  textBlocks: MLKitTextBlock[];
  textElements: MLKitTextElement[];
}
```

---

**Fichier concerné :** `src/features/scanner/api/ScanService.ts`
**Problème architectural/technique :** Types `any` pour résultats OCR et IA
**Justification technique :** ScanService utilise Groq (IA) et OCR avec typage `any` - point critique pour la stabilité
**Correction recommandée :**
```typescript
interface OCRResult {
  text: string;
  blocks: MLKitTextBlock[];
  confidence?: number;
}

interface GroqAnalysisResult {
  author?: { name: string; confidence: number };
  title?: { name: string; confidence: number };
  isbn?: { code: string; confidence: number };
  error?: string;
}
```

---

**Fichier concerné :** `src/shared/api/BlockService.ts:69,74,82,87`
**Problème architectural/technique :** `Record<string, any>` pour block data
**Justification technique :**
```typescript
async getBlockData(...): Promise<Record<string, any>>
async saveBlockData(..., data: Record<string, any>)
```
BlockService gère le storage des blocs personnalisés. Un typage incorrect peut causer des perte de données.
**Correction recommandée :**
```typescript
type BlockData = Record<string, unknown>; // ou type spécifique par type de bloc
// Avec validation:
function isValidBlockData(data: unknown): data is BlockData {
  return data != null && typeof data === 'object';
}
```

---

**Fichier concerné :** `src/shared/config/stores.ts`
**Problème architectural/technique :** `any` dans configuration des stores
**Justification technique :** Configuration critique pour le storage - `any` empêche toute validation
**Correction recommandée :**
```typescript
export const STORAGE_KEYS = {
  AUTH: 'auth-data',
  THEME: 'theme-preference',
  BLOCK_DATA: 'block-data-v2',
  OFFLINE_QUEUE: 'offline-queue',
  // ... tous les autres avec typage string literal
} as const;

type StorageKey = keyof typeof STORAGE_KEYS;
```

---

---

## **📊 RÉSUMÉ EXÉCUTIF**

---

| **Catégorie** | **Problèmes** | **Fichiers Critiques** | **Sévérité** | **Impact** |
|---------------|--------------|------------------------|--------------|------------|
| **FSD** | 3 violations d'isolation | useBookDetailController, QuoteDetailModal, BlockDispatcher | ⚠️ Moyen | Maintenabilité |
| **State Mgmt - Server** | 6+ useState pour API | QuoteDetailModal, useBookDetailController, PrizeDetail, RandomQuote, AuthorDetail, SearchScreen | 🔴 **Critique** | Plantages, Race Conditions |
| **State Mgmt - UI** | Zustand non utilisé | AuthContext, ThemeContext | 🟡 Moyen | Complexité inutile |
| **Performance** | useMemo inutiles | MyQuotesScreen | ⚠️ Faible | Re-renders inutiles |
| **Performance** | FlashList non optimisé | 6 fichiers | 🟡 Moyen | Saccades scroll, mémoire |
| **Typage** | 50+ `any` | InventaireService, HttpClient, api-contracts, SearchService, staticData, mlKitParser, ScanService, BlockService | 🔴 **Critique** | Plantages production |
| **DB** | Contrainte OK, erreur 409 non gérée | reviews/index.ts | ⚠️ Faible | UX améliorable |
| **KISS (>20%)** | 6 fichiers | useBookDetailController, QuoteDetailModal, MyQuotesScreen, useScanController, PrizeDetail, SearchScreen | 🔴 **Critique** | Réécriture nécessaire |

---

## **🎯 RECOMMANDATIONS PRIORISÉES**

### **Phase 1 - Urgent (1-2 jours)**
1. **Remplacer tous les `useState` pour données API** par `useQuery` (6 fichiers identifiés)
2. **Typage strict des APIs externes** (InventaireService, HttpClient, ScanService)
3. **Créer stores Zustand** pour Auth et Theme

### **Phase 2 - Important (3-5 jours)**
4. **Optimiser FlashList** avec `estimatedItemSize` et `removeClippedSubviews`
5. **Corriger types `any`** dans api-contracts, BlockService, SearchService
6. **Isoler ReviewBlock** dans entities/review/

### **Phase 3 - Amélioration (1 semaine+)**
7. **Réorganiser FSD** : extraire modales dans shared/, séparer hooks data/actions
8. **Refactoriser fichiers >20%** (useBookDetailController, QuoteDetailModal, MyQuotesScreen)

---

## **📈 MÉTRIQUES ACTUELLES**

- **TanStack Query utilisé :** ✅ 32 occurrences (providers)
- **Zustand utilisé :** ❌ 0 occurrences
- **FlashList utilisé :** ✅ 6 fichiers (mais non optimisé)
- **expo-image utilisé :** ✅ Partout (remplace Image RN)
- **Contrainte DB UNIQUE :** ✅ Enforcée
- **Typage any :** 🔴 50+ occurrences
- **useState pour API :** 🔴 16+ occurrences

---

*Document généré automatiquement - Ne pas modifier manuellement*
*Generated by Mistral Vibe.*
*Co-Authored-By: Mistral Vibe <vibe@mistral.ai>*
