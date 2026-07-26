import * as Sentry from '@sentry/react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatPrefix(level: LogLevel, category?: string): string {
    const timestamp = new Date().toISOString();
    const tag = category ? `[${category}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${tag}:`;
  }

  /**
   * Log de débogage (uniquement en développement)
   */
  public debug(message: string, context?: LogContext, category?: string): void {
    if (__DEV__) {
      console.log(`🔍 ${this.formatPrefix('debug', category)}`, message, context || '');
    }
  }

  /**
   * Log d'information général (Breadcrumbs Sentry en production)
   */
  public info(message: string, context?: LogContext, category?: string): void {
    if (__DEV__) {
      console.info(`ℹ️ ${this.formatPrefix('info', category)}`, message, context || '');
    } else {
      Sentry.addBreadcrumb({
        category: category || 'app',
        message,
        data: context,
        level: 'info',
      });
    }
  }

  /**
   * Log d'avertissement
   */
  public warn(message: string, context?: LogContext, category?: string): void {
    if (__DEV__) {
      console.warn(`⚠️ ${this.formatPrefix('warn', category)}`, message, context || '');
    } else {
      Sentry.addBreadcrumb({
        category: category || 'app',
        message,
        data: context,
        level: 'warning',
      });
    }
  }

  /**
   * Log d'erreur robuste (Console en dev, Sentry Scope & Exception en prod)
   */
  public error(error: Error | string, context?: LogContext, category?: string): void {
    const errObj = typeof error === 'string' ? new Error(error) : error;

    if (__DEV__) {
      console.error(`🚨 ${this.formatPrefix('error', category)}`, errObj, context || '');
    } else {
      Sentry.withScope((scope) => {
        if (category) {
          scope.setTag('category', category);
        }
        if (context) {
          scope.setExtras(context);
        }
        Sentry.captureException(errObj);
      });
    }
  }
}

export const logger = new Logger();
