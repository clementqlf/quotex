import React, { useCallback, useRef, useState } from 'react';
import { Camera, CameraDevice, PhotoFile, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { CaptureResult, IScanner, OnCodeScannedCallback, OnTextRecognizedCallback, ScannerOptions, ScannerState } from './IScanner';
import { useLiveOCR } from './useLiveOCR';

/**
 * Implémentation du scanner avec Vision Camera
 * Utilise react-native-vision-camera et ML Kit pour la reconnaissance de texte
 */
export class VisionCameraScanner implements IScanner {
  private cameraRef: React.RefObject<Camera | null>;
  private device: CameraDevice | undefined;
  private permission: { hasPermission: boolean; requestPermission: () => Promise<boolean> };
  
  private onCodeScannedCallback: OnCodeScannedCallback | null = null;
  private onTextRecognizedCallback: OnTextRecognizedCallback | null = null;
  
  private state: ScannerState = {
    isActive: false,
    hasPermission: false,
    isScanning: false,
    torchEnabled: false,
    zoom: 1,
  };

  constructor() {
    // Initialiser avec des valeurs par défaut
    // Les vraies valeurs seront définies dans start()
    this.cameraRef = React.createRef<Camera | null>();
    this.device = undefined;
    this.permission = { 
      hasPermission: false, 
      requestPermission: async () => false 
    };
  }

  async start(): Promise<void> {
    // Obtenir le device et la permission
    const devices = await Camera.getAvailableCameraDevices();
    this.device = devices.find(d => d.position === 'back') || devices[0];
    
    const status = await Camera.requestCameraPermission();
    this.state.hasPermission = status === 'granted';
    this.state.isActive = true;
  }

  async stop(): Promise<void> {
    this.state.isActive = false;
    this.state.isScanning = false;
  }

  async capture(): Promise<CaptureResult> {
    if (!this.cameraRef.current) {
      throw new Error('Camera not initialized');
    }

    const photo: PhotoFile = await this.cameraRef.current.takePhoto({
      enableShutterSound: false,
    });

    return {
      image: photo.path,
    };
  }

  async toggleTorch(enabled: boolean): Promise<void> {
    this.state.torchEnabled = enabled;
      // Torch is controlled via the Camera component prop, not a method
      // Store the state for the component to use
      this.state.torchEnabled = enabled;
  }

  async setZoom(zoom: number): Promise<void> {
    this.state.zoom = zoom;
      // Zoom is controlled via the Camera component prop, not a method
      // Store the state for the component to use
      this.state.zoom = zoom;
  }

  onCodeScanned(callback: OnCodeScannedCallback): void {
    this.onCodeScannedCallback = callback;
  }

  onTextRecognized(callback: OnTextRecognizedCallback): void {
    this.onTextRecognizedCallback = callback;
  }

  async requestPermission(): Promise<boolean> {
    const status = await Camera.requestCameraPermission();
    this.state.hasPermission = status === 'granted';
    return this.state.hasPermission;
  }

  getState(): ScannerState {
    return { ...this.state };
  }

  async cleanup(): Promise<void> {
    this.state.isActive = false;
    this.state.isScanning = false;
    this.onCodeScannedCallback = null;
    this.onTextRecognizedCallback = null;

    // ⚡ Désactiver la caméra native
    if (this.cameraRef.current) {
      try {
        await (this.cameraRef.current as any)?.setActive?.(false);
        this.cameraRef.current = null; // Libérer la référence
      } catch (e) {
        console.warn('[VisionCameraScanner] Error stopping camera:', e);
      }
    }
  }
}

/**
 * Hook pour utiliser le scanner Vision Camera dans un composant React
 * C'est la manière recommandée d'utiliser le scanner
 */
export const useVisionCameraScanner = (options: ScannerOptions = {}) => {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  const [state, setState] = useState<ScannerState>({
    isActive: false,
    hasPermission: false,
    isScanning: false,
    torchEnabled: false,
    zoom: 1,
  });

  const [onCodeScannedCallback, setOnCodeScannedCallback] = useState<OnCodeScannedCallback | null>(null);
  const [onTextRecognizedCallback, setOnTextRecognizedCallback] = useState<OnTextRecognizedCallback | null>(null);

  // Gérer le code scanner
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'qr'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && onCodeScannedCallback) {
        onCodeScannedCallback(codes[0].value ?? '');
      }
    },
  });

  // Gérer la reconnaissance de texte avec ML Kit
  const { frameProcessor } = useLiveOCR({
    cameraRef,
    isFocused: state.isActive && hasPermission,
    enabled: options.enabled !== false && !state.isScanning,
    scanInterval: options.scanInterval || 300,
    onTextDetectedChange: (detected: boolean) => {
      if (detected && onTextRecognizedCallback) {
        onTextRecognizedCallback('');
      }
    },
  });

  // Fonctions publiques
  const start = useCallback(async () => {
    setState(prev => ({ ...prev, isActive: true, hasPermission }));
  }, [hasPermission]);

  const stop = useCallback(async () => {
    setState(prev => ({ ...prev, isActive: false, isScanning: false }));
  }, []);

  const capture = useCallback(async (): Promise<CaptureResult> => {
    if (!cameraRef.current) {
      throw new Error('Camera not initialized');
    }

    const photo: PhotoFile = await cameraRef.current.takePhoto({
      enableShutterSound: false,
    });

    return {
      image: photo.path,
    };
  }, []);

  const toggleTorch = useCallback(async (enabled: boolean) => {
      // Torch is controlled via Camera component prop
      setState(prev => ({ ...prev, torchEnabled: enabled }));
  }, []);

  const setZoom = useCallback(async (zoom: number) => {
      // Zoom is controlled via Camera component prop
      setState(prev => ({ ...prev, zoom }));
  }, []);

  // Créer un objet scanner compatible avec IScanner
  const scanner: Partial<IScanner> = {
    start,
    stop,
    capture,
    toggleTorch,
    setZoom,
    onCodeScanned: setOnCodeScannedCallback,
    onTextRecognized: setOnTextRecognizedCallback,
    requestPermission,
    getState: () => state,
    cleanup: stop,
  };

  return {
    cameraRef,
    device,
    hasPermission,
    codeScanner,
    frameProcessor,
    state,
    scanner,
  };
};

// Exporter le composant Camera pour usage direct
export { Camera } from 'react-native-vision-camera';
