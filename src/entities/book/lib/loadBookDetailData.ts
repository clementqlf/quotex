import { z } from 'zod';
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
  console.warn('[BookDetail]', ...args);
};

const logError = (...args: any[]) => {
  console.error('[BookDetail]', ...args);
};

// Timeout configuration
const INVENTAIRE_TIMEOUT_MS = 10000;

// Zod schemas for Inventaire API validation
const InventaireEntityLabelsSchema = z.record(z.string().optional());
const InventaireEntityDescriptionsSchema = z.record(z.string().optional());
const InventaireEntityClaimsSchema = z.record(z.array(z.any()));

const InventaireEntitySchema = z.object({
  labels: InventaireEntityLabelsSchema.optional(),
  descriptions: InventaireEntityDescriptionsSchema.optional(),
  claims: InventaireEntityClaimsSchema.optional(),
  image: z.union([z.string(), z.object({ url: z.string().optional(), file: z.string().optional() }).partial()]).optional(),
});

const InventaireEntitiesResponseSchema = z.object({
  entities: z.record(InventaireEntitySchema).optional(),
});

const InventaireEditionsResponseSchema = z.object({
  editions: z.array(z.any()).optional(),
});

// Network error detection
const isNetworkError = (error: any): boolean => {
  if (error?.name === 'AbortError') return true;
  if (error?.code === 'ECONNABORTED') return true;
  if (error?.message?.includes('network')) return true;
  if (error?.message?.includes('Failed to fetch')) return true;
  if (error?.message?.includes('timeout')) return true;
  return false;
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

// Cache for Inventaire entities to avoid redundant requests
const inventaireEntitiesCache = new Map<string, Promise<Record<string, any>>>();

const fetchInventaireEntities = async (uris: string[]): Promise<Record<string, any>> => {
  if (!uris.length) return {};
  
  // Normalize URIs for cache key
  const normalizedUris = uris.map(uri => normalizeInventaireUri(uri)).filter(Boolean);
  if (normalizedUris.length === 0) return {};
  
  const cacheKey = normalizedUris.join('|');
  
  // Return cached promise if available
  if (inventaireEntitiesCache.has(cacheKey)) {
    logDebug('Cache hit for Inventaire entities', { cacheKey });
    return inventaireEntitiesCache.get(cacheKey)!;
  }
  
  const fetchPromise = fetchInventaireEntitiesUncached(normalizedUris);
  inventaireEntitiesCache.set(cacheKey, fetchPromise);
  
  // Auto-clean cache after 5 minutes
  setTimeout(() => inventaireEntitiesCache.delete(cacheKey), 300000);
  
  return fetchPromise;
};

const fetchInventaireEntitiesUncached = async (uris: string[]): Promise<Record<string, any>> => {
  const url = `https://inventaire.io/api/entities/by-uris?uris=${encodeURIComponent(uris.join('|'))}&lang=fr`;
  logDebug('Inventaire request', { uris, url });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INVENTAIRE_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: INVENTAIRE_HEADERS 
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      logError(`Inventaire API failed: ${response.status} ${response.statusText}`, { url, uris });
      return {};
    }
    
    const data = await response.json();
    // Validate response with Zod
    const validated = InventaireEntitiesResponseSchema.parse(data);
    return validated.entities || {};
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (isNetworkError(error)) {
      logError('Inventaire network error', { url, uris, error: error?.message });
    } else {
      logError('Inventaire fetch failed', { url, uris, error: String(error) });
    }
    return {};
  }
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INVENTAIRE_TIMEOUT_MS);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: INVENTAIRE_HEADERS 
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      logError(`Inventaire editions request failed: ${response.status} ${response.statusText}`, { url });
      return [];
    }
    
    const data = await response.json();
    // Validate response with Zod
    const validated = InventaireEditionsResponseSchema.parse(data);
    return validated.editions || [];
  } catch (error: any) {
    if (isNetworkError(error)) {
      logError('Inventaire editions network error', { workUri, error: error?.message });
    } else {
      logDebug('Failed to fetch Inventaire editions:', error);
    }
    return [];
  }
};

