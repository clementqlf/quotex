import {
  normalizeInventaireUri,
  getInventaireImageUrl,
  resolveInventaireEntity,
  fetchInventaireEntities,
  fetchInventaireEditions,
  InventaireEntity,
  InventaireEdition
} from './InventaireService';

// Mock global fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch as jest.Mock;

describe('InventaireService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeInventaireUri', () => {
    it('should return empty string for falsy/missing inputs', () => {
      expect(normalizeInventaireUri(null)).toBe('');
      expect(normalizeInventaireUri(undefined)).toBe('');
      expect(normalizeInventaireUri('')).toBe('');
    });

    it('should trim, lowercase and strip wd: prefix', () => {
      expect(normalizeInventaireUri('  wd:Q12345  ')).toBe('q12345');
      expect(normalizeInventaireUri('Q67890')).toBe('q67890');
      expect(normalizeInventaireUri('  wd:q2468  ')).toBe('q2468');
    });
  });

  describe('getInventaireImageUrl', () => {
    it('should return null for falsy values', () => {
      expect(getInventaireImageUrl(null)).toBeNull();
    });

    it('should handle string inputs correctly', () => {
      // Absolute URL
      expect(getInventaireImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
      // Relative /img/ URL
      expect(getInventaireImageUrl('/img/cover.jpg')).toBe('https://inventaire.io/img/cover.jpg');
      // Invalid string format
      expect(getInventaireImageUrl('some-random-string')).toBeNull();
    });

    it('should handle image objects with url property', () => {
      // Absolute URL in url
      expect(getInventaireImageUrl({ url: 'https://example.com/image.png' })).toBe('https://example.com/image.png');
      // Relative URL in url
      expect(getInventaireImageUrl({ url: '/img/cover.jpg' })).toBe('https://inventaire.io/img/cover.jpg');
      // Relative URL without leading /img/ (should still form the url)
      expect(getInventaireImageUrl({ url: 'relative-path' })).toBe('https://inventaire.iorelative-path');
    });

    it('should handle image objects with file property', () => {
      // Absolute URL in file
      expect(getInventaireImageUrl({ file: 'https://example.com/image.png' })).toBe('https://example.com/image.png');
      // Relative URL in file
      expect(getInventaireImageUrl({ file: '/img/cover.jpg' })).toBe('https://inventaire.io/img/cover.jpg');
      // Invalid file value
      expect(getInventaireImageUrl({ file: 'invalid-value' })).toBeNull();
    });

    it('should return null for unsupported object keys', () => {
      expect(getInventaireImageUrl({ thumbnail: 'https://example.com/thumb.png' } as any)).toBeNull();
    });
  });

  describe('resolveInventaireEntity', () => {
    const mockEntities: Record<string, InventaireEntity> = {
      'wd:Q1': { uri: 'wd:Q1', type: 'work', title: 'Work 1' },
      'Q2': { uri: 'Q2', type: 'author', label: 'Author 2' },
    };

    it('should resolve direct exact matches', () => {
      expect(resolveInventaireEntity(mockEntities, 'wd:Q1')).toEqual(mockEntities['wd:Q1']);
    });

    it('should resolve fallback keys by stripping wd: prefix or checking endings', () => {
      expect(resolveInventaireEntity(mockEntities, 'wd:Q2')).toEqual(mockEntities['Q2']);
    });

    it('should fall back to the first available key if no match is found', () => {
      expect(resolveInventaireEntity(mockEntities, 'wd:Q999')).toEqual(mockEntities['wd:Q1']);
    });

    it('should return null if entities object is empty', () => {
      expect(resolveInventaireEntity({}, 'wd:Q1')).toBeNull();
    });
  });

  describe('fetchInventaireEntities', () => {
    it('should return empty object immediately if uris is empty', async () => {
      const result = await fetchInventaireEntities([]);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should fetch and return entities from API on success', async () => {
      const mockResponse = {
        entities: {
          'wd:Q1': { uri: 'wd:Q1', type: 'work', title: 'Work 1' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchInventaireEntities(['wd:Q1'], 'claims');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inventaire.io/api/entities/by-uris?uris=wd%3AQ1&lang=fr&props=claims',
        { headers: { 'User-Agent': 'QuotexApp/1.0' } }
      );
      expect(result).toEqual(mockResponse.entities);
    });

    it('should return empty object if response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await fetchInventaireEntities(['wd:Q1']);
      expect(result).toEqual({});
    });
  });

  describe('fetchInventaireEditions', () => {
    it('should fetch and return editions for a work on success', async () => {
      const mockEditions: InventaireEdition[] = [
        { id: 'ed1', title: 'Edition 1', isbn: '9782070368976' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ editions: mockEditions }),
      });

      const result = await fetchInventaireEditions('wd:Q1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://inventaire.io/api/entities/q1/editions?lang=fr',
        { headers: { 'User-Agent': 'QuotexApp/1.0' } }
      );
      expect(result).toEqual(mockEditions);
    });

    it('should return empty array if response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await fetchInventaireEditions('wd:Q1');
      expect(result).toEqual([]);
    });

    it('should return empty array and catch errors on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await fetchInventaireEditions('wd:Q1');
      expect(result).toEqual([]);
    });
  });
});
