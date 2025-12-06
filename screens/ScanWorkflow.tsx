import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { Heart, Share2, Trash2, X } from 'lucide-react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { addQuote, bookDescriptions, localQuotesDB } from '../data/staticData';

type MLKitText = {
  text: string;
  frame?: { left: number; top: number; width: number; height: number };
  cornerPoints?: Array<{ x: number; y: number }>;
  rotation?: number;
};

type ScanWorkflowProps = {
  photo: PhotoFile;
  ocrResult: TextRecognitionResult;
  onReset: () => void;
};

const HIGHLIGHT_PADDING = 1;
const PATH_SAMPLE_STEP = 1;

const ScanWorkflow: React.FC<ScanWorkflowProps> = ({ photo, ocrResult, onReset }) => {
  const navigation = useNavigation<any>();
  const [scannedText, setScannedText] = useState('');
  const [photoDimensions, setPhotoDimensions] = useState({ width: 0, height: 0 });
  const [selectedBlocks, setSelectedBlocks] = useState<MLKitText[]>([]);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const panModeRef = useRef<'add' | 'remove'>('add');
  const selectedBlocksRef = useRef<MLKitText[]>([]);
  const previewScale = useRef(new Animated.Value(1)).current;
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [isEditingAuthor, setIsEditingAuthor] = useState(false);
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [editedBook, setEditedBook] = useState('');
  const [editedAuthor, setEditedAuthor] = useState('');
  const [editedQuote, setEditedQuote] = useState('');
  const [showDebugAngles, setShowDebugAngles] = useState(false);

  const calculateTextRotation = (cornerPoints: Array<{ x: number; y: number }>): number => {
    if (!cornerPoints || cornerPoints.length < 4) return 0;

    let minVerticalVariance = Infinity;
    let bestAngle = 0;

    for (let i = 0; i < 4; i += 1) {
      const p1 = cornerPoints[i];
      const p2 = cornerPoints[(i + 1) % 4];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const verticalVariance = Math.abs(dy);

      if (verticalVariance < minVerticalVariance) {
        minVerticalVariance = verticalVariance;
        const angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180) / Math.PI;
        while (angleDeg > 180) angleDeg -= 360;
        while (angleDeg < -180) angleDeg += 360;
        if (Math.abs(angleDeg) > 85 && Math.abs(angleDeg) < 95) {
          bestAngle = 0;
        } else {
          bestAngle = angleDeg;
        }
      }
    }

    return bestAngle;
  };

  const wordBlocks = useMemo<MLKitText[]>(() => {
    if (!ocrResult) return [];
    const words: MLKitText[] = [];
    ocrResult.blocks.forEach(block => {
      block.lines?.forEach(line => {
        line.elements?.forEach(element => {
          if (element.frame) {
            const cornerPoints = (element as any)?.cornerPoints;
            const rotation = cornerPoints ? calculateTextRotation(cornerPoints) : undefined;
            words.push({
              text: element.text,
              frame: element.frame,
              cornerPoints,
              rotation,
            });
          }
        });
      });
    });
    return words;
  }, [ocrResult]);

  const imageInfoRef = useRef({ photo, photoDimensions, imageSize, wordBlocks, viewportSize });

  useEffect(() => {
    imageInfoRef.current = { photo, photoDimensions, imageSize, wordBlocks, viewportSize };
  }, [photo, photoDimensions, imageSize, wordBlocks, viewportSize]);

  useEffect(() => {
    selectedBlocksRef.current = selectedBlocks;
  }, [selectedBlocks]);

  useEffect(() => {
    const uri = `file://${photo.path}`;
    Image.getSize(
      uri,
      (width, height) => setPhotoDimensions({ width, height }),
      () => setPhotoDimensions({ width: photo.width || 0, height: photo.height || 0 }),
    );
  }, [photo]);

  useEffect(() => {
    Animated.spring(previewScale, {
      toValue: photo && ocrResult ? 1.4 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [photo, ocrResult, previewScale]);

  useEffect(() => {
    type PositionedBlock = {
      block: MLKitText;
      rect: { left: number; top: number; width: number; height: number; rotation?: number };
      alignedX: number;
      alignedY: number;
    };

    const angles = selectedBlocks
      .map(block => block.rotation || 0)
      .filter(angle => angle !== 0);

    const globalAngle = angles.length > 0
      ? angles.reduce((a, b) => a + b, 0) / angles.length
      : 0;

    const oriented: PositionedBlock[] = selectedBlocks
      .map<PositionedBlock | null>(block => {
        const rect = getBlockRectOnScreen(block);
        if (!rect) return null;

        let alignedX = rect.left + rect.width / 2;
        let alignedY = rect.top + rect.height / 2;

        if (globalAngle !== 0) {
          const { imageSize } = imageInfoRef.current;
          const centerX = imageSize.offsetX + imageSize.width / 2;
          const centerY = imageSize.offsetY + imageSize.height / 2;

          const dx = alignedX - centerX;
          const dy = alignedY - centerY;

          const angleRad = (globalAngle * Math.PI) / 180;
          const cosA = Math.cos(angleRad);
          const sinA = Math.sin(angleRad);

          alignedX = centerX + (dx * cosA + dy * sinA);
          alignedY = centerY + (-dx * sinA + dy * cosA);
        }

        return { block, rect, alignedX, alignedY };
      })
      .filter((item): item is PositionedBlock => item !== null);

    const heights = oriented.map(item => item.rect.height).sort((a, b) => a - b);
    const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    const LINE_TOLERANCE = Math.max(6, medianHeight * 0.5);

    const lines: Array<{ centerY: number; words: PositionedBlock[] }> = [];
    oriented.forEach(item => {
      const centerY = item.alignedY;
      let line = lines.find(l => Math.abs(l.centerY - centerY) < LINE_TOLERANCE);
      if (!line) {
        line = { centerY, words: [] };
        lines.push(line);
      }
      line.words.push(item);
    });

    lines.sort((a, b) => a.centerY - b.centerY);
    const sortedWords = lines.flatMap(line => line.words.sort((a, b) => a.alignedX - b.alignedX));
    const newText = sortedWords.map(item => item.block.text).join(' ');
    setScannedText(newText);
  }, [selectedBlocks]);

  const selectionPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        if (!evt?.nativeEvent) return;
        const { photo, imageSize } = imageInfoRef.current;
        if (!photo || imageSize.width === 0) return;

        const locationX = evt.nativeEvent.locationX;
        const locationY = evt.nativeEvent.locationY;
        if (locationX === undefined || locationY === undefined) return;

        lastTouchRef.current = { x: locationX, y: locationY };

        const initialBlocks = getBlocksNearPoint(locationX, locationY);
        const selectedKeys = new Set(selectedBlocksRef.current.map(getBlockKey));
        const shouldErase = initialBlocks.some(block => selectedKeys.has(getBlockKey(block)));
        panModeRef.current = shouldErase ? 'remove' : 'add';

        applyHighlightStroke([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: evt => {
        if (!evt?.nativeEvent) return;
        const locationX = evt.nativeEvent.locationX;
        const locationY = evt.nativeEvent.locationY;
        if (locationX === undefined || locationY === undefined) return;

        const currentPoint = { x: locationX, y: locationY };
        const lastPoint = lastTouchRef.current;
        const points = lastPoint ? sampleLinePoints(lastPoint, currentPoint) : [currentPoint];
        applyHighlightStroke(points);
        lastTouchRef.current = currentPoint;
      },
      onPanResponderRelease: () => {
        lastTouchRef.current = null;
      },
      onPanResponderTerminate: () => {
        lastTouchRef.current = null;
      },
    }),
  ).current;

  const getBlockKey = (block: MLKitText): string => {
    return `${block.text}-${block.frame?.left}-${block.frame?.top}`;
  };

  const sampleLinePoints = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.floor(distance / PATH_SAMPLE_STEP));

    const points = [] as { x: number; y: number }[];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      points.push({ x: from.x + dx * t, y: from.y + dy * t });
    }
    return points;
  };

  const applyHighlightStroke = (points: { x: number; y: number }[]) => {
    const touchedBlocksMap = new Map<string, MLKitText>();
    points.forEach(point => {
      getBlocksNearPoint(point.x, point.y).forEach(block => {
        touchedBlocksMap.set(getBlockKey(block), block);
      });
    });

    if (touchedBlocksMap.size === 0) return;

    const blocksToUpdate = Array.from(touchedBlocksMap.values()).sort((a, b) => {
      const rectA = getBlockRectOnScreen(a);
      const rectB = getBlockRectOnScreen(b);
      if (!rectA || !rectB) return 0;

      const tolerance = Math.max(rectA.height, rectB.height) * 0.3;
      const centerYDiff = Math.abs((rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2));

      if (centerYDiff < tolerance) {
        return rectA.left - rectB.left;
      }
      return (rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2);
    });

    updateSelectionForBlocks(blocksToUpdate, panModeRef.current);
  };

  const updateSelectionForBlocks = (blocks: MLKitText[], mode: 'add' | 'remove') => {
    if (blocks.length === 0) return;

    setSelectedBlocks(prev => {
      const next = [...prev];
      const currentKeys = new Set(next.map(getBlockKey));

      blocks.forEach(block => {
        const key = getBlockKey(block);
        if (mode === 'add') {
          if (!currentKeys.has(key)) {
            next.push(block);
            currentKeys.add(key);
          }
        } else if (currentKeys.has(key)) {
          const index = next.findIndex(b => getBlockKey(b) === key);
          if (index > -1) {
            next.splice(index, 1);
            currentKeys.delete(key);
          }
        }
      });

      return next;
    });
  };

  const getBlocksNearPoint = (x: number, y: number, padding = HIGHLIGHT_PADDING) => {
    const { wordBlocks, imageSize } = imageInfoRef.current;
    if (imageSize.width === 0) return [] as MLKitText[];
    return wordBlocks.filter(block => isPointInBlock(x, y, block, padding));
  };

  const isPointInBlock = (x: number, y: number, block: MLKitText, padding = 0): boolean => {
    const rect = getBlockRectOnScreen(block);
    if (!rect) return false;

    if (!rect.rotation || rect.rotation === 0) {
      return (
        x >= rect.left - padding &&
        x <= rect.left + rect.width + padding &&
        y >= rect.top - padding &&
        y <= rect.top + rect.height + padding
      );
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const angleRad = (rect.rotation * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const localX = dx * cosA + dy * sinA;
    const localY = -dx * sinA + dy * cosA;
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;

    return (
      localX >= -halfWidth - padding &&
      localX <= halfWidth + padding &&
      localY >= -halfHeight - padding &&
      localY <= halfHeight + padding
    );
  };

  const getBlockRectOnScreen = (
    block: MLKitText,
    sizeOverride?: { width: number; height: number; offsetX: number; offsetY: number },
  ) => {
    // Prefer the latest measured size stored in the ref; fall back to state if needed
    const refSize = imageInfoRef.current?.imageSize;
    const currentImageSize =
      sizeOverride ?? (refSize?.width ? refSize : imageSize);
    if (!block.frame || !currentImageSize || currentImageSize.width === 0) return null;

    const orientation = getPhotoOrientation();
    const isNormalized =
      block.frame.left <= 1 && block.frame.top <= 1 &&
      block.frame.width <= 1 && block.frame.height <= 1;

    const { photoW, photoH } = getPhotoDimensions();
    const baseWidth = isNormalized ? 1 : photoW;
    const baseHeight = isNormalized ? 1 : photoH;

    const rotatedFrame = rotateFrameToUpright(
      {
        left: block.frame.left ?? 0,
        top: block.frame.top ?? 0,
        width: block.frame.width ?? 0,
        height: block.frame.height ?? 0,
      },
      orientation,
      baseWidth,
      baseHeight,
    );

    const orientedBaseWidth = orientation === 90 || orientation === 270 ? baseHeight : baseWidth;
    const orientedBaseHeight = orientation === 90 || orientation === 270 ? baseWidth : baseHeight;

    const scaleX = currentImageSize.width / orientedBaseWidth;
    const scaleY = currentImageSize.height / orientedBaseHeight;

    const left = (orientation === 90 || orientation === 270)
      ? ((orientedBaseWidth - (rotatedFrame.left + rotatedFrame.width)) * scaleX) + currentImageSize.offsetX
      : (rotatedFrame.left * scaleX) + currentImageSize.offsetX;

    const top = (orientation === 90 || orientation === 270)
      ? ((orientedBaseHeight - (rotatedFrame.top + rotatedFrame.height)) * scaleY) + currentImageSize.offsetY
      : (rotatedFrame.top * scaleY) + currentImageSize.offsetY;

    const width = rotatedFrame.width * scaleX;
    const height = rotatedFrame.height * scaleY;

    return {
      left,
      top,
      width,
      height,
      rotation: block.rotation,
    };
  };

  const rotateFrameToUpright = (
    frame: NonNullable<MLKitText['frame']>,
    orientation: number,
    baseWidth: number,
    baseHeight: number,
  ) => {
    if (orientation === 0) return frame;

    const { left, top, width, height } = frame;

    if (orientation === 90) {
      return {
        left: top,
        top: baseWidth - (left + width),
        width: height,
        height: width,
      };
    }

    if (orientation === 180) {
      return {
        left: baseWidth - (left + width),
        top: baseHeight - (top + height),
        width,
        height,
      };
    }

    return {
      left: baseHeight - (top + height),
      top: left,
      width: height,
      height: width,
    };
  };

  const getPhotoDimensions = () => {
    // Use freshest values to avoid a blank overlay on first render
    const photoW = photo?.width || photoDimensions.width || 1;
    const photoH = photo?.height || photoDimensions.height || 1;
    return { photoW, photoH };
  };

  const getPhotoOrientation = () => {
    const rawOrientation =
      (imageInfoRef.current.photo as any)?.metadata?.Orientation ||
      (imageInfoRef.current.photo as any)?.metadata?.orientation ||
      (imageInfoRef.current.photo as any)?.metadata?.Exif?.Orientation ||
      1;

    switch (rawOrientation) {
      case 3:
        return 180;
      case 6:
        return 90;
      case 8:
        return 270;
      default:
        return 0;
    }
  };

  const handleSaveQuote = () => {
    if (!scannedText) return;
    setShowPreviewModal(true);
  };

  const handleConfirmSave = () => {
    const finalText = editedQuote.trim() || scannedText;
    if (!finalText) return;

    const bookTitle = editedBook.trim() || Object.keys(bookDescriptions).find(title =>
      localQuotesDB.some(q => q.text === scannedText && q.book === title)
    ) || 'Livre inconnu';

    const authorName = editedAuthor.trim() || bookDescriptions[bookTitle]?.author || 'Auteur inconnu';

    addQuote({ text: finalText, book: bookTitle, author: authorName });

    setShowPreviewModal(false);
    setScannedText('');
    setSelectedBlocks([]);
    setEditedBook('');
    setEditedAuthor('');
    setEditedQuote('');
    setIsEditingBook(false);
    setIsEditingAuthor(false);
    setIsEditingQuote(false);

    navigation.navigate('MyQuotes');
    onReset();
  };

  return (
    <>
      <View
        style={styles.photoContainer}
        onLayout={event => {
          const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
          setViewportSize({ width: containerWidth, height: containerHeight });

          const orientation = getPhotoOrientation();
          const { photoW, photoH } = getPhotoDimensions();
          const orientedWidth = orientation === 90 || orientation === 270 ? photoH : photoW;
          const orientedHeight = orientation === 90 || orientation === 270 ? photoW : photoH;

          const imageAspectRatio = orientedWidth / orientedHeight;
          const containerAspectRatio = containerWidth / containerHeight;

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

          setImageSize({
            width: displayedWidth,
            height: displayedHeight,
            offsetX,
            offsetY,
          });

          imageInfoRef.current = {
            photo,
            photoDimensions,
            imageSize: {
              width: displayedWidth,
              height: displayedHeight,
              offsetX,
              offsetY,
            },
            wordBlocks,
            viewportSize: { width: containerWidth, height: containerHeight },
          };
        }}
      >
        <Animated.View style={[styles.photoContent, { transform: [{ scale: previewScale }] }]}> 
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={styles.photo}
            resizeMode="contain"
          />
          <View style={styles.blocksOverlay} {...selectionPanResponder.panHandlers}>
            {imageSize.width > 0 && wordBlocks.map((block, index) => {
              const rect = getBlockRectOnScreen(block);
              if (!rect) return null;

              const isSelected = selectedBlocks.some(b => getBlockKey(b) === getBlockKey(block));

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
                  ]}
                  pointerEvents="none"
                >
                  {showDebugAngles && rect.rotation ? (
                    <Text style={styles.blockDebugText}>{rect.rotation.toFixed(1)}°</Text>
                  ) : null}
                </View>
              );
            })}
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
            {showDebugAngles && selectedBlocks.length > 0 && selectedBlocks.some(b => b.rotation) && (
              <Text style={styles.blocksInfo}>
                Angles: {selectedBlocks
                  .filter(b => b.rotation !== undefined)
                  .map(b => `${b.rotation?.toFixed(1)}°`)
                  .join(', ')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => setShowDebugAngles(prev => !prev)}
          >
            <Text style={{ fontSize: 14 }}>🐛</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.instructionText}>
          {selectedBlocks.length > 0
            ? 'Sélection prête, enregistrez la citation'
            : 'Glissez votre doigt pour sélectionner la citation'}
        </Text>
      </View>

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
              setScannedText('');
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

      <Modal
        animationType="slide"
        transparent
        visible={showPreviewModal}
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setShowPreviewModal(false)}>
          <Pressable style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Aperçu de la citation</Text>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                <X size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.previewScrollView}>
              <View style={styles.previewQuoteCard}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={styles.quoteIcon}>
                  <Path
                    d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                    fill="#20B8CD"
                    opacity={0.12}
                  />
                </Svg>

                {isEditingQuote ? (
                  <TextInput
                    style={styles.previewQuoteInput}
                    value={editedQuote}
                    autoFocus
                    multiline
                    onChangeText={setEditedQuote}
                    onBlur={() => setIsEditingQuote(false)}
                    placeholder="Modifier la citation"
                    placeholderTextColor="#6B7280"
                    returnKeyType="done"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setIsEditingQuote(true);
                      setEditedQuote(scannedText);
                    }}
                  >
                    <Text style={styles.previewQuoteText}>{scannedText}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.previewBookInfo}>
                  <View style={styles.bookInfoLeft}>
                    {isEditingBook ? (
                      <TextInput
                        style={styles.bookTitleInput}
                        value={editedBook}
                        autoFocus
                        onChangeText={setEditedBook}
                        onBlur={() => setIsEditingBook(false)}
                        placeholder="Titre du livre"
                        placeholderTextColor="#6B7280"
                        returnKeyType="done"
                        onSubmitEditing={() => setIsEditingBook(false)}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditingBook(true);
                          setEditedBook(
                            Object.keys(bookDescriptions).find(title =>
                              localQuotesDB.some(q => q.text === scannedText && q.book === title)
                            ) || 'Livre inconnu'
                          );
                        }}
                      >
                        <Text style={styles.bookTitle}>
                          {editedBook || Object.keys(bookDescriptions).find(title =>
                            localQuotesDB.some(q => q.text === scannedText && q.book === title)
                          ) || 'Livre inconnu'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {isEditingAuthor ? (
                      <TextInput
                        style={styles.authorInput}
                        value={editedAuthor}
                        autoFocus
                        onChangeText={setEditedAuthor}
                        onBlur={() => setIsEditingAuthor(false)}
                        placeholder="Nom de l'auteur"
                        placeholderTextColor="#6B7280"
                        returnKeyType="done"
                        onSubmitEditing={() => setIsEditingAuthor(false)}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditingAuthor(true);
                          const bookTitle = editedBook || Object.keys(bookDescriptions).find(title =>
                            localQuotesDB.some(q => q.text === scannedText && q.book === title)
                          ) || 'Livre inconnu';
                          setEditedAuthor(bookDescriptions[bookTitle]?.author || 'Auteur inconnu');
                        }}
                      >
                        <Text style={styles.authorName}>
                          {editedAuthor || (() => {
                            const bookTitle = editedBook || Object.keys(bookDescriptions).find(title =>
                              localQuotesDB.some(q => q.text === scannedText && q.book === title)
                            ) || 'Livre inconnu';
                            return bookDescriptions[bookTitle]?.author || 'Auteur inconnu';
                          })()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <View style={styles.actionButton}>
                    <Heart size={20} color="#6B7280" fill="none" />
                    <Text style={styles.actionText}>0</Text>
                  </View>
                  <View style={styles.actionButton}>
                    <Share2 size={20} color="#6B7280" />
                    <Text style={styles.actionText}>Partager</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewCancelButton}
                onPress={() => setShowPreviewModal(false)}
              >
                <Text style={styles.previewCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewConfirmButton}
                onPress={handleConfirmSave}
              >
                <Text style={styles.previewConfirmButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  blocksOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-only',
  },
  textBlock: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: 'none',
    borderRadius: 4,
  },
  textBlockSelected: {
    backgroundColor: 'rgba(0, 255, 0, 0.5)',
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
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#0F0F0F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  previewTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  previewScrollView: {
    maxHeight: 400,
  },
  previewQuoteCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    margin: 16,
  },
  quoteIcon: {
    marginBottom: 8,
  },
  previewQuoteText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#E5E7EB',
    marginBottom: 16,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
    fontWeight: '100',
  },
  previewQuoteInput: {
    fontSize: 18,
    lineHeight: 28,
    color: '#FFFFFF',
    marginBottom: 16,
    backgroundColor: '#222',
    borderRadius: 6,
    padding: 10,
  },
  previewBookInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  bookInfoLeft: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    color: '#20B8CD',
    marginBottom: 4,
  },
  bookTitleInput: {
    fontSize: 14,
    color: '#20B8CD',
    backgroundColor: '#222',
    borderRadius: 6,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  authorName: {
    fontSize: 12,
    color: '#6B7280',
  },
  authorInput: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#222',
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  previewCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  previewCancelButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#20B8CD',
    alignItems: 'center',
  },
  previewConfirmButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScanWorkflow;
