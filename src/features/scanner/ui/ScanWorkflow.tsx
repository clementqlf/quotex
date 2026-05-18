import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { useData } from '@/src/app/providers/DataProvider';
import ScanPreviewModal from './ScanPreviewModal';
import { useScanSelection } from '../model/useScanSelection';
import { getBlockRectOnScreen, getPhotoOrientation, MLKitText } from '@/src/shared/lib/scanGeometry';

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrResult: TextRecognitionResult;
  onReset: () => void;
  isGallery?: boolean;
};

const ScanWorkflow: React.FC<ScanWorkflowProps> = ({ photo, ocrResult, onReset, isGallery }) => {
  useEffect(() => {
    console.log('ScanWorkflow: Loaded with photo:', photo.path);
    console.log('ScanWorkflow: OCR blocks count:', ocrResult?.blocks?.length);
  }, [photo.path, ocrResult?.blocks?.length]);

  const router = useRouter();
  const { addQuote } = useData();
  const [photoDimensions, setPhotoDimensions] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const previewScale = useSharedValue(1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDebugAngles, setShowDebugAngles] = useState(false);
  const [showAngleValues, setShowAngleValues] = useState(true);
  const [showDebugSegments, setShowDebugSegments] = useState(false);
  const [showDebugColumns, setShowDebugColumns] = useState(false);

  useEffect(() => {
    const uri = `file://${photo.path}`;
    Image.getSize(
      uri,
      (width, height) => setPhotoDimensions({ width, height }),
      () => setPhotoDimensions({ width: photo.width || 0, height: photo.height || 0 }),
    );
  }, [photo]);

  // Use the new hook
  const {
    wordBlocks,
    selectedBlocks,
    sortedSelectedBlocks,
    setSelectedBlocks,
    scannedText,
    panResponder,
    getBlockKey,
    globalAngle,
    selectionMode,
    setSelectionMode,
    segmentStartBlock,
  } = useScanSelection(photo, ocrResult, imageSize, photoDimensions);

  const uniqueSegments = useMemo(() => {
    const segmentsMap = new Map<string, { rect: { left: number; top: number; width: number; height: number }; id: string }>();
    wordBlocks.forEach(block => {
      if (block.blockId && block.parentScreenRect && !segmentsMap.has(block.blockId)) {
        segmentsMap.set(block.blockId, {
          rect: block.parentScreenRect,
          id: block.blockId,
        });
      }
    });
    return Array.from(segmentsMap.values());
  }, [wordBlocks]);

  const uniqueColumns = useMemo(() => {
    if (wordBlocks.length === 0) return [];

    // Group word blocks by their columnId
    const columnsMap = new Map<string, {
      minLeft: number;
      maxRight: number;
      minTop: number;
      maxBottom: number;
      blocksCount: number;
    }>();

    wordBlocks.forEach(block => {
      if (block.columnId) {
        const key = block.columnId;
        const rect = block.screenRect || block.parentScreenRect;
        if (!rect) return;

        const current = columnsMap.get(key) || {
          minLeft: Infinity,
          maxRight: -Infinity,
          minTop: Infinity,
          maxBottom: -Infinity,
          blocksCount: 0
        };

        current.minLeft = Math.min(current.minLeft, rect.left);
        current.maxRight = Math.max(current.maxRight, rect.left + rect.width);
        current.minTop = Math.min(current.minTop, rect.top);
        current.maxBottom = Math.max(current.maxBottom, rect.top + rect.height);
        current.blocksCount += 1;

        columnsMap.set(key, current);
      }
    });

    return Array.from(columnsMap.values()).map((col, index) => ({
      id: Array.from(columnsMap.keys())[index],
      rect: {
        left: col.minLeft,
        top: col.minTop,
        width: col.maxRight - col.minLeft,
        height: col.maxBottom - col.minTop
      },
      blocksCount: col.blocksCount
    }));
  }, [wordBlocks]);

  useEffect(() => {
    const targetScale = isGallery ? 1 : 1.4;
    previewScale.value = withSpring(photo && ocrResult ? targetScale : 1, {
      damping: 12,
      stiffness: 90,
    });
  }, [photo, ocrResult, isGallery]);

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
    setSelectedBlocks([]);

    router.back();
    onReset();
  };

  const orientation = useMemo(() => getPhotoOrientation(photo), [photo]);

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
          setViewportSize({ width: containerWidth, height: containerHeight });

          const orient = getPhotoOrientation(photo);
          const { photoW, photoH } = getPhotoDims();
          const orientedWidth = orient === 90 || orient === 270 ? photoH : photoW;
          const orientedHeight = orient === 90 || orient === 270 ? photoW : photoH;

          const imageAspectRatio = orientedHeight > 0 ? orientedWidth / orientedHeight : 1;
          const containerAspectRatio = containerHeight > 0 ? containerWidth / containerHeight : 1;

          let displayedWidth;
          let displayedHeight;
          let offsetX = 0;
          let offsetY = 0;

          if (imageAspectRatio > containerAspectRatio) {
            displayedWidth = containerWidth;
            displayedHeight = containerWidth / imageAspectRatio;
            offsetY = (containerHeight - displayedHeight) / 2;
          } else {
            displayedHeight = containerHeight;
            displayedWidth = containerHeight * imageAspectRatio;
            offsetX = (containerWidth - displayedWidth) / 2;
          }

          const nextSize = {
            width: displayedWidth,
            height: displayedHeight,
            offsetX,
            offsetY,
          };

          setImageSize(prev => {
            if (
              prev.width === nextSize.width &&
              prev.height === nextSize.height &&
              prev.offsetX === nextSize.offsetX &&
              prev.offsetY === nextSize.offsetY
            ) {
              return prev;
            }
            return nextSize;
          });
        }}
      >
        <Animated.View style={[styles.photoContent, animatedPhotoStyle]}>
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={styles.photo}
            resizeMode="contain"
          />
          <View style={styles.blocksOverlay} {...panResponder.panHandlers}>
            {showDebugAngles && (
              <>
                {/* Repère Fixe (Écran) */}
                <View style={[styles.debugAxesContainer, { zIndex: 899 }]}>
                  <View style={[styles.debugAxisX, { backgroundColor: 'rgba(255, 0, 0, 0.3)' }]} />
                  <View style={[styles.debugAxisY, { backgroundColor: 'rgba(255, 0, 0, 0.3)' }]} />
                  <Text style={[styles.axisLabel, { position: 'absolute', right: -120, top: 10, color: 'rgba(255, 0, 0, 0.6)' }]}>ECRAN X →</Text>
                  <Text style={[styles.axisLabel, { position: 'absolute', top: 110, right: 10, color: 'rgba(255, 0, 0, 0.6)' }]}>ECRAN Y ↓</Text>
                </View>

                {/* Repère Mobile (Texte / Local) */}
                <View style={[
                  styles.debugAxesContainer,
                  { transform: [{ rotate: `${globalAngle}deg` }] }
                ]}>
                  <View style={[styles.debugAxisX, { backgroundColor: '#20B8CD' }]} />
                  <View style={[styles.debugAxisY, { backgroundColor: '#20B8CD' }]} />
                  <Text style={[styles.axisLabel, { position: 'absolute', right: -120, top: -20, color: '#20B8CD' }]}>TEXTE X →</Text>
                  <Text style={[styles.axisLabel, { position: 'absolute', top: -120, right: -20, color: '#20B8CD' }]}>TEXTE Y ↑</Text>
                </View>
              </>
            )}
            {showDebugAngles && showDebugSegments && imageSize.width > 0 && uniqueSegments.map((seg, idx) => {
              const hue = (parseInt(seg.id.replace('seg-', ''), 10) * 137) % 360;
              return (
                <View
                  key={`seg-box-${seg.id}-${idx}`}
                  style={[
                    styles.segmentDebugBox,
                    {
                      left: seg.rect.left,
                      top: seg.rect.top,
                      width: seg.rect.width,
                      height: seg.rect.height,
                      transform: [{ rotate: `${globalAngle}deg` }],
                      borderColor: `hsl(${hue}, 85%, 55%)`,
                      backgroundColor: `hsl(${hue}, 85%, 55%, 0.08)`,
                    }
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.segmentDebugBadge, { backgroundColor: `hsl(${hue}, 85%, 45%)` }]}>
                    <Text style={styles.segmentDebugText}>{seg.id}</Text>
                  </View>
                </View>
              );
            })}
            {showDebugAngles && showDebugColumns && imageSize.width > 0 && uniqueColumns.map((col, idx) => {
              const hue = (idx * 97) % 360;
              return (
                <View
                  key={`col-box-${col.id}-${idx}`}
                  style={[
                    styles.columnDebugBox,
                    {
                      left: col.rect.left - 2,
                      top: col.rect.top - 2,
                      width: col.rect.width + 4,
                      height: col.rect.height + 4,
                      transform: [{ rotate: `${globalAngle}deg` }],
                      borderColor: `hsl(${hue}, 90%, 55%)`,
                      backgroundColor: `hsl(${hue}, 90%, 55%, 0.08)`,
                    }
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.columnDebugBadge, { backgroundColor: `hsl(${hue}, 90%, 45%)` }]}>
                    <Text style={styles.columnDebugText}>{col.id} ({col.blocksCount} mots)</Text>
                  </View>
                </View>
              );
            })}
            {imageSize.width > 0 && wordBlocks.map((block, index) => {
              const rect = getBlockRectOnScreen(block, imageSize, { width: photo.width, height: photo.height }, orientation);
              if (!rect) return null;

              const blockKey = getBlockKey(block);
              const isSelected = selectedBlocks.some(b => getBlockKey(b) === blockKey);
              const isSegmentStart = selectionMode === 'segment' && segmentStartBlock && getBlockKey(segmentStartBlock) === blockKey;
              const sortedIndex = isSelected
                ? sortedSelectedBlocks.findIndex(b => getBlockKey(b) === blockKey)
                : -1;

              return (
                <View
                  key={`${block.text}-${index}-${rect.left}`}
                  style={[
                    styles.textBlock,
                    {
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                      transform: rect.rotation ? [{ rotate: `${rect.rotation}deg` }] : undefined,
                    },
                    isSelected && styles.textBlockSelected,
                    isSegmentStart && styles.textBlockSegmentStart,
                  ]}
                  pointerEvents="none"
                >
                  {showDebugAngles && (
                    <View style={styles.blockBaseline} />
                  )}
                  {showDebugAngles && sortedIndex !== -1 && (
                    <View style={styles.debugOrderContainer}>
                      <Text style={styles.debugOrderText}>{sortedIndex + 1}</Text>
                    </View>
                  )}
                  {showDebugAngles && showAngleValues && rect.rotation ? (
                    <View style={styles.debugAngleContainer}>
                      <Text style={styles.blockDebugText}>{rect.rotation.toFixed(1)}°</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* Rendu des poignées de sélection natives (Apple-style) en mode Poignées */}
            {selectionMode === 'native' && selectedBlocks.length > 0 && (() => {
              const firstSelectedBlock = sortedSelectedBlocks[0];
              const lastSelectedBlock = sortedSelectedBlocks[sortedSelectedBlocks.length - 1];
              if (!firstSelectedBlock || !lastSelectedBlock) return null;

              const firstRect = getBlockRectOnScreen(firstSelectedBlock, imageSize, { width: photo.width, height: photo.height }, orientation);
              const lastRect = getBlockRectOnScreen(lastSelectedBlock, imageSize, { width: photo.width, height: photo.height }, orientation);
              if (!firstRect || !lastRect) return null;

              return (
                <>
                  {/* Poignée gauche (point en haut) */}
                  <View style={[styles.nativeHandle, { left: firstRect.left - 2, top: firstRect.top - 2, height: firstRect.height + 4 }]}>
                    <View style={[styles.nativeHandleDot, { top: -6 }]} />
                  </View>

                  {/* Poignée droite (point en bas) */}
                  <View style={[styles.nativeHandle, { left: lastRect.left + lastRect.width - 1, top: lastRect.top - 2, height: lastRect.height + 4 }]}>
                    <View style={[styles.nativeHandleDot, { bottom: -6 }]} />
                  </View>
                </>
              );
            })()}
          </View>
        </Animated.View>
      </View>

      <View style={styles.resultInfoContainer}>
        <View style={styles.resultInfoHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.blocksInfo}>
              {wordBlocks.length} bloc(s) détecté(s)
              {selectedBlocks.length > 0 && ` • ${selectedBlocks.length} sélectionné(s)`}
            </Text>
            {showDebugAngles && showAngleValues && selectedBlocks.length > 0 && selectedBlocks.some(b => b.rotation) && (
              <Text style={styles.blocksInfo}>
                Angles: {selectedBlocks
                  .filter(b => b.rotation !== undefined)
                  .map(b => `${b.rotation?.toFixed(1)}°`)
                  .join(', ')}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {showDebugAngles && (
              <>
                <TouchableOpacity
                  style={[styles.debugButton, { marginRight: 8, backgroundColor: showAngleValues ? 'rgba(32, 184, 205, 0.4)' : 'rgba(107, 114, 128, 0.3)' }]}
                  onPress={() => setShowAngleValues(prev => !prev)}
                >
                  <Text style={{ fontSize: 14 }}>📐</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.debugButton, { marginRight: 8, backgroundColor: showDebugSegments ? 'rgba(168, 85, 247, 0.4)' : 'rgba(107, 114, 128, 0.3)' }]}
                  onPress={() => setShowDebugSegments(prev => !prev)}
                >
                  <Text style={{ fontSize: 14 }}>📦</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.debugButton, { marginRight: 8, backgroundColor: showDebugColumns ? 'rgba(59, 130, 246, 0.4)' : 'rgba(107, 114, 128, 0.3)' }]}
                  onPress={() => setShowDebugColumns(prev => !prev)}
                >
                  <Text style={{ fontSize: 14 }}>🏛️</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.debugButton, { backgroundColor: showDebugAngles ? 'rgba(32, 184, 205, 0.4)' : 'rgba(107, 114, 128, 0.3)' }]}
              onPress={() => setShowDebugAngles(prev => !prev)}
            >
              <Text style={{ fontSize: 14 }}>🐛</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.instructionText}>
          {selectedBlocks.length > 0
            ? 'Sélection prête, enregistrez la citation'
            : ''}
        </Text>

        {/* Menu de sélection du mode de sélection (déboguage chenille) */}
        {showDebugAngles && (
          <View style={styles.debugModeSelectorContainer}>
            <Text style={styles.debugSelectorHeader}>Mode de Sélection (Debug) :</Text>
            <View style={styles.debugModeRow}>
              <TouchableOpacity
                style={[styles.debugModeBtn, selectionMode === 'drag' && styles.debugModeBtnActive]}
                onPress={() => setSelectionMode('drag')}
              >
                <Text style={[styles.debugModeBtnText, selectionMode === 'drag' && styles.debugModeBtnTextActive]}>Surligneur</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugModeBtn, selectionMode === 'native' && styles.debugModeBtnActive]}
                onPress={() => setSelectionMode('native')}
              >
                <Text style={[styles.debugModeBtnText, selectionMode === 'native' && styles.debugModeBtnTextActive]}>Poignées</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugModeBtn, selectionMode === 'segment' && styles.debugModeBtnActive]}
                onPress={() => setSelectionMode('segment')}
              >
                <Text style={[styles.debugModeBtnText, selectionMode === 'segment' && styles.debugModeBtnTextActive]}>Segment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onReset}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trashButton}
            onPress={() => {
              setSelectedBlocks([]);
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
    marginTop: 120, // Évite la superposition avec le bandeau d'information supérieur (debug/chenille)
    marginBottom: 235, // Évite la superposition avec la carte "Texte sélectionné" et les contrôles inférieurs
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
    opacity: 0.72, // Assombrit légèrement la page du livre pour faire ressortir le texte interactif
  },
  blocksOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-only',
  },
  textBlock: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.12)', // Lueur cyan douce par défaut
    borderColor: 'rgba(32, 184, 205, 0.25)', // Fine bordure cyan pour marquer le contour des mots
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: 'none',
    borderRadius: 4,
  },
  textBlockSelected: {
    backgroundColor: 'rgba(32, 184, 205, 0.42)', // Remplissage cyan vif uniforme
    borderRadius: 4,
  },
  blockBaseline: {
    position: 'absolute',
    bottom: -1,
    left: -2,
    right: -2,
    height: 1.5,
    backgroundColor: '#20B8CD',
    borderRadius: 1,
    opacity: 0.8,
  },
  debugAngleContainer: {
    backgroundColor: 'rgba(15, 15, 15, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  debugOrderContainer: {
    position: 'absolute',
    top: -14,
    left: 0,
    backgroundColor: '#00FF00',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    minWidth: 16,
    alignItems: 'center',
    zIndex: 1100,
  },
  debugOrderText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: 'bold',
  },
  debugAxesContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1,
    height: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 900,
  },
  debugAxisX: {
    position: 'absolute',
    width: 2000,
    height: 1.5,
    backgroundColor: '#FF0000',
    opacity: 0.6,
  },
  debugAxisY: {
    position: 'absolute',
    width: 1.5,
    height: 2000,
    backgroundColor: '#FF0000',
    opacity: 0.6,
  },
  axisLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  blockDebugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultInfoContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.5)',
    zIndex: 100,
  },
  resultInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  blocksInfo: {
    color: '#20B8CD',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'left',
  },
  debugButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  instructionText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 120,
  },
  livePreviewCard: {
    position: 'absolute',
    bottom: 135,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    borderColor: 'rgba(32, 184, 205, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
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
    fontSize: 14,
    lineHeight: 20,
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
  textBlockSegmentStart: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)', // Rouge/corail translucide doux pour l'ancrage du segment
    borderColor: '#EF4444',
    borderWidth: 1.5,
    borderRadius: 4,
  },
  nativeHandle: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#20B8CD',
    zIndex: 1050,
  },
  nativeHandleDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#20B8CD',
    left: -4,
  },
  debugModeSelectorContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(32, 184, 205, 0.25)',
  },
  debugSelectorHeader: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  debugModeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  debugModeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  debugModeBtnActive: {
    backgroundColor: 'rgba(32, 184, 205, 0.15)',
    borderColor: '#20B8CD',
  },
  debugModeBtnText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  debugModeBtnTextActive: {
    color: '#20B8CD',
  },
  columnDebugBox: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 8,
    zIndex: 940,
  },
  columnDebugBadge: {
    position: 'absolute',
    top: -14,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 960,
  },
  columnDebugText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  segmentDebugBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 6,
    zIndex: 950,
  },
  segmentDebugBadge: {
    position: 'absolute',
    top: -12,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 960,
  },
  segmentDebugText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});

export default ScanWorkflow;
