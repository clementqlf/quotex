// ScanWorkflow.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
  Share,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Trash2, ScanLine } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { useData } from '@/src/app/providers/DataProvider';
import ScanPreviewModal from './ScanPreviewModal';
import { getBlockRectOnScreen, getPhotoOrientation, isPointInBlock } from '@/src/shared/lib/scanGeometry';
import { reconstructTextFromBlocks } from '@/src/features/scanner/model/textReconstructor';
import * as Haptics from 'expo-haptics';

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  onReset: () => void;
  isGallery?: boolean;
};

const ScanWorkflow: React.FC<ScanWorkflowProps> = ({ photo, ocrElements, ocrBlocks = [], onReset, isGallery }) => {
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
  const findClosestWord = (x: number, y: number) => {
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

    touchStartPosRef.current = { x, y };
    isSelectionGestureActiveRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Lance un minuteur de 350ms pour le long press
    longPressTimerRef.current = setTimeout(() => {
      const { photoW, photoH } = getPhotoDims();
      const photoSize = { width: photoW, height: photoH };

      // Cherche si l'appui long touche un mot (avec tolérance augmentée)
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
    // Si la sélection n'est pas encore active, on vérifie si le mouvement dépasse le seuil (glissement/scroll)
    if (!isSelectionGestureActiveRef.current) {
      if (touchStartPosRef.current) {
        const dx = x - touchStartPosRef.current.x;
        const dy = y - touchStartPosRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 25) {
          // Annulation du minuteur de long press si l'utilisateur glisse (il veut défiler ou scroller)
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }
      return;
    }

    if (touchStartIdxRef.current === null || wordsWithRects.length === 0) return;

    const closestWord = findClosestWord(x, y);
    if (closestWord && selectionRange) {
      const newEnd = closestWord.index;
      if (newEnd !== selectionRange.end) {
        Haptics.selectionAsync();
        setSelectionRange({
          start: touchStartIdxRef.current,
          end: newEnd,
        });
      }
    }
  };

  const handleTouchRelease = () => {
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
        // Permet au conteneur parent (scroll/swipe) de récupérer le geste seulement si la sélection n'a pas encore commencé
        return !isSelectionGestureActiveRef.current;
      },
      onPanResponderTerminate: () => {
        handleTouchRelease();
      },
    })
  ).current;

  // Draggable pin handlers
  const startPinPosRef = useRef({ x: 0, y: 0 });
  const startPinPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (!selectionRange || wordsWithRects.length === 0) return;
        const sortedRange = [selectionRange.start, selectionRange.end].sort((a, b) => a - b);
        const firstWord = wordsWithRects.find(w => w.index === sortedRange[0]);
        if (firstWord) {
          startPinPosRef.current = {
            x: firstWord.rect.left,
            y: firstWord.rect.top + firstWord.rect.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!selectionRange) return;
        const targetX = startPinPosRef.current.x + gestureState.dx;
        const targetY = startPinPosRef.current.y + gestureState.dy;

        const closestWord = findClosestWord(targetX, targetY);
        if (closestWord) {
          const sortedRange = [selectionRange.start, selectionRange.end].sort((a, b) => a - b);
          const otherEnd = selectionRange.start === sortedRange[0] ? selectionRange.end : selectionRange.start;

          if (closestWord.index !== selectionRange.start) {
            Haptics.selectionAsync();
            setSelectionRange({
              start: closestWord.index,
              end: otherEnd,
            });
          }
        }
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {},
    })
  ).current;

  const endPinPosRef = useRef({ x: 0, y: 0 });
  const endPinPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (!selectionRange || wordsWithRects.length === 0) return;
        const sortedRange = [selectionRange.start, selectionRange.end].sort((a, b) => a - b);
        const lastWord = wordsWithRects.find(w => w.index === sortedRange[1]);
        if (lastWord) {
          endPinPosRef.current = {
            x: lastWord.rect.left + lastWord.rect.width,
            y: lastWord.rect.top + lastWord.rect.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!selectionRange) return;
        const targetX = endPinPosRef.current.x + gestureState.dx;
        const targetY = endPinPosRef.current.y + gestureState.dy;

        const closestWord = findClosestWord(targetX, targetY);
        if (closestWord) {
          const sortedRange = [selectionRange.start, selectionRange.end].sort((a, b) => a - b);
          const otherStart = selectionRange.start === sortedRange[0] ? selectionRange.start : selectionRange.end;

          if (closestWord.index !== selectionRange.end) {
            Haptics.selectionAsync();
            setSelectionRange({
              start: otherStart,
              end: closestWord.index,
            });
          }
        }
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {},
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

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          // --- CALCUL DE L'ÉCHELLE POUR LE RESIZEMODE="CONTAIN" ---
          const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
          setViewportSize({ width: containerWidth, height: containerHeight });

          const { photoW, photoH } = getPhotoDims();

          const imageAspectRatio = photoW / photoH;
          const containerAspectRatio = containerWidth / containerHeight;

          let displayedWidth, displayedHeight, offsetX = 0, offsetY = 0;

          if (imageAspectRatio > containerAspectRatio) {
            displayedWidth = containerWidth;
            displayedHeight = containerWidth / imageAspectRatio;
            offsetY = (containerHeight - displayedHeight) / 2;
          } else {
            displayedHeight = containerHeight;
            displayedWidth = containerHeight * imageAspectRatio;
            offsetX = (containerWidth - displayedWidth) / 2;
          }

          setImageSize({ width: displayedWidth, height: displayedHeight, offsetX, offsetY });
        }}
      >
        <Animated.View style={[styles.photoContent, animatedPhotoStyle]}>
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={styles.photo}
            resizeMode="contain"
          />

          {/* Subtly highlight detected text boxes in the background (Live Text mode) */}
          {isHighlightMode && wordsWithRects.map((w) => (
            <View
              key={`detect-${w.index}`}
              style={[
                styles.detectedHighlight,
                {
                  left: w.rect.left,
                  top: w.rect.top,
                  width: w.rect.width,
                  height: w.rect.height,
                  transform: [{ rotate: `${w.rect.rotation || 0}deg` }],
                }
              ]}
            />
          ))}

          {/* Draw selection highlights over the selected text */}
          {selectionRange && wordsWithRects
            .filter(w => w.index >= selectionIndexes.min && w.index <= selectionIndexes.max)
            .map((w) => (
              <View
                key={`select-${w.index}`}
                style={[
                  styles.selectionHighlight,
                  {
                    left: w.rect.left - 2,
                    top: w.rect.top - 2,
                    width: w.rect.width + 4,
                    height: w.rect.height + 4,
                    transform: [{ rotate: `${w.rect.rotation || 0}deg` }],
                  }
                ]}
              />
            ))}

          {/* Gesture overlay covers the image viewport exactly to receive touch events */}
          {imageSize.width > 0 && (
            <View
              {...imagePanResponder.panHandlers}
              style={[
                styles.gestureOverlay,
                {
                  left: imageSize.offsetX,
                  top: imageSize.offsetY,
                  width: imageSize.width,
                  height: imageSize.height,
                }
              ]}
            />
          )}

          {/* Selection Pins (Grabber Handles) */}
          {pinsGeometry && (
            <>
              {/* Start Handle */}
              <View
                {...startPinPanResponder.panHandlers}
                style={[
                  styles.grabberPin,
                  {
                    left: pinsGeometry.startPin.left,
                    top: pinsGeometry.startPin.top,
                    height: pinsGeometry.startPin.height,
                  }
                ]}
              >
                <View style={styles.grabberLine} />
                <View style={[styles.grabberKnob, { top: -10 }]} />
              </View>

              {/* End Handle */}
              <View
                {...endPinPanResponder.panHandlers}
                style={[
                  styles.grabberPin,
                  {
                    left: pinsGeometry.endPin.left,
                    top: pinsGeometry.endPin.top,
                    height: pinsGeometry.endPin.height,
                  }
                ]}
              >
                <View style={styles.grabberLine} />
                <View style={[styles.grabberKnob, { bottom: -10 }]} />
              </View>
            </>
          )}

          {/* Floating Context Action Menu */}
          {menuPosition && (
            <View
              style={[
                styles.contextMenu,
                {
                  left: menuPosition.left,
                  top: menuPosition.top,
                }
              ]}
            >
              <TouchableOpacity style={styles.menuButton} onPress={handleCopy}>
                <Text style={styles.menuButtonText}>{copied ? 'Copié !' : 'Copier'}</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuButton} onPress={handleSaveQuote}>
                <Text style={styles.menuButtonText}>Enregistrer</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuButton} onPress={handleShare}>
                <Text style={styles.menuButtonText}>Partager</Text>
              </TouchableOpacity>
              <View style={styles.menuSeparator} />
              <TouchableOpacity style={styles.menuButton} onPress={handleSelectAll}>
                <Text style={styles.menuButtonText}>Tout</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Apple Photos style Live Text Toggle Icon in the bottom right corner */}
          {wordsWithRects.length > 0 && imageSize.width > 0 && (
            <TouchableOpacity
              style={[
                styles.liveTextButton,
                isHighlightMode && styles.liveTextButtonActive
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsHighlightMode(!isHighlightMode);
              }}
            >
              <ScanLine size={22} color={isHighlightMode ? '#0F0F0F' : '#E5E7EB'} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* --- UI PAR DESSUS --- */}
      <View style={styles.resultInfoContainer}>
        <Text style={styles.instructionText}>
          {scannedText ? 'Sélection prête !' : 'Restez appuyé sur le texte pour le sélectionner'}
        </Text>
      </View>

      {/* Carte flottante premium de prévisualisation en direct */}
      {scannedText ? (
        <View style={styles.livePreviewCard}>
          <Text style={styles.livePreviewHeader}>Texte sélectionné :</Text>
          <Text style={styles.livePreviewText} numberOfLines={3} ellipsizeMode="tail">
            {scannedText}
          </Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onReset}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectionRange(null);
            }}
          >
            <Trash2 size={20} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !scannedText && styles.saveButtonDisabled]}
            onPress={handleSaveQuote}
            disabled={!scannedText}
          >
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScanPreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmSave}
        scannedText={scannedText}
      />
    </>
  );
};

