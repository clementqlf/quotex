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

const NATURAL_HYPHEN_PARTS = new Set([
    // Pronouns
    'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'le', 'la', 'les', 'lui', 'leur', 'moi', 'toi', 'soi', 'y', 'en', 'ce', 't', 'm', 's',
    // Prefixes
    'anti', 'archi', 'après', 'avant', 'auto', 'bien', 'co', 'contre', 'demi', 'ex', 'extra', 'grand', 'haut', 'hyper', 'infra', 'inter', 'intra', 'mi', 'micro', 'mini', 'multi', 'non', 'néo', 'poly', 'post', 'pré', 'pseudo', 'quasi', 'retro', 'sans', 'semi', 'sous', 'super', 'supra', 'sur', 'télé', 'trans', 'ultra', 'vice',
    // Common comp
    'peut', 'est', 'dit', 'rendez', 'arc', 'chou', 'faire', 'porte', 'garde', 'passe', 'tire', 'serre', 'tourne', 'bas', 'arrière', 'extrême',
    // Numbers
    'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'cent', 'mille'
]);

export const useScanSelection = (
    photo: PhotoFile | null,
    ocrResult: TextRecognitionResult | null,
    imageSize: ImageSize,
    photoDimensions: { width: number; height: number }
) => {
    const [selectedBlocks, setSelectedBlocks] = useState<MLKitText[]>([]);

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

    // Calculate global angle using weighted average (wider blocks have more weight)
    const angleWeights = selectedBlocks
        .filter(b => b.rotation !== undefined && b.rotation !== 0 && b.frame !== undefined)
        .map(b => ({
            angle: b.rotation!,
            weight: b.frame!.width
        }));

    const totalWeight = angleWeights.reduce((sum, item) => sum + item.weight, 0);
    const globalAngle = totalWeight > 0
        ? angleWeights.reduce((sum, item) => sum + item.angle * item.weight, 0) / totalWeight
        : 0;

    // Logic to sort blocks and build text (Derive from state using useMemo)
    const { sortedSelectedBlocks, scannedText, sortedData } = useMemo(() => {
        if (selectedBlocks.length === 0) {
            return { sortedSelectedBlocks: [], scannedText: '', sortedData: [] };
        }

        type PositionedBlock = {
            block: MLKitText;
            rect: { left: number; top: number; width: number; height: number; rotation?: number };
            alignedX: number;
            alignedY: number;
        };

        const orientation = getPhotoOrientation(photo);

        const oriented: PositionedBlock[] = selectedBlocks
            .map<PositionedBlock | null>(block => {
                if (!photo) return null;
                const rect = getBlockRectOnScreen(block, imageSize, { width: photo.width, height: photo.height }, orientation);
                if (!rect) return null;

                const centerX = imageSize.offsetX + imageSize.width / 2;
                const centerY = imageSize.offsetY + imageSize.height / 2;
                const dx = rect.left + rect.width / 2 - centerX;
                const dy = rect.top + rect.height / 2 - centerY;

                let alignedX = rect.left + rect.width / 2;
                let alignedY = rect.top + rect.height / 2;

                if (globalAngle !== 0) {
                    const angleRad = (globalAngle * Math.PI) / 180;
                    const cosA = Math.cos(angleRad);
                    const sinA = Math.sin(angleRad);

                    // X increases Left -> Right, Y increases Bottom -> Top
                    alignedX = centerX + (dx * cosA + dy * sinA);
                    alignedY = centerY - (-dx * sinA + dy * cosA);
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

        // Top line has HIGHEST Y in the new system (bottom to top), so sort descending
        lines.sort((a, b) => b.centerY - a.centerY);
        const sorted = lines.flatMap(line => line.words.sort((a, b) => a.alignedX - b.alignedX));
        const finalSortedBlocks = sorted.map(item => item.block);
        
        const scannedText = finalSortedBlocks.reduce((acc, block, index) => {
            if (index === 0) return block.text;

            const prevBlock = finalSortedBlocks[index - 1];
            const prevText = prevBlock.text;

            // If previous word ends with a hyphen, we might need to merge
            if (prevText.endsWith('-') && prevText.length > 1) {
                const part1 = prevText.slice(0, -1).toLowerCase();
                const part2 = block.text.toLowerCase().replace(/[.,!?;:]/g, '');

                const isNaturalHyphen = NATURAL_HYPHEN_PARTS.has(part1) || NATURAL_HYPHEN_PARTS.has(part2);

                if (isNaturalHyphen) {
                    // It's a natural hyphenated word (like rendez-vous), keep the hyphen but no space
                    return acc + block.text;
                } else {
                    // It's likely a word split across lines, remove the hyphen and no space
                    return acc.slice(0, -1) + block.text;
                }
            }

            return acc + ' ' + block.text;
        }, '');

        return {
            sortedSelectedBlocks: finalSortedBlocks,
            scannedText,
            sortedData: sorted
        };
    }, [selectedBlocks, imageSize, photo, photoDimensions, globalAngle]);

    const lastLoggedRef = useRef<string>('');

    // Debug Logs Effect (Runs only when the sorted data actually changes)
    useEffect(() => {
        if (sortedData.length === 0) {
            lastLoggedRef.current = '';
            return;
        }

        // Create a unique key for the current sorting state
        const logKey = `${scannedText}-${globalAngle.toFixed(1)}`;
        if (logKey === lastLoggedRef.current) return;
        lastLoggedRef.current = logKey;

        console.log(`--- Word Sorting (Cartesian Repère: X →, Y ↑, Angle: ${globalAngle.toFixed(1)}°) ---`);
        sortedData.forEach((item, index) => {
            console.log(`Order ${index + 1}: "${item.block.text}" at (x: ${item.alignedX.toFixed(1)}, y: ${item.alignedY.toFixed(1)})`);
        });
    }, [sortedData, globalAngle, scannedText]);

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
        sortedSelectedBlocks,
        setSelectedBlocks,
        scannedText,
        panResponder,
        getBlockKey,
        globalAngle,
    };
};
