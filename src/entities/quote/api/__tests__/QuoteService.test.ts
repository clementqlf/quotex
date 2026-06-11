import { StorageService } from '@/src/shared/api/StorageService';
import { quoteService } from '../QuoteService';

jest.mock('@/src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
  STORAGE_KEYS: {
    QUOTES: 'quotes_data',
  },
}));

jest.mock('@/src/entities/user/api/AuthService', () => ({
  authService: {
    getToken: jest.fn().mockResolvedValue('mock-token'),
    getUser: jest.fn().mockResolvedValue({ id: '1', name: 'Clément QLF', username: '@clementqlf' }),
  },
}));

describe('QuoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuotes', () => {
    test('retourne les citations du serveur en cas de succès et met à jour le stockage local', async () => {
      const mockQuotes = [
        {
          id: 1,
          text: 'La vie est un mystère qu’il faut vivre, non un problème à résoudre.',
          book: 'Dune',
          author: 'Frank Herbert',
          date: '2026-05-24T12:00:00Z',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuotes,
      });

      const quotes = await quoteService.getQuotes();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/quotes'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
      expect(StorageService.setItem).toHaveBeenCalledWith('quotes_data', expect.any(Array));
      expect(quotes.length).toBe(1);
      expect(quotes[0].text).toBe('La vie est un mystère qu’il faut vivre, non un problème à résoudre.');
      expect(quotes[0].book).toBe('Dune');
    });

    test('utilise le stockage local si le serveur est inaccessible (offline)', async () => {
      const mockCachedQuotes = [
        {
          id: 2,
          text: 'L’essentiel est invisible pour les yeux.',
          book: 'Le Petit Prince',
          author: 'Antoine de Saint-Exupéry',
          user: { id: '1', name: 'Clément QLF', username: '@clementqlf' },
        },
      ];

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      (StorageService.getItem as jest.Mock)
        .mockResolvedValueOnce(mockCachedQuotes) // Appel 1 : seedDataIfNeeded
        .mockResolvedValueOnce(mockCachedQuotes); // Appel 2 : fallback getQuotes

      const quotes = await quoteService.getQuotes();

      expect(quotes.length).toBe(1);
      expect(quotes[0].text).toBe('L’essentiel est invisible pour les yeux.');
      expect(StorageService.getItem).toHaveBeenCalledWith('quotes_data');
    });
  });

  describe('getQuoteById', () => {
    test('renvoie la citation du serveur et met à jour le cache local', async () => {
      const mockQuote = {
        id: 42,
        text: 'Pour ce qui est de l’avenir, il ne s’agit pas de le prévoir, mais de le rendre possible.',
        book: 'Citadelle',
        author: 'Antoine de Saint-Exupéry',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote,
      });
      (StorageService.getItem as jest.Mock).mockResolvedValueOnce([]);

      const quote = await quoteService.getQuoteById(42);

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/quotes/42'), expect.any(Object));
      expect(quote).toBeDefined();
      expect(quote?.text).toBe(mockQuote.text);
      expect(StorageService.setItem).toHaveBeenCalled();
    });
  });

  describe('deleteQuote', () => {
    test('envoie une requête DELETE au serveur et effectue une suppression optimiste en local', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });
      (StorageService.getItem as jest.Mock).mockResolvedValueOnce([
        { id: 42, text: 'Test' },
        { id: 43, text: 'Keep me' },
      ]);

      await quoteService.deleteQuote(42);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/quotes/42'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(StorageService.setItem).toHaveBeenCalledWith(
        'quotes_data',
        expect.arrayContaining([{ id: 43, text: 'Keep me' }])
      );
    });
  });
});
