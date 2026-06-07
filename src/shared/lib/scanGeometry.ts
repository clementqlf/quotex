import { PhotoFile } from 'react-native-vision-camera';

export type MLKitText = {
    text: string;
    frame?: { left: number; top: number; width: number; height: number };
    cornerPoints?: Array<{ x: number; y: number }>;
    rotation?: number;
    blockId?: string;
    parentBlockFrame?: { left: number; top: number; width: number; height: number };
    screenRect?: { left: number; top: number; width: number; height: number; rotation?: number };
    parentScreenRect?: { left: number; top: number; width: number; height: number; rotation?: number };
    columnMinLeft?: number;
    columnMaxRight?: number;
    columnId?: string;
};

export const PATH_SAMPLE_STEP = 1;

export interface TextGeometry {
    rotation: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

export const calculateTextGeometry = (cornerPoints: ReadonlyArray<{ x: number; y: number }>): TextGeometry | null => {
    if (!cornerPoints || cornerPoints.length < 4) return null;

    const p0 = cornerPoints[0];
    const p1 = cornerPoints[1];
    const p2 = cornerPoints[2];
    const p3 = cornerPoints[3];

    // Compute the 4 edge vectors and their lengths
    const edges = [
        { dx: p1.x - p0.x, dy: p1.y - p0.y }, // top edge
        { dx: p2.x - p1.x, dy: p2.y - p1.y }, // right edge
        { dx: p3.x - p2.x, dy: p3.y - p2.y }, // bottom edge
        { dx: p0.x - p3.x, dy: p0.y - p3.y }, // left edge
    ];
    const lengths = edges.map(e => Math.sqrt(e.dx * e.dx + e.dy * e.dy));

    // Width = longest edge, height = adjacent (shorter) edge
    const isEdge0Longer = lengths[0] >= lengths[1];
    const widthEdge = isEdge0Longer ? edges[0] : edges[1];
    const width = isEdge0Longer ? lengths[0] : lengths[1];
    const height = isEdge0Longer ? lengths[1] : lengths[0];

    // Rotation = angle of the width edge relative to horizontal
    let rotation = (Math.atan2(widthEdge.dy, widthEdge.dx) * 180) / Math.PI;

    // Normalize to [-90, 90] to avoid flips
    while (rotation > 90) rotation -= 180;
    while (rotation < -90) rotation += 180;

    // For very narrow chars (like '!'), suppress rotation noise
    if (width < height * 1.5) {
        rotation = 0;
    }

    const centerX = (p0.x + p1.x + p2.x + p3.x) / 4;
    const centerY = (p0.y + p1.y + p2.y + p3.y) / 4;

    return { rotation, width, height, centerX, centerY };
};

export const sampleLinePoints = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const steps = Math.max(1, Math.floor(distance / PATH_SAMPLE_STEP));

    const points = [] as { x: number; y: number }[];
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        points.push({ x: from.x + dx * t, y: from.y + dy * t });
    }
    return points;
};

export const getPhotoOrientation = (photo: PhotoFile | null): number => {
    if (!photo) return 0;

    // Support direct string/number property from Vision Camera v3/v4
    const directOrientation = (photo as any)?.orientation;
    if (directOrientation !== undefined) {
        if (directOrientation === 'portrait') return 0;
        if (directOrientation === 'landscape-right') return 90;
        if (directOrientation === 'portrait-upside-down') return 180;
        if (directOrientation === 'landscape-left') return 270;
        if (typeof directOrientation === 'number') return directOrientation;
    }

    const rawOrientation =
        (photo as any)?.metadata?.Orientation ||
        (photo as any)?.metadata?.orientation ||
        (photo as any)?.metadata?.Exif?.Orientation ||
        1;

    switch (rawOrientation) {
        case 3:
            return 180;
        case 6:
            return 90;
        case 8:
            return 270;
        default:
            return 0;
    }
};

