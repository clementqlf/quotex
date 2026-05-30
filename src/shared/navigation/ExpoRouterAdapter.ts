import { useRouter, usePathname } from 'expo-router';
import { INavigationService, NavigateOptions, RouteParams } from './types';

/**
 * Adaptateur Expo Router pour INavigationService
 * Implémente l'interface de navigation abstraite avec Expo Router
 */
export class ExpoRouterAdapter implements INavigationService {
  private router: any;
  private pathname: string;

  constructor(router: any, pathname: string) {
    this.router = router;
    this.pathname = pathname;
  }

  navigate(to: string | NavigateOptions): void {
    if (typeof to === 'string') {
      this.router.navigate(to);
    } else {
      this.router.navigate({
        pathname: to.screen,
        params: to.params
      });
    }
  }

  push(screen: string, params?: Record<string, any>): void {
    this.router.push({ pathname: screen, params });
  }

  replace(screen: string, params?: Record<string, any>): void {
    this.router.replace({ pathname: screen, params });
  }

  goBack(): void {
    this.router.back();
  }

  canGoBack(): boolean {
    return this.router.canGoBack();
  }

  navigateTo<T extends RouteParams>(screen: string, params: T): void {
    this.router.push({ pathname: screen, params });
  }
}

/**
 * Hook pour obtenir une instance de INavigationService
 * Utilise Expo Router sous le capot
 */
export const useNavigationService = (): INavigationService => {
  const router = useRouter();
  const pathname = usePathname();
  
  // Créer une nouvelle instance à chaque appel (l'adapter est léger)
  return new ExpoRouterAdapter(router, pathname);
};
