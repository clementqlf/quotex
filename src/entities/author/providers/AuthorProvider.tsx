import { useRepositories } from '@/src/app/providers/RepositoriesProvider';
import { ReadingStatus } from '@/src/entities/author/model/Author';
import { Author, Book } from '@/src/shared/api/types';
import { useRealtimeAuthors, useRealtimeBooks } from '@/src/shared/lib/hooks/useRealtimeEntity';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';

// Type pour le contexte Author
type AuthorContextType = {
  authors: Author[];
  books: Book[];
  isLoading: boolean;
  refreshAuthors: (reason?: string) => Promise<void>;
  refreshBooks: (reason?: string) => Promise<void>;
  getAuthorByName: (name: string) => Promise<Author | undefined>;
  getAuthorById: (id: number) => Promise<Author | undefined>;
  getBooksByAuthor: (authorName: string, authorId?: number) => Promise<Book[]>;
  getBookByTitle: (title: string) => Promise<Book | undefined>;
  getBookById: (id: number) => Promise<Book | undefined>;
  getBookByInventaireUri: (uri: string) => Promise<Book | undefined>;
  toggleSaveAuthor: (id: number) => Promise<{ isSaved: boolean; followersCount: number } | null>;
  toggleSaveBook: (id: number) => Promise<void>;
  updateBookStatus: (id: number, status: ReadingStatus) => Promise<void>;
  getNotableWorks: (authorId: number) => Promise<any[]>;
  importBook: (bookData: any) => Promise<any>;
};

const AuthorContext = createContext<AuthorContextType | undefined>(undefined);

/**
 * Provider dédié à la gestion des Authors et Books
 * Maintient les souscriptions temps-réel globales
 */
export const AuthorProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { authorRepository } = useRepositories();

  const { data: authors = [], isLoading: isLoadingAuthors, refetch: refetchAuthors } = useQuery({
    queryKey: ['authors'],
    queryFn: () => authorRepository.getAuthors(),
  });

  const { data: books = [], isLoading: isLoadingBooks, refetch: refetchBooks } = useQuery({
    queryKey: ['books'],
    queryFn: () => authorRepository.getBooks(),
  });

  const refreshAuthors = useCallback(async (reason?: string) => {
    if (queryClient.isMutating({ mutationKey: ['authors'] })) {
      console.log(`refreshAuthors skipped: author mutation in progress (reason: ${reason || 'none'})`);
      return;
    }
    if (reason) console.log(`refreshAuthors: ${reason}`);
    await refetchAuthors();
  }, [refetchAuthors, queryClient]);

  const refreshBooks = useCallback(async (reason?: string) => {
    if (queryClient.isMutating({ mutationKey: ['books'] })) {
      console.log(`refreshBooks skipped: book mutation in progress (reason: ${reason || 'none'})`);
      return;
    }
    if (reason) console.log(`refreshBooks: ${reason}`);
    await refetchBooks();
  }, [refetchBooks, queryClient]);

  // Mutations
  const toggleSaveAuthorMutation = useMutation({
    mutationKey: ['authors', 'toggleSave'],
    mutationFn: (id: number) => authorRepository.toggleSaveAuthor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authors'] }),
  });

  const toggleSaveBookMutation = useMutation({
    mutationKey: ['books', 'toggleSave'],
    mutationFn: (id: number) => authorRepository.toggleSaveBook(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['books'] });
      const previousBooks = queryClient.getQueryData<Book[]>(['books']);
      if (previousBooks) {
        queryClient.setQueryData<Book[]>(['books'], old => {
          if (!old) return [];
          return old.map(b => b.id === id ? { ...b, isSaved: !b.isSaved } : b);
        });
      }
      return { previousBooks };
    },
    onError: (err, id, ctx) => {
      if (ctx?.previousBooks) queryClient.setQueryData(['books'], ctx.previousBooks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
  });

  const updateBookStatusMutation = useMutation({
    mutationKey: ['books', 'updateStatus'],
    mutationFn: ({ id, status }: { id: number; status: ReadingStatus }) => authorRepository.updateBookStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['books'] });
      const previousBooks = queryClient.getQueryData<Book[]>(['books']);
      if (previousBooks) {
        queryClient.setQueryData<Book[]>(['books'], old => {
          if (!old) return [];
          return old.map(b => b.id === id ? { ...b, readingStatus: status } : b);
        });
      }
      return { previousBooks };
    },
    onError: (err, variables, ctx) => {
      if (ctx?.previousBooks) queryClient.setQueryData(['books'], ctx.previousBooks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
  });

  // Realtime updates pour les entités en cours d'enrichissement
  useRealtimeBooks(books, refreshBooks);
  useRealtimeAuthors(authors, refreshAuthors);

  // ✅ Memoize toutes les fonctions pour éviter les re-renders
  const contextValue = useMemo(() => ({
    authors,
    books,
    isLoading: isLoadingAuthors || isLoadingBooks,
    refreshAuthors,
    refreshBooks,
    getAuthorByName: (name: string) => authorRepository.getAuthorByName(name),
    getAuthorById: (id: number) => authorRepository.getAuthorById(id),
    getBooksByAuthor: (authorName: string, authorId?: number) => authorRepository.getBooksByAuthor(authorName, authorId),
    getBookByTitle: (title: string) => authorRepository.getBookByTitle(title),
    getBookById: (id: number) => authorRepository.getBookById(id),
    getBookByInventaireUri: (uri: string) => authorRepository.getBookByInventaireUri(uri),
    toggleSaveAuthor: async (id: number) => toggleSaveAuthorMutation.mutateAsync(id),
    toggleSaveBook: async (id: number) => { await toggleSaveBookMutation.mutateAsync(id); },
    updateBookStatus: async (id: number, status: ReadingStatus) => { await updateBookStatusMutation.mutateAsync({ id, status }); },
    getNotableWorks: (authorId: number) => authorRepository.getNotableWorks(authorId),
    importBook: (bookData: any) => authorRepository.importBook(bookData),
  }), [
    authors,
    books,
    isLoadingAuthors,
    isLoadingBooks,
    refreshAuthors,
    refreshBooks,
    toggleSaveAuthorMutation,
    toggleSaveBookMutation,
    updateBookStatusMutation,
    authorRepository
  ]);

  return (
    <AuthorContext.Provider value={contextValue}>
      {children}
    </AuthorContext.Provider>
  );
};

export const useAuthor = () => {
  const context = useContext(AuthorContext);
  if (context === undefined) {
    throw new Error('useAuthor must be used within a AuthorProvider');
  }
  return context;
};
