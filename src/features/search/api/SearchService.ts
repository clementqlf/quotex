import { Quote, Author, Book } from '@/src/shared/api/types';
import { API_BASE_URL } from '@/src/shared/config/api';

export interface SearchResults {
    quotes: Quote[];
    authors: Author[];
    books: Book[];
    themes: string[];
    inventaireWorks?: any[];
    inventaireAuthors?: any[];
}

class SearchService {
    private readonly API_URL = `${API_BASE_URL}/search`;

    async search(query: string): Promise<SearchResults> {
        if (!query.trim()) {
            return { quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] };
        }

        try {
            console.log(`[SearchService] Searching for: "${query}"`);
            const response = await fetch(`${this.API_URL}?q=${encodeURIComponent(query)}`);

            if (response.ok) {
                const results: SearchResults = await response.json();
                console.log(`[SearchService] Found ${results.quotes.length} quotes, ${results.authors.length} authors, ${results.books.length} books`);
                return results;
            } else {
                console.error('[SearchService] Search failed:', response.status);
                return { quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] };
            }
        } catch (error) {
            console.error('[SearchService] Network error:', error);
            return { quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] };
        }
    }
}

export const searchService = new SearchService();
