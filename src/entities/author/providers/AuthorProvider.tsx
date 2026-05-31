import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Author, Book } from '@/src/shared/api/types';
import { IAuthorRepository } from '../api/IAuthorRepository';
import { SupabaseAuthorRepository } from '../api/SupabaseAuthorRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { useNetworkSync } from '@/src/entities/quote/lib/useNetworkSync';
import { useRealtimeBooks, useRealtimeAuthors } from '@/src/shared/lib/hooks/useRealtimeEntity';

type AuthorContextType = {
  authors: Author[];
  books: Book[];
  isLoading: boolean;
  refreshAuthors: () => Promise<void>;
  refreshBooks: () => Promise<void>;
  getAuthorByName: (name: string) => Promise<Author | undefined>;
  getAuthorById: (id: number) => Promise<Author | undefined>;
  getBooksByAuthor: (authorName: string, authorId?: number) => Promise<Book[]>;
  getBookByTitle: (title: string) => Promise<Book | undefined>;
  getBookById: (id: number) => Promise<Book | undefined>;
  getBookByInventaireUri: (inventaireUri: string) => Promise<Book | undefined>;
  toggleSaveAuthor: (id: number) => Promise<{ isSaved: boolean; followersCount: number } | null>;
  toggleSaveBook: (id: number) => Promise<void>;
  updateBookStatus: (id: number, status: string) => Promise<void>;
  getNotableWorks: (authorId: number) => Promise<Book[]>;
  importBook: (bookData: any) => Promise<Book | undefined>;
};

const AuthorContext = createContext<AuthorContextType | undefined>(undefined);

/**
 * Provider dédié à la gestion des Authors et Books
 * Remplace la partie Author/Book de DataProvider
 */
export const AuthorProvider = ({ children }: { children: ReactNode }) => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Repository instance
  const authorRepository = useMemo(() => SupabaseAuthorRepository.getInstance(), []);

  // Charger les données depuis le cache
  const loadCachedData = async () => {
    try {
      const [cachedAuthors, cachedBooks] = await Promise.all([
        StorageService.getItem<Author[]>(STORAGE_KEYS.AUTHORS),
        StorageService.getItem<Book[]>(STORAGE_KEYS.BOOKS),
      ]);
      if (cachedAuthors) setAuthors(cachedAuthors);
      if (cachedBooks) setBooks(cachedBooks);
    } catch (error) {
      console.error("AuthorProvider: Failed to load cached data", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Rafraîchir les authors
  const refreshAuthors = useCallback(async (reason: string = 'unknown') => {
    console.log(`AuthorProvider: refreshAuthors called (Reason: ${reason})`);
    try {
      const fetchedAuthors = await authorRepository.getAuthors();
      setAuthors(fetchedAuthors);
      await StorageService.setItem(STORAGE_KEYS.AUTHORS, fetchedAuthors);
    } catch (error) {
      console.error("AuthorProvider: Failed to refresh authors", error);
    }
  }, [authorRepository]);

  // Rafraîchir les books
  const refreshBooks = useCallback(async (reason: string = 'unknown') => {
    console.log(`AuthorProvider: refreshBooks called (Reason: ${reason})`);
    try {
      const fetchedBooks = await authorRepository.getBooks();
      setBooks(fetchedBooks);
      await StorageService.setItem(STORAGE_KEYS.BOOKS, fetchedBooks);
    } catch (error) {
      console.error("AuthorProvider: Failed to refresh books", error);
    }
  }, [authorRepository]);

  // Get author by name
  const getAuthorByName = useCallback(async (name: string) => {
    return await authorRepository.getAuthorByName(name);
  }, [authorRepository]);

  // Get author by id
  const getAuthorById = useCallback(async (id: number) => {
    return await authorRepository.getAuthorById(id);
  }, [authorRepository]);

  // Get books by author
  const getBooksByAuthor = useCallback(async (authorName: string, authorId?: number) => {
    return await authorRepository.getBooksByAuthor(authorName, authorId);
  }, [authorRepository]);

  // Get book by title
  const getBookByTitle = useCallback(async (title: string) => {
    return await authorRepository.getBookByTitle(title);
  }, [authorRepository]);

  // Get book by id
  const getBookById = useCallback(async (id: number) => {
    return await authorRepository.getBookById(id);
  }, [authorRepository]);

  // Get book by inventaire uri
  const getBookByInventaireUri = useCallback(async (inventaireUri: string) => {
    return await authorRepository.getBookByInventaireUri(inventaireUri);
  }, [authorRepository]);

  // Toggle save author
  const toggleSaveAuthor = useCallback(async (id: number) => {
    return await authorRepository.toggleSaveAuthor(id);
  }, [authorRepository]);

  // Toggle save book
  const toggleSaveBook = useCallback(async (id: number) => {
    await authorRepository.toggleSaveBook(id);
    await refreshBooks();
  }, [authorRepository, refreshBooks]);

  // Update book status
  const updateBookStatus = useCallback(async (id: number, status: string) => {
    await authorRepository.updateBookStatus(id, status);
    await refreshBooks();
  }, [authorRepository, refreshBooks]);

  // Get notable works
  const getNotableWorks = useCallback(async (authorId: number) => {
    return await authorRepository.getNotableWorks(authorId);
  }, [authorRepository]);

  // Import book
  const importBook = useCallback(async (bookData: any) => {
    return await authorRepository.importBook(bookData);
  }, [authorRepository]);

  // Charger les données au montage
  useEffect(() => {
    loadCachedData();
    refreshAuthors('initial load');
    refreshBooks('initial load');
  }, [refreshAuthors, refreshBooks]);

  // Realtime updates pour les entités en cours d'enrichissement
  useRealtimeBooks(books, refreshBooks);
  useRealtimeAuthors(authors, refreshAuthors);

  const contextValue = useMemo(() => ({
    authors,
    books,
    isLoading,
    refreshAuthors,
    refreshBooks,
    getAuthorByName,
    getAuthorById,
    getBooksByAuthor,
    getBookByTitle,
    getBookById,
    getBookByInventaireUri,
    toggleSaveAuthor,
    toggleSaveBook,
    updateBookStatus,
    getNotableWorks,
    importBook,
  }), [
    authors, 
    books, 
    isLoading,
    refreshAuthors,
    refreshBooks,
    getAuthorByName,
    getAuthorById,
    getBooksByAuthor,
    getBookByTitle,
    getBookById,
    getBookByInventaireUri,
    toggleSaveAuthor,
    toggleSaveBook,
    updateBookStatus,
    getNotableWorks,
    importBook
  ]);

  return (
    <AuthorContext.Provider value={contextValue}>
      {children}
    </AuthorContext.Provider>
  );
};

// Hook pour utiliser le AuthorContext
export const useAuthor = () => {
  const context = useContext(AuthorContext);
  if (context === undefined) {
    throw new Error('useAuthor must be used within a AuthorProvider');
  }
  return context;
};
