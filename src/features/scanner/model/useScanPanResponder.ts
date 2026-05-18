import { useRef } from 'react';
import { PanResponder } from 'react-native';
import { PhotoFile } from 'react-native-vision-camera';
import {
    getBlockRectOnScreen,
    getPhotoOrientation,
    ImageSize,
    isPointInBlock,
    MLKitText,
    sampleLinePoints,
} from '@/src/shared/lib/scanGeometry';

const HIGHLIGHT_PADDING = 1;

interface UseScanPanResponderProps {
    imageInfoRef: React.MutableRefObject<{
        photo: PhotoFile | null;
        photoDimensions: { width: number; height: number };
        imageSize: ImageSize;
        wordBlocks: MLKitText[];
    }>;
    selectionModeRef: React.MutableRefObject<'drag' | 'native' | 'segment'>;
    segmentStartBlockRef: React.MutableRefObject<MLKitText | null>;
    selectedBlocksRef: React.MutableRefObject<MLKitText[]>;
    setSelectedBlocks: React.Dispatch<React.SetStateAction<MLKitText[]>>;
    setSegmentStartBlock: (block: MLKitText | null) => void;
}

export const useScanPanResponder = ({
    imageInfoRef,
    selectionModeRef,
    segmentStartBlockRef,
    selectedBlocksRef,
    setSelectedBlocks,
    setSegmentStartBlock,
}: UseScanPanResponderProps) => {
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
    const initialYRef = useRef<number | null>(null);
    const panModeRef = useRef<'add' | 'remove'>('add');
    const activeHandleRef = useRef<'left' | 'right' | null>(null);
    const handleFirstBlockIndexRef = useRef<number | null>(null);
    const handleLastBlockIndexRef = useRef<number | null>(null);

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
                const { photo, imageSize, wordBlocks: currentWordBlocks } = imageInfoRef.current;
                if (!photo || imageSize.width === 0) return;

                const locationX = evt.nativeEvent.locationX;
                const locationY = evt.nativeEvent.locationY;
                if (locationX === undefined || locationY === undefined) return;

                const currentMode = selectionModeRef.current;

                // Mode Segment : Tap de départ puis tap de fin pour sélectionner la plage
                if (currentMode === 'segment') {
                    const tappedBlocks = getBlocksNearPoint(locationX, locationY);
                    if (tappedBlocks.length > 0) {
                        const tappedBlock = tappedBlocks[0];
                        const startBlock = segmentStartBlockRef.current;
                        if (!startBlock) {
                            setSegmentStartBlock(tappedBlock);
                            setSelectedBlocks([tappedBlock]);
                        } else {
                            const idxStart = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(startBlock));
                            const idxEnd = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(tappedBlock));
                            if (idxStart !== -1 && idxEnd !== -1) {
                                const min = Math.min(idxStart, idxEnd);
                                const max = Math.max(idxStart, idxEnd);
                                const range = currentWordBlocks.slice(min, max + 1);
                                setSelectedBlocks(range);
                            }
                            setSegmentStartBlock(null);
                        }
                    }
                    return;
                }

                // Mode Poignées (Native Selection) : Ajuste les bornes au clic ou au glissement de poignée
                if (currentMode === 'native') {
                    const currentSelection = selectedBlocksRef.current;

                    // 1. Détection si on clique près des poignées de sélection existantes pour démarrer un Drag
                    if (currentSelection.length > 0) {
                        const orientation = getPhotoOrientation(photo);
                        const sortedSel = [...currentSelection].sort((a, b) => {
                            const ia = currentWordBlocks.findIndex(x => getBlockKey(x) === getBlockKey(a));
                            const ib = currentWordBlocks.findIndex(x => getBlockKey(x) === getBlockKey(b));
                            return ia - ib;
                        });

                        const firstBlock = sortedSel[0];
                        const lastBlock = sortedSel[sortedSel.length - 1];

                        const firstRect = getBlockRectOnScreen(firstBlock, imageSize, { width: photo.width, height: photo.height }, orientation);
                        const lastRect = getBlockRectOnScreen(lastBlock, imageSize, { width: photo.width, height: photo.height }, orientation);

                        if (firstRect && lastRect) {
                            const leftHandleX = firstRect.left - 2;
                            const leftHandleY = firstRect.top + firstRect.height / 2;

                            const rightHandleX = lastRect.left + lastRect.width + 1;
                            const rightHandleY = lastRect.top + lastRect.height / 2;

                            const distToLeft = Math.hypot(locationX - leftHandleX, locationY - leftHandleY);
                            const distToRight = Math.hypot(locationX - rightHandleX, locationY - rightHandleY);

                            const TOUCH_THRESHOLD = 45; // Rayon de détection tactile généreux (45px) pour une préhension parfaite
                            if (distToLeft < TOUCH_THRESHOLD || distToRight < TOUCH_THRESHOLD) {
                                if (distToLeft <= distToRight) {
                                    activeHandleRef.current = 'left';
                                } else {
                                    activeHandleRef.current = 'right';
                                }
                                handleFirstBlockIndexRef.current = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(firstBlock));
                                handleLastBlockIndexRef.current = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(lastBlock));
                                return; // On bypass le clic classique pour se concentrer sur le glissement
                            }
                        }
                    }

                    // 2. Clic classique sur un mot si on ne touche pas une poignée
                    const tappedBlocks = getBlocksNearPoint(locationX, locationY);
                    if (tappedBlocks.length > 0) {
                        const tappedBlock = tappedBlocks[0];
                        const tappedKey = getBlockKey(tappedBlock);

                        if (currentSelection.length === 0) {
                            setSelectedBlocks([tappedBlock]);
                        } else {
                            const idxTapped = currentWordBlocks.findIndex(b => getBlockKey(b) === tappedKey);
                            const sortedSel = [...currentSelection].sort((a, b) => {
                                const ia = currentWordBlocks.findIndex(x => getBlockKey(x) === getBlockKey(a));
                                const ib = currentWordBlocks.findIndex(x => getBlockKey(x) === getBlockKey(b));
                                return ia - ib;
                            });

                            const idxFirst = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(sortedSel[0]));
                            const idxLast = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(sortedSel[sortedSel.length - 1]));

                            if (idxTapped < idxFirst) {
                                const range = currentWordBlocks.slice(idxTapped, idxLast + 1);
                                setSelectedBlocks(range);
                            } else if (idxTapped > idxLast) {
                                const range = currentWordBlocks.slice(idxFirst, idxTapped + 1);
                                setSelectedBlocks(range);
                            } else {
                                const distToStart = idxTapped - idxFirst;
                                const distToEnd = idxLast - idxTapped;
                                if (distToStart < distToEnd) {
                                    const range = currentWordBlocks.slice(idxTapped, idxLast + 1);
                                    setSelectedBlocks(range);
                                } else {
                                    const range = currentWordBlocks.slice(idxFirst, idxTapped + 1);
                                    setSelectedBlocks(range);
                                }
                            }
                        }
                    }
                    return;
                }

                // Mode Surligneur standard (Drag)
                lastTouchRef.current = { x: locationX, y: locationY };
                initialYRef.current = locationY;

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

                const currentMode = selectionModeRef.current;

                // Mode Poignées (Native Selection) : Déplacement continu de la poignée sélectionnée
                if (currentMode === 'native' && activeHandleRef.current !== null) {
                    const { wordBlocks: currentWordBlocks } = imageInfoRef.current;
                    const draggedBlocks = getBlocksNearPoint(locationX, locationY, 20); // Tolérance de 20px pour rester fluide
                    if (draggedBlocks.length > 0) {
                        const draggedBlock = draggedBlocks[0];
                        const idxTapped = currentWordBlocks.findIndex(b => getBlockKey(b) === getBlockKey(draggedBlock));

                        if (activeHandleRef.current === 'left') {
                            const idxLast = handleLastBlockIndexRef.current;
                            if (idxLast !== null && idxTapped !== -1 && idxTapped <= idxLast) {
                                const range = currentWordBlocks.slice(idxTapped, idxLast + 1);
                                setSelectedBlocks(range);
                                handleFirstBlockIndexRef.current = idxTapped; // Enregistre la nouvelle position de départ
                            }
                        } else if (activeHandleRef.current === 'right') {
                            const idxFirst = handleFirstBlockIndexRef.current;
                            if (idxFirst !== null && idxTapped !== -1 && idxTapped >= idxFirst) {
                                const range = currentWordBlocks.slice(idxFirst, idxTapped + 1);
                                setSelectedBlocks(range);
                                handleLastBlockIndexRef.current = idxTapped; // Enregistre la nouvelle position de fin
                            }
                        }
                    }
                    return;
                }

                if (currentMode !== 'drag') return; // Ne réagit au glissé continu qu'en mode surligneur

                // Anti-derapage : si le glissement vertical est minime, on le contraint sur la ligne de départ
                let activeY = locationY;
                if (initialYRef.current !== null) {
                    const diffY = Math.abs(locationY - initialYRef.current);
                    if (diffY < 18) { // Tolérance de 18 pixels avant de déverrouiller la ligne
                        activeY = initialYRef.current;
                    } else {
                        // Changement de ligne intentionnel : on met à jour la référence Y de la nouvelle ligne
                        initialYRef.current = locationY;
                    }
                }

                const currentPoint = { x: locationX, y: activeY };
                const lastPoint = lastTouchRef.current;
                const points = lastPoint ? sampleLinePoints(lastPoint, currentPoint) : [currentPoint];
                applyHighlightStroke(points);
                lastTouchRef.current = currentPoint;
            },
            onPanResponderRelease: () => {
                lastTouchRef.current = null;
                initialYRef.current = null;
                activeHandleRef.current = null;
                handleFirstBlockIndexRef.current = null;
                handleLastBlockIndexRef.current = null;
            },
            onPanResponderTerminate: () => {
                lastTouchRef.current = null;
                initialYRef.current = null;
                activeHandleRef.current = null;
                handleFirstBlockIndexRef.current = null;
                handleLastBlockIndexRef.current = null;
            },
        }),
    ).current;

    return { panResponder, getBlockKey };
};
