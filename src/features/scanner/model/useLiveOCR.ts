import { useEffect, useCallback } from 'react';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-ocr-plus';
import { useSharedValue } from 'react-native-reanimated';
import { useRunOnJS } from 'react-native-worklets-core';

type UseLiveOCRProps = {
    cameraRef?: React.RefObject<Camera | null>; // Kept for API backward compatibility
    isFocused: boolean;
    enabled?: boolean;
    scanInterval?: number;
    // How many consecutive positive frames before signalling "text detected"
    positiveThreshold?: number;
    // How many consecutive negative frames before signalling "text gone"
    negativeThreshold?: number;
    onTextDetectedChange?: (detected: boolean) => void;
};

// Declared outside to ensure stable object reference and prevent scanText recreation
const OCR_OPTIONS = {
    language: 'latin' as const,
};

export function useLiveOCR({
    isFocused,
    enabled = true,
    scanInterval = 300,
    positiveThreshold = 1,   // 1 positive frame → show border immediately
    negativeThreshold = 10,  // 10 consecutive negatives (~3s at 300ms) → hide border
    onTextDetectedChange,
}: UseLiveOCRProps) {
    // Native OCR plugin initializer with stable options reference
    const { scanText } = useTextRecognition(OCR_OPTIONS);

    const isScanningActive = enabled && isFocused;

    // All state lives in Shared Values so the worklet can manage debouncing
    // natively without any JS bridge round-trips for intermediate frames
    const isScanningActiveSV = useSharedValue(isScanningActive);
    const lastProcessed = useSharedValue(0);
    const consecutivePositive = useSharedValue(0);
    const consecutiveNegative = useSharedValue(0);
    const isCurrentlyDetected = useSharedValue(false); // current "published" state

    useEffect(() => {
        isScanningActiveSV.value = isScanningActive;
        if (!isScanningActive) {
            // Force-reset worklet counters when scanning stops
            consecutivePositive.value = 0;
            consecutiveNegative.value = 0;
            isCurrentlyDetected.value = false;
        }
    }, [isScanningActive]);

    const notifyDetected = useCallback(() => {
        onTextDetectedChange?.(true);
    }, [onTextDetectedChange]);

    const notifyGone = useCallback(() => {
        onTextDetectedChange?.(false);
    }, [onTextDetectedChange]);

    // ⚡ Utiliser useRunOnJS avec des refs stables
    const notifyDetectedJS = useRunOnJS(notifyDetected);
    const notifyGoneJS = useRunOnJS(notifyGone);

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';

        const now = Date.now();
        if (now - lastProcessed.value < scanInterval) return;
        lastProcessed.value = now;

        if (!isScanningActiveSV.value) return;

        try {
            const result = scanText(frame);
            const hasBlocks = !!(result && result.blocks && result.blocks.length > 0);

            if (hasBlocks) {
                consecutivePositive.value += 1;
                consecutiveNegative.value = 0;

                if (!isCurrentlyDetected.value && consecutivePositive.value >= positiveThreshold) {
                    isCurrentlyDetected.value = true;
                    notifyDetectedJS();
                }
            } else {
                consecutiveNegative.value += 1;
                consecutivePositive.value = 0;

                if (isCurrentlyDetected.value && consecutiveNegative.value >= negativeThreshold) {
                    isCurrentlyDetected.value = false;
                    notifyGoneJS();
                }
            }
        } catch (err: any) {
            // Fail silently in native context
        }
    }, [scanText, notifyDetectedJS, notifyGoneJS, scanInterval, positiveThreshold, negativeThreshold]);

    // Reset state when scanning becomes inactive
    useEffect(() => {
        if (!isScanningActive) {
            onTextDetectedChange?.(false);
        }
    }, [isScanningActive, onTextDetectedChange]);

    // Cleanup complet au unmount
    useEffect(() => {
        return () => {
            // Reset des Shared Values pour éviter les fuites
            consecutivePositive.value = 0;
            consecutiveNegative.value = 0;
            isCurrentlyDetected.value = false;
            lastProcessed.value = 0;
            
            // Notifier que le scanning est arrêté
            onTextDetectedChange?.(false);
        };
    }, [onTextDetectedChange, consecutivePositive, consecutiveNegative, isCurrentlyDetected, lastProcessed]);

    return {
        frameProcessor,
    };
}
