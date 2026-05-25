import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Quote, Author, Book } from '../../shared/api/types';
import { quoteService } from '../../entities/quote/api/QuoteService';
import { authorService } from '../../entities/author/api/AuthorService';
import { BlockService } from '../../shared/api/BlockService';
import { StorageService, STORAGE_KEYS } from '../../shared/api/StorageService';

type DataContextType = {
    quotes: Quote[];
    authors: Author[];
    isLoading: boolean;
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
    importBook: (bookData: Partial<Book>) => Promise<Book | undefined>;
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
        
        await Promise.all([
            refreshQuotes('deleteQuote complete'),
            refreshBooks('deleteQuote complete')
        ]);
    }, [refreshQuotes, refreshBooks]);

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
        
        // Refresh both quotes and books
        await Promise.all([
            refreshQuotes('updateQuote complete'),
            refreshBooks('updateQuote complete')
        ]);
    }, [refreshQuotes, refreshBooks]);

    const getBookData = useCallback(async (bookTitle: string) => {
        return await BlockService.getBlockData(bookTitle, 'book');
    }, []);

    const updateBookData = useCallback(async (bookTitle: string, data: Record<string, any>) => {
        await BlockService.saveBlockData(bookTitle, 'book', data);
    }, []);

    const addQuote = useCallback(async (text: string, book?: string | null, author?: string | null) => {
        const cleanBook = book && book.trim() !== '' && book.trim() !== 'Livre inconnu' ? book.trim() : null;
        const cleanAuthor = author && author.trim() !== '' && author.trim() !== 'Auteur inconnu' ? author.trim() : null;

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
        setQuotes(prev => [newQuote, ...prev]);


        await quoteService.addQuote(text, cleanBook, cleanAuthor);
        
        await Promise.all([
            refreshQuotes('addQuote complete'),
            refreshBooks('addQuote complete')
        ]);
    }, [refreshQuotes, refreshBooks]);

    const getUserByUsername = useCallback(async (username: string) => {
        return await quoteService.getUserByUsername(username);
    }, []);

    const getBookByTitle = useCallback(async (title: string) => {
        const book = await authorService.getBookByTitle(title);
        if (book) {
            setBooks(prev => {
                const updated = prev.map(b => b.id === book.id ? { ...b, ...book } : b);
                if (!prev.some(b => b.id === book.id)) {
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
                const updated = prev.map(b => b.id === id ? { ...b, ...book } : b);
                if (!prev.some(b => b.id === id)) {
                    updated.push(book);
                }
                StorageService.setItem(STORAGE_KEYS.BOOKS, updated).catch(err => console.log('Failed to save books to cache:', err));
                return updated;
            });
        }
        return book;
    }, []);

    const importBook = useCallback(async (bookData: Partial<Book>) => {
        const book = await authorService.importBook(bookData);
        if (book) {
            setBooks(prev => {
                const updated = prev.map(b => b.id === book.id ? { ...b, ...book } : b);
                if (!prev.some(b => b.id === book.id)) {
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
        await refreshAuthors();
        return res;
    }, [refreshAuthors]);

    const toggleSaveBook = useCallback(async (id: number) => {
        await authorService.toggleSaveBook(id);
        await refreshBooks();
    }, [refreshBooks]);

    const updateBookStatus = useCallback(async (id: number, status: string) => {
        await authorService.updateBookStatus(id, status);
        await refreshBooks();
    }, [refreshBooks]);

    const getNotableWorks = useCallback(async (authorId: number) => {
        return await authorService.getNotableWorks(authorId);
    }, []);

    const contextValue = useMemo(() => ({
        quotes,
        authors,
        books,
        isLoading,
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
        importBook,
        toggleSaveAuthor,
        toggleSaveBook,
        updateBookStatus,
        getNotableWorks,
    }), [
        quotes, authors, books, isLoading, refreshQuotes, refreshAuthors, refreshBooks,
        toggleLikeQuote, toggleSaveQuote, deleteQuote, addQuote, getAuthorByName, getAuthorById,
        getBooksByAuthor, getBlockLayout, updateBlockLayout, updateQuote, getBookData,
        updateBookData, getUserByUsername, getBookByTitle, getBookById, importBook,
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
