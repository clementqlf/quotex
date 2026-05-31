import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Quote, Author, Book } from '../../shared/api/types';
import { quoteService } from '../../entities/quote/api/QuoteService';
import { authorService } from '../../entities/author/api/AuthorService';
import { BookImportPayload } from '../../entities/book/lib/bookImport';
import { BlockService } from '../../shared/api/BlockService';
import { StorageService, STORAGE_KEYS } from '../../shared/api/StorageService';
import { useNetworkSync, SyncStatus } from '../../shared/lib/hooks/useNetworkSync';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));

type DataContextType = {
    quotes: Quote[];
    authors: Author[];
    isLoading: boolean;
    syncStatus: SyncStatus & { syncNow: () => void; isOnline: boolean; isOffline: boolean };
    refreshQuotes: () => Promise<void>;
    toggleLikeQuote: (id: number) => Promise<void>;
    toggleSaveQuote: (id: number) => Promise<void>;
    deleteQuote: (id: number) => Promise<void>;
    refreshAuthors: () => Promise<void>;
    refreshBooks: () => Promise<void>;
    getAuthorByName: (name: string) => Promise<Author | undefined>;
    getAuthorById: (id: number) => Promise<Author | undefined>;
    getBooksByAuthor: (authorName: string, authorId?: number) => Promise<Book[]>;
    updateQuote: (id: number, updates: Partial<Quote>) => Promise<void>;
    // Block management
    getBlockLayout: (parentId: string | number, parentType: 'quote' | 'book') => Promise<string[]>;
    updateBlockLayout: (parentId: string | number, parentType: 'quote' | 'book', layout: string[]) => Promise<void>;
    // Book data management
    getBookData: (bookTitle: string) => Promise<Record<string, any>>;
    updateBookData: (bookTitle: string, data: Record<string, any>) => Promise<void>;
    addQuote: (text: string, book?: string | null, author?: string | null) => Promise<void>;
    getUserByUsername: (username: string) => Promise<any>;
    getBookByTitle: (title: string) => Promise<Book | undefined>;
    getBookById: (id: number) => Promise<Book | undefined>;
    getBookByInventaireUri: (inventaireUri: string) => Promise<Book | undefined>;
    peekBookByTitle: (title: string) => Promise<Book | undefined>;
    peekBookById: (id: number) => Promise<Book | undefined>;
    peekBookByInventaireUri: (inventaireUri: string) => Promise<Book | undefined>;
    importBook: (bookData: BookImportPayload) => Promise<Book | undefined>;
    toggleSaveAuthor: (id: number) => Promise<{ isSaved: boolean; followersCount: number } | null>;
    toggleSaveBook: (id: number) => Promise<void>;
    updateBookStatus: (id: number, status: string) => Promise<void>;
    getNotableWorks: (authorId: number) => Promise<Book[]>;
    books: Book[];
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Network sync status
    const syncStatus = useNetworkSync();

    const loadCachedData = async () => {
        try {
            console.log('DataProvider: Initial loadCachedData started');
            const [cachedQuotes, cachedAuthors, cachedBooks] = await Promise.all([
                StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES),
                StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS),
                StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS),
            ]);
            if (cachedQuotes) setQuotes(cachedQuotes);
            if (cachedAuthors) setAuthors(cachedAuthors);
            if (cachedBooks) setBooks(cachedBooks);
            
            console.log('DataProvider: loadCachedData complete', { 
                quotes: cachedQuotes?.length || 0,
                authors: cachedAuthors?.length || 0,
                books: cachedBooks?.length || 0 
            });
        } catch (error) {
            console.error("DataProvider: Failed to load cached data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            console.log('DataProvider: Initial fetchData started');
            const [fetchedQuotes, fetchedAuthors, fetchedBooks] = await Promise.all([
                quoteService.getQuotes(),
                authorService.getAuthors(),
                authorService.getBooks(),
            ]);
            console.log('DataProvider: fetchData complete', { 
                quotes: fetchedQuotes.length, 
                authors: fetchedAuthors.length, 
                books: fetchedBooks.length 
            });
            setQuotes(fetchedQuotes);
            setAuthors(fetchedAuthors);
            setBooks(fetchedBooks);
        } catch (error) {
            console.error("DataProvider: Failed to fetch data", error);
        }
    };

    useEffect(() => {
        const init = async () => {
            await loadCachedData();
            await fetchData();
        };
        init();
    }, []);

    const refreshQuotes = useCallback(async (reason: string = 'unknown') => {
        console.log(`DataProvider: refreshQuotes called (Reason: ${reason})`);
        const fetchedQuotes = await quoteService.getQuotes();
        setQuotes(fetchedQuotes);
    }, []);

    const refreshAuthors = useCallback(async (reason: string = 'unknown') => {
        console.log(`DataProvider: refreshAuthors called (Reason: ${reason})`);
        const fetchedAuthors = await authorService.getAuthors();
        setAuthors(fetchedAuthors);
    }, []);

    const refreshBooks = useCallback(async (reason: string = 'unknown') => {
        console.log(`DataProvider: refreshBooks called (Reason: ${reason})`);
        const fetchedBooks = await authorService.getBooks();
        setBooks(fetchedBooks);
    }, []);

    const toggleLikeQuote = useCallback(async (id: number) => {
        // Optimistic update
        setQuotes(prevQuotes =>
            prevQuotes.map(q =>
                q.id === id
                    ? { ...q, isLiked: !q.isLiked, likesCount: q.isLiked ? q.likesCount - 1 : q.likesCount + 1 }
                    : q
            )
        );

        // Call service
        await quoteService.toggleLike(id);
    }, []);

    const toggleSaveQuote = useCallback(async (id: number) => {
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, isSaved: !q.isSaved } : q));
        await quoteService.toggleSave(id);
    }, []);

    const deleteQuote = useCallback(async (id: number) => {
        // Optimistic
        setQuotes(prev => prev.filter(q => q.id !== id));
        await quoteService.deleteQuote(id);
    }, []);

    const getAuthorByName = useCallback(async (name: string) => {
        return authorService.getAuthorByName(name);
    }, []);

    const getAuthorById = useCallback(async (id: number) => {
        return authorService.getAuthorById(id);
    }, []);

    const getBooksByAuthor = useCallback(async (authorName: string, authorId?: number) => {
        return await authorService.getBooksByAuthor(authorName, authorId);
    }, []);

    const getBlockLayout = useCallback(async (parentId: string | number, parentType: 'quote' | 'book') => {
        return await BlockService.getLayout(parentId, parentType);
    }, []);

    const updateBlockLayout = useCallback(async (parentId: string | number, parentType: 'quote' | 'book', layout: string[]) => {
        await BlockService.saveLayout(parentId, parentType, layout);
    }, []);

    const updateQuote = useCallback(async (id: number, updates: Partial<Quote>) => {
        // Optimistic update
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
        
        // Call service
        await quoteService.updateQuote(id, updates);
    }, []);

    const getBookData = useCallback(async (bookTitle: string) => {
        return await BlockService.getBlockData(bookTitle, 'book');
    }, []);

    const updateBookData = useCallback(async (bookTitle: string, data: Record<string, any>) => {
        await BlockService.saveBlockData(bookTitle, 'book', data);
    }, []);

    const addQuote = useCallback(async (text: string, book?: string | null, author?: string | null) => {
        console.log('[DataProvider] addQuote called');
        console.log('[DataProvider] text:', text);
        console.log('[DataProvider] book:', book);
        console.log('[DataProvider] author:', author);
        
        const cleanBook = book && book.trim() !== '' && book.trim() !== 'Livre inconnu' ? book.trim() : null;
        const cleanAuthor = author && author.trim() !== '' && author.trim() !== 'Auteur inconnu' ? author.trim() : null;
        console.log('[DataProvider] cleanBook:', cleanBook);
        console.log('[DataProvider] cleanAuthor:', cleanAuthor);

        const tempId = Date.now();
        const newQuote: Quote = {
            id: tempId,
            text,
            book: cleanBook,
            author: cleanAuthor,
            likesCount: 0,
            isLiked: false,
            date: new Date().toISOString(),
            isSaved: false,
            comments: 0,
            blockData: {},
        };
        console.log('[DataProvider] Adding quote to local state, tempId:', tempId);
        setQuotes(prev => [newQuote, ...prev]);

        console.log('[DataProvider] Calling quoteService.addQuote...');
        await quoteService.addQuote(text, cleanBook, cleanAuthor);
        console.log('[DataProvider] quoteService.addQuote completed successfully');
    }, []);

    const getUserByUsername = useCallback(async (username: string) => {
        return await quoteService.getUserByUsername(username);
    }, []);

    const getBookByTitle = useCallback(async (title: string) => {
        const book = await authorService.getBookByTitle(title);
        if (book) {
            setBooks(prev => {
                const existing = prev.find(b => b.id === book.id);
                if (existing && existing.lastEnrichedAt === book.lastEnrichedAt && existing.lastEnrichedAt !== undefined) {
                    return prev;
                }
                const updated = prev.map(b => b.id === book.id ? { ...b, ...book } : b);
                if (!existing) {
                    updated.push(book);
                }
                StorageService.setItem(STORAGE_KEYS.BOOKS, updated).catch(err => console.log('Failed to save books to cache:', err));
                return updated;
            });
        }
        return book;
    }, []);

    const getBookById = useCallback(async (id: number) => {
        const book = await authorService.getBookById(id);
        if (book) {
            setBooks(prev => {
                const existing = prev.find(b => b.id === id);
                if (existing && existing.lastEnrichedAt === book.lastEnrichedAt && existing.lastEnrichedAt !== undefined) {
                    return prev;
                }
                const updated = prev.map(b => b.id === id ? { ...b, ...book } : b);
                if (!existing) {
                    updated.push(book);
                }
                StorageService.setItem(STORAGE_KEYS.BOOKS, updated).catch(err => console.log('Failed to save books to cache:', err));
                return updated;
            });
        }
        return book;
    }, []);

    const getBookByInventaireUri = useCallback(async (inventaireUri: string) => {
        const book = await authorService.getBookByInventaireUri(inventaireUri);
        if (book) {
            setBooks(prev => {
                const existing = prev.find(b => b.id === book.id);
                if (existing && existing.lastEnrichedAt === book.lastEnrichedAt && existing.lastEnrichedAt !== undefined) {
                    return prev;
                }
                const updated = prev.map(b => b.id === book.id ? { ...b, ...book } : b);
                if (!existing) {
                    updated.push(book);
                }
                StorageService.setItem(STORAGE_KEYS.BOOKS, updated).catch(err => console.log('Failed to save books to cache:', err));
                return updated;
            });
        }
        return book;
    }, []);

    const peekBookByTitle = useCallback(async (title: string) => {
        return await authorService.getBookByTitle(title);
    }, []);

    const peekBookById = useCallback(async (id: number) => {
        return await authorService.getBookById(id);
    }, []);

    const peekBookByInventaireUri = useCallback(async (inventaireUri: string) => {
        return await authorService.getBookByInventaireUri(inventaireUri);
    }, []);

    const importBook = useCallback(async (bookData: BookImportPayload) => {
        const book = await authorService.importBook(bookData);
        if (book) {
            setBooks(prev => {
                const existing = prev.find(b => b.id === book.id);
                if (existing && existing.lastEnrichedAt === book.lastEnrichedAt && existing.lastEnrichedAt !== undefined) {
                    return prev;
                }
                const updated = prev.map(b => b.id === book.id ? { ...b, ...book } : b);
                if (!existing) {
                    updated.push(book);
                }
                StorageService.setItem(STORAGE_KEYS.BOOKS, updated).catch(err => console.log('Failed to save books to cache:', err));
                return updated;
            });
        }
        return book;
    }, []);

    const toggleSaveAuthor = useCallback(async (id: number) => {
        const res = await authorService.toggleSaveAuthor(id);
        if (res) {
            setAuthors(prev => prev.map(a => a.id === id ? { ...a, ...res } : a));
        }
        return res;
    }, []);

    const toggleSaveBook = useCallback(async (id: number) => {
        setBooks(prev => prev.map(b => b.id === id ? { ...b, isSaved: !b.isSaved } : b));
        await authorService.toggleSaveBook(id);
    }, []);

    const updateBookStatus = useCallback(async (id: number, status: string) => {
        setBooks(prev => prev.map(b => b.id === id ? { ...b, readingStatus: status as any } : b));
        await authorService.updateBookStatus(id, status);
    }, []);

    const getNotableWorks = useCallback(async (authorId: number) => {
        return await authorService.getNotableWorks(authorId);
    }, []);

    const contextValue = useMemo(() => ({
        quotes,
        authors,
        books,
        isLoading,
        syncStatus,
        refreshQuotes,
        refreshAuthors,
        refreshBooks,
        toggleLikeQuote,
        toggleSaveQuote,
        deleteQuote,
        addQuote,
        getAuthorByName,
        getAuthorById,
        getBooksByAuthor,
        getBlockLayout,
        updateBlockLayout,
        updateQuote,
        getBookData,
        updateBookData,
        getUserByUsername,
        getBookByTitle,
        getBookById,
        getBookByInventaireUri,
        peekBookByTitle,
        peekBookById,
        peekBookByInventaireUri,
        importBook,
        toggleSaveAuthor,
        toggleSaveBook,
        updateBookStatus,
        getNotableWorks,
    }), [
        quotes, authors, books, isLoading, syncStatus, refreshQuotes, refreshAuthors, refreshBooks,
        toggleLikeQuote, toggleSaveQuote, deleteQuote, addQuote, getAuthorByName, getAuthorById,
        getBooksByAuthor, getBlockLayout, updateBlockLayout, updateQuote, getBookData,
        updateBookData, getUserByUsername, getBookByTitle, getBookById, getBookByInventaireUri, importBook,
        peekBookByTitle, peekBookById, peekBookByInventaireUri,
        toggleSaveAuthor, toggleSaveBook, updateBookStatus, getNotableWorks
    ]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

// Convenience hook for just sync status
export const useSyncStatus = () => {
    const { syncStatus } = useData();
    return syncStatus;
};
