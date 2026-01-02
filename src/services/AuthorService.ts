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
        const authors = await this.getAuthors();
        return authors.find(a => a.name === name);
    }

    async getBooksByAuthor(authorName: string): Promise<Book[]> {
        try {
            const response = await fetch(`${this.API_URL}/books`);
            if (response.ok) {
                const allBooks = await response.json();
                // Extract unique books and store them
                const mappedBooks = allBooks.map((b: any) => ({
                    ...b,
                    buyLinks: b.buyLinks ? JSON.parse(b.buyLinks) : undefined,
                    similarBooks: b.similarBooks || []
                }));
                await StorageService.setItem(STORAGE_KEYS.BOOKS, mappedBooks);
                return mappedBooks.filter((b: any) =>
                    (typeof b.author === 'string' ? b.author === authorName : b.author?.name === authorName)
                );
            }
        } catch (error) {
            console.error('Error fetching books from server:', error);
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
                    book.buyLinks = book.buyLinks ? JSON.parse(book.buyLinks) : undefined;
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
}


export const authorService = new AuthorService();

