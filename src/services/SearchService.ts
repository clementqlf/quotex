import { Quote, Author, Book } from '../../types';
import { API_BASE_URL } from '../config/api';

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

    private abortController: AbortController | null = null;

    async search(query: string): Promise<SearchResults> {
        if (!query.trim()) {
            return { quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] };
        }

        // Abort previous request
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        try {
            console.log(`🔍 [SearchService] Searching for: "${query}"`);
            const response = await fetch(`${this.API_URL}?q=${encodeURIComponent(query)}`, {
                signal: this.abortController.signal
            });

            if (response.ok) {
                const results: SearchResults = await response.json();
                console.log(`✅ [SearchService] Found ${results.quotes.length} quotes, ${results.authors.length} authors, ${results.books.length} books`);
                return results;
            } else {
                const errorText = await response.text();
                console.error(`❌ [SearchService] Search failed (${response.status}):`, errorText);
                return { quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] };
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log(`ℹ️ [SearchService] Search for "${query}" aborted`);
            } else {
                console.error('❌ [SearchService] Network error:', error);
            }
            return { quotes: [], authors: [], books: [], themes: [], inventaireWorks: [], inventaireAuthors: [] };
        } finally {
            if (this.abortController?.signal.aborted) {
                // Keep it aborted? No, just clear if it's the current one
            }
        }
    }
}

export const searchService = new SearchService();
