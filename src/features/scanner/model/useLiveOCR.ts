import { useRef, useState, useEffect } from 'react';
import { Camera, PhotoFile } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { extractIsbn } from './useIsbnScanner';

type UseLiveOCRProps = {
    cameraRef: React.RefObject<Camera | null>;
    isFocused: boolean;
    enabled?: boolean;
    scanLockRef?: React.MutableRefObject<boolean>; // Optional shared lock to prevent concurrent captures
    onIsbnDetected?: (isbn: string) => void;
};

export function useLiveOCR({
    cameraRef,
    isFocused,
    enabled = true,
    scanLockRef,
    onIsbnDetected,
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

            let tempPhoto: PhotoFile | null = null;
            try {
                if (!cameraRef.current) return;

                tempPhoto = await cameraRef.current.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                });

                // Check if still active before processing
                if (isMounted && enabled && isFocused) {
                    const result = await TextRecognition.recognize(tempPhoto.path);
                    if (result && result.blocks.length > 0) {
                        setIsTextDetectedLive(true);
                        
                        // Check if the recognized text contains an ISBN
                        const fullText = result.blocks.map(b => b.text).join(' ');
                        const isbn = extractIsbn(fullText);
                        
                        if (isbn && onIsbnDetected) {
                            console.log('[useLiveOCR] ISBN Detected during live preview:', isbn);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onIsbnDetected(isbn);
                            
                            // Stop scanning loop
                            if (scanLockRef) scanLockRef.current = false;
                            internalBusyRef.current = false;
                            return;
                        }
                    } else {
                        setIsTextDetectedLive(false);
                    }
                }
            } catch (e) {
                console.log('[useLiveOCR] Scan error:', e);
                setIsTextDetectedLive(false);
            } finally {
                // Delete temp photo to avoid disk leak (takePhoto writes a full-res JPEG each time)
                if (tempPhoto?.path) {
                    FileSystem.deleteAsync(
                        tempPhoto.path.startsWith('file://') ? tempPhoto.path : `file://${tempPhoto.path}`,
                        { idempotent: true }
                    ).catch(() => {});
                }

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
    }, [enabled, isFocused, cameraRef, scanLockRef, onIsbnDetected]);

    return {
        isTextDetectedLive,
        setIsTextDetectedLive, // Exposed in case we need to reset it manually
    };
}
