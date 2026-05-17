import React, { useRef, useState, useEffect } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { X, Camera as CameraIcon, Zap, Image as ImageIcon } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
} from 'react-native-reanimated';
import * as ExpoImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useIsbnScanner, extractIsbn } from '../model/useIsbnScanner';

type BarcodeScannerModalProps = {
    visible: boolean;
    onClose: () => void;
    onIsbnDetected: (isbn: string) => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_WIDTH = SCREEN_WIDTH * 0.85;
const SCAN_HEIGHT = 160;

export default function BarcodeScannerModal({
    visible,
    onClose,
    onIsbnDetected,
}: BarcodeScannerModalProps) {
    const { colors } = useTheme();
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
    const cameraRef = useRef<Camera | null>(null);
    const [torch, setTorch] = useState<'off' | 'on'>('off');
    const [isLoading, setIsLoading] = useState(false);

    // Scan line animation
    const scanLineY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            scanLineY.value = withRepeat(
                withSequence(
                    withTiming(SCAN_HEIGHT, { duration: 1800 }),
                    withTiming(0, { duration: 1800 })
                ),
                -1,
                true
            );
        } else {
            scanLineY.value = 0;
            setTorch('off');
        }
    }, [visible]);

    const animatedScanLineStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanLineY.value }],
    }));

    // Start scanner hook
    const { isScanning } = useIsbnScanner({
        cameraRef,
        isFocused: visible,
        enabled: visible && !isLoading,
        onIsbnDetected: (isbn) => {
            onIsbnDetected(isbn);
        },
    });

    const handlePickImage = async () => {
        try {
            if (isLoading) return;
            setIsLoading(true);

            const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                setIsLoading(false);
                return;
            }

            const result = await ExpoImagePicker.launchImageLibraryAsync({
                mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 1,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                setIsLoading(false);
                return;
            }

            const asset = result.assets[0];
            const cleanPath = asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`;
            
            const ocrResult = await TextRecognition.recognize(cleanPath);
            if (ocrResult && ocrResult.blocks.length > 0) {
                const fullText = ocrResult.blocks.map(b => b.text).join(' ');
                const isbn = extractIsbn(fullText);
                if (isbn) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onIsbnDetected(isbn);
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    alert("Aucun ISBN ou code-barres lisible trouvé sur cette image.");
                }
            } else {
                alert("Aucun texte détecté sur l'image.");
            }
        } catch (error) {
            console.error('[BarcodeScannerModal] Picker error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            animationType="slide"
            transparent={false}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {!hasPermission ? (
                    <View style={styles.permissionContainer}>
                        <CameraIcon size={48} color={colors.primary} style={{ marginBottom: 16 }} />
                        <Text style={[styles.permissionText, { color: colors.text }]}>
                            Quotex a besoin de l'accès à la caméra pour scanner les codes-barres.
                        </Text>
                        <TouchableOpacity
                            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
                            onPress={requestPermission}
                        >
                            <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : !device ? (
                    <View style={styles.permissionContainer}>
                        <Text style={[styles.permissionText, { color: colors.text }]}>
                            Aucun appareil photo n'a été détecté sur votre appareil.
                        </Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <Camera
                            ref={cameraRef}
                            style={StyleSheet.absoluteFillObject}
                            device={device}
                            isActive={visible}
                            photo={true}
                            torch={torch}
                            outputOrientation="preview"
                        />

                        {/* Custom Dark Mask Overlay */}
                        <View style={styles.overlayContainer}>
                            <View style={styles.overlayTop}>
                                <Text style={styles.scanInstruction}>
                                    Scannez le code-barres (ISBN)
                                </Text>
                                <Text style={styles.scanSubInstruction}>
                                    Placez le code EAN-13 du livre dans le cadre
                                </Text>
                            </View>

                            <View style={styles.overlayMiddle}>
                                <View style={styles.overlaySide} />
                                <View style={styles.viewfinder}>
                                    {/* view finder corners */}
                                    <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
                                    <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
                                    <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
                                    <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />

                                    {/* Scan line */}
                                    <Animated.View style={[styles.scanLine, animatedScanLineStyle, { backgroundColor: colors.primary }]} />
                                </View>
                                <View style={styles.overlaySide} />
                            </View>

                            <View style={styles.overlayBottom}>
                                <View style={styles.controlsRow}>
                                    <TouchableOpacity style={styles.controlButton} onPress={handlePickImage}>
                                        <ImageIcon size={22} color="#FFF" />
                                        <Text style={styles.controlText}>Importer</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={styles.controlButton} 
                                        onPress={() => setTorch(t => t === 'off' ? 'on' : 'off')}
                                    >
                                        <Zap size={22} color={torch === 'on' ? colors.primary : '#FFF'} />
                                        <Text style={[styles.controlText, torch === 'on' && { color: colors.primary }]}>Flash</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Top close button */}
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={24} color="#FFF" />
                        </TouchableOpacity>

                        {/* Loading indicator */}
                        {isLoading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Importation...</Text>
                            </View>
                        )}
                    </>
                )}
            </View>
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
        padding: 32,
    },
    permissionText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    permissionButton: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    permissionButtonText: {
        color: '#0F0F0F',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeBtn: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    overlayContainer: {
        flex: 1,
        position: 'relative',
        zIndex: 2,
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 24,
    },
    scanInstruction: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    scanSubInstruction: {
        color: '#BBB',
        fontSize: 14,
    },
    overlayMiddle: {
        height: SCAN_HEIGHT,
        flexDirection: 'row',
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    viewfinder: {
        width: SCAN_WIDTH,
        height: SCAN_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 48,
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderBottomWidth: 0,
        borderRightWidth: 0,
        borderTopLeftRadius: 16,
    },
    topRight: {
        top: 0,
        right: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        borderTopRightRadius: 16,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomLeftRadius: 16,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderBottomRightRadius: 16,
    },
    scanLine: {
        position: 'absolute',
        left: 2,
        right: 2,
        height: 2.5,
        shadowColor: '#20B8CD',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 40,
        alignItems: 'center',
    },
    controlButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
    },
    controlText: {
        color: '#FFF',
        fontSize: 12,
        marginTop: 6,
        fontWeight: '500',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    loadingText: {
        color: '#FFF',
        fontSize: 16,
        marginTop: 16,
        fontWeight: '500',
    },
});
