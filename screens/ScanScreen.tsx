import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  SafeAreaView,
  View,
  ActivityIndicator,
  PanResponder,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BookOpen, ChevronLeft, ChevronRight, ScanLine, ImageIcon, Sparkles, Trash2, Heart, Share2, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission, PhotoFile } from 'react-native-vision-camera';
import TextRecognition, {
  TextRecognitionResult,
} from '@react-native-ml-kit/text-recognition';
// Type pour les blocs de texte ML Kit avec support de rotation
type MLKitText = {
  text: string;
  frame?: { left: number; top: number; width: number; height: number };
  cornerPoints?: Array<{ x: number; y: number }>; // Points pour détecter l'angle
  rotation?: number; // Angle de rotation en degrés
};
import { useTabIndex } from '../TabNavigator';
import { useSwipeEnabled } from '../TabNavigator';
import { addQuote, bookDescriptions, localQuotesDB } from '../data/staticData';

const quotexLogo = require('../assets/images/quotex_logo.png'); 

export default function ScanScreen() {
  const navigation = useNavigation<any>();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const [photo, setPhoto] = useState<PhotoFile | null>(null);
  const [photoDimensions, setPhotoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [ocrResult, setOcrResult] = useState<TextRecognitionResult | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<MLKitText[]>([]);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<{ 
    width: number; 
    height: number; 
    offsetX: number; 
    offsetY: number;
  }>({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const panModeRef = useRef<'add' | 'remove'>('add');
  const { tabIndex, setTabIndex } = useTabIndex();
  const { setSwipeEnabled } = useSwipeEnabled();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [isPanning, setIsPanning] = useState(false);
  const selectedBlocksRef = useRef<MLKitText[]>([]);
  const HIGHLIGHT_PADDING = 1; // narrower hitbox so finger selection is tighter
  const PATH_SAMPLE_STEP = 1; // px spacing between sampled points during a swipe
  const COLUMN_TOLERANCE = 6; // px threshold to consider words in the same column
  const previewScale = useRef(new Animated.Value(1)).current;
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isEditingBook, setIsEditingBook] = useState(false);
  const [isEditingAuthor, setIsEditingAuthor] = useState(false);
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [editedBook, setEditedBook] = useState("");
  const [editedAuthor, setEditedAuthor] = useState("");
  const [editedQuote, setEditedQuote] = useState("");
  const [showDebugAngles, setShowDebugAngles] = useState(false); // Toggle pour debug

  // Calculer l'angle de rotation du texte à partir des cornerPoints
  const calculateTextRotation = (cornerPoints: Array<{ x: number; y: number }>): number => {
    if (!cornerPoints || cornerPoints.length < 4) return 0;

    // ML Kit retourne les 4 coins. On cherche le segment le plus horizontal (la baseline du texte)
    // Essayer tous les pairs de points adjacents pour trouver la baseline
    let minVerticalVariance = Infinity;
    let bestAngle = 0;

    for (let i = 0; i < 4; i++) {
      const p1 = cornerPoints[i];
      const p2 = cornerPoints[(i + 1) % 4];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      // Si c'est un segment quasi-horizontal (peu de variation en Y), c'est probablement la baseline
      const verticalVariance = Math.abs(dy);
      
      if (verticalVariance < minVerticalVariance) {
        minVerticalVariance = verticalVariance;
        const angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180) / Math.PI;

        // Normaliser entre -180 et 180
        while (angleDeg > 180) angleDeg -= 360;
        while (angleDeg < -180) angleDeg += 360;

        // Si l'angle est proche de ±90, le ramener à 0 (texte horizontal)
        if (Math.abs(angleDeg) > 85 && Math.abs(angleDeg) < 95) {
          bestAngle = 0;
        } else {
          bestAngle = angleDeg;
        }
      }
    }

    return bestAngle;
  };

  // Transformer les coordonnées pour aligner le repère X avec les lignes du texte
  const transformCoordinatesToTextAlignment = (
    block: MLKitText,
    containerWidth: number,
    containerHeight: number
  ) => {
    if (!block.rotation || block.rotation === 0 || !block.frame) {
      return block.frame;
    }

    const frame = block.frame;
    const centerX = frame.left + frame.width / 2;
    const centerY = frame.top + frame.height / 2;

    // Angle en radians (négatif pour la rotation standard)
    const angleRad = -(block.rotation * Math.PI) / 180;

    // Nouvelle largeur et hauteur après rotation
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const newWidth = Math.abs(frame.width * cosA) + Math.abs(frame.height * sinA);
    const newHeight = Math.abs(frame.width * sinA) + Math.abs(frame.height * cosA);

    return {
      left: centerX - newWidth / 2,
      top: centerY - newHeight / 2,
      width: newWidth,
      height: newHeight,
      rotation: block.rotation, // Stocker l'angle pour référence
    };
  };

  // Transformer un point de coordonnées écran vers le repère aligné au texte
  const rotatePointToTextFrame = (
    point: { x: number; y: number },
    block: MLKitText
  ): { x: number; y: number } | null => {
    if (!block.rotation || !block.frame) return point;

    // Centre du bloc
    const centerX = block.frame.left + block.frame.width / 2;
    const centerY = block.frame.top + block.frame.height / 2;

    // Translator le point au centre
    const dx = point.x - centerX;
    const dy = point.y - centerY;

    // Appliquer la rotation inverse pour passer du repère standard au repère texte
    const angleRad = (block.rotation * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const newX = dx * cosA + dy * sinA;
    const newY = -dx * sinA + dy * cosA;

    return {
      x: centerX + newX,
      y: centerY + newY,
    };
  };

  // Obtenir le repère aligné avec le texte (optionnel, pour affichage)
  const getAlignedCoordinates = (block: MLKitText) => {
    const { imageSize } = imageInfoRef.current;
    return transformCoordinatesToTextAlignment(block, imageSize.width, imageSize.height);
  };

  const wordBlocks = useMemo<MLKitText[]>(() => {
    if (!ocrResult) return [];
    const words: MLKitText[] = [];
    ocrResult.blocks.forEach(block => {
      block.lines?.forEach(line => {
        line.elements?.forEach(element => {
          if (element.frame) {
            // Récupérer les cornerPoints si disponibles et calculer l'angle
            const cornerPoints = (element as any)?.cornerPoints;
            const rotation = cornerPoints ? calculateTextRotation(cornerPoints) : undefined;
            
            words.push({ 
              text: element.text, 
              frame: element.frame,
              cornerPoints: cornerPoints,
              rotation: rotation
            });
          }
        });
      });
    });
    return words;
  }, [ocrResult]);

  const imageInfoRef = useRef({ photo, photoDimensions, imageSize, wordBlocks, containerSize });

  const getPhotoDimensions = () => {
    const photoW = imageInfoRef.current.photo?.width || imageInfoRef.current.photoDimensions.width || 1;
    const photoH = imageInfoRef.current.photo?.height || imageInfoRef.current.photoDimensions.height || 1;
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
        // Orientation 90° : on remet l'axe X sur l'ancien Y et l'axe Y sur (largeur - X)
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
      // Orientation 270° : inverse du cas 90°
      left: baseHeight - (top + height),
      top: left,
      width: height,
      height: width,
    };
  };

  useEffect(() => {
    imageInfoRef.current = { photo, photoDimensions, imageSize, wordBlocks, containerSize };
  }, [photo, photoDimensions, imageSize, wordBlocks, containerSize]);

  useEffect(() => {
    selectedBlocksRef.current = selectedBlocks;
  }, [selectedBlocks]);

  // Helper pour créer une clé unique pour chaque bloc
  const getBlockKey = (block: MLKitText): string => {
    return `${block.text}-${block.frame?.left}-${block.frame?.top}`;
  };

  const getBlockRectOnScreen = (block: MLKitText) => {
    const { imageSize } = imageInfoRef.current;
    if (!block.frame || imageSize.width === 0) return null;

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

    const scaleX = imageSize.width / orientedBaseWidth;
    const scaleY = imageSize.height / orientedBaseHeight;

    const left = (orientation === 90 || orientation === 270)
      ? ((orientedBaseWidth - (rotatedFrame.left + rotatedFrame.width)) * scaleX) + imageSize.offsetX
      : (rotatedFrame.left * scaleX) + imageSize.offsetX;

    const top = (orientation === 90 || orientation === 270)
      ? ((orientedBaseHeight - (rotatedFrame.top + rotatedFrame.height)) * scaleY) + imageSize.offsetY
      : (rotatedFrame.top * scaleY) + imageSize.offsetY;

    const width = rotatedFrame.width * scaleX;
    const height = rotatedFrame.height * scaleY;

    return {
      left,
      top,
      width,
      height,
      rotation: block.rotation, // Inclure l'angle de rotation
    };
  };

  // Frame orienté en portrait (non mis à l'échelle écran) pour ordonner les mots
  const getOrientedFrame = (block: MLKitText) => {
    const frame = block.frame;
    if (!frame) return null;

    const orientation = getPhotoOrientation();
    const isNormalized =
      frame.left <= 1 && frame.top <= 1 && frame.width <= 1 && frame.height <= 1;

    const { photoW, photoH } = getPhotoDimensions();
    const baseWidth = isNormalized ? 1 : photoW;
    const baseHeight = isNormalized ? 1 : photoH;

    const rotatedFrame = rotateFrameToUpright(
      {
        left: frame.left ?? 0,
        top: frame.top ?? 0,
        width: frame.width ?? 0,
        height: frame.height ?? 0,
      },
      orientation,
      baseWidth,
      baseHeight,
    );

    return { frame: rotatedFrame, isNormalized };
  };

  // Helper pour vérifier si un point touche un bloc (avec support de la rotation)
  const isPointInBlock = (x: number, y: number, block: MLKitText, padding = 0): boolean => {
    const rect = getBlockRectOnScreen(block);
    if (!rect) return false;

    // Si le bloc n'a pas de rotation, utiliser la vérification simple
    if (!rect.rotation || rect.rotation === 0) {
      return (
        x >= rect.left - padding &&
        x <= rect.left + rect.width + padding &&
        y >= rect.top - padding &&
        y <= rect.top + rect.height + padding
      );
    }

    // Avec rotation : transformer le point dans le repère du bloc
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Translater le point au centre du bloc
    const dx = x - centerX;
    const dy = y - centerY;

    // Appliquer la rotation inverse pour passer au repère du bloc
    const angleRad = (rect.rotation * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    // Rotation inverse
    const localX = dx * cosA + dy * sinA;
    const localY = -dx * sinA + dy * cosA;

    // Vérifier si le point est dans le rectangle roté
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;

    return (
      localX >= -halfWidth - padding &&
      localX <= halfWidth + padding &&
      localY >= -halfHeight - padding &&
      localY <= halfHeight + padding
    );
  };

  const getBlocksNearPoint = (x: number, y: number, padding = HIGHLIGHT_PADDING) => {
    const { wordBlocks, imageSize } = imageInfoRef.current;
    if (imageSize.width === 0) return [] as MLKitText[];
    return wordBlocks.filter(block => isPointInBlock(x, y, block, padding));
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
        } else {
          if (currentKeys.has(key)) {
            const index = next.findIndex(b => getBlockKey(b) === key);
            if (index > -1) {
              next.splice(index, 1);
              currentKeys.delete(key);
            }
          }
        }
      });

      return next;
    });
  };

  const applyHighlightStroke = (points: { x: number; y: number }[]) => {
    const touchedBlocksMap = new Map<string, MLKitText>();
    points.forEach(point => {
      getBlocksNearPoint(point.x, point.y).forEach(block => {
        touchedBlocksMap.set(getBlockKey(block), block);
      });
    });

    if (touchedBlocksMap.size === 0) return;
    
    // Trier les blocs par position (haut → bas, puis gauche → droite) avant de les ajouter
    const blocksToUpdate = Array.from(touchedBlocksMap.values()).sort((a, b) => {
      const rectA = getBlockRectOnScreen(a);
      const rectB = getBlockRectOnScreen(b);
      if (!rectA || !rectB) return 0;
      
      // Tolérance pour considérer deux blocs sur la même ligne
      const tolerance = Math.max(rectA.height, rectB.height) * 0.3;
      const centerYDiff = Math.abs((rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2));
      
      if (centerYDiff < tolerance) {
        // Même ligne : trier par position horizontale (gauche → droite)
        return rectA.left - rectB.left;
      }
      // Lignes différentes : trier par position verticale (haut → bas)
      return (rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2);
    });
    
    updateSelectionForBlocks(blocksToUpdate, panModeRef.current);
  };

  const selectionPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!evt || !evt.nativeEvent) return;
        
        const { photo, imageSize } = imageInfoRef.current;
        if (!photo || imageSize.width === 0) return;
        
        // Capturer les valeurs immédiatement
        const locationX = evt.nativeEvent.locationX;
        const locationY = evt.nativeEvent.locationY;
        
        if (locationX === undefined || locationY === undefined) return;
        
        setIsPanning(true);
        lastTouchRef.current = { x: locationX, y: locationY };

        const initialBlocks = getBlocksNearPoint(locationX, locationY);
        const selectedKeys = new Set(selectedBlocksRef.current.map(getBlockKey));
        const shouldErase = initialBlocks.some(block => selectedKeys.has(getBlockKey(block)));
        panModeRef.current = shouldErase ? 'remove' : 'add';

        applyHighlightStroke([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        if (!evt || !evt.nativeEvent) return;
        
        const locationX = evt.nativeEvent.locationX;
        const locationY = evt.nativeEvent.locationY;
        
        if (locationX !== undefined && locationY !== undefined) {
          const currentPoint = { x: locationX, y: locationY };
          const lastPoint = lastTouchRef.current;
          const points = lastPoint ? sampleLinePoints(lastPoint, currentPoint) : [currentPoint];
          applyHighlightStroke(points);
          lastTouchRef.current = currentPoint;
        }
      },
      onPanResponderRelease: () => {
        setIsPanning(false);
        lastTouchRef.current = null;
      },
      onPanResponderTerminate: () => {
        setIsPanning(false);
        lastTouchRef.current = null;
      },
    })
  ).current;

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (!photo) {
      setPhotoDimensions({ width: 0, height: 0 });
      return;
    }

    const uri = `file://${photo.path}`;
    Image.getSize(
      uri,
      (width, height) => setPhotoDimensions({ width, height }),
      () => setPhotoDimensions({ width: photo.width || 0, height: photo.height || 0 }),
    );
  }, [photo]);

  // Suppression de la gestion de l'orientation : la photo est toujours affichée en portrait

  useEffect(() => {
    if (isFocused) setTabIndex(1);
  }, [isFocused]);

  useEffect(() => {
    Animated.spring(previewScale, {
      toValue: photo && ocrResult ? 1.4 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [photo, ocrResult, previewScale]);
  
  // Désactiver le swipe quand on est en mode sélection de blocs
  useEffect(() => {
    if (photo && ocrResult) {
      setSwipeEnabled(false);
    } else {
      setSwipeEnabled(true);
    }
  }, [photo, ocrResult, setSwipeEnabled]);
  
  useEffect(() => {
    // Mettre à jour le texte scanné lorsque la sélection de blocs change
    // Utilise les coordonnées dans le repère aligné au texte pour le tri (pas les coordonnées écran rotées)
    type PositionedBlock = { 
      block: MLKitText; 
      rect: { left: number; top: number; width: number; height: number; rotation?: number };
      alignedX: number; // Coordonnée X dans le repère aligné
      alignedY: number; // Coordonnée Y dans le repère aligné
    };
    
    // Calculer l'angle moyen de tous les blocs pour avoir un repère global cohérent
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
        
        // Utiliser l'angle global pour transformer toutes les coordonnées dans le même repère
        let alignedX = rect.left + rect.width / 2;
        let alignedY = rect.top + rect.height / 2;
        
        // Si il y a une rotation (globale), transformer les coordonnées
        if (globalAngle !== 0) {
          // Centre de l'image pour la transformation globale
          const { imageSize } = imageInfoRef.current;
          const centerX = imageSize.offsetX + imageSize.width / 2;
          const centerY = imageSize.offsetY + imageSize.height / 2;
          
          const dx = alignedX - centerX;
          const dy = alignedY - centerY;
          
          const angleRad = (globalAngle * Math.PI) / 180;
          const cosA = Math.cos(angleRad);
          const sinA = Math.sin(angleRad);
          
          // Rotation inverse pour passer au repère du texte
          alignedX = centerX + (dx * cosA + dy * sinA);
          alignedY = centerY + (-dx * sinA + dy * cosA);
        }
        
        return { block, rect, alignedX, alignedY };
      })
      .filter((item): item is PositionedBlock => item !== null);

    // Tolérance basée sur la hauteur médiane pour éviter qu'un mot légèrement plus haut se retrouve avant la ligne
    const heights = oriented.map(item => item.rect.height).sort((a, b) => a - b);
    const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    const LINE_TOLERANCE = Math.max(6, medianHeight * 0.5);

    // Trier d'abord par Y aligné (lignes), puis par X aligné (position horizontale)
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
    const sortedWords = lines.flatMap(line => {
      // Trier par X aligné (horizontal)
      const sortedLineWords = line.words.sort((a, b) => a.alignedX - b.alignedX);
      return sortedLineWords;
    });
    const newText = sortedWords.map(item => item.block.text).join(' ');
    setScannedText(newText);
  }, [selectedBlocks]);

  const scanAnimation = useRef(new Animated.Value(0)).current;

  const handleTakePhoto = async () => {
    if (!camera.current || isLoading) return;
    setIsLoading(true);
    try {
      const photoFile = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      setPhoto(photoFile);
      const result = await TextRecognition.recognize(photoFile.path);
      
      console.log('OCR Result:', {
        blocksCount: result.blocks.length,
        photoSize: { width: photoFile.width, height: photoFile.height },
        firstBlock: result.blocks[0]
      });
      
      // Si aucun bloc de texte n'est trouvé, on réinitialise pour une nouvelle tentative
      if (!result || result.blocks.length === 0) {
        setPhoto(null);
        setOcrResult(null);
        setIsLoading(false);
        return;
      }

      setOcrResult(result);
      // On ne pré-sélectionne plus de texte, l'utilisateur choisit
      setScannedText('');
      setSelectedBlocks([]);
    } catch (e) {
      console.error('Failed to take photo or recognize text:', e);
      // Gérer l'erreur, par exemple afficher un message à l'utilisateur
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveQuote = () => {
    if (!scannedText) return;
    // Ouvrir la modal de preview au lieu de sauvegarder directement
    setShowPreviewModal(true);
  };

  const handleConfirmSave = () => {
    // Utiliser le texte édité si disponible, sinon le texte scanné
    const finalText = editedQuote.trim() || scannedText;
    if (!finalText) return;
    // Utilise la saisie utilisateur si présente, sinon la détection automatique
    const bookTitle = editedBook.trim() || Object.keys(bookDescriptions).find(title => 
      localQuotesDB.some(q => q.text === scannedText && q.book === title)
    ) || "Livre inconnu";
    const authorName = editedAuthor.trim() || bookDescriptions[bookTitle]?.author || "Auteur inconnu";
    addQuote({ text: finalText, book: bookTitle, author: authorName });
    setShowPreviewModal(false);
    setScannedText("");
    setPhoto(null);
    setSelectedBlocks([]);
    setOcrResult(null);
    setEditedBook("");
    setEditedAuthor("");
    setEditedQuote("");
    setIsEditingBook(false);
    setIsEditingAuthor(false);
    setIsEditingQuote(false);
    navigation.navigate('MyQuotes');
  };

  const translateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>Quotex a besoin de l'accès à la caméra.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Autoriser</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>Aucun appareil photo disponible.</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      {!photo && (
        <View style={styles.header}>
          <View style={styles.logoContainer}>
              {/* 💡 Calque Extérieur STATIQUE : lueur large et très subtile */}
              {/* Utilisation d'une View standard car il n'y a plus d'animation ici */}

              {/* --- CALQUE D'OMBRE / LUEUR DERRIÈRE LE LOGO --- */}

              {/* --- LE LOGO RESTE AU-DESSUS (zIndex: 10) --- */}
              <Image
                source={quotexLogo}
                style={styles.logoImage}
                resizeMode="contain"
                tintColor="#FFFFFF"
              />
          </View>
        </View>
      )}

      {photo && ocrResult ? (
        <>
          <View 
            style={styles.photoContainer}
            onLayout={(event) => {
              const { width: containerWidth, height: containerHeight } = event.nativeEvent.layout;
              
              console.log('=== LAYOUT DEBUG ===');
              console.log('Container:', { containerWidth, containerHeight });
              console.log('Photo:', { width: photoDimensions.width || photo.width, height: photoDimensions.height || photo.height });
              const orientation = getPhotoOrientation();
              const { photoW, photoH } = getPhotoDimensions();
              const orientedWidth = orientation === 90 || orientation === 270 ? photoH : photoW;
              const orientedHeight = orientation === 90 || orientation === 270 ? photoW : photoH;
              
              // Calculer la taille réelle de l'image affichée avec resizeMode="contain"
              setContainerSize({ width: containerWidth, height: containerHeight });

              const imageAspectRatio = orientedWidth / orientedHeight;
              const containerAspectRatio = containerWidth / containerHeight;
              
              let displayedWidth, displayedHeight, offsetX = 0, offsetY = 0;
              
              if (imageAspectRatio > containerAspectRatio) {
                // L'image est limitée par la largeur
                displayedWidth = containerWidth;
                displayedHeight = containerWidth / imageAspectRatio;
                offsetY = (containerHeight - displayedHeight) / 2;
              } else {
                // L'image est limitée par la hauteur
                displayedHeight = containerHeight;
                displayedWidth = containerHeight * imageAspectRatio;
                offsetX = (containerWidth - displayedWidth) / 2;
              }
              
              console.log('Displayed:', { displayedWidth, displayedHeight, offsetX, offsetY, orientation });
              console.log('======================');
              
              setImageSize({
                width: displayedWidth,
                height: displayedHeight,
                offsetX,
                offsetY,
              });
            }}
          >
            <Animated.View style={[styles.photoContent, { transform: [{ scale: previewScale }] }]}>
              <Image 
                source={{ uri: `file://${photo.path}` }} 
                style={styles.photo}
                resizeMode="contain"
              />
              
              {/* Overlay avec les blocs */}
              <View 
                style={styles.blocksOverlay}
                {...selectionPanResponder.panHandlers}
              >
                {imageSize.width > 0 && wordBlocks.map((block, index) => {
                  const rect = getBlockRectOnScreen(block);
                  if (!rect) return null;

                  const isSelected = selectedBlocks.some(b => 
                    getBlockKey(b) === getBlockKey(block)
                  );

                  return (
                    <View
                      key={index}
                      style={[
                        styles.textBlock,
                        {
                          left: rect.left,
                          top: rect.top,
                          width: rect.width,
                          height: rect.height,
                          borderRadius: 4,
                          // Appliquer la rotation autour du centre du bloc si l'angle est détecté
                          transform: rect.rotation !== undefined && rect.rotation !== 0 
                            ? [{ rotate: `${rect.rotation}deg` }]
                            : undefined,
                        },
                        isSelected && styles.textBlockSelected,
                      ]}
                      pointerEvents="none"
                    >
                      {/* Affichage de l'angle détecté (debug) */}
                      {showDebugAngles && block.rotation !== undefined && block.rotation !== 0 && (
                        <Text style={styles.blockDebugText}>
                          {block.rotation.toFixed(1)}°
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </View>

              {photo && ocrResult && (
                <View style={styles.resultInfoContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blocksInfo}>
                        {wordBlocks.length} bloc(s) détecté(s)
                        {selectedBlocks.length > 0 && ` • ${selectedBlocks.length} sélectionné(s)`}
                      </Text>
                      {showDebugAngles && selectedBlocks.length > 0 && selectedBlocks.some(b => b.rotation !== undefined && b.rotation !== 0) && (
                        <Text style={styles.blocksInfo}>
                          Angles: {selectedBlocks
                            .filter(b => b.rotation !== undefined)
                            .map((b, i) => `${b.rotation?.toFixed(1)}°`)
                            .join(', ')}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        { 
                          padding: 8, 
                          borderRadius: 6, 
                          backgroundColor: showDebugAngles ? 'rgba(32, 184, 205, 0.3)' : 'rgba(107, 114, 128, 0.3)'
                        }
                      ]}
                      onPress={() => setShowDebugAngles(!showDebugAngles)}
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
              )}
        </>
      ) : (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused && !photo}
          photo={true}
        />
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#20B8CD" />
        </View>
      )}

      {!photo && (
        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            
            {isScanning && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY }] },
                ]}
              />
            )}

            <View style={styles.content}>
              <BookOpen size={48} color="#4B5563" />
              <Text style={styles.instructionText}>
                {isLoading ? 'Analyse en cours...' : 'Placez une citation dans le cadre'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {photo ? (
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.cancelButton} 
              onPress={() => {
                setPhoto(null);
                setOcrResult(null);
                setSelectedBlocks([]);
                setScannedText('');
              }}
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
              style={styles.saveButton}
              onPress={handleSaveQuote}
              disabled={!scannedText}
            >
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.iconButton}>
              <ImageIcon size={24} color="#E5E7EB" />
            </TouchableOpacity>

            <View style={styles.scanButtonContainer}>

                
                <TouchableOpacity
                  style={[styles.scanButton, isScanning && styles.scanButtonActive]}
                  onPress={handleTakePhoto}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <View>
                    <View style={styles.scanInnerShadow} />
                    <ScanLine size={28} color={'#20B8CD'} />
                  </View>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.iconButton}>
              <Sparkles size={24} color="#E5E7EB" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!photo && (
        <View style={styles.overlayContainer} pointerEvents="none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>
      )}

      {/* Modal de preview de la citation */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPreviewModal}
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <Pressable 
          style={styles.previewBackdrop} 
          onPress={() => setShowPreviewModal(false)}
        >
          <Pressable style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Aperçu de la citation</Text>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                <X size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.previewScrollView}>
              {/* Carte de citation avec le même style que MyQuotesScreen */}
              <View style={styles.previewQuoteCard}>
                {/* Quote Icon (custom SVG) */}
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={styles.quoteIcon}>
                  <Path
                    d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                    fill="#20B8CD"
                    opacity={0.12}
                  />
                </Svg>

                {/* Quote Text */}
                {isEditingQuote ? (
                  <TextInput
                    style={[styles.previewQuoteText, {backgroundColor: '#222', color: '#FFF', borderRadius: 6, padding: 10}]}
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
                  <TouchableOpacity onPress={() => {
                    setIsEditingQuote(true);
                    setEditedQuote(scannedText);
                  }}>
                    <Text style={styles.previewQuoteText}>{scannedText}</Text>
                  </TouchableOpacity>
                )}

                {/* Book Info - édition interactive */}
                <View style={styles.previewBookInfo}>
                  <View style={styles.bookInfoLeft}>
                    {isEditingBook ? (
                      <TextInput
                        style={[styles.bookTitle, {backgroundColor: '#222', color: '#20B8CD', borderRadius: 6, paddingHorizontal: 6}]}
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
                      <TouchableOpacity onPress={() => {
                        setIsEditingBook(true);
                        setEditedBook(
                          Object.keys(bookDescriptions).find(title => 
                            localQuotesDB.some(q => q.text === scannedText && q.book === title)
                          ) || "Livre inconnu"
                        );
                      }}>
                        <Text style={styles.bookTitle}>
                          {editedBook || Object.keys(bookDescriptions).find(title => 
                            localQuotesDB.some(q => q.text === scannedText && q.book === title)
                          ) || "Livre inconnu"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isEditingAuthor ? (
                      <TextInput
                        style={[styles.authorName, {backgroundColor: '#222', color: '#6B7280', borderRadius: 6, paddingHorizontal: 6}]}
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
                      <TouchableOpacity onPress={() => {
                        setIsEditingAuthor(true);
                        const bookTitle = editedBook || Object.keys(bookDescriptions).find(title => 
                          localQuotesDB.some(q => q.text === scannedText && q.book === title)
                        ) || "Livre inconnu";
                        setEditedAuthor(bookDescriptions[bookTitle]?.author || "Auteur inconnu");
                      }}>
                        <Text style={styles.authorName}>
                          {editedAuthor || (() => {
                            const bookTitle = editedBook || Object.keys(bookDescriptions).find(title => 
                              localQuotesDB.some(q => q.text === scannedText && q.book === title)
                            ) || "Livre inconnu";
                            return bookDescriptions[bookTitle]?.author || "Auteur inconnu";
                          })()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.dateText}>
                    {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>

                {/* Actions */}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'relative',
    top: 0,
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 8, // espace supplémentaire pour laisser respirer l'ombre
    overflow: 'visible', // permettre à l'ombre de dépasser du container
  },
  
  // ------------------------------------------

// Style pour l'image
  logoImage: {
    width: 170*0.8,  
    height: 50.8,  
    marginBottom: 6,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
    overflow: 'visible',
  },


  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 0,
    fontWeight: '500',
  },
  scanArea: {
    flex: 1,
    width: '100%',
    position: 'relative',
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -95, // Compense la hauteur du logo pour centrer le cadre
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 450,
    borderWidth: 1, 
    borderColor: 'rgba(32, 184, 205, 0.2)', 
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Le fond est maintenant la caméra
    overflow: 'visible',
  },
  corner: {
    position: 'absolute',
    width: 32, 
    height: 32,
    borderColor: '#20B8CD',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  cornerTopLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 24,
  },
  cornerTopRight: {
    top: -3,
    right: -3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 24,
  },
  cornerBottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 24,
  },
  cornerBottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 24,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#20B8CD',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  content: {
    alignItems: 'center',
    padding: 24,
    width: '100%',
  },
  instructionText: {
    fontSize: 15,
    color: '#555',
    marginTop: 20,
    textAlign: 'center',
  },
  resultContainer: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.3)',
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
  scannedText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 20, // Pour que les contrôles soient au-dessus de tout
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  iconButton: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonContainer: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'transparent', 
    borderWidth: 3,
    borderColor: '#20B8CD', 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
  },

  // inner filled circle inside the bordered ring


  // pseudo inner shadow to simulate inset depth
  scanInnerShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.28)'
  },

  scanButtonActive: {
    backgroundColor: 'rgba(32, 184, 205, 0.2)',
    borderColor: '#FFFFFF',
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
  permissionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#20B8CD',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
    position: 'relative',
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
  blocksInfo: {
    color: '#20B8CD',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5, // Au-dessus de la caméra
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 430, // Doit correspondre à maxHeight de scanFrame
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    maxWidth: 40, // Doit correspondre au paddingHorizontal de scanArea
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  // Styles pour la modal de preview
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
    fontSize: 32,
    color: 'rgba(32, 184, 205, 0.2)',
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
  authorName: {
    fontSize: 12,
    color: '#6B7280',
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