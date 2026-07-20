import { Author, Book } from '@/src/shared/api/types';
import { loadBookDetailData } from './loadBookDetailData';
import { buildBookImportPayload, BookImportPayload } from './bookImport';

export interface ResolveAndImportBookParams {
  bookId?: number;
  title?: string;
  author?: string;
  inventaireUri?: string;
  googleId?: string;
  cover?: string;
  bookData?: any;
}

export interface BookResolutionDependencies {
  getBookById: (id: number) => Promise<Book | undefined>;
  getBookByTitle: (title: string) => Promise<Book | undefined>;
  getBookByInventaireUri: (uri: string) => Promise<Book | undefined>;
  importBook: (payload: BookImportPayload) => Promise<Book | undefined>;
  getAuthorByName: (name: string, inventaireUri?: string) => Promise<Author | undefined>;
}

/**
 * Service universel de résolution et d'importation de livre.
 * Garantit que 100% des livres créés/enrichis dans Quotex (Recherche, Scan, Citation manuelle, Page auteur)
 * passent par le même pipeline d'enrichissement et d'importation canonique.
 */
export const resolveAndImportBook = async (
  params: ResolveAndImportBookParams,
  deps: BookResolutionDependencies
): Promise<{ book: Book | null; author: Author | null }> => {
  const { bookId, title, author, inventaireUri, cover, bookData } = params;

  console.log('[BookResolutionService] resolveAndImportBook called with:', {
    bookId,
    title,
    author,
    inventaireUri,
    hasBookData: !!bookData,
  });

  // 1. Essayer d'enrichir et charger les données avec loadBookDetailData (qui gère la fusion Work + Édition)
  const result = await loadBookDetailData({
    bookId,
    bookTitle: title,
    inventaireUri,
    bookCover: cover,
    bookData,
    getBookById: deps.getBookById,
    getBookByTitle: deps.getBookByTitle,
    getBookByInventaireUri: deps.getBookByInventaireUri,
    importBook: deps.importBook,
    getAuthorByName: deps.getAuthorByName,
  });

  // 2. Si le livre n'a pas pu être résolu mais qu'un titre est présent, tenter un import de secours direct
  if (!result.book && (title || params.bookData)) {
    const importPayload = buildBookImportPayload({
      title,
      cover,
      bookData,
      inventaireUri,
    });

    if (importPayload) {
      console.log('[BookResolutionService] Fallback import with payload:', importPayload.title);
      const imported = await deps.importBook(importPayload);
      if (imported) {
        const resolvedAuthor = typeof imported.author === 'string' 
          ? await deps.getAuthorByName(imported.author)
          : (imported.author as Author) ?? null;
        return { book: imported, author: resolvedAuthor ?? null };
      }
    }
  }

  return result;
};
