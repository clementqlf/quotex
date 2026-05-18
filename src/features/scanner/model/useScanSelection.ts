import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { PhotoFile } from 'react-native-vision-camera';
import { ImageSize, MLKitText } from '@/src/shared/lib/scanGeometry';

import { useMLKitMapper } from './useMLKitMapper';
import { calculateGlobalAngle, reconstructTextFromBlocks } from './textReconstructor';
import { useScanPanResponder } from './useScanPanResponder';

export const useScanSelection = (
    photo: PhotoFile | null,
    ocrResult: TextRecognitionResult | null,
    imageSize: ImageSize,
    photoDimensions: { width: number; height: number }
) => {
    // 1. Initial OCR Parsing
    const wordBlocks = useMLKitMapper(photo, ocrResult, imageSize);

    // 2. Selection State Management
    const [selectedBlocks, setSelectedBlocks] = useState<MLKitText[]>([]);
    const [selectionMode, setSelectionModeState] = useState<'drag' | 'native' | 'segment'>('drag');
    const [segmentStartBlock, setSegmentStartBlockState] = useState<MLKitText | null>(null);

    const selectionModeRef = useRef<'drag' | 'native' | 'segment'>('drag');
    const segmentStartBlockRef = useRef<MLKitText | null>(null);
    const selectedBlocksRef = useRef<MLKitText[]>([]);

    const setSelectionMode = useCallback((mode: 'drag' | 'native' | 'segment') => {
        selectionModeRef.current = mode;
        setSelectionModeState(mode);
    }, []);

    const setSegmentStartBlock = useCallback((block: MLKitText | null) => {
        segmentStartBlockRef.current = block;
        setSegmentStartBlockState(block);
    }, []);

    useEffect(() => {
        selectedBlocksRef.current = selectedBlocks;
    }, [selectedBlocks]);

    // Global image state for touch interaction handlers
    const imageInfoRef = useRef({ photo, photoDimensions, imageSize, wordBlocks });
    useEffect(() => {
        imageInfoRef.current = { photo, photoDimensions, imageSize, wordBlocks };
    }, [photo, photoDimensions, imageSize, wordBlocks]);

    // 3. Text Reconstruction
    const globalAngle = useMemo(() => calculateGlobalAngle(wordBlocks), [wordBlocks]);
    
    const { sortedSelectedBlocks, scannedText, sortedData } = useMemo(
        () => reconstructTextFromBlocks(selectedBlocks, imageSize, photo, globalAngle),
        [selectedBlocks, imageSize, photo, globalAngle]
    );

    // Debug Logs Effect
    const lastLoggedRef = useRef<string>('');
    useEffect(() => {
        if (sortedData.length === 0) {
            lastLoggedRef.current = '';
            return;
        }
        const logKey = `${scannedText}-${globalAngle.toFixed(1)}`;
        if (logKey === lastLoggedRef.current) return;
        lastLoggedRef.current = logKey;

        console.log(`[WordSorting] Angle: ${globalAngle.toFixed(1)}° | Words: ${sortedData.length} | Text: "${scannedText.slice(0, 80)}..."`);
        const sizesLog = sortedData.map(item => `"${item.block.text}": ${item.rect.width.toFixed(1)}x${item.rect.height.toFixed(1)}`).join(' | ');
        console.log(`[WordSizes] ${sizesLog}`);
    }, [sortedData, globalAngle, scannedText]);

    // Haptics
    useEffect(() => {
        if (selectedBlocks.length > 0) {
            Haptics.selectionAsync().catch(() => { });
        }
    }, [selectedBlocks.length]);

    // 4. Touch Handler
    const { panResponder, getBlockKey } = useScanPanResponder({
        imageInfoRef,
        selectionModeRef,
        segmentStartBlockRef,
        selectedBlocksRef,
        setSelectedBlocks,
        setSegmentStartBlock,
    });

    return {
        wordBlocks,
        selectedBlocks,
        sortedSelectedBlocks,
        setSelectedBlocks,
        scannedText,
        panResponder,
        getBlockKey,
        globalAngle,
        selectionMode,
        setSelectionMode,
        segmentStartBlock,
    };
};
