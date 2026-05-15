import { Author, Book } from '@/src/shared/api/types';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { API_BASE_URL } from '@/src/shared/config/api';
import { authService } from '@/src/entities/user/api/AuthService';

class AuthorService {
    private readonly API_URL = API_BASE_URL;

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

    async getAuthors(): Promise<Author[]> {
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
            console.error('Error fetching authors from server:', error);
        }

        const storedAuthors = await StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS);
        return storedAuthors || [];
    }

    async getAuthorByName(name: string): Promise<Author | undefined> {
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
            console.error('Error fetching author by name from server:', error);
        }

        const authors = await this.getAuthors();
        return authors.find(a => a.name === name);
    }

    async getAuthorById(id: number): Promise<Author | undefined> {
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
            console.error('Error fetching author by ID from server:', error);
        }
        return undefined;
    }


    async getBooksByAuthor(authorName: string, authorId?: number): Promise<Book[]> {
        try {
            // If we have an ID, use the specialized endpoint
            const url = authorId
                ? `${this.API_URL}/authors/${authorId}/books`
                : `${this.API_URL}/books?authorName=${encodeURIComponent(authorName)}`;

            const headers = await this.getHeaders();
            const response = await fetch(url, { headers });
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books?t=${Date.now()}`, { headers }); // Add timestamp to prevent caching
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/${id}`, { headers });
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
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors/${id}/toggle-save`, {
                method: 'POST',
                headers
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
            console.error('Error toggling book save status:', error);
        }
        return false;
    }

    async updateBookStatus(id: number, status: string): Promise<Book | undefined> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/${id}/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ readingStatus: status })
            });
            if (response.ok) {
                const book = await response.json();
                book.buyLinks = book.buyLinks && typeof book.buyLinks === 'string' ? JSON.parse(book.buyLinks) : (book.buyLinks || []);
                book.similarBooks = book.similarBooks || [];
                return book;
            }
        } catch (error) {
            console.error('Error updating book status:', error);
        }
        return undefined;
    }

    async importBook(bookData: Partial<Book>): Promise<Book | undefined> {
        try {
            console.log(`[AuthorService] Importing book: ${bookData.title}`);
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    title: bookData.title,
                    authors: typeof bookData.author === 'string' ? [bookData.author] : (bookData.author?.name ? [bookData.author.name] : []),
                    description: bookData.description,
                    cover: bookData.cover,
                    inventaireUri: bookData.inventaireUri,
                    openLibraryId: bookData.openLibraryId,
                    googleId: bookData.googleId,
                    year: bookData.year,
                    pages: bookData.pages,
                    genre: bookData.genre
                })
            });
            if (response.ok) {
                const book = await response.json();
                book.buyLinks = book.buyLinks && typeof book.buyLinks === 'string' ? JSON.parse(book.buyLinks) : (book.buyLinks || []);
                book.similarBooks = book.similarBooks || [];
                return book;
            }
        } catch (error) {
            console.error('Error importing book:', error);
        }
        return undefined;
    }

    async getBooks(): Promise<Book[]> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/books`, { headers });
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

    async getNotableWorks(authorId: number): Promise<Book[]> {
        try {
            console.log(`[AuthorService] Fetching/Syncing notable works for author: ${authorId}`);
            const headers = await this.getHeaders();
            const response = await fetch(`${this.API_URL}/authors/${authorId}/notable-works`, { headers });
            if (response.ok) {
                const books = await response.json();
                return books.map((b: any) => ({
                    ...b,
                    buyLinks: b.buyLinks && typeof b.buyLinks === 'string' ? JSON.parse(b.buyLinks) : (b.buyLinks || []),
                    similarBooks: b.similarBooks || []
                }));
            }
        } catch (error) {
            console.error('Error fetching notable works:', error);
        }
        return [];
    }
}


export const authorService = new AuthorService();
