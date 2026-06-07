import { Author, Book } from '@/src/shared/api/types';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { API_BASE_URL } from '@/src/shared/config/api';
import { authService } from '@/src/entities/user/api/AuthService';
import { BookImportPayload } from '@/src/entities/book/lib/bookImport';
import { isOffline, logFetchError } from '@/src/shared/lib/offline/networkUtils';

// Debug flag - set to false to disable debug logs in production
const DEBUG_AUTHOR_SERVICE = false;

const debugLog = (...args: any[]) => {
  if (DEBUG_AUTHOR_SERVICE) console.warn('[AuthorService]', ...args);
};

class AuthorService {
    private readonly API_URL = API_BASE_URL;

    private normalizeInventaireUri(uri?: string | null): string {
        if (!uri) return '';
        return uri.trim().toLowerCase().replace(/^wd:/, '');
    }

    private async getHeaders(extraHeaders: Record<string, string> = {}) {
        const token = await authService.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...extraHeaders,
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    private mapBookFromServer(b: any): Book {
        return {
            ...b,
            buyLinks: b.buyLinks && typeof b.buyLinks === 'string' ? JSON.parse(b.buyLinks) : (b.buyLinks || []),
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors`, { headers });
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors/by-name/${encodeURIComponent(name)}`, { headers });
            if (response.ok) {
                const author = await response.json();
                return {
                    ...author,
                    similarAuthors: author.similarAuthors || []
                };
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors/${id}`, { headers });
            if (response.ok) {
                const author = await response.json();
                return {
                    ...author,
                    similarAuthors: author.similarAuthors || []
                };
            }
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
            const url = authorId
                ? `${this.API_URL}/authors/${authorId}/books`
                : `${this.API_URL}/books?authorName=${encodeURIComponent(authorName)}`;

            const headers = await this.getHeaders();
            const response = await fetch(url, { headers });
            if (response.ok) {
                const books = await response.json();
                return books.map((b: any) => this.mapBookFromServer(b));
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books`, { headers });
            if (response.ok) {
                const books = await response.json();
                const book = books.find((b: any) => b.title === title);
                if (book) {
                    return this.mapBookFromServer(book);
                }
                return undefined;
            }
        } catch (error) {
            logFetchError('Error fetching book by title', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).find(b => b.title === title);
    }

    async getBookByInventaireUri(inventaireUri: string): Promise<Book | undefined> {
        const target = this.normalizeInventaireUri(inventaireUri);

        if (!target) {
            debugLog('getBookByInventaireUri: empty target', { inventaireUri });
            return undefined;
        }

        if (await isOffline()) {
            debugLog('getBookByInventaireUri: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).find(b => this.normalizeInventaireUri(b.inventaireUri) === target);
        }

        try {
            const headers = await this.getHeaders();
            const directUrl = `${this.API_URL}/books/by-inventaire/${encodeURIComponent(inventaireUri)}`;
            const directResponse = await fetch(directUrl, { headers });

            debugLog('getBookByInventaireUri: direct lookup', {
                status: directResponse.status,
                ok: directResponse.ok,
            });

            if (directResponse.ok) {
                const book = await directResponse.json();
                return this.mapBookFromServer(book);
            }
        } catch (error) {
            logFetchError('[AuthorService] Error fetching book by inventaireUri', error);
        }

        const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
        return (storedBooks || []).find(b => this.normalizeInventaireUri(b.inventaireUri) === target);
    }

    async getBookById(id: number): Promise<Book | undefined> {
        if (await isOffline()) {
            debugLog('getBookById: device is offline, using cache');
            const storedBooks = await StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS);
            return (storedBooks || []).find(b => b.id === id);
        }

        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/${id}`, { headers });
            if (response.ok) {
                const book = await response.json();
                return this.mapBookFromServer(book);
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors/${id}/toggle-save`, {
                method: 'POST',
                headers
            });
            if (response.ok) {
                return await response.json();
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/${id}/toggle-save`, {
                method: 'POST',
                headers
            });
            if (response.ok) {
                const result = await response.json();
                return result.isSaved;
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/${id}/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ readingStatus: status })
            });
            if (response.ok) {
                const book = await response.json();
                return this.mapBookFromServer(book);
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
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
                })
            });
            if (response.ok) {
                const book = await response.json();
                debugLog('importBook: success', {
                    id: book?.id,
                    title: book?.title,
                    pages: book?.pages,
                });
                return this.mapBookFromServer(book);
            }
            debugLog('importBook: non-ok response', {
                status: response.status,
                statusText: response.statusText,
            });
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books`, { headers });
            if (response.ok) {
                const books = await response.json();
                const mappedBooks = books.map((b: any) => this.mapBookFromServer(b));
                await StorageService.setItem(STORAGE_KEYS.BOOKS, mappedBooks);
                return mappedBooks;
            }
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors/${authorId}/notable-works`, { headers });
            if (response.ok) {
                const books = await response.json();
                return books.map((b: any) => this.mapBookFromServer(b));
            }
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
