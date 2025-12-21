import { Author, Book } from '../../types';
import { authorDetails, bookDescriptions } from '../../data/staticData';
import { StorageService, STORAGE_KEYS } from './StorageService';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));


class AuthorService {
    private async seedAuthorsIfNeeded(): Promise<void> {
        const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        if (!storedAuthors) {
            console.log('Seeding authors from static data...');
            const initialAuthors = Object.entries(authorDetails).map(([name, detail]) => ({
                name,
                ...detail
            }));
            await StorageService.setItem(STORAGE_KEYS.AUTHORS, initialAuthors);
        }
    }

    private async seedBooksIfNeeded(): Promise<void> {
        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        if (!storedBooks) {
            console.log('Seeding books from static data...');
            const initialBooks = Object.entries(bookDescriptions).map(([title, book]) => ({
                title,
                ...book
            }));
            await StorageService.setItem(STORAGE_KEYS.BOOKS, initialBooks);
        }
    }

    async getAuthors(): Promise<Author[]> {
        await delay(500);
        await this.seedAuthorsIfNeeded();
        const authors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        return authors || [];
    }

    async getAuthorByName(name: string): Promise<Author | undefined> {
        await delay(300);
        const authors = await this.getAuthors();
        return authors.find(a => a.name === name);
    }

    async getBooksByAuthor(authorName: string): Promise<Book[]> {
        await delay(300);
        await this.seedBooksIfNeeded();
        const books = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (books || []).filter(b => b.author === authorName);
    }
}

export const authorService = new AuthorService();
