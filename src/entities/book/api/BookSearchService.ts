import { API_BASE_URL } from '@/src/shared/config/api';
import { Book } from '@/src/shared/api/types';

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
    private readonly BASE_URL = `${API_BASE_URL}`;

    async search(query: string): Promise<BookSearchResult[]> {
        if (!query.trim()) return [];

        try {
            const response = await fetch(`${this.BASE_URL}/book-search/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Error searching books:', error);
            return [];
        }
    }

    async importBook(bookData: BookSearchResult): Promise<Book | null> {
        try {
            const response = await fetch(`${this.BASE_URL}/books/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData),
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Error importing book:', error);
            return null;
        }
    }
}

export const bookSearchService = new BookSearchService();
