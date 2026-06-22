import { useRepositories } from '@/src/app/providers/RepositoriesProvider';
import { SyncStatus, useNetworkSync } from '@/src/entities/quote/lib/useNetworkSync';
import { authService } from '@/src/entities/user/api/AuthService';
import { Quote, User } from '@/src/shared/api/types';
import { QueuedOperationError } from '@/src/shared/lib/offline/QueuedOperationError';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';

type QuoteContextType = {
  quotes: Quote[];
  isLoading: boolean;
  syncStatus: SyncStatus & { syncNow: () => void; isOnline: boolean; isOffline: boolean };
  refreshQuotes: () => Promise<void>;
  toggleLikeQuote: (id: number) => Promise<{ isLiked: boolean; likesCount: number } | void>;
  toggleSaveQuote: (id: number, quote?: Quote) => Promise<{ isSaved: boolean; savedAt?: string | null } | void>;
  deleteQuote: (id: number) => Promise<void>;
  addQuote: (text: string, book?: string | null, author?: string | null) => Promise<Quote>;
  updateQuote: (id: number, updates: Partial<Quote>) => Promise<Quote | void>;
  getUserByUsername: (username: string) => Promise<User | undefined>;
};

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export const QuoteProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { quoteRepository } = useRepositories();
  const syncStatus = useNetworkSync();

  // Query pour récupérer les quotes
  const { data: quotes = [], isLoading, refetch } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => quoteRepository.getQuotes(),
  });

  // Refresh avec logging
  const refreshQuotes = useCallback(async (reason?: string) => {
    if (queryClient.isMutating({ mutationKey: ['quotes'] })) {
      console.log(`refreshQuotes skipped: quote mutation in progress (reason: ${reason || 'none'})`);
      return;
    }
    if (reason) console.log(`refreshQuotes called: ${reason}`);
    await refetch();
  }, [refetch, queryClient]);

  // Synchronisation automatique après sync
  useEffect(() => {
    if (syncStatus.lastSyncTime && syncStatus.pendingCount === 0) {
      const timer = setTimeout(() => refreshQuotes('sync complete'), 1000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus.lastSyncTime, syncStatus.pendingCount, refreshQuotes]);

  // Mutation pour toggleLike
  const toggleLikeMutation = useMutation({
    mutationKey: ['quotes', 'toggleLike'],
    mutationFn: (id: number) => quoteRepository.toggleLike(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes']);
      if (previousQuotes) {
        queryClient.setQueryData<Quote[]>(['quotes'], old => {
          if (!old) return [];
          return old.map(q => q.id === id ? { ...q, isLiked: !q.isLiked, likesCount: q.isLiked ? q.likesCount - 1 : q.likesCount + 1 } : q);
        });
      }
      return { previousQuotes };
    },
    onError: (err, id, ctx) => {
      // Opération en file d'attente offline → conserver l'état optimiste, pas de rollback
      if (QueuedOperationError.is(err)) return;
      if (ctx?.previousQuotes) queryClient.setQueryData(['quotes'], ctx.previousQuotes);
    },
    onSettled: (_data, err) => {
      if (QueuedOperationError.is(err)) return;
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  // Mutation pour toggleSave / saveQuote
  const toggleSaveMutation = useMutation({
    mutationKey: ['quotes', 'toggleSave'],
    mutationFn: ({ id, quote }: { id: number; quote?: Quote }) => 
      quote ? quoteRepository.saveQuote(id, quote) : quoteRepository.toggleSave(id),
    onMutate: async ({ id, quote }) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes']);
      if (previousQuotes) {
        queryClient.setQueryData<Quote[]>(['quotes'], old => {
          if (!old) return [];
          const exists = old.some(q => q.id === id);
          if (exists) {
            return old.map(q => q.id === id ? { 
              ...q, 
              isSaved: quote ? true : !q.isSaved,
              // Ajouter savedAt avec la date actuelle quand on sauvegarde
              savedAt: (quote || !q.isSaved) ? new Date().toISOString() : null
            } : q);
          } else if (quote) {
            return [{ ...quote, isSaved: true, savedAt: new Date().toISOString() }, ...old];
          }
          return old;
        });
      }
      return { previousQuotes };
    },
    onError: (err, variables, ctx) => {
      // Opération en file d'attente offline → conserver l'état optimiste, pas de rollback
      if (QueuedOperationError.is(err)) return;
      if (ctx?.previousQuotes) queryClient.setQueryData(['quotes'], ctx.previousQuotes);
    },
    onSettled: (_data, err) => {
      // Si l'opération est en queue offline → ne pas refetch le serveur
      // (il ne connaît pas encore cette sauvegarde ; l'état local fait foi jusqu'à la sync)
      if (QueuedOperationError.is(err)) return;
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  // Mutation pour deleteQuote
  const deleteQuoteMutation = useMutation({
    mutationKey: ['quotes', 'deleteQuote'],
    mutationFn: (id: number) => quoteRepository.deleteQuote(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes']);
      if (previousQuotes) {
        queryClient.setQueryData<Quote[]>(['quotes'], old => {
          if (!old) return [];
          return old.filter(q => q.id !== id);
        });
      }
      return { previousQuotes };
    },
    onError: (err, id, ctx) => {
      if (ctx?.previousQuotes) queryClient.setQueryData(['quotes'], ctx.previousQuotes);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  // Mutation pour addQuote
  const addQuoteMutation = useMutation({
    mutationKey: ['quotes', 'addQuote'],
    mutationFn: async ({ text, book, author }: { text: string; book?: string | null; author?: string | null }) => {
      const cleanBook = book && book.trim() !== '' && book.trim() !== 'Livre inconnu' ? book.trim() : null;
      const cleanAuthor = author && author.trim() !== '' && author.trim() !== 'Auteur inconnu' ? author.trim() : null;
      return quoteRepository.createQuote(text, cleanBook, cleanAuthor);
    },
    onMutate: async ({ text, book, author }) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes']);
      const user = await authService.getUser();
      const cleanBook = book && book.trim() !== '' && book.trim() !== 'Livre inconnu' ? book.trim() : null;
      const cleanAuthor = author && author.trim() !== '' && author.trim() !== 'Auteur inconnu' ? author.trim() : null;
      
      const newQuote: Quote = {
        id: Date.now(),
        text,
        book: cleanBook,
        author: cleanAuthor,
        likesCount: 0,
        isLiked: false,
        date: new Date().toISOString(),
        isSaved: false,
        comments: 0,
        blockData: {},
        user: user || { id: "1", name: "Clément QLF", username: "@clementqlf" }
      };

      queryClient.setQueryData<Quote[]>(['quotes'], old => {
        if (!old) return [newQuote];
        return [newQuote, ...old];
      });

      return { previousQuotes };
    },
    onError: (err, newQuote, ctx) => {
      if (ctx?.previousQuotes) queryClient.setQueryData(['quotes'], ctx.previousQuotes);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  // Mutation pour updateQuote
  const updateQuoteMutation = useMutation({
    mutationKey: ['quotes', 'updateQuote'],
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Quote> }) => quoteRepository.updateQuote(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes']);
      if (previousQuotes) {
        queryClient.setQueryData<Quote[]>(['quotes'], old => {
          if (!old) return [];
          return old.map(q => q.id === id ? { ...q, ...updates } : q);
        });
      }
      return { previousQuotes };
    },
    onError: (err, variables, ctx) => {
      if (ctx?.previousQuotes) queryClient.setQueryData(['quotes'], ctx.previousQuotes);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  // Fonction pour récupérer un utilisateur par username
  const getUserByUsername = useCallback(async (username: string): Promise<User | undefined> => {
    try {
      const user = await quoteRepository.getUserByUsername(username);
      return user as User | undefined;
    } catch {
      return undefined;
    }
  }, [quoteRepository]);

  // ✅ Memoize toutes les fonctions pour éviter les re-renders
  const contextValue = useMemo(() => ({
    quotes,
    isLoading,
    syncStatus,
    refreshQuotes,
    toggleLikeQuote: async (id: number) => {
      try {
        return await toggleLikeMutation.mutateAsync(id);
      } catch (e) {
        // Op. en queue offline : retourner le résultat optimiste comme un succès
        if (QueuedOperationError.is(e)) return e.result as { isLiked: boolean; likesCount: number };
        throw e;
      }
    },
    toggleSaveQuote: async (id: number, quote?: Quote) => {
      try {
        return await toggleSaveMutation.mutateAsync({ id, quote });
      } catch (e) {
        // Op. en queue offline : retourner le résultat optimiste comme un succès
        if (QueuedOperationError.is(e)) return e.result as { isSaved: boolean; savedAt?: string | null };
        throw e;
      }
    },
    deleteQuote: (id: number) => deleteQuoteMutation.mutateAsync(id),
    addQuote: (text: string, book?: string | null, author?: string | null) => 
      addQuoteMutation.mutateAsync({ text, book, author }),
    updateQuote: (id: number, updates: Partial<Quote>) => 
      updateQuoteMutation.mutateAsync({ id, updates }),
    getUserByUsername,
  }), [
    quotes, 
    isLoading, 
    syncStatus,
    refreshQuotes,
    toggleLikeMutation,
    toggleSaveMutation, 
    deleteQuoteMutation,
    addQuoteMutation,
    updateQuoteMutation,
    getUserByUsername
  ]);

  return (
    <QuoteContext.Provider value={contextValue}>
      {children}
    </QuoteContext.Provider>
  );
};

export const useQuote = () => {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }
  return context;
};
