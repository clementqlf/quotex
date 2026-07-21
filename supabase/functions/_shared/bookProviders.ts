import { 
  searchInventaireWorks, 
  getInventaireBookByIsbn, 
  findWorkUriByTitleAndAuthor,
  getInventaireWorkDetails,
  getInventaireAuthorDetails,
  getWorkEditionUris,
  getEditionsDetails,
  compareAuthorNames,
  sortEditionsNewestFirst,
  extractBestCoverFromEditions,
  extractInitialPublishYear,
} from './inventaire.api.ts';
import { searchGoogleBooks } from './googlebooks.ts';
import { selectBestGoogleBookMatch, scoreBookCandidate } from './googlebooks.match.ts';
import { normalizeTitle } from './inventaire.ts';

export interface BookSearchResult {
  id: string; // The ID specific to the provider
  uri: string; // The standardized URI (e.g. wd:Q... or googlebooks:...)
  inventaireUri?: string; // Compatibility property for Inventaire
  googleId?: string; // Compatibility property for Google Books
  title: string;
  label: string; // Compatibility property for frontend
  cover: string | null;
  image: string | null; // Compatibility property for frontend
  authors: string[];
  authorUris?: string[];
  description: string;
  source: 'Inventaire' | 'Google Books';
  isbn?: string | null;
  year?: number | null;
  pages?: number | null;
  genre?: string | null;
  metadataSources?: Record<string, string>;
}

export interface BookProvider {
  name: 'Inventaire' | 'Google Books';
  search(query: string, limit?: number): Promise<BookSearchResult[]>;
  searchByIsbn(isbn: string): Promise<BookSearchResult | null>;
  resolveBestMatch(title: string, authorName: string): Promise<BookSearchResult | null>;
}

// ─── Provider: Inventaire ───────────────────────────────────────────────────
export const InventaireBookProvider: BookProvider = {
  name: 'Inventaire',
  async search(query: string, limit = 10): Promise<BookSearchResult[]> {
    try {
      const results = await searchInventaireWorks(query, limit);
      const mapped: BookSearchResult[] = results.map(r => ({
        id: r.id,
        uri: r.uri,
        inventaireUri: r.uri,
        title: r.label,
        label: r.label,
        cover: r.image || null,
        image: r.image || null,
        authors: r.authors || [],
        authorUris: r.authorUris || [],
        description: '',
        source: 'Inventaire'
      }));

      // Fetch work details in parallel for top 3 results to enrich description and extra metadata
      const topN = mapped.slice(0, 3);
      const details = await Promise.allSettled(
        topN.map(r => getInventaireWorkDetails(r.uri))
      );
      details.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          const d = result.value;
          if (d.description) topN[i].description = d.description;
          if (d.image && !topN[i].cover) {
            topN[i].cover = d.image;
            topN[i].image = d.image;
          }
          if (d.pages) topN[i].pages = d.pages;
          if (d.year) topN[i].year = d.year;
        }
      });

      return mapped;
    } catch (e) {
      console.warn(`[Inventaire Book Provider] Search failed for "${query}":`, e);
      return [];
    }
  },

  async searchByIsbn(isbn: string): Promise<BookSearchResult | null> {
    try {
      const res = await getInventaireBookByIsbn(isbn);
      if (!res) return null;
      const uri = res.uri || res.inventaireUri;
      const inventaireUri = res.inventaireUri || res.uri;
      return {
        id: uri,
        uri: uri,
        inventaireUri: inventaireUri,
        title: res.title,
        label: res.title,
        cover: res.cover || res.image || null,
        image: res.cover || res.image || null,
        authors: res.authors || [],
        authorUris: res.authorUris || [],
        description: res.description || '',
        isbn: res.isbn,
        year: res.year,
        pages: res.pages,
        source: 'Inventaire'
      };
    } catch (e) {
      console.warn(`[Inventaire Book Provider] ISBN search failed for ${isbn}:`, e);
      return null;
    }
  },

  async resolveBestMatch(title: string, authorName: string): Promise<BookSearchResult | null> {
    try {
      const workUri = await findWorkUriByTitleAndAuthor(title, authorName);
      if (!workUri) return null;

      const workDetails = await getInventaireWorkDetails(workUri);
      let resolvedAuthorName = authorName;

      if (workDetails?.authorUris && workDetails.authorUris.length > 0) {
        const authorDetails = await getInventaireAuthorDetails(workDetails.authorUris[0]);
        if (authorDetails?.name) {
          resolvedAuthorName = authorDetails.name;
        }
      }

      let cover = workDetails?.image || null;
      let description = workDetails?.description || '';
      let pages = workDetails?.pages || null;
      let year = workDetails?.year || null;

      // Inspect editions of the work using DRY helpers for cover, pages, description, and year
      const editionUris = await getWorkEditionUris(workUri);
      if (editionUris && editionUris.length > 0) {
        const editions = await getEditionsDetails(editionUris);
        const sortedEditions = sortEditionsNewestFirst(editions);

        const edCover = extractBestCoverFromEditions(sortedEditions);
        if (edCover) cover = edCover;

        const bestEditionWithDesc = sortedEditions.find(e => !!(e as any).description);
        if (!description && (bestEditionWithDesc as any)?.description) {
          description = (bestEditionWithDesc as any).description;
        }

        const bestEditionWithPages = sortedEditions.find(e => !!e.pages && e.pages > 0);
        if (!pages && bestEditionWithPages?.pages) {
          pages = bestEditionWithPages.pages;
        }

        year = extractInitialPublishYear(sortedEditions, year);
      }

      const metadataSources: Record<string, string> = {};
      if (cover) metadataSources.cover = 'inventaire';
      if (description) metadataSources.description = 'inventaire';
      if (pages) metadataSources.pages = 'inventaire';
      if (year) metadataSources.year = 'inventaire';

      return {
        id: workUri,
        uri: workUri,
        inventaireUri: workUri,
        title: workDetails?.title || title,
        label: workDetails?.title || title,
        cover: cover,
        image: cover,
        authors: [resolvedAuthorName],
        authorUris: workDetails?.authorUris || [],
        description: description,
        year: year,
        pages: pages,
        source: 'Inventaire',
        metadataSources,
      };
    } catch (e) {
      console.warn(`[Inventaire Book Provider] Resolve failed for "${title}" by "${authorName}":`, e);
      return null;
    }
  }
};

