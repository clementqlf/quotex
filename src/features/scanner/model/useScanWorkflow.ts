import { useState, useMemo, useRef, useCallback } from 'react';
import { PanResponder, Share, Clipboard } from 'react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import { calculateTextRotation } from '../../../shared/lib/scanGeometry';
import { reconstructTextFromWords } from './textReconstructor';
import { useData } from '@/src/app/providers/DataProvider';
import { useTabIndex } from '@/src/app/providers/TabContext';

type Size = { width: number; height: number };

export type WordData = {
  index: number;
  text: string;
  originalFrame: { left: number; top: number; width: number; height: number };
  scaledFrame: { left: number; top: number; width: number; height: number };
  centerX: number;
  centerY: number;
  rotation: number;
  lineIndex: number;
};

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  onReset: () => void;
  isGallery?: boolean;
  normalizedSize?: { width: number; height: number } | null;
};

export const useScanWorkflow = ({
  photo,
  ocrElements,
  ocrBlocks,
  onReset,
  normalizedSize,
}: ScanWorkflowProps) => {
  const { addQuote } = useData();
  const { setTabIndex } = useTabIndex();
  const [isDevMode, setIsDevMode] = useState(false);
  const [debugTouch, setDebugTouch] = useState<{x: number, y: number} | null>(null);
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // needsRotation is always false: React Native <Image> auto-applies EXIF.
  // ML Kit coordinates are in the normalizedSize space (portrait, after ImageManipulator normalization).
  const needsRotation = false;

  const imageDisplayInfo = useMemo(() => {
    // Use normalizedSize (from ImageManipulator output) as the ground truth for image dimensions.
    // This is the same coordinate space that ML Kit used when processing the normalized image.
    const photoW = normalizedSize?.width || photo.width || 1;
    const photoH = normalizedSize?.height || photo.height || 1;

    if (viewportSize.width === 0 || viewportSize.height === 0 || !photoW || !photoH) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 1 };
    }

    // Always fill the full screen width. Height is proportional to the image aspect ratio.
    // Controls are absolutely positioned so they overlay the image without affecting layout.
    const displayedWidth = viewportSize.width;
    const imageAspectRatio = photoW / photoH;
    const displayedHeight = displayedWidth / imageAspectRatio;
    const scale = displayedWidth / photoW;

    return { width: displayedWidth, height: displayedHeight, offsetX: 0, offsetY: 0, scale };
  }, [viewportSize, normalizedSize, photo.width, photo.height]);

  const words = useMemo(() => {
    if (!ocrElements || ocrElements.length === 0 || imageDisplayInfo.scale === 1) return [];

    let sortedElements: TextElement[] = [];

    if (ocrBlocks && ocrBlocks.length > 0) {
      // 1. Group words using ML Kit's native line segmentation to guarantee correct grouping
      interface LineInfo {
        line: any;
        centerY: number;
        left: number;
      }
      const linesInfo: LineInfo[] = [];

      for (const block of ocrBlocks) {
        for (const line of block.lines) {
          const frame = (line as any).frame || (line as any).rect || { left: 0, top: 0, width: 0, height: 0 };
          const centerY = frame.top + frame.height / 2;
          linesInfo.push({
            line,
            centerY,
            left: frame.left,
          });
        }
      }

      // 2. Sort the lines from top to bottom
      linesInfo.sort((a, b) => a.centerY - b.centerY);

      // 3. Sort elements within each line from left to right
      linesInfo.forEach((lineInfo, lineIndex) => {
        const sortedLineElements = [...lineInfo.line.elements].sort((a, b) => {
          const aFrame = (a as any).frame || (a as any).rect || { left: 0 };
          const bFrame = (b as any).frame || (b as any).rect || { left: 0 };
          return aFrame.left - bFrame.left;
        });
        
        for (const el of sortedLineElements) {
          (el as any).lineIndex = lineIndex;
          sortedElements.push(el);
        }
      });
    } else {
      // Fallback heuristic if ocrBlocks is not provided
      let mappedWords = ocrElements.map(el => {
        const frame = (el as any).frame || (el as any).rect || { left: 0, top: 0, width: 0, height: 0 };
        return { text: el.text, originalFrame: frame };
      });

      let sortedByVertical = mappedWords.map(w => {
        const centerY = w.originalFrame.top + w.originalFrame.height / 2;
        return { ...w, centerY };
      }).sort((a, b) => a.centerY - b.centerY);

      let lines: typeof mappedWords[] = [];
      for (const word of sortedByVertical) {
        let placed = false;
        const wordTop = word.originalFrame.top;
        const wordBottom = word.originalFrame.top + word.originalFrame.height;
        const wordHeight = word.originalFrame.height;

        for (const line of lines) {
          const avgTop = line.reduce((sum, w) => sum + w.originalFrame.top, 0) / line.length;
          const avgHeight = line.reduce((sum, w) => sum + w.originalFrame.height, 0) / line.length;
          const avgBottom = avgTop + avgHeight;

          const overlap = Math.min(wordBottom, avgBottom) - Math.max(wordTop, avgTop);
          const minHeight = Math.min(wordHeight, avgHeight);

          if (overlap > minHeight * 0.4) {
            line.push(word);
            placed = true;
            break;
          }
        }

        if (!placed) {
          lines.push([word]);
        }
      }

      lines.sort((lineA, lineB) => {
        const avgYA = lineA.reduce((sum, w) => sum + (w.originalFrame.top + w.originalFrame.height / 2), 0) / lineA.length;
        const avgYB = lineB.reduce((sum, w) => sum + (w.originalFrame.top + w.originalFrame.height / 2), 0) / lineB.length;
        return avgYA - avgYB;
      });

      lines.forEach((line, lineIndex) => {
        line.sort((a, b) => a.originalFrame.left - b.originalFrame.left);
        for (const word of line) {
          (word as any).lineIndex = lineIndex;
        }
      });

      sortedElements = lines.flat() as any;
    }

    return sortedElements.map((el, index) => {
      const frame = (el as any).frame || (el as any).rect || { left: 0, top: 0, width: 0, height: 0 };
      // No CSS rotation is applied to the image, so OCR coordinates map directly.
      const scaledFrame = {
        left: frame.left * imageDisplayInfo.scale,
        top: frame.top * imageDisplayInfo.scale,
        width: frame.width * imageDisplayInfo.scale,
        height: frame.height * imageDisplayInfo.scale,
      };
      
      const rotation = el.cornerPoints ? calculateTextRotation(el.cornerPoints as any) : 0;
      
      return {
        index,
        text: el.text,
        originalFrame: frame,
        scaledFrame,
        centerX: scaledFrame.left + scaledFrame.width / 2,
        centerY: scaledFrame.top + scaledFrame.height / 2,
        rotation,
        lineIndex: (el as any).lineIndex ?? 0,
      } as WordData;
    });
  }, [ocrElements, ocrBlocks, imageDisplayInfo.scale]);

  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  
  const [isEraserMode, setIsEraserMode] = useState(false);
  const isEraserModeRef = useRef(isEraserMode);
  isEraserModeRef.current = isEraserMode;

  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const excludedIndicesRef = useRef(excludedIndices);
  excludedIndicesRef.current = excludedIndices;
  
  // Use REFS for all state that PanResponders need to access!
  const selectionRef = useRef(selectionRange);
  selectionRef.current = selectionRange;

  const wordsRef = useRef(words);
  wordsRef.current = words;

  const findWordAtPosition = useCallback((x: number, y: number): number | null => {
    const currentWords = wordsRef.current;
    if (currentWords.length === 0) return null;
    
    const touchRadius = 30; // 30px active touch radius for easy tapping
    let nearestIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < currentWords.length; i++) {
      const w = currentWords[i];
      
      const isNearX = x >= w.scaledFrame.left - touchRadius && x <= w.scaledFrame.left + w.scaledFrame.width + touchRadius;
      const isNearY = y >= w.scaledFrame.top - touchRadius && y <= w.scaledFrame.top + w.scaledFrame.height + touchRadius;
      
      if (isNearX && isNearY) {
        const dx = x - w.centerX;
        const dy = y - w.centerY;
        const dist = dx * dx + dy * dy;
        
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }
    }
    
    return nearestIndex !== -1 ? nearestIndex : null;
  }, []);

  const findNearestWordIndex = useCallback((x: number, y: number): number | null => {
    const currentWords = wordsRef.current;
    if (currentWords.length === 0) return null;
    let minDistance = Infinity;
    let nearestIndex = -1;

    for (let i = 0; i < currentWords.length; i++) {
      const w = currentWords[i];
      if (
        x >= w.scaledFrame.left &&
        x <= w.scaledFrame.left + w.scaledFrame.width &&
        y >= w.scaledFrame.top &&
        y <= w.scaledFrame.top + w.scaledFrame.height
      ) {
        return i;
      }

      const dx = x - w.centerX;
      const dy = y - w.centerY;
      const dist = dx * dx + dy * dy;
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }
    
    if (minDistance < 6000) return nearestIndex; // ~77px radius for dragging
    return null;
  }, []);

  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // locationX/Y are relative to the GestureOverlay view
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;
        
        setIsDevMode(prev => {
          if (prev) setDebugTouch({ x, y });
          return prev;
        });

        const nearestIndex = findWordAtPosition(x, y);
        if (nearestIndex !== null) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          
          if (isEraserModeRef.current) {
            const currentSelection = selectionRef.current;
            if (currentSelection && nearestIndex >= currentSelection.start && nearestIndex <= currentSelection.end) {
              setExcludedIndices(prev => {
                const next = new Set(prev);
                if (next.has(nearestIndex)) {
                  next.delete(nearestIndex);
                } else {
                  next.add(nearestIndex);
                }
                return next;
              });
            }
          } else {
            setSelectionRange({ start: nearestIndex, end: nearestIndex });
            setExcludedIndices(new Set());
          }
        } else {
          if (!isEraserModeRef.current) {
            setSelectionRange(null);
            setExcludedIndices(new Set());
          }
        }
      },
    })
  ).current;

  const dragStartPos = useRef({ x: 0, y: 0 });

  const startPinResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!selectionRef.current || wordsRef.current.length === 0) return;
        const startWord = wordsRef.current[selectionRef.current.start];
        if (startWord) {
          dragStartPos.current = {
            x: startWord.scaledFrame.left,
            y: startWord.scaledFrame.top + startWord.scaledFrame.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!selectionRef.current) return;
        const currentX = dragStartPos.current.x + gestureState.dx;
        const currentY = dragStartPos.current.y + gestureState.dy;

        setIsDevMode(prev => {
          if (prev) setDebugTouch({ x: currentX, y: currentY });
          return prev;
        });

        const nearestIndex = findNearestWordIndex(currentX, currentY);
        if (nearestIndex !== null && nearestIndex !== selectionRef.current.start) {
          setSelectionRange(prev => {
            if (!prev) return null;
            return { start: Math.min(nearestIndex, prev.end), end: prev.end };
          });
        }
      },
    })
  ).current;

  const endPinResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!selectionRef.current || wordsRef.current.length === 0) return;
        const endWord = wordsRef.current[selectionRef.current.end];
        if (endWord) {
          dragStartPos.current = {
            x: endWord.scaledFrame.left + endWord.scaledFrame.width,
            y: endWord.scaledFrame.top + endWord.scaledFrame.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!selectionRef.current) return;
        const currentX = dragStartPos.current.x + gestureState.dx;
        const currentY = dragStartPos.current.y + gestureState.dy;

        setIsDevMode(prev => {
          if (prev) setDebugTouch({ x: currentX, y: currentY });
          return prev;
        });

        const nearestIndex = findNearestWordIndex(currentX, currentY);
        if (nearestIndex !== null && nearestIndex !== selectionRef.current.end) {
          setSelectionRange(prev => {
            if (!prev) return null;
            return { start: prev.start, end: Math.max(nearestIndex, prev.start) };
          });
        }
      },
    })
  ).current;

  const scannedText = useMemo(() => {
    if (!selectionRange || words.length === 0) return '';
    const selectedWords = words.slice(selectionRange.start, selectionRange.end + 1);
    const filteredWords = selectedWords.filter(w => !excludedIndices.has(w.index));
    
    if (filteredWords.length === 0) return '';

    return reconstructTextFromWords(filteredWords);
  }, [selectionRange, words, excludedIndices]);

  const handleCopy = async () => {
    if (scannedText) {
      Clipboard.setString(scannedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleShare = async () => {
    if (scannedText) {
      await Share.share({ message: scannedText });
    }
  };

  const handleSaveQuote = () => setShowPreviewModal(true);
  
  const handleConfirmSave = async (text: string, book: string, author: string) => {
    console.log('[useScanWorkflow] handleConfirmSave called');
    console.log('[useScanWorkflow] text:', text);
    console.log('[useScanWorkflow] book:', book);
    console.log('[useScanWorkflow] author:', author);
    
    try {
      console.log('[useScanWorkflow] Calling addQuote...');
      await addQuote(text, book, author);
      console.log('[useScanWorkflow] addQuote completed successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTabIndex(0);
    } catch (error) {
      console.error("[useScanWorkflow] Error saving scanned quote:", error);
    } finally {
      console.log('[useScanWorkflow] Closing modal and resetting');
      setShowPreviewModal(false);
      onReset();
    }
  };

  const handleSelectAll = () => {
    if (words.length > 0) {
      setSelectionRange({ start: 0, end: words.length - 1 });
    }
  };

  const handleClearSelection = () => {
    setSelectionRange(null);
    setExcludedIndices(new Set());
    setIsEraserMode(false);
  };

  const pinsGeometry = useMemo(() => {
    if (!selectionRange || words.length === 0) return null;
    const startWord = words[selectionRange.start];
    const endWord = words[selectionRange.end];

    return {
      startPin: {
        left: startWord.scaledFrame.left,
        top: startWord.scaledFrame.top,
        height: startWord.scaledFrame.height,
      },
      endPin: {
        left: endWord.scaledFrame.left + endWord.scaledFrame.width,
        top: endWord.scaledFrame.top,
        height: endWord.scaledFrame.height,
      }
    };
  }, [selectionRange, words]);

  return {
    isDevMode,
    setIsDevMode,
    debugTouch,
    setViewportSize,
    imageDisplayInfo,
    words,
    selectionRange,
    scannedText,
    copied,
    showPreviewModal,
    setShowPreviewModal,
    imagePanResponder,
    startPinResponder,
    endPinResponder,
    pinsGeometry,
    handleClearSelection,
    handleCopy,
    handleShare,
    handleSaveQuote,
    handleConfirmSave,
    handleSelectAll,
    onReset,
    isEraserMode,
    setIsEraserMode,
    excludedIndices,
    needsRotation,
  };
};
