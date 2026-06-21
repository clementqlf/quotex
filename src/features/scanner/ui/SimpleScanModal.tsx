import { useTheme } from '@/src/app/providers/ThemeContext';
import { scanService } from '@/src/features/scanner/api/ScanService';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { X, ScanLine } from 'lucide-react-native';
import React, { useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import ScanFrameOverlay from '@/src/features/scanner/ui/ScanFrameOverlay';
import { ThemeColors } from '@/src/shared/theme';

interface SimpleScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (text: string) => void;
}

export default function SimpleScanModal({ visible, onClose, onSuccess }: SimpleScanModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scanAreaY, setScanAreaY] = useState(0);
  const [scanFrameLayout, setScanFrameLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || isLoading) return;

    setIsLoading(true);
    try {
      const photoFile = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const result = await scanService.capturePhotoAndRecognize(photoFile);

      if (result.success && result.ocrResult?.text) {
        onSuccess(result.ocrResult.text);
      } else {
        Alert.alert(
          'Aucun texte détecté',
          "Nous n'avons pas pu lire de texte sur cette image. Essayez de vous rapprocher et de bien cadrer la citation."
        );
      }
    } catch (error) {
      console.error('[SimpleScanModal] Capture failed:', error);
      Alert.alert('Erreur', 'Impossible de capturer ou de traiter l\'image.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!hasPermission) {
      return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeAreaContainer}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Quotex a besoin de l'accès à la caméra pour scanner une citation.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButtonTop} onPress={onClose}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (!device) {
      return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeAreaContainer}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Caméra arrière introuvable ou indisponible.
            </Text>
            <TouchableOpacity style={styles.closeButtonTop} onPress={onClose}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.safeAreaContainer}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setContainerSize({ width, height });
        }}
      >
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          photo={true}
          resizeMode="cover"
        />

        {/* Header content (Relative header space, matching ScanScreen height) */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.instructionText}>Cadrez le texte de la citation</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Scan Area Frame wrapper */}
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
            {scanFrameLayout && (
              <ScanFrameOverlay
                isTextDetectedLive={false}
                scanFrameLayout={scanFrameLayout}
                colors={colors}
              />
            )}
          </View>
        </View>

        {/* Overlay Assombrissant avec Découpe SVG */}
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
              fill="rgba(0, 0, 0, 0.6)"
              mask="url(#scanMask)"
            />
          </Svg>
        )}

        {/* Contrôles en bas */}
        <View style={styles.controls}>
          <View style={styles.controlsRow}>
            <View style={styles.scanButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.scanButton,
                  isLoading && styles.scanButtonActive,
                  !device && styles.scanButtonDisabled,
                ]}
                onPress={handleCapture}
                disabled={isLoading || !device}
                activeOpacity={0.9}
              >
                <ScanLine size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.backdrop }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Analyse en cours...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>{renderContent()}</View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#000',
    width: '100%',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    color: colors.text,
  },
  permissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  permissionButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButtonTop: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
  },
  header: {
    position: 'relative',
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    width: '100%',
    height: 120,
    overflow: 'visible',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  instructionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
