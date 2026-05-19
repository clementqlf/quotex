import React, { useCallback, useMemo } from 'react';

import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BookOpen, Image as ImageIcon, ScanLine, Sparkles, Settings, User } from 'lucide-react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { Camera, PhotoFile, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { recognizeText } from '@/src/features/scanner/model/mlKitParser';
import * as ExpoImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTabIndex, useSwipeEnabled } from '@/src/app/providers/TabContext';

import ScanWorkflow from '@/src/features/scanner/ui/ScanWorkflow';
import { useLiveOCR } from '@/src/features/scanner/model/useLiveOCR';
import { extractIsbn } from '@/src/features/scanner/model/useIsbnScanner';
import * as Haptics from 'expo-haptics';
import { searchService } from '@/src/features/search/api/SearchService';

import QuotexLogo from '@/src/shared/ui/QuotexLogo';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import { ThemeColors } from '@/src/shared/theme';

export default function ScanScreen() {
  const { colors } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tabIndex, setTabIndex } = useTabIndex();
  const isFocused = tabIndex === 1;
  const { setSwipeEnabled } = useSwipeEnabled();
  const [photo, setPhoto] = React.useState<PhotoFile | null>(null);
  const [ocrElements, setOcrElements] = React.useState<TextElement[] | null>(null);
  const [ocrBlocks, setOcrBlocks] = React.useState<TextBlock[] | null>(null);
  const [isFromGallery, setIsFromGallery] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPickerActive, setIsPickerActive] = React.useState(false);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [scanFrameLayout, setScanFrameLayout] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [scanAreaY, setScanAreaY] = React.useState(0);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = React.useRef<Camera | null>(null);

  // Ref partagé pour éviter les captures concurrentes (Live OCR vs Capture Manuelle)
  const scanLockRef = React.useRef(false);

  const checkAndHandleIsbn = useCallback(async (text: string): Promise<boolean> => {
    const isbn = extractIsbn(text);
    if (!isbn) return false;

    console.log('[ScanScreen] Valid ISBN detected:', isbn);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(true);
    try {
      const data = await searchService.search(isbn);
      if (data.inventaireWorks && data.inventaireWorks.length > 0) {
        const item = data.inventaireWorks[0];
        router.push({
          pathname: '/book-detail',
          params: {
            bookTitle: item.title,
            inventaireUri: item.inventaireUri || item.uri,
            bookData: JSON.stringify(item)
          }
        });
        return true;
      } else if (data.books && data.books.length > 0) {
        const book = data.books[0];
        router.push({
          pathname: '/book-detail',
          params: {
            bookId: book.id,
            inventaireUri: book.inventaireUri,
          }
        });
        return true;
      } else {
        alert("Aucun livre trouvé pour cet ISBN.");
      }
    } catch (error) {
      console.error('Error searching ISBN:', error);
      alert("Erreur lors de la recherche du livre.");
    } finally {
      setIsLoading(false);
    }
    return false;
  }, [router]);

  // Callback mémoïsé pour éviter de redémarrer l'effet useLiveOCR à chaque render
  const handleIsbnDetected = useCallback((isbn: string) => {
    checkAndHandleIsbn(isbn);
  }, [checkAndHandleIsbn]);

  // Hook Live OCR (ne sert désormais qu'à animer le contour bleu lors de la détection de texte)
  const { isTextDetectedLive, setIsTextDetectedLive } = useLiveOCR({
    cameraRef,
    isFocused,
    enabled: !photo && !isLoading,
    scanLockRef,
  });

  const frameAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(1);

  // Animation des coins vers cadre complet (live)
  React.useEffect(() => {
    frameAnim.value = withTiming(isTextDetectedLive ? 1 : 0, { duration: 400 });
    fadeAnim.value = withTiming(isTextDetectedLive ? 0 : 1, { duration: 400 });
  }, [isTextDetectedLive]);

  const cornerStyle = useAnimatedStyle(() => {
    if (!scanFrameLayout) return {};
    const expandedWidth = scanFrameLayout.width - 32;
    const expandedHeight = scanFrameLayout.height - 32;
    
    // Manual interpolation for Reanimated
    const width = 32 + (expandedWidth - 32) * frameAnim.value;
    const height = 32 + (expandedHeight - 32) * frameAnim.value;

    return {
      width,
      height,
    };
  });

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  // Cleanup au unmount du composant
  React.useEffect(() => {
    return () => {
      scanLockRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  React.useEffect(() => {
    if (isFocused) {
      setTabIndex(1);
    } else {
      scanLockRef.current = false;

      // Réinitialiser les états
      setPhoto(null);
      setOcrElements(null);
      setOcrBlocks(null);
      setIsTextDetectedLive(false); // Le hook le fera si unmount, mais on force ici si besoin
    }
  }, [isFocused, setTabIndex]);

  React.useEffect(() => {
    setSwipeEnabled(!(photo && ocrElements));
  }, [photo, ocrElements, setSwipeEnabled]);

  // useEffect(() => {
  //   if (photo) {
  //     scanAnimation.stopAnimation();
  //     scanAnimation.setValue(0);
  //     return;
  //   }
  //   const animation = Animated.loop(
  //     Animated.sequence([
  //       Animated.timing(scanAnimation, {
  //         toValue: 1,
  //         duration: 2000,
  //         useNativeDriver: true,
  //       }),
  //       Animated.timing(scanAnimation, {
  //         toValue: 0,
  //         duration: 2000,
  //         useNativeDriver: true,
  //       }),
  //     ]),
  //   );
  //   animation.start();
  //   return () => animation.stop();
  // }, [photo, scanAnimation]);

  // const translateY = scanAnimation.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: [-140, 140],
  // });

  // processImage a été déplacé dans mlKitParser.ts sous le nom recognizeAndExtractElements

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isLoading || !isFocused) return;

    // Retry mechanism for the lock: If busy (Live OCR is capturing), wait a bit
    if (scanLockRef.current) {
      let retries = 5; // ~250ms max
      while (scanLockRef.current && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries--;
      }
      // If still busy after retries, abort
      if (scanLockRef.current) return;
    }

    setIsLoading(true);
    scanLockRef.current = true; // Lock global (capture + live)

    try {
      // Final check after potential lock wait
      if (!cameraRef.current || !isFocused) {
        setIsLoading(false);
        scanLockRef.current = false;
        return;
      }

      const photoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const ocrResult = await recognizeText(photoFile.path);
      const elements = ocrResult.elements;

      if (!elements || elements.length === 0) {
        setPhoto(null);
        setOcrElements(null);
        setOcrBlocks(null);
        return;
      }

      const fullText = elements.map(e => e.text).join(' ');
      const isIsbn = await checkAndHandleIsbn(fullText);
      if (isIsbn) {
        return;
      }

      setIsFromGallery(false);
      setPhoto(photoFile);
      setOcrElements(elements);
      setOcrBlocks(ocrResult.blocks);
    } catch (error) {
      console.error('Failed to take photo or recognize text:', error);
      setPhoto(null);
      setOcrElements(null);
    } finally {
      setIsLoading(false);
      // Small delay before releasing lock to let native camera settle
      setTimeout(() => {
        scanLockRef.current = false;
      }, 100);
    }
  };

  const handleResetCapture = async () => {
    if (photo?.path) {
      try {
        // Supprimer le fichier temporaire (capture camera ou copie galerie)
        const path = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch (e) {
        console.log("Erreur suppression photo scan:", e);
      }
    }
    setPhoto(null);
    setOcrElements(null);
    setOcrBlocks(null);
    setIsFromGallery(false);
    setIsTextDetectedLive(false);
  };

  const handlePickImage = async () => {
    try {
      if (isLoading || isPickerActive) return;

      // 1. Vérifier la permission sans lancer la boîte de dialogue directement
      let permission = await ExpoImagePicker.getMediaLibraryPermissionsAsync();
      
      if (permission.status !== 'granted') {
        permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          return;
        }
        // Attendre que l'animation de fermeture du dialogue iOS se termine
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      // Désactiver le flux de la caméra
      setIsPickerActive(true);

      // 2. Lancer la galerie après un court délai pour stabiliser l'arborescence
      setTimeout(async () => {
        try {
          const result = await ExpoImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
          });

          if (result.canceled || !result.assets || result.assets.length === 0) {
            setIsPickerActive(false);
            return;
          }

          setIsLoading(true);

          const asset = result.assets[0];
          const cleanPath = asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`;

          const ocrResult = await recognizeText(cleanPath);
          const elements = ocrResult.elements;
          if (elements && elements.length > 0) {
            const fullText = elements.map(e => e.text).join(' ');
            const isIsbn = await checkAndHandleIsbn(fullText);
            if (isIsbn) {
              setIsPickerActive(false);
              return;
            }
          }

          const pickedPhoto: PhotoFile = {
            path: cleanPath,
            width: asset.width,
            height: asset.height,
            isRawPhoto: false,
            metadata: { Orientation: 1 } as any,
          } as PhotoFile;

          setIsFromGallery(true);
          setPhoto(pickedPhoto);
          setOcrElements(elements || []);
          setOcrBlocks(ocrResult.blocks || []);
        } catch (innerError) {
          console.error('Picker launch error:', innerError);
        } finally {
          setIsLoading(false);
          setIsPickerActive(false);
        }
      }, 300);

    } catch (error: any) {
      console.error('Picker error:', error);
      setIsLoading(false);
      setIsPickerActive(false);
    }
  };

  if (!hasPermission) {
    return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <Text style={styles.permissionText}>{"Quotex a besoin de l'accès à la caméra."}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Autoriser</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <Text style={styles.permissionText}>Aucun appareil photo disponible.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      {!photo && (
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButtonLeft} 
            onPress={() => router.push('/settings')}
          >
            <Settings size={24} color="#E5E7EB" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <QuotexLogo width={320} height={120} color="#FFFFFF" style={styles.logoImage} />
          </View>

          <TouchableOpacity 
            style={styles.headerButtonRight} 
            onPress={() => {
              if (currentUser?.username) {
                router.push({ 
                  pathname: '/user-profile', 
                  params: { username: currentUser.username } 
                });
              } else {
                router.push('/user-profile');
              }
            }}
          >
            <User size={24} color="#E5E7EB" />
          </TouchableOpacity>
        </View>
      )}

      {photo && ocrElements ? (
        <ScanWorkflow
          photo={photo}
          ocrElements={ocrElements}
          ocrBlocks={ocrBlocks || []}
          onReset={handleResetCapture}
          isGallery={isFromGallery}
        />
      ) : isFocused && !photo && !isPickerActive ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo
          outputOrientation="preview"
          ref={cameraRef}
          onError={(error) => {
            console.log('Camera error:', error);
          }}
        />
      ) : null}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {!photo && (
        <>
          <View
            style={styles.scanArea}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              setScanAreaY(y);
            }}
          >
            <View
              style={styles.scanFrame}
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setScanFrameLayout({ x, y, width, height });
              }}
            >

              {/* Animation des coins vers cadre complet */}
              {/* Correction : outputRange numériques, largeur réelle du cadre, animation live OCR */}
              {scanFrameLayout && (
                <>
                  {/* Coin supérieur gauche (s'étend vers le bas et la droite) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        left: -3,
                        top: -3,
                        borderTopWidth: 3,
                        borderLeftWidth: 3,
                        borderTopLeftRadius: 24,
                        borderRightWidth: 0,
                        borderBottomWidth: 0,
                        zIndex: 10,
                      },
                      cornerStyle
                    ]}
                  />
                  {/* Coin supérieur droit (s'étend vers le bas et la gauche) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        right: -3,
                        top: -3,
                        borderTopWidth: 3,
                        borderRightWidth: 3,
                        borderTopRightRadius: 24,
                        borderLeftWidth: 0,
                        borderBottomWidth: 0,
                        zIndex: 10,
                      },
                      cornerStyle
                    ]}
                  />
                  {/* Coin inférieur gauche (s'étend vers le haut et la droite) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        left: -3,
                        bottom: -3,
                        borderBottomWidth: 3,
                        borderLeftWidth: 3,
                        borderBottomLeftRadius: 24,
                        borderTopWidth: 0,
                        borderRightWidth: 0,
                        zIndex: 10,
                      },
                      cornerStyle
                    ]}
                  />
                  {/* Coin inférieur droit (s'étend vers le haut et la gauche) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        right: -3,
                        bottom: -3,
                        borderBottomWidth: 3,
                        borderRightWidth: 3,
                        borderBottomRightRadius: 24,
                        borderTopWidth: 0,
                        borderLeftWidth: 0,
                        zIndex: 10,
                      },
                      cornerStyle
                    ]}
                  />
                </>
              )}

              {/* Ligne de scan animée supprimée */}

              <View style={styles.content}>
                <Animated.View
                  style={[styles.fadeContainer, fadeStyle]}
                  pointerEvents="none"
                >
                  <View style={styles.iconShadowWrapper}>
                    <BookOpen size={48} color="#FFFFFF" />
                  </View>
                  <Text style={styles.instructionTextShadow}>
                    {isLoading ? 'Analyse en cours...' : 'Placez une citation dans le cadre'}
                  </Text>
                </Animated.View>
              </View>
            </View>
          </View>

          {scanFrameLayout && containerSize.width > 0 && (
            <Svg
              width={containerSize.width}
              height={containerSize.height}
              style={styles.darkOverlay}
              viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
            >
              <Defs>
                <Mask id="scanMask">
                  <Rect width={containerSize.width} height={containerSize.height} fill="white" />
                  <Rect
                    x={scanFrameLayout.x}
                    y={scanAreaY + scanFrameLayout.y}
                    width={scanFrameLayout.width}
                    height={scanFrameLayout.height}
                    rx="24"
                    ry="24"
                    fill="black"
                  />
                </Mask>
              </Defs>
              <Rect
                width={containerSize.width}
                height={containerSize.height}
                fill={colors.backdrop}
                mask="url(#scanMask)"
              />
            </Svg>
          )}

          <View style={styles.controls}>
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.iconButton} onPress={handlePickImage}>
                <ImageIcon size={24} color="#E5E7EB" />
              </TouchableOpacity>

              <View style={styles.scanButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.scanButton,
                    isLoading && styles.scanButtonActive,
                    !isTextDetectedLive && { borderColor: 'rgba(229, 231, 235, 0.4)', shadowColor: '#E5E7EB', shadowOpacity: 0.3 }
                  ]}
                  onPress={handleTakePhoto}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <View>
                    <ScanLine size={28} color={isTextDetectedLive ? colors.primary : "#E5E7EB"} />
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.iconButton}>
                <Sparkles size={24} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </SafeAreaView >
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Should adapt to light/dark for permission screen
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  header: {
    position: 'relative',
    top: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
    height: 120,
    overflow: 'visible',
  },
  headerButtonLeft: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonRight: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 10,
    overflow: 'visible',
  },
  logoImage: {
    marginBottom: 6,
    zIndex: 10,
    overflow: 'visible',
  },
  scanArea: {
    flex: 1,
    width: '100%',
    position: 'relative',
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -160,
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 450,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)', // Keep hardcoded or use primary with opacity? Keeping hardcoded for camera overlay consistency
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
    zIndex: 3,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    zIndex: 10,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  content: {
    alignItems: 'center',
    padding: 24,
    width: '100%',
    overflow: 'visible',
  },
  fadeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  instructionText: {
    fontSize: 15,
    color: '#555',
    marginTop: 20,
    textAlign: 'center',
  },
  iconShadowWrapper: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    // Pour compatibilité, mais l'ombre est sur le wrapper
  },
  instructionTextShadow: {
    fontSize: 15,
    color: '#FFFFFF', // Maintain white for overlay visibility
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    overflow: 'visible',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: 'none',
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    paddingHorizontal: 24,
    zIndex: 20,
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
    backgroundColor: '#1a1a1a', // Keep dark for overlay buttons
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
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 10,
  },
  scanInnerShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  scanButtonActive: {
    backgroundColor: 'rgba(32, 184, 205, 0.2)',
    borderColor: '#FFFFFF',
  },
  scanButtonDisabled: {
    opacity: 0.4,
    borderColor: '#444',
    shadowOpacity: 0,
    elevation: 0,
  },
  permissionText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#0F0F0F',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
});
