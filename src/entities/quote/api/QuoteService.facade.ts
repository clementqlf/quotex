import { SupabaseQuoteRepository } from './SupabaseQuoteRepository';
import { QuoteUseCases } from '../model/QuoteUseCases';

/**
 * Service de citation - Façade qui expose les QuoteUseCases
 * Utilise SupabaseQuoteRepository comme implémentation par défaut
 */
export class QuoteService {
    private static instance: QuoteUseCases | null = null;

    /**
     * Récupère l'instance singleton des QuoteUseCases
     * Crée une nouvelle instance si elle n'existe pas
     */
    public static getInstance(): QuoteUseCases {
        if (!QuoteService.instance) {
            const repository = SupabaseQuoteRepository.getInstance();
            QuoteService.instance = new QuoteUseCases(repository);
        }
        return QuoteService.instance;
    }

    /**
     * Réinitialise l'instance (utile pour les tests)
     */
    public static resetInstance(): void {
        QuoteService.instance = null;
    }
}

// Instance singleton pour compatibilité avec l'ancien code
export const quoteService = QuoteService.getInstance();
