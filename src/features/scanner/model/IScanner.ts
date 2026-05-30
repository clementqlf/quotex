/**
 * Interface pour le scanner de codes et texte
 * Permet de découpler l'application de Vision Camera
 */

// Résultat d'une capture
export interface CaptureResult {
  image: string;  // URI de l'image capturée
  text?: string;  // Texte reconnu (OCR)
  codes?: string[]; // Codes QR/barres détectés
}

// Options de configuration du scanner
export interface ScannerOptions {
  scanInterval?: number;  // Intervalle entre les scans (ms)
  enabled?: boolean;      // Activer/désactiver le scanner
  pixelFormat?: string;  // Format des pixels
  outputOrientation?: string; // Orientation de sortie
}

// État du scanner
export interface ScannerState {
  isActive: boolean;
  hasPermission: boolean;
  isScanning: boolean;
  torchEnabled: boolean;
  zoom: number;
}

// Interface principale du scanner
export interface IScanner {
  /**
   * Démarre le scanner
   */
  start(): Promise<void>;
  
  /**
   * Arrête le scanner
   */
  stop(): Promise<void>;
  
  /**
   * Capture une photo
   */
  capture(): Promise<CaptureResult>;
  
  /**
   * Active/désactive la lampe torche
   */
  toggleTorch(enabled: boolean): Promise<void>;
  
  /**
   * Zoome
   */
  setZoom(zoom: number): Promise<void>;
  
  /**
   * Définit le callback pour les codes scannés
   */
  onCodeScanned(callback: (code: string) => void): void;
  
  /**
   * Définit le callback pour le texte reconnu
   */
  onTextRecognized(callback: (text: string) => void): void;
  
  /**
   * Vérifie et demande la permission de la caméra
   */
  requestPermission(): Promise<boolean>;
  
  /**
   * Obtient l'état actuel du scanner
   */
  getState(): ScannerState;
  
  /**
   * Nettoie les ressources
   */
  cleanup(): Promise<void>;
}

// Type pour le callback de détection de code
export type OnCodeScannedCallback = (code: string) => void;
export type OnTextRecognizedCallback = (text: string) => void;
