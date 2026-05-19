import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Image,
  PanResponder,
  Share,
} from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { useData } from '@/src/app/providers/DataProvider';
import { getBlockRectOnScreen, getPhotoOrientation, isPointInBlock } from '@/src/shared/lib/scanGeometry';
import { reconstructTextFromBlocks } from '@/src/features/scanner/model/textReconstructor';
import * as Haptics from 'expo-haptics';

export interface UseScanWorkflowProps {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  onReset: () => void;
  isGallery?: boolean;
}

export function useScanWorkflow({
  photo,
  ocrElements,
  ocrBlocks = [],
  onReset,
  isGallery,
}: UseScanWorkflowProps) {
  const router = useRouter();
  const { addQuote } = useData();

  // States pour la géométrie de l'image
  const [photoDimensions, setPhotoDimensions] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  // State pour le texte sélectionné par l'utilisateur
  const [scannedText, setScannedText] = useState<string>('');

  // States UI
  const previewScale = useSharedValue(1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Dev Mode States
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [debugTouch, setDebugTouch] = useState<{x: number, y: number} | null>(null);

  // Apple Live Text states
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [isHighlightMode, setIsHighlightMode] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const uri = `file://${photo.path}`;
    Image.getSize(
      uri,
      (width, height) => setPhotoDimensions({ width, height }),
      () => setPhotoDimensions({ width: photo.width || 0, height: photo.height || 0 }),
    );
  }, [photo]);

  useEffect(() => {
    const targetScale = 1;
    previewScale.value = withSpring(photo && ocrElements ? targetScale : 1, {
      damping: 12,
      stiffness: 90,
    });
  }, [photo, ocrElements, isGallery]);

  const animatedPhotoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewScale.value }],
  }));

  const getPhotoDims = () => {
    const photoW = photo?.width || photoDimensions.width || 1;
    const photoH = photo?.height || photoDimensions.height || 1;
    return { photoW, photoH };
  };

  const handleSaveQuote = () => {
    if (!scannedText) return;
    setShowPreviewModal(true);
  };

  const handleConfirmSave = async (quote: string, book: string, author: string) => {
    await addQuote(quote, book, author);
    setShowPreviewModal(false);
    setScannedText('');
    setSelectionRange(null);
    router.back();
    onReset();
  };

  const orientation = getPhotoOrientation(photo);

  // Mapped words list with coordinate rectangles on viewport
  const wordsWithRects = useMemo(() => {
    if (imageSize.width === 0 || !ocrElements || ocrElements.length === 0) return [];
    const { photoW, photoH } = getPhotoDims();
    const photoSize = { width: photoW, height: photoH };

    return ocrElements.map((el, index) => {
      const rect = getBlockRectOnScreen(el as any, imageSize, photoSize, orientation);
      return {
        element: el,
        index,
        rect,
      };
    }).filter(item => item.rect !== null) as Array<{
      element: TextElement;
      index: number;
      rect: { left: number; top: number; width: number; height: number; rotation?: number };
    }>;
  }, [ocrElements, imageSize, photo, photoDimensions, orientation]);

  // Helpers for gestures
  const findClosestWordToPoint = (x: number, y: number) => {
    let closest = null;
    let minDist = Infinity;
    for (const w of wordsWithRects) {
      const centerX = w.rect.left + w.rect.width / 2;
      const centerY = w.rect.top + w.rect.height / 2;
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist < minDist) {
        minDist = dist;
        closest = w;
      }
    }
    return closest;
  };

  const touchStartIdxRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectionGestureActiveRef = useRef<boolean>(false);

  const handleTouchStart = (x: number, y: number) => {
    if (wordsWithRects.length === 0) return;
    setDebugTouch({x, y});

    touchStartPosRef.current = { x, y };
    isSelectionGestureActiveRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Lance un minuteur de 350ms pour le long press
    longPressTimerRef.current = setTimeout(() => {
      const { photoW, photoH } = getPhotoDims();
      const photoSize = { width: photoW, height: photoH };

      // Cherche si l'appui long touche un mot (avec tolérance)
      const clickedWord = wordsWithRects.find(w =>
        isPointInBlock(x, y, w.element as any, imageSize, photoSize, orientation, 16)
      );

      if (clickedWord) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectionRange({ start: clickedWord.index, end: clickedWord.index });
        touchStartIdxRef.current = clickedWord.index;
        isSelectionGestureActiveRef.current = true;
      } else {
        // Clic dans le vide sur appui long -> désélectionne
        setSelectionRange(null);
        touchStartIdxRef.current = null;
      }
    }, 350);
  };

  const handleTouchMove = (x: number, y: number) => {
    setDebugTouch({x, y});
    // Si la sélection n'est pas encore active, on vérifie si le mouvement dépasse le seuil (glissement/scroll)
    if (!isSelectionGestureActiveRef.current) {
      if (touchStartPosRef.current) {
        const dx = x - touchStartPosRef.current.x;
        const dy = y - touchStartPosRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 25) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }
      return;
    }

    if (touchStartIdxRef.current === null || wordsWithRects.length === 0) return;

    const closestWord = findClosestWordToPoint(x, y);
    if (closestWord && selectionRange) {
      const newEnd = closestWord.index;
      if (newEnd !== selectionRange.end) {
        Haptics.selectionAsync();
        // Allow dynamic selection range but keeping start/end ordered logically if needed,
        // Actually, during drag we just set start = initial tap, end = current drag.
        // We will sort them in the UI and when calculating pins.
        setSelectionRange({
          start: touchStartIdxRef.current,
          end: newEnd,
        });
      }
    }
  };

  const handleTouchRelease = () => {
    setDebugTouch(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Gestion du clic simple (sans appui long) : sélectionne ou désélectionne immédiatement
    if (!isSelectionGestureActiveRef.current && touchStartPosRef.current) {
      const { x, y } = touchStartPosRef.current;
      const { photoW, photoH } = getPhotoDims();
      const photoSize = { width: photoW, height: photoH };

      const clickedWord = wordsWithRects.find(w =>
        isPointInBlock(x, y, w.element as any, imageSize, photoSize, orientation, 12)
      );

      if (clickedWord) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectionRange({ start: clickedWord.index, end: clickedWord.index });
      } else {
        setSelectionRange(null);
      }
    }

    touchStartIdxRef.current = null;
    touchStartPosRef.current = null;
    isSelectionGestureActiveRef.current = false;
  };

  // PanResponder pour capturer les clics et le drag sur l'image
  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const containerX = locationX + imageSize.offsetX;
        const containerY = locationY + imageSize.offsetY;
        handleTouchStart(containerX, containerY);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const containerX = locationX + imageSize.offsetX;
        const containerY = locationY + imageSize.offsetY;
        handleTouchMove(containerX, containerY);
      },
      onPanResponderRelease: () => {
        handleTouchRelease();
      },
      onPanResponderTerminationRequest: () => {
        return !isSelectionGestureActiveRef.current;
      },
      onPanResponderTerminate: () => {
        handleTouchRelease();
      },
    })
  ).current;

  // Draggable pin handlers
  // Instead of tracking arbitrary deltas, we track the absolute touch coordinate
  // and find the closest word to snap to.
  
  // Start Pin
  const startPinPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        // In dev mode or normal mode, we can show debug coords, but let's just do it
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!selectionRange) return;
        // The event coordinates here are relative to the pin's view. It's better to use moveX, moveY
        // or just calculate absolute position.
        // But gestureState.moveX / moveY are global screen coords. We need them relative to the image container.
        // It's safer to use gestureState.dx/dy relative to the initial pin position, OR better yet,
        // calculate based on the bounding box of the image.
        // Actually evt.nativeEvent.pageX/pageY can be used but React Native provides them.
        
        // Let's use a simpler approach: we know where the pin started.
        // We calculate targetX and targetY based on dx and dy from initial grant.
        
      },
      onPanResponderRelease: () => { setDebugTouch(null); },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => { setDebugTouch(null); },
    })
  ).current;

  // We need a stable reference to selection to avoid recreating PanResponders,
  // or we need to recreate them when selection changes?
  // Recreating them on every render is bad for performance. We can use Refs to hold current selection state.
  const currentSelectionRef = useRef<{start: number, end: number} | null>(null);
  useEffect(() => {
    if (selectionRange) {
      // Ensure min/max sorting is always stored
      const min = Math.min(selectionRange.start, selectionRange.end);
      const max = Math.max(selectionRange.start, selectionRange.end);
      currentSelectionRef.current = { start: min, end: max };
    } else {
      currentSelectionRef.current = null;
    }
  }, [selectionRange]);

  // Let's rebuild the Start Pin Pan Responder using the Ref pattern for stability
  const startPinPosRef = useRef({ x: 0, y: 0 });
  const startPinPanResponderStable = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (!currentSelectionRef.current || wordsWithRects.length === 0) return;
        const firstWord = wordsWithRects.find(w => w.index === currentSelectionRef.current!.start);
        if (firstWord) {
          startPinPosRef.current = {
            x: firstWord.rect.left,
            y: firstWord.rect.top + firstWord.rect.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!currentSelectionRef.current) return;
        const targetX = startPinPosRef.current.x + gestureState.dx;
        const targetY = startPinPosRef.current.y + gestureState.dy;
        
        setDebugTouch({x: targetX, y: targetY});

        const closestWord = findClosestWordToPoint(targetX, targetY);
        if (closestWord) {
          const currentEnd = currentSelectionRef.current.end;
          // Clamp start so it doesn't go past end
          const newStart = Math.min(closestWord.index, currentEnd);
          
          if (newStart !== currentSelectionRef.current.start) {
            Haptics.selectionAsync();
            setSelectionRange({
              start: newStart,
              end: currentEnd,
            });
          }
        }
      },
      onPanResponderRelease: () => { setDebugTouch(null); },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => { setDebugTouch(null); },
    })
  ).current;

  // End Pin
  const endPinPosRef = useRef({ x: 0, y: 0 });
  const endPinPanResponderStable = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (!currentSelectionRef.current || wordsWithRects.length === 0) return;
        const lastWord = wordsWithRects.find(w => w.index === currentSelectionRef.current!.end);
        if (lastWord) {
          endPinPosRef.current = {
            x: lastWord.rect.left + lastWord.rect.width,
            y: lastWord.rect.top + lastWord.rect.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!currentSelectionRef.current) return;
        const targetX = endPinPosRef.current.x + gestureState.dx;
        const targetY = endPinPosRef.current.y + gestureState.dy;

        setDebugTouch({x: targetX, y: targetY});

        const closestWord = findClosestWordToPoint(targetX, targetY);
        if (closestWord) {
          const currentStart = currentSelectionRef.current.start;
          // Clamp end so it doesn't go before start
          const newEnd = Math.max(closestWord.index, currentStart);

          if (newEnd !== currentSelectionRef.current.end) {
            Haptics.selectionAsync();
            setSelectionRange({
              start: currentStart,
              end: newEnd,
            });
          }
        }
      },
      onPanResponderRelease: () => { setDebugTouch(null); },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => { setDebugTouch(null); },
    })
  ).current;

  // Text reconstruction when selection changes
  useEffect(() => {
    if (!selectionRange || !wordsWithRects || wordsWithRects.length === 0) {
      setScannedText('');
      return;
    }

    const sortedRange = [selectionRange.start, selectionRange.end].sort((a, b) => a - b);
    const selectedElements = wordsWithRects
      .filter(w => w.index >= sortedRange[0] && w.index <= sortedRange[1])
      .map(w => w.element);

    const { photoW, photoH } = getPhotoDims();
    const photoSize = { width: photoW, height: photoH };

    const { scannedText: reconstructed } = reconstructTextFromBlocks(
      selectedElements as any[],
      imageSize,
      photo,
      0
    );

    setScannedText(reconstructed);
  }, [selectionRange, wordsWithRects, imageSize, photo]);

  // Actions for Context Menu
  const handleCopy = () => {
    if (!scannedText) return;
    try {
      const ClipboardModule = require('react-native').Clipboard;
      if (ClipboardModule && ClipboardModule.setString) {
        ClipboardModule.setString(scannedText);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.log('Clipboard is not available in react-native core.');
      }
    } catch (err) {
      console.log('Error copying to clipboard:', err);
    }
  };

  const handleShare = async () => {
    if (!scannedText) return;
    try {
      await Share.share({
        message: scannedText,
      });
    } catch (err) {
      console.log('Error sharing text:', err);
    }
  };

  const handleSelectAll = () => {
    if (wordsWithRects.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectionRange({
      start: 0,
      end: wordsWithRects.length - 1,
    });
  };

  // Determine sorted selected indexes for rendering highlights
  const selectionIndexes = useMemo(() => {
    if (!selectionRange) return { min: -1, max: -1 };
    const min = Math.min(selectionRange.start, selectionRange.end);
    const max = Math.max(selectionRange.start, selectionRange.end);
    return { min, max };
  }, [selectionRange]);

  // Find geometry for Start & End pins
  const pinsGeometry = useMemo(() => {
    if (!selectionRange || wordsWithRects.length === 0) return null;
    const minIdx = selectionIndexes.min;
    const maxIdx = selectionIndexes.max;

    const startWord = wordsWithRects.find(w => w.index === minIdx);
    const endWord = wordsWithRects.find(w => w.index === maxIdx);

    if (!startWord || !endWord) return null;

    return {
      startPin: {
        left: startWord.rect.left - 8,
        top: startWord.rect.top,
        height: startWord.rect.height,
      },
      endPin: {
        left: endWord.rect.left + endWord.rect.width - 8,
        top: endWord.rect.top,
        height: endWord.rect.height,
      },
      topWord: startWord.rect.top < endWord.rect.top ? startWord : endWord,
    };
  }, [selectionRange, selectionIndexes, wordsWithRects]);

  // Floating Context Menu Geometry
  const menuPosition = useMemo(() => {
    if (!pinsGeometry || !viewportSize.width) return null;
    const { topWord } = pinsGeometry;
    const menuWidth = 220; // estimate
    const left = Math.max(16, Math.min(viewportSize.width - menuWidth - 16, topWord.rect.left + topWord.rect.width / 2 - menuWidth / 2));
    const top = Math.max(16, topWord.rect.top - 58);
    return { left, top };
  }, [pinsGeometry, viewportSize]);

  return {
    // Dev Mode
    isDevMode,
    setIsDevMode,
    debugTouch,

    // Geometry / layout values
    photoDimensions,
    viewportSize,
    setViewportSize,
    imageSize,
    setImageSize,
    getPhotoDims,

    // Animation values
    animatedPhotoStyle,

    // Selection & highlight states
    scannedText,
    setScannedText,
    selectionRange,
    setSelectionRange,
    selectionIndexes,
    isHighlightMode,
    setIsHighlightMode,
    wordsWithRects,
    copied,

    // PanResponders
    imagePanResponder,
    startPinPanResponder: startPinPanResponderStable,
    endPinPanResponder: endPinPanResponderStable,

    // UI helper geometries
    pinsGeometry,
    menuPosition,

    // Modal controls
    showPreviewModal,
    setShowPreviewModal,

    // Actions
    handleSaveQuote,
    handleConfirmSave,
    handleCopy,
    handleShare,
    handleSelectAll,
  };
}
