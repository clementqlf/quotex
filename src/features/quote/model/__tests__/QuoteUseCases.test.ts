import { IQuoteRepository } from '@/src/entities/quote/api/IQuoteRepository';
import { QuoteUseCases } from '@/src/entities/quote/model/QuoteUseCases';
import { StorageService } from '@/src/shared/api/StorageService';

jest.mock('@/src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn().mockResolvedValue([]),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    QUOTES: 'quotes',
    PENDING_OPERATIONS: 'pending_operations',
  },
}));

const mockRepository: jest.Mocked<IQuoteRepository> = {
  getQuoteById: jest.fn(),
  getQuotes: jest.fn(),
  createQuote: jest.fn(),
  updateQuote: jest.fn(),
  deleteQuote: jest.fn(),
  toggleLike: jest.fn(),
  toggleSave: jest.fn(),
} as any;

const mockQueue = {
  enqueue: jest.fn(),
  getAll: jest.fn(),
  flush: jest.fn(),
} as any;

jest.mock('@/src/shared/lib/offline/OperationQueue', () => ({
  OperationQueue: { getInstance: () => mockQueue },
}));

const mockGetUser = jest.fn();
jest.mock('@/src/entities/user/api/AuthService', () => ({
  authService: { getUser: () => mockGetUser() },
}));

describe('QuoteUseCases', () => {
  let useCases: QuoteUseCases;

  beforeEach(() => {
    jest.clearAllMocks();
    useCases = new QuoteUseCases(mockRepository);
  });

  describe('toggleLike', () => {
    it('should toggle like/dislike and update via repository', async () => {
      mockRepository.getQuoteById.mockResolvedValue({
        id: 1, isLiked: false, likesCount: 10
      } as any);
      mockRepository.updateQuote.mockResolvedValue({} as any);

      const result = await useCases.toggleLike(1);
      expect(result).toEqual({ isLiked: true, likesCount: 11 });
      expect(mockRepository.updateQuote).toHaveBeenCalledWith(1, {
        isLiked: true, likesCount: 11
      });
    });

    it('should add to queue if offline', async () => {
      mockRepository.getQuoteById.mockResolvedValue({
        id: 1, isLiked: false, likesCount: 10
      } as any);
      mockRepository.updateQuote.mockRejectedValue(new Error('Offline'));

      const result = await useCases.toggleLike(1);
      expect(result).toEqual({ isLiked: true, likesCount: 11 });
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: 'LIKE',
        entityType: 'quote',
        entityId: 1,
      });
    });
  });

  describe('cleanField', () => {
    it('should return null for "Livre inconnu"', () => {
      // @ts-ignore - testing private method
      const result = useCases.cleanField('Livre inconnu');
      expect(result).toBeNull();
    });

    it('should return null for "Auteur inconnu"', () => {
      // @ts-ignore - testing private method
      const result = useCases.cleanField('Auteur inconnu');
      expect(result).toBeNull();
    });

    it('should return trimmed text otherwise', () => {
      // @ts-ignore - testing private method
      const result = useCases.cleanField('  Test  ');
      expect(result).toBe('Test');
    });
  });

  describe('createQuoteWithMatching', () => {
    it('should create quote with temp ID and add to queue', async () => {
      mockGetUser.mockResolvedValue({ id: '1', name: 'Test' });

      const result = await useCases.createQuoteWithMatching(
        'Test quote',
        'Test Book',
        'Test Author'
      );

      expect(result.id).toBeDefined();
      expect(result._isPending).toBe(true);
      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE',
          entityType: 'quote',
          payload: expect.objectContaining({
            text: 'Test quote',
            book: 'Test Book',
            author: 'Test Author'
          })
        })
      );
    });

    it('should clean empty fields', async () => {
      mockGetUser.mockResolvedValue({ id: '1', name: 'Test' });

      const result = await useCases.createQuoteWithMatching(
        'Test quote',
        '  ', // empty book
        null   // null author
      );

      expect(result.book).toBeNull();
      expect(result.author).toBeNull();
    });
  });

  describe('executeCreateQuote', () => {
    it('should sync quote and remap temporary ID to server ID in the queue', async () => {
      const mockOp = {
        id: 'op-123',
        type: 'CREATE',
        entityType: 'quote',
        entityId: 100, // temp ID
        payload: {
          text: 'Synced text',
          book: 'Synced Book',
          author: 'Synced Author',
          tempId: 100
        }
      } as any;

      const serverQuote = {
        id: 9999, // real server ID
        text: 'Synced text',
        book: 'Synced Book',
        author: 'Synced Author'
      } as any;

      mockRepository.createQuote.mockResolvedValue(serverQuote);
      mockQueue.remapEntityId = jest.fn().mockResolvedValue(undefined);

      // We need to mock StorageService.getItem / setItem since replaceTempQuote is called
      (StorageService.getItem as jest.Mock).mockResolvedValue([{ id: 100, text: 'Synced text' }]);

      // @ts-ignore - call private method for testing
      await useCases.executeCreateQuote(mockOp);

      expect(mockRepository.createQuote).toHaveBeenCalledWith('Synced text', 'Synced Book', 'Synced Author');
      expect(mockQueue.remapEntityId).toHaveBeenCalledWith(100, 9999, 'quote');
      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ id: 9999 })
        ])
      );
    });
  });
});
