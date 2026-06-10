import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useRouter } from 'expo-router';
import { BookOpen, Image as ImageIcon, ScanLine, Sparkles, Settings, User, CameraOff, RefreshCw } from 'lucide-react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { Camera, PhotoFile, useCameraDevice, useCameraPermission, useCodeScanner, CameraDevice, CameraDeviceFormat, CodeScanner } from 'react-native-vision-camera';
import { useAppTour, InteractiveTooltip } from '@/src/features/app-tour';

import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import { useTabIndex, useSwipeEnabled } from '@/src/app/providers/TabContext';
import { ThemeColors } from '@/src/shared/theme';
import { PlatformServices } from '@/src/shared/platform';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { ITabController } from '@/src/features/scanner/model/useScanController';

import ScanWorkflow from '@/src/features/scanner/ui/ScanWorkflow';
import ScanFrameOverlay from '@/src/features/scanner/ui/ScanFrameOverlay';
import AnimatedISBNPopup, { IsbnBookData } from '@/src/features/scanner/ui/AnimatedISBNPopup';
import { useLiveOCR } from '@/src/features/scanner/model/useLiveOCR';
import { useScanController } from '@/src/features/scanner/model/useScanController';

// Removed CopilotTouchable

import QuotexLogo from '@/src/shared/ui/QuotexLogo';
import ScanPreviewModal from '@/src/features/scanner/ui/ScanPreviewModal';
import { getBookTitle, getAuthorName } from '@/src/shared/lib/dataHelpers';

interface CameraContainerProps {
  device: CameraDevice | null;
  cameraRef: React.RefObject<Camera | null>;
  codeScanner: CodeScanner;
  showIsbnPopup: boolean;
  isSearchingIsbn: boolean;
  isLoading: boolean;
  photo: PhotoFile | null;
  isFocused: boolean;
  onTextDetectedChange: (detected: boolean) => void;
  format?: CameraDeviceFormat | null;
}

const CameraContainer = React.memo(({
  device,
  cameraRef,
  codeScanner,
  showIsbnPopup,
  isSearchingIsbn,
  isLoading,
  photo,
  isFocused,
  onTextDetectedChange,
  format,
}: CameraContainerProps) => {
  const { frameProcessor } = useLiveOCR({
    cameraRef,
    isFocused,
    enabled: !photo && !isLoading && !showIsbnPopup && !isSearchingIsbn,
    scanInterval: 300,
    positiveThreshold: 1,
    negativeThreshold: 10,
    onTextDetectedChange,
  });

  if (!device) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111827' }]} />
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isFocused}
      photo
      pixelFormat="yuv"
      resizeMode="cover"
      videoStabilizationMode="auto"
      outputOrientation="preview"
      format={format ?? undefined}
      ref={cameraRef}
      frameProcessor={frameProcessor}
      codeScanner={(!showIsbnPopup && !isSearchingIsbn && !isLoading) ? codeScanner : undefined}
      onError={(error) => {
        console.log('Camera error:', error);
      }}
    />
  );
});

// Debug flag
const DEBUG_SCAN_AREA = false;

