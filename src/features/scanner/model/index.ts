// Scanner types and interfaces
export {
  IScanner,
  CaptureResult,
  ScannerOptions,
  ScannerState,
  OnCodeScannedCallback,
  OnTextRecognizedCallback,
} from './IScanner';

// Scanner implementations
export {
  VisionCameraScanner,
  useVisionCameraScanner,
} from './VisionCameraScanner';

// Mock scanner for testing
export {
  MockScanner,
  createMockScanner,
} from './MockScanner';

// Other scanner utilities
export { useLiveOCR } from './useLiveOCR';
export { extractIsbn } from './useIsbnScanner';
export { recognizeText } from './mlKitParser';
export { default as textReconstructor } from './textReconstructor';
