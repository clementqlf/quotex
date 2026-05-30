import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Camera, useCameraPermission } from 'react-native-vision-camera';
import {
  IClipboardService,
  IShareService,
  IHapticService,
  IFileSystemService,
  ILinkingService,
  ICameraService,
  IPlatformServices,
  HapticFeedbackType
} from './services';

// ============================================
// Clipboard Service Implementation
// ============================================
class ExpoClipboardService implements IClipboardService {
  async setString(text: string): Promise<void> {
    // Utiliser l'API native de React Native
    // @ts-ignore - Clipboard est disponible dans React Native
    await global.Clipboard.setString(text);
  }

  async getString(): Promise<string> {
    // @ts-ignore
    return await global.Clipboard.getString();
  }
}

// ============================================
// Share Service Implementation
// ============================================
class ExpoShareService implements IShareService {
  async share(options: { message: string; title?: string; url?: string }): Promise<void> {
    // Utiliser l'API native
    // @ts-ignore - Share est disponible dans React Native
    await global.Share.share({
      message: options.message,
      title: options.title,
      url: options.url,
    });
  }

  async isAvailable(): Promise<boolean> {
    // @ts-ignore
    return typeof global.Share !== 'undefined';
  }
}

// ============================================
// Haptics Service Implementation
// ============================================
class ExpoHapticService implements IHapticService {
  async selectionAsync(): Promise<void> {
    await Haptics.selectionAsync();
  }

  async impactAsync(style: 'light' | 'medium' | 'heavy'): Promise<void> {
    const hapticStyle = style === 'light' 
      ? Haptics.ImpactFeedbackStyle.Light 
      : style === 'medium' 
        ? Haptics.ImpactFeedbackStyle.Medium 
        : Haptics.ImpactFeedbackStyle.Heavy;
    await Haptics.impactAsync(hapticStyle);
  }

  async notificationAsync(type: 'success' | 'warning' | 'error'): Promise<void> {
    const notificationType = type === 'success' 
      ? Haptics.NotificationFeedbackType.Success 
      : type === 'warning' 
        ? Haptics.NotificationFeedbackType.Warning 
        : Haptics.NotificationFeedbackType.Error;
    await Haptics.notificationAsync(notificationType);
  }

  async feedbackAsync(type: HapticFeedbackType): Promise<void> {
    // Mapper tous les types vers les méthodes Expo
    switch (type) {
      case 'selection':
        await this.selectionAsync();
        break;
      case 'impactLight':
        await this.impactAsync('light');
        break;
      case 'impactMedium':
        await this.impactAsync('medium');
        break;
      case 'impactHeavy':
        await this.impactAsync('heavy');
        break;
      case 'notificationSuccess':
        await this.notificationAsync('success');
        break;
      case 'notificationWarning':
        await this.notificationAsync('warning');
        break;
      case 'notificationError':
        await this.notificationAsync('error');
        break;
      case 'rigid':
      case 'soft':
        // Pour ces types, on utilise impactMedium par défaut
        await this.impactAsync('medium');
        break;
      default:
        await this.selectionAsync();
    }
  }
}

// ============================================
// File System Service Implementation
// ============================================
class ExpoFileSystemService implements IFileSystemService {
  async readFile(path: string): Promise<string> {
    const file = await FileSystem.readAsStringAsync(path);
    return file;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await FileSystem.writeAsStringAsync(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    await FileSystem.deleteAsync(path);
  }

  async getInfo(path: string): Promise<{ exists: boolean; size?: number; modificationTime?: number }> {
    const info = await FileSystem.getInfoAsync(path);
    return {
      exists: info.exists,
      size: info.size,
      modificationTime: info.modificationTime,
    };
  }
}

// ============================================
// Linking Service Implementation
// ============================================
class ExpoLinkingService implements ILinkingService {
  async openURL(url: string): Promise<void> {
    await Linking.openURL(url);
  }

  async canOpenURL(url: string): Promise<boolean> {
    return await Linking.canOpenURL(url);
  }

  async getInitialURL(): Promise<string | null> {
    return (await Linking.getInitialURL()) || null;
  }
}

// ============================================
// Camera Service Implementation
// ============================================
class ExpoCameraService implements ICameraService {
  async requestPermission(): Promise<boolean> {
    const { status } = await Camera.requestCameraPermission();
    return status === 'granted';
  }

  async getAvailableDevices(): Promise<any[]> {
    const devices = await Camera.getAvailableCameraDevices();
    return devices;
  }
}

// ============================================
// Platform Services Singleton
// ============================================
class ExpoPlatformServices implements IPlatformServices {
  public clipboard: IClipboardService;
  public share: IShareService;
  public haptics: IHapticService;
  public fileSystem: IFileSystemService;
  public linking: ILinkingService;
  public camera: ICameraService;

  private static instance: ExpoPlatformServices | null = null;

  constructor() {
    this.clipboard = new ExpoClipboardService();
    this.share = new ExpoShareService();
    this.haptics = new ExpoHapticService();
    this.fileSystem = new ExpoFileSystemService();
    this.linking = new ExpoLinkingService();
    this.camera = new ExpoCameraService();
  }

  public static getInstance(): ExpoPlatformServices {
    if (!ExpoPlatformServices.instance) {
      ExpoPlatformServices.instance = new ExpoPlatformServices();
    }
    return ExpoPlatformServices.instance;
  }
}

// Singleton export
export const PlatformServices = ExpoPlatformServices.getInstance();

// Export des types
export type {
  IClipboardService,
  IShareService,
  IHapticService,
  IFileSystemService,
  ILinkingService,
  ICameraService,
  IPlatformServices,
  HapticFeedbackType
};