export const rotateFrameToUpright = (
    frame: NonNullable<MLKitText['frame']>,
    orientation: number,
    baseWidth: number,
    baseHeight: number,
) => {
    if (orientation === 0) return frame;

    const { left, top, width, height } = frame;

    if (orientation === 90) {
        return {
            left: baseHeight - (top + height),
            top: left,
            width: height,
            height: width,
        };
    }

    if (orientation === 180) {
        return {
            left: baseWidth - (left + width),
            top: baseHeight - (top + height),
            width,
            height,
        };
    }

    return {
        left: top,
        top: baseWidth - (left + width),
        width: height,
        height: width,
    };
};

export type ImageSize = {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
};

export const getBlockRectOnScreen = (
    block: MLKitText,
    imageSize: ImageSize,
    photoDimensions: { width: number; height: number },
    orientation: number
) => {
    if (!block.frame || imageSize.width === 0 || photoDimensions.width === 0) return null;

    const isNormalized =
        block.frame.left <= 1 && block.frame.top <= 1 &&
        block.frame.width <= 1 && block.frame.height <= 1;

    const { width: photoW, height: photoH } = photoDimensions;
    const baseWidth = isNormalized ? 1 : photoW;
    const baseHeight = isNormalized ? 1 : photoH;

    let width = block.frame.width;
    let height = block.frame.height;
    let centerX = block.frame.left + block.frame.width / 2;
    let centerY = block.frame.top + block.frame.height / 2;

    // Si on a les cornerPoints, on calcule la largeur, la hauteur et le centre réels
    if (block.cornerPoints && block.cornerPoints.length >= 4) {
        const geom = calculateTextGeometry(block.cornerPoints);
        if (geom) {
            width = geom.width;
            height = geom.height;
            centerX = geom.centerX;
            centerY = geom.centerY;
        }
    }

    // Rotation du centre vers l'orientation upright
    let rotatedCenterX = centerX;
    let rotatedCenterY = centerY;
    let rotatedWidth = width;
    let rotatedHeight = height;

    if (orientation === 90) {
        rotatedCenterX = baseHeight - centerY;
        rotatedCenterY = centerX;
        rotatedWidth = height;
        rotatedHeight = width;
    } else if (orientation === 180) {
        rotatedCenterX = baseWidth - centerX;
        rotatedCenterY = baseHeight - centerY;
    } else if (orientation === 270) {
        rotatedCenterX = centerY;
        rotatedCenterY = baseWidth - centerX;
        rotatedWidth = height;
        rotatedHeight = width;
    }

    const orientedBaseWidth = orientation === 90 || orientation === 270 ? baseHeight : baseWidth;
    const orientedBaseHeight = orientation === 90 || orientation === 270 ? baseWidth : baseHeight;

    const scaleX = imageSize.width / orientedBaseWidth;
    const scaleY = imageSize.height / orientedBaseHeight;

    const screenCenterX = rotatedCenterX * scaleX + imageSize.offsetX;
    const screenCenterY = rotatedCenterY * scaleY + imageSize.offsetY;
    const screenWidth = rotatedWidth * scaleX;
    const screenHeight = rotatedHeight * scaleY;

    const left = screenCenterX - screenWidth / 2;
    const top = screenCenterY - screenHeight / 2;

    return {
        left,
        top,
        width: screenWidth,
        height: screenHeight,
        rotation: block.rotation,
    };
};

export const isPointInBlock = (
    x: number,
    y: number,
    block: MLKitText,
    imageSize: ImageSize,
    photoDimensions: { width: number; height: number },
    orientation: number,
    padding = 0
): boolean => {
    const rect = getBlockRectOnScreen(block, imageSize, photoDimensions, orientation);
    if (!rect) return false;

    if (!rect.rotation || rect.rotation === 0) {
        return (
            x >= rect.left - padding &&
            x <= rect.left + rect.width + padding &&
            y >= rect.top - padding &&
            y <= rect.top + rect.height + padding
        );
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const angleRad = (rect.rotation * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const localX = dx * cosA + dy * sinA;
    const localY = -dx * sinA + dy * cosA;
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;

    return (
        localX >= -halfWidth - padding &&
        localX <= halfWidth + padding &&
        localY >= -halfHeight - padding &&
        localY <= halfHeight + padding
    );
};
