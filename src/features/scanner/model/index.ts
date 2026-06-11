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
export * from './textReconstructor';

// OCR Processor (logique métier)
export {
  OcrProcessor,
  WordData,
  ImageDisplayInfo,
} from './ocrProcessor';

// Scan State Management
export {
  useScanState,
  UseScanStateProps,
  ScanStateResult,
  SelectionRange,
} from './useScanState';

// Scan Interactions (UI)
export {
  useScanInteractions,
  UseScanInteractionsProps,
  ScanInteractionsResult,
} from './useScanInteractions';

// Scan Controller (Main hook for ScanScreen)
export {
  useScanController,
  UseScanControllerProps,
  ScanControllerState,
  ScanControllerActions,
  ScanControllerResult,
} from './useScanController';
