import { renderHook } from '@testing-library/react-native';
import { useSmartNavigation } from '../useSmartNavigation';

// Mock NavigationContext
const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('../NavigationContext', () => ({
  useNavigation: () => ({
    push: mockPush,
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
}));

describe('useSmartNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devrait naviguer vers la page de détail d\'un livre avec un ID', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToBook(42);

    expect(mockPush).toHaveBeenCalledWith('/book-detail', {
      bookId: 42,
      bookTitle: undefined,
      inventaireUri: undefined,
    });
  });

  it('devrait naviguer vers la page de détail d\'un livre avec un titre', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToBook('Test Book Title');

    expect(mockPush).toHaveBeenCalledWith('/book-detail', {
      bookId: undefined,
      bookTitle: 'Test Book Title',
      inventaireUri: undefined,
    });
  });

  it('devrait naviguer vers la page de détail d\'un livre avec un inventaireUri', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToBook(42, 'http://inventaire.io/test');

    expect(mockPush).toHaveBeenCalledWith('/book-detail', {
      bookId: 42,
      bookTitle: undefined,
      inventaireUri: 'http://inventaire.io/test',
    });
  });

  it('devrait naviguer vers la page de détail d\'un auteur avec un ID', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToAuthor(42);

    expect(mockPush).toHaveBeenCalledWith('/author-detail', {
      authorId: 42,
      authorName: undefined,
      inventaireUri: undefined,
    });
  });

  it('devrait naviguer vers la page de détail d\'un auteur avec un nom', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToAuthor('Victor Hugo');

    expect(mockPush).toHaveBeenCalledWith('/author-detail', {
      authorId: undefined,
      authorName: 'Victor Hugo',
      inventaireUri: undefined,
    });
  });

  it('devrait naviguer vers la page de détail d\'une citation', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToQuote(42);

    expect(mockPush).toHaveBeenCalledWith('/quote-detail', {
      quoteId: 42,
    });
  });

  it('devrait naviguer vers la page de détail d\'un prix', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToPrize(1, 'Nobel Prize');

    expect(mockPush).toHaveBeenCalledWith('/prize-detail', {
      prizeId: 1,
      prizeData: 'Nobel Prize',
    });
  });

  it('devrait naviguer vers le profil utilisateur', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToUserProfile('@clementqlf');

    expect(mockPush).toHaveBeenCalledWith('/user-profile', {
      username: '@clementqlf',
    });
  });

  it('devrait naviguer vers l\'écran de recherche', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToSearch();

    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('devrait naviguer vers l\'écran du scanner', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToScan();

    expect(mockPush).toHaveBeenCalledWith('/scan');
  });

  it('devrait naviguer vers les paramètres', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateToSettings();

    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('devrait naviguer vers l\'accueil avec replace', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigateHome();

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('devrait exposer la navigation de base', () => {
    const { result } = renderHook(() => useSmartNavigation());

    result.current.navigate('/custom-route' as any);
    result.current.push('/push-route');
    result.current.replace('/replace-route');
    result.current.goBack();
    result.current.canGoBack();

    expect(mockNavigate).toHaveBeenCalledWith('/custom-route');
    expect(mockPush).toHaveBeenCalledWith('/push-route');
    expect(mockReplace).toHaveBeenCalledWith('/replace-route');
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockCanGoBack).toHaveBeenCalled();
  });
});
