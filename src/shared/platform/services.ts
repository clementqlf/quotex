/**
 * Interfaces pour les services platform (APIs natifs)
 * Permet de découpler l'application des APIs React Native/Expo
 */

// ============================================
// Clipboard Service
// ============================================
export interface IClipboardService {
  setString(text: string): Promise<void>;
  getString(): Promise<string>;
}

// ============================================
// Share Service
// ============================================
export interface IShareService {
  share(options: { message: string; title?: string; url?: string }): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// ============================================
// Haptics Service
// ============================================
export type HapticFeedbackType = 
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError'
  | 'rigid'
  | 'soft';

export interface IHapticService {
  selectionAsync(): Promise<void>;
  impactAsync(style: 'light' | 'medium' | 'heavy'): Promise<void>;
  notificationAsync(type: 'success' | 'warning' | 'error'): Promise<void>;
  // Méthode générique pour tous les types
  feedbackAsync(type: HapticFeedbackType): Promise<void>;
}

// ============================================
// File System Service
// ============================================
export interface IFileSystemService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  getInfo(path: string): Promise<{ exists: boolean; size?: number; modificationTime?: number }>;
}

// ============================================
// Linking Service
// ============================================
export interface ILinkingService {
  openURL(url: string): Promise<void>;
  canOpenURL(url: string): Promise<boolean>;
  getInitialURL(): Promise<string | null>;
}

// ============================================
// Camera Service (pour le scanner)
// ============================================
export interface ICameraService {
  requestPermission(): Promise<boolean>;
  getAvailableDevices(): Promise<any[]>;
  // Autres méthodes seront ajoutées au besoin
}

// ============================================
// Platform Services (tous les services combinés)
// ============================================
export interface IPlatformServices {
  clipboard: IClipboardService;
  share: IShareService;
  haptics: IHapticService;
  fileSystem: IFileSystemService;
  linking: ILinkingService;
  camera: ICameraService;
}
