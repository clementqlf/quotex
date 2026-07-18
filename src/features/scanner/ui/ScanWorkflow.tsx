/* eslint-disable react-hooks/refs */
import { TextBlock, TextElement } from '@react-native-ml-kit/text-recognition';
import { Bug, Eraser, RotateCcw } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { PhotoFile } from 'react-native-vision-camera';

import { PlatformServices } from '@/src/shared/platform';
import { useScanInteractions } from '../model/useScanInteractions';
import { SelectionRange, useScanState } from '../model/useScanState';

import ScanPreviewModal from '@/src/shared/ui/modals/ScanPreviewModal';

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrElements: TextElement[];
  ocrBlocks?: TextBlock[];
  onReset: () => void;
  isGallery?: boolean;
  normalizedSize?: { width: number; height: number } | null;
  onSave?: (text: string, book?: string | null, author?: string | null) => Promise<{ success: boolean; error?: string }>;
};

/**
 * Hook personnalisé pour gérer la logique de sélection et d'exclusion dans ScanWorkflow
 */
const useScanWorkflowLogic = (
  photo: PhotoFile,
  ocrElements: TextElement[],
  onReset: () => void,
  ocrBlocks?: TextBlock[],
  normalizedSize?: { width: number; height: number } | null,
  onSave?: (text: string, book?: string | null, author?: string | null) => Promise<{ success: boolean; error?: string }>
) => {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [debugTouch, setDebugTouch] = useState<{x: number, y: number} | null>(null);
  const [isEraserMode, setIsEraserMode] = useState(false);

  // Utiliser useScanState pour gérer l'état de sélection
  const scanState = useScanState({
    photo,
    ocrElements,
    ocrBlocks,
    normalizedSize,
    viewportSize,
  });

  const {
    words,
    selectionRange,
    excludedIndices,
    selectedText,
    imageDisplayInfo,
    setSelectionRange,
    setIsEraserMode: setEraserModeState,
    clearSelection,
    clearExclusions,
    toggleWordExclusion,
  } = scanState;

  // Synchroniser isEraserMode avec useScanState
  const handleSetIsEraserMode = useCallback((mode: boolean) => {
    setIsEraserMode(mode);
    setEraserModeState(mode);
  }, [setEraserModeState]);

  // Utiliser useScanInteractions pour gérer les interactions tactiles
  const scanInteractions = useScanInteractions({
    words,
    selectionRange: selectionRange,
    setSelectionRange: setSelectionRange as React.Dispatch<React.SetStateAction<SelectionRange | null>>,
    excludedIndices,
    toggleWordExclusion,
    isEraserMode,
    imageDisplayInfo,
  });

  const { imagePanResponder, findWordAtPosition } = scanInteractions;

  // Géométrie des épingles de sélection
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

  // Handlers pour les épingles de sélection
  const dragStartPos = useRef({ x: 0, y: 0 });
  const wordsRef = useRef(words);
  const selectionRangeRef = useRef(selectionRange);

  React.useEffect(() => {
    wordsRef.current = words;
    selectionRangeRef.current = selectionRange;
  }, [words, selectionRange]);

  const startPinResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        PlatformServices.haptics.impactAsync("light");
        const currentSelectionRange = selectionRangeRef.current;
        const currentWords = wordsRef.current;
        if (!currentSelectionRange || currentWords.length === 0) return;
        const startWord = currentWords[currentSelectionRange.start];
        if (startWord) {
          dragStartPos.current = {
            x: startWord.scaledFrame.left,
            y: startWord.scaledFrame.top + startWord.scaledFrame.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentSelectionRange = selectionRangeRef.current;
        if (!currentSelectionRange) return;
        const currentX = dragStartPos.current.x + gestureState.dx;
        const currentY = dragStartPos.current.y + gestureState.dy;

        setIsDevMode(prev => {
          if (prev) setDebugTouch({ x: currentX, y: currentY });
          return prev;
        });

        // Trouver le mot le plus proche
        const nearestIndex = findWordAtPosition(currentX, currentY);
        if (nearestIndex !== null && nearestIndex !== currentSelectionRange?.start) {
          setSelectionRange((prev: SelectionRange | null) => {
            if (!prev) return null as SelectionRange | null;
            return { start: Math.min(nearestIndex, prev.end), end: prev.end } as SelectionRange | null;
          });
        }
      },
    }),
    [findWordAtPosition, setSelectionRange]
  );

  const endPinResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        PlatformServices.haptics.impactAsync("light");
        const currentSelectionRange = selectionRangeRef.current;
        const currentWords = wordsRef.current;
        if (!currentSelectionRange || currentWords.length === 0) return;
        const endWord = currentWords[currentSelectionRange.end];
        if (endWord) {
          dragStartPos.current = {
            x: endWord.scaledFrame.left + endWord.scaledFrame.width,
            y: endWord.scaledFrame.top + endWord.scaledFrame.height / 2,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentSelectionRange = selectionRangeRef.current;
        if (!currentSelectionRange) return;
        const currentX = dragStartPos.current.x + gestureState.dx;
        const currentY = dragStartPos.current.y + gestureState.dy;

        setIsDevMode(prev => {
          if (prev) setDebugTouch({ x: currentX, y: currentY });
          return prev;
        });

        const nearestIndex = findWordAtPosition(currentX, currentY);
        if (nearestIndex !== null && nearestIndex !== currentSelectionRange?.end) {
          setSelectionRange((prev: SelectionRange | null) => {
            if (!prev) return null as SelectionRange | null;
            return { start: prev.start, end: Math.max(nearestIndex, prev.start) } as SelectionRange | null;
          });
        }
      },
    }),
    [findWordAtPosition, setSelectionRange]
  );

  // Actions pour les boutons
  const handleCopy = async () => {
    if (selectedText) {
      PlatformServices.clipboard.setString(selectedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      PlatformServices.haptics.notificationAsync("success");
    }
  };

  const handleShare = async () => {
    if (selectedText) {
      await PlatformServices.share.share({ message: selectedText });
    }
  };

  const handleSaveQuote = () => setShowPreviewModal(true);

  const handleClearSelection = useCallback(() => {
    clearSelection();
    clearExclusions();
    handleSetIsEraserMode(false);
  }, [clearSelection, clearExclusions, handleSetIsEraserMode]);

  const handleSelectAll = useCallback(() => {
    if (words.length > 0) {
      setSelectionRange({ start: 0, end: words.length - 1 });
    }
  }, [words.length, setSelectionRange]);

  // Handler pour la confirmation de sauvegarde

  const handleConfirmSaveFromScanner = useCallback(
    async (text: string, book: string, author: string) => {
      // Si une fonction onSave est fournie, l'utiliser
      if (onSave) {
        try {
          const result = await onSave(text, book || null, author || null);
          if (result.success) {
            PlatformServices.haptics.notificationAsync("success");
            setShowPreviewModal(false);
            onReset();
          } else {
            Alert.alert('Erreur', result.error || 'Impossible d\'enregistrer la citation.');
          }
          return;
        } catch {
          Alert.alert('Erreur', 'Une erreur est survenue lors de l\'enregistrement.');
          return;
        }
      }
      
      // Fallback pour la compatibilité avec l'ancien code
      // (devrait être supprimé une fois la migration terminée)
      setShowPreviewModal(false);
      onReset();
    },
    [onSave, onReset, setShowPreviewModal]
  );

  return {
    // State
    isDevMode,
    setIsDevMode,
    debugTouch,
    viewportSize,
    setViewportSize,
    showPreviewModal,
    setShowPreviewModal,
    copied,
    words,
    selectionRange,
    scannedText: selectedText,
    imageDisplayInfo,
    isEraserMode,
    setIsEraserMode: handleSetIsEraserMode,
    excludedIndices,
    
    // Handlers
    imagePanResponder,
    startPinResponder,
    endPinResponder,
    pinsGeometry,
    handleClearSelection,
    handleCopy,
    handleShare,
    handleSaveQuote,
    handleConfirmSave: handleConfirmSaveFromScanner,
    handleSelectAll,
    onReset,
  };
};


