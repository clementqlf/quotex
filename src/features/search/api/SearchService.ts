import { Quote, Author, Book } from '@/src/shared/api/types';
import { API_BASE_URL } from '@/src/shared/config/api';

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
        if (!query.trim()) {
            return { quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };
        }

        try {
            console.log(`[SearchService] Searching for: "${query}"`);
            const response = await fetch(`${this.API_URL}?q=${encodeURIComponent(query)}`);

            if (response.ok) {
                const results: SearchResults = await response.json();
                console.log(`[SearchService] Results: ${results.quotes.length} quotes, ${results.authors.length} local authors (${results.inventaireAuthors?.length || 0} ext), ${results.books.length} local books (${results.inventaireWorks?.length || 0} ext), ${results.prizes.length} local prizes (${results.inventairePrizes?.length || 0} ext)`);
                return results;
            } else {
                console.error('[SearchService] Search failed:', response.status);
                return { quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };
            }
        } catch (error) {
            console.error('[SearchService] Network error:', error);
            return { quotes: [], authors: [], books: [], themes: [], prizes: [], inventaireWorks: [], inventaireAuthors: [], inventairePrizes: [] };
        }
    }
}

export const searchService = new SearchService();