// ─── Provider: Google Books ──────────────────────────────────────────────────
export const GoogleBooksProvider: BookProvider = {
  name: 'Google Books',
  async search(query: string, limit = 10): Promise<BookSearchResult[]> {
    try {
      const results = await searchGoogleBooks(query, limit);
      return results.map(r => ({
        id: r.id,
        uri: r.uri,
        googleId: r.id,
        title: r.title,
        label: r.title,
        cover: r.cover || r.image || null,
        image: r.cover || r.image || null,
        authors: r.authors || [],
        description: r.description || '',
        isbn: r.isbn,
        year: r.year,
        pages: r.pages,
        genre: r.genre,
        source: 'Google Books',
        metadataSources: {
          ...(r.cover || r.image ? { cover: 'googlebooks' } : {}),
          ...(r.description ? { description: 'googlebooks' } : {}),
          ...(r.pages ? { pages: 'googlebooks' } : {}),
          ...(r.year ? { year: 'googlebooks' } : {}),
        }
      }));
    } catch (e) {
      console.warn(`[Google Books Provider] Search failed for "${query}":`, e);
      return [];
    }
  },

  async searchByIsbn(isbn: string): Promise<BookSearchResult | null> {
    try {
      const results = await searchGoogleBooks(`isbn:${isbn}`, 1);
      if (results.length === 0) return null;
      const r = results[0];
      return {
        id: r.id,
        uri: r.uri,
        googleId: r.id,
        title: r.title,
        label: r.title,
        cover: r.cover || r.image || null,
        image: r.cover || r.image || null,
        authors: r.authors || [],
        description: r.description || '',
        isbn: r.isbn,
        year: r.year,
        pages: r.pages,
        genre: r.genre,
        source: 'Google Books',
        metadataSources: {
          ...(r.cover || r.image ? { cover: 'googlebooks' } : {}),
          ...(r.description ? { description: 'googlebooks' } : {}),
          ...(r.pages ? { pages: 'googlebooks' } : {}),
          ...(r.year ? { year: 'googlebooks' } : {}),
        }
      };
    } catch (e) {
      console.warn(`[Google Books Provider] ISBN search failed for ${isbn}:`, e);
      return null;
    }
  },

  async resolveBestMatch(title: string, authorName: string): Promise<BookSearchResult | null> {
    try {
      const candidates = await searchGoogleBooks(title, 10, false);
      const best = selectBestGoogleBookMatch(candidates, title, authorName);
      if (!best) return null;

      const matchedAuthorName = best.authors?.find((candidateAuthor) =>
        compareAuthorNames(candidateAuthor, authorName)
      ) || best.authors?.[0] || authorName;

      const cover = best.cover || best.image || null;
      return {
        id: best.id,
        uri: best.uri,
        googleId: best.id,
        title: best.title,
        label: best.title,
        cover: cover,
        image: cover,
        authors: [matchedAuthorName],
        description: best.description || '',
        isbn: best.isbn,
        year: best.year,
        pages: best.pages,
        genre: best.genre,
        source: 'Google Books',
        metadataSources: {
          ...(cover ? { cover: 'googlebooks' } : {}),
          ...(best.description ? { description: 'googlebooks' } : {}),
          ...(best.pages ? { pages: 'googlebooks' } : {}),
          ...(best.year ? { year: 'googlebooks' } : {}),
        }
      };
    } catch (e) {
      console.warn(`[Google Books Provider] Resolve failed for "${title}" by "${authorName}":`, e);
      return null;
    }
  }
};

