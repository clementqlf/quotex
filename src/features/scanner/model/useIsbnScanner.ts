import { useEffect, useState } from 'react';
import { useSharedValue, useRunOnJS } from 'react-native-worklets-core';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-ocr-plus';

type UseIsbnScannerProps = {
    cameraRef?: React.RefObject<Camera | null>; // Kept for backward compatibility
    isFocused: boolean;
    enabled?: boolean;
    onIsbnDetected: (isbn: string) => void;
};

export function extractIsbn(text: string): string | null {
    'worklet';
    const cleanText = text.replace(/\n/g, ' ');
    const candidates = cleanText.match(/(?:[0-9xX][-\s]*){9,17}/g) || [];
    
    let found10: string | null = null;
    
    for (const cand of candidates) {
        const cleaned = cand.replace(/[-\s]/g, '');
        if (cleaned.length === 13 && /^(97[89])\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        if (cleaned.length === 10 && /^\d{9}[\dxX]$/i.test(cleaned)) {
            if (!found10) found10 = cleaned;
        }
    }
    
    const digitsOnly = cleanText.replace(/[^0-9xX]/g, '');
    const fallbackMatch = /(97[89]\d{10})/.exec(digitsOnly);
    if (fallbackMatch) {
        return fallbackMatch[1];
    }
    
    if (found10) {
        return found10;
    }
    
    const fallbackMatch10 = /(\b\d{9}[\dxX]\b)/i.exec(digitsOnly);
    if (fallbackMatch10) {
        return fallbackMatch10[1];
    }
    
    return null;
}

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
