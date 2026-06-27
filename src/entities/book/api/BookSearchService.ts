import { Book } from '@/src/shared/api/types';
import { httpClient } from '@/src/shared/api/HttpClient';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';

export interface BookSearchResult {
    googleId: string;
    inventaireUri?: string;
    title: string;
    authors: string[];
    description: string;
    year: number | null;
    pages: number | null;
    cover: string | null;
    genre: string | null;
    isbn: string | null;
    rating: number | null;
    buyLink: string | null;
    price: string | null;
}

class BookSearchService {

    async search(query: string): Promise<BookSearchResult[]> {
        if (!query.trim()) return [];

        if (await isOffline()) {
            return [];
        }

        try {
            return await httpClient.get<BookSearchResult[]>(`/book-search/search?q=${encodeURIComponent(query)}`);
        } catch (error) {
            logFetchError('Error searching books', error);
            return [];
        }
    }

    async importBook(bookData: BookSearchResult): Promise<Book | null> {
        if (await isOffline()) {
            return null;
        }

        try {
            return await httpClient.post<Book>('/books/import', bookData);
        } catch (error) {
            logFetchError('Error importing book', error);
            return null;
        }
    }
}

export const bookSearchService = new BookSearchService();