const COLLAPSED_HEIGHT = 100;
const EXPANDED_HEIGHT = 300;

const ScanWorkflow: React.FC<ScanWorkflowProps> = (props) => {
  const {
    isDevMode,
    setIsDevMode,
    debugTouch,
    setViewportSize,
    showPreviewModal,
    setShowPreviewModal,
    copied,
    words,
    selectionRange,
    scannedText,
    imageDisplayInfo,
    isEraserMode,
    setIsEraserMode,
    excludedIndices,
    imagePanResponder,
    startPinResponder,
    endPinResponder,
    pinsGeometry,
    handleClearSelection,
    handleCopy,
    handleSaveQuote,
    handleConfirmSave,
    handleSelectAll,
    onReset,
  } = useScanWorkflowLogic(
    props.photo,
    props.ocrElements,
    props.onReset,
    props.ocrBlocks,
    props.normalizedSize,
    props.onSave
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  const scrollOffset = useRef(0);
  const cardHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const startHeight = useRef(COLLAPSED_HEIGHT);

  React.useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  const expandCard = useCallback(() => {
    setIsExpanded(true);
    isExpandedRef.current = true;
    Animated.spring(cardHeight, {
      toValue: EXPANDED_HEIGHT,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start();
  }, [cardHeight]);

  const collapseCard = useCallback(() => {
    setIsExpanded(false);
    isExpandedRef.current = false;
    Animated.spring(cardHeight, {
      toValue: COLLAPSED_HEIGHT,
      useNativeDriver: false,
      friction: 8,
      tension: 50,
    }).start();
  }, [cardHeight]);

  React.useEffect(() => {
    if (!scannedText) {
      setIsExpanded(false);
      isExpandedRef.current = false;
      cardHeight.setValue(COLLAPSED_HEIGHT);
    }
  }, [scannedText, cardHeight]);

  const cardPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const isExp = isExpandedRef.current;
        if (!isExp) {
          return gestureState.dy < -10 && Math.abs(gestureState.dx) < 20;
        }
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < 20 && scrollOffset.current <= 0;
      },
      onPanResponderGrant: () => {
        startHeight.current = isExpandedRef.current ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
      },
      onPanResponderMove: (evt, gestureState) => {
        const newHeight = startHeight.current - gestureState.dy;
        const clampedHeight = Math.min(Math.max(newHeight, COLLAPSED_HEIGHT), EXPANDED_HEIGHT);
        cardHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentHeight = startHeight.current - gestureState.dy;
        const threshold = (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2;

        if (gestureState.vy < -0.5) {
          expandCard();
        } else if (gestureState.vy > 0.5) {
          collapseCard();
        } else if (currentHeight > threshold) {
          expandCard();
        } else {
          collapseCard();
        }
      },
    })
  ).current;

  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startHeight.current = isExpandedRef.current ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
      },
      onPanResponderMove: (evt, gestureState) => {
        const newHeight = startHeight.current - gestureState.dy;
        const clampedHeight = Math.min(Math.max(newHeight, COLLAPSED_HEIGHT), EXPANDED_HEIGHT);
        cardHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentHeight = startHeight.current - gestureState.dy;
        const threshold = (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2;

        const isTap = Math.abs(gestureState.dy) < 5 && Math.abs(gestureState.dx) < 5;
        if (isTap) {
          if (isExpandedRef.current) {
            collapseCard();
          } else {
            expandCard();
          }
        } else {
          if (gestureState.vy < -0.5) {
            expandCard();
          } else if (gestureState.vy > 0.5) {
            collapseCard();
          } else if (currentHeight > threshold) {
            expandCard();
          } else {
            collapseCard();
          }
        }
      },
    })
  ).current;

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setViewportSize({ width, height });
        }}
      >
        <View
          style={[
            styles.photoContent,
            { width: imageDisplayInfo.width, height: imageDisplayInfo.height }
          ]}
        >
          <Image
            source={{
              uri: props.photo.path.startsWith('file://') 
                ? props.photo.path 
                : `file://${props.photo.path}` 
            }}
            style={{
              width: '100%',
              height: '100%',
              opacity: isDevMode ? 0.4 : 1.0,
            }}
            resizeMode="contain"
          />

          {/* Apple Live Text inverse dimming effect (masking backdrop) */}
          {!isDevMode && (
            <Svg
              width={imageDisplayInfo.width}
              height={imageDisplayInfo.height}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <Mask id="textMask">
                  <Rect
                    width={imageDisplayInfo.width}
                    height={imageDisplayInfo.height}
                    fill="white"
                  />
                  {words.map((w) => {
                    const cx = w.scaledFrame.left + w.scaledFrame.width / 2;
                    const cy = w.scaledFrame.top + w.scaledFrame.height / 2;
                    const transform = w.rotation ? `rotate(${w.rotation}, ${cx}, ${cy})` : undefined;
                    return (
                      <Rect
                        key={`mask-rect-${w.index}`}
                        x={w.scaledFrame.left}
                        y={w.scaledFrame.top}
                        width={w.scaledFrame.width}
                        height={w.scaledFrame.height}
                        rx={2}
                        ry={2}
                        fill="black"
                        transform={transform}
                      />
                    );
                  })}
                </Mask>
              </Defs>
              <Rect
                width={imageDisplayInfo.width}
                height={imageDisplayInfo.height}
                fill="rgba(0, 0, 0, 0.55)"
                mask="url(#textMask)"
              />
            </Svg>
          )}

          {/* 1. Gesture overlay covers exactly the displayed image area to receive background touches */}
          <View
            {...imagePanResponder.current.panHandlers}
            pointerEvents={isExpanded ? 'none' : 'auto'}
            style={StyleSheet.absoluteFill}
          />

          {/* 2. Highlights and boxes (pointerEvents="none" to not block touches) */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Dev Mode: All words bounding boxes & reading order */}
            {isDevMode && words.map((w) => (
              <View
                key={`dev-word-${w.index}`}
                style={{
                  position: 'absolute',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 0, 0, 0.7)',
                  left: w.scaledFrame.left,
                  top: w.scaledFrame.top,
                  width: w.scaledFrame.width,
                  height: w.scaledFrame.height,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 9, color: 'white', fontWeight: 'bold', backgroundColor: 'rgba(255,0,0,0.5)', padding: 1 }}>{w.index}</Text>
              </View>
            ))}

            {/* Selectable Words (Apple Live Text effect) */}
            {!isDevMode && words.map((w) => {
              const isSelected = selectionRange && w.index >= selectionRange.start && w.index <= selectionRange.end;
              const isExcluded = excludedIndices.has(w.index);
              if (isSelected || isExcluded) return null;

              return (
                <View
                  key={`selectable-${w.index}`}
                  style={[
                    styles.selectableHighlight,
                    {
                      left: w.scaledFrame.left,
                      top: w.scaledFrame.top,
                      width: w.scaledFrame.width,
                      height: w.scaledFrame.height,
                      transform: w.rotation ? [{ rotate: `${w.rotation}deg` }] : undefined,
                    }
                  ]}
                />
              );
            })}

            {/* Selection Highlight */}
            {selectionRange && words
              .filter(w => w.index >= selectionRange.start && w.index <= selectionRange.end)
              .map((w) => {
                const isExcluded = excludedIndices.has(w.index);
                if (isExcluded) {
                  if (isEraserMode) {
                    return (
                      <View
                        key={`select-${w.index}`}
                        style={[
                          styles.excludedHighlight,
                          {
                            left: w.scaledFrame.left,
                            top: w.scaledFrame.top,
                            width: w.scaledFrame.width,
                            height: w.scaledFrame.height,
                            transform: w.rotation ? [{ rotate: `${w.rotation}deg` }] : undefined,
                          }
                        ]}
                      />
                    );
                  }
                  return null;
                }
                return (
                  <View
                    key={`select-${w.index}`}
                    style={[
                      styles.selectionHighlight,
                      {
                        left: w.scaledFrame.left,
                        top: w.scaledFrame.top,
                        width: w.scaledFrame.width,
                        height: w.scaledFrame.height,
                        transform: w.rotation ? [{ rotate: `${w.rotation}deg` }] : undefined,
                      }
                    ]}
                  />
                );
              })}

            {/* Dev Mode debug touch point */}
            {isDevMode && debugTouch && (
              <View
                style={{
                  position: 'absolute',
                  left: debugTouch.x - 10,
                  top: debugTouch.y - 10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(0, 255, 0, 0.6)',
                  borderWidth: 2,
                  borderColor: '#0f0',
                }}
              />
            )}
          </View>

          {/* 3. Pins (They must be outside the background GestureOverlay to receive their own touches) */}
          {/* Start Pin */}
          {pinsGeometry && (
            <View
              {...startPinResponder.panHandlers}
              pointerEvents={(isEraserMode || isExpanded) ? 'none' : 'auto'}
              style={[
                styles.grabberPin,
                isDevMode && styles.devGrabberPin,
                {
                  left: pinsGeometry.startPin.left,
                  top: pinsGeometry.startPin.top,
                  height: pinsGeometry.startPin.height,
                  opacity: isExpanded ? 0.3 : 1.0,
                }
              ]}
            >
              <View style={styles.grabberLine} />
              <View style={[styles.grabberKnob, { top: -10 }]} />
            </View>
          )}

          {/* End Pin */}
          {pinsGeometry && (
            <View
              {...endPinResponder.panHandlers}
              pointerEvents={(isEraserMode || isExpanded) ? 'none' : 'auto'}
              style={[
                styles.grabberPin,
                isDevMode && styles.devGrabberPin,
                {
                  left: pinsGeometry.endPin.left,
                  top: pinsGeometry.endPin.top,
                  height: pinsGeometry.endPin.height,
                  opacity: isExpanded ? 0.3 : 1.0,
                }
              ]}
            >
              <View style={styles.grabberLine} />
              <View style={[styles.grabberKnob, { bottom: -10 }]} />
            </View>
          )}
        </View>
      </View>

      {/* --- Dev Mode Overlay --- */}
      {isDevMode && (
        <View style={styles.devOverlay}>
          <Text style={styles.devText}>=== DEV MODE ===</Text>
          <Text style={styles.devText}>Photo: {props.photo.width}x{props.photo.height}</Text>
          <Text style={styles.devText}>Scale: {imageDisplayInfo.scale.toFixed(3)}</Text>
          <Text style={styles.devText}>Touch: {debugTouch ? `${Math.round(debugTouch.x)}, ${Math.round(debugTouch.y)}` : 'None'}</Text>
          <Text style={styles.devText}>Selection: {selectionRange ? `[${selectionRange.start}, ${selectionRange.end}]` : 'None'}</Text>
          <Text style={styles.devText}>Words Total: {words.length}</Text>
        </View>
      )}

      {/* Dev Mode Toggle Button */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devToggleButton}
          onPress={() => setIsDevMode(!isDevMode)}
        >
          <Bug size={24} color={isDevMode ? '#0f0' : '#666'} />
        </TouchableOpacity>
      )}

      {/* Basic Prod UI */}
      {!isDevMode && (
        <View style={styles.resultInfoContainer}>
          <Text style={styles.instructionText}>
            {isEraserMode
              ? "Touchez un mot sélectionné pour l'enlever"
              : scannedText
                ? 'Ajustez avec les poignées'
                : 'Appuyez sur un mot pour sélectionner'}
          </Text>
        </View>
      )}

      {scannedText && !isDevMode ? (
        <Animated.View 
          {...cardPanResponder.panHandlers}
          style={[styles.livePreviewCard, { height: cardHeight, overflow: 'hidden' }]}
        >
          <View {...handlePanResponder.panHandlers} style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>
          {isExpanded ? (
            <ScrollView 
              style={styles.expandedTextScrollView} 
              showsVerticalScrollIndicator={true}
              onScroll={(event) => {
                scrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.livePreviewText}>
                {scannedText}
              </Text>
            </ScrollView>
          ) : (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={expandCard}
              style={styles.expandedTextScrollView}
            >
              <Text style={styles.livePreviewText} numberOfLines={3} ellipsizeMode="tail">
                {scannedText}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.miniActionBar}>
            <TouchableOpacity onPress={handleSelectAll}><Text style={styles.actionText}>Tout Sélectionner</Text></TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onReset}
            accessible={true}
            accessibilityLabel="Annuler la sélection"
            accessibilityRole="button"
            testID="cancel-ocr-button"
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleClearSelection}
            accessible={true}
            accessibilityLabel="Effacer la sélection"
            accessibilityRole="button"
            testID="clear-selection-button"
          >
            <RotateCcw size={20} color="#E5E7EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.eraserButton,
              isEraserMode && styles.eraserButtonActive,
              !selectionRange && styles.eraserButtonDisabled
            ]}
            onPress={() => setIsEraserMode(!isEraserMode)}
            disabled={!selectionRange}
            accessible={true}
            accessibilityLabel="Activer le mode gomme pour enlever des mots"
            accessibilityRole="button"
            testID="eraser-mode-button"
          >
            <Eraser size={20} color={isEraserMode ? '#0F0F0F' : '#E5E7EB'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !scannedText && styles.saveButtonDisabled]}
            onPress={handleSaveQuote}
            disabled={!scannedText}
            accessible={true}
            accessibilityLabel="Enregistrer la citation sélectionnée"
            accessibilityRole="button"
            testID="save-ocr-button"
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
  },
  photoContent: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectableHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    zIndex: 1,
  },
  selectionHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.4)',
    borderRadius: 2,
    zIndex: 2,
  },
  excludedHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 2,
    zIndex: 2,
  },
  grabberPin: {
    position: 'absolute',
    width: 32,
    marginLeft: -16,
    zIndex: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devGrabberPin: {
    backgroundColor: 'rgba(255, 100, 100, 0.4)',
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
    paddingTop: 4,
    paddingBottom: 14,
    zIndex: 110,
  },
  handleContainer: {
    width: '100%',
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  expandedTextScrollView: {
    flex: 1,
    marginTop: -2,
    marginBottom: 8,
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
  miniActionBar: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionText: {
    color: '#20B8CD',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 15,
  },
  separator: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 15,
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
  resetButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  eraserButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  eraserButtonActive: {
    backgroundColor: '#20B8CD',
  },
  eraserButtonDisabled: {
    opacity: 0.5,
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
  devOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f0',
    zIndex: 200,
    pointerEvents: 'none',
  },
  devText: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 6,
  },
  devToggleButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    borderWidth: 1,
    borderColor: '#0f0',
  },
});

export default ScanWorkflow;
