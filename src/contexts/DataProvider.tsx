import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
    getAuthorByName: (name: string) => Promise<Author | undefined>;
    getBooksByAuthor: (authorName: string) => Promise<Book[]>;
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
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [authors, setAuthors] = useState<Author[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [fetchedQuotes, fetchedAuthors] = await Promise.all([
                quoteService.getQuotes(),
                authorService.getAuthors(),
            ]);
            console.log('DataProvider fetched quotes:', fetchedQuotes.length);
            setQuotes(fetchedQuotes);
            setAuthors(fetchedAuthors);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const refreshQuotes = async () => {
        const fetchedQuotes = await quoteService.getQuotes();
        setQuotes(fetchedQuotes);
    }

    const toggleLikeQuote = async (id: number) => {
        // Optimistic update
        setQuotes(prevQuotes =>
            prevQuotes.map(q =>
                q.id === id
                    ? { ...q, isLiked: !q.isLiked, likes: q.isLiked ? q.likes - 1 : q.likes + 1 }
                    : q
            )
        );

        // Call service
        await quoteService.toggleLike(id);
        // In a real app we might re-fetch or validate the response here
    };

    const toggleSaveQuote = async (id: number) => {
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, isSaved: !q.isSaved } : q));
        // await quoteService.toggleSave(id); // If we had it
    }

    const deleteQuote = async (id: number) => {
        // Optimistic
        setQuotes(prev => prev.filter(q => q.id !== id));
        await quoteService.deleteQuote(id);
    }

    const getAuthorByName = async (name: string) => {
        // Check cache first if we want, or just call service
        return authorService.getAuthorByName(name);
    }

    const getBooksByAuthor = async (authorName: string) => {
        return await authorService.getBooksByAuthor(authorName);
    };

    const getBlockLayout = async (parentId: string | number, parentType: 'quote' | 'book') => {
        return await BlockService.getLayout(parentId, parentType);
    };

    const updateBlockLayout = async (parentId: string | number, parentType: 'quote' | 'book', layout: string[]) => {
        await BlockService.saveLayout(parentId, parentType, layout);
    };

    const updateQuote = async (id: number, updates: Partial<Quote>) => {
        // Optimistic update
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
        await quoteService.updateQuote(id, updates);
    };

    const getBookData = async (bookTitle: string) => {
        return await BlockService.getBlockData(bookTitle, 'book');
    };

    const updateBookData = async (bookTitle: string, data: Record<string, any>) => {
        await BlockService.saveBlockData(bookTitle, 'book', data);
    };

    const addQuote = async (text: string, book: string, author: string) => {
        // Optimistic update (with temp ID)
        const tempId = Date.now();
        const newQuote: Quote = {
            id: tempId,
            text,
            book,
            author,
            likes: 0,
            isLiked: false,
            date: new Date().toISOString(),
            isSaved: false,
            comments: 0,
            blockData: {},
        };
        setQuotes(prev => [newQuote, ...prev]);

        // Call service
        await quoteService.addQuote(text, book, author);

        // Re-fetch to get real ID and server data
        await refreshQuotes();
    };

    const getUserByUsername = async (username: string) => {
        return await quoteService.getUserByUsername(username);
    };

    const getBookByTitle = async (title: string) => {
        return await authorService.getBookByTitle(title);
    };

    return (
        <DataContext.Provider value={{
            quotes,
            authors,
            isLoading,
            refreshQuotes,
            toggleLikeQuote,
            toggleSaveQuote,
            deleteQuote,
            addQuote,
            getAuthorByName,
            getBooksByAuthor,
            getBlockLayout,
            updateBlockLayout,
            updateQuote,
            getBookData,
            updateBookData,
            getUserByUsername,
            getBookByTitle,
        }}>
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
