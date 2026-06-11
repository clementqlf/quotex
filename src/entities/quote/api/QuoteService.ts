import { Quote } from '@/src/shared/api/types';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';

import { QuoteUseCases } from '@/src/features/quote/model/QuoteUseCases';
import { SupabaseQuoteRepository } from './SupabaseQuoteRepository';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));


/**
 * Service de façade pour les Quotes
 * Délègue la plupart des opérations au SupabaseQuoteRepository
 * Cette classe est conservée pour la compatibilité ascendante
 * @deprecated Utiliser directement SupabaseQuoteRepository pour les nouvelles fonctionnalités
 */
class QuoteService {
    private repository = SupabaseQuoteRepository.getInstance();
    private queue = OperationQueue.getInstance();
    private useCases = new QuoteUseCases(this.repository);
    private isSyncing = false;

    // ========== Méthodes délégées au Repository ==========

    async getQuotes(): Promise<Quote[]> {
        return this.repository.getQuotes();
    }

    async getQuoteById(id: number): Promise<Quote | undefined> {
        const quote = await this.repository.getQuoteById(id);
        return quote || undefined;
    }

    async toggleLike(id: number): Promise<boolean> {
        const result = await this.repository.toggleLike(id);
        return result.isLiked;
    }

    async toggleSave(id: number): Promise<boolean> {
        const result = await this.repository.toggleSave(id);
        return result.isSaved;
    }

    async deleteQuote(id: number): Promise<void> {
        return this.repository.deleteQuote(id);
    }

    async addQuote(text: string, book?: string | null, author?: string | null): Promise<number> {
        const quote = await this.repository.createQuote(text, book, author);
        return quote.id;
    }

    async updateQuote(id: number, updates: Partial<Quote>): Promise<void> {
        await this.repository.updateQuote(id, updates);
    }

    async analyzeQuote(id: number): Promise<Quote> {
        return this.repository.analyzeQuote(id);
    }

    async chatWithAI(id: number, messages: { role: 'user' | 'model'; content: string }[]): Promise<string> {
        return this.repository.chatWithAI(id, messages);
    }

    async getUserByUsername(username: string): Promise<any | undefined> {
        return this.repository.getUserByUsername(username);
    }

    async getPendingQuotesCount(): Promise<number> {
        return this.useCases.getPendingQuotesCount();
    }

    async getAllPendingQuotes(): Promise<any[]> {
        const ops = await this.queue.getAll();
        return ops.filter(op => op.entityType === 'quote');
    }

    async clearPendingQuotes(): Promise<void> {
        // No-op for now, managed by OperationQueue
    }

    /**
     * Synchronise les citations en attente avec le serveur
     * @deprecated Utiliser QuoteUseCases.syncPendingQuotes()
     */
    async syncPendingQuotes(): Promise<any> {
        return this.useCases.syncPendingQuotes();
    }

    // ========== Méthodes de compatibilité ascendante ==========
    // Ces méthodes sont conservées pour éviter de casser le code existant
    // mais devraient être progressivement remplacées

    /**
     * @deprecated Utiliser SupabaseQuoteRepository.getUserQuotes()
     */
    async getUserQuotes(userId: string): Promise<Quote[]> {
        return this.repository.getUserQuotes(userId);
    }
}

export const quoteService = new QuoteService();
