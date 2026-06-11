import { authorService } from '../src/entities/author/api/AuthorService';
import { SupabaseAuthorRepository } from '../src/entities/author/api/SupabaseAuthorRepository';
import { STORAGE_KEYS, StorageService } from '../src/shared/api/StorageService';

jest.mock('../src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
  STORAGE_KEYS: {
    AUTHORS: 'authors',
    BOOKS: 'books',
  },
}));

jest.mock('../src/entities/author/api/AuthorService', () => ({
  authorService: {
    getAuthors: jest.fn(),
    getBooks: jest.fn(),
    toggleSaveAuthor: jest.fn(),
    toggleSaveBook: jest.fn(),
    updateBookStatus: jest.fn(),
  },
}));

describe('SupabaseAuthorRepository', () => {
  let repository: SupabaseAuthorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // On force l'instance à être recréée si besoin
    (SupabaseAuthorRepository as any).instance = null;
    repository = SupabaseAuthorRepository.getInstance();
  });

  it('devrait suivre le pattern Singleton', () => {
    const instance1 = SupabaseAuthorRepository.getInstance();
    const instance2 = SupabaseAuthorRepository.getInstance();
    expect(instance1).toBe(instance2);
  });

  describe('toggleSaveAuthor', () => {
    it('devrait appeler le service puis rafraichir le cache', async () => {
      const mockResult = { isSaved: true, followersCount: 10 };
      const mockAuthors = [{ id: 1, name: 'Author 1' }];

      (authorService.toggleSaveAuthor as jest.Mock).mockResolvedValue(mockResult);
      (authorService.getAuthors as jest.Mock).mockResolvedValue(mockAuthors);

      const result = await repository.toggleSaveAuthor(1);

      expect(authorService.toggleSaveAuthor).toHaveBeenCalledWith(1);
      expect(authorService.getAuthors).toHaveBeenCalled();
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.AUTHORS, mockAuthors);
      expect(result).toEqual(mockResult);
    });
  });

  describe('toggleSaveBook', () => {
    it('devrait appeler le service puis rafraichir le cache', async () => {
      const mockBooks = [{ id: 1, title: 'Book 1' }];

      (authorService.toggleSaveBook as jest.Mock).mockResolvedValue(undefined);
      (authorService.getBooks as jest.Mock).mockResolvedValue(mockBooks);

      await repository.toggleSaveBook(1);

      expect(authorService.toggleSaveBook).toHaveBeenCalledWith(1);
      expect(authorService.getBooks).toHaveBeenCalled();
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.BOOKS, mockBooks);
    });
  });

  describe('updateBookStatus', () => {
    it('devrait appeler le service puis rafraichir le cache', async () => {
      const mockBooks = [{ id: 1, title: 'Book 1', readingStatus: 'read' }];

      (authorService.updateBookStatus as jest.Mock).mockResolvedValue(undefined);
      (authorService.getBooks as jest.Mock).mockResolvedValue(mockBooks);

      await repository.updateBookStatus(1, 'read');

      expect(authorService.updateBookStatus).toHaveBeenCalledWith(1, 'read');
      expect(authorService.getBooks).toHaveBeenCalled();
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.BOOKS, mockBooks);
    });
  });
});
