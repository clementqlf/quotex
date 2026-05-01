import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Quote, Author, Book } from '../../types';
import { quoteService } from '../services/QuoteService';
import { authorService } from '../services/AuthorService';
import { BlockService } from '../services/BlockService';

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
    addQuote: (text: string, book: string, author: string) => Promise<void>;
    getUserByUsername: (username: string) => Promise<any>;
    getBookByTitle: (title: string) => Promise<Book | undefined>;
    getBookById: (id: number) => Promise<Book | undefined>;
    importBook: (bookData: Partial<Book>) => Promise<Book | undefined>;
    toggleSaveAuthor: (id: number) => Promise<void>;
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

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [fetchedQuotes, fetchedAuthors, fetchedBooks] = await Promise.all([
                quoteService.getQuotes(),
                authorService.getAuthors(),
                authorService.getBooks(),
            ]);
            console.log('DataProvider fetched data');
            setQuotes(fetchedQuotes);
            setAuthors(fetchedAuthors);
            setBooks(fetchedBooks);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const refreshQuotes = useCallback(async () => {
        const fetchedQuotes = await quoteService.getQuotes();
        setQuotes(fetchedQuotes);
    }, []);

    const refreshAuthors = useCallback(async () => {
        const fetchedAuthors = await authorService.getAuthors();
        setAuthors(fetchedAuthors);
    }, []);

    const refreshBooks = useCallback(async () => {
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
        
        // REFRESH FROM SERVER
        await refreshQuotes();
    }, [refreshQuotes]);

    const getBookData = useCallback(async (bookTitle: string) => {
        return await BlockService.getBlockData(bookTitle, 'book');
    }, []);

    const updateBookData = useCallback(async (bookTitle: string, data: Record<string, any>) => {
        await BlockService.saveBlockData(bookTitle, 'book', data);
    }, []);

    const addQuote = useCallback(async (text: string, book: string, author: string) => {
        const tempId = Date.now();
        const newQuote: Quote = {
            id: tempId,
            text,
            book,
            author,
            likesCount: 0,
            isLiked: false,
            date: new Date().toISOString(),
            isSaved: false,
            comments: 0,
            blockData: {},
        };
        setQuotes(prev => [newQuote, ...prev]);

        await quoteService.addQuote(text, book, author);
        await refreshQuotes();
    }, [refreshQuotes]);

    const getUserByUsername = useCallback(async (username: string) => {
        return await quoteService.getUserByUsername(username);
    }, []);

    const getBookByTitle = useCallback(async (title: string) => {
        return await authorService.getBookByTitle(title);
    }, []);

    const getBookById = useCallback(async (id: number) => {
        return await authorService.getBookById(id);
    }, []);

    const importBook = useCallback(async (bookData: Partial<Book>) => {
        return await authorService.importBook(bookData);
    }, []);

    const toggleSaveAuthor = useCallback(async (id: number) => {
        await authorService.toggleSaveAuthor(id);
        await refreshAuthors();
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
