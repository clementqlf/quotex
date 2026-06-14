import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { quoteService } from '@/src/features/quote/api/QuoteService';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { scanService } from '@/src/features/scanner/api/ScanService';
import { PlatformServices } from '@/src/shared/platform';
import { Quote, User } from '@/src/shared/api/types';

/**
 * Props pour le hook useRandomQuoteFlow
 */
export interface UseRandomQuoteFlowProps {
  quotes: Quote[];
  currentUser: User | null;
}

/**
 * État du random quote
 */
export interface RandomQuoteState {
  randomQuote: Quote | null;
  showRandomQuoteModal: boolean;
  setShowRandomQuoteModal: (value: boolean) => void;
}

/**
 * Actions du random quote
 */
export interface RandomQuoteActions {
  handleRandomQuotePress: () => void;
  saveRandomQuoteToCollection: (quoteId: number) => Promise<{ success: boolean; isSaved?: boolean; savedAt?: string | null; error?: string }>;
}

/**
 * Résultat du hook useRandomQuoteFlow
 */
export interface UseRandomQuoteFlowResult extends RandomQuoteState, RandomQuoteActions {}

/**
 * Hook dédié à la gestion des citations aléatoires
 * Extraite de useScanController pour une meilleure séparation des responsabilités
 */
export const useRandomQuoteFlow = (
  props: UseRandomQuoteFlowProps
): UseRandomQuoteFlowResult => {
  const { quotes, currentUser } = props;
  const { toggleSaveQuote } = useQuote();

  // ========== RANDOM QUOTE STATE ==========
  const [randomQuote, setRandomQuote] = useState<Quote | null>(null);
  const [showRandomQuoteModal, setShowRandomQuoteModal] = useState(false);

  // ========== QUOTE SAVING ==========
  const saveRandomQuoteToCollection = useCallback(async (
    quoteId: number
  ): Promise<{ success: boolean; isSaved?: boolean; savedAt?: string | null; error?: string }> => {
    try {
      console.log('[useRandomQuoteFlow] Saving random quote to collection');
      const quoteObj = randomQuote && randomQuote.id === quoteId ? randomQuote : undefined;
      const result = await toggleSaveQuote(quoteId, quoteObj);
      return { 
        success: true, 
        isSaved: result?.isSaved ?? true, 
        savedAt: result?.savedAt, 
        error: undefined 
      };
    } catch (error) {
      console.error('[useRandomQuoteFlow] Failed to save random quote to collection:', error);
      return {
        success: false,
        isSaved: undefined,
        savedAt: undefined,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, [toggleSaveQuote, randomQuote]);

  // ========== RANDOM QUOTE HANDLERS ==========
  const handleRandomQuotePress = useCallback(async () => {
    try {
      const result = await scanService.getRandomQuoteFromOtherUsers(quotes, currentUser?.id);
      
      if (result.success && result.quote) {
        PlatformServices.haptics.impactAsync("light");
        setRandomQuote(result.quote);
        setShowRandomQuoteModal(true);
      } else {
        Alert.alert("Aucune citation", "Aucune citation d'autres utilisateurs n'est disponible pour le moment.");
      }
    } catch {
      Alert.alert("Aucune citation", "Aucune citation d'autres utilisateurs n'est disponible pour le moment.");
    }
  }, [quotes, currentUser?.id]);

  return {
    // State
    randomQuote,
    showRandomQuoteModal,
    setShowRandomQuoteModal,
    
    // Actions
    handleRandomQuotePress,
    saveRandomQuoteToCollection,
  };
};
