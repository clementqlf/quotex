// Platform Services
export {
  PlatformServices,
} from './ExpoPlatformServices';

export type {
  IClipboardService,
  IShareService,
  IHapticService,
  IFileSystemService,
  ILinkingService,
  ICameraService,
  IPlatformServices,
  HapticFeedbackType,
} from './services';

export {
  usePlatformServices,
  useClipboard,
  useShare,
  useHaptics,
  useFileSystem,
  useLinking,
  useCamera,
} from './usePlatformServices';
