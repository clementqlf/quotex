import { useRef, useMemo } from 'react';
import { PanResponder, View } from 'react-native';
import { WordData, ImageDisplayInfo } from './ocrProcessor';
import { SelectionRange } from './useScanState';

/**
 * Props pour le hook useScanInteractions
 */
export interface UseScanInteractionsProps {
  words: WordData[];
  selectionRange: SelectionRange | null;
  setSelectionRange: React.Dispatch<React.SetStateAction<SelectionRange | null>>;
  excludedIndices: Set<number>;
  isEraserMode: boolean;
  imageDisplayInfo: ImageDisplayInfo;
}

import { PanResponderInstance } from 'react-native';

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
  isEraserMode,
  imageDisplayInfo,
}: UseScanInteractionsProps): ScanInteractionsResult => {
  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const nearestIndex = findNearestWord(words, locationX, locationY);
        
        if (nearestIndex !== null) {
          setSelectionRange({ start: nearestIndex, end: nearestIndex } as SelectionRange | null);
        }
      },
      
      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        const nearestIndex = findNearestWord(words, locationX, locationY);
        
        if (nearestIndex !== null && selectionRange) {
          setSelectionRange({ 
            start: selectionRange.start, 
            end: nearestIndex 
          } as SelectionRange | null);
        }
      },
      
      onPanResponderRelease: (evt, gestureState) => {
        // Fin de la sélection
      },
    })
  ).current as unknown as React.RefObject<PanResponderInstance>;

  // Handler pour la pression sur un mot
  const handleWordPress = (index: number) => {
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
  };

  // Fonction utilitaire pour trouver un mot à une position
  const findWordAtPosition = (x: number, y: number): number | null => {
    return findNearestWord(words, x, y);
  };

  return {
    imagePanResponder: imagePanResponder as unknown as React.RefObject<any>,
    handleWordPress,
    findWordAtPosition,
  };
};
