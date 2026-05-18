import { useRef, useState, useEffect } from 'react';
import { Camera, PhotoFile } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';

type UseIsbnScannerProps = {
    cameraRef: React.RefObject<Camera | null>;
    isFocused: boolean;
    enabled?: boolean;
    onIsbnDetected: (isbn: string) => void;
};

export function extractIsbn(text: string): string | null {
    const cleanText = text.replace(/\n/g, ' ');
    const candidates = cleanText.match(/(?:[0-9xX][-\s]?){9,17}/g) || [];
    
    for (const cand of candidates) {
        const cleaned = cand.replace(/[-\s]/g, '');
        if (cleaned.length === 13 && /^(97[89])\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        if (cleaned.length === 10 && /^\d{9}[\dxX]$/i.test(cleaned)) {
            return cleaned;
        }
    }
    
    const digitsOnly = cleanText.replace(/[^0-9xX]/g, '');
    const fallbackMatch = /(97[89]\d{10})/.exec(digitsOnly);
    if (fallbackMatch) {
        return fallbackMatch[1];
    }
    
    const fallbackMatch10 = /(\b\d{9}[\dxX]\b)/i.exec(digitsOnly);
    if (fallbackMatch10) {
        return fallbackMatch10[1];
    }
    
    return null;
}

export function useIsbnScanner({
    cameraRef,
    isFocused,
    enabled = true,
    onIsbnDetected,
}: UseIsbnScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const internalBusyRef = useRef(false);

    const canScan = () => {
        if (!enabled || !isFocused || !cameraRef.current) return false;
        if (internalBusyRef.current) return false;
        return true;
    };

    useEffect(() => {
        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const scheduleNext = (delay = 1000) => {
            if (isMounted && enabled && isFocused) {
                timeoutId = setTimeout(runScan, delay);
            }
        };

        const runScan = async () => {
            if (!isMounted || !canScan()) {
                scheduleNext(1000);
                return;
            }

            internalBusyRef.current = true;
            setIsScanning(true);

            let tempPhoto: PhotoFile | null = null;
            try {
                if (!cameraRef.current) {
                    scheduleNext(1000);
                    return;
                }

                tempPhoto = await cameraRef.current.takePhoto({
                    flash: 'off',
                    enableShutterSound: false,
                });

                if (isMounted && enabled && isFocused) {
                    const result = await TextRecognition.recognize(tempPhoto.path);
                    if (result && result.blocks.length > 0) {
                        const fullText = result.blocks.map(b => b.text).join(' ');
                        const isbn = extractIsbn(fullText);
                        
                        if (isbn) {
                            console.log('[useIsbnScanner] ISBN Detected:', isbn);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onIsbnDetected(isbn);
                            
                            // Stop scanning loop
                            internalBusyRef.current = false;
                            setIsScanning(false);
                            
                            // Delete immediately before exit
                            if (tempPhoto?.path) {
                                FileSystem.deleteAsync(
                                    tempPhoto.path.startsWith('file://') ? tempPhoto.path : `file://${tempPhoto.path}`,
                                    { idempotent: true }
                                ).catch(() => {});
                            }
                            return;
                        }
                    }
                }
                
                // Normal scan loop
                internalBusyRef.current = false;
                setIsScanning(false);
                scheduleNext(1000);
            } catch (e) {
                console.log('[useIsbnScanner] Scan error (will retry after cooldown):', e);
                internalBusyRef.current = false;
                setIsScanning(false);
                scheduleNext(3000); // 3-second cooldown on error to allow AVFoundation to recover
            } finally {
                // Delete temp photo to avoid disk leak
                if (tempPhoto?.path) {
                    FileSystem.deleteAsync(
                        tempPhoto.path.startsWith('file://') ? tempPhoto.path : `file://${tempPhoto.path}`,
                        { idempotent: true }
                    ).catch(() => {});
                }
            }
        };

        if (enabled && isFocused) {
            scheduleNext(2500); // 2.5 seconds initial warmup delay for camera hardware to initialize
        }

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
            internalBusyRef.current = false;
        };
    }, [enabled, isFocused, cameraRef, onIsbnDetected]);

    return {
        isScanning,
    };
}
