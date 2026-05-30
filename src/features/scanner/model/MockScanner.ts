import { IScanner, CaptureResult, ScannerState, OnCodeScannedCallback, OnTextRecognizedCallback } from './IScanner';

/**
 * Implémentation Mock du scanner pour les tests
 */
export class MockScanner implements IScanner {
  private state: ScannerState = {
    isActive: false,
    hasPermission: true,
    isScanning: false,
    torchEnabled: false,
    zoom: 1,
  };

  private onCodeScannedCallback: OnCodeScannedCallback | null = null;
  private onTextRecognizedCallback: OnTextRecognizedCallback | null = null;
  
  // Données mock
  private mockText: string = '';
  private mockCodes: string[] = [];
  private mockImageUri: string = 'mock://image.jpg';

  async start(): Promise<void> {
    this.state.isActive = true;
    this.state.hasPermission = true;
  }

  async stop(): Promise<void> {
    this.state.isActive = false;
    this.state.isScanning = false;
  }

  async capture(): Promise<CaptureResult> {
    return {
      image: this.mockImageUri,
      text: this.mockText,
      codes: [...this.mockCodes],
    };
  }

  async toggleTorch(enabled: boolean): Promise<void> {
    this.state.torchEnabled = enabled;
  }

  async setZoom(zoom: number): Promise<void> {
    this.state.zoom = zoom;
  }

  onCodeScanned(callback: OnCodeScannedCallback): void {
    this.onCodeScannedCallback = callback;
  }

  onTextRecognized(callback: OnTextRecognizedCallback): void {
    this.onTextRecognizedCallback = callback;
  }

  async requestPermission(): Promise<boolean> {
    this.state.hasPermission = true;
    return true;
  }

  getState(): ScannerState {
    return { ...this.state };
  }

  async cleanup(): Promise<void> {
    this.state.isActive = false;
    this.state.isScanning = false;
    this.onCodeScannedCallback = null;
    this.onTextRecognizedCallback = null;
  }

  // Méthodes spécifiques pour les tests
  setMockText(text: string): void {
    this.mockText = text;
    if (this.onTextRecognizedCallback) {
      this.onTextRecognizedCallback(text);
    }
  }

  setMockCodes(codes: string[]): void {
    this.mockCodes = codes;
    if (this.onCodeScannedCallback && codes.length > 0) {
      this.onCodeScannedCallback(codes[0]);
    }
  }

  setMockImageUri(uri: string): void {
    this.mockImageUri = uri;
  }

  simulateCodeScan(code: string): void {
    if (this.onCodeScannedCallback) {
      this.onCodeScannedCallback(code);
    }
  }

  simulateTextRecognition(text: string): void {
    if (this.onTextRecognizedCallback) {
      this.onTextRecognizedCallback(text);
    }
  }

  reset(): void {
    this.mockText = '';
    this.mockCodes = [];
    this.mockImageUri = 'mock://image.jpg';
    this.state = {
      isActive: false,
      hasPermission: true,
      isScanning: false,
      torchEnabled: false,
      zoom: 1,
    };
  }
}

/**
 * Crée une instance mock du scanner pour les tests
 */
export const createMockScanner = (): MockScanner => {
  return new MockScanner();
};
