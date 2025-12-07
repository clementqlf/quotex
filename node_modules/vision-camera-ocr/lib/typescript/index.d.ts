import type { Frame } from 'react-native-vision-camera';
declare type BoundingFrame = {
    x: number;
    y: number;
    width: number;
    height: number;
    boundingCenterX: number;
    boundingCenterY: number;
};
declare type Point = {
    x: number;
    y: number;
};
declare type TextElement = {
    text: string;
    frame: BoundingFrame;
    cornerPoints: Point[];
};
declare type TextLine = {
    text: string;
    elements: TextElement[];
    frame: BoundingFrame;
    recognizedLanguages: string[];
    cornerPoints: Point[];
};
declare type TextBlock = {
    text: string;
    lines: TextLine[];
    frame: BoundingFrame;
    recognizedLanguages: string[];
    cornerPoints: Point[];
};
declare type Text = {
    text: string;
    blocks: TextBlock[];
};
export declare type OCRFrame = {
    result: Text;
};
/**
 * Scans OCR.
 */
export declare function scanOCR(frame: Frame): OCRFrame;
export {};
