import { Author, Book } from '@/src/shared/api/types';
import { getAuthorName } from '@/src/shared/lib/dataHelpers';
import { buildBookImportPayload } from './bookImport';
import type { BookImportPayload } from './bookImport';

// Debug flag - set to false to disable most logs in production
const DEBUG_BOOK_DETAIL = false;

const logDebug = (...args: any[]) => {
  if (DEBUG_BOOK_DETAIL) console.warn('[BookDetail]', ...args);
};

const logWarn = (...args: any[]) => {
  // Logs disabled in production. Use console.error for actual errors.
  // if (DEBUG_BOOK_DETAIL) console.warn('[BookDetail]', ...args);
};

const isNetworkError = (error: any): boolean => {
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) return true;
  if (error instanceof TypeError && error.message.includes('NetworkError')) return true;
  if (typeof error === 'object' && error?.message?.includes('network')) return true;
  if (typeof error === 'object' && error?.message?.includes('fetch')) return true;
  return false;
};

const buildFallbackBook = (inventaireUri: string, bookData?: string): Book => {
  const parsedBookData = (() => {
    if (!bookData) return null;
    try {
      return typeof bookData === 'string' ? JSON.parse(bookData) : bookData;
    } catch {
      return null;
    }
  })();

  return {
    id: 0,
    title: parsedBookData?.title || parsedBookData?.label || 'Livre inconnu',
    description: parsedBookData?.description || '',
    year: parsedBookData?.year || 0,
    pages: parsedBookData?.pages || 0,
    rating: 0,
    author: parsedBookData?.author || parsedBookData?.authors?.[0] || 'Auteur inconnu',
    genre: parsedBookData?.genre || '',
    cover: parsedBookData?.cover || parsedBookData?.image || '',
    inventaireUri,
    openLibraryId: parsedBookData?.openLibraryId,
    googleId: parsedBookData?.googleId,
    isbn: parsedBookData?.isbn,
    similarBooks: [],
  };
};

type LoadBookDetailDataArgs = {
  bookId?: number;
  bookTitle?: string;
  inventaireUri?: string;
  bookCover?: string;
  bookData?: string;
  getBookById: (id: number) => Promise<Book | undefined>;
  getBookByTitle: (title: string) => Promise<Book | undefined>;
  getBookByInventaireUri: (inventaireUri: string) => Promise<Book | undefined>;
  importBook: (bookData: BookImportPayload) => Promise<Book | undefined>;
  getAuthorByName: (name: string) => Promise<Author | undefined>;
};

const isBookEnriched = (book: Book | null | undefined): boolean => {
  return !!(book && book.description && book.description.length >= 50);
};

const shouldRefreshFromInventaire = (book: Book | null | undefined): boolean => {
  if (!book) return false;
  // Don't refresh if book was just imported (we already have server data)
  if (book.id && book.inventaireUri) return false;
  return !book.description || book.description.length < 50 || !book.pages || book.pages <= 0;
};

const INVENTAIRE_HEADERS = { 'User-Agent': 'QuotexApp/1.0' };
const normalizeInventaireUri = (uri?: string | null): string => {
  if (!uri) return '';
  return uri.trim().toLowerCase().replace(/^wd:/, '');
};

const getInventaireImageUrl = (imageObj: any): string | null => {
  if (!imageObj) return null;
  if (typeof imageObj === 'string') return imageObj.startsWith('http') ? imageObj : (imageObj.startsWith('/img/') ? `https://inventaire.io${imageObj}` : null);
  if (imageObj.url) return imageObj.url.startsWith('http') ? imageObj.url : `https://inventaire.io${imageObj.url}`;
  if (imageObj.file) return imageObj.file.startsWith('http') ? imageObj.file : (imageObj.file.startsWith('/img/') ? `https://inventaire.io${imageObj.file}` : null);
  return null;
};

const fetchInventaireEntities = async (uris: string[]): Promise<Record<string, any>> => {
  if (!uris.length) return {};
  const url = `https://inventaire.io/api/entities/by-uris?uris=${encodeURIComponent(uris.join('|'))}&lang=fr`;
  logDebug('Inventaire request', { uris });
  const response = await fetch(url, { headers: INVENTAIRE_HEADERS });
  if (!response.ok) return {};
  const data = await response.json();
  return data.entities || {};
};

