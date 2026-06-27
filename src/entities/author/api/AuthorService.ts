import { BookImportPayload } from '@/src/entities/book/lib/bookImport';
import { httpClient } from '@/src/shared/api/HttpClient';
import { normalizeInventaireUri } from '@/src/shared/api/InventaireService';
import { parseJsonField } from '@/src/shared/lib/dataHelpers';
import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { Author, Book } from '@/src/shared/api/types';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';

// Debug flag - set to false to disable debug logs in production
const DEBUG_AUTHOR_SERVICE = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_AUTHOR_SERVICE) console.warn('[AuthorService]', ...args);
};

class AuthorService {
    private mapBookFromServer(b: any): Book {
        return {
            ...b,
            buyLinks: parseJsonField<string[]>(b.buyLinks) || [],
            similarBooks: b.similarBooks || [],
        };
    }

    async getAuthors(): Promise<Author[]> {
        if (await isOffline()) {
            debugLog('getAuthors: device is offline, using cache');
            const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
            return storedAuthors || [];
        }

        try {
            const authors = await httpClient.get<any[]>('/authors');
            const mappedAuthors = authors.map((a: any) => ({
                ...a,
                similarAuthors: a.similarAuthors || []
            }));
            await StorageService.setItem(STORAGE_KEYS.AUTHORS, mappedAuthors);
            return mappedAuthors;
        } catch (error) {
            logFetchError('Error fetching authors from server', error);
        }

        const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        return storedAuthors || [];
    }

    async getAuthorByName(name: string): Promise<Author | undefined> {
        if (await isOffline()) {
            debugLog('getAuthorByName: device is offline, using cache');
            const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
            return (storedAuthors || []).find(a => a.name.toLowerCase() === name.toLowerCase() || a.name === name);
        }

        try {
            const author = await httpClient.get<any>(`/authors/by-name/${encodeURIComponent(name)}`);
            return {
                ...author,
                similarAuthors: author.similarAuthors || []
            };
        } catch (error) {
            logFetchError('Error fetching author by name from server', error);
        }

        const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        return (storedAuthors || []).find(a => a.name.toLowerCase() === name.toLowerCase() || a.name === name);
    }

    async getAuthorById(id: number): Promise<Author | undefined> {
        if (await isOffline()) {
            debugLog('getAuthorById: device is offline, using cache');
            const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
            return (storedAuthors || []).find(a => a.id === id);
        }

        try {
            const author = await httpClient.get<any>(`/authors/${id}`);
            return {
                ...author,
                similarAuthors: author.similarAuthors || []
            };
        } catch (error) {
            logFetchError('Error fetching author by ID from server', error);
        }

        const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        return (storedAuthors || []).find(a => a.id === id);
    }


