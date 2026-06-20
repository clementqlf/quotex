import { useTheme } from '@/src/app/providers/ThemeContext';
import { scanService } from '@/src/features/scanner/api/ScanService';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { X, Camera as CameraIcon } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
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

interface SimpleScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (text: string) => void;
}

export default function SimpleScanModal({ visible, onClose, onSuccess }: SimpleScanModalProps) {
  const { colors } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionText, { color: colors.text }]}>
            Quotex a besoin de l'accès à la caméra pour scanner une citation.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonTop} onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      );
    }

    if (!device) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionText, { color: colors.text }]}>
            Caméra arrière introuvable ou indisponible.
          </Text>
          <TouchableOpacity style={styles.closeButtonTop} onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          photo={true}
          resizeMode="cover"
        />

        {/* Overlay Assombrissant avec Découpe (Visual Hack) */}
        <View style={styles.overlayContainer} pointerEvents="none">
          <View style={styles.overlayDarkRow} />
          <View style={styles.overlayMiddleRow}>
            <View style={styles.overlayDarkSide} />
            <View style={[styles.scanFrame, { borderColor: colors.primary + '40' }]} />
            <View style={styles.overlayDarkSide} />
          </View>
          <View style={styles.overlayDarkRow} />
        </View>

        {/* Cadre de Scan avec Coins Cyans */}
        <View style={styles.scanAreaContainer} pointerEvents="none">
          <View style={styles.scanFrameVisual}>
            {/* Corners */}
            <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
          </View>
        </View>

        {/* Consignes en haut */}
        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.instructionText}>Cadrez le texte de la citation</Text>
          <View style={{ width: 24 }} />
        </SafeAreaView>

        {/* Contrôles en bas */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.captureButton, { borderColor: colors.primary }]}
            onPress={handleCapture}
            disabled={isLoading}
          >
            <View style={[styles.captureButtonInner, { backgroundColor: colors.primary }]} />
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.backdrop }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Analyse en cours...</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>{renderContent()}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButtonTop: {
    position: 'absolute',
    top: 60,
    right: 20,
    padding: 8,
  },
  cameraContainer: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  overlayDarkRow: {
    flex: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddleRow: {
    flex: 2,
    flexDirection: 'row',
  },
  overlayDarkSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: '80%',
    aspectRatio: 1.2,
    borderWidth: 2,
    borderRadius: 24,
  },
  scanAreaContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: '10%',
  },
  scanFrameVisual: {
    width: '100%',
    aspectRatio: 1.2,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 12,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 3,
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
  bottomBar: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