const resolveInventaireEntity = (entities: Record<string, any>, uri: string): any | null => {
  if (entities[uri]) return entities[uri];
  const stripped = uri.replace(/^wd:/, '');
  const fallbackKey = Object.keys(entities).find(key => key === stripped || key.endsWith(stripped));
  if (fallbackKey) return entities[fallbackKey];
  const firstKey = Object.keys(entities)[0];
  return firstKey ? entities[firstKey] : null;
};

// Helper to fetch editions from Inventaire for a work
const fetchInventaireEditions = async (workUri: string): Promise<any[]> => {
  try {
    const normalizedUri = normalizeInventaireUri(workUri);
    const url = `https://inventaire.io/api/entities/${encodeURIComponent(normalizedUri)}/editions?lang=fr`;
    logDebug('Fetching Inventaire editions', { workUri: normalizedUri, url });
    const response = await fetch(url, { headers: INVENTAIRE_HEADERS });
    if (!response.ok) {
      logDebug('Inventaire editions request failed', { status: response.status });
      return [];
    }
    const data = await response.json();
    return Array.isArray(data?.editions) ? data.editions : [];
  } catch (error) {
    logDebug('Failed to fetch Inventaire editions:', error);
    return [];
  }
};

const fetchExternalInventaireBook = async (inventaireUri: string, bookData?: string): Promise<Book | null> => {
  try {
    logDebug('Fetching external Inventaire book', { inventaireUri });
    
    // First fetch the main book entity to get claims (authorUris, genreUris)
    const initialEntities = await fetchInventaireEntities([inventaireUri]);
    const entity = resolveInventaireEntity(initialEntities, inventaireUri);
    if (!entity) return null;

    const claims = entity.claims || {};
    const authorUris = Array.isArray(claims['wdt:P50']) ? claims['wdt:P50'] : [];
    const genreUris = Array.from(new Set([...(claims['wdt:P136'] || []), ...(claims['wdt:P7937'] || [])])).slice(0, 10);
    
    // Batch all URIs in a single request
    const allUris = [inventaireUri, ...authorUris, ...genreUris];
    const entities = await fetchInventaireEntities(allUris);
    
    const mainEntity = resolveInventaireEntity(entities, inventaireUri);
    if (!mainEntity) return null;

    const parsedBookData = (() => {
      if (!bookData) return null;
      try {
        return typeof bookData === 'string' ? JSON.parse(bookData) : bookData;
      } catch {
        return null;
      }
    })();

    const title = (mainEntity.labels && typeof mainEntity.labels === 'object' && mainEntity.labels['fr'])
      ? mainEntity.labels['fr']
      : (mainEntity.labels?.['en'] || parsedBookData?.label || parsedBookData?.title || 'Sans titre');
    
    const description = (mainEntity.descriptions && typeof mainEntity.descriptions === 'object' && mainEntity.descriptions['fr'])
      ? mainEntity.descriptions['fr']
      : (mainEntity.descriptions?.['en'] || parsedBookData?.description || null);
    const image = getInventaireImageUrl(mainEntity.image) || parsedBookData?.image || parsedBookData?.cover || null;
    const yearRaw = claims['wdt:P577']?.[0];
    const year = yearRaw ? parseInt(String(yearRaw).substring(0, 4)) : (parsedBookData?.year ?? null);
    
    // First try to get pages from the work entity itself
    let pages = null;
    const pagesRaw = claims['wdt:P1104']?.[0];
    if (pagesRaw) {
      pages = parseInt(String(pagesRaw));
    }
    
    // If no pages from work, try to get from editions (like backend does)
    if (!pages || pages === 0) {
      const editions = await fetchInventaireEditions(inventaireUri);
      if (editions.length > 0) {
        // Find edition with pages, preferring French editions
        const frEdition = editions.find((e: any) => e.languageUri === 'wd:Q150' && e.pages && e.pages > 0);
        const anyEditionWithPages = editions.find((e: any) => e.pages && e.pages > 0);
        const bestEdition = frEdition || anyEditionWithPages;
        if (bestEdition?.pages) {
          pages = bestEdition.pages;
          logDebug('Found pages from edition', { pages, editionLanguage: bestEdition.languageUri });
        }
      }
    }
    
    // Fallback to parsed book data
    if (!pages) {
      pages = parsedBookData?.pages ?? null;
    }

    let author: string | Author = parsedBookData?.authors?.[0] || parsedBookData?.author || 'Auteur inconnu';
    if (authorUris.length > 0) {
      const authorEntity = resolveInventaireEntity(entities, authorUris[0]);
      if (authorEntity) {
        const authorLabels = authorEntity.labels || {};
        const authorDescriptions = authorEntity.descriptions || {};
        author = {
          name: authorLabels['fr'] || authorLabels['en'] || parsedBookData?.authors?.[0] || 'Auteur inconnu',
          description: authorDescriptions['fr'] || authorDescriptions['en'] || '',
          image: getInventaireImageUrl(authorEntity.image) || '',
          birthDate: '',
          nationality: '',
          inventaireUri: authorUris[0],
        } as Author;
      }
    }

    let genre = parsedBookData?.genre || '';
    if (!genre && genreUris.length > 0) {
      const genreLabels = genreUris.map(uri => {
        const genreEntity = resolveInventaireEntity(entities, uri);
        if (!genreEntity?.labels) return null;
        return genreEntity.labels['fr'] || genreEntity.labels['en'] || Object.values(genreEntity.labels)[0] || null;
      }).filter(Boolean);
      genre = genreLabels.join(', ');
    }

    const result: Book = {
      title: title || parsedBookData?.title || 'Livre sans titre',
      description: description || '',
      year: year ?? 0,
      pages: pages ?? 0,
      author,
      rating: 0,
      genre,
      cover: image || '',
      inventaireUri,
      openLibraryId: parsedBookData?.openLibraryId,
      googleId: parsedBookData?.googleId,
      isbn: parsedBookData?.isbn,
      similarBooks: [],
    };
    
    logDebug('External Inventaire book resolved', {
      title: result.title,
      pages: result.pages,
      year: result.year,
      hasDescription: !!result.description,
      hasCover: !!result.cover,
    });
    
    return result;
  } catch (error) {
    if (isNetworkError(error)) {
      return buildFallbackBook(inventaireUri, bookData);
    }
    logWarn('Failed to fetch Inventaire book details:', error);
    throw error;
  }
};

