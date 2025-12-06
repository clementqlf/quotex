import React, { useState, useRef, useEffect, useMemo } from 'react'; 
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
  SafeAreaView,
  View,
  ActivityIndicator,
  Pressable,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { BookOpen, ChevronLeft, ChevronRight, ScanLine, ImageIcon, Sparkles, Book } from 'lucide-react-native';
import { Camera, useCameraDevice, useCameraPermission, PhotoFile } from 'react-native-vision-camera';
import TextRecognition, {
  TextRecognitionResult,
} from '@react-native-ml-kit/text-recognition';

// Type pour les blocs de texte ML Kit
type MLKitText = {
  text: string;
  frame?: { left: number; top: number; width: number; height: number };
};
import { useTabIndex } from '../TabNavigator';
import { addQuote, aiInterpretations, bookDescriptions, localQuotesDB } from '../data/staticData';

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
  const [imageSize, setImageSize] = useState<{ 
    width: number; 
    height: number; 
    offsetX: number; 
    offsetY: number;
  }>({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  const wordBlocks = useMemo<MLKitText[]>(() => {
    if (!ocrResult) return [];
    const words: MLKitText[] = [];
    ocrResult.blocks.forEach(block => {
      block.lines?.forEach(line => {
        line.elements?.forEach(element => {
          if (element.frame) {
            words.push({ text: element.text, frame: element.frame });
          }
        });
      });
    });
    return words;
  }, [ocrResult]);

  const { tabIndex, setTabIndex } = useTabIndex();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const selectionPanResponder = useRef(PanResponder.create({ onStartShouldSetPanResponder: () => true })).current;

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

  // Orientation helper: normalize EXIF orientation to degrees
  const getPhotoOrientation = () => {
    const raw =
      (photo as any)?.metadata?.Orientation ||
      (photo as any)?.metadata?.orientation ||
      (photo as any)?.metadata?.Exif?.Orientation ||
      1;

    switch (raw) {
      case 3:
        return 180;
      case 6:
        return 90; // rotate right
      case 8:
        return 270; // rotate left
      default:
        return 0;
    }
  };

  const rotateFrameToUpright = (frame: NonNullable<MLKitText['frame']>, orientation: number, baseW: number, baseH: number) => {
    if (orientation === 0) return frame;
    const { left, top, width, height } = frame;

    if (orientation === 90) {
      return {
        left: baseH - (top + height),
        top: left,
        width: height,
        height: width,
      };
    }

    if (orientation === 180) {
      return {
        left: baseW - (left + width),
        top: baseH - (top + height),
        width,
        height,
      };
    }

    // 270
    return {
      left: top,
      top: baseW - (left + width),
      width: height,
      height: width,
    };
  };

  useEffect(() => {
    if (isFocused) setTabIndex(1);
  }, [isFocused]);
  
  useEffect(() => {
    // Mettre à jour le texte scanné lorsque la sélection de blocs change
    const newText = selectedBlocks
      .sort((a, b) => (a.frame?.top || 0) - (b.frame?.top || 0))
      .map(block => block.text)
      .join(' ');
    setScannedText(newText);
  }, [selectedBlocks]);

  const handleBlockPress = (block: MLKitText) => {
    if (!block.frame) return;
    
    const isSelected = selectedBlocks.some(b => 
      b.text === block.text && b.frame?.left === block.frame?.left
    );
    
    if (isSelected) {
      setSelectedBlocks(prev => prev.filter(b => 
        !(b.text === block.text && b.frame?.left === block.frame?.left)
      ));
    } else {
      setSelectedBlocks(prev => [...prev, block]);
    }
  };

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

    // Trouver le livre et l'auteur associés au texte scanné
    // NOTE: C'est une logique simplifiée pour la démo.
    // Dans une vraie app, l'IA ou l'utilisateur confirmerait ces informations.
    const bookTitle = Object.keys(bookDescriptions).find(title => 
      localQuotesDB.some(q => q.text === scannedText && q.book === title)
    ) || "Livre inconnu";

    const authorName = bookDescriptions[bookTitle]?.author || "Auteur inconnu";

    // Appelle la fonction qui simule l'ajout aux deux bases de données
    addQuote({ text: scannedText, book: bookTitle, author: authorName });
    setScannedText(''); // Réinitialise l'écran de scan
    setPhoto(null);
    setSelectedBlocks([]);
    setOcrResult(null);
    navigation.navigate('MyQuotes'); // Navigue vers l'écran des citations locales
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
              
              // Calculer la taille réelle de l'image affichée avec resizeMode="contain"
              const rawWidth = photo.width || photoDimensions.width || 1;
              const rawHeight = photo.height || photoDimensions.height || 1;
              const orientation = getPhotoOrientation();
              const orientedWidth = orientation === 90 || orientation === 270 ? rawHeight : rawWidth;
              const orientedHeight = orientation === 90 || orientation === 270 ? rawWidth : rawHeight;
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
              
              console.log('Displayed:', { displayedWidth, displayedHeight, offsetX, offsetY });
              console.log('======================');
              
              setImageSize({
                width: displayedWidth,
                height: displayedHeight,
                offsetX,
                offsetY,
              });
            }}
          >
            <Image 
              source={{ uri: `file://${photo.path}` }} 
              style={styles.photo} 
              resizeMode="contain"
            />
            
            {/* Overlay avec les blocs */}
            <View style={styles.blocksOverlay}>
              {imageSize.width > 0 && wordBlocks.map((block, index) => {
                const { frame } = block;
                if (!frame) return null;

                const orientation = getPhotoOrientation();

                const isNormalized =
                  frame.left <= 1 && frame.top <= 1 && frame.width <= 1 && frame.height <= 1;

                const rawBaseW = photo.width || photoDimensions.width || 1;
                const rawBaseH = photo.height || photoDimensions.height || 1;

                const normBaseW = isNormalized ? 1 : rawBaseW;
                const normBaseH = isNormalized ? 1 : rawBaseH;

                const rotatedFrame = rotateFrameToUpright(frame, orientation, normBaseW, normBaseH);

                const orientedBaseW = orientation === 90 || orientation === 270 ? normBaseH : normBaseW;
                const orientedBaseH = orientation === 90 || orientation === 270 ? normBaseW : normBaseH;

                const scaleX = imageSize.width / orientedBaseW;
                const scaleY = imageSize.height / orientedBaseH;

                const blockLeft = (rotatedFrame.left * scaleX) + imageSize.offsetX;
                const blockTop = (rotatedFrame.top * scaleY) + imageSize.offsetY;
                const blockWidth = rotatedFrame.width * scaleX;
                const blockHeight = rotatedFrame.height * scaleY;

                if (index === 0) {
                  console.log('=== FIRST BLOCK DEBUG ===');
                  console.log('Frame:', frame);
                  console.log('Rotated frame:', rotatedFrame);
                  console.log('Orientation:', orientation);
                  console.log('ImageSize:', imageSize);
                  console.log('isNormalized:', isNormalized);
                  console.log('Raw base photo:', { width: rawBaseW, height: rawBaseH });
                  console.log('Oriented base:', { width: orientedBaseW, height: orientedBaseH });
                  console.log('Calculated:', { blockLeft, blockTop, blockWidth, blockHeight });
                  console.log('======================');
                }

                const isSelected = selectedBlocks.some(b => 
                  b.text === block.text && b.frame?.left === frame.left
                );

                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.textBlock,
                      {
                        left: blockLeft,
                        top: blockTop,
                        width: blockWidth,
                        height: blockHeight,
                      },
                      isSelected && styles.textBlockSelected,
                    ]}
                    onPress={() => handleBlockPress(block as MLKitText)}
                  />
                );
              })}
            </View>
          </View>

              {photo && ocrResult && (
                <View style={styles.resultInfoContainer}>
                  <Text style={styles.blocksInfo}>
                    {wordBlocks.length} bloc(s) détecté(s)
                    {selectedBlocks.length > 0 && ` • ${selectedBlocks.length} sélectionné(s)`}
                  </Text>
                  <Text style={styles.instructionText}>
                    {selectedBlocks.length > 0
                      ? 'Sélection prête, enregistrez la citation'
                      : 'Appuyez sur les blocs pour sélectionner la citation'}
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
    marginRight: 12,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 12,
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
  photo: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  blocksOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  textBlock: {
    position: 'absolute',
    backgroundColor: 'rgba(32, 184, 205, 0.6)',
    borderWidth: 3,
    borderColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: 'auto',
  },
  textBlockSelected: {
    backgroundColor: 'rgba(0, 255, 0, 0.4)',
    borderColor: '#00FF00',
    borderWidth: 4,
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
});