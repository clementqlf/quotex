import { TextBlock, TextElement } from '@react-native-ml-kit/text-recognition';
import { useCallback, useMemo, useState } from 'react';
import { PhotoFile } from 'react-native-vision-camera';
import { ImageDisplayInfo, OcrProcessor, WordData } from './ocrProcessor';

// Re-export types for convenience
export { ImageDisplayInfo, WordData };

/**
 * Props pour le hook useScanState
 */
export interface UseScanStateProps {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  normalizedSize?: { width: number; height: number } | null;
  viewportSize: { width: number; height: number };
}

/**
 * État de sélection de texte
 */
export interface SelectionRange {
  start: number;
  end: number;
}

/**
 * Résultat du hook useScanState
 */
export interface ScanStateResult {
  // State
  words: WordData[];
  selectionRange: SelectionRange | null;
  excludedIndices: Set<number>;
  isEraserMode: boolean;
  
  // Setters
  setSelectionRange: React.Dispatch<React.SetStateAction<SelectionRange | null>>;
  setExcludedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  setIsEraserMode: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Actions
  toggleWordSelection: (index: number) => void;
  toggleWordExclusion: (index: number) => void;
  clearSelection: () => void;
  clearExclusions: () => void;
  
  // Données dérivées
  selectedText: string;
  imageDisplayInfo: ImageDisplayInfo;
}

/**
 * Hook pour gérer l'état du scan (sélection, exclusion, mode gomme)
 * Contient uniquement la logique de state management, pas d'UI
 */
export const useScanState = ({
  photo,
  ocrElements,
  ocrBlocks,
  normalizedSize,
  viewportSize,
}: UseScanStateProps): ScanStateResult => {
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [isEraserMode, setIsEraserMode] = useState(false);

  // Calculer les mots à partir des éléments OCR
  const imageDisplayInfo = useMemo(() => {
    return OcrProcessor.calculateImageDisplayInfo(
      viewportSize,
      normalizedSize ?? null,
      photo
    );
  }, [viewportSize, normalizedSize, photo.width, photo.height]);

  const words = useMemo(() => {
    return OcrProcessor.processOcrElements(
      ocrElements,
      imageDisplayInfo,
      ocrBlocks
    );
  }, [ocrElements, ocrBlocks, imageDisplayInfo]);

  // Texte sélectionné
  const selectedText = useMemo(() => {
    if (!selectionRange || !words.length) return '';
    
    const { start, end } = selectionRange;
    const selectedWords = words.slice(
      Math.min(start, end),
      Math.max(start, end) + 1
    );
    return selectedWords.map(w => w.text).join(' ');
  }, [selectionRange, words]);

  // Toggle la sélection d'un mot
  const toggleWordSelection = useCallback((index: number) => {
    setSelectionRange(prev => {
      if (!prev) {
        return { start: index, end: index };
      }
      return { start: prev.start, end: index };
    });
  }, []);

  // Toggle l'exclusion d'un mot
  const toggleWordExclusion = useCallback((index: number) => {
    setExcludedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Effacer la sélection
  const clearSelection = useCallback(() => {
    setSelectionRange(null);
  }, []);

  // Effacer les exclusions
  const clearExclusions = useCallback(() => {
    setExcludedIndices(new Set());
  }, []);

  return {
    // State
    words,
    selectionRange,
    excludedIndices,
    isEraserMode,
    
    // Setters
    setSelectionRange,
    setExcludedIndices,
    setIsEraserMode,
    
    // Actions
    toggleWordSelection,
    toggleWordExclusion,
    clearSelection,
    clearExclusions,
    
    // Données dérivées
    selectedText,
    imageDisplayInfo,
  };
};
