import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { PhotoFile } from 'react-native-vision-camera';
import {
    calculateTextRotation,
    getBlockRectOnScreen,
    getPhotoOrientation,
    ImageSize,
    isPointInBlock,
    MLKitText,
    PATH_SAMPLE_STEP,
    sampleLinePoints,
} from '../utils/scanGeometry';

const HIGHLIGHT_PADDING = 1;

export const useScanSelection = (
    photo: PhotoFile | null,
    ocrResult: TextRecognitionResult | null,
    imageSize: ImageSize,
    photoDimensions: { width: number; height: number }
) => {
    const [selectedBlocks, setSelectedBlocks] = useState<MLKitText[]>([]);
    const [scannedText, setScannedText] = useState('');

    // Refs for PanResponder to access fresh state without re-render
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
    const panModeRef = useRef<'add' | 'remove'>('add');
    const selectedBlocksRef = useRef<MLKitText[]>([]);

    // Memoize word blocks from OCR result
    const wordBlocks = useMemo<MLKitText[]>(() => {
        if (!ocrResult) return [];
        const words: MLKitText[] = [];
        ocrResult.blocks.forEach(block => {
            block.lines?.forEach(line => {
                line.elements?.forEach(element => {
                    if (element.frame) {
                        const cornerPoints = (element as any)?.cornerPoints;
                        const rotation = cornerPoints ? calculateTextRotation(cornerPoints) : undefined;
                        words.push({
                            text: element.text,
                            frame: element.frame,
                            cornerPoints,
                            rotation,
                        });
                    }
                });
            });
        });
        return words;
    }, [ocrResult]);

    // Keep refs updated
    const imageInfoRef = useRef({ photo, photoDimensions, imageSize, wordBlocks });
    useEffect(() => {
        imageInfoRef.current = { photo, photoDimensions, imageSize, wordBlocks };
    }, [photo, photoDimensions, imageSize, wordBlocks]);

    useEffect(() => {
        selectedBlocksRef.current = selectedBlocks;
    }, [selectedBlocks]);

    // Logic to sort blocks and build text
    useEffect(() => {
        type PositionedBlock = {
            block: MLKitText;
            rect: { left: number; top: number; width: number; height: number; rotation?: number };
            alignedX: number;
            alignedY: number;
        };

        const angles = selectedBlocks
            .map(block => block.rotation || 0)
            .filter(angle => angle !== 0);

        const globalAngle = angles.length > 0
            ? angles.reduce((a, b) => a + b, 0) / angles.length
            : 0;

        const orientation = getPhotoOrientation(photo);

        const oriented: PositionedBlock[] = selectedBlocks
            .map<PositionedBlock | null>(block => {
                if (!photo) return null;
                const rect = getBlockRectOnScreen(block, imageSize, { width: photo.width, height: photo.height }, orientation);
                if (!rect) return null;

                let alignedX = rect.left + rect.width / 2;
                let alignedY = rect.top + rect.height / 2;

                if (globalAngle !== 0) {
                    const centerX = imageSize.offsetX + imageSize.width / 2;
                    const centerY = imageSize.offsetY + imageSize.height / 2;

                    const dx = alignedX - centerX;
                    const dy = alignedY - centerY;

                    const angleRad = (globalAngle * Math.PI) / 180;
                    const cosA = Math.cos(angleRad);
                    const sinA = Math.sin(angleRad);

                    alignedX = centerX + (dx * cosA + dy * sinA);
                    alignedY = centerY + (-dx * sinA + dy * cosA);
                }

                return { block, rect, alignedX, alignedY };
            })
            .filter((item): item is PositionedBlock => item !== null);

        const heights = oriented.map(item => item.rect.height).sort((a, b) => a - b);
        const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
        const LINE_TOLERANCE = Math.max(6, medianHeight * 0.5);

        const lines: Array<{ centerY: number; words: PositionedBlock[] }> = [];
        oriented.forEach(item => {
            const centerY = item.alignedY;
            let line = lines.find(l => Math.abs(l.centerY - centerY) < LINE_TOLERANCE);
            if (!line) {
                line = { centerY, words: [] };
                lines.push(line);
            }
            line.words.push(item);
        });

        lines.sort((a, b) => a.centerY - b.centerY);
        const sortedWords = lines.flatMap(line => line.words.sort((a, b) => a.alignedX - b.alignedX));
        const newText = sortedWords.map(item => item.block.text).join(' ');
        setScannedText(newText);
    }, [selectedBlocks, imageSize, photo, photoDimensions]);

    // Helpers for interactions
    const getBlockKey = (block: MLKitText): string => {
        return `${block.text}-${block.frame?.left}-${block.frame?.top}`;
    };

    const getBlocksNearPoint = (x: number, y: number, padding = HIGHLIGHT_PADDING) => {
        const { wordBlocks, imageSize, photoDimensions, photo } = imageInfoRef.current;
        if (imageSize.width === 0) return [] as MLKitText[];

        const orientation = getPhotoOrientation(photo);

        return wordBlocks.filter(block => {
            if (!photo) return false;
            return isPointInBlock(x, y, block, imageSize, { width: photo.width, height: photo.height }, orientation, padding);
        });
    };

    const updateSelectionForBlocks = (blocks: MLKitText[], mode: 'add' | 'remove') => {
        if (blocks.length === 0) return;

        setSelectedBlocks(prev => {
            const next = [...prev];
            const currentKeys = new Set(next.map(getBlockKey));

            blocks.forEach(block => {
                const key = getBlockKey(block);
                if (mode === 'add') {
                    if (!currentKeys.has(key)) {
                        next.push(block);
                        currentKeys.add(key);
                    }
                } else if (currentKeys.has(key)) {
                    const index = next.findIndex(b => getBlockKey(b) === key);
                    if (index > -1) {
                        next.splice(index, 1);
                        currentKeys.delete(key);
                    }
                }
            });

            return next;
        });
    };

    const applyHighlightStroke = (points: { x: number; y: number }[]) => {
        const touchedBlocksMap = new Map<string, MLKitText>();
        points.forEach(point => {
            getBlocksNearPoint(point.x, point.y).forEach(block => {
                touchedBlocksMap.set(getBlockKey(block), block);
            });
        });

        if (touchedBlocksMap.size === 0) return;

        const { imageSize, photoDimensions, photo } = imageInfoRef.current;
        const orientation = getPhotoOrientation(photo);

        const blocksToUpdate = Array.from(touchedBlocksMap.values()).sort((a, b) => {
            if (!photo) return 0;
            const rectA = getBlockRectOnScreen(a, imageSize, { width: photo.width, height: photo.height }, orientation);
            const rectB = getBlockRectOnScreen(b, imageSize, { width: photo.width, height: photo.height }, orientation);
            if (!rectA || !rectB) return 0;

            const tolerance = Math.max(rectA.height, rectB.height) * 0.3;
            const centerYDiff = Math.abs((rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2));

            if (centerYDiff < tolerance) {
                return rectA.left - rectB.left;
            }
            return (rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2);
        });

        updateSelectionForBlocks(blocksToUpdate, panModeRef.current);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: evt => {
                if (!evt?.nativeEvent) return;
                const { photo, imageSize } = imageInfoRef.current;
                if (!photo || imageSize.width === 0) return;

                const locationX = evt.nativeEvent.locationX;
                const locationY = evt.nativeEvent.locationY;
                if (locationX === undefined || locationY === undefined) return;

                lastTouchRef.current = { x: locationX, y: locationY };

                const initialBlocks = getBlocksNearPoint(locationX, locationY);
                const selectedKeys = new Set(selectedBlocksRef.current.map(getBlockKey));
                const shouldErase = initialBlocks.some(block => selectedKeys.has(getBlockKey(block)));
                panModeRef.current = shouldErase ? 'remove' : 'add';

                applyHighlightStroke([{ x: locationX, y: locationY }]);
            },
            onPanResponderMove: evt => {
                if (!evt?.nativeEvent) return;
                const locationX = evt.nativeEvent.locationX;
                const locationY = evt.nativeEvent.locationY;
                if (locationX === undefined || locationY === undefined) return;

                const currentPoint = { x: locationX, y: locationY };
                const lastPoint = lastTouchRef.current;
                const points = lastPoint ? sampleLinePoints(lastPoint, currentPoint) : [currentPoint];
                applyHighlightStroke(points);
                lastTouchRef.current = currentPoint;
            },
            onPanResponderRelease: () => {
                lastTouchRef.current = null;
            },
            onPanResponderTerminate: () => {
                lastTouchRef.current = null;
            },
        }),
    ).current;

    return {
        wordBlocks,
        selectedBlocks,
        setSelectedBlocks,
        scannedText,
        setScannedText,
        panResponder,
        getBlockKey,
    };
};
