import { buildBookImportPayload } from '../bookImport';

describe('bookImport', () => {
  describe('buildBookImportPayload', () => {
    it('should return null if no title', () => {
      const result = buildBookImportPayload({ title: undefined });
      expect(result).toBeNull();
    });

    it('should build valid payload from parsed data', () => {
      const bookData = {
        label: 'Test Book',
        authors: ['Author 1', 'Author 2'],
        description: 'Test description',
        image: 'http://cover.jpg',
        uri: 'http://inventaire.io/test',
        year: 2020,
        pages: 300,
        genre: 'Fiction'
      };

      const result = buildBookImportPayload({ bookData });
      expect(result).toEqual(expect.objectContaining({
        title: 'Test Book',
        authors: ['Author 1', 'Author 2'],
        description: 'Test description',
        cover: 'http://cover.jpg',
        inventaireUri: 'http://inventaire.io/test',
        year: 2020,
        pages: 300,
        genre: 'Fiction'
      }));
    });

    it('should set pages to null if pages=0', () => {
      const bookData = { label: 'Test', pages: 0 };
      const result = buildBookImportPayload({ bookData });
      expect(result?.pages).toBeNull();
    });

    it('should use title from book if not in bookData', () => {
      const book = { title: 'Book Title', pages: 200 };
      const result = buildBookImportPayload({ book });
      expect(result?.title).toBe('Book Title');
      expect(result?.pages).toBe(200);
    });

    it('should prioritize bookData over book', () => {
      const bookData = { label: 'From BookData', pages: 0 };
      const book = { title: 'From Book', pages: 200 };
      const result = buildBookImportPayload({ bookData, book });
      expect(result?.title).toBe('From BookData');
    });

    it('should filter empty authors', () => {
      const bookData = {
        label: 'Test',
        authors: ['Valid', '', '  ', null as any, undefined as any]
      };
      const result = buildBookImportPayload({ bookData });
      expect(result?.authors).toEqual(['Valid']);
    });
  });
});
