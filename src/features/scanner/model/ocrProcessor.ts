import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { calculateTextRotation } from '@/src/shared/lib/scanGeometry';

// Types étendus pour les éléments ML Kit avec les propriétés réelles
interface MLKitTextElement extends TextElement {
  text: string;
  frame: { left: number; top: number; width: number; height: number };
  rect?: { left: number; top: number; width: number; height: number };
}

interface MLKitTextBlock extends TextBlock {
  elements: MLKitTextElement[];
}

interface MLKitLine {
  elements: MLKitTextElement[];
  frame: { left: number; top: number; width: number; height: number };
  rect?: { left: number; top: number; width: number; height: number };
}

/**
 * Données d'un mot après traitement OCR
 */
export interface WordData {
  index: number;
  text: string;
  originalFrame: { left: number; top: number; width: number; height: number };
  scaledFrame: { left: number; top: number; width: number; height: number };
  centerX: number;
  centerY: number;
  rotation: number;
  lineIndex: number;
}

/**
 * Informations sur l'image pour le calcul des positions
 */
export interface ImageDisplayInfo {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
}

/**
 * Processeur OCR - Contient la logique métier pure pour le traitement des résultats OCR
 * Séparé de l'UI pour respecter Clean Architecture
 */
export class OcrProcessor {
  /**
   * Traite les éléments OCR et les transforme en WordData
   * Cette méthode contient la logique de grouping par lignes, calcul des positions, etc.
   */
  static processOcrElements(
    ocrElements: TextElement[],
    imageDisplayInfo: ImageDisplayInfo,
    ocrBlocks?: TextBlock[]
  ): WordData[] {
    if (!ocrElements || ocrElements.length === 0 || imageDisplayInfo.scale === 1) {
      return [];
    }

    // Cast to our extended types for better type safety
    const elements = ocrElements as unknown as MLKitTextElement[];
    const blocks = ocrBlocks as unknown as MLKitTextBlock[];
    let sortedElements: MLKitTextElement[] = [];

    if (blocks && blocks.length > 0) {
      // 1. Group words using ML Kit's native line segmentation to guarantee correct grouping
      interface LineInfo {
        line: MLKitLine;
        centerY: number;
        left: number;
      }
      const linesInfo: LineInfo[] = [];

      for (const block of blocks) {
        for (const line of (block as unknown as { lines: MLKitLine[] }).lines) {
          const frame = line.frame || line.rect || { left: 0, top: 0, width: 0, height: 0 };
          const centerY = frame.top + frame.height / 2;
          linesInfo.push({
            line,
            centerY,
            left: frame.left,
          });
        }
      }

      // 2. Sort the lines from top to bottom
      linesInfo.sort((a, b) => {
        if (Math.abs(a.centerY - b.centerY) > 1) {
          return a.centerY - b.centerY;
        }
        return a.left - b.left;
      });

      // 3. Build a flattened array of all words, sorted properly
      for (const lineInfo of linesInfo) {
        const lineElements = lineInfo.line.elements || [];
        // Sort words left-to-right within each line
        const sortedLineWords = [...lineElements].sort((a, b) => {
          const frameA = a.frame || a.rect || { left: 0 };
          const frameB = b.frame || b.rect || { left: 0 };
          return frameA.left - frameB.left;
        });
        sortedElements = [...sortedElements, ...sortedLineWords];
      }
    } else {
      // Fallback: group by Y position if no blocks available
      sortedElements = [...elements].sort((a, b) => {
        const frameA = a.frame || a.rect || { top: 0, left: 0 };
        const frameB = b.frame || b.rect || { top: 0, left: 0 };
        if (Math.abs(frameA.top - frameB.top) > 1) {
          return frameA.top - frameB.top;
        }
        return frameA.left - frameB.left;
      });
    }

    // 4. Map to WordData
    const words: WordData[] = [];
    for (let i = 0; i < sortedElements.length; i++) {
      const el = sortedElements[i];
      const frame = el.frame || el.rect || { left: 0, top: 0, width: 0, height: 0 };
      const text = el.text || '';

      // Skip empty text
      if (!text.trim()) continue;

      // Calculate rotation using nearby words for context
      const rotation = 0; // TODO: Calculate rotation properly

      // Line index based on Y position grouping
      const lineIndex = this.findLineIndex(words, frame.top + frame.height / 2);

      const scaledFrame = {
        left: frame.left * imageDisplayInfo.scale + imageDisplayInfo.offsetX,
        top: frame.top * imageDisplayInfo.scale + imageDisplayInfo.offsetY,
        width: frame.width * imageDisplayInfo.scale,
        height: frame.height * imageDisplayInfo.scale,
      };

      words.push({
        index: i,
        text: text.trim(),
        originalFrame: { ...frame },
        scaledFrame,
        centerX: scaledFrame.left + scaledFrame.width / 2,
        centerY: scaledFrame.top + scaledFrame.height / 2,
        rotation,
        lineIndex,
      });
    }

    return words;
  }

  /**
   * Trouve l'index de ligne basé sur la position Y
   */
  private static findLineIndex(words: WordData[], centerY: number): number {
    if (words.length === 0) return 0;

    for (let i = words.length - 1; i >= 0; i--) {
      if (Math.abs(words[i].centerY - centerY) < 20) {
        return words[i].lineIndex;
      }
    }
    return words[words.length - 1].lineIndex + 1;
  }

  /**
   * Reconstruit le texte à partir des WordData
   */
  static reconstructText(words: WordData[]): string {
    // Grouper par lineIndex
    const linesMap = new Map<number, WordData[]>();
    for (const word of words) {
      if (!linesMap.has(word.lineIndex)) {
        linesMap.set(word.lineIndex, []);
      }
      linesMap.get(word.lineIndex)!.push(word);
    }

    // Trier les lignes par lineIndex
    const sortedLineIndices = [...linesMap.keys()].sort((a, b) => a - b);

    // Construire le texte
    const parts: string[] = [];
    for (const lineIndex of sortedLineIndices) {
      const lineWords = linesMap.get(lineIndex)!;
      // Trier les mots dans la ligne par position X
      const sortedWords = [...lineWords].sort((a, b) => a.centerX - b.centerX);
      const lineText = sortedWords.map(w => w.text).join(' ');
      parts.push(lineText);
    }

    return parts.join('\n');
  }

  /**
   * Calcule la taille de l'image pour l'affichage
   */
  static calculateImageDisplayInfo(
    viewportSize: { width: number; height: number },
    normalizedSize: { width: number; height: number } | null,
    photo: { width: number; height: number }
  ): ImageDisplayInfo {
    const photoW = normalizedSize?.width || photo.width || 1;
    const photoH = normalizedSize?.height || photo.height || 1;

    if (viewportSize.width === 0 || viewportSize.height === 0 || !photoW || !photoH) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 1 };
    }

    // Always fill the full screen width. Height is proportional to the image aspect ratio.
    const displayedWidth = viewportSize.width;
    const imageAspectRatio = photoW / photoH;
    const displayedHeight = displayedWidth / imageAspectRatio;
    const scale = displayedWidth / photoW;

    return { width: displayedWidth, height: displayedHeight, offsetX: 0, offsetY: 0, scale };
  }
}
