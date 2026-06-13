import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { SupabaseQuoteRepository } from '../SupabaseQuoteRepository';

// Mock globalThis.fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch as jest.Mock;

// Mock dependencies
jest.mock('@/src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
  STORAGE_KEYS: {
    QUOTES: 'quotes',
    PENDING_OPERATIONS: 'pending_operations',
  },
}));

jest.mock('@/src/entities/user/api/AuthService', () => ({
  authService: {
    getToken: jest.fn().mockResolvedValue('mock-token'),
    getUser: jest.fn().mockResolvedValue({ id: '1', name: 'Test User', username: '@test' }),
  },
}));

jest.mock('@/src/shared/api/staticData', () => ({
  localQuotesDB: [
    { id: 1, text: 'Local quote 1', book: 'Book 1', author: 'Author 1' },
    { id: 2, text: 'Local quote 2', book: 'Book 2', author: 'Author 2' },
  ],
  globalQuotesDB: [
    { id: 3, text: 'Global quote 1', book: 'Book 3', author: 'Author 3' },
  ],
}));

jest.mock('@/src/shared/api/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('SupabaseQuoteRepository', () => {
  let repository: SupabaseQuoteRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = SupabaseQuoteRepository.getInstance();
  });

  describe('getQuotes', () => {
    it('devrait récupérer toutes les citations depuis le serveur et mettre à jour le cache local', async () => {
      const mockQuotes = [
        { id: 1, text: 'Test quote 1', book: 'Test Book 1', author: 'Test Author 1' },
        { id: 2, text: 'Test quote 2', book: 'Test Book 2', author: 'Test Author 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuotes,
      });

      const quotes = await repository.getQuotes();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/quotes'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.QUOTES, expect.any(Array));
      expect(quotes.length).toBe(2);
      expect(quotes[0].text).toBe('Test quote 1');
    });

    it('devrait retourner les citations locales en cas d\'échec du serveur (offline)', async () => {
      const mockCachedQuotes = [
        { id: 1, text: 'Cached quote 1', book: 'Cached Book 1', author: 'Cached Author 1', user: { id: '1', name: 'Test User', username: '@test' } },
      ];

      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      (StorageService.getItem as jest.Mock).mockResolvedValue(mockCachedQuotes);

      const quotes = await repository.getQuotes();

      expect(quotes.length).toBe(1);
      expect(quotes[0].text).toBe('Cached quote 1');
      expect(StorageService.getItem).toHaveBeenCalledWith(STORAGE_KEYS.QUOTES);
    });
  });

  describe('getQuoteById', () => {
    it('devrait récupérer une citation par ID depuis le serveur', async () => {
      const mockQuote = { id: 42, text: 'Test quote by ID', book: 'Test Book', author: 'Test Author' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote,
      });

      const quote = await repository.getQuoteById(42);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/quotes/42'),
        expect.any(Object)
      );
      expect(quote).toBeDefined();
      expect(quote?.id).toBe(42);
      expect(quote?.text).toBe('Test quote by ID');
    });

    it('devrait retourner null si la citation n\'existe pas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      (StorageService.getItem as jest.Mock).mockResolvedValueOnce([]);

      const quote = await repository.getQuoteById(999);

      expect(quote).toBeNull();
    });
  });

  describe('getUserQuotes', () => {
    it('devrait filtrer les citations par userId', async () => {
      const mockQuotes = [
        { id: 1, text: 'User quote 1', book: 'Book 1', author: 'Author 1', user: { id: '1', name: 'Test User', username: '@test' } },
        { id: 2, text: 'Other user quote', book: 'Book 2', author: 'Author 2', user: { id: '2', name: 'Other User', username: '@other' } },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuotes,
      });

      const userQuotes = await repository.getUserQuotes('1');

      expect(userQuotes.length).toBe(1);
      expect(userQuotes[0].user?.id).toBe('1');
    });
  });
});
