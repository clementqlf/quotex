import { useRef, useState, useEffect } from 'react';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-ocr-plus';
import { useSharedValue } from 'react-native-reanimated';
import { useRunOnJS } from 'react-native-worklets-core';
import { extractIsbn } from './useIsbnScanner';

type UseLiveOCRProps = {
    cameraRef?: React.RefObject<Camera | null>; // Kept for API backward compatibility
    isFocused: boolean;
    enabled?: boolean;
    scanInterval?: number;
};

export function useLiveOCR({
    isFocused,
    enabled = true,
    scanInterval = 500,
}: UseLiveOCRProps) {
    const [isTextDetectedLive, setIsTextDetectedLive] = useState(false);
    const consecutiveEmptyFramesRef = useRef(0);
    const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastProcessed = useSharedValue(0);

    const confirmTextDetected = (detected: boolean) => {
        if (detected) {
            consecutiveEmptyFramesRef.current = 0;
            setIsTextDetectedLive(true);
            if (autoResetRef.current) clearTimeout(autoResetRef.current);
            autoResetRef.current = setTimeout(() => {
                setIsTextDetectedLive(false);
            }, 1500);
        } else {
            consecutiveEmptyFramesRef.current += 1;
            if (consecutiveEmptyFramesRef.current >= 2) {
                if (autoResetRef.current) clearTimeout(autoResetRef.current);
                autoResetRef.current = null;
                setIsTextDetectedLive(false);
            }
        }
    };

    // Native OCR plugin initializer
    const { scanText } = useTextRecognition({
        language: 'latin',
    });

    const isScanningActive = enabled && isFocused;

    const confirmTextDetectedJS = useRunOnJS((detected: boolean) => {
        confirmTextDetected(detected);
    }, []);

    // Use Vision Camera's Frame Processor (runs natively on camera thread)
    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';

        const now = Date.now();
        // Process frames at defined interval to save battery (500ms default = 2 FPS)
        if (now - lastProcessed.value >= scanInterval) {
            lastProcessed.value = now;

            if (!isScanningActive) return;

            try {
                const result = scanText(frame);
                if (result && result.blocks && result.blocks.length > 0) {
                    confirmTextDetectedJS(true);
                } else {
                    confirmTextDetectedJS(false);
                }
            } catch (err: any) {
                // Fail silently in native context
            }
        }
    }, [isScanningActive, scanText, confirmTextDetectedJS, scanInterval]);

    // Clean up debouncing timers on unmount
    useEffect(() => {
        return () => {
            if (autoResetRef.current) clearTimeout(autoResetRef.current);
        };
    }, []);

    return {
        isTextDetectedLive,
        setIsTextDetectedLive,
        frameProcessor,
    };
}
