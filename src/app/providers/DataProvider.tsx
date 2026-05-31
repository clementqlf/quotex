import React, { ReactNode, useCallback } from 'react';
import { BlockService } from '../../shared/api/BlockService';
import { useQuote } from '../../entities/quote/providers/QuoteProvider';
import { useAuthor } from '../../entities/author/providers/AuthorProvider';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));

export const DataProvider = ({ children }: { children: ReactNode }) => {
    // Le contexte a été supprimé pour utiliser React Query à la place
    return <>{children}</>;
};

export const useData = () => {
    const { 
        quotes, isLoading: isLoadingQuotes, syncStatus, refreshQuotes, 
        toggleLikeQuote, toggleSaveQuote, deleteQuote, addQuote, updateQuote, getUserByUsername 
    } = useQuote();
    
    const { 
        authors, books, isLoading: isLoadingAuthors, refreshAuthors, refreshBooks, 
        getAuthorByName, getAuthorById, getBooksByAuthor, getBookByTitle, getBookById, 
        getBookByInventaireUri, toggleSaveAuthor, toggleSaveBook, updateBookStatus, 
        getNotableWorks, importBook 
    } = useAuthor();

    const getBlockLayout = useCallback(async (parentId: string | number, parentType: 'quote' | 'book') => {
        return await BlockService.getLayout(parentId, parentType);
    }, []);

    const updateBlockLayout = useCallback(async (parentId: string | number, parentType: 'quote' | 'book', layout: string[]) => {
        await BlockService.saveLayout(parentId, parentType, layout);
    }, []);

    const getBookData = useCallback(async (bookTitle: string) => {
        return await BlockService.getBlockData(bookTitle, 'book');
    }, []);

    const updateBookData = useCallback(async (bookTitle: string, data: Record<string, any>) => {
        await BlockService.saveBlockData(bookTitle, 'book', data);
    }, []);

    return {
        quotes,
        authors,
        books,
        isLoading: isLoadingQuotes || isLoadingAuthors,
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
        peekBookByTitle: getBookByTitle,
        peekBookById: getBookById,
        peekBookByInventaireUri: getBookByInventaireUri,
        importBook,
        toggleSaveAuthor,
        toggleSaveBook,
        updateBookStatus,
        getNotableWorks,
    };
};

// Convenience hook for just sync status
export const useSyncStatus = () => {
    const { syncStatus } = useQuote();
    return syncStatus;
};
