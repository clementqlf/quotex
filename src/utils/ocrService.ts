typescript
// Service OCR pour extraire le texte des images
// TODO: Intégrer react-native-text-recognition ou Google ML Kit

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function extractTextFromImage(imagePath: string): Promise<OCRResult> {
  // Placeholder - À implémenter avec react-native-text-recognition
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        text: "The only way to do great work is to love what you do.",
        confidence: 0.95,
      });
    }, 2000);
  });
}
