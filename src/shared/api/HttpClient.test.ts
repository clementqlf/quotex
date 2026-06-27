import { HttpClient, httpClient } from './HttpClient';

// Mock global fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch as jest.Mock;

// Mock dependencies
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseAnonKey: 'mock-anon-key',
      },
    },
  },
}));

jest.mock('@/src/shared/config/api', () => ({
  API_BASE_URL: 'https://api.quotex.test',
}));

jest.mock('@/src/shared/lib/offline/networkUtils', () => ({
  isNetworkError: jest.fn().mockImplementation((err) => err?.message === 'Network request failed'),
}));

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = HttpClient.getInstance();
    // Reset to default mock token provider
    client.setTokenProvider(async () => 'mock-jwt-token');
  });

  describe('Singleton Pattern', () => {
    it('should always return the same instance', () => {
      const anotherClient = HttpClient.getInstance();
      expect(client).toBe(anotherClient);
      expect(client).toBe(httpClient);
    });
  });

  describe('URL Construction', () => {
    it('should prepend path with API_BASE_URL if it is not an absolute URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.get('/books');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.quotex.test/books',
        expect.any(Object)
      );
    });

    it('should use path directly if it is an absolute URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.get('https://other-api.com/books');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://other-api.com/books',
        expect.any(Object)
      );
    });

    it('should serialize and append query parameters to the URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.get('/books', {
        params: {
          search: 'Hugo',
          limit: 10,
          verified: true,
          ignoredNull: null as any,
          ignoredUndef: undefined as any,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.quotex.test/books?search=Hugo&limit=10&verified=true',
        expect.any(Object)
      );
    });
  });

  describe('Headers Construction', () => {
    it('should inject default content-type and authorization headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.request('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token',
            'apikey': 'mock-anon-key',
          }),
        })
      );
    });

    it('should allow disabling auth header using requiresAuth: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.request('/test', { requiresAuth: false });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should support array or custom Headers object configurations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const headers = new Headers();
      headers.append('X-Custom-Header', 'Value1');

      await client.request('/test', { headers });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-custom-header': 'Value1', // lowercase because Headers.forEach lowercase keys or standard mapping
          }),
        })
      );
    });
  });

  describe('HTTP Methods & Request/Response Parsing', () => {
    it('should resolve parsed JSON response when content-type contains application/json', async () => {
      const mockData = { id: 1, title: 'Mock Book' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        json: async () => mockData,
      });

      const result = await client.get('/books/1');
      expect(result).toEqual(mockData);
    });

    it('should resolve raw text response for non-JSON contents', async () => {
      const mockText = 'raw-text-response';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/plain',
        },
        text: async () => mockText,
      });

      const result = await client.get('/books/1');
      expect(result).toBe(mockText);
    });

    it('should return null immediately for 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await client.request('/delete-something', { method: 'DELETE' });
      expect(result).toBeNull();
    });

    it('should handle getSafe returning null for 404 status without throwing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.getSafe('/books/missing');
      expect(result).toBeNull();
    });

    it('should throw an error for non-ok status codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Database connection lost',
      });

      await expect(client.get('/error')).rejects.toThrow(
        'HTTP Error 500: Internal Server Error - Database connection lost'
      );
    });

    it('should perform POST requests formatting object bodies to JSON string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const requestBody = { title: 'New Book', pages: 200 };
      await client.post('/books', requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
    });

    it('should perform PUT requests with the correct body and method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.put('/books/1', 'raw-body-string');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: 'raw-body-string',
        })
      );
    });

    it('should perform PATCH requests with the correct body and method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.patch('/books/1', { pages: 300 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ pages: 300 }),
        })
      );
    });

    it('should perform DELETE requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.delete('/books/1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should warn on console.warn for network errors and rethrow', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const netError = new Error('Network request failed');
      mockFetch.mockRejectedValueOnce(netError);

      await expect(client.get('/network')).rejects.toThrow('Network request failed');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HttpClient] Request failed due to network connectivity'),
        'Network request failed'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should log console.error for non-network request errors and rethrow', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const regularError = new Error('Arbitrary internal failure');
      mockFetch.mockRejectedValueOnce(regularError);

      await expect(client.get('/fail')).rejects.toThrow('Arbitrary internal failure');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[HttpClient] Request failed'),
        regularError
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