const styles = StyleSheet.create({
  photoContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  photoContent: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  detectedHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    zIndex: 1,
  },
  selectionHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.35)', // Cyan blue translucent highlight
    borderRadius: 4,
    zIndex: 2,
  },
  gestureOverlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  grabberPin: {
    position: 'absolute',
    width: 24,
    marginLeft: -12, // Offset to center the line in touch targets
    zIndex: 15,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grabberLine: {
    width: 2.5,
    height: '100%',
    backgroundColor: '#20B8CD',
  },
  grabberKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#20B8CD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  contextMenu: {
    position: 'absolute',
    width: 260,
    height: 40,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 100,
  },
  menuButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  menuSeparator: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  liveTextButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 6,
    zIndex: 20,
  },
  liveTextButtonActive: {
    backgroundColor: '#20B8CD',
    borderColor: '#20B8CD',
  },
  resultInfoContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.5)',
    zIndex: 100,
  },
  instructionText: {
    fontSize: 15,
    color: '#20B8CD',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 120,
  },
  livePreviewCard: {
    position: 'absolute',
    bottom: 125,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderColor: 'rgba(32, 184, 205, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 110,
  },
  livePreviewHeader: {
    color: '#20B8CD',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  livePreviewText: {
    color: '#E5E7EB',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    marginRight: 8,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  trashButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 8,
    borderRadius: 14,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2A2A2A',
  },
  saveButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScanWorkflow;