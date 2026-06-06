import { Quote } from '@/src/shared/api/types';
import { Platform } from 'react-native';
import { localQuotesDB, globalQuotesDB } from '@/src/shared/api/staticData';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { supabase } from '@/src/shared/api/supabase';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';

import { API_BASE_URL } from '@/src/shared/config/api';
import { authService } from '@/src/entities/user/api/AuthService';
import { SupabaseQuoteRepository } from './SupabaseQuoteRepository';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));

// Type for pending quotes in the queue
interface PendingQuote {
    id: number; // Temporary ID used locally
    text: string;
    book: string | null;
    author: string | null;
    theme?: string;
    createdAt: string;
    retryCount?: number;
}

const MAX_RETRIES = 10;

/**
 * Service de façade pour les Quotes
 * Délègue la plupart des opérations au SupabaseQuoteRepository
 * Cette classe est conservée pour la compatibilité ascendante
 * @deprecated Utiliser directement SupabaseQuoteRepository pour les nouvelles fonctionnalités
 */
class QuoteService {
    private repository = SupabaseQuoteRepository.getInstance();
    private queue = OperationQueue.getInstance();
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
        return this.repository.getPendingQuotesCount();
    }

    async getAllPendingQuotes(): Promise<PendingQuote[]> {
        // Cast le résultat du repository
        return this.repository.getAllPendingQuotes() as unknown as PendingQuote[];
    }

    async clearPendingQuotes(): Promise<void> {
        return this.repository.clearPendingQuotes();
    }

    /**
     * Synchronise les citations en attente avec le serveur
     * @deprecated Utiliser directement SupabaseQuoteRepository.syncPendingQuotes()
     */
    async syncPendingQuotes(): Promise<{
        syncedCount: number;
        total: number;
        errors: Array<{ quote: PendingQuote; error: string }>;
        corrections: Array<{ quoteId: string; originalAuthor?: string; matchedAuthor?: string; originalBook?: string; matchedBook?: string }>;
    }> {
        // @ts-ignore - délégation au repository
        return this.repository['syncPendingQuotes']();
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
