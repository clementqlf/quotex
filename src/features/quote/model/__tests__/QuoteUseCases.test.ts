import { QuoteUseCases } from '../QuoteUseCases';
import { IQuoteRepository } from '../../api/IQuoteRepository';

const mockRepository: jest.Mocked<IQuoteRepository> = {
  getQuoteById: jest.fn(),
  getQuotes: jest.fn(),
  createQuote: jest.fn(),
  updateQuote: jest.fn(),
  deleteQuote: jest.fn(),
  toggleLike: jest.fn(),
  toggleSave: jest.fn(),
  getUser: jest.fn(),
} as any;

const mockQueue = {
  enqueue: jest.fn(),
  getAll: jest.fn(),
  flush: jest.fn(),
} as any;

jest.mock('@/src/shared/lib/offline/OperationQueue', () => ({
  OperationQueue: { getInstance: () => mockQueue },
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
      mockRepository.getUser.mockResolvedValue({ id: '1', name: 'Test' });

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
      mockRepository.getUser.mockResolvedValue({ id: '1', name: 'Test' });

      const result = await useCases.createQuoteWithMatching(
        'Test quote',
        '  ', // empty book
        null   // null author
      );

      expect(result.book).toBeNull();
      expect(result.author).toBeNull();
    });
  });
});
