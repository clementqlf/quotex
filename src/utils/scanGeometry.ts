import { PhotoFile } from 'react-native-vision-camera';

export type MLKitText = {
    text: string;
    frame?: { left: number; top: number; width: number; height: number };
    cornerPoints?: Array<{ x: number; y: number }>;
    rotation?: number;
};

export const PATH_SAMPLE_STEP = 1;

export const calculateTextRotation = (cornerPoints: Array<{ x: number; y: number }>): number => {
    if (!cornerPoints || cornerPoints.length < 4) return 0;

    let minVerticalVariance = Infinity;
    let bestAngle = 0;

    for (let i = 0; i < 4; i += 1) {
        const p1 = cornerPoints[i];
        const p2 = cornerPoints[(i + 1) % 4];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const verticalVariance = Math.abs(dy);

        if (verticalVariance < minVerticalVariance) {
            minVerticalVariance = verticalVariance;
            const angleRad = Math.atan2(dy, dx);
            let angleDeg = (angleRad * 180) / Math.PI;
            while (angleDeg > 180) angleDeg -= 360;
            while (angleDeg < -180) angleDeg += 360;
            if (Math.abs(angleDeg) > 85 && Math.abs(angleDeg) < 95) {
                bestAngle = 0;
            } else {
                bestAngle = angleDeg;
            }
        }
    }

    return bestAngle;
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
    if (!photo) return 1;
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
            left: top,
            top: baseWidth - (left + width),
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
        left: baseHeight - (top + height),
        top: left,
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
    if (!block.frame || imageSize.width === 0) return null;

    const isNormalized =
        block.frame.left <= 1 && block.frame.top <= 1 &&
        block.frame.width <= 1 && block.frame.height <= 1;

    const { width: photoW, height: photoH } = photoDimensions;
    const baseWidth = isNormalized ? 1 : photoW;
    const baseHeight = isNormalized ? 1 : photoH;

    const rotatedFrame = rotateFrameToUpright(
        {
            left: block.frame.left ?? 0,
            top: block.frame.top ?? 0,
            width: block.frame.width ?? 0,
            height: block.frame.height ?? 0,
        },
        orientation,
        baseWidth,
        baseHeight,
    );

    const orientedBaseWidth = orientation === 90 || orientation === 270 ? baseHeight : baseWidth;
    const orientedBaseHeight = orientation === 90 || orientation === 270 ? baseWidth : baseHeight;

    const scaleX = imageSize.width / orientedBaseWidth;
    const scaleY = imageSize.height / orientedBaseHeight;

    const left = (orientation === 90 || orientation === 270)
        ? ((orientedBaseWidth - (rotatedFrame.left + rotatedFrame.width)) * scaleX) + imageSize.offsetX
        : (rotatedFrame.left * scaleX) + imageSize.offsetX;

    const top = (orientation === 90 || orientation === 270)
        ? ((orientedBaseHeight - (rotatedFrame.top + rotatedFrame.height)) * scaleY) + imageSize.offsetY
        : (rotatedFrame.top * scaleY) + imageSize.offsetY;

    const width = rotatedFrame.width * scaleX;
    const height = rotatedFrame.height * scaleY;

    return {
        left,
        top,
        width,
        height,
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
