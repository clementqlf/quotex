import { PhotoFile } from 'react-native-vision-camera';
import { getBlockRectOnScreen, getPhotoOrientation, ImageSize, MLKitText } from '@/src/shared/lib/scanGeometry';

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

export const calculateGlobalAngle = (wordBlocks: MLKitText[]): number => {
    const angleWeights = wordBlocks
        .filter(b => b.rotation !== undefined && b.rotation !== 0 && b.frame !== undefined)
        .map(b => ({
            angle: b.rotation!,
            weight: b.frame!.width
        }));

    const totalWeight = angleWeights.reduce((sum, item) => sum + item.weight, 0);
    return totalWeight > 0
        ? angleWeights.reduce((sum, item) => sum + item.angle * item.weight, 0) / totalWeight
        : 0;
};

export const reconstructTextFromBlocks = (
    selectedBlocks: MLKitText[],
    imageSize: ImageSize,
    photo: PhotoFile | null,
    globalAngle: number
) => {
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
};
