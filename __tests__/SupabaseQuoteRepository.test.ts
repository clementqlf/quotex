import { SupabaseQuoteRepository } from '../src/entities/quote/api/SupabaseQuoteRepository';
import { StorageService, STORAGE_KEYS } from '../src/shared/api/StorageService';
import { httpClient } from '../src/shared/api/HttpClient';
import { authService } from '../src/entities/user/api/AuthService';
import { quoteService } from '../src/entities/quote/api/QuoteService';

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
    PENDING_QUOTES: 'pending_quotes',
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
  },
}));

describe('SupabaseQuoteRepository Offline Queue', () => {
  let repository: SupabaseQuoteRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  it('devrait ajouter la citation à la file d\'attente (pending queue) si hors-ligne', async () => {
    // Simuler le fait d'être hors-ligne (checkConnection retourne false)
    (httpClient.request as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    const text = 'Citation de test hors-ligne';
    
    const quote = await repository.createQuote(text, 'Livre Test', 'Auteur Test');

    // Vérifier que la citation retourne les bonnes valeurs locales
    expect(quote.text).toBe(text);
    expect(quote.wasSynced).toBeUndefined(); // Non synchronisé

    // Vérifier que getItems (pour les quotes existantes) et setItem ont été appelés
    expect(StorageService.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_QUOTES);
    
    // Vérifier que la file d'attente (pending quotes) a été mise à jour
    expect(StorageService.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.PENDING_QUOTES,
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Citation de test hors-ligne',
          book: 'Livre Test',
          author: 'Auteur Test',
        })
      ])
    );

    // Vérifier que le cache global des citations a été mis à jour avec la nouvelle citation
    expect(StorageService.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.QUOTES,
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          text: 'Citation de test hors-ligne',
        })
      ])
    );
    
    // S'assurer qu'aucune requête POST n'a été envoyée
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('devrait synchroniser directement si en ligne', async () => {
    // Simuler le fait d'être en ligne
    (httpClient.request as jest.Mock).mockResolvedValue({});
    (httpClient.post as jest.Mock).mockResolvedValue({
      syncedCount: 1,
      corrections: [],
      syncDetails: []
    });

    const text = 'Citation de test en ligne';
    
    const quote = await repository.createQuote(text, 'Livre Test', 'Auteur Test');

    expect(httpClient.post).toHaveBeenCalledWith('/sync-quotes', expect.objectContaining({
      offlineQuotes: expect.arrayContaining([
        expect.objectContaining({
          text,
          userId: 'user-123'
        })
      ])
    }));

    expect(quote.wasSynced).toBe(true);

    // Ne doit PAS être ajouté à PENDING_QUOTES
    expect(StorageService.setItem).not.toHaveBeenCalledWith(
      STORAGE_KEYS.PENDING_QUOTES,
      expect.anything()
    );
  });

  describe('updateQuote, deleteQuote, toggleLike', () => {
    it('devrait mettre à jour une citation dans le cache local (updateQuote)', async () => {
      const mockQuotes = [{ id: 1, text: 'Old', isLiked: false, likesCount: 0 }];
      (quoteService.getQuotes as jest.Mock).mockResolvedValue(mockQuotes);

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
      const mockQuotes = [{ id: 1, text: 'Keep' }, { id: 2, text: 'Delete' }];
      (quoteService.getQuotes as jest.Mock).mockResolvedValue(mockQuotes);

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
      const mockQuotes = [{ id: 1, text: 'Test', isLiked: false, likesCount: 5 }];
      (quoteService.getQuotes as jest.Mock).mockResolvedValue(mockQuotes);

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
