import { API_BASE_URL } from '../config/api';
import { Book } from '../../types';

export interface GoogleBookResult {
    googleId: string;
    title: string;
    authors: string[];
    description: string;
    year: number | null;
    pages: number | null;
    cover: string | null;
    genre: string | null;
    isbn: string | null;
}

class GoogleBooksService {
    private readonly BASE_URL = `${API_BASE_URL}`;

    async search(query: string): Promise<GoogleBookResult[]> {
        if (!query.trim()) return [];

        try {
            const response = await fetch(`${this.BASE_URL}/google-books/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Error searching Google Books:', error);
            return [];
        }
    }

    async importBook(bookData: GoogleBookResult): Promise<Book | null> {
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

export const googleBooksService = new GoogleBooksService();
