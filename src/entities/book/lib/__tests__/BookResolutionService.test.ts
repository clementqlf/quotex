import { resolveAndImportBook, ResolveAndImportBookParams, BookResolutionDependencies } from '../BookResolutionService';
import { loadBookDetailData } from '../loadBookDetailData';
import { buildBookImportPayload } from '../bookImport';

jest.mock('../loadBookDetailData');
jest.mock('../bookImport');

describe('BookResolutionService', () => {
  const mockDeps: BookResolutionDependencies = {
    getBookById: jest.fn(),
    getBookByTitle: jest.fn(),
    getBookByInventaireUri: jest.fn(),
    importBook: jest.fn(),
    getAuthorByName: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call loadBookDetailData and return resolved book and author', async () => {
    const mockBook = { id: 1, title: 'Test Book', author: 'Test Author' } as any;
    const mockAuthor = { id: 10, name: 'Test Author' } as any;

    (loadBookDetailData as jest.Mock).mockResolvedValue({
      book: mockBook,
      author: mockAuthor,
    });

    const params: ResolveAndImportBookParams = {
      title: 'Test Book',
      author: 'Test Author',
    };

    const result = await resolveAndImportBook(params, mockDeps);

    expect(loadBookDetailData).toHaveBeenCalledWith(
      expect.objectContaining({
        bookTitle: 'Test Book',
      })
    );
    expect(result).toEqual({ book: mockBook, author: mockAuthor });
  });

  it('should fallback to direct import if loadBookDetailData returns no book', async () => {
    (loadBookDetailData as jest.Mock).mockResolvedValue({ book: null, author: null });
    (buildBookImportPayload as jest.Mock).mockReturnValue({ title: 'Fallback Book' });

    const importedBook = { id: 99, title: 'Fallback Book', author: 'Author Name' } as any;
    (mockDeps.importBook as jest.Mock).mockResolvedValue(importedBook);
    (mockDeps.getAuthorByName as jest.Mock).mockResolvedValue({ id: 5, name: 'Author Name' });

    const params: ResolveAndImportBookParams = {
      title: 'Fallback Book',
      author: 'Author Name',
    };

    const result = await resolveAndImportBook(params, mockDeps);

    expect(mockDeps.importBook).toHaveBeenCalledWith({ title: 'Fallback Book' });
    expect(result.book).toEqual(importedBook);
  });
});
