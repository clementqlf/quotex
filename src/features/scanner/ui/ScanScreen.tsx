import { AppText, Button, CircleButton, IconButton, LoadingOverlay, QuotexLogo } from '@/src/shared/ui';
import { useAppTour } from '@/src/features/app-tour';
import { InteractiveTooltip } from '@/src/shared/ui/modals/InteractiveTooltip';
import { useSinglePress } from '@/src/shared/lib/pressUtils';
import { usePathname } from 'expo-router'; import { useRouter } from '@/src/shared/navigation/useRouter';
import { Image as ImageIcon, RefreshCw, ScanLine, Settings, Sparkles, User } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { ThemeColors, tokens } from '@/src/shared/theme';
import {
  Alert,
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraDevice, CameraDeviceFormat, CodeScanner, PhotoFile } from 'react-native-vision-camera';

import { useAuth } from '@/src/app/providers/AuthContext';
import { useSwipeEnabled, useTabIndex } from '@/src/app/providers/TabContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { ITabController, useScanController } from '@/src/features/scanner/model/useScanController';
import { PlatformServices } from '@/src/shared/platform';

import { useLiveOCR } from '@/src/features/scanner/model/useLiveOCR';
import AnimatedISBNPopup from '@/src/features/scanner/ui/AnimatedISBNPopup';
import ScanViewport from '@/src/features/scanner/ui/ScanViewport';
import ScanWorkflow from '@/src/features/scanner/ui/ScanWorkflow';

import ScanPreviewModal from '@/src/shared/ui/modals/ScanPreviewModal';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';

// Debug flag
const DEBUG_SCAN_AREA = false;

