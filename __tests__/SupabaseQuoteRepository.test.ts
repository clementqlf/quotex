import { quoteService } from '../src/entities/quote/api/QuoteService';
import { SupabaseQuoteRepository } from '../src/entities/quote/api/SupabaseQuoteRepository';
import { authService } from '../src/entities/user/api/AuthService';
import { STORAGE_KEYS, StorageService } from '../src/shared/api/StorageService';

jest.mock('../src/entities/quote/api/QuoteService', () => ({
  quoteService: {
    getQuotes: jest.fn(),
  },
}));
jest.mock('../src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
  STORAGE_KEYS: {
    QUOTES: 'quotes',
    PENDING_OPERATIONS: 'pending_operations',
  },
}));

jest.mock('../src/shared/api/HttpClient', () => ({
  httpClient: {
    request: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    buildUrl: jest.fn().mockReturnValue('https://api.example.com/functions/v1/test'),
  },
}));

jest.mock('../src/entities/user/api/AuthService', () => ({
  authService: {
    getUser: jest.fn(),
    getToken: jest.fn().mockResolvedValue('mock-token'),
  },
}));

describe('SupabaseQuoteRepository Offline Queue', () => {
  let repository: SupabaseQuoteRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis.fetch as jest.Mock).mockReset();
    
    // Configurer les mocks par défaut
    (StorageService.getItem as jest.Mock).mockResolvedValue(null);
    (StorageService.setItem as jest.Mock).mockResolvedValue(undefined);
    (authService.getUser as jest.Mock).mockResolvedValue({ id: 'user-123', name: 'Test User' });
    (quoteService.getQuotes as jest.Mock).mockResolvedValue([]);
    
    // On force l'instance à être recréée si besoin, bien que ce soit un singleton, 
    // en js on peut utiliser (SupabaseQuoteRepository as any).instance = null
    (SupabaseQuoteRepository as any).instance = null;
    repository = SupabaseQuoteRepository.getInstance();
  });

  it('devrait échouer si hors-ligne', async () => {
    // Simuler le fait d'être hors-ligne en faisant rejeter fetch
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    const text = 'Citation de test hors-ligne';
    
    await expect(repository.createQuote(text, 'Livre Test', 'Auteur Test'))
      .rejects.toThrow('Network request failed');
  });

  it('devrait synchroniser directement si en ligne et retourner le vrai ID serveur', async () => {
    // Simuler le fait d'être en ligne en résolvant fetch
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        syncedCount: 1,
        corrections: [],
        syncDetails: [{
          quoteId: 'temp-123',
          id: 9999
        }]
      })
    });

    const text = 'Citation de test en ligne';
    
    const quote = await repository.createQuote(text, 'Livre Test', 'Auteur Test');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync-quotes'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(text)
      })
    );

    expect(quote.wasSynced).toBe(true);
    expect(quote.id).toBe(9999);
  });

  describe('updateQuote, deleteQuote, toggleLike', () => {
    it('devrait mettre à jour une citation dans le cache local (updateQuote)', async () => {
      const mockQuotes = [{ id: 1, text: 'Old', isLiked: false, likesCount: 0 }] as any;
      (StorageService.getItem as jest.Mock).mockImplementation((key) => {
        if (key === STORAGE_KEYS.QUOTES) return Promise.resolve(mockQuotes);
        return Promise.resolve(null);
      });

      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const updated = await repository.updateQuote(1, { text: 'New', isLiked: true });

      expect(updated.text).toBe('New');
      expect(updated.isLiked).toBe(true);
      expect(StorageService.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.QUOTES,
        expect.arrayContaining([expect.objectContaining({ text: 'New' })])
      );
    });

    it('devrait lancer une erreur si la citation n\'existe pas (updateQuote)', async () => {
      (quoteService.getQuotes as jest.Mock).mockResolvedValue([]);
      await expect(repository.updateQuote(999, { text: 'New' })).rejects.toThrow('Quote with id 999 not found');
    });

    it('devrait supprimer une citation du cache local (deleteQuote)', async () => {
      const mockQuotes = [{ id: 1, text: 'Keep' }, { id: 2, text: 'Delete' }] as any;
      (StorageService.getItem as jest.Mock).mockImplementation((key) => {
        if (key === STORAGE_KEYS.QUOTES) return Promise.resolve(mockQuotes);
        return Promise.resolve(null);
      });

      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await repository.deleteQuote(2);

      expect(StorageService.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.QUOTES,
        expect.arrayContaining([expect.objectContaining({ id: 1 })])
      );
      // Ensure id 2 is not in the array
      const setItemCall = (StorageService.setItem as jest.Mock).mock.calls[0][1];
      expect(setItemCall).toHaveLength(1);
      expect(setItemCall[0].id).toBe(1);
    });

    it('devrait inverser l\'état de like et mettre à jour le compteur (toggleLike)', async () => {
      const mockQuotes = [{ id: 1, text: 'Test', isLiked: false, likesCount: 5 }] as any;
      (StorageService.getItem as jest.Mock).mockImplementation((key) => {
        if (key === STORAGE_KEYS.QUOTES) return Promise.resolve(mockQuotes);
        return Promise.resolve(null);
      });

      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          isLiked: true
        })
      });

      const result = await repository.toggleLike(1);

      expect(result.isLiked).toBe(true);
      expect(result.likesCount).toBe(6);
      expect(StorageService.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.QUOTES,
        expect.arrayContaining([expect.objectContaining({ isLiked: true, likesCount: 6 })])
      );
    });
  });
});
