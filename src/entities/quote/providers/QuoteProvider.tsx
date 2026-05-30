import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Quote } from '@/src/shared/api/types';
import { IQuoteRepository } from '../api/IQuoteRepository';
import { SupabaseQuoteRepository } from '../api/SupabaseQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { useNetworkSync, SyncStatus } from '@/src/entities/quote/lib/useNetworkSync';

type QuoteContextType = {
  quotes: Quote[];
  isLoading: boolean;
  syncStatus: SyncStatus & { syncNow: () => void; isOnline: boolean; isOffline: boolean };
  refreshQuotes: () => Promise<void>;
  toggleLikeQuote: (id: number) => Promise<void>;
  toggleSaveQuote: (id: number) => Promise<void>;
  deleteQuote: (id: number) => Promise<void>;
  addQuote: (text: string, book?: string | null, author?: string | null) => Promise<void>;
  updateQuote: (id: number, updates: Partial<Quote>) => Promise<void>;
  getUserByUsername: (username: string) => Promise<any>;
};

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

/**
 * Provider dédié à la gestion des Quotes
 * Remplace la partie Quote de DataProvider
 */
export const QuoteProvider = ({ children }: { children: ReactNode }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Repository instance
  const quoteRepository = useMemo(() => SupabaseQuoteRepository.getInstance(), []);
  
  // Network sync status
  const syncStatus = useNetworkSync();

  // Charger les quotes depuis le cache au démarrage
  const loadCachedQuotes = async () => {
    try {
      const cachedQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);
      if (cachedQuotes) {
        setQuotes(cachedQuotes);
      }
    } catch (error) {
      console.error("QuoteProvider: Failed to load cached quotes", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Rafraîchir les quotes depuis le serveur
  const refreshQuotes = useCallback(async (reason: string = 'unknown') => {
    console.log(`QuoteProvider: refreshQuotes called (Reason: ${reason})`);
    try {
      const fetchedQuotes = await quoteRepository.getQuotes();
      setQuotes(fetchedQuotes);
      await StorageService.setItem(STORAGE_KEYS.QUOTES, fetchedQuotes);
    } catch (error) {
      console.error("QuoteProvider: Failed to refresh quotes", error);
    }
  }, [quoteRepository]);

  // Toggle like avec optimisation
  const toggleLikeQuote = useCallback(async (id: number) => {
    // Optimistic update
    setQuotes(prevQuotes =>
      prevQuotes.map(q =>
        q.id === id
          ? { 
              ...q, 
              isLiked: !q.isLiked, 
              likesCount: q.isLiked ? q.likesCount - 1 : q.likesCount + 1 
            }
          : q
      )
    );

    // Call repository
    await quoteRepository.toggleLike(id);
    
    // Rafraîchir pour synchroniser avec le serveur
    await refreshQuotes('toggleLike complete');
  }, [quoteRepository, refreshQuotes]);

  // Toggle save
  const toggleSaveQuote = useCallback(async (id: number) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, isSaved: !q.isSaved } : q));
    await quoteRepository.toggleSave(id);
    await refreshQuotes('toggleSave complete');
  }, [quoteRepository, refreshQuotes]);

  // Delete quote
  const deleteQuote = useCallback(async (id: number) => {
    // Optimistic update
    setQuotes(prev => prev.filter(q => q.id !== id));
    await quoteRepository.deleteQuote(id);
    await refreshQuotes('deleteQuote complete');
  }, [quoteRepository, refreshQuotes]);

  // Add quote
  const addQuote = useCallback(async (text: string, book?: string | null, author?: string | null) => {
    console.log('[QuoteProvider] addQuote called');
    
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
    
    console.log('[QuoteProvider] Adding quote to local state, tempId:', tempId);
    setQuotes(prev => [newQuote, ...prev]);
    
    console.log('[QuoteProvider] Calling repository.addQuote...');
    await quoteRepository.createQuote(text, cleanBook, cleanAuthor);
    console.log('[QuoteProvider] repository.addQuote completed');
    
    // Rafraîchir pour obtenir l'ID réel du serveur
    await refreshQuotes('addQuote complete');
    console.log('[QuoteProvider] addQuote completed successfully');
  }, [quoteRepository, refreshQuotes]);

  // Update quote
  const updateQuote = useCallback(async (id: number, updates: Partial<Quote>) => {
    // Optimistic update
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    
    // Call repository
    await quoteRepository.updateQuote(id, updates);
    
    // Refresh
    await refreshQuotes('updateQuote complete');
  }, [quoteRepository, refreshQuotes]);

  // Get user by username
  const getUserByUsername = useCallback(async (username: string) => {
    return await quoteRepository.getUserByUsername(username);
  }, [quoteRepository]);

  // Charger les quotes au montage
  useEffect(() => {
    loadCachedQuotes();
    refreshQuotes('initial load');
  }, [refreshQuotes]);

  const contextValue = useMemo(() => ({
    quotes,
    isLoading,
    syncStatus,
    refreshQuotes,
    toggleLikeQuote,
    toggleSaveQuote,
    deleteQuote,
    addQuote,
    updateQuote,
    getUserByUsername,
  }), [
    quotes, 
    isLoading, 
    syncStatus,
    refreshQuotes,
    toggleLikeQuote,
    toggleSaveQuote,
    deleteQuote,
    addQuote,
    updateQuote,
    getUserByUsername
  ]);

  return (
    <QuoteContext.Provider value={contextValue}>
      {children}
    </QuoteContext.Provider>
  );
};

// Hook pour utiliser le QuoteContext
export const useQuote = () => {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }
  return context;
};
