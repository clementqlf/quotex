import { useCallback } from 'react';
import { useNavigation } from './NavigationContext';

/**
 * Hook pour une navigation intelligente avec typage
 * Utilise le service de navigation abstraite
 */
export const useSmartNavigation = () => {
  const navigation = useNavigation();

  /**
   * Navigue vers la page de détail d'un livre
   */
  const navigateToBook = useCallback(
    (bookIdOrTitle: number | string, inventaireUri?: string) => {
      const bookId = typeof bookIdOrTitle === 'number' ? bookIdOrTitle : undefined;
      const bookTitle = typeof bookIdOrTitle === 'string' ? bookIdOrTitle : undefined;

      navigation.push('/book-detail', {
        bookId,
        bookTitle,
        inventaireUri
      });
    },
    [navigation]
  );

  /**
   * Navigue vers la page de détail d'un auteur
   */
  const navigateToAuthor = useCallback(
    (authorIdOrName: number | string, inventaireUri?: string) => {
      const authorId = typeof authorIdOrName === 'number' ? authorIdOrName : undefined;
      const authorName = typeof authorIdOrName === 'string' ? authorIdOrName : undefined;

      navigation.push('/author-detail', {
        authorId,
        authorName,
        inventaireUri
      });
    },
    [navigation]
  );

  /**
   * Navigue vers la page de détail d'une citation
   */
  const navigateToQuote = useCallback(
    (quoteId: number) => {
      navigation.push('/quote-detail', { quoteId });
    },
    [navigation]
  );

  /**
   * Navigue vers la page de détail d'un prix
   */
  const navigateToPrize = useCallback(
    (prizeId: number, prizeData?: string) => {
      navigation.push('/prize-detail', { prizeId, prizeData });
    },
    [navigation]
  );

  /**
   * Navigue vers la page de profil utilisateur
   */
  const navigateToUserProfile = useCallback(
    (username: string) => {
      navigation.push('/user-profile', { username });
    },
    [navigation]
  );

  /**
   * Navigue vers l'écran de recherche
   */
  const navigateToSearch = useCallback(() => {
    navigation.push('/search');
  }, [navigation]);

  /**
   * Navigue vers l'écran du scanner
   */
  const navigateToScan = useCallback(() => {
    navigation.push('/scan');
  }, [navigation]);

  /**
   * Navigue vers les paramètres
   */
  const navigateToSettings = useCallback(() => {
    navigation.push('/settings');
  }, [navigation]);

  /**
   * Retour à l'écran principal
   */
  const navigateHome = useCallback(() => {
    navigation.replace('/');
  }, [navigation]);

  return {
    navigateToBook,
    navigateToAuthor,
    navigateToQuote,
    navigateToPrize,
    navigateToUserProfile,
    navigateToSearch,
    navigateToScan,
    navigateToSettings,
    navigateHome,
    // Exposer aussi la navigation de base
    navigate: navigation.navigate,
    push: navigation.push,
    replace: navigation.replace,
    goBack: navigation.goBack,
    canGoBack: navigation.canGoBack,
  };
};
