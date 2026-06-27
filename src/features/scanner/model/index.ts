// Scanner types and interfaces
export {
  CaptureResult, IScanner, OnCodeScannedCallback,
  OnTextRecognizedCallback, ScannerOptions,
  ScannerState
} from './IScanner';

// Scanner implementations
export {
  VisionCameraScanner,
  useVisionCameraScanner
} from './VisionCameraScanner';

// Mock scanner for testing
export {
  MockScanner,
  createMockScanner
} from './MockScanner';

// Other scanner utilities
export { recognizeText } from './mlKitParser';
export * from './textReconstructor';
export { extractIsbn } from '@/src/shared/lib/validation/isbn';
export { useLiveOCR } from './useLiveOCR';

// OCR Processor (logique métier)
export {
  ImageDisplayInfo, OcrProcessor,
  WordData
} from './ocrProcessor';

// Scan State Management
export {
  ScanStateResult,
  SelectionRange, UseScanStateProps, useScanState
} from './useScanState';

// Scan Interactions (UI)
export {
  ScanInteractionsResult, UseScanInteractionsProps, useScanInteractions
} from './useScanInteractions';

// Scan Controller (Main hook for ScanScreen)
export {
  ScanControllerActions,
  ScanControllerResult, ScanControllerState, UseScanControllerProps, useScanController
} from './useScanController';
