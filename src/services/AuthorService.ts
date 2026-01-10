import { Author, Book } from '../../types';
import { StorageService, STORAGE_KEYS } from './StorageService';
import { API_BASE_URL } from '../config/api';

class AuthorService {
    private readonly API_URL = API_BASE_URL;

    async getAuthors(): Promise<Author[]> {
        try {
            const response = await fetch(`${this.API_URL}/authors`);
            if (response.ok) {
                const authors = await response.json();
                const mappedAuthors = authors.map((a: any) => ({
                    ...a,
                    similarAuthors: a.similarAuthors || []
                }));
                await StorageService.setItem(STORAGE_KEYS.AUTHORS, mappedAuthors);
                return mappedAuthors;
            }
        } catch (error) {
            console.error('Error fetching authors from server:', error);
        }

        const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        return storedAuthors || [];
    }

    async getAuthorByName(name: string): Promise<Author | undefined> {
        try {
            const response = await fetch(`${this.API_URL}/authors/by-name/${encodeURIComponent(name)}`);
            if (response.ok) {
                const author = await response.json();
                return {
                    ...author,
                    similarAuthors: author.similarAuthors || []
                };
            }
        } catch (error) {
            console.error('Error fetching author by name from server:', error);
        }

        const authors = await this.getAuthors();
        return authors.find(a => a.name === name);
    }

    async getBooksByAuthor(authorName: string, authorId?: number): Promise<Book[]> {
        try {
            // If we have an ID, use the specialized endpoint
            const url = authorId
                ? `${this.API_URL}/authors/${authorId}/books`
                : `${this.API_URL}/books?authorName=${encodeURIComponent(authorName)}`;

            const response = await fetch(url);
            if (response.ok) {
                const books = await response.json();
                const mappedBooks = books.map((b: any) => ({
                    ...b,
                    buyLinks: b.buyLinks && typeof b.buyLinks === 'string' ? JSON.parse(b.buyLinks) : (b.buyLinks || []),
                    similarBooks: b.similarBooks || []
                }));
                return mappedBooks;
            }
        } catch (error) {
            console.error('Error fetching author books from server:', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).filter(b =>
            (typeof b.author === 'string' ? b.author === authorName : b.author?.name === authorName)
        );
    }

    async getBookByTitle(title: string): Promise<Book | undefined> {
        try {
            console.log(`[AuthorService] Fetching book by title: ${title}`);
            const response = await fetch(`${this.API_URL}/books?t=${Date.now()}`); // Add timestamp to prevent caching
            if (response.ok) {
                const books = await response.json();
                const book = books.find((b: any) => b.title === title);
                if (book) {
                    book.buyLinks = book.buyLinks && typeof book.buyLinks === 'string' ? JSON.parse(book.buyLinks) : (book.buyLinks || []);
                    book.similarBooks = book.similarBooks || [];
                }
                console.log(`[AuthorService] Found book: ${title}, rating: ${book?.rating}`);
                return book;
            }
        } catch (error) {
            console.error('Error fetching book by title:', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        console.log('[AuthorService] Fallback to storage');
        return (storedBooks || []).find(b => b.title === title);
    }

    async getBookById(id: number): Promise<Book | undefined> {
        try {
            const response = await fetch(`${this.API_URL}/books/${id}`);
            if (response.ok) {
                const book = await response.json();
                book.buyLinks = book.buyLinks && typeof book.buyLinks === 'string' ? JSON.parse(book.buyLinks) : (book.buyLinks || []);
                book.similarBooks = book.similarBooks || [];
                return book;
            }
        } catch (error) {
            console.error('Error fetching book by ID:', error);
        }
        return undefined;
    }
    async toggleSaveAuthor(id: number): Promise<boolean> {
        try {
            const response = await fetch(`${this.API_URL}/authors/${id}/toggle-save`, {
                method: 'POST'
            });
            if (response.ok) {
                const result = await response.json();
                return result.isSaved;
            }
        } catch (error) {
            console.error('Error toggling author save status:', error);
        }
        return false;
    }

    async toggleSaveBook(id: number): Promise<boolean> {
        try {
            const response = await fetch(`${this.API_URL}/books/${id}/toggle-save`, {
                method: 'POST'
            });
            if (response.ok) {
                const result = await response.json();
                return result.isSaved;
            }
        } catch (error) {
            console.error('Error toggling book save status:', error);
        }
        return false;
    }

    async getBooks(): Promise<Book[]> {
        try {
            const response = await fetch(`${this.API_URL}/books`);
            if (response.ok) {
                const books = await response.json();
                return books.map((b: any) => ({
                    ...b,
                    buyLinks: b.buyLinks && typeof b.buyLinks === 'string' ? JSON.parse(b.buyLinks) : (b.buyLinks || []),
                    similarBooks: b.similarBooks || []
                }));
            }
        } catch (error) {
            console.error('Error fetching books from server:', error);
        }
        return [];
    }
}


export const authorService = new AuthorService();
