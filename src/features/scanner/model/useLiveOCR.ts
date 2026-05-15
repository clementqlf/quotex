import { useRef, useState, useEffect } from 'react';
import { Camera, PhotoFile } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

type UseLiveOCRProps = {
    cameraRef: React.RefObject<Camera | null>;
    isFocused: boolean;
    enabled?: boolean;
    scanLockRef?: React.MutableRefObject<boolean>; // Optional shared lock to prevent concurrent captures
};

export function useLiveOCR({
    cameraRef,
    isFocused,
    enabled = true,
    scanLockRef,
}: UseLiveOCRProps) {
    const [isTextDetectedLive, setIsTextDetectedLive] = useState(false);
    const internalBusyRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Helper to check if we can scan
    const canScan = () => {
        if (!enabled || !isFocused || !cameraRef.current) return false;
        if (internalBusyRef.current) return false;
        if (scanLockRef && scanLockRef.current) return false;
        return true;
    };

    useEffect(() => {
        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleNext = () => {
            if (isMounted && enabled && isFocused) {
                timeoutId = setTimeout(runScan, 1000);
            }
        };

        const runScan = async () => {
            if (!isMounted || !canScan()) {
                scheduleNext();
                return;
            }

            // Acquire locks
            internalBusyRef.current = true;
            if (scanLockRef) scanLockRef.current = true;

            try {
                if (!cameraRef.current) return;

                const tempPhoto = await cameraRef.current.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                });

                // Check if still active before processing
                if (isMounted && enabled && isFocused) {
                    const result = await TextRecognition.recognize(tempPhoto.path);
                    setIsTextDetectedLive(!!result && result.blocks.length > 0);
                }
            } catch (e) {
                console.log('[useLiveOCR] Scan error:', e);
                setIsTextDetectedLive(false);
            } finally {
                // Release locks
                if (scanLockRef) scanLockRef.current = false;
                internalBusyRef.current = false;
                
                // Small cooldown before next scan
                scheduleNext();
            }
        };

        if (enabled && isFocused) {
            scheduleNext();
        }

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
            internalBusyRef.current = false;
        };
    }, [enabled, isFocused, cameraRef, scanLockRef]);

    return {
        isTextDetectedLive,
        setIsTextDetectedLive, // Exposed in case we need to reset it manually
    };
}
