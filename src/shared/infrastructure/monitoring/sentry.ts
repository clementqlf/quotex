import * as Sentry from '@sentry/react-native';

export const initMonitoring = () => {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
    console.warn("Sentry DSN manquant. Monitoring désactivé.");
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
export const logError = (error: Error, context?: Record<string, any>) => {
  if (__DEV__) {
    console.error("🚨 ERREUR:", error, context);
  } else {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(error);
    });
  }
};
