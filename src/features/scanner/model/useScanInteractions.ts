/* eslint-disable react-hooks/refs */
import { useCallback, useEffect, useRef } from 'react';
import { PanResponder, PanResponderInstance } from 'react-native';
import { ImageDisplayInfo, WordData } from './ocrProcessor';
import { SelectionRange } from './useScanState';

/**
 * Props pour le hook useScanInteractions
 */
export interface UseScanInteractionsProps {
  words: WordData[];
  selectionRange: SelectionRange | null;
  setSelectionRange: React.Dispatch<React.SetStateAction<SelectionRange | null>>;
  excludedIndices: Set<number>;
  toggleWordExclusion: (index: number) => void;
  isEraserMode: boolean;
  imageDisplayInfo: ImageDisplayInfo;
}

/**
 * Résultat du hook useScanInteractions
 */
export interface ScanInteractionsResult {
  // Réfs pour les gesture handlers
  imagePanResponder: React.RefObject<PanResponderInstance>;
  
  // Handlers
  handleWordPress: (index: number) => void;
  findWordAtPosition: (x: number, y: number) => number | null;
}

/**
 * Trouve le mot le plus proche d'une position donnée
 */
function findNearestWord(words: WordData[], x: number, y: number): number | null {
  if (words.length === 0) return null;

  let nearestIndex = null;
  let minDistance = Infinity;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const centerX = word.scaledFrame.left + word.scaledFrame.width / 2;
    const centerY = word.scaledFrame.top + word.scaledFrame.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
    );

    if (distance < minDistance && distance < 50) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

/**
 * Hook pour gérer les interactions tactiles avec l'image de scan
 * Contient uniquement la logique UI, pas de logique métier
 */
export const useScanInteractions = ({
  words,
  selectionRange,
  setSelectionRange,
  excludedIndices,
  toggleWordExclusion,
  isEraserMode,
  imageDisplayInfo,
}: UseScanInteractionsProps): ScanInteractionsResult => {
  
  const wordsRef = useRef(words);
  const selectionRangeRef = useRef(selectionRange);
  const isEraserModeRef = useRef(isEraserMode);
  const toggleWordExclusionRef = useRef(toggleWordExclusion);
  const excludedIndicesRef = useRef(excludedIndices);
  
  useEffect(() => {
    wordsRef.current = words;
    selectionRangeRef.current = selectionRange;
    isEraserModeRef.current = isEraserMode;
    toggleWordExclusionRef.current = toggleWordExclusion;
    excludedIndicesRef.current = excludedIndices;
  }, [words, selectionRange, isEraserMode, toggleWordExclusion, excludedIndices]);

  const panResponderInstance = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const nearestIndex = findNearestWord(wordsRef.current, locationX, locationY);
        
        if (nearestIndex !== null) {
          if (isEraserModeRef.current) {
            const range = selectionRangeRef.current;
            if (range && nearestIndex >= Math.min(range.start, range.end) && nearestIndex <= Math.max(range.start, range.end)) {
              toggleWordExclusionRef.current(nearestIndex);
            }
          } else {
            setSelectionRange({ start: nearestIndex, end: nearestIndex } as SelectionRange);
          }
        }
      },
      
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const nearestIndex = findNearestWord(wordsRef.current, locationX, locationY);
        
        if (nearestIndex !== null) {
          if (isEraserModeRef.current) {
            const range = selectionRangeRef.current;
            if (range && nearestIndex >= Math.min(range.start, range.end) && nearestIndex <= Math.max(range.start, range.end)) {
              if (!excludedIndicesRef.current.has(nearestIndex)) {
                toggleWordExclusionRef.current(nearestIndex);
              }
            }
          } else if (selectionRangeRef.current) {
            setSelectionRange({ 
              start: selectionRangeRef.current.start, 
              end: nearestIndex 
            } as SelectionRange);
          }
        }
      },
      
      onPanResponderRelease: (evt, gestureState) => {
        // Fin de la sélection
      },
    })
  ).current;
  
  const imagePanResponder = useRef<PanResponderInstance>(panResponderInstance);

  // Handler pour la pression sur un mot
  const handleWordPress = useCallback((index: number) => {
    if (isEraserMode) {
      // En mode gomme, on ne sélectionne pas
      return;
    }
    
    setSelectionRange((prev: SelectionRange | null) => {
      if (!prev) {
        return { start: index, end: index } as SelectionRange | null;
      }
      return { start: prev.start, end: index } as SelectionRange | null;
    });
  }, [isEraserMode, setSelectionRange]);

  // Fonction utilitaire pour trouver un mot à une position
  const findWordAtPosition = useCallback((x: number, y: number): number | null => {
    return findNearestWord(wordsRef.current, x, y);
  }, []);

  return {
    imagePanResponder,
    handleWordPress,
    findWordAtPosition,
  };
};
