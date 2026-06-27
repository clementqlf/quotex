# Audit DRY - Quotex

*Généré par Mistral Vibe - 23/06/2026*

---

## **🔴 DUPLICATIONS CRITIQUES (Risque Élevé)**

---

### **1. Appels API Inventaire.io (entities/by-uris & editions)**
**Emplacements :**
- `src/entities/book/lib/loadBookDetailData.ts`:81-89,101-117 (`fetchInventaireEntities`, `fetchInventaireEditions`)
- `src/entities/author/ui/AuthorDetail.tsx`:78-106 (`fetchExternalAuthorDetails`)

**Risque métier :**
Si l'API Inventaire.io change son endpoint, ses paramètres (`lang=fr`, `props=...`) ou son format de réponse, **les deux implémentations devront être modifiées séparément**. La logique de parsing des entités, de fallback des clés, et de construction des URLs est identique.

**Correction recommandée :**
```typescript
// src/shared/api/InventaireService.ts
export const fetchInventaireEntities = async (uris: string[]): Promise<Record<string, any>> => { ... }
export const fetchInventaireEditions = async (workUri: string): Promise<any[]> => { ... }
export const getInventaireImageUrl = (imageObj: any): string | null => { ... }
```

---

### **2. Appels SPARQL Wikidata**
**Emplacements :**
- `src/entities/author/api/WikidataService.ts`:15-50 (`runSPARQL` méthode privée)
- `src/features/prizes/ui/PrizeDetailScreen.tsx`:61-98 (`fetchExternalPrizeDetails`)

**Risque métier :**
`WikidataService.runSPARQL` gère déjà : **timeout (8s)**, **User-Agent**, **headers SPARQL**, **parsing Zod**, **gestion d'erreur offline**. `PrizeDetailScreen` duplique cette logique avec un timeout différent (6s). Si l'API Wikidata change son format de réponse ou ses requirements, **les deux devront être mis à jour**.

**Correction recommandée :**
Exporter `runSPARQL` depuis `WikidataService.ts` et l'utiliser dans `PrizeDetailScreen.tsx` avec un paramètre `timeout` optionnel.

---

### **3. Formatage de dates**
**Emplacements :**
- `src/shared/lib/dateUtils.ts`:37-47 (`formatAbsoluteDate`)
- `src/entities/author/ui/AuthorDetail.tsx`:109-123 (`formatDisplayDate`)

**Risque métier :**
`formatDisplayDate` réimplémente le parsing ISO (`(\d{4})-(\d{2})-(\d{2})`) et le formatage français, alors que `formatAbsoluteDate` existe déjà. Si le format de date attendu change, **les deux logiques devront être synchronisées**.

**Correction recommandée :**
Déplacer `formatDisplayDate` dans `dateUtils.ts` sous le nom `formatFlexibleDate` et l'utiliser partout.

---
---

## **🟡 DUPLICATIONS MOYENNES (Risque Modéré)**

---

### **4. Client HTTP Backend**
**Emplacements :**
- `src/shared/api/HttpClient.ts` (client centralisé avec auth JWT, headers, gestion d'erreur)
- **40+ fichiers** utilisant `fetch` directement : `PrizeDetailScreen.tsx`, `AuthorDetail.tsx`, `AuthorService.ts`, `BookSearchService.ts`, `ReviewService.ts`, `SupabaseQuoteRepository.ts`, etc.

**Risque métier :**
Chaque `fetch` direct duplique : **injection du token JWT**, **headers User-Agent**, **gestion des erreurs réseau**, **parsing JSON**. Si la stratégie d'authentification évolue (ex: passage à OAuth2 ou ajout d'un header obligatoire), **tous les appels devront être modifiés manuellement**.

**Correction recommandée :**
Migrer progressivement tous les appels backend vers `HttpClient`. Pour les appels externes (Inventaire, Wikidata, Wikipedia), utiliser des services dédiés.

---

### **5. Validation ISBN**
**Emplacements :**
- `src/features/scanner/api/ScanService.ts`:15 (schéma Zod : `/^(?:\d{10}|\d{13})$/`)
- `src/features/scanner/model/useIsbnScanner.ts`:23-27 (logique d'extraction : `/^(97[89])\d{10}$/` et `/^\d{9}[\dxX]$/i`)

**Risque métier :**
La validation dans Zod (`\d{10}|\d{13}`) est **moins stricte** que celle dans `extractIsbn` (qui valide le préfixe 978/979 pour ISBN-13 et le checksum pour ISBN-10). Si la règle métier d'acceptation des ISBN évolue, **les deux regex devront être synchronisées**.

**Correction recommandée :**
```typescript
// src/shared/lib/validation/isbn.ts
export const ISBN_REGEX = /^(97[89]\d{10})|(\d{9}[\dxX])$/i;
export const validateIsbn = (isbn: string): boolean => ISBN_REGEX.test(isbn.replace(/[-\s]/g, ''));
export const IsbnSchema = z.string().refine(validateIsbn);
```

---

### **6. Gestion des images Inventaire.io**
**Emplacements :**
- `src/entities/book/lib/loadBookDetailData.ts`:73-79 (`getInventaireImageUrl`)
- `src/entities/author/ui/AuthorDetail.tsx`:92-94 (logique inline similaire)

**Risque métier :**
Les deux fonctions transforment `{url: string}` ou `{file: string}` en URLs complètes (`https://inventaire.io/img/...`). Si Inventaire change son schéma d'URL, **les deux implémentations devront être modifiées**.

**Correction recommandée :**
Déplacer `getInventaireImageUrl` vers `src/shared/api/InventaireService.ts`.

---
---

## **✅ ÉLÉMENTS DÉJÀ BIEN CENTRALISÉS (Aucune action)**

| Logique | Emplacement | Utilisation |
|---------|-------------|-------------|
| `getAuthorName`, `getBookTitle` | `src/shared/lib/dataHelpers.ts` | 98+ utilisations |
| `extractIsbn` | `src/features/scanner/model/useIsbnScanner.ts` | 4 imports |
| `formatRelativeDate`, `formatAbsoluteDate` | `src/shared/lib/dateUtils.ts` | Multiple |
| `STATUS_OPTIONS`, `getStatusLabel` | `src/shared/lib/dataHelpers.ts` | Centralisé |

---
---

## **📊 SYNTHÈSE DES ACTIONS PRIORITAIRES**

| # | Action | Impact Maintenabilité | Effort | ROI |
|---|--------|----------------------|--------|-----|
| **1** | Créer `InventaireService.ts` avec `fetchInventaireEntities`, `fetchInventaireEditions`, `getInventaireImageUrl` | ✅ Élimine 3 duplications | Moyen | **Élevé** |
| **2** | Exporter et réutiliser `WikidataService.runSPARQL` | ✅ Élimine duplication SPARQL | Faible | **Élevé** |
| **3** | Centraliser `formatDisplayDate` dans `dateUtils.ts` | ✅ Élimine duplication formatage | Faible | **Élevé** |
| **4** | Créer `isbn.ts` avec validation centralisée | ✅ Élimine risque de désynchronisation regex | Faible | Moyen |
| **5** | Migrer `fetch` backend → `HttpClient` | ✅ Réduit risque auth | Élevé | **Élevé** |

---

### **Recommandation :**
Commencer par les **actions 1-3** (faible effort, haut impact). L'action 5 (migration HttpClient) doit être planifiée comme refactoring global. L'action 4 est optionnelle si la validation ISBN est considérée comme stable.

---

*Generated by Mistral Vibe.*
*Co-Authored-By: Mistral Vibe <vibe@mistral.ai>*