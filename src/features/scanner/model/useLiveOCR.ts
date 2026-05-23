import { useRef, useState, useEffect } from 'react';
import { Camera, PhotoFile } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
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

    // Auto-reset: if no text confirmed for 1500ms, force reset to false
    const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const consecutiveEmptyFramesRef = useRef(0);

    const confirmTextDetected = (detected: boolean) => {
        if (detected) {
            consecutiveEmptyFramesRef.current = 0;
            setIsTextDetectedLive(true);
            // Refresh the auto-reset window each time text IS confirmed
            if (autoResetRef.current) clearTimeout(autoResetRef.current);
            autoResetRef.current = setTimeout(() => {
                setIsTextDetectedLive(false);
            }, 1500);
        } else {
            consecutiveEmptyFramesRef.current += 1;
            // Require 2 frames without text before clearing status
            if (consecutiveEmptyFramesRef.current >= 2) {
                if (autoResetRef.current) clearTimeout(autoResetRef.current);
                autoResetRef.current = null;
                setIsTextDetectedLive(false);
            }
        }
    };

    // Helper to check if we can scan
    const canScan = () => {
        const cannotScanReason = !enabled ? 'disabled' : !isFocused ? 'not focused' : !cameraRef.current ? 'no camera' : internalBusyRef.current ? 'internal busy' : (scanLockRef && scanLockRef.current) ? 'global scan lock' : null;
        if (cannotScanReason) {
            if (cannotScanReason === 'global scan lock') {
                console.log('[useLiveOCR] Live scan skipped: blocked by global scanLockRef.current');
            }
            return false;
        }
        return true;
    };

    useEffect(() => {
        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleNext = () => {
            if (isMounted && enabled && isFocused) {
                timeoutId = setTimeout(runScan, 500);
            }
        };

        const runScan = async () => {
            if (!isMounted || !canScan()) {
                scheduleNext();
                return;
            }

            console.log('[useLiveOCR] Starting live scan...');
            // Acquire locks
            internalBusyRef.current = true;
            if (scanLockRef) {
                scanLockRef.current = true;
                console.log('[useLiveOCR] scanLockRef.current set to true');
            }

            let tempPhoto: PhotoFile | null = null;
            let isbnDetected = false;
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
                        confirmTextDetected(true);
                        
                        // Check if the recognized text contains an ISBN
                        const fullText = result.blocks.map(b => b.text).join(' ');
                        const isbn = extractIsbn(fullText);
                        
                        if (isbn && onIsbnDetected) {
                            console.log('[useLiveOCR] ISBN Detected during live preview:', isbn);
                            isbnDetected = true;
                            onIsbnDetected(isbn);
                            return;
                        }
                    } else {
                        confirmTextDetected(false);
                    }
                }
            } catch (e) {
                console.log('[useLiveOCR] Scan error:', e);
                confirmTextDetected(false);
            } finally {
                // Delete temp photo to avoid disk leak (takePhoto writes a full-res JPEG each time)
                if (tempPhoto?.path) {
                    FileSystem.deleteAsync(
                        tempPhoto.path.startsWith('file://') ? tempPhoto.path : `file://${tempPhoto.path}`,
                        { idempotent: true }
                    ).catch(() => {});
                }

                // Release internal busy flag
                internalBusyRef.current = false;

                // Release global scan lock only if no ISBN was detected
                if (!isbnDetected) {
                    if (scanLockRef) {
                        scanLockRef.current = false;
                        console.log('[useLiveOCR] Live scan finished: scanLockRef.current released to false');
                    }
                } else {
                    console.log('[useLiveOCR] Live scan finished: ISBN detected, keeping scanLockRef.current true');
                }
                
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
            if (autoResetRef.current) clearTimeout(autoResetRef.current);
            internalBusyRef.current = false;
        };
    }, [enabled, isFocused, cameraRef, scanLockRef, onIsbnDetected]);

    return {
        isTextDetectedLive,
        setIsTextDetectedLive, // Exposed in case we need to reset it manually
    };
}
