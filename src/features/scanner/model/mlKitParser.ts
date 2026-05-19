import TextRecognition, { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';

export const recognizeText = async (imagePath: string): Promise<{ elements: TextElement[], blocks: TextBlock[] }> => {
  try {
    const result = await TextRecognition.recognize(imagePath);
    
    const elements: TextElement[] = [];
    const blocks: TextBlock[] = result.blocks || [];
    
    // Extract all individual text elements (words) from the blocks to pass them down to the workflow
    for (const block of blocks) {
      for (const line of block.lines) {
        for (const element of line.elements) {
          elements.push(element);
        }
      }
    }
    
    return { elements, blocks };
  } catch (error) {
    console.error("Text recognition error:", error);
    throw error;
  }
};
