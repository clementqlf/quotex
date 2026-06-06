import { Quote, CreateQuoteDto } from '@/src/shared/api/types';
import { IQuoteRepository } from '@/src/entities/quote/api/IQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';

// Type pour les citations en attente de synchronisation
interface PendingQuote {
    id: number; // ID temporaire utilisé localement
    text: string;
    book: string | null;
    author: string | null;
    theme?: string;
    createdAt: string;
    retryCount?: number;
}

const MAX_RETRIES = 10;

/**
 * Use Cases pour les Quotes
 * Contient la logique métier pure, indépendante de l'implémentation technique
 */
export class QuoteUseCases {
    private queue = OperationQueue.getInstance();
    private isSyncing = false;

    constructor(
        private quoteRepository: IQuoteRepository
    ) {}

    /**
     * Bascule l'état 'Like' d'une citation
     */
    async toggleLike(id: number): Promise<{ isLiked: boolean; likesCount: number }> {
        // 1. Récupérer la citation actuelle
        const quote = await this.quoteRepository.getQuoteById(id);
        if (!quote) {
            throw new Error(`Quote with id ${id} not found`);
        }

        // 2. Déterminer le nouvel état
        const newIsLiked = !quote.isLiked;
        const newLikesCount = newIsLiked ? quote.likesCount + 1 : quote.likesCount - 1;

        // 3. Mise à jour optimiste locale via le repository
        await this.quoteRepository.updateQuote(id, {
            isLiked: newIsLiked,
            likesCount: newLikesCount
        });

        return { isLiked: newIsLiked, likesCount: newLikesCount };
    }

    /**
     * Bascule l'état 'Sauvegardé' (Favori) d'une citation
     */
    async toggleSave(id: number): Promise<{ isSaved: boolean }> {
        const quote = await this.quoteRepository.getQuoteById(id);
        if (!quote) {
            throw new Error(`Quote with id ${id} not found`);
        }

        const newIsSaved = !quote.isSaved;
        await this.quoteRepository.updateQuote(id, { isSaved: newIsSaved });

        return { isSaved: newIsSaved };
    }

    /**
     * Supprime une citation
     */
    async deleteQuote(id: number): Promise<void> {
        // Suppression optimiste locale
        await this.quoteRepository.deleteQuote(id);

        // Ajouter à la queue offline pour synchronisation ultérieure
        await this.queue.enqueue({
            type: 'DELETE',
            entityType: 'quote',
            entityId: id,
        });
    }

    /**
     * Crée une nouvelle citation avec matching et synchronisation intelligente
     */
    async createQuoteWithMatching(
        text: string,
        book?: string | null,
        author?: string | null
    ): Promise<Quote> {
        const cleanBook = this.cleanField(book);
        const cleanAuthor = this.cleanField(author);
        const tempId = Date.now();
        const createdAt = new Date().toISOString();

        // 1. Vérifier si nous avons une connexion réseau
        const isOnline = await this.checkNetworkConnection();

        // 2. Si nous avons des métadonnées (book/author) et que nous sommes en ligne, essayer le matching direct
        if ((cleanBook || cleanAuthor) && isOnline) {
            try {
                // Appeler le service de matching/sync
                const result = await this.syncWithMatching(text, cleanBook, cleanAuthor, tempId, createdAt);
                
                if (result) {
                    return result;
                }
            } catch (error) {
                console.error('[QuoteUseCases] Direct sync failed:', error);
            }
        }

        // 3. Si le matching échoue ou hors ligne, ajouter à la file d'attente
        await this.addToPendingQueue(tempId, text, cleanBook, cleanAuthor, createdAt);

        // 4. Créer la citation localement avec un ID temporaire
        const newQuote: Quote = {
            id: tempId,
            text,
            book: cleanBook,
            author: cleanAuthor,
            theme: undefined,
            likesCount: 0,
            likes: [],
            isLiked: false,
            date: createdAt,
            isSaved: false,
            comments: 0,
            blockData: {},
            user: { id: "1", name: "Clément QLF", username: "@clementqlf" }, // User par défaut
        };

        // Sauvegarder dans le cache local
        await this.updateLocalCacheWithNewQuote(newQuote);

        return newQuote;
    }

    /**
     * Synchronise une citation avec le serveur et applique les corrections
     */
    private async syncWithMatching(
        text: string,
        book: string | null,
        author: string | null,
        tempId: number,
        createdAt: string
    ): Promise<Quote | null> {
        // Cette méthode serait implémentée avec l'appel au backend
        // Pour l'instant, on retourne null pour utiliser la file d'attente
        // Dans une implémentation réelle, cela appellerait l'API /sync-quotes
        return null;
    }

    /**
     * Nettoie un champ (supprime les valeurs vides ou par défaut)
     */
    private cleanField(value: string | null | undefined): string | null {
        if (!value) return null;
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === 'Livre inconnu' || trimmed === 'Auteur inconnu') return null;
        return trimmed;
    }

    /**
     * Vérifie la connexion réseau
     */
    private async checkNetworkConnection(): Promise<boolean> {
        try {
            const response = await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                cache: 'no-store',
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Ajoute une citation à la file d'attente des synchronisations
     */
    private async addToPendingQueue(
        tempId: number,
        text: string,
        book: string | null,
        author: string | null,
        createdAt: string
    ): Promise<void> {
        const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
        
        const existingIndex = pending.findIndex(q => q.id === tempId);
        if (existingIndex > -1) {
            pending[existingIndex] = {
                ...pending[existingIndex],
                text,
                book,
                author,
                createdAt,
                retryCount: (pending[existingIndex].retryCount || 0) + 1
            };
        } else {
            pending.push({
                id: tempId,
                text,
                book,
                author,
                createdAt,
                retryCount: 0
            });
        }
        
        await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, pending);
    }

    /**
     * Met à jour le cache local avec une nouvelle citation
     */
    private async updateLocalCacheWithNewQuote(newQuote: Quote): Promise<void> {
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
        const updatedQuotes = [newQuote, ...quotes];
        await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);
    }

    /**
     * Synchronise les citations en attente avec le serveur
     */
    async syncPendingQuotes(): Promise<{
        syncedCount: number;
        total: number;
        errors: Array<{ quote: PendingQuote; error: string }>;
        corrections: Array<{ quoteId: string; originalAuthor?: string; matchedAuthor?: string; originalBook?: string; matchedBook?: string }>;
    }> {
        if (this.isSyncing) {
            console.log('[QuoteUseCases] Sync already in progress, skipping');
            return { syncedCount: 0, total: 0, errors: [], corrections: [] };
        }

        this.isSyncing = true;

        try {
            const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
            
            if (!pending || pending.length === 0) {
                this.isSyncing = false;
                return { syncedCount: 0, total: 0, errors: [], corrections: [] };
            }

            console.log(`[QuoteUseCases] Syncing ${pending.length} pending quotes...`);

            // Ici, on appellerait l'API /sync-quotes avec les quotes en attente
            // Pour l'instant, on simule une synchronisation réussie
            const result = await this.syncQuotesWithServer(pending);

            this.isSyncing = false;
            return result;
        } catch (error: any) {
            this.isSyncing = false;
            console.error('[QuoteUseCases] Sync failed:', error.message);
            return {
                syncedCount: 0,
                total: 0,
                errors: [],
                corrections: []
            };
        }
    }

    /**
     * Synchronise les citations avec le serveur (à implémenter avec l'API réelle)
     */
    private async syncQuotesWithServer(pending: PendingQuote[]): Promise<{
        syncedCount: number;
        total: number;
        errors: Array<{ quote: PendingQuote; error: string }>;
        corrections: Array<{ quoteId: string; originalAuthor?: string; matchedAuthor?: string; originalBook?: string; matchedBook?: string }>;
    }> {
        // Implémentation à compléter avec l'appel API réel
        // Pour l'instant, on retourne un succès fictif
        return {
            syncedCount: pending.length,
            total: pending.length,
            errors: [],
            corrections: []
        };
    }

    /**
     * Récupère le nombre de citations en attente
     */
    async getPendingQuotesCount(): Promise<number> {
        const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES);
        return pending ? pending.length : 0;
    }

    /**
     * Analyse une citation avec l'IA
     */
    async analyzeQuote(id: number): Promise<Quote> {
        const quote = await this.quoteRepository.getQuoteById(id);
        if (!quote) {
            throw new Error(`Quote with id ${id} not found`);
        }

        // Ici, on appellerait l'API d'analyse
        // Pour l'instant, on retourne la quote telle quelle
        return quote;
    }

    /**
     * Discute avec l'IA sur une citation
     */
    async chatWithAI(id: number, messages: { role: 'user' | 'model'; content: string }[]): Promise<string> {
        const quote = await this.quoteRepository.getQuoteById(id);
        if (!quote) {
            throw new Error(`Quote with id ${id} not found`);
        }

        // Implémentation à compléter avec l'appel API réel
        // Pour l'instant, on retourne une réponse fictive
        return "C'est une excellente question. Cette citation invite à une réflexion profonde sur le sens de la vie.";
    }

    /**
     * Met à jour une citation existante
     */
    async updateQuote(id: number, updates: Partial<Quote>): Promise<Quote> {
        const updatedQuote = await this.quoteRepository.updateQuote(id, updates);
        return updatedQuote;
    }

    /**
     * Récupère un utilisateur par son username
     */
    async getUserByUsername(username: string): Promise<any | undefined> {
        // Utiliser un service dédié ou le repository user
        // Pour l'instant, on délègue au repository
        try {
            const user = await (this.quoteRepository as any).getUserByUsername?.(username);
            return user;
        } catch {
            return undefined;
        }
    }

    /**
     * Récupère toutes les citations
     */
    async getQuotes(): Promise<Quote[]> {
        return await this.quoteRepository.getQuotes();
    }

    /**
     * Récupère une citation par son ID
     */
    async getQuoteById(id: number): Promise<Quote | null> {
        return await this.quoteRepository.getQuoteById(id);
    }

    /**
     * Efface toutes les citations en attente (pour tests/débogage)
     */
    async clearPendingQuotes(): Promise<void> {
        await StorageService.removeItem(STORAGE_KEYS.PENDING_QUOTES);
    }
}
