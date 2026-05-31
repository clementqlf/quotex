import React, { createContext, useContext, useMemo, ReactNode, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Quote } from '@/src/shared/api/types';
import { SupabaseQuoteRepository } from '../api/SupabaseQuoteRepository';
import { authService } from '@/src/entities/user/api/AuthService';
import { useNetworkSync, SyncStatus } from '@/src/entities/quote/lib/useNetworkSync';

type QuoteContextType = {
  syncStatus: SyncStatus & { syncNow: () => void; isOnline: boolean; isOffline: boolean };
};

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export const QuoteProvider = ({ children }: { children: ReactNode }) => {
  const syncStatus = useNetworkSync();

  return (
    <QuoteContext.Provider value={{ syncStatus }}>
      {children}
    </QuoteContext.Provider>
  );
};

export const useQuote = () => {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }

  const queryClient = useQueryClient();
  const quoteRepository = useMemo(() => SupabaseQuoteRepository.getInstance(), []);

  const { data: quotes = [], isLoading, refetch } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => quoteRepository.getQuotes(),
  });

  // Refresh refetch
  const refreshQuotes = async (reason?: string) => {
    if (reason) console.log(`refreshQuotes called: ${reason}`);
    await refetch();
  };

  // Sync effect
  useEffect(() => {
    if (context.syncStatus.lastSyncTime && context.syncStatus.pendingCount === 0) {
      const timer = setTimeout(() => refreshQuotes('sync complete'), 1000);
      return () => clearTimeout(timer);
    }
  }, [context.syncStatus.lastSyncTime, context.syncStatus.pendingCount]);

  const toggleLikeMutation = useMutation({
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
      if (ctx?.previousQuotes) queryClient.setQueryData(['quotes'], ctx.previousQuotes);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  });

  const toggleSaveMutation = useMutation({
    mutationFn: (id: number) => quoteRepository.toggleSave(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      const previousQuotes = queryClient.getQueryData<Quote[]>(['quotes']);
      if (previousQuotes) {
        queryClient.setQueryData<Quote[]>(['quotes'], old => {
          if (!old) return [];
          return old.map(q => q.id === id ? { ...q, isSaved: !q.isSaved } : q);
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

  const deleteQuoteMutation = useMutation({
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

  const addQuoteMutation = useMutation({
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

  const updateQuoteMutation = useMutation({
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

  const getUserByUsername = async (username: string) => {
    return quoteRepository.getUserByUsername(username);
  };

  return {
    quotes,
    isLoading,
    syncStatus: context.syncStatus,
    refreshQuotes,
    toggleLikeQuote: async (id: number) => { await toggleLikeMutation.mutateAsync(id); },
    toggleSaveQuote: async (id: number) => { await toggleSaveMutation.mutateAsync(id); },
    deleteQuote: async (id: number) => { await deleteQuoteMutation.mutateAsync(id); },
    addQuote: async (text: string, book?: string | null, author?: string | null) => { return await addQuoteMutation.mutateAsync({ text, book, author }); },
    updateQuote: async (id: number, updates: Partial<Quote>) => { await updateQuoteMutation.mutateAsync({ id, updates }); },
    getUserByUsername,
  };
};
