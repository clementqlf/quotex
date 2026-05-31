import React, { useMemo, ReactNode, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Author, Book } from '@/src/shared/api/types';
import { SupabaseAuthorRepository } from '../api/SupabaseAuthorRepository';
import { useRealtimeBooks, useRealtimeAuthors } from '@/src/shared/lib/hooks/useRealtimeEntity';

/**
 * Provider dédié à la gestion des Authors et Books
 * Maintient les souscriptions temps-réel globales
 */
export const AuthorProvider = ({ children }: { children: ReactNode }) => {
  const authorRepository = useMemo(() => SupabaseAuthorRepository.getInstance(), []);
  const queryClient = useQueryClient();

  const { data: authors = [] } = useQuery({
    queryKey: ['authors'],
    queryFn: () => authorRepository.getAuthors(),
  });

  const { data: books = [] } = useQuery({
    queryKey: ['books'],
    queryFn: () => authorRepository.getBooks(),
  });

  const refreshAuthors = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['authors'] });
  }, [queryClient]);

  const refreshBooks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['books'] });
  }, [queryClient]);

  // Realtime updates pour les entités en cours d'enrichissement
  useRealtimeBooks(books, refreshBooks);
  useRealtimeAuthors(authors, refreshAuthors);

  return <>{children}</>;
};

// Hook pour accéder aux données et méthodes (via React Query)
export const useAuthor = () => {
  const queryClient = useQueryClient();
  const authorRepository = useMemo(() => SupabaseAuthorRepository.getInstance(), []);

  const { data: authors = [], isLoading: isLoadingAuthors, refetch: refetchAuthors } = useQuery({
    queryKey: ['authors'],
    queryFn: () => authorRepository.getAuthors(),
  });

  const { data: books = [], isLoading: isLoadingBooks, refetch: refetchBooks } = useQuery({
    queryKey: ['books'],
    queryFn: () => authorRepository.getBooks(),
  });

  const refreshAuthors = async (reason?: string) => {
    if (reason) console.log(`refreshAuthors: ${reason}`);
    await refetchAuthors();
  };

  const refreshBooks = async (reason?: string) => {
    if (reason) console.log(`refreshBooks: ${reason}`);
    await refetchBooks();
  };

  const toggleSaveAuthorMutation = useMutation({
    mutationFn: (id: number) => authorRepository.toggleSaveAuthor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authors'] }),
  });

  const toggleSaveBookMutation = useMutation({
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
    mutationFn: ({ id, status }: { id: number; status: string }) => authorRepository.updateBookStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['books'] });
      const previousBooks = queryClient.getQueryData<Book[]>(['books']);
      if (previousBooks) {
        queryClient.setQueryData<Book[]>(['books'], old => {
          if (!old) return [];
          return old.map(b => b.id === id ? { ...b, readingStatus: status as any } : b);
        });
      }
      return { previousBooks };
    },
    onError: (err, variables, ctx) => {
      if (ctx?.previousBooks) queryClient.setQueryData(['books'], ctx.previousBooks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['books'] }),
  });

  return {
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
    updateBookStatus: async (id: number, status: string) => { await updateBookStatusMutation.mutateAsync({ id, status }); },
    getNotableWorks: (authorId: number) => authorRepository.getNotableWorks(authorId),
    importBook: (bookData: any) => authorRepository.importBook(bookData),
  };
};
