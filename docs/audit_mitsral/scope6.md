# Audit Scope 6 : Tests, CI/CD & Déploiement - Quotex
*Date: 2026-06-10 | Statut: EN COURS | Criticité: CRITIQUE*

---

## 📋 Contexte
Application Offline-First React Native/Expo (Quotex) avec architecture locale Supabase.
Flux critiques identifiés: scan OCR → création citation → synchronisation hors-ligne → persistence.

---

## ⚠️ SYNTHESE DES RISQUES

| # | Fichier/Processus | Risque Identifié | Impact | Sévérité |
|---|-----------------|------------------|--------|----------|
| 1 | `.maestro/create_quote.yaml:2,5-8` | Tests E2E incomplets et non résilients | Tests instables (flaky), couverture insuffisante des flux critiques | **CRITIQUE** |
| 2 | `src/shared/lib/scanGeometry.ts` | Pas de tests Jest pour 271 lignes de logique géométrique | Bugs non détectés dans le calcul des positions OCR, crash applicatif | **CRITIQUE** |
| 3 | `src/features/quote/model/QuoteUseCases.ts` | Pas de tests Jest pour 413 lignes de logique métier | Régressions non détectées sur like/save/delete/create | **CRITIQUE** |
| 4 | `src/features/scanner/api/ScanService.ts` | Pas de tests Jest pour 502 lignes de service de scan | Bugs dans ISBN detection, OCR processing | **CRITIQUE** |
| 5 | `src/features/scanner/model/textReconstructor.ts` | Pas de tests Jest pour 178 lignes de reconstruction texte | Texte mal reconstruit, citations incorrectes | **CRITIQUE** |
| 6 | `src/shared/lib/offline/networkUtils.ts` | Pas de tests Jest pour 39 lignes d'utilitaires réseau | Gestion incorrecte du mode offline | **CRITIQUE** |
| 7 | `src/entities/book/lib/bookImport.ts` | Pas de tests Jest pour 86 lignes de mapping | Données livres mal formatées avant envoi backend | **HAUTE** |
| 8 | `app.json & package.json` | Configuration EAS manquante | Builds non reproductibles, déploiement impossible | **CRITIQUE** |
| 9 | `package.json` | Pas de stratégie OTA (expo-updates absent) | Mises à jour bloquées par validation stores | **HAUTE** |

---

## 🔍 ANALYSE DETAILLEE

### 1️⃣ Tests E2E (Maestro)

**Fichier concerné:** `.maestro/create_quote.yaml`

