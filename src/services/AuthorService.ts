import { Author, Book } from '../../types';
import { StorageService, STORAGE_KEYS } from './StorageService';
import { Platform } from 'react-native';

class AuthorService {
    private readonly API_URL = Platform.select({
        android: 'http://10.0.2.2:3000',
        ios: 'http://192.168.1.60:3000',
        default: 'http://192.168.1.60:3000',
    });

    async getAuthors(): Promise<Author[]> {
        try {
            const response = await fetch(`${this.API_URL}/authors`);
            if (response.ok) {
                const authors = await response.json();
                await StorageService.setItem(STORAGE_KEYS.AUTHORS, authors);
                return authors;
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
                await StorageService.setItem(STORAGE_KEYS.BOOKS, allBooks);
                return allBooks.filter((b: any) =>
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
            const response = await fetch(`${this.API_URL}/books`);
            if (response.ok) {
                const books = await response.json();
                return books.find((b: any) => b.title === title);
            }
        } catch (error) {
            console.error('Error fetching book by title:', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).find(b => b.title === title);
    }
}


export const authorService = new AuthorService();

