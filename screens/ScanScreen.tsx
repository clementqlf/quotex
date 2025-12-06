import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { BookOpen, ImageIcon, ScanLine, Sparkles } from 'lucide-react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { Camera, PhotoFile, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { useTabIndex, useSwipeEnabled } from '../TabNavigator';
import ScanWorkflow from './ScanWorkflow';

const quotexLogo = require('../assets/images/quotex_logo.png');

export default function ScanScreen() {
  const [photo, setPhoto] = useState<PhotoFile | null>(null);
  const [ocrResult, setOcrResult] = useState<TextRecognitionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scanFrameLayout, setScanFrameLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const { setTabIndex } = useTabIndex();
  const { setSwipeEnabled } = useSwipeEnabled();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  // const scanAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (isFocused) {
      setTabIndex(1);
    }
  }, [isFocused, setTabIndex]);

  useEffect(() => {
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

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isLoading) return;
    setIsLoading(true);
    try {
      const photoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      const result = await TextRecognition.recognize(photoFile.path);

      if (!result || result.blocks.length === 0) {
        setPhoto(null);
        setOcrResult(null);
        return;
      }

      setPhoto(photoFile);
      setOcrResult(result);
    } catch (error) {
      console.error('Failed to take photo or recognize text:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetCapture = () => {
    setPhoto(null);
    setOcrResult(null);
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
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
      }}
    >
      {!photo && (
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={quotexLogo} style={styles.logoImage} resizeMode="contain" tintColor="#FFFFFF" />
          </View>
        </View>
      )}

      {photo && ocrResult ? (
        <ScanWorkflow photo={photo} ocrResult={ocrResult} onReset={handleResetCapture} />
      ) : (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused && !photo}
          photo
        />
      )}

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
              onLayout={event => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setScanFrameLayout({ x, y, width, height });
              }}
            >
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Ligne de scan animée supprimée */}

              <View style={styles.content}>
                <View style={styles.iconShadowWrapper}>
                  <BookOpen size={48} color="#FFFFFF" style={styles.iconShadow} />
                </View>
                <Text style={styles.instructionTextShadow}>
                  {isLoading ? 'Analyse en cours...' : 'Placez une citation dans le cadre'}
                </Text>
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
              <TouchableOpacity style={styles.iconButton}>
                <ImageIcon size={24} color="#E5E7EB" />
              </TouchableOpacity>

              <View style={styles.scanButtonContainer}>
                <TouchableOpacity
                  style={[styles.scanButton, isLoading && styles.scanButtonActive]}
                  onPress={handleTakePhoto}
                  disabled={isLoading}
                  activeOpacity={0.9}
                >
                  <View>
                    <View style={styles.scanInnerShadow} />
                    <ScanLine size={28} color="#20B8CD" />
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
    paddingVertical: 8,
    overflow: 'visible',
  },
  logoImage: {
    width: 136,
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
  scanArea: {
    flex: 1,
    width: '100%',
    position: 'relative',
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -95,
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
