// scanGeometry.ts
import { PhotoFile } from 'react-native-vision-camera';

export interface ImageSize {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
}

export interface Size {
    width: number;
    height: number;
}

// Récupère l'orientation si Vision Camera l'a fournie
export const getPhotoOrientation = (photo: PhotoFile | null): number => {
    // Dans la plupart des cas récents, Vision Camera gère l'orientation,
    // on par défaut à 0 (paysage/portrait géré par le framework)
    return 0;
};

export const getBlockRectOnScreen = (
    block: { 
        frame?: { left: number; top: number; width: number; height: number };
        cornerPoints?: readonly { x: number, y: number }[];
    },
    imageScreenSize: ImageSize,
    rawPhotoSize: Size,
    orientation: number = 0
) => {
    if (!block.frame || imageScreenSize.width === 0 || rawPhotoSize.width === 0) return null;

    // Calcul du ratio de mise à l'échelle (Scale)
    const scaleX = imageScreenSize.width / rawPhotoSize.width;
    const scaleY = imageScreenSize.height / rawPhotoSize.height;

    let width = block.frame.width;
    let height = block.frame.height;
    let centerX = block.frame.left + width / 2;
    let centerY = block.frame.top + height / 2;
    let rotation = 0;

    // Utilisation des cornerPoints pour avoir la taille et l'inclinaison exactes (Tight Bounding Box)
    if (block.cornerPoints && block.cornerPoints.length >= 4) {
        const p0 = block.cornerPoints[0]; // top-left
        const p1 = block.cornerPoints[1]; // top-right
        const p2 = block.cornerPoints[2]; // bottom-right
        const p3 = block.cornerPoints[3]; // bottom-left
        
        const widthTop = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const widthBottom = Math.hypot(p2.x - p3.x, p2.y - p3.y);
        width = (widthTop + widthBottom) / 2;
        
        const heightLeft = Math.hypot(p3.x - p0.x, p3.y - p0.y);
        const heightRight = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        height = (heightLeft + heightRight) / 2;
        
        centerX = (p0.x + p1.x + p2.x + p3.x) / 4;
        centerY = (p0.y + p1.y + p2.y + p3.y) / 4;
        
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        rotation = Math.atan2(dy, dx) * (180 / Math.PI);
    }

    const screenCenterX = (centerX * scaleX) + imageScreenSize.offsetX;
    const screenCenterY = (centerY * scaleY) + imageScreenSize.offsetY;
    const screenWidth = width * scaleX;
    const screenHeight = height * scaleY;

    // On retourne le coin supérieur gauche ainsi que la rotation
    return {
        left: screenCenterX - screenWidth / 2,
        top: screenCenterY - screenHeight / 2,
        width: screenWidth,
        height: screenHeight,
        rotation
    };
};