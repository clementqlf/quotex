/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from 'react';
import { useSharedValue, useRunOnJS } from 'react-native-worklets-core';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-ocr-plus';
import { extractIsbn } from '@/src/shared/lib/validation/isbn';

type UseIsbnScannerProps = {
    cameraRef?: React.RefObject<Camera | null>; // Kept for backward compatibility
    isFocused: boolean;
    enabled?: boolean;
    onIsbnDetected: (isbn: string) => void;
};

export function useIsbnScanner({
    isFocused,
    enabled = true,
    onIsbnDetected,
}: UseIsbnScannerProps) {
    "use no memo";
    const [isScanning, setIsScanning] = useState(false);
    const lastProcessed = useSharedValue(0);

    // Initialize native OCR plugin
    const { scanText } = useTextRecognition({
        language: 'latin',
    });

    const setScanningJS = useRunOnJS(setIsScanning, [setIsScanning]);
    const onIsbnDetectedJS = useRunOnJS(onIsbnDetected, [onIsbnDetected]);

    const isScanningActive = enabled && isFocused;

    // Use Frame Processor for in-memory ISBN scanning (runs at 2 FPS for fast barcode capture)
    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';

        if (!isScanningActive) return;

        const now = Date.now();
        // 500ms threshold = 2 FPS
        if (now - lastProcessed.value >= 500) {
            lastProcessed.value = now;
            try {
                setScanningJS(true);
                const result = scanText(frame);
                if (result && result.resultText) {
                    const isbn = extractIsbn(result.resultText);
                    if (isbn) {
                        onIsbnDetectedJS(isbn);
                    }
                }
                setScanningJS(false);
            } catch {
                setScanningJS(false);
            }
        }
    }, [isScanningActive, scanText, onIsbnDetected]);

    // Cleanup au unmount
    useEffect(() => {
        return () => {
            // Reset des Shared Values
            lastProcessed.value = 0;
        };
    }, [lastProcessed]);

    return {
        isScanning,
        frameProcessor,
    };
}
