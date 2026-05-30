/**
 * Types pour la navigation abstraite
 * Permet de découpler l'application de Expo Router
 */

// Types pour les paramètres de routage
export type NavigateOptions = {
  screen: string;
  params?: Record<string, any>;
  replace?: boolean;
};

export type RouteParams = {
  bookId?: number | string;
  bookTitle?: string;
  authorId?: number | string;
  authorName?: string;
  inventaireUri?: string;
  prizeId?: number | string;
  prizeData?: string;
  quoteId?: number | string;
  username?: string;
};

// Interface principale du service de navigation
export interface INavigationService {
  /**
   * Navigue vers un écran
   * @param to - Nom de l'écran ou options de navigation
   */
  navigate(to: string | NavigateOptions): void;
  
  /**
   * Retour à l'écran précédent
   */
  goBack(): void;
  
  /**
   * Ajoute un écran à la pile de navigation
   * @param screen - Nom de l'écran
   * @param params - Paramètres à passer
   */
  push(screen: string, params?: Record<string, any>): void;
  
  /**
   * Remplace l'écran actuel
   * @param screen - Nom de l'écran
   * @param params - Paramètres à passer
   */
  replace(screen: string, params?: Record<string, any>): void;
  
  /**
   * Vérifie si on peut revenir en arrière
   */
  canGoBack(): boolean;
  
  /**
   * Navigue vers un écran avec des paramètres typés
   */
  navigateTo<T extends RouteParams>(screen: string, params: T): void;
}
