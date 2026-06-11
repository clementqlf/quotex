import { ScanService } from '../ScanService';
import { searchService } from '@/src/features/search/api/SearchService';

jest.mock('@/src/features/search/api/SearchService');
jest.mock('@react-native-ml-kit/text-recognition');
jest.mock('expo-image-manipulator');
jest.mock('expo-file-system/legacy');
jest.mock('@/src/shared/platform');
jest.mock('@/src/entities/user/api/AuthService');

describe('ScanService', () => {
  let service: ScanService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScanService();
  });

  describe('checkAndHandleIsbn', () => {
    it('should return success=false for invalid ISBN', async () => {
      const result = await service.checkAndHandleIsbn('hello world');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid ISBN');
    });

    it('should call searchService with detected ISBN', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        inventaireWorks: [{
          title: 'Test Book',
          authors: ['Test Author'],
          inventaireUri: 'test-uri'
        }]
      });

      const result = await service.checkAndHandleIsbn('9782070368976');
      expect(searchService.search).toHaveBeenCalledWith('9782070368976');
      expect(result.success).toBe(true);
      expect(result.bookData?.title).toBe('Test Book');
    });

    it('should handle searchService errors', async () => {
      (searchService.search as jest.Mock).mockRejectedValue(new Error('Network error'));
      const result = await service.checkAndHandleIsbn('9782070368976');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should validate payload with Zod before import', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        inventaireWorks: [{
          label: 'Test Book',
          inventaireUri: 'test-uri',
          isbn: '9782070368976'
        }]
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, title: 'Imported Book' })
      });

      const result = await service.checkAndHandleIsbn('9782070368976');
      expect(fetch).toHaveBeenCalled();
      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.isbn).toBe('9782070368976');
      expect(body.title).toBe('Test Book');
    });

    it('should retry 3 times before giving up on import', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        inventaireWorks: [{
          label: 'Test Book',
          inventaireUri: 'test-uri',
          isbn: '9782070368976'
        }]
      });

      let attempt = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 1 })
        });
      });

      const result = await service.checkAndHandleIsbn('9782070368976');
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });
  });
});
