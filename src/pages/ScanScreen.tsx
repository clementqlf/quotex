import React, { useCallback, useMemo } from 'react';

import {
  ActivityIndicator,
  Alert,
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
import { Camera, PhotoFile, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { recognizeText } from '../features/scanner/model/mlKitParser';
import * as ExpoImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTabIndex, useSwipeEnabled } from '@/src/app/providers/TabContext';

import ScanWorkflow from '@/src/features/scanner/ui/ScanWorkflow';
import ScanFrameOverlay from '@/src/features/scanner/ui/ScanFrameOverlay';
import { useLiveOCR } from '@/src/features/scanner/model/useLiveOCR';
import { extractIsbn } from '@/src/features/scanner/model/useIsbnScanner';
import * as Haptics from 'expo-haptics';
import { searchService } from '@/src/features/search/api/SearchService';
import AnimatedISBNPopup, { IsbnBookData } from '@/src/features/scanner/ui/AnimatedISBNPopup';
import { authService } from '@/src/entities/user/api/AuthService';
import { API_BASE_URL } from '@/src/shared/config/api';

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
  const [ocrNormalizedSize, setOcrNormalizedSize] = React.useState<{ width: number; height: number } | null>(null);
  const [isFromGallery, setIsFromGallery] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPickerActive, setIsPickerActive] = React.useState(false);
  const [isbnBookData, setIsbnBookData] = React.useState<IsbnBookData | null>(null);
  const [showIsbnPopup, setShowIsbnPopup] = React.useState(false);
  const [isSearchingIsbn, setIsSearchingIsbn] = React.useState(false);
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
  const isSearchingIsbnRef = React.useRef(false);

  const DEBUG_SCAN_AREA = false;

  const checkAndHandleIsbn = useCallback(async (text: string): Promise<boolean> => {
    const isbn = extractIsbn(text);
    if (!isbn) return false;

    console.log('[ScanScreen] Valid ISBN detected:', isbn);

    if (isSearchingIsbnRef.current || isSearchingIsbn) {
      console.log('[ScanScreen] Already processing or popup visible, ignoring duplicate trigger.');
      return false;
    }

    setIsSearchingIsbn(true);
    isSearchingIsbnRef.current = true;
    scanLockRef.current = true;
    console.log('[ScanScreen] Starting ISBN search. Set scanLockRef.current = true');

    let popupShown = false;
    try {
      const data = await searchService.search(isbn);
      if (data.inventaireWorks && data.inventaireWorks.length > 0) {
        const item = data.inventaireWorks[0];
        const authorName = item.authors && item.authors.length > 0
          ? item.authors.join(', ')
          : 'Auteur inconnu';

        // Import the book to get the same cover that BookDetail will show
        try {
          const token = await authService.getToken();
          const importRes = await fetch(`${API_BASE_URL}/books/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              title: item.label || item.title,
              description: item.description || '',
              cover: item.image || item.cover || '',
              inventaireUri: item.uri || item.inventaireUri,
              googleId: item.googleId,
              isbn,
              year: item.year,
              pages: item.pages,
              genre: item.genre,
              authors: item.authors || [],
              authorUris: item.authorUris || [],
            }),
          });

          if (importRes.ok) {
            const imported = await importRes.json();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            console.log('[ScanScreen] Book imported successfully from inventaireWorks. Showing popup.');
            setIsbnBookData({
              title: imported.title || item.title || item.label || 'Livre inconnu',
              author: authorName,
              cover: imported.cover || item.image || item.cover || undefined,
              bookId: imported.id?.toString(),
              inventaireUri: imported.inventaireUri || item.inventaireUri || item.uri,
            });
            setShowIsbnPopup(true);
            popupShown = true;
            return true;
          }
        } catch (importErr) {
          console.error('[ScanScreen] Import failed, falling back to search cover:', importErr);
        }

        // Fallback: use search result cover
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[ScanScreen] Fallback: showing popup using search result cover.');
        setIsbnBookData({
          title: item.title || item.label || 'Livre inconnu',
          author: authorName,
          cover: item.image || item.cover || undefined,
          inventaireUri: item.inventaireUri || item.uri,
          bookData: item,
        });
        setShowIsbnPopup(true);
        popupShown = true;
        return true;
      } else if (data.books && data.books.length > 0) {
        const book = data.books[0];
        const authorName = typeof book.author === 'string'
          ? book.author
          : (book.author as any)?.name || 'Auteur inconnu';
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[ScanScreen] Book found in books array. Showing popup.');
        setIsbnBookData({
          title: book.title,
          author: authorName,
          cover: book.cover || undefined,
          bookId: book.id?.toString() ?? undefined,
          inventaireUri: book.inventaireUri,
        });
        setShowIsbnPopup(true);
        popupShown = true;
        return true;
      } else {
        console.log('[ScanScreen] No book found for ISBN:', isbn);
      }
    } catch (error) {
      console.error('Error searching ISBN:', error);
    } finally {
      isSearchingIsbnRef.current = false;
      if (!popupShown) {
        setIsSearchingIsbn(false);
        scanLockRef.current = false;
        console.log('[ScanScreen] ISBN search finished, no popup shown. Released scanLockRef.current = false');
      } else {
        console.log('[ScanScreen] ISBN search finished, popup shown. Keeping scanLockRef.current = true');
      }
    }
    return false;
  }, [showIsbnPopup, isSearchingIsbn]);

  const handleIsbnPopupPress = useCallback(() => {
    if (!isbnBookData) return;
    console.log('[ScanScreen] ISBN popup pressed. Releasing scanLockRef.current = false and navigating.');
    setShowIsbnPopup(false);
    scanLockRef.current = false;
    setIsSearchingIsbn(false);

    const coverParam = isbnBookData.cover || undefined;

    if (isbnBookData.bookData) {
      router.push({
        pathname: '/book-detail',
        params: {
          bookTitle: isbnBookData.title,
          inventaireUri: isbnBookData.inventaireUri,
          bookData: JSON.stringify(isbnBookData.bookData),
          ...(coverParam ? { cover: coverParam } : {}),
        },
      });
    } else if (isbnBookData.bookId) {
      router.push({
        pathname: '/book-detail',
        params: {
          bookId: isbnBookData.bookId,
          inventaireUri: isbnBookData.inventaireUri,
          ...(coverParam ? { cover: coverParam } : {}),
        },
      });
    } else if (isbnBookData.inventaireUri) {
      router.push({
        pathname: '/book-detail',
        params: {
          bookTitle: isbnBookData.title,
          inventaireUri: isbnBookData.inventaireUri,
        },
      });
    }
    setIsbnBookData(null);
  }, [isbnBookData, router]);

  const handleIsbnPopupDismiss = useCallback(() => {
    console.log('[ScanScreen] ISBN popup dismissed. Releasing scanLockRef.current = false.');
    setShowIsbnPopup(false);
    setIsbnBookData(null);
    isSearchingIsbnRef.current = false;
    scanLockRef.current = false;
    setIsSearchingIsbn(false);
  }, []);

  // Hook Live OCR (permet d'animer le contour bleu en temps réel)
  const { isTextDetectedLive, setIsTextDetectedLive, frameProcessor } = useLiveOCR({
    cameraRef,
    isFocused,
    enabled: !photo && !isLoading && !showIsbnPopup && !isSearchingIsbn,
    scanInterval: 500,
  });

  const regionOfInterest = useMemo(() => {
    if (!scanFrameLayout || containerSize.width === 0 || containerSize.height === 0) {
      return undefined;
    }
    return {
      x: scanFrameLayout.x / containerSize.width,
      y: (scanAreaY + scanFrameLayout.y) / containerSize.height,
      width: scanFrameLayout.width / containerSize.width,
      height: scanFrameLayout.height / containerSize.height,
    };
  }, [scanFrameLayout, scanAreaY, containerSize]);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8'],
    onCodeScanned: (codes, scannerFrame) => {
      if (!isFocused || photo || isLoading || showIsbnPopup || isSearchingIsbn) {
        return;
      }
      if (codes.length > 0 && codes[0].value) {
        const code = codes[0];
        
        // Filter codes to only those inside the visual scan frame area (in DP)
        if (code.frame && scanFrameLayout && containerSize.width > 0 && scannerFrame.width > 0 && scannerFrame.height > 0) {
          const isFrameLandscape = scannerFrame.width > scannerFrame.height;
          
          let x_screen = 0;
          let y_screen = 0;
          
          if (isFrameLandscape) {
            // Camera sensor is landscape, screen is portrait (90 deg rotation)
            const scaleX = containerSize.width / scannerFrame.height;
            const scaleY = containerSize.height / scannerFrame.width;
            const scale = Math.max(scaleX, scaleY);
            
            const scaledWidth = scannerFrame.height * scale;
            const scaledHeight = scannerFrame.width * scale;
            
            const offsetX = (scaledWidth - containerSize.width) / 2;
            const offsetY = (scaledHeight - containerSize.height) / 2;
            
            const codeCenterX = code.frame.x + code.frame.width / 2;
            const codeCenterY = code.frame.y + code.frame.height / 2;
            
            x_screen = codeCenterY * scale - offsetX;
            y_screen = codeCenterX * scale - offsetY;
          } else {
            // Camera frame is already portrait (no rotation needed)
            const scaleX = containerSize.width / scannerFrame.width;
            const scaleY = containerSize.height / scannerFrame.height;
            const scale = Math.max(scaleX, scaleY);
            
            const scaledWidth = scannerFrame.width * scale;
            const scaledHeight = scannerFrame.height * scale;
            
            const offsetX = (scaledWidth - containerSize.width) / 2;
            const offsetY = (scaledHeight - containerSize.height) / 2;
            
            const codeCenterX = code.frame.x + code.frame.width / 2;
            const codeCenterY = code.frame.y + code.frame.height / 2;
            
            x_screen = codeCenterX * scale - offsetX;
            y_screen = codeCenterY * scale - offsetY;
          }
          
          const frameLeft = scanFrameLayout.x;
          const frameRight = scanFrameLayout.x + scanFrameLayout.width;
          const frameTop = scanAreaY + scanFrameLayout.y;
          const frameBottom = scanAreaY + scanFrameLayout.y + scanFrameLayout.height;
          
          const isInside = x_screen >= frameLeft && x_screen <= frameRight &&
                           y_screen >= frameTop && y_screen <= frameBottom;
          
          if (!isInside) {
            console.log('[ScanScreen] Ignored barcode outside visual frame:', code.value, { 
              x_screen, 
              y_screen, 
              frameLeft, 
              frameRight, 
              frameTop, 
              frameBottom 
            });
            return;
          }
        }
        
        console.log('[ScanScreen] Barcode scanned:', code.value);
        checkAndHandleIsbn(code.value!);
      }
    },
    regionOfInterest: regionOfInterest,
  });

  const fadeAnim = useSharedValue(1);

  // Animation des coins vers cadre complet (live)
  React.useEffect(() => {
    fadeAnim.value = withTiming(isTextDetectedLive ? 0 : 1, { duration: 400 });
  }, [isTextDetectedLive]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  // Cleanup au unmount du composant
  React.useEffect(() => {
    return () => {
      console.log('[ScanScreen] Unmounting component, releasing scanLockRef.current to false');
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
      console.log('[ScanScreen] Lost focus, resetting state and scanLockRef.current to false');
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
    if (!cameraRef.current || isLoading || !isFocused) {
      console.log('[ScanScreen] handleTakePhoto: cameraRef is null, loading, or screen not focused. Aborting.', {
        hasCameraRef: !!cameraRef.current,
        isLoading,
        isFocused,
      });
      return;
    }

    setIsLoading(true);
    scanLockRef.current = true; // Lock global (capture + live)
    console.log('[ScanScreen] handleTakePhoto: scanLockRef.current set to true');

    try {
      // Final check after potential lock wait
      if (!cameraRef.current || !isFocused) {
        console.log('[ScanScreen] handleTakePhoto: Camera unmounted or screen lost focus during setup. Aborting.');
        setIsLoading(false);
        scanLockRef.current = false;
        return;
      }

      console.log('[ScanScreen] handleTakePhoto: taking photo...');
      const photoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      console.log('[ScanScreen] handleTakePhoto: photo taken successfully. Path:', photoFile.path);

      console.log('[ScanScreen] handleTakePhoto: recognizing text...');
      const ocrResult = await recognizeText(photoFile.path);
      const elements = ocrResult.elements;

      if (!elements || elements.length === 0) {
        console.log('[ScanScreen] handleTakePhoto: no text recognized in the photo');
        setPhoto(null);
        setOcrElements(null);
        setOcrBlocks(null);
        Alert.alert(
          "Aucun texte détecté",
          "Nous n'avons détecté aucun texte dans l'image. Assurez-vous d'avoir bien cadré le texte et qu'il y a assez de lumière."
        );
        return;
      }

      console.log('[ScanScreen] handleTakePhoto: regular quote text detected. Transitioning to scan workflow...');
      
      // Use the portrait-normalized image file path
      const normalizedPath = ocrResult.normalizedUri.replace('file://', '');
      const pickedPhoto: PhotoFile = {
        ...photoFile,
        path: normalizedPath,
        width: ocrResult.normalizedSize?.width || photoFile.width,
        height: ocrResult.normalizedSize?.height || photoFile.height,
        metadata: { Orientation: 1 } as any, // 1 = upright portrait
      };

      setIsFromGallery(false);
      setPhoto(pickedPhoto);
      setOcrElements(elements);
      setOcrBlocks(ocrResult.blocks);
      setOcrNormalizedSize(ocrResult.normalizedSize);
    } catch (error) {
      console.error('Failed to take photo or recognize text:', error);
      setPhoto(null);
      setOcrElements(null);
      Alert.alert(
        "Erreur de scan",
        `Une erreur est survenue lors de la prise de photo ou de la détection de texte : ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoading(false);
      // Small delay before releasing lock to let native camera settle
      setTimeout(() => {
        scanLockRef.current = false;
        console.log('[ScanScreen] handleTakePhoto finished: scanLockRef.current released to false');
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
    setOcrNormalizedSize(null);
    setIsFromGallery(false);
    setIsTextDetectedLive(false);
  };

  const handlePickImage = async () => {
    try {
      if (isLoading || isPickerActive) {
        console.log('[ScanScreen] handlePickImage: ignored, loading or picker active');
        return;
      }
      console.log('[ScanScreen] handlePickImage: starting gallery image selection');

      // 1. Vérifier la permission sans lancer la boîte de dialogue directement
      let permission = await ExpoImagePicker.getMediaLibraryPermissionsAsync();
      
      if (permission.status !== 'granted') {
        permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          console.log('[ScanScreen] handlePickImage: permission denied');
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
            console.log('[ScanScreen] handlePickImage: gallery selection canceled');
            setIsPickerActive(false);
            return;
          }

          setIsLoading(true);

          const asset = result.assets[0];
          const cleanPath = asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`;
          console.log('[ScanScreen] handlePickImage: asset selected:', cleanPath);

          const ocrResult = await recognizeText(cleanPath);
          const elements = ocrResult.elements;
          if (elements && elements.length > 0) {
            const fullText = elements.map(e => e.text).join(' ');
            console.log('[ScanScreen] handlePickImage: recognized text:', fullText);
            const isIsbn = await checkAndHandleIsbn(fullText);
            if (isIsbn) {
              console.log('[ScanScreen] handlePickImage: ISBN popup active, exiting pickImage');
              setIsPickerActive(false);
              return;
            }
          } else {
            console.log('[ScanScreen] handlePickImage: no text elements recognized in selection');
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
          setOcrNormalizedSize(ocrResult.normalizedSize);
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
          normalizedSize={ocrNormalizedSize}
        />
      ) : isFocused && !photo && !isPickerActive ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo
          pixelFormat="yuv"
          outputOrientation="preview"
          ref={cameraRef}
          frameProcessor={frameProcessor}
          codeScanner={(!showIsbnPopup && !isSearchingIsbn && !isLoading) ? codeScanner : undefined}
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
              <ScanFrameOverlay
                isTextDetectedLive={isTextDetectedLive}
                scanFrameLayout={scanFrameLayout}
                colors={colors}
              />

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

          {/* Debugging Barcode Scan Area Outline */}
          {DEBUG_SCAN_AREA && scanFrameLayout && (
            <View
              style={{
                position: 'absolute',
                left: scanFrameLayout.x,
                top: scanAreaY + scanFrameLayout.y,
                width: scanFrameLayout.width,
                height: scanFrameLayout.height,
                borderWidth: 2,
                borderColor: 'red',
                borderStyle: 'dashed',
                borderRadius: 24,
                zIndex: 99,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* ISBN Popup */}
          {showIsbnPopup && isbnBookData && (
            <AnimatedISBNPopup
              bookData={isbnBookData}
              onPress={handleIsbnPopupPress}
              onDismiss={handleIsbnPopupDismiss}
            />
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