export const loadBookDetailData = async ({
  bookId,
  bookTitle,
  inventaireUri,
  bookCover,
  bookData,
  getBookById,
  getBookByTitle,
  getBookByInventaireUri,
  importBook,
  getAuthorByName,
}: LoadBookDetailDataArgs): Promise<{ book: Book | null; author: Author | null }> => {
  logDebug('Loading book detail', {
    bookId,
    bookTitle,
    inventaireUri,
    hasBookData: !!bookData,
  });

  const normalizedInventaireUri = normalizeInventaireUri(inventaireUri);
  let book: Book | undefined;
  let resolutionSource: 'id' | 'title' | 'inventaireUri' | 'externalInventaire' | 'importedRefresh' | 'none' = 'none';

  // Try to find existing book by various methods
  if (bookId) {
    logDebug('Looking up by ID', { bookId });
    book = await getBookById(bookId);
    if (book) {
      resolutionSource = 'id';
      logDebug('Found by ID', { id: book.id, title: book.title, pages: book.pages });
    }
  }

  if (!book && bookTitle) {
    logDebug('Looking up by title', { bookTitle });
    book = await getBookByTitle(bookTitle);
    if (book) {
      resolutionSource = 'title';
      logDebug('Found by title', { id: book.id, title: book.title, pages: book.pages });
    }
  }

  const importPayload = buildBookImportPayload({
    title: bookTitle,
    cover: bookCover,
    bookData,
    book,
  });

  if (!importPayload?.inventaireUri) {
    logDebug('No import payload available');
  }

  // If we have an existing book with inventaireUri, try to get fresh data from server
  if (book && importPayload?.inventaireUri && shouldRefreshFromInventaire(book)) {
    logDebug('Refreshing existing book by inventaireUri', { bookId: book.id, inventaireUri: importPayload.inventaireUri });
    const refreshedBook = await getBookByInventaireUri(importPayload.inventaireUri);
    if (refreshedBook) {
      book = refreshedBook;
      resolutionSource = 'inventaireUri';
      logDebug('Refreshed by inventaireUri', { id: book.id, title: book.title, pages: book.pages });
    }
  }

  // Try direct lookup by inventaireUri
  if ((!book || shouldRefreshFromInventaire(book)) && importPayload?.inventaireUri) {
    logDebug('Looking up by inventaireUri', { inventaireUri: importPayload.inventaireUri });
    book = await getBookByInventaireUri(importPayload.inventaireUri);
    if (book) {
      resolutionSource = 'inventaireUri';
      logDebug('Found by inventaireUri', { id: book.id, title: book.title, pages: book.pages });
    }
  }

  // If still no book or book needs enrichment, fetch from Inventaire
  if ((!book || shouldRefreshFromInventaire(book)) && importPayload?.inventaireUri) {
    logDebug('Fetching from external Inventaire', { inventaireUri: importPayload.inventaireUri });
    const externalBook = await fetchExternalInventaireBook(importPayload.inventaireUri, bookData);
    
    if (externalBook) {
      resolutionSource = 'externalInventaire';
      const importData = buildBookImportPayload({
        title: externalBook.title,
        cover: externalBook.cover,
        bookData,
        book: externalBook,
      });

      if (importData) {
        logDebug('Importing book', {
          title: importData.title,
          inventaireUri: importData.inventaireUri,
          pages: importData.pages,
          year: importData.year,
        });
        
        const importedBook = await importBook(importData);
        
        if (importedBook?.id) {
          logDebug('Import successful, refreshing from server', { id: importedBook.id });
          
          // Wait a moment to allow backend enrichment to complete (pages, description, etc.)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Fetch the book from server to get enriched data
          // Retry up to 3 times if pages are still 0 or missing
          let refreshedBook = await getBookById(importedBook.id);
          let retryCount = 0;
          const maxRetries = 2;
          
          while (refreshedBook && (refreshedBook.pages === 0 || !refreshedBook.pages) && retryCount < maxRetries) {
            logDebug('Pages still 0, waiting and retrying...', { retry: retryCount + 1, id: importedBook.id });
            await new Promise(resolve => setTimeout(resolve, 1000));
            refreshedBook = await getBookById(importedBook.id);
            retryCount++;
          }
          
          if (refreshedBook) {
            logDebug('Refreshed imported book from server', {
              id: refreshedBook.id,
              title: refreshedBook.title,
              pages: refreshedBook.pages,
              descriptionLength: refreshedBook.description?.length ?? 0,
              year: refreshedBook.year,
              retries: retryCount,
            });
            
            // Final fallback: if pages still 0 after all retries, fetch from Inventaire directly
            if ((!refreshedBook.pages || refreshedBook.pages === 0) && importPayload?.inventaireUri) {
              logDebug('Pages still 0 after retries, fetching from Inventaire as final fallback', {
                id: refreshedBook.id,
                inventaireUri: importPayload.inventaireUri,
              });
              const finalExternalBook = await fetchExternalInventaireBook(importPayload.inventaireUri);
              if (finalExternalBook?.pages && finalExternalBook.pages > 0) {
                logDebug('Final fallback: using Inventaire pages', {
                  id: refreshedBook.id,
                  inventairePages: finalExternalBook.pages,
                });
                // Create a new book object with the correct pages
                book = {
                  ...refreshedBook,
                  pages: finalExternalBook.pages,
                  year: finalExternalBook.year || refreshedBook.year,
                  description: finalExternalBook.description || refreshedBook.description,
                  cover: finalExternalBook.cover || refreshedBook.cover,
                };
              } else {
                book = refreshedBook;
              }
            } else {
              book = refreshedBook;
            }
            resolutionSource = 'importedRefresh';
          } else {
            // Fallback to imported book if refresh fails
            book = importedBook;
            logDebug('Using imported book as fallback', { id: importedBook.id, pages: importedBook.pages });
          }
        } else {
          logDebug('Import failed, using external book object');
          book = externalBook;
        }
      } else {
        logDebug('Could not build import payload, using external book');
        book = externalBook;
      }
    }
  }

  if (book && bookCover && book.cover !== bookCover) {
    logDebug('Overriding cover from route param', { bookCover, previousCover: book.cover });
    book = { ...book, cover: bookCover };
  }

  if (!book) {
    logWarn('No book resolved');
    return { book: null, author: null };
  }

  logDebug('Book resolved', {
    source: resolutionSource,
    id: book.id,
    title: book.title,
    inventaireUri: book.inventaireUri,
    pages: book.pages,
    year: book.year,
    hasDescription: !!book.description,
    descriptionLength: book.description?.length ?? 0,
    hasCover: !!book.cover,
    author: getAuthorName(book.author),
  });

  // Resolve author
  const authorName = getAuthorName(book.author);
  logDebug('Resolving author', { authorName });
  const author = authorName ? await getAuthorByName(authorName) : undefined;

  logDebug('Book detail loading complete', {
    bookId: book.id,
    title: book.title,
    authorFound: !!author,
    authorId: author?.id,
  });

  return {
    book,
    author: author ?? null,
  };
};
