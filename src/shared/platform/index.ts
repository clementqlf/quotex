// Platform Services
export {
  PlatformServices,
  IClipboardService,
  IShareService,
  IHapticService,
  IFileSystemService,
  ILinkingService,
  ICameraService,
  IPlatformServices,
  HapticFeedbackType,
} from './ExpoPlatformServices';

export {
  usePlatformServices,
  useClipboard,
  useShare,
  useHaptics,
  useFileSystem,
  useLinking,
  useCamera,
} from './usePlatformServices';

export type {
  IClipboardService,
  IShareService,
  IHapticService,
  IFileSystemService,
  ILinkingService,
  ICameraService,
  IPlatformServices,
  HapticFeedbackType
} from './services';
