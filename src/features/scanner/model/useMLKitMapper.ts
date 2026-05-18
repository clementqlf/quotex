import { useMemo } from 'react';
import { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { PhotoFile } from 'react-native-vision-camera';
import {
    calculateTextRotation,
    getBlockRectOnScreen,
    getPhotoOrientation,
    ImageSize,
    MLKitText,
} from '@/src/shared/lib/scanGeometry';
import { SmartTextSelection } from './SmartSelectionAlgorithm';

export const useMLKitMapper = (
    photo: PhotoFile | null,
    ocrResult: TextRecognitionResult | null,
    imageSize: ImageSize
): MLKitText[] => {
    return useMemo<MLKitText[]>(() => {
        if (!ocrResult) return [];
        const orientation = getPhotoOrientation(photo);

        const computeBoundingBox = (elements: any[]) => {
            let minLeft = Infinity;
            let minTop = Infinity;
            let maxRight = -Infinity;
            let maxBottom = -Infinity;

            elements.forEach(el => {
                const f = el.frame;
                if (!f) return;
                if (f.left < minLeft) minLeft = f.left;
                if (f.top < minTop) minTop = f.top;
                if (f.left + f.width > maxRight) maxRight = f.left + f.width;
                if (f.top + f.height > maxBottom) maxBottom = f.top + f.height;
            });

            return {
                left: minLeft,
                top: minTop,
                width: maxRight - minLeft,
                height: maxBottom - minTop
            };
        };

        let globalSegmentIdx = 0;
        const allSegments: Array<{
            id: string;
            elements: Array<{
                block: MLKitText;
                rect: { left: number; top: number; width: number; height: number };
            }>;
            rect: { left: number; top: number; width: number; height: number };
        }> = [];

        ocrResult.blocks.forEach(block => {
            block.lines?.forEach(line => {
                if (!line.elements || line.elements.length === 0) return;

                // Calcule les coordonnées upright à l'écran pour tous les éléments de la ligne
                const positionedElements = line.elements
                    .filter(el => el.frame)
                    .map(el => {
                        const rect = photo
                            ? getBlockRectOnScreen(
                                { text: el.text, frame: el.frame },
                                imageSize,
                                { width: photo.width, height: photo.height },
                                orientation
                            )
                            : null;
                        return { element: el, rect: rect || el.frame! };
                    })
                    .sort((a, b) => a.rect.left - b.rect.left);

                if (positionedElements.length === 0) return;

                // Groupement des mots en segments horizontaux contigus
                const segments: Array<{
                    elements: typeof line.elements;
                    frame: { left: number; top: number; width: number; height: number };
                }> = [];

                let currentSegment: typeof positionedElements = [];

                positionedElements.forEach((item, idx) => {
                    const elFrame = item.rect;
                    if (idx === 0) {
                        currentSegment.push(item);
                    } else {
                        const prevItem = currentSegment[currentSegment.length - 1];
                        const prevFrame = prevItem.rect;

                        const gap = elFrame.left - (prevFrame.left + prevFrame.width);

                        // Seuil de gouttière dynamique basé sur la taille de la police (hauteur du mot) :
                        // Une séparation de colonne dépasse toujours le seuil de 55% de la hauteur du mot,
                        // tandis qu'un espace normal reste sous ce seuil (même fortement justifié).
                        const fontHeight = Math.min(prevFrame.height, elFrame.height);
                        const dynamicThreshold = Math.max(8, fontHeight * 0.55);
                        const shouldSplit = gap > dynamicThreshold;
 
                        if (gap > 5) {
                            console.log(`[SegmentSplit] "${prevItem.element.text}" and "${item.element.text}" -> gap: ${gap.toFixed(1)}px (threshold: ${dynamicThreshold.toFixed(1)}px) -> split: ${shouldSplit}`);
                        }

                        if (shouldSplit) {
                            // Scission : on ferme le segment en cours et on en commence un nouveau
                            const rawElements = currentSegment.map(x => x.element);
                            segments.push({
                                elements: rawElements,
                                frame: computeBoundingBox(rawElements)
                            });
                            currentSegment = [item];
                        } else {
                            currentSegment.push(item);
                        }
                    }
                });

                if (currentSegment.length > 0) {
                    const rawElements = currentSegment.map(x => x.element);
                    segments.push({
                        elements: rawElements,
                        frame: computeBoundingBox(rawElements)
                    });
                }

                // Ajout des segments à la liste globale pour tri en colonnes
                segments.forEach(seg => {
                    const segmentId = `seg-${globalSegmentIdx++}`;

                    const parentScreenRect = photo
                        ? getBlockRectOnScreen(
                            { text: "", frame: seg.frame },
                            imageSize,
                            { width: photo.width, height: photo.height },
                            orientation
                        )
                        : null;

                    if (!parentScreenRect) return;

                    const segmentElements = seg.elements.map(element => {
                        const cornerPoints = (element as any)?.cornerPoints;
                        const rotation = cornerPoints ? calculateTextRotation(cornerPoints) : undefined;

                        const screenRect = photo
                            ? getBlockRectOnScreen(
                                { text: element.text, frame: element.frame! },
                                imageSize,
                                { width: photo.width, height: photo.height },
                                orientation
                            )
                            : undefined;

                        return {
                            block: {
                                text: element.text,
                                frame: element.frame!,
                                cornerPoints,
                                rotation,
                                blockId: segmentId,
                                parentBlockFrame: seg.frame,
                                screenRect: screenRect || undefined,
                                parentScreenRect: parentScreenRect || undefined,
                            },
                            rect: screenRect || element.frame!
                        };
                    });

                    allSegments.push({
                        id: segmentId,
                        elements: segmentElements,
                        rect: parentScreenRect
                    });
                });
            });
        });

        // --- REGROUPEMENT ET TRI PAR COLONNES NATURELLES DE LECTURE ---
        if (allSegments.length === 0) return [];

        const mappedBlocks = allSegments.map(seg => ({
            id: seg.id,
            text: '',
            rect: { left: seg.rect.left, top: seg.rect.top, right: seg.rect.left + seg.rect.width, bottom: seg.rect.top + seg.rect.height },
            lines: [{
                text: '',
                rect: { left: seg.rect.left, top: seg.rect.top, right: seg.rect.left + seg.rect.width, bottom: seg.rect.top + seg.rect.height },
                elements: seg.elements.map(e => ({
                    text: e.block.text,
                    rect: { left: e.rect.left, top: e.rect.top, right: e.rect.left + e.rect.width, bottom: e.rect.top + e.rect.height },
                    originalBlock: e.block
                }))
            }]
        }));
        const smartSelection = new SmartTextSelection(mappedBlocks);
        const ordered = smartSelection.getOrderedElements();
        return ordered.map((el: any) => ({
            ...el.originalBlock,
            columnId: el.columnId
        } as MLKitText));
    }, [ocrResult, photo, imageSize]);
};
