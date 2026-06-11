import {
  calculateTextGeometry,
  getPhotoOrientation,
  rotateFrameToUpright
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
