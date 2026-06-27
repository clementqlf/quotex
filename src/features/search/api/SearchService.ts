import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { Author, Book, LiteraryPrize, Quote, User } from '@/src/shared/api/types';
import { InventaireEntity } from '@/src/shared/api/InventaireService';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { httpClient } from '@/src/shared/api/HttpClient';

// Type pour les prix littéraires Inventaire
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

class SearchService {
    async search(query: string): Promise<SearchResults> {
        const emptyResults = { quotes: [], authors: [], books: [], themes: [], prizes: [], users: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };

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
                const results = await httpClient.get<SearchResults>('/search', {
                    params: { q: query },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                console.log(`[SearchService] Results: ${results.quotes.length} quotes, ${results.authors.length} local authors (${results.inventaireAuthors?.length || 0} ext), ${results.books.length} local books (${results.inventaireWorks?.length || 0} ext), ${results.prizes.length} local prizes (${results.inventairePrizes?.length || 0} ext)`);
                return results;
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
        const emptyResults = { quotes: [], authors: [], books: [], themes: [], prizes: [], users: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };
        
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
