import * as Sentry from '@sentry/react-native';
import { logger } from './logger';

export { logger };

export const initMonitoring = () => {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
    logger.warn("Sentry DSN manquant. Monitoring désactivé.", undefined, 'Sentry');
    return;
  }

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // Désactivé en DEV pour ne pas polluer le dashboard et cramer ton quota
    enabled: !__DEV__,
    tracesSampleRate: 1.0, // Capture 100% des erreurs au lancement
  });
};

/**
 * Fonction unifiée pour logger des erreurs de manière explicite 
 * (ex: dans les blocs catch de ton domaine métier)
 */
export const logError = (error: Error | string, context?: Record<string, any>, category?: string) => {
  logger.error(error, context, category);
};

