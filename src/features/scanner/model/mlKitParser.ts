import TextRecognition, { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Normalizes image orientation (applies EXIF rotation into actual pixels),
 * then runs ML Kit text recognition.
 *
 * Why normalization is needed:
 * - iOS stores camera photos as landscape JPEG + EXIF Orientation=6
 * - react-native <Image> auto-applies EXIF → displays correctly
 * - BUT @react-native-ml-kit reads the raw CGImage (ignores EXIF) → landscape coords
 * - We fix this by baking the EXIF rotation into a new JPEG before OCR
 */
export const recognizeText = async (imagePath: string): Promise<{
  elements: TextElement[];
  blocks: TextBlock[];
  normalizedSize: { width: number; height: number } | null;
  normalizedUri: string;
}> => {
  try {
    // Normalize orientation: ImageManipulator reads EXIF and applies it to pixels,
    // so the output file has the correct portrait pixels with Orientation=1 (no rotation).
    const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
    const normalized = await ImageManipulator.manipulateAsync(
      uri,
      [], // no transform operations needed — just saving re-encodes with EXIF baked in
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );

    const result = await TextRecognition.recognize(normalized.uri);
    
    const elements: TextElement[] = [];
    const blocks: TextBlock[] = result.blocks || [];
    
    // Extract all individual text elements (words) from the blocks
    for (const block of blocks) {
      for (const line of block.lines) {
        for (const element of line.elements) {
          elements.push(element);
        }
      }
    }
    
    // Return the normalized dimensions so the workflow can use the correct portrait scale
    const normalizedSize = { width: normalized.width, height: normalized.height };
    
    return { elements, blocks, normalizedSize, normalizedUri: normalized.uri };
  } catch (error) {
    console.error("Text recognition error:", error);
    throw error;
  }
};


