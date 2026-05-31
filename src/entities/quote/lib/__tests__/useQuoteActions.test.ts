import { renderHook, act } from '@testing-library/react-native';
import { useQuoteActions } from '../useQuoteActions';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useTabIndex } from '@/src/app/providers/TabContext';
import { PlatformServices } from '@/src/shared/platform';

jest.mock('@/src/entities/quote/providers/QuoteProvider');
jest.mock('@/src/entities/author/providers/AuthorProvider');
jest.mock('@/src/app/providers/TabContext');
jest.mock('@/src/shared/platform', () => ({
  PlatformServices: {
    haptics: {
      notificationAsync: jest.fn(),
    },
  },
}));
jest.mock('@/src/entities/book/lib/loadBookDetailData', () => ({
  loadBookDetailData: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/src/entities/user/api/AuthService', () => ({
  authService: {
    getToken: jest.fn().mockResolvedValue('token'),
  },
}));

describe('useQuoteActions', () => {
  const mockAddQuote = jest.fn();
  const mockUpdateQuote = jest.fn();
  const mockRefreshQuotes = jest.fn();
  
  const mockRefreshBooks = jest.fn();
  const mockRefreshAuthors = jest.fn();
  
  const mockSetTabIndex = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useQuote as jest.Mock).mockReturnValue({
      addQuote: mockAddQuote,
      updateQuote: mockUpdateQuote,
      refreshQuotes: mockRefreshQuotes,
    });
    
    (useAuthor as jest.Mock).mockReturnValue({
      refreshBooks: mockRefreshBooks,
      refreshAuthors: mockRefreshAuthors,
      getBookById: jest.fn(),
      getBookByTitle: jest.fn(),
      getBookByInventaireUri: jest.fn(),
      importBook: jest.fn(),
      getAuthorByName: jest.fn(),
    });

    (useTabIndex as jest.Mock).mockReturnValue({
      setTabIndex: mockSetTabIndex,
    });
  });

  it('devrait ajouter une nouvelle citation, déclencher haptic et rafraichir', async () => {
    mockAddQuote.mockResolvedValue({ id: 1, text: 'Test' });

    const { result } = renderHook(() => useQuoteActions());

    const options = { setShowModal: jest.fn() };
    await act(async () => {
      await result.current.handleConfirmSave('Test text', 'Test Book', 'Test Author', options);
    });

    expect(mockAddQuote).toHaveBeenCalledWith('Test text', 'Test Book', 'Test Author');
    expect(PlatformServices.haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(mockRefreshQuotes).toHaveBeenCalled();
    expect(mockRefreshBooks).toHaveBeenCalled();
    expect(mockRefreshAuthors).toHaveBeenCalled();
    expect(options.setShowModal).toHaveBeenCalledWith(false);
  });

  it('devrait mettre à jour une citation existante', async () => {
    mockUpdateQuote.mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useQuoteActions());
    const editingQuote = { id: 1, text: 'Old', book: 'Old Book', author: 'Old Author', likesCount: 0, isLiked: false };

    await act(async () => {
      await result.current.handleConfirmSave('New text', 'New Book', 'New Author', { editingQuote });
    });

    expect(mockUpdateQuote).toHaveBeenCalledWith(1, { text: 'New text', book: 'New Book', author: 'New Author' });
    expect(mockAddQuote).not.toHaveBeenCalled();
  });
  
  it('devrait changer d\'onglet si isFromScanner est vrai', async () => {
    const onReset = jest.fn();
    const { result } = renderHook(() => useQuoteActions());

    await act(async () => {
      await result.current.handleConfirmSave('Test', 'Book', 'Author', { isFromScanner: true, onReset });
    });

    expect(mockSetTabIndex).toHaveBeenCalledWith(0);
    expect(onReset).toHaveBeenCalled();
  });
});
