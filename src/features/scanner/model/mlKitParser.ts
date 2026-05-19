import TextRecognition, { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';

export interface OCRResult {
  elements: TextElement[];
  blocks: TextBlock[];
}

/**
 * Performs MLKit Text Recognition on a local image file
 * and returns both individual words (elements) and paragraphs (blocks).
 */
export const recognizeText = async (path: string): Promise<OCRResult> => {
  const cleanPath = path.startsWith('file://') ? path : `file://${path}`;
  try {
    const result = await TextRecognition.recognize(cleanPath);
    if (!result) return { elements: [], blocks: [] };

    console.log('\n===== STRUCTURE DES BLOCS DETECTES PAR MLKIT =====');
    const blocks = result.blocks || [];
    blocks.forEach((block, idx) => {
      console.log(`Bloc ${idx} : "${block.text.substring(0, 50).replace(/\n/g, ' ')}..."`);
      if (block.frame) {
        console.log(`   -> Position : left=${block.frame.left}, top=${block.frame.top}, width=${block.frame.width}, height=${block.frame.height}`);
      } else {
        console.log('   -> Position : undefined');
      }
    });
    console.log('==================================================\n');

    const elements = blocks.flatMap(block => 
      (block.lines || []).flatMap(line => line.elements || [])
    );

    return { elements, blocks };
  } catch (error) {
    console.error('[mlKitParser] MLKit recognition failed:', error);
    return { elements: [], blocks: [] };
  }
};

/**
 * Performs MLKit Text Recognition on a local image file
 * and returns a flat array of words (TextElement) directly.
 * 
 * @param path Local image path
 * @returns Promise resolving to an array of TextElement
 */
export const recognizeAndExtractElements = async (path: string): Promise<TextElement[]> => {
  const result = await recognizeText(path);
  return result.elements;
};