// CameraContainer must be defined before it's used
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
}: {
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
}) => {
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

CameraContainer.displayName = 'CameraContainer';

export default function ScanScreen() {
  const { colors } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { tabIndex, setTabIndex, setPage } = useTabIndex();
  const { resetTour } = useAppTour();
  const isFocused = tabIndex === 1 || pathname === '/scan';
  const { setSwipeEnabled } = useSwipeEnabled();
  const { quotes } = useQuote();

  const navigateToMyQuotesTop = React.useCallback(() => {
    setTabIndex(0);
    setPage?.(0);
  }, [setPage, setTabIndex]);

  const handleSettingsPress = useSinglePress(() => router.navigate('/settings'), 500, [router]);

  const handleProfilePress = useSinglePress(() => {
    if (currentUser?.username) {
      router.navigate({ pathname: '/user-profile', params: { username: currentUser.username } });
    } else {
      router.navigate('/user-profile');
    }
  }, 500, [router, currentUser?.username]);

  // ========== SCAN CONTROLLER ==========
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [scanAreaY, setScanAreaY] = React.useState(0);
  const [scanFrameLayout, setScanFrameLayout] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

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
    hasPermission,
    device,
    format,
    cameraRef,
    requestPermission,
    photo,
    ocrElements,
    ocrBlocks,
    ocrNormalizedSize,
    isFromGallery,
    isLoading,
    isPickerActive,
    showIsbnPopup,
    isbnBookData,
    isSearchingIsbn,
    handleIsbnPopupPress,
    handleIsbnPopupDismiss,
    randomQuote,
    showRandomQuoteModal,
    setShowRandomQuoteModal,
    handleRandomQuotePress,
    isTextDetectedLive,
    handleTextDetectedChange,
    codeScanner,
    handleTakePhoto,
    handleResetCapture,
    handlePickImage,
    saveScannedQuote,
    saveRandomQuoteToCollection,
    cleanup,
  } = scanController;



  // ========== EFFETS ==========
  useEffect(() => {
    return () => {
      console.log('[ScanScreen] Unmounting component, releasing locks and cleaning up.');
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (isFocused) {
      setTabIndex(1);
    } else {
      console.log('[ScanScreen] Lost focus, resetting state.');
    }
  }, [isFocused, setTabIndex]);

  useEffect(() => {
    setSwipeEnabled(!(photo && ocrElements));
  }, [photo, ocrElements, setSwipeEnabled]);

  if (!hasPermission) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <AppText style={styles.permissionText}>{"Quotex a besoin de l'accès à la caméra."}</AppText>
        <Button
          title="Autoriser"
          variant="primary"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
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
          <IconButton
            icon={<Settings size={22} color={colors.text} />}
            variant="ghost"
            size="md"
            onPress={handleSettingsPress}
            style={styles.headerButtonLeft}
            accessibilityLabel="Paramètres"
            testID="settings-button"
          />

          {__DEV__ && (
            <IconButton
              icon={<RefreshCw size={22} color={colors.warning} />}
              variant="ghost"
              size="md"
              onPress={async () => {
                await resetTour();
                Alert.alert('Debug', 'Onboarding réinitialisé ! Relancez l\'application pour voir le tour.');
              }}
              style={[styles.headerButtonLeft, { left: 74 }]}
              accessibilityLabel="Réinitialiser le tutoriel"
            />
          )}

          <View style={styles.logoContainer}>
            <QuotexLogo width={320} height={120} color={colors.text || '#FFFFFF'} style={styles.logoImage} />
          </View>

          <IconButton
            icon={<User size={22} color={colors.text} />}
            variant="ghost"
            size="md"
            onPress={handleProfilePress}
            style={styles.headerButtonRight}
            accessibilityLabel="Profil utilisateur"
            testID="profile-button"
          />
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
            onSave={async (text, book, author) => {
              const result = await saveScannedQuote(text, book, author);
              if (result.success) {
                navigateToMyQuotesTop();
              }
              return result;
            }}
          />
        )}
      </Modal>

      <LoadingOverlay visible={isLoading} />

      {!photo && (
        <>
          <ScanViewport
            containerSize={containerSize}
            isTextDetectedLive={isTextDetectedLive}
            colors={colors}
            maskColor={colors.backdrop}
            onScanAreaYChange={setScanAreaY}
            onScanFrameLayoutChange={setScanFrameLayout}
            instructionText={
              isLoading ? (
                'Analyse en cours...'
              ) : !device ? (
                'Caméra indisponible.\nImportez une image de la galerie.'
              ) : (
                <>
                  Placez une <AppText style={styles.italicText}>citation</AppText> ou un <AppText style={styles.italicText}>code-barre</AppText> dans le cadre
                </>
              )
            }
          />

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

          {showIsbnPopup && isbnBookData && (
            <AnimatedISBNPopup
              bookData={isbnBookData}
              onPress={handleIsbnPopupPress}
              onDismiss={handleIsbnPopupDismiss}
            />
          )}

          {showRandomQuoteModal && randomQuote && (
            <ScanPreviewModal
              visible={showRandomQuoteModal}
              showConfetti={true}
              onClose={() => setShowRandomQuoteModal(false)}
              onConfirm={async (text, book, author) => {
                try {
                  console.log('[ScanScreen] onConfirm called for random quote');
                  saveRandomQuoteToCollection(randomQuote.id).catch(e => {
                    console.error('[ScanScreen] Background save failed:', e);
                  });
                  PlatformServices.haptics.notificationAsync("success");
                  setShowRandomQuoteModal(false);
                  navigateToMyQuotesTop();
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
                <IconButton
                  icon={<ImageIcon size={22} color={colors.text} />}
                  variant="filled"
                  size="md"
                  onPress={handlePickImage}
                  style={styles.iconButton}
                  accessibilityLabel="Sélectionner une image dans la galerie"
                  testID="gallery-button"
                />
              </InteractiveTooltip>

              <View style={styles.scanButtonContainer}>
                <InteractiveTooltip
                  text="Le bouton scan permet de scanner un passage d'un livre pour enregistrer une citation."
                  stepName="scanButton"
                  placement="top"
                >
                  <CircleButton
                    icon={<ScanLine size={28} color={(isTextDetectedLive && device) ? colors.primary : colors.text} />}
                    onPress={handleTakePhoto}
                    size="md"
                    disabled={isLoading || !device}
                    active={isTextDetectedLive && !!device}
                    inactiveColor={colors.textSecondary}
                    accessibilityLabel="Prendre une photo de la citation"
                    testID="capture-button"
                  />
                </InteractiveTooltip>
              </View>

              <IconButton
                icon={<Sparkles size={22} color={colors.text} />}
                variant="filled"
                size="md"
                onPress={handleRandomQuotePress}
                style={styles.iconButton}
                accessibilityLabel="Générer une citation aléatoire"
                testID="random-quote-button"
              />
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
  instructionTextShadow: {
    fontSize: tokens.typography.fontSize.xl,
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    overflow: 'visible',
    fontFamily: tokens.typography.fontFamily.display,
  },
  italicText: {
    fontFamily: tokens.typography.fontFamily.quote,
    fontSize: tokens.typography.fontSize.xl,
    fontStyle: 'italic',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
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
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight || 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: colors.border || 'rgba(255, 255, 255, 0.2)',
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
  permissionText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
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
});