// ─── Orchestrator: bookSearchService ─────────────────────────────────────────
export const bookSearchService = {
  providers: [
    InventaireBookProvider,
    GoogleBooksProvider
  ] as BookProvider[],

  register(provider: BookProvider) {
    this.providers.push(provider);
  },

  /**
   * Resolves book sequential match (e.g. fallback strategy for sync-quotes)
   */
  async resolveSequentialMatch(title: string, authorName: string): Promise<BookSearchResult | null> {
    let bestMatch: BookSearchResult | null = null;

    for (const provider of this.providers) {
      try {
        const match = await provider.resolveBestMatch(title, authorName);
        if (match) {
          console.log(`[BookSearchService] Resolved candidate via: ${provider.name} (hasCover=${!!match.cover}, hasDesc=${!!match.description})`);
          const providerKey = match.source === 'Google Books' ? 'googlebooks' : 'inventaire';
          if (!bestMatch) {
            bestMatch = {
              ...match,
              metadataSources: {
                ...(match.cover ? { cover: providerKey } : {}),
                ...(match.description ? { description: providerKey } : {}),
                ...(match.pages ? { pages: providerKey } : {}),
                ...(match.year ? { year: providerKey } : {}),
                ...match.metadataSources,
              }
            };
          } else {
            if (!bestMatch.metadataSources) bestMatch.metadataSources = {};

            // Enrich bestMatch with richer metadata from alternative providers
            if ((!bestMatch.cover || bestMatch.cover.includes('wikimedia.org')) && match.cover) {
              bestMatch.cover = match.cover;
              bestMatch.image = match.cover;
              bestMatch.metadataSources.cover = providerKey;
            }
            if ((!bestMatch.description || bestMatch.description.length < 30) && match.description) {
              bestMatch.description = match.description;
              bestMatch.metadataSources.description = providerKey;
            }
            if (!bestMatch.googleId && match.googleId) {
              bestMatch.googleId = match.googleId;
              bestMatch.metadataSources.googleId = providerKey;
            }
            if ((!bestMatch.pages || bestMatch.pages === 0) && match.pages) {
              bestMatch.pages = match.pages;
              bestMatch.metadataSources.pages = providerKey;
            }
            if ((!bestMatch.year || bestMatch.year === 0) && match.year) {
              bestMatch.year = match.year;
              bestMatch.metadataSources.year = providerKey;
            }
          }
          // If our best match has both a valid cover and a full description, return early
          if (bestMatch.cover && bestMatch.description && bestMatch.description.length >= 30) {
            return bestMatch;
          }
        }
      } catch (e) {
        console.warn(`[BookSearchService] Provider ${provider.name} failed resolving "${title}" by "${authorName}":`, e);
      }
    }

    return bestMatch;
  },

  /**
   * Search by ISBN with fallback priority
   */
  async searchByIsbn(isbn: string): Promise<BookSearchResult | null> {
    for (const provider of this.providers) {
      try {
        const match = await provider.searchByIsbn(isbn);
        if (match) {
          console.log(`[BookSearchService] Resolved ISBN ${isbn} via: ${provider.name}`);
          return match;
        }
      } catch (e) {
        console.warn(`[BookSearchService] Provider ${provider.name} failed ISBN search for ${isbn}:`, e);
      }
    }
    return null;
  },

  /**
   * Search in parallel across all providers and merge/deduplicate results
   */
  async searchParallel(query: string, limit = 10): Promise<{ results: BookSearchResult[], apiFailed: boolean }> {
    let apiFailed = false;
    
    const resultsArray = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          const res = await provider.search(query, limit);
          return res;
        } catch (err: unknown) {
          console.warn(`[BookSearchService] Search failed for provider ${provider.name}:`, err instanceof Error ? err.message : String(err));
          apiFailed = true;
          return [];
        }
      })
    );

    // Pure ISBN or Title+Author merging and deduplication
    const mergedList: BookSearchResult[] = [];

    const getTitleBase = (t: string): string => {
      const base = (t || '').split(/[:\-(]/)[0] || t || '';
      return normalizeTitle(base);
    };

    for (let i = 0; i < this.providers.length; i++) {
      const providerResults = resultsArray[i];
      for (const item of providerResults) {
        if (!item.isbn || typeof item.isbn !== 'string' || item.isbn.trim().length === 0) {
          continue;
        }

        const cleanIsbn = item.isbn.trim();
        const normItemBase = getTitleBase(item.title || item.label || '');

        // Match existing candidate by exact ISBN or by Title Base + Author
        const existingIndex = mergedList.findIndex((existing) => {
          if (existing.isbn && existing.isbn.trim() === cleanIsbn) {
            return true;
          }
          const normExistingBase = getTitleBase(existing.title || existing.label || '');
          if (normItemBase && normExistingBase && normItemBase === normExistingBase) {
            const existingAuthor = (existing.authors || []).join(' ');
            const itemAuthor = (item.authors || []).join(' ');
            if (!existingAuthor || !itemAuthor || compareAuthorNames(existingAuthor, itemAuthor)) {
              return true;
            }
          }
          return false;
        });

        if (existingIndex === -1) {
          mergedList.push({ ...item, isbn: cleanIsbn });
        } else {
          // Merge metadata from both providers into existing candidate, prioritizing richest cover/info
          const existing = mergedList[existingIndex];
          const bestCover = existing.cover || item.cover || null;
          const bestTitle = (existing.title && existing.title.length >= (item.title?.length || 0)) ? existing.title : (item.title || existing.title);
          const bestLabel = (existing.label && existing.label.length >= (item.label?.length || 0)) ? existing.label : (item.label || existing.label);

          mergedList[existingIndex] = {
            ...existing,
            title: bestTitle,
            label: bestLabel,
            inventaireUri: existing.inventaireUri || item.inventaireUri,
            googleId: existing.googleId || item.googleId,
            cover: bestCover,
            image: bestCover,
            description: (existing.description && existing.description.length > 30) ? existing.description : (item.description || existing.description),
            authors: (existing.authors && existing.authors.length > 0) ? existing.authors : (item.authors || []),
            isbn: existing.isbn || cleanIsbn,
            year: existing.year || item.year || null,
            pages: existing.pages || item.pages || null,
            genre: existing.genre || item.genre || null,
            metadataSources: {
              ...(existing.metadataSources || {}),
              ...(item.metadataSources || {}),
            }
          };
        }
      }
    }

    return { results: mergedList, apiFailed };
  }
};
