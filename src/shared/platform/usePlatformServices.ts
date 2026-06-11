import { useMemo } from 'react';
import { IPlatformServices, PlatformServices } from './ExpoPlatformServices';

/**
 * Hook pour accéder aux PlatformServices
 * Retourne toujours la même instance (singleton)
 */
export const usePlatformServices = (): IPlatformServices => {
  return useMemo(() => PlatformServices, []);
};

// Exporter les services individuels pour plus de simplicité
export const useClipboard = () => {
  const services = usePlatformServices();
  return services.clipboard;
};

export const useShare = () => {
  const services = usePlatformServices();
  return services.share;
};

export const useHaptics = () => {
  const services = usePlatformServices();
  return services.haptics;
};

export const useFileSystem = () => {
  const services = usePlatformServices();
  return services.fileSystem;
};

export const useLinking = () => {
  const services = usePlatformServices();
  return services.linking;
};

export const useCamera = () => {
  const services = usePlatformServices();
  return services.camera;
};
