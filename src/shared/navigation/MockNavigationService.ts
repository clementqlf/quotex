import { INavigationService, NavigateOptions, RouteParams } from './types';

/**
 * Implémentation Mock de INavigationService pour les tests
 */
export class MockNavigationService implements INavigationService {
  private navigationHistory: string[] = [];
  private currentScreen: string = '';
  private paramsHistory: Record<string, any>[] = [];

  navigate(to: string | NavigateOptions): void {
    if (typeof to === 'string') {
      this.currentScreen = to;
      this.navigationHistory.push(to);
    } else {
      this.currentScreen = to.screen;
      this.navigationHistory.push(to.screen);
      this.paramsHistory.push(to.params || {});
    }
  }

  push(screen: string, params?: Record<string, any>): void {
    this.currentScreen = screen;
    this.navigationHistory.push(screen);
    if (params) {
      this.paramsHistory.push(params);
    }
  }

  replace(screen: string, params?: Record<string, any>): void {
    this.currentScreen = screen;
    if (params) {
      this.paramsHistory.push(params);
    }
  }

  goBack(): void {
    if (this.navigationHistory.length > 0) {
      this.navigationHistory.pop();
      this.currentScreen = this.navigationHistory[this.navigationHistory.length - 1] || '';
    }
  }

  canGoBack(): boolean {
    return this.navigationHistory.length > 1;
  }

  navigateTo<T extends RouteParams>(screen: string, params: T): void {
    this.push(screen, params);
  }

  // Méthodes pour les tests
  getCurrentScreen(): string {
    return this.currentScreen;
  }

  getNavigationHistory(): string[] {
    return [...this.navigationHistory];
  }

  getLastParams(): Record<string, any> | undefined {
    return this.paramsHistory[this.paramsHistory.length - 1];
  }

  clearHistory(): void {
    this.navigationHistory = [];
    this.paramsHistory = [];
    this.currentScreen = '';
  }
}

/**
 * Crée une instance mock pour les tests
 */
export const createMockNavigationService = (): MockNavigationService => {
  return new MockNavigationService();
};
