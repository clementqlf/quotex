import { z } from 'zod';
import { Quote, Author, Book } from '@/src/shared/api/types';
import { API_BASE_URL } from '@/src/shared/config/api';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { safeFetch, trackExternalError, ErrorSeverity } from '@/src/shared/lib/resilience/networkResilience';

// Schema for search results validation
const SearchResultsSchema = z.object({
    quotes: z.array(z.any()).optional(),
    authors: z.array(z.any()).optional(),
    books: z.array(z.any()).optional(),
    themes: z.array(z.string()).optional(),
    prizes: z.array(z.any()).optional(),
    inventaireWorks: z.array(z.any()).optional(),
    inventaireAuthors: z.array(z.any()).optional(),
    inventairePrizes: z.array(z.any()).optional(),
});

export interface SearchResults {
    quotes: Quote[];
    authors: Author[];
    books: Book[];
    themes: string[];
    prizes: any[];
    inventaireWorks?: any[];
    inventaireAuthors?: any[];
    inventairePrizes?: any[];
}

class SearchService {
    private readonly API_URL = `${API_BASE_URL}/search`;
    private readonly SEARCH_TIMEOUT_MS = 8000;

    async search(query: string): Promise<SearchResults> {
        const emptyResults = { quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };

        if (!query.trim()) {
            return emptyResults;
        }

        if (await isOffline()) {
            return await this.searchLocal(query);
        }

        try {
            console.log(`[SearchService] Searching for: "${query}"`);
            const results = await safeFetch<SearchResults>(
                `${this.API_URL}?q=${encodeURIComponent(query)}`,
                {
                    timeoutMs: this.SEARCH_TIMEOUT_MS,
                    maxRetries: 2,
                    schema: SearchResultsSchema,
                    onError: (error, ctx) => {
                        trackExternalError('Search', error, {
                            ...ctx,
                            query,
                            service: 'SupabaseSearch'
                        }, ErrorSeverity.MEDIUM);
                    }
                }
            );

            console.log(`[SearchService] Results: ${results.quotes?.length || 0} quotes, ${results.authors?.length || 0} local authors (${results.inventaireAuthors?.length || 0} ext), ${results.books?.length || 0} local books (${results.inventaireWorks?.length || 0} ext), ${results.prizes?.length || 0} local prizes (${results.inventairePrizes?.length || 0} ext)`);
            return results;
        } catch (error: any) {
            if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
                console.warn(`[SearchService] Search timed out after ${this.SEARCH_TIMEOUT_MS}ms, falling back to local search`);
            } else {
                logFetchError('[SearchService] Network error', error);
            }
            return await this.searchLocal(query);
        }
    }

    private async searchLocal(query: string): Promise<SearchResults> {
        const emptyResults = { quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };
        
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
            console.error('[SearchService] Error searching local storage:', error);
            return emptyResults;
        }
    }
}

export const searchService = new SearchService();
