import { useQuery } from '@tanstack/react-query';
import { httpClient } from '@/src/shared/api/HttpClient';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { Author, Book, LiteraryPrize, Quote, User } from '@/src/shared/api/types';
import { InventaireEntity } from '@/src/shared/api/InventaireService';

export interface InventairePrize {
  uri: string;
  label?: string;
  name?: string;
  description?: string;
  image?: string;
  year?: number | string;
  founder?: string;
  laureates?: unknown[];
}

export interface SearchResults {
    quotes: Quote[];
    authors: Author[];
    books: Book[];
    themes: string[];
    prizes: LiteraryPrize[];
    users: User[];
    inventaireWorks?: InventaireEntity[];
    inventaireAuthors?: InventaireEntity[];
    inventairePrizes?: InventairePrize[];
}

/**
 * Fonction utilitaire pour effectuer une recherche sur le serveur
 * Peut être utilisée depuis des services ou des contextes non-React
 */
export const searchServer = async (query: string): Promise<SearchResults> => {
  const emptyResults = { 
    quotes: [], 
    authors: [], 
    books: [], 
    themes: [], 
    prizes: [], 
    users: [], 
    inventaireWorks: [], 
    inventaireAuthors: [], 
    inventairePrizes: [] 
  };

  if (!query.trim()) {
    return emptyResults;
  }

  // Effectuer la recherche sur le serveur
  const results = await httpClient.get<SearchResults>('/search', {
    params: { q: query },
  });

  console.log(`[searchServer] Results: ${results.quotes.length} quotes, ${results.authors.length} local authors (${results.inventaireAuthors?.length || 0} ext), ${results.books.length} local books (${results.inventaireWorks?.length || 0} ext), ${results.prizes.length} local prizes (${results.inventairePrizes?.length || 0} ext)`);
  return results;
};

/**
 * Hook pour effectuer une recherche
 * Gère automatiquement le fallback offline avec recherche locale
 */
export const useSearch = (query: string) => {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchServer(query),
    enabled: !!query.trim() && !isOffline(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Recherche locale dans le storage (fallback offline)
 */
export const searchLocal = async (query: string): Promise<SearchResults> => {
  const emptyResults = { 
    quotes: [], 
    authors: [], 
    books: [], 
    themes: [], 
    prizes: [], 
    users: [], 
    inventaireWorks: [], 
    inventaireAuthors: [], 
    inventairePrizes: [] 
  };

  try {
    const [quotes, authors, books] = await Promise.all([
      StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES),
      StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS),
      StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS)
    ]);

    const lowerQuery = query.toLowerCase();

    const filteredQuotes = (quotes || []).filter(q => 
      q.text.toLowerCase().includes(lowerQuery)
    );
    
    const filteredAuthors = (authors || []).filter(a => 
      a.name.toLowerCase().includes(lowerQuery)
    );
    
    const filteredBooks = (books || []).filter(b => 
      b.title.toLowerCase().includes(lowerQuery)
    );

    return {
      ...emptyResults,
      quotes: filteredQuotes,
      authors: filteredAuthors,
      books: filteredBooks
    };
  } catch (error) {
    console.error('[useSearch] Error searching local storage:', error);
    return emptyResults;
  }
};
