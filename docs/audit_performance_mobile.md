# Audit de Performance Mobile & Architecture (Quotex)

En tant qu'Expert Performance Mobile & Computer Vision, j'ai analysé la codebase de Quotex (Expo 55, React Native 0.83). Voici mon rapport détaillé sur les workflows critiques, l'usage des ressources et la réactivité de l'application.

## 1. Scanner OCR & Fuites Mémoire (CPU/GPU)

Le workflow du scanner (`VisionCameraScanner.ts`, `useLiveOCR.ts`) repose sur `react-native-vision-camera` et ML Kit. C'est une opération très coûteuse pour le CPU/GPU.

### Points forts actuels :
- **Worklets & SharedValues** : L'utilisation de `useSharedValue` et `useRunOnJS` (dans `useLiveOCR.ts`) permet de traiter les frames sur le thread UI/Worklet sans engorger le bridge JS. C'est une excellente pratique.
- **Throttling** : Un `scanInterval` (300ms) évite de saturer le CPU à 60 FPS.

### Goulots d'étranglement & Risques de Fuite Mémoire :
1. **Résolution de la caméra** : Si le frameProcessor traite les images en pleine résolution (ex: 4K), le GPU/CPU chauffera rapidement, causant du *thermal throttling* et des freezes. 
2. **Fuites d'images (Storage)** : Le scanner sauvegarde des images (`photo.path`). Il n'y a pas de mécanisme explicite dans `useScanWorkflow.ts` pour purger le cache de ces fichiers temporaires, ce qui va gonfler le stockage de l'app de manière invisible.
3. **Allocation dans le Worklet** : L'objet `result` généré par `scanText(frame)` peut causer des GC (Garbage Collector) pauses s'il est trop lourd.

### Recommandations :
- **Downsampling** : Configurez la caméra avec une résolution plus basse (`format` prop) spécifiquement pour l'OCR, ou réduisez la taille du frame avant de l'envoyer à ML Kit.
- **Cleanup Routine** : Implémentez un système de purge du répertoire temporaire (`expo-file-system`) à la destruction du composant Scanner pour les images non sauvegardées.

## 2. Refonte RepositoriesProvider vs DataProvider

J'ai audité `DataProvider.tsx` (400 lignes) et le nouveau `RepositoriesProvider.tsx`.

### Analyse du `DataProvider` (God Object) :
- **Problème critique** : Toute modification d'une entité (ex: `toggleLikeQuote`) déclenche un `setQuotes` qui force un re-render de **tous** les composants consommant `useData()`. C'est une source majeure de *lags* UI.
- L'injection de trop de responsabilités (Sync, Auth, Layout des blocs, Cache) rend la mémoire de l'app difficile à libérer.

### Bénéfices du `RepositoriesProvider` :
- **Architecture saine** : L'injection de dépendances (`IQuoteRepository`, etc.) via `RepositoriesProvider` est pure. Les composants consomment des singletons (les instances) sans déclencher de re-renders React.
- **Séparation State/Data** : En couplant cela avec une librairie de gestion d'état asynchrone (comme React Query/TanStack Query) pour gérer le cycle de vie de la donnée, vous éliminerez 90% des re-renders inutiles.

## 3. Système de Blocs Modulaires & Virtualisation

Vous utilisez `BlockDispatcher.tsx` pour rendre 15+ types de blocs. Dans une liste dynamique (ex: `FlashList`), cela peut causer des ralentissements importants, particulièrement lors du Drag & Drop.

### Stratégie de Virtualisation pour `FlashList` :
1. **`getItemType` est obligatoire** : `FlashList` recycle les vues. Si un `DefinitionBlock` est recyclé en `NotesBlock`, le coût de destruction/reconstruction est énorme. Implémentez `getItemType={(item) => item.type}` pour recycler les mêmes types de blocs ensemble.
2. **`estimatedItemSize` granulaire** : Ne donnez pas une taille unique. Calculez une moyenne par type de bloc.
3. **Mémoïsation stricte** : Lors d'un drag & drop, le state parent change souvent. Si vos blocs ne sont pas isolés, ils re-rendent tous à chaque frame de l'animation.

## 4. Optimisation du Bundle (Dépendances)

Parmi vos 55+ dépendances, plusieurs sont "lourdes" :
- `@shopify/react-native-skia` : Très lourd, justifié uniquement pour des animations très complexes.
- `@react-native-ml-kit/text-recognition` & `react-native-vision-camera-ocr-plus` : Pèsent lourd dans le binaire natif. Assurez-vous d'utiliser ProGuard (Android) pour réduire l'APK.
- `react-native-fast-confetti` (github branch) : Peut poser des soucis de stabilité de build.

## 5. Exemple de Code : Refactorisation d'un Bloc

Voici comment refactoriser un bloc (ex: `DefinitionBlock`) pour le rendre immunisé aux re-renders lors du Drag & Drop ou des mises à jour globales :

```tsx
import React, { memo } from 'react';
import { View, Text } from 'react-native';

// 1. Isoler les props de manière scalaire (primitives si possible)
interface DefinitionBlockProps {
    blockKey: string;
    definitions: any[];
    onEditSelection?: (blockKey: string) => void;
    onRemove?: () => void;
}

// 2. Composant de présentation PUR
const DefinitionBlockUI = ({ definitions, onEditSelection, onRemove }: DefinitionBlockProps) => {
    return (
        <View>
            {/* Rendu des définitions... */}
        </View>
    );
};

// 3. React.memo avec une fonction d'égalité personnalisée
// Empêche le re-render si le parent bouge (drag & drop) mais que le contenu du bloc est identique.
export const DefinitionBlock = memo(DefinitionBlockUI, (prevProps, nextProps) => {
    // Vérification de surface optimisée
    return (
        prevProps.blockKey === nextProps.blockKey &&
        prevProps.definitions.length === nextProps.definitions.length &&
        // Pour des objets complexes, utilisez une empreinte/hash ou comparez les IDs
        JSON.stringify(prevProps.definitions) === JSON.stringify(nextProps.definitions)
    );
});
```

En appliquant ce pattern à tous vos blocs dans `BlockDispatcher`, vous garantissez 60 FPS (ou 120 FPS) fluides même pendant les réorganisations de la liste.
