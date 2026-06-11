import {
  reconstructTextFromWords,
  calculateGlobalAngle
} from '../textReconstructor';

describe('textReconstructor', () => {
  describe('calculateGlobalAngle', () => {
    it('should return 0 if all blocks have rotation=0', () => {
      const blocks = [
        { rotation: 0, frame: { left: 0, top: 0, width: 100, height: 20 } },
        { rotation: 0, frame: { left: 0, top: 30, width: 100, height: 20 } }
      ] as any;
      expect(calculateGlobalAngle(blocks)).toBe(0);
    });

    it('should calculate weighted average of rotations', () => {
      const blocks = [
        { rotation: 10, frame: { left: 0, top: 0, width: 100, height: 20 } },
        { rotation: 20, frame: { left: 0, top: 30, width: 50, height: 20 } }
      ] as any;
      expect(calculateGlobalAngle(blocks)).toBeCloseTo(13.33, 0.01);
    });
  });

  describe('reconstructTextFromWords', () => {
    it('should reconstruct text without hyphens', () => {
      const words = [
        { text: 'Bonjour', lineIndex: 0 },
        { text: 'le', lineIndex: 0 },
        { text: 'monde', lineIndex: 0 }
      ];
      expect(reconstructTextFromWords(words)).toBe('Bonjour le monde');
    });

    it('should handle natural hyphens (rendez-vous)', () => {
      const words = [
        { text: 'rendez-', lineIndex: 0 },
        { text: 'vous', lineIndex: 1 }
      ];
      const result = reconstructTextFromWords(words);
      expect(result).toContain('rendez-vous');
      expect(result).not.toContain('rendez vous');
    });

    it('should merge words split by line (non-natural)', () => {
      const words = [
        { text: 'exem-', lineIndex: 0 },
        { text: 'ple', lineIndex: 1 }
      ];
      expect(reconstructTextFromWords(words)).toBe('exemple');
    });

    it('should handle punctuation', () => {
      const words = [
        { text: 'Bonjour', lineIndex: 0 },
        { text: 'monde', lineIndex: 0 },
        { text: '!', lineIndex: 0 }
      ];
      expect(reconstructTextFromWords(words)).toBe('Bonjour monde !');
    });
  });
});
