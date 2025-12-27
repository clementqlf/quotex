import React from 'react';

import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { BookOpen, Image as ImageIcon, ScanLine, Sparkles } from 'lucide-react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { Camera, PhotoFile, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import ImagePicker from 'react-native-image-crop-picker';
import { useTabIndex, useSwipeEnabled } from '../TabNavigator';

import ScanWorkflow from './ScanWorkflow';
import { useLiveOCR } from '../src/hooks/useLiveOCR';

import QuotexLogo from '../components/QuotexLogo';

export default function ScanScreen() {
  const [photo, setPhoto] = React.useState<PhotoFile | null>(null);
  const [ocrResult, setOcrResult] = React.useState<TextRecognitionResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [scanFrameLayout, setScanFrameLayout] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const { setTabIndex } = useTabIndex();
  const { setSwipeEnabled } = useSwipeEnabled();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = React.useRef<Camera | null>(null);
  const isFocused = useIsFocused();

  // Ref partagé pour éviter les captures concurrentes (Live OCR vs Capture Manuelle)
  const scanLockRef = React.useRef(false);

  // Hook Live OCR
  const { isTextDetectedLive, setIsTextDetectedLive } = useLiveOCR({
    cameraRef,
    isFocused,
    enabled: !photo && !isLoading,
    scanLockRef,
  });

  const frameAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(1)).current;




  // Animation des coins vers cadre complet (live)
  React.useEffect(() => {
    if (isTextDetectedLive) {
      Animated.parallel([
        Animated.timing(frameAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(frameAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isTextDetectedLive, frameAnim, fadeAnim]);

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
      setOcrResult(null);
      setIsTextDetectedLive(false); // Le hook le fera si unmount, mais on force ici si besoin
    }
  }, [isFocused, setTabIndex]);

  React.useEffect(() => {
    setSwipeEnabled(!(photo && ocrResult));
  }, [photo, ocrResult, setSwipeEnabled]);

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

  const processImage = async (path: string): Promise<TextRecognitionResult | null> => {
    const cleanPath = path.startsWith('file://') ? path : `file://${path}`;
    console.log('ScanScreen: Processing image path:', cleanPath);

    try {
      const result = await TextRecognition.recognize(cleanPath);
      return result;
    } catch (error) {
      console.error('ScanScreen: OCR Failed', error);
      return null;
    }
  };

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
      const photoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const result = await processImage(photoFile.path);

      if (!result || result.blocks.length === 0) {
        setPhoto(null);
        setOcrResult(null);
        return;
      }

      setPhoto(photoFile);
      setOcrResult(result);
    } catch (error) {
      console.error('Failed to take photo or recognize text:', error);
      setPhoto(null);
      setOcrResult(null);
    } finally {
      setIsLoading(false);
      scanLockRef.current = false;
    }
  };

  const handleResetCapture = () => {
    setPhoto(null);
    setOcrResult(null);
    setIsTextDetectedLive(false);
  };

  const handlePickImage = async () => {
    try {
      if (isLoading) return;

      // Note: On ne lock pas scanLockRef ici car ImagePicker est une activité UI externe
      // Mais on set isLoading à true, ce qui désactive le hook useLiveOCR via la prop `enabled`

      setIsLoading(true);

      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        cropperToolbarTitle: 'Rogner la citation',
        cropperChooseText: 'Valider',
        cropperCancelText: 'Annuler',
        compressImageQuality: 1, // Max quality
        // Force high resolution output
        width: 3000,
        height: 3000,
        compressImageMaxWidth: 4096,
        compressImageMaxHeight: 4096,
      });

      if (!image) {
        setIsLoading(false);
        return;
      }

      const result = await processImage(image.path);

      const cleanPath = image.path.startsWith('file://') ? image.path : `file://${image.path}`;

      // Create a pseudo PhotoFile object
      const pickedPhoto: PhotoFile = {
        path: cleanPath, // Use the path with file:// schema if needed or raw path 
        width: image.width,
        height: image.height,
        isRawPhoto: false,
        metadata: { Orientation: 1 } as any, // Default orientation
      } as PhotoFile;

      setPhoto(pickedPhoto);
      setOcrResult(result || { blocks: [] } as any);

    } catch (error: any) {
      if (error?.code !== 'E_PICKER_CANCELLED') {
        console.error('Picker error:', error);
      } else {
        console.log('User cancelled selection');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
    <SafeAreaView
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      {!photo && (
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <QuotexLogo width={320} height={120} color="#FFFFFF" style={styles.logoImage} />
          </View>
        </View>
      )}

      {photo && ocrResult ? (
        <ScanWorkflow photo={photo} ocrResult={ocrResult} onReset={handleResetCapture} />
      ) : isFocused && !photo ? (
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
          <ActivityIndicator size="large" color="#20B8CD" />
        </View>
      )}

      {!photo && (
        <>
          <View style={styles.scanArea}>
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
                        width: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.width - 32] }),
                        height: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.height - 32] }),
                        borderTopWidth: 3,
                        borderLeftWidth: 3,
                        borderTopLeftRadius: 24,
                        borderRightWidth: 0,
                        borderBottomWidth: 0,
                        zIndex: 10,
                      },
                    ]}
                  />
                  {/* Coin supérieur droit (s'étend vers le bas et la gauche) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        right: -3,
                        top: -3,
                        width: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.width - 32] }),
                        height: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.height - 32] }),
                        borderTopWidth: 3,
                        borderRightWidth: 3,
                        borderTopRightRadius: 24,
                        borderLeftWidth: 0,
                        borderBottomWidth: 0,
                        zIndex: 10,
                      },
                    ]}
                  />
                  {/* Coin inférieur gauche (s'étend vers le haut et la droite) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        left: -3,
                        bottom: -3,
                        width: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.width - 32] }),
                        height: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.height - 32] }),
                        borderBottomWidth: 3,
                        borderLeftWidth: 3,
                        borderBottomLeftRadius: 24,
                        borderTopWidth: 0,
                        borderRightWidth: 0,
                        zIndex: 10,
                      },
                    ]}
                  />
                  {/* Coin inférieur droit (s'étend vers le haut et la gauche) */}
                  <Animated.View
                    style={[
                      styles.corner,
                      {
                        right: -3,
                        bottom: -3,
                        width: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.width - 32] }),
                        height: frameAnim.interpolate({ inputRange: [0, 1], outputRange: [32, scanFrameLayout.height - 32] }),
                        borderBottomWidth: 3,
                        borderRightWidth: 3,
                        borderBottomRightRadius: 24,
                        borderTopWidth: 0,
                        borderLeftWidth: 0,
                        zIndex: 10,
                      },
                    ]}
                  />
                </>
              )}

              {/* Ligne de scan animée supprimée */}

              <View style={styles.content}>
                <Animated.View
                  style={[styles.fadeContainer, { opacity: fadeAnim }]}
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
                    y={scanFrameLayout.y + 22}
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
                fill="rgba(0, 0, 0, 0.6)"
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
                    !isTextDetectedLive && styles.scanButtonDisabled
                  ]}
                  onPress={handleTakePhoto}
                  disabled={isLoading || !isTextDetectedLive}
                  activeOpacity={0.9}
                >
                  <View>
                    <ScanLine size={28} color={isTextDetectedLive ? "#20B8CD" : "#444"} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  header: {
    position: 'relative',
    top: 0,
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
    overflow: 'visible',
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
    marginTop: -125,
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
    backgroundColor: 'transparent',
    overflow: 'visible',
    zIndex: 3,
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
    zIndex: 10,
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
    shadowColor: '#20B8CD',
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
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: '#20B8CD',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
});
