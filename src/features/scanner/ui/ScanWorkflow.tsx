import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { Trash2, Bug, Eraser } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { useScanState, WordData, ImageDisplayInfo, SelectionRange } from '../model/useScanState';
import { useScanInteractions } from '../model/useScanInteractions';
import { OcrProcessor } from '../model/ocrProcessor';
import { PlatformServices } from '@/src/shared/platform';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';

import ScanPreviewModal from './ScanPreviewModal';

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
    setExcludedIndices,
    setIsEraserMode: setEraserModeState,
    clearSelection,
    clearExclusions,
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

  const startPinResponder = useRef(
    PanResponder.create({
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
    })
  ).current;

  const endPinResponder = useRef(
    PanResponder.create({
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
    })
  ).current;

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
  const { refreshBooks } = useAuthor();

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
        } catch (error) {
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
    needsRotation: false,
    
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

// Import PanResponder from react-native
import { PanResponder } from 'react-native';

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
    needsRotation,
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
              style={StyleSheet.absoluteFillObject}
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
            style={StyleSheet.absoluteFillObject}
          />

          {/* 2. Highlights and boxes (pointerEvents="none" to not block touches) */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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
              pointerEvents={isEraserMode ? 'none' : 'auto'}
              style={[
                styles.grabberPin,
                isDevMode && styles.devGrabberPin,
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
          )}

          {/* End Pin */}
          {pinsGeometry && (
            <View
              {...endPinResponder.panHandlers}
              pointerEvents={isEraserMode ? 'none' : 'auto'}
              style={[
                styles.grabberPin,
                isDevMode && styles.devGrabberPin,
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
      <TouchableOpacity
        style={styles.devToggleButton}
        onPress={() => setIsDevMode(!isDevMode)}
      >
        <Bug size={24} color={isDevMode ? '#0f0' : '#666'} />
      </TouchableOpacity>

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
        <View style={styles.livePreviewCard}>
          <Text style={styles.livePreviewHeader}>Texte sélectionné :</Text>
          <Text style={styles.livePreviewText} numberOfLines={3} ellipsizeMode="tail">
            {scannedText}
          </Text>
          <View style={styles.miniActionBar}>
            <TouchableOpacity onPress={handleCopy}><Text style={styles.actionText}>{copied ? 'Copié' : 'Copier'}</Text></TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity onPress={handleSelectAll}><Text style={styles.actionText}>Tout Sélectionner</Text></TouchableOpacity>
          </View>
        </View>
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
            style={styles.trashButton}
            onPress={handleClearSelection}
            accessible={true}
            accessibilityLabel="Effacer la sélection"
            accessibilityRole="button"
            testID="clear-selection-button"
          >
            <Trash2 size={20} color="#E5E7EB" />
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
    paddingVertical: 14,
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
  trashButton: {
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
