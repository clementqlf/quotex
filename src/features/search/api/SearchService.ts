import { Quote, Author, Book } from '@/src/shared/api/types';
import { API_BASE_URL } from '@/src/shared/config/api';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(`${this.API_URL}?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const results: SearchResults = await response.json();
                    console.log(`[SearchService] Results: ${results.quotes.length} quotes, ${results.authors.length} local authors (${results.inventaireAuthors?.length || 0} ext), ${results.books.length} local books (${results.inventaireWorks?.length || 0} ext), ${results.prizes.length} local prizes (${results.inventairePrizes?.length || 0} ext)`);
                    return results;
                } else {
                    console.error('[SearchService] Search failed:', response.status);
                    return await this.searchLocal(query);
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        } catch (error) {
            logFetchError('[SearchService] Network error', error);
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
