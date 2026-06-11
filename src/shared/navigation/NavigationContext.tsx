import React, { createContext, ReactNode, useContext } from 'react';
import { useNavigationService } from './ExpoRouterAdapter';
import { INavigationService } from './types';

/**
 * Contexte pour le service de navigation
 * Permet d'injecter différentes implémentations (pour les tests)
 */
const NavigationContext = createContext<INavigationService | null>(null);

/**
 * Provider pour le service de navigation
 */
export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const navigationService = useNavigationService();

  return (
    <NavigationContext.Provider value={navigationService}>
      {children}
    </NavigationContext.Provider>
  );
};

/**
 * Hook pour utiliser le service de navigation
 */
export const useNavigation = (): INavigationService => {
  const navigation = useContext(NavigationContext);
  if (!navigation) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return navigation;
};

// Export pour compatibilité descendante
export { ExpoRouterAdapter } from './ExpoRouterAdapter';
export { INavigationService, NavigateOptions, RouteParams } from './types';
