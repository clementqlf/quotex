import {
  calculateTextGeometry,
  getBlockRectOnScreen,
  getPhotoOrientation,
  isPointInBlock,
  rotateFrameToUpright,
} from '../scanGeometry';

describe('scanGeometry', () => {
  describe('calculateTextGeometry', () => {
    it('should return null if cornerPoints has less than 4 points', () => {
      const result = calculateTextGeometry([{ x: 0, y: 0 }]);
      expect(result).toBeNull();
    });

    it('should calculate geometry for a straight rectangle', () => {
      const cornerPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 }
      ];
      const result = calculateTextGeometry(cornerPoints);
      expect(result).toEqual({
        rotation: 0,
        width: 100,
        height: 50,
        centerX: 50,
        centerY: 25
      });
    });

    it('should detect 90 degree rotation', () => {
      const cornerPoints = [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 0, y: 100 },
        { x: 0, y: 0 }
      ];
      const result = calculateTextGeometry(cornerPoints);
      expect(result?.rotation).toBeCloseTo(90, 0.1);
    });
  });

  describe('getPhotoOrientation', () => {
    it('should return 0 for portrait orientation', () => {
      const photo = { orientation: 'portrait' } as any;
      expect(getPhotoOrientation(photo)).toBe(0);
    });

    it('should return 90 for landscape-right orientation', () => {
      const photo = { orientation: 'landscape-right' } as any;
      expect(getPhotoOrientation(photo)).toBe(90);
    });

    it('should return 0 if no photo', () => {
      expect(getPhotoOrientation(null)).toBe(0);
    });

    it('should read EXIF Orientation=6 from metadata', () => {
      const photo = { metadata: { Orientation: 6 } } as any;
      expect(getPhotoOrientation(photo)).toBe(90);
    });
  });

  describe('rotateFrameToUpright', () => {
    it('should return unchanged frame if orientation=0', () => {
      const frame = { left: 10, top: 20, width: 100, height: 50 };
      const result = rotateFrameToUpright(frame, 0, 800, 600);
      expect(result).toEqual(frame);
    });

    it('should rotate correctly for orientation=90', () => {
      const frame = { left: 100, top: 200, width: 100, height: 50 };
      const result = rotateFrameToUpright(frame, 90, 800, 600);
      expect(result).toEqual({
        left: 600 - (200 + 50),
        top: 100,
        width: 50,
        height: 100
      });
    });
  });
});

describe('getBlockRectOnScreen', () => {
  it('should calculate screen position correctly with normalized coordinates', () => {
    const block = {
      text: 'mock',
      frame: { left: 0.4, top: 0.4, width: 0.2, height: 0.1 },
      cornerPoints: [
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.4 },
        { x: 0.6, y: 0.5 },
        { x: 0.4, y: 0.5 }
      ]
    };
    const imageSize = { width: 800, height: 600, offsetX: 0, offsetY: 0 };
    const photoDimensions = { width: 800, height: 600 };
    
    const result = getBlockRectOnScreen(block, imageSize, photoDimensions, 0);
    expect(result).toBeDefined();
    expect(result!.left).toBeCloseTo(320, 0.1);
    expect(result!.top).toBeCloseTo(240, 0.1);
    expect(result!.width).toBeCloseTo(160, 0.1);
    expect(result!.height).toBeCloseTo(60, 0.1);
  });

  it('should return null if block frame is missing', () => {
    const block = { text: 'mock', cornerPoints: [] } as any;
    const imageSize = { width: 800, height: 600, offsetX: 0, offsetY: 0 };
    const photoDimensions = { width: 800, height: 600 };
    
    const result = getBlockRectOnScreen(block, imageSize, photoDimensions, 0);
    expect(result).toBeNull();
  });

  it('should handle rotation=90 correctly', () => {
    const block = {
      text: 'mock',
      frame: { left: 0.5, top: 0.5, width: 0.2, height: 0.1 },
    } as any;
    const imageSize = { width: 600, height: 800, offsetX: 0, offsetY: 0 };
    const photoDimensions = { width: 800, height: 600 };
    
    const result = getBlockRectOnScreen(block, imageSize, photoDimensions, 90);
    expect(result).toBeDefined();
  });
});

describe('isPointInBlock', () => {
  it('should return true if point is inside block', () => {
    const block = {
      frame: { left: 100, top: 100, width: 100, height: 50 }
    } as any;
    const imageSize = { width: 800, height: 600, offsetX: 0, offsetY: 0 };
    const photoDimensions = { width: 800, height: 600 };
    
    const result = isPointInBlock(150, 125, block, imageSize, photoDimensions, 0);
    expect(result).toBe(true);
  });

  it('should return false if point is outside block', () => {
    const block = {
      frame: { left: 100, top: 100, width: 100, height: 50 }
    } as any;
    const imageSize = { width: 800, height: 600, offsetX: 0, offsetY: 0 };
    const photoDimensions = { width: 800, height: 600 };
    
    const result = isPointInBlock(50, 50, block, imageSize, photoDimensions, 0);
    expect(result).toBe(false);
  });

  it('should return true with padding', () => {
    const block = {
      frame: { left: 100, top: 100, width: 100, height: 50 }
    } as any;
    const imageSize = { width: 800, height: 600, offsetX: 0, offsetY: 0 };
    const photoDimensions = { width: 800, height: 600 };
    
    const result = isPointInBlock(95, 95, block, imageSize, photoDimensions, 0, 5);
    expect(result).toBe(true);
  });
});