const buildFallbackBook = (inventaireUri: string, bookData?: string): Book | null => {
  const parsedBookData = (() => {
    if (!bookData) return null;
    try {
      return typeof bookData === 'string' ? JSON.parse(bookData) : bookData;
    } catch {
      return null;
    }
  })();

  if (!parsedBookData) return null;

  return {
    title: parsedBookData.title || parsedBookData.label || 'Livre inconnu',
    description: parsedBookData.description || 'Données indisponibles (mode hors ligne)',
    year: parsedBookData.year || 0,
    pages: parsedBookData.pages || 0,
    author: parsedBookData.authors?.[0] || parsedBookData.author || 'Auteur inconnu',
    rating: 0,
    genre: parsedBookData.genre || '',
    cover: parsedBookData.image || parsedBookData.cover || '',
    inventaireUri,
    openLibraryId: parsedBookData.openLibraryId,
    googleId: parsedBookData.googleId,
    isbn: parsedBookData.isbn,
    similarBooks: [],
  };
};

const fetchExternalInventaireBook = async (inventaireUri: string, bookData?: string): Promise<Book | null> => {
  try {
    logDebug('Fetching external Inventaire book', { inventaireUri });
    
    // Parse bookData safely
    const parsedBookData = (() => {
      if (!bookData) return null;
      try {
        return typeof bookData === 'string' ? JSON.parse(bookData) : bookData;
      } catch {
        return null;
      }
    })();

    // Batch all URIs we need in a single request: book + authors + genres
    const allUrisToFetch: string[] = [inventaireUri];
    
    // We'll need to fetch the main entity first to get author URIs and genre URIs
    const firstBatchEntities = await fetchInventaireEntities([inventaireUri]);
    const mainEntity = resolveInventaireEntity(firstBatchEntities, inventaireUri);
    
    if (!mainEntity) {
      logError('Main Inventaire entity not found', { inventaireUri });
      return null;
    }
    
    // Validate main entity with Zod
    const validatedMainEntity = InventaireEntitySchema.safeParse(mainEntity);
    if (!validatedMainEntity.success) {
      logError('Invalid Inventaire entity structure', { 
        inventaireUri, 
        error: validatedMainEntity.error.message 
      });
      return null;
    }
    
    // Extract URIs we need from main entity
    const claims = validatedMainEntity.data.claims || {};
    const authorUris = Array.isArray(claims['wdt:P50']) ? claims['wdt:P50'] : [];
    const genreUris = Array.from(new Set([...(claims['wdt:P136'] || []), ...(claims['wdt:P7937'] || [])]));
    
    // Add author and genre URIs to batch
    if (authorUris.length > 0) {
      allUrisToFetch.push(...authorUris.slice(0, 5)); // Limit to 5 authors
    }
    if (genreUris.length > 0) {
      allUrisToFetch.push(...genreUris.slice(0, 10)); // Limit to 10 genres
    }
    
    // Fetch all entities in a single batched request
    const allEntities = await fetchInventaireEntities(allUrisToFetch);
    
    // Resolve main entity from batch (might be under different key)
    const entity = resolveInventaireEntity(allEntities, inventaireUri);
    if (!entity) {
      logError('Could not resolve main entity from batch', { inventaireUri, availableKeys: Object.keys(allEntities) });
      return null;
    }

    // Safe access to entity properties with validation
    const entityLabels = entity.labels && typeof entity.labels === 'object' ? entity.labels : ({} as Record<string, string | undefined>);
    const entityDescriptions = entity.descriptions && typeof entity.descriptions === 'object' ? entity.descriptions : ({} as Record<string, string | undefined>);
    const safeClaims = entity.claims && typeof entity.claims === 'object' ? entity.claims : ({} as Record<string, any[]>);

    const title = (entityLabels['fr'] || entityLabels['en'] || parsedBookData?.label || parsedBookData?.title || 'Livre sans titre') as string;
    const description = (entityDescriptions['fr'] || entityDescriptions['en'] || parsedBookData?.description || '') as string;
    const image = getInventaireImageUrl(entity.image) || parsedBookData?.image || parsedBookData?.cover || '';
    
    // Safe year extraction
    let year = 0;
    const yearRaw = safeClaims['wdt:P577']?.[0];
    if (yearRaw !== undefined) {
      const yearStr = String(yearRaw);
      const yearMatch = yearStr.match(/^(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }
    }
    if (!year && parsedBookData?.year) {
      year = parsedBookData.year;
    }
    
    // First try to get pages from the work entity itself
    let pages = 0;
    const pagesRaw = safeClaims['wdt:P1104']?.[0];
    if (pagesRaw !== undefined) {
      const pagesNum = parseInt(String(pagesRaw), 10);
      if (!isNaN(pagesNum) && pagesNum > 0) {
        pages = pagesNum;
      }
    }
    
    // If no pages from work, try to get from editions (like backend does)
    if (!pages || pages === 0) {
      const editions = await fetchInventaireEditions(inventaireUri);
      // Safe array check
      if (Array.isArray(editions) && editions.length > 0) {
        // Find edition with pages, preferring French editions
        const frEdition = editions.find((e: any) => {
          return e?.languageUri === 'wd:Q150' && e?.pages && e.pages > 0;
        });
        const anyEditionWithPages = editions.find((e: any) => {
          return e?.pages && e.pages > 0;
        });
        const bestEdition = frEdition || anyEditionWithPages;
        if (bestEdition?.pages && typeof bestEdition.pages === 'number') {
          pages = bestEdition.pages;
          logDebug('Found pages from edition', { pages, editionLanguage: bestEdition.languageUri });
        }
      }
    }
    
    // Fallback to parsed book data
    if (!pages && parsedBookData?.pages) {
      pages = parsedBookData.pages;
    }
    
    // Resolve author from batched entities
    let author: string | Author = parsedBookData?.authors?.[0] || parsedBookData?.author || 'Auteur inconnu';
    if (authorUris.length > 0) {
      const authorEntity = resolveInventaireEntity(allEntities, authorUris[0]);
      if (authorEntity) {
        const validatedAuthor = InventaireEntitySchema.safeParse(authorEntity);
        if (validatedAuthor.success) {
          const authorLabels = validatedAuthor.data.labels || ({} as Record<string, string | undefined>);
          const authorDescriptions = validatedAuthor.data.descriptions || ({} as Record<string, string | undefined>);
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
    }

    // Resolve genres from batched entities
    let genre = parsedBookData?.genre || '';
    if (!genre && genreUris.length > 0) {
      const genreLabels = genreUris.map(uri => {
        const genreEntity = resolveInventaireEntity(allEntities, uri);
        if (!genreEntity) return null;
        const validatedGenre = InventaireEntitySchema.safeParse(genreEntity);
        if (!validatedGenre.success) return null;
        const genreLabelsObj = validatedGenre.data.labels || ({} as Record<string, string | undefined>);
        return genreLabelsObj['fr'] || genreLabelsObj['en'] || Object.values(genreLabelsObj)[0] || null;
      }).filter(Boolean) as string[];
      genre = genreLabels.join(', ');
    }

    const result: Book = {
      title,
      description,
      year,
      pages,
      author,
      rating: 0,
      genre,
      cover: image,
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
  } catch (error: any) {
    if (isNetworkError(error)) {
      logError('Network error fetching Inventaire book - service may be down', { 
        inventaireUri,
        error: error?.message,
        timestamp: new Date().toISOString()
      });
      return buildFallbackBook(inventaireUri, bookData);
    } else {
      logError('Error fetching Inventaire book details', { 
        inventaireUri,
        error: String(error),
        stack: error?.stack
      });
      throw error;
    }
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
