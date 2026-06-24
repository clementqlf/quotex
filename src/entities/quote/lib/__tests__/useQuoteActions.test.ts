import { useTabIndex } from '@/src/app/providers/TabContext';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { quoteService } from '@/src/entities/quote/api/QuoteService.facade';
import { Quote } from '@/src/shared/api/types';
import { PlatformServices } from '@/src/shared/platform';
import { act, renderHook } from '@testing-library/react-native';
import { useQuoteActions } from '../useQuoteActions';

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
    getUser: jest.fn().mockResolvedValue({ id: '1', username: 'test', name: 'Test User' }),
  },
}));
jest.mock('@/src/entities/quote/api/QuoteService.facade', () => ({
  quoteService: {
    createQuoteWithMatching: jest.fn(),
  },
}));

describe('useQuoteActions', () => {
  const mockUpdateQuote = jest.fn();
  const mockRefreshQuotes = jest.fn();
  
  const mockRefreshBooks = jest.fn();
  const mockRefreshAuthors = jest.fn();
  
  const mockSetTabIndex = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useQuote as jest.Mock).mockReturnValue({
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

    (quoteService.createQuoteWithMatching as jest.Mock).mockResolvedValue({
      id: 1,
      text: 'Test',
      book: 'Test Book',
      author: 'Test Author',
      likesCount: 0,
      isLiked: false,
      user: { id: '1', username: 'test', name: 'Test User' },
      comments: 0,
      isSaved: false,
    });
  });

  it('devrait ajouter une nouvelle citation, déclencher haptic et rafraichir', async () => {
    (quoteService.createQuoteWithMatching as jest.Mock).mockResolvedValue({ id: 1, text: 'Test text', book: 'Test Book', author: 'Test Author' });

    const { result } = renderHook(() => useQuoteActions());

    const options = { setShowModal: jest.fn() };
    await act(async () => {
      await result.current.handleConfirmSave('Test text', 'Test Book', 'Test Author', options);
    });

    expect(quoteService.createQuoteWithMatching).toHaveBeenCalledWith('Test text', 'Test Book', 'Test Author');
    expect(PlatformServices.haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(mockRefreshQuotes).toHaveBeenCalled();
    expect(mockRefreshBooks).toHaveBeenCalled();
    expect(mockRefreshAuthors).toHaveBeenCalled();
    expect(options.setShowModal).toHaveBeenCalledWith(false);
  });

  it('devrait mettre à jour une citation existante', async () => {
    mockUpdateQuote.mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useQuoteActions());
    const editingQuote: Quote = {
      id: 1,
      text: 'Old',
      book: 'Old Book',
      author: 'Old Author',
      likesCount: 0,
      isLiked: false,
      user: { id: '1', username: 'test', name: 'Test User' },
      comments: 0,
      isSaved: false,
    };

    await act(async () => {
      await result.current.handleConfirmSave('New text', 'New Book', 'New Author', { editingQuote });
    });

    expect(mockUpdateQuote).toHaveBeenCalledWith(1, { text: 'New text', book: 'New Book', author: 'New Author' });
    expect(quoteService.createQuoteWithMatching).not.toHaveBeenCalled();
  });
  
  it('devrait changer d\'onglet si isFromScanner est vrai', async () => {
    const onReset = jest.fn();
    const { result } = renderHook(() => useQuoteActions());

    await act(async () => {
      await result.current.handleConfirmSave('Test', 'Book', 'Author', {
        isFromScanner: true,
        onReset,
        setTabIndex: mockSetTabIndex,
      });
    });

    expect(mockSetTabIndex).toHaveBeenCalledWith(0);
    expect(onReset).toHaveBeenCalled();
  });
});