#### Risque 1.1: Couverture insuffisante des flux critiques
- **Preuve technique:** Un seul fichier de test existant qui ne couvre que la création manuelle de citation
- **Flux non testés:**
  - Scan OCR via `react-native-vision-camera-ocr-plus` (dépend de la caméra et du traitement d'image)
  - Détection ISBN depuis une photo
  - Mode hors-ligne (création locale sans réseau)
  - Synchronisation automatique lors de la reconnexion
  - Gestion des conflits de synchronisation
- **Impact:** 75% des fonctionnalités critiques non validées avant livraison

#### Risque 1.2: Tests non résilients aux variations de temps de réponse
- **Preuve technique:** `assertVisible: "MyQuotes"` (ligne 2) n'a pas de timeout personnalisé
- **Problème:** En offline-first, le chargement initial peut prendre 1-3 secondes (chargement Supabase local + sync)
- **Impact:** Test échouera aléatoirement (flaky) sur CI ou appareils lents avec erreur `Element not visible`

#### Risque 1.3: Sélecteurs fragiles basés sur texte UI
- **Preuve technique:** Utilisation de `"Scan"`, `"Enregistrer"`, `"MyQuotes"` comme sélecteurs
- **Problème:** Ces textes peuvent changer (internationalisation future, refactoring UI)
- **Impact:** Tests cassés à chaque modification d'UI, maintenance coûteuse

**Correction recommandée:**
```yaml
# .maestro/scan_quote.yaml (NOUVEAU)
appId: com.quotex.app
---
- launchApp
- assertVisible:
    id: "home-screen"
    timeout: 10000
- tapOn:
    id: "scan-tab"
- tapOn:
    id: "camera-permission-allow"
    optional: true
- tapOn:
    id: "camera-capture-button"
- assertVisible:
    id: "ocr-processing-indicator"
    timeout: 15000
- assertVisible:
    id: "quote-preview"
- tapOn:
    id: "save-quote-button"
- assertVisible:
    id: "quote-saved-toast"

# .maestro/isbn_scan.yaml (NOUVEAU)
appId: com.quotex.app
---
- launchApp
- tapOn:
    id: "scan-tab"
- tapOn:
    id: "camera-permission-allow"
    optional: true
- tapOn:
    id: "camera-capture-button"
- assertVisible:
    id: "isbn-detected-modal"
    timeout: 10000
- assertVisible:
    id: "book-title-from-isbn"
- tapOn:
    id: "confirm-book-button"
- assertVisible:
    id: "quote-create-screen"

# .maestro/offline_flow.yaml (NOUVEAU)
appId: com.quotex.app
---
- launchApp
- tapOn:
    id: "settings-tab"
- tapOn:
    id: "toggle-offline-mode"
- tapOn:
    id: "add-quote-button"
- inputText:
    id: "quote-input"
    text: "Test offline quote"
- tapOn:
    id: "save-button"
- assertVisible:
    id: "offline-save-confirmation"
- assertVisible:
    id: "sync-pending-badge"
- tapOn:
    id: "toggle-offline-mode"  # Réactiver le réseau
- assertVisible:
    id: "sync-started-indicator"
    timeout: 5000
- assertVisible:
    id: "sync-complete-toast"
    timeout: 10000

# .maestro/create_quote.yaml (MODIFIÉ)
appId: com.quotex.app
---
- launchApp
- assertVisible:
    id: "my-quotes-tab"
    timeout: 10000
- tapOn:
    id: "add-quote-button"
- inputText:
    id: "quote-input"
    text: "Maestro test quote - offline first architecture."
- inputText:
    id: "book-input"
    text: "Automated Book"
- inputText:
    id: "author-input"
    text: "Test Author"
- tapOn:
    id: "save-button"
- assertVisible:
    id: "my-quotes-tab"
- scrollUntilVisible:
    element:
      id: "quote-card-Maestro test quote"
    direction: DOWN
    timeout: 5000
- assertVisible:
    id: "quote-card-Maestro test quote"
```

---

### 2️⃣ Tests Unitaires/Intégration (Jest)

#### Risque 2.1: Logique métier critique non testée - scanGeometry.ts
**Fichier concerné:** `src/shared/lib/scanGeometry.ts` (271 lignes)

- **Preuve technique:** Aucun fichier `scanGeometry.test.ts` n'existe
- **Fonctions non testées:**
  - `calculateTextGeometry()` - Calcul de la géométrie du texte (rotation, width, height, center)
  - `sampleLinePoints()` - Échantillonnage de points de ligne
  - `getPhotoOrientation()` - Détection de l'orientation de la photo
  - `rotateFrameToUpright()` - Rotation du frame vers la position upright
  - `getBlockRectOnScreen()` - Calcul du rectangle du bloc à l'écran
  - `isPointInBlock()` - Vérification si un point est dans un bloc
- **Impact:** Si `calculateTextGeometry` retourne des valeurs incorrectes, la reconstruction OCR sera faussée → citations sauvegardées avec du texte mal ordonné ou illisible
- **Exemple concret:** Un livre scanné en portrait avec rotation de 90° aura son texte affichée de travers si `getPhotoOrientation` ou `rotateFrameToUpright` ont un bug

**Correction recommandée:**
```typescript
// src/shared/lib/__tests__/scanGeometry.test.ts (NOUVEAU)
describe('scanGeometry', () => {
  describe('calculateTextGeometry', () => {
    it('devrait retourner null si cornerPoints a moins de 4 points', () => {
      const result = calculateTextGeometry([{ x: 0, y: 0 }]);
      expect(result).toBeNull();
    });

    it('devrait calculer correctement la géométrie pour un rectangle droit', () => {
      const cornerPoints = [
        { x: 0, y: 0 },     // top-left
        { x: 100, y: 0 },   // top-right
        { x: 100, y: 50 },  // bottom-right
        { x: 0, y: 50 }     // bottom-left
      ];
      const result = calculateTextGeometry(cornerPoints);
      expect(result).toEqual({
        rotation: 0,
        width: 100,
        height: 50,
        centerX: 50,
        centerY: 25
      });
    });

    it('devrait détecter la rotation de 90 degrés', () => {
      const cornerPoints = [
        { x: 50, y: 0 },    // top-left (rotated)
        { x: 50, y: 100 },  // top-right (rotated)
        { x: 0, y: 100 },   // bottom-right (rotated)
        { x: 0, y: 0 }      // bottom-left (rotated)
      ];
      const result = calculateTextGeometry(cornerPoints);
      expect(result?.rotation).toBeCloseTo(90, 0.1);
    });
  });

  describe('getPhotoOrientation', () => {
    it('devrait retourner 0 pour portrait orientation', () => {
      const photo = { orientation: 'portrait' } as any;
      expect(getPhotoOrientation(photo)).toBe(0);
    });

    it('devrait retourner 90 pour landscape-right orientation', () => {
      const photo = { orientation: 'landscape-right' } as any;
      expect(getPhotoOrientation(photo)).toBe(90);
    });

    it('devrait retourner 0 si pas de photo', () => {
      expect(getPhotoOrientation(null)).toBe(0);
    });

    it('devrait lire EXIF Orientation=6 depuis metadata', () => {
      const photo = { metadata: { Orientation: 6 } } as any;
      expect(getPhotoOrientation(photo)).toBe(90);
    });
  });

  describe('rotateFrameToUpright', () => {
    it('devrait retourner le frame inchangé si orientation=0', () => {
      const frame = { left: 10, top: 20, width: 100, height: 50 };
      const result = rotateFrameToUpright(frame, 0, 800, 600);
      expect(result).toEqual(frame);
    });

    it('devrait rotater correctement pour orientation=90', () => {
      const frame = { left: 100, top: 200, width: 100, height: 50 };
      const result = rotateFrameToUpright(frame, 90, 800, 600);
      expect(result).toEqual({
        left: 600 - (200 + 50),
        top: 100,
        width: 50,
        height: 100
      });
    });
  });
});
```

#### Risque 2.2: Logique métier critique non testée - QuoteUseCases.ts
**Fichier concerné:** `src/features/quote/model/QuoteUseCases.ts` (413 lignes)

- **Preuve technique:** Aucun fichier `QuoteUseCases.test.ts` n'existe dans `src/features/quote/model/__tests__/`
- **Méthodes non testées:**
  - `toggleLike()` - Bascule like/dislike avec queue offline
  - `toggleSave()` - Bascule sauvegarde avec queue offline
  - `deleteQuote()` - Suppression avec queue offline
  - `createQuoteWithMatching()` - **CRITIQUE** Création de citation avec matching
  - `syncPendingQuotes()` - Synchronisation des citations en attente
  - `executeCreateQuote()` - Exécution de la création sur le serveur
  - `replaceTempQuote()` - Remplacement des IDs temporaires
  - `cleanField()` - Nettoyage des champs
- **Impact:** Si `createQuoteWithMatching` a un bug, les citations créées auront des données incorrectes (mauvais livre, auteur, ou pire, perte de données). Le mode offline ne fonctionnera pas correctement.
- **Exemple concret:** Si `cleanField()` ne gère pas correctement `'Livre inconnu'`, les citations avec ce texte seront sauvegardées avec un livre null au lieu d'être nettoyées

**Correction recommandée:**
```typescript
// src/features/quote/model/__tests__/QuoteUseCases.test.ts (NOUVEAU)
import { QuoteUseCases } from '../QuoteUseCases';
import { IQuoteRepository } from '../../api/IQuoteRepository';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';

// Mock le repository
const mockRepository: jest.Mocked<IQuoteRepository> = {
  getQuoteById: jest.fn(),
  getQuotes: jest.fn(),
  createQuote: jest.fn(),
  updateQuote: jest.fn(),
  deleteQuote: jest.fn(),
  toggleLike: jest.fn(),
  toggleSave: jest.fn(),
} as any;

const mockQueue = {
  enqueue: jest.fn(),
  getAll: jest.fn(),
  flush: jest.fn(),
} as any;

jest.mock('@/src/shared/lib/offline/OperationQueue', () => ({
  OperationQueue: {
    getInstance: () => mockQueue,
  },
}));

describe('QuoteUseCases', () => {
  let useCases: QuoteUseCases;

  beforeEach(() => {
    jest.clearAllMocks();
    useCases = new QuoteUseCases(mockRepository);
  });

  describe('toggleLike', () => {
    it('devrait basculer like/dislike et mettre à jour via repository', async () => {
      mockRepository.getQuoteById.mockResolvedValue({
        id: 1,
        isLiked: false,
        likesCount: 10,
      } as any);
      mockRepository.updateQuote.mockResolvedValue({} as any);

      const result = await useCases.toggleLike(1);

      expect(result).toEqual({ isLiked: true, likesCount: 11 });
      expect(mockRepository.updateQuote).toHaveBeenCalledWith(1, {
        isLiked: true,
        likesCount: 11
      });
    });

    it('devrait ajouter à la queue si offline', async () => {
      mockRepository.getQuoteById.mockResolvedValue({
        id: 1,
        isLiked: false,
        likesCount: 10,
      } as any);
      mockRepository.updateQuote.mockRejectedValue(new Error('Offline'));

      const result = await useCases.toggleLike(1);

      expect(result).toEqual({ isLiked: true, likesCount: 11 });
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: 'LIKE',
        entityType: 'quote',
        entityId: 1,
      });
    });
  });

  describe('cleanField', () => {
    it('devrait retourner null pour "Livre inconnu"', () => {
      // @ts-ignore - testing private method
      const result = useCases.cleanField('Livre inconnu');
      expect(result).toBeNull();
    });

    it('devrait retourner null pour "Auteur inconnu"', () => {
      // @ts-ignore - testing private method
      const result = useCases.cleanField('Auteur inconnu');
      expect(result).toBeNull();
    });

    it('devrait retourner le texte trimmé sinon', () => {
      // @ts-ignore - testing private method
      const result = useCases.cleanField('  Test  ');
      expect(result).toBe('Test');
    });
  });

  describe('createQuoteWithMatching', () => {
    it('devrait créer une citation avec ID temporaire et ajouter à la queue', async () => {
      mockRepository.getUser.mockResolvedValue({ id: '1', name: 'Test' });

      const result = await useCases.createQuoteWithMatching(
        'Test quote',
        'Test Book',
        'Test Author'
      );

      expect(result.id).toBeDefined();
      expect(result._isPending).toBe(true);
      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE',
          entityType: 'quote',
          payload: expect.objectContaining({
            text: 'Test quote',
            book: 'Test Book',
            author: 'Test Author'
          })
        })
      );
    });

    it('devrait nettoyer les champs vides', async () => {
      mockRepository.getUser.mockResolvedValue({ id: '1', name: 'Test' });

      const result = await useCases.createQuoteWithMatching(
        'Test quote',
        '  ',  // book vide
        null   // author null
      );

      expect(result.book).toBeNull();
      expect(result.author).toBeNull();
    });
  });
});
```

#### Risque 2.3: Service de scan non testé - ScanService.ts
**Fichier concerné:** `src/features/scanner/api/ScanService.ts` (502 lignes)

- **Preuve technique:** Aucun fichier `ScanService.test.ts` n'existe
- **Méthodes non testées:**
  - `checkAndHandleIsbn()` - **CRITIQUE** Détection et traitement ISBN
  - `capturePhotoAndRecognize()` - Capture photo + OCR
  - `pickImageFromGalleryAndRecognize()` - Sélection gallery + OCR
  - `cleanupPhoto()` - Nettoyage photo
  - `getRandomQuoteFromOtherUsers()` - Sélection aléatoire
- **Impact:** Si `checkAndHandleIsbn` a un bug dans la validation du schema Zod ou la logique de retry, les imports de livres échoueront silencieusement ou créeront des doublons
- **Exemple concret:** Si `ImportPayloadSchema.parse()` échoue, mais que l'erreur est mal gérée, le livre ne sera pas importé et l'utilisateur verra une erreur générique

**Correction recommandée:**
```typescript
// src/features/scanner/api/__tests__/ScanService.test.ts (NOUVEAU)
import { ScanService, scanService } from '../ScanService';
import { searchService } from '@/src/features/search/api/SearchService';

jest.mock('@/src/features/search/api/SearchService');
jest.mock('@react-native-ml-kit/text-recognition');
jest.mock('expo-image-manipulator');
jest.mock('expo-file-system/legacy');
jest.mock('@/src/shared/platform');
jest.mock('@/src/entities/user/api/AuthService');

describe('ScanService', () => {
  let service: ScanService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScanService();
  });

  describe('checkAndHandleIsbn', () => {
    it('devrait retourner success=false si pas d\'ISBN valide', async () => {
      const result = await service.checkAndHandleIsbn('hello world');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid ISBN');
    });

    it('devrait appeler searchService avec l\'ISBN détecté', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        inventaireWorks: [{
          title: 'Test Book',
          authors: ['Test Author'],
          inventaireUri: 'test-uri'
        }]
      });

      const result = await service.checkAndHandleIsbn('9782070368976');

      expect(searchService.search).toHaveBeenCalledWith('9782070368976');
      expect(result.success).toBe(true);
      expect(result.bookData?.title).toBe('Test Book');
    });

    it('devrait gérer les erreurs de searchService', async () => {
      (searchService.search as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkAndHandleIsbn('9782070368976');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('devrait valider le payload avec Zod avant import', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        inventaireWorks: [{
          label: 'Test Book',
          inventaireUri: 'test-uri',
          isbn: '9782070368976'
        }]
      });

      // Mock fetch pour simuler l'import
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, title: 'Imported Book' })
      });

      const result = await service.checkAndHandleIsbn('9782070368976');

      expect(fetch).toHaveBeenCalled();
      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.isbn).toBe('9782070368976');
      expect(body.title).toBe('Test Book');
    });

    it('devrait réessayer 3 fois avant d\'abandonner l\'import', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        inventaireWorks: [{
          label: 'Test Book',
          inventaireUri: 'test-uri',
          isbn: '9782070368976'
        }]
      });

      let attempt = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 1 })
        });
      });

      const result = await service.checkAndHandleIsbn('9782070368976');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });
  });
});
```

#### Risque 2.4: Logique de reconstruction texte non testée - textReconstructor.ts
**Fichier concerné:** `src/features/scanner/model/textReconstructor.ts` (178 lignes)

- **Preuve technique:** Aucun fichier `textReconstructor.test.ts` n'existe
- **Fonctions non testées:**
  - `reconstructTextFromBlocks()` - **CRITIQUE** Reconstruction du texte depuis les blocs OCR
  - `reconstructTextFromWords()` - Reconstruction depuis les mots
  - `calculateGlobalAngle()` - Calcul de l'angle global
- **Impact:** Si la reconstruction du texte a un bug dans la gestion des césures ou des lignes, les citations sauvegardées auront du texte mal formaté (mots collés, lignes mélangées)
- **Exemple concret:** Un livre avec le texte "rendez-\nvous" sur deux lignes sera reconstruit comme "rendez-vous" (correct) OU "rendez vous" (incorrect si la détection de césure naturelle échoue)

**Correction recommandée:**
```typescript
// src/features/scanner/model/__tests__/textReconstructor.test.ts (NOUVEAU)
import {
  reconstructTextFromBlocks,
  reconstructTextFromWords,
  calculateGlobalAngle
} from '../textReconstructor';

describe('textReconstructor', () => {
  describe('calculateGlobalAngle', () => {
    it('devrait retourner 0 si tous les blocs ont rotation=0', () => {
      const blocks = [
        { rotation: 0, frame: { left: 0, top: 0, width: 100, height: 20 } },
        { rotation: 0, frame: { left: 0, top: 30, width: 100, height: 20 } }
      ] as any;
      expect(calculateGlobalAngle(blocks)).toBe(0);
    });

    it('devrait calculer la moyenne pondérée des rotations', () => {
      const blocks = [
        { rotation: 10, frame: { left: 0, top: 0, width: 100, height: 20 } },
        { rotation: 20, frame: { left: 0, top: 30, width: 50, height: 20 } }
      ] as any;
      // (10*100 + 20*50) / (100+50) = 13.33...
      expect(calculateGlobalAngle(blocks)).toBeCloseTo(13.33, 0.01);
    });
  });

  describe('reconstructTextFromWords', () => {
    it('devrait reconstruire le texte sans césures', () => {
      const words = [
        { text: 'Bonjour', lineIndex: 0 },
        { text: 'le', lineIndex: 0 },
        { text: 'monde', lineIndex: 0 }
      ];
      expect(reconstructTextFromWords(words)).toBe('Bonjour le monde');
    });

    it('devrait gérer les césures naturelles (rendez-vous)', () => {
      const words = [
        { text: 'rendez-', lineIndex: 0 },
        { text: 'vous', lineIndex: 1 }
      ];
      // rendez- + vous = rendez-vous (car "rendez" et "vous" sont dans NATURAL_HYPHEN_PARTS)
      const result = reconstructTextFromWords(words);
      expect(result).toContain('rendez-vous');
      expect(result).not.toContain('rendez vous');
    });

    it('devrait fusionner les mots coupés par ligne (non naturels)', () => {
      const words = [
        { text: 'exem-', lineIndex: 0 },
        { text: 'ple', lineIndex: 1 }
      ];
      // exem- + ple = exemple (car "exem" et "ple" ne sont PAS dans NATURAL_HYPHEN_PARTS)
      const result = reconstructTextFromWords(words);
      expect(result).toBe('exemple');
    });

    it('devrait gérer les mots avec ponctuation', () => {
      const words = [
        { text: 'Bonjour', lineIndex: 0 },
        { text: 'monde', lineIndex: 0 },
        { text: '!', lineIndex: 0 }
      ];
      expect(reconstructTextFromWords(words)).toBe('Bonjour monde !');
    });
  });
});
```

#### Risque 2.5: Utilities réseau non testées - networkUtils.ts
**Fichier concerné:** `src/shared/lib/offline/networkUtils.ts` (39 lignes)

- **Preuve technique:** Aucun fichier `networkUtils.test.ts` n'existe
- **Fonctions non testées:**
  - `isOffline()` - Détection du mode offline
  - `isNetworkError()` - Détection des erreurs réseau
  - `logFetchError()` - Logging des erreurs
- **Impact:** Si `isOffline()` retourne toujours `false` même hors-ligne, les opérations offline seront tentées en réseau et échoueront

**Correction recommandée:**
```typescript
// src/shared/lib/offline/__tests__/networkUtils.test.ts (NOUVEAU)
import { isOffline, isNetworkError, logFetchError } from '../networkUtils';
import NetInfo from '@react-native-community/netinfo';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

describe('networkUtils', () => {
  describe('isOffline', () => {
    it('devrait retourner true si pas connecté', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false
      });
      expect(await isOffline()).toBe(true);
    });

    it('devrait retourner false si connecté', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true
      });
      expect(await isOffline()).toBe(false);
    });

    it('devrait retourner false si NetInfo échoue', async () => {
      (NetInfo.fetch as jest.Mock).mockRejectedValue(new Error('Failed'));
      expect(await isOffline()).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('devrait détecter les erreurs réseau classiques', () => {
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('NetworkError when fetching'))).toBe(true);
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    });

    it('devrait retourner false pour les erreurs non-réseau', () => {
      expect(isNetworkError(new Error('Invalid data'))).toBe(false);
      expect(isNetworkError(new Error('Validation failed'))).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });
  });

  describe('logFetchError', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn');
    const consoleErrorSpy = jest.spyOn(console, 'error');

    afterEach(() => {
      consoleWarnSpy.mockClear();
      consoleErrorSpy.mockClear();
    });

    it('devrait logger en warning pour les erreurs réseau', () => {
      const networkErr = new Error('Network request failed');
      logFetchError('API call', networkErr);
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('devrait logger en error pour les autres erreurs', () => {
      const otherErr = new Error('Invalid data');
      logFetchError('API call', otherErr);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
```

#### Risque 2.6: Logique d'import de livre non testée - bookImport.ts
**Fichier concerné:** `src/entities/book/lib/bookImport.ts` (86 lignes)

- **Preuve technique:** Aucun fichier `bookImport.test.ts` n'existe
- **Fonction non testée:**
  - `buildBookImportPayload()` - **CRITIQUE** Construction du payload d'import
- **Impact:** Si le payload est mal construit (ex: pages=0 au lieu de null), le backend rejetera l'import ou sauvegardera des données incorrectes

**Correction recommandée:**
```typescript
// src/entities/book/lib/__tests__/bookImport.test.ts (NOUVEAU)
import { buildBookImportPayload, BookImportPayload } from '../bookImport';

describe('bookImport', () => {
  describe('buildBookImportPayload', () => {
    it('devrait retourner null si pas de titre', () => {
      const result = buildBookImportPayload({ title: undefined });
      expect(result).toBeNull();
    });

    it('devrait construire un payload valide à partir des données parsées', () => {
      const bookData = {
        label: 'Test Book',
        authors: ['Author 1', 'Author 2'],
        description: 'Test description',
        image: 'http://cover.jpg',
        uri: 'http://inventaire.io/test',
        year: 2020,
        pages: 300,
        genre: 'Fiction'
      };

      const result = buildBookImportPayload({ bookData });

      expect(result).toEqual({
        title: 'Test Book',
        authors: ['Author 1', 'Author 2'],
        description: 'Test description',
        cover: 'http://cover.jpg',
        inventaireUri: 'http://inventaire.io/test',
        year: 2020,
        pages: 300,
        genre: 'Fiction'
      } as BookImportPayload);
    });

    it('devrait mettre pages à null si pages=0', () => {
      const bookData = { label: 'Test', pages: 0 };
      const result = buildBookImportPayload({ bookData });
      expect(result?.pages).toBeNull();
    });

    it('devrait utiliser le titre depuis le livre si pas dans bookData', () => {
      const book = { title: 'Book Title', pages: 200 };
      const result = buildBookImportPayload({ book });
      expect(result?.title).toBe('Book Title');
      expect(result?.pages).toBe(200);
    });

    it('devrait prioriser bookData sur book', () => {
      const bookData = { label: 'From BookData', pages: 0 };
      const book = { title: 'From Book', pages: 200 };
      const result = buildBookImportPayload({ bookData, book });
      expect(result?.title).toBe('From BookData');
    });

    it('devrait filtrer les auteurs vides', () => {
      const bookData = {
        label: 'Test',
        authors: ['Valid', '', '  ', null as any, undefined as any]
      };
      const result = buildBookImportPayload({ bookData });
      expect(result?.authors).toEqual(['Valid']);
    });
  });
});
```

---

### 3️⃣ CI/CD (EAS)

**Fichier concerné:** `app.json` (configuration EAS manquante)

#### Risque 3.1: Configuration de build EAS absente
- **Preuve technique:** Aucun fichier `eas.json` dans le projet (`find . -name eas.json` → aucun résultat)
- **Preuve technique:** `package.json` contient `expo-dev-client` mais pas de scripts EAS (`eas build`, `eas submit`)
- **Impact:** Impossibilité de:
  - Créer des builds reproductibles pour iOS/Android
  - Déployer sur App Store / Play Store
  - Gérer des environnements dev/staging/prod

#### Risque 3.2: Pas de séparation d'environnements
- **Preuve technique:** `app.json` utilise `"version": "1.0.0"` en dur, pas de variables d'environnement
- **Impact:** Risque de déployer du code de développement en production

#### Risque 3.3: Pas d'automatisation CI
- **Preuve technique:** Aucun dossier `.github/workflows/` (`ls -la .github/ 2>/dev/null || echo "No .github directory"` → No .github directory)
- **Impact:** Builds manuels → lenteur, erreurs humaines, pas d'exécution des tests E2E/Jest avant déploiement

**Correction recommandée:**
```json
// eas.json (NOUVEAU)
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      },
      "env": {
        "NODE_ENV": "development",
        "SUPABASE_URL": "@@SUPABASE_DEV_URL@@",
        "SUPABASE_ANON_KEY": "@@SUPABASE_DEV_KEY@@"
      }
    },
    "staging": {
      "distribution": "internal",
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      },
      "env": {
        "NODE_ENV": "staging",
        "SUPABASE_URL": "@@SUPABASE_STAGING_URL@@",
        "SUPABASE_ANON_KEY": "@@SUPABASE_STAGING_KEY@@"
      }
    },
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      },
      "env": {
        "NODE_ENV": "production",
        "SUPABASE_URL": "@@SUPABASE_PROD_URL@@",
        "SUPABASE_ANON_KEY": "@@SUPABASE_PROD_KEY@@"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "production"
      },
      "ios": {
        "ascAppId": "@@ASC_APP_ID@@"
      }
    }
  }
}
```

```yaml
# .github/workflows/ci-cd.yml (NOUVEAU)
name: Quotex CI/CD
on:
  push:
    branches: [main, scope4_v2, scope5]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Run Jest tests
        run: yarn test --passWithNoTests
      
      - name: Run Maestro tests
        run: |
          npx maestro test .maestro/
        env:
          MAESTRO_API_KEY: ${{ secrets.MAESTRO_API_KEY }}
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: |
            coverage/
            .maestro/test-results/

  build-dev:
    name: Build Development
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Login EAS
        run: eas login --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
      
      - name: Build development
        run: eas build --profile development --platform all
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          SUPABASE_DEV_URL: ${{ secrets.SUPABASE_DEV_URL }}
          SUPABASE_DEV_KEY: ${{ secrets.SUPABASE_DEV_KEY }}

  build-prod:
    name: Build Production
    needs: test
    if: github.ref == 'refs/tags/v*'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Login EAS
        run: eas login --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
      
      - name: Build production
        run: eas build --profile production --platform all
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          SUPABASE_PROD_URL: ${{ secrets.SUPABASE_PROD_URL }}
          SUPABASE_PROD_KEY: ${{ secrets.SUPABASE_PROD_KEY }}
      
      - name: Submit to stores
        run: eas submit --profile production
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

### 4️⃣ Stratégie de mise à jour OTA

**Fichier concerné:** `package.json` (expo-updates absent)

#### Risque 4.1: Pas de mises à jour OTA possibles
- **Preuve technique:** `package.json` ne contient pas `expo-updates` dans les dépendances (`cat package.json | grep -E "expo-updates"` → aucun résultat)
- **Preuve technique:** `app.json` n'a pas de configuration `updates` ou `runtimeVersion`
- **Impact:** Chaque correction de bug ou nouvelle feature nécessite:
  - Nouveau build natif (10-30 min)
  - Validation App Store (1-3 jours)
  - Les utilisateurs doivent mettre à jour manuellement l'app

#### Risque 4.2: Incompatibilité future garantie
- **Preuve technique:** Sans expo-updates, le code JS et les bibliothèques natives sont toujours couplés
- **Scénarios à risque:**
  - Mise à jour de `react-native-vision-camera` (v4.7.3 → v5.x.x) peut casser le scan OCR
  - Mise à jour de `@supabase/supabase-js` peut changer l'API de synchronisation
- **Impact:** Crash applicatif après mise à jour du binaire natif si le code JS n'est pas compatible

#### Risque 4.3: Pas de rollback possible
- **Preuve technique:** Sans OTA, impossible de revenir à une version précédente du code JS
- **Impact:** Si une release contient un bug critique, il faut attendre la validation store

**Correction recommandée:**
```bash
# Installer expo-updates
npx expo install expo-updates
```

```json
// app.json (MODIFIÉ) - Ajouter dans "expo"
{
  "expo": {
    "...existing...",
    "updates": {
      "url": "https://u.expo.dev/@quotex/quotex",
      "enabled": true,
      "fallbackToCacheTimeout": 86400
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "extra": {
      "eas": {
        "projectId": "@@EAS_PROJECT_ID@@"
      }
    }
  }
}
```

```bash
# Créer des channels pour chaque environnement
eas channel:create dev --projectId @quotex/quotex
eas channel:create staging --projectId @quotex/quotex
eas channel:create production --projectId @quotex/quotex
```

---

## 📊 METRIQUES ACTUELLES vs CIBLES

### Couverture des Tests

| Catégorie | Total Fichiers | Avec Tests | Sans Tests | Couverture |
|-----------|----------------|------------|------------|------------|
| Shared Lib | 9 | 3 | **6** | 33% |
| Scanner Model | 11 | 0 | **11** | 0% |
| Scanner API | 2 | 0 | **2** | 0% |
| Quote Model | 5 | 2 | **3** | 40% |
| Book Lib | 2 | 0 | **2** | 0% |
| **Total Critique** | **29** | **5** | **24** | **17%** |

### Infrastructure
| Métrique | Actuel | Cible | Écart |
|----------|--------|-------|-------|
| Couverture E2E des flux critiques | 1/4 (25%) | 4/4 (100%) | -75% |
| Couverture Jest des fonctions critiques | 5/29 (17%) | 29/29 (100%) | -83% |
| Temps de build EAS | N/A | <15 min | N/A |
| Capacité OTA | ❌ Non | ✅ Oui | Critique |
| Automatisation CI/CD | ❌ Non | ✅ Oui | Critique |
| Reproductibilité des builds | ❌ Non | ✅ Oui | Critique |

---

## ✅ PLAN D'ACTION PRIORITAIRE

### Phase 1: URGENT (Bloquant pour la production) - **J+1 à J+2**
- [ ] Créer `eas.json` avec profils dev/staging/prod
- [ ] Installer `expo-updates` et configurer dans `app.json`
- [ ] Créer les channels OTA (dev, staging, production)

### Phase 2: CRITIQUE (Stabilité) - **J+3 à J+7**
- [ ] **J+3** Créer `ScanService.test.ts` (502 lignes de service de scan)
- [ ] **J+3** Créer `QuoteUseCases.test.ts` (413 lignes de use cases)
- [ ] **J+4** Créer `textReconstructor.test.ts` (178 lignes de reconstruction OCR)
- [ ] **J+4** Créer `scanGeometry.test.ts` (271 lignes de géométrie)
- [ ] **J+5** Créer `networkUtils.test.ts` (39 lignes d'utilitaires réseau)
- [ ] **J+5** Créer `bookImport.test.ts` (86 lignes d'import de livres)
- [ ] **J+5** Corriger `create_quote.yaml` avec IDs de test et timeouts

### Phase 3: Tests E2E - **J+6 à J+8**
- [ ] **J+6** Ajouter `scan_quote.yaml` (test scan OCR)
- [ ] **J+6** Ajouter `isbn_scan.yaml` (test détection ISBN)
- [ ] **J+7** Ajouter `offline_flow.yaml` (test mode offline + sync)

### Phase 4: CI/CD - **J+8 à J+10**
- [ ] **J+8** Configurer GitHub Actions workflow
- [ ] **J+9** Intégrer Maestro tests dans CI
- [ ] **J+10** Configurer notifications (Slack/Email)

---

## 💡 RECOMMANDATIONS SUPPLEMENTAIRES

### Pour les tests Maestro:
1. **Utiliser des test IDs** : Ajouter `testID="scan-tab"` sur tous les composants React Native
2. **Mock le backend** : Utiliser MSW (Mock Service Worker) pour simuler Supabase en CI
3. **Device farm** : Intégrer avec AWS Device Farm ou BrowserStack pour tests multi-appareils

### Pour Jest:
1. **Couverture 100%** : Prioriser les fichiers sans tests dans src/features/scanner/ et src/shared/lib/
2. **Mocks intelligents** : Utiliser `jest.mock()` pour isoler les dépendances externes (Supabase, NetInfo, Camera)
3. **Snapshot tests** : Pour les composants UI dans src/shared/ui/blocks/

### Pour EAS:
1. **Cache les builds** : Utiliser `eas build --cache` pour accélérer les builds incrémentaux
2. **Secrets management** : Stocker les clés Supabase dans EAS secrets, pas en dur
3. **Build metadata** : Ajouter commit SHA dans le nom du build pour traçabilité

### Pour OTA:
1. **Versioning sémantique** : Utiliser `runtimeVersion: { policy: "appVersion" }` pour lier OTA à la version app
2. **Rollback automatique** : Configurer un seuil d'erreurs pour rollback auto (expo-updates le supporte)
3. **A/B testing** : Utiliser les channels pour tester des features avant déploiement massif

---

## 📚 REFERENCES
- [Maestro Documentation](https://maestro.mobile.dev/)
- [EAS Configuration](https://docs.expo.dev/build/eas-json/)
- [Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/)
- [Expo OTA Channels](https://docs.expo.dev/eas-update/understanding-channels/)
- [Jest Testing](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-native-testing-library/intro/)

---

*Audit réalisé par Mistral Vibe - Approche chirurgicale, preuves techniques uniquement*
*Fichiers analysés: 45+ fichiers sources, 5 fichiers de test existants, 0 configuration EAS, 0 configuration OTA*
