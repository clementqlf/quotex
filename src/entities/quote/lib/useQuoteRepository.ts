import { useMemo } from 'react';
import { IQuoteRepository } from '../api/IQuoteRepository';
import { SupabaseQuoteRepository } from '../api/SupabaseQuoteRepository';

/**
 * Hook pour accéder au QuoteRepository
 * Permet d'injecter différentes implémentations (mock pour les tests)
 */
export const useQuoteRepository = (): IQuoteRepository => {
  // Pour l'instant, on utilise toujours SupabaseQuoteRepository
  // Plus tard, on pourra injecter via un contexte
  const repository = useMemo(() => {
    return SupabaseQuoteRepository.getInstance();
  }, []);
  
  return repository;
};

// Singleton export pour utilisation directe (hors React)
export const quoteRepository = SupabaseQuoteRepository.getInstance();