export default function ScanScreen() {
  const { colors } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { tabIndex, setTabIndex, setPage } = useTabIndex();
  const { resetTour } = useAppTour();
  const isFocused = tabIndex === 1;
  const { setSwipeEnabled } = useSwipeEnabled();
  const { quotes } = useQuote();

  // ========== SCAN CONTROLLER ==========
  // Gère toute la logique de scan via un hook centralisé
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [scanAreaY, setScanAreaY] = React.useState(0);
  const [scanFrameLayout, setScanFrameLayout] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Injection de dépendances pour respecter la Clean Architecture
  const tabController: ITabController = useMemo(() => ({
    setTabIndex,
    setSwipeEnabled,
  }), [setTabIndex, setSwipeEnabled]);

  const scanController = useScanController({
    isFocused,
    containerSize,
    scanFrameLayout,
    scanAreaY,
    tabController,
    quotes,
    currentUser,
  });

  const {
    // Camera state
    hasPermission,
    device,
    format,
    cameraRef,
    requestPermission,
    
    // Scan state
    photo,
    ocrElements,
    ocrBlocks,
    ocrNormalizedSize,
    isFromGallery,
    isLoading,
    isPickerActive,
    
    // ISBN state
    showIsbnPopup,
    isbnBookData,
    isSearchingIsbn,
    handleIsbnPopupPress,
    handleIsbnPopupDismiss,
    
    // Random quote state
    randomQuote,
    showRandomQuoteModal,
    setShowRandomQuoteModal,
    handleRandomQuotePress,
    
    // OCR Live state
    isTextDetectedLive,
    handleTextDetectedChange,
    
    // Code scanner
    codeScanner,
    
    // Actions
    handleTakePhoto,
    handleResetCapture,
    handlePickImage,
    saveScannedQuote,
    cleanup,
  } = scanController;

  // ========== ANIMATIONS ==========
  const fadeAnim = useSharedValue(1);

  React.useEffect(() => {
    fadeAnim.value = withTiming(isTextDetectedLive ? 0 : 1, { duration: 400 });
  }, [isTextDetectedLive]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));



  // ========== EFFETS ==========
  // Cleanup au unmount
  useEffect(() => {
    return () => {
      console.log('[ScanScreen] Unmounting component, releasing locks and cleaning up.');
      cleanup();
    };
  }, [cleanup]);

  // Permission check
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Tab index sync
  useEffect(() => {
    if (isFocused) {
      setTabIndex(1);
    } else {
      console.log('[ScanScreen] Lost focus, resetting state.');
    }
  }, [isFocused, setTabIndex]);

  // Swipe enabled sync
  useEffect(() => {
    setSwipeEnabled(!(photo && ocrElements));
  }, [photo, ocrElements, setSwipeEnabled]);



  // ========== RENDER ==========
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
            accessible={true}
            accessibilityLabel="Paramètres"
            accessibilityRole="button"
            testID="settings-button"
          >
            <Settings size={24} color="#E5E7EB" />
          </TouchableOpacity>

          {/* Bouton de debug temporaire pour réinitialiser l'onboarding */}
          <TouchableOpacity
            style={[styles.headerButtonLeft, { left: 70 }]}
            onPress={async () => {
              await resetTour();
              Alert.alert('Debug', 'Onboarding réinitialisé ! Relancez l\'application pour voir le tour.');
            }}
            accessible={true}
            accessibilityLabel="Réinitialiser le tutoriel"
            accessibilityRole="button"
          >
            <RefreshCw size={22} color="#EF4444" />
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
            accessible={true}
            accessibilityLabel="Profil utilisateur"
            accessibilityRole="button"
            testID="profile-button"
          >
            <User size={24} color="#E5E7EB" />
          </TouchableOpacity>
        </View>
      )}

      {!isPickerActive && (
        <CameraContainer
          device={device}
          cameraRef={cameraRef}
          codeScanner={codeScanner}
          showIsbnPopup={showIsbnPopup}
          isSearchingIsbn={isSearchingIsbn}
          isLoading={isLoading}
          photo={photo}
          isFocused={isFocused && !photo}
          onTextDetectedChange={handleTextDetectedChange}
          format={format}
        />
      )}

      <Modal
        visible={!!(photo && ocrElements)}
        transparent={true}
        animationType="fade"
        onRequestClose={handleResetCapture}
      >
        {photo && ocrElements && (
          <ScanWorkflow
            photo={photo}
            ocrElements={ocrElements}
            ocrBlocks={ocrBlocks || []}
            onReset={handleResetCapture}
            isGallery={isFromGallery}
            normalizedSize={ocrNormalizedSize}
            onSave={saveScannedQuote}
          />
        )}
      </Modal>

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
              <ScanFrameOverlay
                isTextDetectedLive={isTextDetectedLive}
                scanFrameLayout={scanFrameLayout}
                colors={colors}
              />

              <View style={styles.content}>
                <Animated.View
                  style={[styles.fadeContainer, fadeStyle]}
                  pointerEvents="none"
                >
                  <View style={styles.iconShadowWrapper}>
                    <BookOpen size={48} color="#FFFFFF" />
                  </View>
                  <Text style={styles.instructionTextShadow}>
                    {isLoading
                      ? 'Analyse en cours...'
                      : !device
                      ? 'Caméra indisponible.\nImportez une image de la galerie.'
                      : 'Placez une citation ou un code-barre dans le cadre'}
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

          {/* Random Quote Preview Modal */}
          {showRandomQuoteModal && randomQuote && (
            <ScanPreviewModal
              visible={showRandomQuoteModal}
              showConfetti={true}
              onClose={() => setShowRandomQuoteModal(false)}
              onConfirm={async (text, book, author) => {
                try {
                  console.log('[ScanScreen] onConfirm called for random quote');
                  console.log('[ScanScreen] text:', text);
                  console.log('[ScanScreen] book:', book);
                  console.log('[ScanScreen] author:', author);
                  
                  // Utiliser QuoteUseCases via saveScannedQuote
                  const result = await saveScannedQuote(text, book, author);
                  
                  if (result.success) {
                    PlatformServices.haptics.notificationAsync("success");
                    setShowRandomQuoteModal(false);
                  } else {
                    Alert.alert('Erreur', result.error || 'Impossible d\'enregistrer la citation.');
                  }
                } catch (e) {
                  console.error('[ScanScreen] Failed to save random quote:', e);
                  Alert.alert('Erreur', 'Impossible d\'enregistrer la citation.');
                }
              }}
              scannedText={randomQuote.text}
              initialBook={getBookTitle(randomQuote.book)}
              initialAuthor={getAuthorName(randomQuote.author)}
              confirmButtonText="Enregistrer"
            />
          )}

          <View style={styles.controls}>
            <View style={styles.controlsRow}>
              <InteractiveTooltip
                text="L'icône image permet de scanner une citation depuis sa pellicule."
                stepName="scanGalleryButton"
                placement="top"
              >
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handlePickImage}
                  accessible={true}
                  accessibilityLabel="Sélectionner une image dans la galerie"
                  accessibilityRole="button"
                  testID="gallery-button"
                >
                  <ImageIcon size={24} color="#E5E7EB" />
                </TouchableOpacity>
              </InteractiveTooltip>

              <View style={styles.scanButtonContainer}>
                <InteractiveTooltip
                  text="Le bouton scan permet de scanner un passage d'un livre pour enregistrer une citation."
                  stepName="scanButton"
                  placement="top"
                >
                  <TouchableOpacity
                    style={[
                      styles.scanButton,
                      isLoading && styles.scanButtonActive,
                      !device && styles.scanButtonDisabled,
                      (!isTextDetectedLive && device) && { borderColor: 'rgba(229, 231, 235, 0.4)', shadowColor: '#E5E7EB', shadowOpacity: 0.3 }
                    ]}
                    onPress={handleTakePhoto}
                    disabled={isLoading || !device}
                    activeOpacity={0.9}
                    accessible={true}
                    accessibilityLabel="Prendre une photo de la citation"
                    accessibilityRole="button"
                    testID="capture-button"
                  >
                    <View>
                      <ScanLine size={28} color={(isTextDetectedLive && device) ? colors.primary : "#E5E7EB"} />
                    </View>
                  </TouchableOpacity>
                </InteractiveTooltip>
              </View>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleRandomQuotePress}
                accessible={true}
                accessibilityLabel="Générer une citation aléatoire"
                accessibilityRole="button"
                testID="random-quote-button"
              >
                <Sparkles size={24} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: '#FFFFFF',
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
