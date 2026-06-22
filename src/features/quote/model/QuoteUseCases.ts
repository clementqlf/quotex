import { IQuoteRepository } from '@/src/entities/quote/api/IQuoteRepository';
import { authService } from '@/src/entities/user/api/AuthService';
import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { Quote, User } from '@/src/shared/api/types';
import { OperationQueue, PendingOperation } from '@/src/shared/lib/offline/OperationQueue';
import NetInfo from '@react-native-community/netinfo';


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

        try {
            // 3. Essayer la mise à jour optimiste via le repository
            await this.quoteRepository.updateQuote(id, {
                isLiked: newIsLiked,
                likesCount: newLikesCount
            });
            return { isLiked: newIsLiked, likesCount: newLikesCount };
        } catch {
            // 4. Si échec (hors-ligne), ajouter à la queue
            await this.queue.enqueue({
                type: newIsLiked ? 'LIKE' : 'UNLIKE',
                entityType: 'quote',
                entityId: id,
            });

            // 5. Retourner le nouvel état pour l'UI optimiste
            return { isLiked: newIsLiked, likesCount: newLikesCount };
        }
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
        
        try {
            await this.quoteRepository.updateQuote(id, { isSaved: newIsSaved });
            return { isSaved: newIsSaved };
        } catch {
            // Si échec (hors-ligne), ajouter à la queue
            await this.queue.enqueue({
                type: newIsSaved ? 'SAVE' : 'UNSAVE',
                entityType: 'quote',
                entityId: id,
            });

            // Retourner le nouvel état pour l'UI optimiste
            return { isSaved: newIsSaved };
        }
    }

    /**
     * Sauvegarde explicitement une citation dans la collection de l'utilisateur.
     * Cette action est idempotente: elle ne retire jamais la citation.
     */
    async saveQuoteToCollection(id: number, quote?: Quote): Promise<{ isSaved: boolean; savedAt?: string | null }> {
        try {
            return await this.quoteRepository.saveQuote(id, quote);
        } catch {
            await this.queue.enqueue({
                type: 'SAVE',
                entityType: 'quote',
                entityId: id,
            });

            return { isSaved: true, savedAt: null };
        }
    }

    /**
     * Supprime une citation
     */
    async deleteQuote(id: number): Promise<void> {
        // Suppression optimiste locale
        try {
            await this.quoteRepository.deleteQuote(id);
        } catch (error) {
            console.error('[QuoteUseCases] Failed to delete quote locally:', error);
        }

        // Toujours ajouter à la queue offline pour synchronisation ultérieure
        // Même si la suppression locale a réussi, on veut la synchroniser avec le serveur
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
        const tempId = Date.now(); // ID temporaire UNIQUE
        const createdAt = new Date().toISOString();

        // Get the real current user
        const user = await authService.getUser();
        const fallbackUser = { id: "1", name: "Clément QLF", username: "@clementqlf" };

        // 1. Créer la citation localement avec un ID temporaire (optimistic update)
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
            user: user || fallbackUser, // User réel
            // Marqueurs pour l'UI
            _isPending: true,
        };

        // 2. Sauvegarder dans le cache local
        try {
            await this.updateLocalCacheWithNewQuote(newQuote);
        } catch (error) {
            console.error('[QuoteUseCases] Failed to update local cache:', error);
        }

        // 3. Ajouter à la queue de synchronisation UNIFIÉE
        await this.queue.enqueue({
            type: 'CREATE',
            entityType: 'quote',
            entityId: tempId,
            payload: { text, book: cleanBook, author: cleanAuthor, tempId, createdAt },
        });

        // 4. Essayer de synchroniser immédiatement si en ligne
        try {
            const isOnline = await this.checkNetworkConnection();
            if (isOnline) {
                await this.syncPendingQuotes();
            }
        } catch {
            console.log('[QuoteUseCases] Network check failed, will sync later');
        }

        return newQuote;
    }

    /**
     * Exécute la création d'une citation sur le serveur
     */
    private async executeCreateQuote(op: PendingOperation): Promise<void> {
        const { text, book, author, tempId } = op.payload || {};
        
        if (!text || !tempId) {
            throw new Error('Missing required payload data');
        }

        // Appeler le repository pour créer la citation sur le serveur
        try {
            const serverQuote = await this.quoteRepository.createQuote(text, book, author);
            
            // Mettre à jour la citation dans le cache local avec les données canoniques du serveur
            await this.replaceTempQuote(tempId, serverQuote);
            
            // Remaper l'ID temporaire vers le vrai ID dans la file d'attente hors-ligne
            if (serverQuote.id !== tempId) {
                await this.queue.remapEntityId(tempId, serverQuote.id, 'quote');
            }
            
            console.log(`[QuoteUseCases] Successfully synced quote ${tempId} -> ${serverQuote.id}`);
        } catch (error) {
            console.error(`[QuoteUseCases] Failed to sync quote ${tempId}:`, error);
            throw error;
        }
    }

    /**
     * Remplace l'ID temporaire par le vrai ID et met à jour les données canoniques dans le cache local
     */
    private async replaceTempQuote(tempId: number, serverQuote: Quote): Promise<void> {
        const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
        const updatedQuotes = quotes.map(q => {
            if (q.id === tempId) {
                return { 
                    ...q, 
                    id: serverQuote.id, 
                    book: serverQuote.book,
                    author: serverQuote.author,
                    _isPending: false,
                    wasSynced: true,
                    syncCorrections: serverQuote.syncCorrections
                };
            }
            return q;
        });
        await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);
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
        const state = await NetInfo.fetch();
        return Boolean(state.isConnected && state.isInternetReachable);
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
     * Utilise maintenant OperationQueue pour la synchronisation unifiée
     */
    async syncPendingQuotes(): Promise<{
        syncedCount: number;
        total: number;
        errors: { quote?: any; operation?: PendingOperation; error: string }[];
        corrections: { quoteId: string; originalAuthor?: string; matchedAuthor?: string; originalBook?: string; matchedBook?: string }[];
    }> {
        if (this.isSyncing) {
            console.log('[QuoteUseCases] Sync already in progress, skipping');
            return { syncedCount: 0, total: 0, errors: [], corrections: [] };
        }

        this.isSyncing = true;

        try {
            // Récupérer les opérations en attente via OperationQueue
            const pendingOps = await this.queue.getAll();
            
            if (!pendingOps || pendingOps.length === 0) {
                return { syncedCount: 0, total: 0, errors: [], corrections: [] };
            }

            console.log(`[QuoteUseCases] Syncing ${pendingOps.length} pending operations...`);

            // Flush la queue avec l'exécuteur approprié
            const result = await this.queue.flush(this.executePendingOperation.bind(this));

            return {
                syncedCount: result.succeeded,
                total: result.succeeded + result.failed,
                errors: [],
                corrections: []
            };
        } catch (error: any) {
            console.error('[QuoteUseCases] Sync failed:', error.message);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Exécute une opération en attente en fonction de son type
     */
    private async executePendingOperation(op: PendingOperation): Promise<void> {
        switch (op.type) {
            case 'LIKE':
            case 'UNLIKE':
                await this.executeLikeOperation(op);
                break;
            case 'SAVE':
            case 'UNSAVE':
                await this.executeSaveOperation(op);
                break;
            case 'DELETE':
                await this.executeDeleteOperation(op);
                break;
            case 'CREATE':
                await this.executeCreateQuote(op);
                break;
            case 'UPDATE':
                await this.executeUpdateOperation(op);
                break;
            default:
                throw new Error(`Unknown operation type: ${op.type}`);
        }
    }

    private async executeLikeOperation(op: PendingOperation): Promise<void> {
        await this.quoteRepository.toggleLike(op.entityId);
    }

    private async executeSaveOperation(op: PendingOperation): Promise<void> {
        await this.quoteRepository.toggleSave(op.entityId);
    }

    private async executeDeleteOperation(op: PendingOperation): Promise<void> {
        await this.quoteRepository.deleteQuote(op.entityId);
    }

    private async executeUpdateOperation(op: PendingOperation): Promise<void> {
        if (op.payload) {
            await this.quoteRepository.updateQuote(op.entityId, op.payload);
        }
    }

    /**
     * Récupère le nombre de citations en attente
     * Utilise maintenant OperationQueue
     */
    async getPendingQuotesCount(): Promise<number> {
        const pending = await this.queue.getAll();
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
    async getUserByUsername(username: string): Promise<User | undefined> {
        // Utiliser un service dédié ou le repository user
        // Pour l'instant, on délègue au repository
        try {
            if (typeof this.quoteRepository.getUserByUsername === 'function') {
                return await this.quoteRepository.getUserByUsername(username);
            }
            return undefined;
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
     * Utilise maintenant OperationQueue
     */
    async clearPendingQuotes(): Promise<void> {
        // Pour l'instant, on efface juste le storage de l britannique queue
        // Note: Cela ne devrait être utilisé que pour le débogage
        await StorageService.removeItem(STORAGE_KEYS.PENDING_OPERATIONS);
    }
}