    async getBooksByAuthor(authorName: string, authorId?: number): Promise<Book[]> {
        if (await isOffline()) {
            debugLog('getBooksByAuthor: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).filter(b =>
                (typeof b.author === 'string' ? b.author === authorName : b.author?.name === authorName)
            );
        }

        try {
            // If we have an ID, use the specialized endpoint
            const path = authorId
                ? `/authors/${authorId}/books`
                : `/books?authorName=${encodeURIComponent(authorName)}`;

            const books = await httpClient.get<any[]>(path);
            return books.map((b: any) => this.mapBookFromServer(b));
        } catch (error) {
            logFetchError('Error fetching author books from server', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).filter(b =>
            (typeof b.author === 'string' ? b.author === authorName : b.author?.name === authorName)
        );
    }

    async getBookByTitle(title: string): Promise<Book | undefined> {
        if (await isOffline()) {
            debugLog('getBookByTitle: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).find(b => b.title === title);
        }

        try {
            const books = await httpClient.get<any[]>('/books');
            const book = books.find((b: any) => b.title === title);
            if (book) {
                return this.mapBookFromServer(book);
            }
            return undefined;
        } catch (error) {
            logFetchError('Error fetching book by title', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).find(b => b.title === title);
    }

    async getBookByInventaireUri(inventaireUri: string): Promise<Book | undefined> {
        const target = normalizeInventaireUri(inventaireUri);

        if (!target) {
            debugLog('getBookByInventaireUri: empty target', { inventaireUri });
            return undefined;
        }

        if (await isOffline()) {
            debugLog('getBookByInventaireUri: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).find(b => normalizeInventaireUri(b.inventaireUri) === target);
        }

        try {
            debugLog('getBookByInventaireUri: direct lookup', { inventaireUri });
            const book = await httpClient.get<any>(`/books/by-inventaire/${encodeURIComponent(inventaireUri)}`);
            return this.mapBookFromServer(book);
        } catch (error) {
            logFetchError('[AuthorService] Error fetching book by inventaireUri', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).find(b => normalizeInventaireUri(b.inventaireUri) === target);
    }

    async getBookById(id: number): Promise<Book | undefined> {
        if (await isOffline()) {
            debugLog('getBookById: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).find(b => b.id === id);
        }

        try {
            const book = await httpClient.get<any>(`/books/${id}`);
            return this.mapBookFromServer(book);
        } catch (error) {
            logFetchError('Error fetching book by ID', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).find(b => b.id === id);
    }

    async toggleSaveAuthor(id: number): Promise<{ isSaved: boolean; followersCount: number } | null> {
        if (await isOffline()) {
            debugLog('toggleSaveAuthor: device is offline');
            return null;
        }

        try {
            return await httpClient.post<{ isSaved: boolean; followersCount: number }>(`/authors/${id}/toggle-save`, {});
        } catch (error) {
            logFetchError('Error toggling author save status', error);
        }
        return null;
    }

    async toggleSaveBook(id: number): Promise<boolean> {
        if (await isOffline()) {
            debugLog('toggleSaveBook: device is offline');
            return false;
        }

        try {
            const result = await httpClient.post<{ isSaved: boolean }>(`/books/${id}/toggle-save`, {});
            return result.isSaved;
        } catch (error) {
            logFetchError('Error toggling book save status', error);
        }
        return false;
    }

    async updateBookStatus(id: number, status: string): Promise<Book | undefined> {
        if (await isOffline()) {
            debugLog('updateBookStatus: device is offline');
            return undefined;
        }

        try {
            const book = await httpClient.patch<any>(`/books/${id}/status`, { readingStatus: status });
            return this.mapBookFromServer(book);
        } catch (error) {
            logFetchError('Error updating book status', error);
        }
        return undefined;
    }

    async importBook(bookData: BookImportPayload): Promise<Book | undefined> {
        if (await isOffline()) {
            debugLog('importBook: device is offline');
            return undefined;
        }

        try {
            debugLog('importBook: request', {
                title: bookData.title,
                inventaireUri: bookData.inventaireUri,
                year: bookData.year,
                pages: bookData.pages,
            });
            const book = await httpClient.post<any>('/books/import', {
                title: bookData.title,
                authors: bookData.authors ?? (typeof bookData.author === 'string' ? [bookData.author] : (bookData.author?.name ? [bookData.author.name] : [])),
                authorUris: bookData.authorUris,
                description: bookData.description,
                cover: bookData.cover,
                inventaireUri: bookData.inventaireUri,
                openLibraryId: bookData.openLibraryId,
                googleId: bookData.googleId,
                isbn: bookData.isbn,
                year: bookData.year,
                pages: bookData.pages,
                genre: bookData.genre
            });
            debugLog('importBook: success', {
                id: book?.id,
                title: book?.title,
                pages: book?.pages,
            });
            return this.mapBookFromServer(book);
        } catch (error) {
            logFetchError('[AuthorService] Error importing book', error);
        }
        return undefined;
    }

    async getBooks(): Promise<Book[]> {
        if (await isOffline()) {
            debugLog('getBooks: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return storedBooks || [];
        }

        try {
            const books = await httpClient.get<any[]>('/books');
            const mappedBooks = books.map((b: any) => this.mapBookFromServer(b));
            await StorageService.setItem(STORAGE_KEYS.BOOKS, mappedBooks);
            return mappedBooks;
        } catch (error) {
            logFetchError('Error fetching books from server', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return storedBooks || [];
    }


    async getNotableWorks(authorId: number): Promise<Book[]> {
        if (await isOffline()) {
            debugLog('getNotableWorks: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).filter(b => 
                typeof b.author === 'object' && b.author !== null && b.author.id === authorId
            );
        }

        try {
            const books = await httpClient.get<any[]>(`/authors/${authorId}/notable-works`);
            return books.map((b: any) => this.mapBookFromServer(b));
        } catch (error) {
            logFetchError('Error fetching notable works', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).filter(b => 
            typeof b.author === 'object' && b.author !== null && b.author.id === authorId
        );
    }
}


export const authorService = new AuthorService();
