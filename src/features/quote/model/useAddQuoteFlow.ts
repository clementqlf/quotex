import { useCallback } from 'react';

import { quoteService } from '@/src/entities/quote/api/QuoteService.facade';
import { Quote } from '@/src/shared/api/types';

/**
 * Résultat du save scanned quote
 */
export interface SaveScannedQuoteResult {
  success: boolean;
  quote?: Quote;
  error?: string;
}

/**
 * Actions pour l'ajout de citation
 */
export interface AddQuoteActions {
  saveScannedQuote: (text: string, book?: string | null, author?: string | null) => Promise<SaveScannedQuoteResult>;
}

/**
 * Hook dédié à la sauvegarde des citations scannées
 * Extraite de useScanController pour une meilleure séparation des responsabilités
 */
export const useAddQuoteFlow = (): AddQuoteActions => {
  // ========== QUOTE SAVING ==========
  /**
   * Sauvegarde une citation scannée
   */
  const saveScannedQuote = useCallback(async (
    text: string,
    book?: string | null,
    author?: string | null
  ): Promise<SaveScannedQuoteResult> => {
    try {
      console.log('[useAddQuoteFlow] Saving quote');
      const newQuote = await quoteService.createQuoteWithMatching(text, book, author);
      console.log('[useAddQuoteFlow] Quote saved successfully:', newQuote);
      return { success: true, quote: newQuote, error: undefined };
    } catch (error) {
      console.error('[useAddQuoteFlow] Failed to save quote:', error);
      return {
        success: false,
        quote: undefined,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, []);

  return {
    saveScannedQuote,
  };
};
