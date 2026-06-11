import { WikidataService } from '../WikidataService';

// Mock global.fetch
global.fetch = jest.fn();

// Mock offline detection
jest.mock('@/src/shared/lib/offline/networkUtils', () => ({
  isOffline: jest.fn().mockResolvedValue(false),
  logFetchError: jest.fn(),
}));

jest.mock('@/src/shared/config/api', () => ({
  API_BASE_URL: 'https://api.example.com',
}));

describe('WikidataService', () => {
  let service: WikidataService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WikidataService();
  });

  describe('getNotableWorks', () => {
    it('devrait récupérer les œuvres notables d\'un auteur par son nom', async () => {
      const mockBindings = [
        {
          oeuvre: { value: 'http://www.wikidata.org/entity/Q123', type: 'uri' },
          oeuvreLabel: { value: 'Les Misérables', type: 'literal' },
          openLibraryID: { value: 'OL12345', type: 'literal' },
          cover: { value: 'http://covers.openlibrary.org/b/id/12345-M.jpg', type: 'literal' },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            bindings: mockBindings,
          },
        }),
      });

      const books = await service.getNotableWorks('Victor Hugo');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('query.wikidata.org/sparql'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': 'application/sparql-results+json',
          }),
        })
      );
      expect(books).toBeDefined();
      expect(Array.isArray(books)).toBe(true);
    });

    it('devrait gérer les erreurs réseau', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const books = await service.getNotableWorks('Victor Hugo');

      expect(books).toEqual([]);
    });

    it('devrait gérer les réponses non-OK du serveur', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const books = await service.getNotableWorks('Victor Hugo');

      expect(books).toEqual([]);
    });
  });

  describe('fetchEnrichment', () => {
    it('devrait récupérer les données d\'enrichissement pour plusieurs URIs', async () => {
      const mockEnrichment = {
        'Q123': {
          labels: { fr: { value: 'Victor Hugo' } },
          descriptions: { fr: { value: 'Écrivain français' } },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEnrichment,
      });

      const result = await service['fetchEnrichment'](['Q123']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/inventaire/entities?uris=')
      );
      expect(result).toEqual(mockEnrichment);
    });
  });

  describe('Cache', () => {
    it('devrait mettre en cache les résultats d\'enrichissement', async () => {
      const mockEnrichment = { Q123: { name: 'Test' } };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEnrichment,
      });

      // Premier appel
      const result1 = await service['fetchEnrichment'](['Q123']);
      // Deuxième appel avec les mêmes URIs devrait utiliser le cache
      const result2 = await service['fetchEnrichment'](['Q123']);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockEnrichment);
      expect(result2).toEqual(mockEnrichment);
    });
  });
});
