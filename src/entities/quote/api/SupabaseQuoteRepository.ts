import { Quote, User } from '@/src/shared/api/types';
import { IQuoteRepository } from './IQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

import { httpClient } from '@/src/shared/api/HttpClient';
import { authService } from '@/src/entities/user/api/AuthService';
import { localQuotesDB, globalQuotesDB } from '@/src/shared/api/staticData';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';

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

interface SyncCorrection {
    quoteId?: string;
    originalAuthor?: string;
    matchedAuthor?: string;
    originalBook?: string;
    matchedBook?: string;
}

interface SyncDetail {
    bookId?: number;
    authorId?: number;
}

const MAX_RETRIES = 10;

/**
 * Implémentation du Repository Quote avec Supabase
 * Cette classe implique IQuoteRepository avec l'API Supabase
 * Elle gère à la fois les appels HTTP, le cache local, et la synchronisation offline
 */
export class SupabaseQuoteRepository implements IQuoteRepository {
  private static instance: SupabaseQuoteRepository | null = null;
  private isSyncing = false;
  
  // Singleton pattern pour éviter multiples instances
  public static getInstance(): SupabaseQuoteRepository {
    if (!SupabaseQuoteRepository.instance) {
      SupabaseQuoteRepository.instance = new SupabaseQuoteRepository();
    }
    return SupabaseQuoteRepository.instance;
  }

  constructor() {}

  private async checkConnection(): Promise<boolean> {
    try {
      await httpClient.request('/quotes', { method: 'OPTIONS' });
      return true;
    } catch (error) {
      return false;
    }
  }

  private readonly API_URL = `${httpClient['buildUrl']('')}/quotes`;

  private async getHeaders(extraHeaders: Record<string, string> = {}) {
    const token = await authService.getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private mapQuoteFromServer(q: any): Quote {
    return {
        id: q.id,
        text: q.text,
        book: q.book,
        author: q.author,
        theme: q.theme,
        likesCount: q.likesCount || 0,
        isLiked: q.isLiked || false,
        date: q.date || new Date().toISOString(),
        time: q.date ? new Date(q.date).toLocaleDateString() : "Aujourd'hui",
        isSaved: q.isSaved || false,
        comments: q.comments || 0,
        blockData: q.blockData ? (typeof q.blockData === 'string' ? JSON.parse(q.blockData) : q.blockData) : {},
        user: q.user,
        aiInterpretation: q.aiInterpretation,
    };
  }

  private async seedDataIfNeeded(): Promise<void> {
    const storedQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);
    if (!storedQuotes) {
        const initialQuotes = [...localQuotesDB, ...globalQuotesDB].map(q => ({
            id: q.id,
            text: q.text,
            book: q.book,
            author: q.author,
            theme: (q as any).theme || undefined,
            likesCount: (q as any).likesCount || ((q as any).likes && typeof (q as any).likes === 'number' ? (q as any).likes : 0),
            likes: [],
            isLiked: q.isLiked,
            user: (q as any).user || { id: "1", name: "Clément QLF", username: "@clementqlf" },
            date: (q as any).date || (q as any).time,
            isSaved: (q as any).isSaved,
            comments: (q as any).comments,
            blockData: (q as any).blockData || {},
        } as Quote));
        await StorageService.setItem(STORAGE_KEYS.QUOTES, initialQuotes);
    }
  }

  /**
   * Ajoute une citation à la file d'attente des synchronisations
   */
  private async addToPendingQueue(tempId: number, text: string, book: string | null, author: string | null, createdAt: string) {
    const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
    
    const existingIndex = pending.findIndex(q => q.id === tempId);
    if (existingIndex > -1) {
        pending[existingIndex] = {
            id: tempId,
            text,
            book,
            author,
            createdAt,
            retryCount: (pending[existingIndex].retryCount || 0) + 1
        };
    } else {
        pending.push({ id: tempId, text, book, author, createdAt, retryCount: 0 });
    }
    
    await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, pending);
    console.log(`Quote ${tempId} added to pending queue. Total pending: ${pending.length}`);
  }

  /**
   * Supprime une citation de la file d'attente
   */
  private async removeFromPendingQueue(tempId: number) {
    const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
    const filtered = pending.filter(q => q.id !== tempId);
    if (filtered.length !== pending.length) {
        await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, filtered);
        console.log(`Quote ${tempId} removed from pending queue. Remaining: ${filtered.length}`);
    }
  }

  /**
   * Synchronise les citations en attente avec le serveur
   */
  private async syncPendingQuotes(): Promise<{
    syncedCount: number;
    total: number;
    errors: Array<{ quote: PendingQuote; error: string }>;
    corrections: SyncCorrection[];
  }> {
    if (this.isSyncing) {
        console.log('[SupabaseQuoteRepository] Sync already in progress, skipping');
        return { syncedCount: 0, total: 0, errors: [], corrections: [] };
    }

    // Block concurrent calls immediately
    this.isSyncing = true;

    const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES);
    if (!pending || pending.length === 0) {
        console.log('No pending quotes to sync');
        this.isSyncing = false;
        return { syncedCount: 0, total: 0, errors: [], corrections: [] };
    }
    
    console.log(`[SupabaseQuoteRepository] Syncing ${pending.length} pending quotes...`);

    const user = await authService.getUser();
    if (!user) {
        console.log('[SupabaseQuoteRepository] Cannot sync: No user logged in');
        this.isSyncing = false;
        return { syncedCount: 0, total: pending.length, errors: [], corrections: [] };
    }

    // Map pending quotes to the format expected by the /sync-quotes endpoint
    const offlineQuotes = pending.map(p => ({
        id: String(p.id),
        text: p.text,
        author: p.author,
        book: p.book,
        theme: p.theme,
        createdAt: p.createdAt,
        userId: user.id
    }));

    try {
        const headers = await this.getHeaders();
        const SYNC_URL = `${httpClient['buildUrl']('')}/sync-quotes`;
        
        console.log(`[SupabaseQuoteRepository] Calling sync endpoint: ${SYNC_URL}`);
        const response = await fetch(SYNC_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ offlineQuotes }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[SupabaseQuoteRepository] Sync completed: ${result.syncedCount || 0} synced, ${result.errors?.length || 0} errors`);
            
            // Handle corrections from server
            const corrections: SyncCorrection[] = result.corrections || [];
            
            // Remove successfully synced quotes from pending queue
            const remaining: PendingQuote[] = [];
            const errors: Array<{ quote: PendingQuote; error: string }> = result.errors || [];
            
            // Build a map of successfully synced quote IDs (from the request)
            // The server returns errors, so any quote NOT in errors was synced
            const errorQuoteIds = new Set(errors.map(e => String(e.quote.id)));
            
            // Update local quotes with corrections
            const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
            const syncedAt = new Date().toISOString();
            
            for (const pendingQuote of pending) {
                const quoteIdString = String(pendingQuote.id);
                const hasError = errorQuoteIds.has(quoteIdString);
                
                if (hasError) {
                    // Keep in queue with incremented retry count
                    remaining.push({
                        ...pendingQuote,
                        retryCount: (pendingQuote.retryCount || 0) + 1
                    });
                } else {
                    // Successfully synced - update local quote with corrections
                    console.log(`[SupabaseQuoteRepository] Quote ${pendingQuote.id} synced successfully`);
                    
                    // Find the correction for this quote
                    const correction = corrections.find(c => c.quoteId === quoteIdString);
                    
                    if (correction) {
                        // Find and update the local quote
                        const quoteIndex = quotes.findIndex(q => q.id === pendingQuote.id);
                        if (quoteIndex > -1) {
                            // Apply corrections
                            const correctedQuote = { ...quotes[quoteIndex] };
                            
                            if (correction.originalAuthor && correction.matchedAuthor) {
                                correctedQuote.author = correction.matchedAuthor;
                            }
                            if (correction.originalBook && correction.matchedBook) {
                                correctedQuote.book = correction.matchedBook;
                            }
                            
                            // Mark as synced with correction info
                            correctedQuote.wasSynced = true;
                            correctedQuote.syncedAt = syncedAt;
                            correctedQuote.syncCorrections = {
                                author: correction.originalAuthor && correction.matchedAuthor ? 
                                    { original: correction.originalAuthor, matched: correction.matchedAuthor } : undefined,
                                book: correction.originalBook && correction.matchedBook ? 
                                    { original: correction.originalBook, matched: correction.matchedBook } : undefined,
                            };
                            
                            quotes[quoteIndex] = correctedQuote;
                        }
                    }
                }
            }
            
            // Save updated quotes
            await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
            
            // Save remaining pending quotes
            const validRemaining = remaining.filter(p => (p.retryCount || 0) < MAX_RETRIES);
            if (validRemaining.length < remaining.length) {
                console.log(`[SupabaseQuoteRepository] Dropped ${remaining.length - validRemaining.length} quotes exceeding max retries`);
            }
            
            if (validRemaining.length > 0) {
                await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, validRemaining);
            } else {
                await StorageService.removeItem(STORAGE_KEYS.PENDING_QUOTES);
            }
            
            this.isSyncing = false;
            return {
                syncedCount: result.syncedCount || (pending.length - remaining.length),
                total: pending.length,
                errors: errors.map(e => ({
                    quote: pending.find(p => String(p.id) === String(e.quote.id)) || e.quote,
                    error: e.error
                })),
                corrections: corrections
            };
        } else {
            const errorText = await response.text();
            console.error(`[SupabaseQuoteRepository] Sync failed with status ${response.status}: ${errorText}`);
            
            // Increment retry count for all pending quotes
            const updatedPending = pending.map(p => ({
                ...p,
                retryCount: (p.retryCount || 0) + 1
            })).filter(p => (p.retryCount || 0) < MAX_RETRIES);
            
            if (updatedPending.length < pending.length) {
                console.log(`[SupabaseQuoteRepository] Dropped ${pending.length - updatedPending.length} quotes exceeding max retries`);
            }
            
            if (updatedPending.length > 0) {
                await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, updatedPending);
            } else {
                await StorageService.removeItem(STORAGE_KEYS.PENDING_QUOTES);
            }
            
            this.isSyncing = false;
            return {
                syncedCount: 0,
                total: pending.length,
                errors: pending.map(p => ({
                    quote: p,
                    error: `Server error: ${response.status} - ${errorText}`
                })),
                corrections: []
            };
        }
    } catch (error: any) {
        console.error('[SupabaseQuoteRepository] Network error during sync:', error.message);
        
        // Increment retry count for all pending quotes on network error
        const updatedPending = pending.map(p => ({
            ...p,
            retryCount: (p.retryCount || 0) + 1
        })).filter(p => (p.retryCount || 0) < MAX_RETRIES);
        
        if (updatedPending.length < pending.length) {
            console.log(`[SupabaseQuoteRepository] Dropped ${pending.length - updatedPending.length} quotes exceeding max retries`);
        }
        
        if (updatedPending.length > 0) {
            await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, updatedPending);
        } else {
            await StorageService.removeItem(STORAGE_KEYS.PENDING_QUOTES);
        }
        
        this.isSyncing = false;
        return {
            syncedCount: 0,
            total: pending.length,
            errors: pending.map(p => ({
                quote: p,
                error: `Network error: ${error.message}`
            })),
            corrections: []
        };
    }
  }

  async getQuotes(userId?: string): Promise<Quote[]> {
    let timeoutId: any;
    // Try fetching from server first
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 10000);

        const headers = await this.getHeaders();
        const response = await fetch(this.API_URL!, {
            signal: controller.signal,
            headers
        });

        if (response.ok) {
            const serverQuotes = await response.json();
            const mappedQuotes: Quote[] = serverQuotes.map((q: any) => this.mapQuoteFromServer(q));

            // Add pending quotes that haven't been synced yet
            const pendingQuotes = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
            const pendingIds = new Set(pendingQuotes.map(p => p.id));
            
            // Find full pending quotes from current local cache to preserve book/author objects
            const currentLocalQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
            const pendingFullQuotes = currentLocalQuotes.filter(q => pendingIds.has(q.id as number));
            
            const finalQuotes = [...pendingFullQuotes, ...mappedQuotes];

            // Update local cache
            await StorageService.setItem(STORAGE_KEYS.QUOTES, finalQuotes);

            // Trigger sync of pending quotes in background (fire and forget)
            this.syncPendingQuotes().then(result => {
                if (result.syncedCount > 0) {
                    console.log(`[SupabaseQuoteRepository] Synced ${result.syncedCount} quotes in background`);
                    // Refresh quotes to get the updated list with server IDs
                    this.getQuotes().catch(err => console.log('Background refresh failed:', err));
                }
            }).catch(err => {
                console.log('[SupabaseQuoteRepository] Background sync failed, will retry later:', err.message);
            });

            return mappedQuotes;
        }
    } catch (error) {
        console.log('Server unreachable, using local storage:', error);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }

    // Fallback to local storage (offline mode)
    await delay(500);
    await this.seedDataIfNeeded();
    const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);

    // Ensure all legacy quotes have a user
    const safeQuotes = (quotes || []).map(q => ({
        ...q,
        user: q.user || { id: "1", name: "Clément QLF", username: "@clementqlf" }
    }));

    return safeQuotes;
  }

  async getQuoteById(id: number): Promise<Quote | null> {
    try {
        const headers = await this.getHeaders();
        const response = await fetch(`${this.API_URL}/${id}`, { headers });
        if (response.ok) {
            const q = await response.json();
            const mappedQuote = this.mapQuoteFromServer(q);

            // Update this quote in local cache
            const currentQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
            const updatedQuotes = currentQuotes.map(cq => cq.id === id ? mappedQuote : cq);
            await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);

            return mappedQuote;
        }
    } catch (error) {
        console.log('Error fetching quote by ID, using local fallback:', error);
    }

    await delay(300);
    const quotes = await this.getQuotes();
    return quotes.find(q => q.id === id) || null;
  }

  async getUserQuotes(userId: string): Promise<Quote[]> {
    const quotes = await this.getQuotes();
    return quotes.filter(q => q.user?.id === userId);
  }

  /**
   * Crée une citation et gère la logique de synchronisation offline/online.
   * Si l'appareil est hors-ligne, la citation est mise en attente (StorageService).
   * Si en ligne, tente une synchronisation directe avec Inventaire via /sync-quotes.
   * @param text {string} Contenu de la citation
   * @param book {string} Titre optionnel du livre
   * @param author {string} Nom optionnel de l'auteur
   */
  async createQuote(text: string, book?: string | null, author?: string | null): Promise<Quote> {
    const tempId = Date.now();
    const createdAt = new Date().toISOString();
    const user = await authService.getUser();
    
    const cleanBook = book && book.trim() !== '' && book.trim() !== 'Livre inconnu' ? book.trim() : null;
    const cleanAuthor = author && author.trim() !== '' && author.trim() !== 'Auteur inconnu' ? author.trim() : null;
    
    // Check connection
    const isOnline = await this.checkConnection();
    
    let finalBook: any = cleanBook;
    let finalAuthor: any = cleanAuthor;
    let wasSynced = false;
    let syncCorrections: any = undefined;

    if ((cleanBook || cleanAuthor) && user && isOnline) {
      try {
        const headers = await this.getHeaders();
        const SYNC_URL = `${httpClient['buildUrl']('')}/sync-quotes`;
        
        // Use sync-quotes endpoint for matching
        const response = await fetch(SYNC_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                offlineQuotes: [{
                    id: String(tempId),
                    text,
                    author: cleanAuthor,
                    book: cleanBook,
                    theme: undefined,
                    createdAt,
                    userId: user.id
                }]
            }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[SupabaseQuoteRepository] Direct sync response:`, JSON.stringify(result));
            console.log(`[SupabaseQuoteRepository] Direct sync successful: ${result.syncedCount} synced`);
            
            // If no quotes were synced, treat as failure
            if (result.syncedCount === 0) {
                console.error('[SupabaseQuoteRepository] Direct sync returned syncedCount: 0, falling back to pending queue');
                throw new Error('Server returned syncedCount: 0');
            }
            
            // Handle corrections from server
            const corrections = result.corrections || [];
            const syncDetails = result.syncDetails || [];
            
            // Get corrected values and IDs
            const correction = corrections[0]; // First (and only) quote in the array
            const detail = syncDetails[0]; // First (and only) sync detail
            
            // Wait a short delay to ensure the transaction is committed on the server
            await delay(500);
            
            // Try to fetch the full book and author objects if we have IDs
            let fullBook: any = correction?.matchedBook || cleanBook;
            let fullAuthor: any = correction?.matchedAuthor || cleanAuthor;
            
            const REST_BASE_URL = httpClient['buildUrl']('').replace('/functions/v1', '/rest/v1');
            
            if (detail?.bookId) {
                try {
                    const response = await httpClient.get<any[]>(`${REST_BASE_URL}/Book`, { 
                        params: { select: '*', id: `eq.${detail.bookId}` } 
                    });
                    if (response && response.length > 0) {
                        fullBook = response[0];
                        console.log(`[SupabaseQuoteRepository] Loaded full book data for ID ${detail.bookId}`);
                    }
                } catch (err) {
                    console.error(`[SupabaseQuoteRepository] Failed to load book ${detail.bookId}:`, err);
                }
            }
            
            if (detail?.authorId) {
                try {
                    const response = await httpClient.get<any[]>(`${REST_BASE_URL}/Author`, { 
                        params: { select: '*', id: `eq.${detail.authorId}` } 
                    });
                    if (response && response.length > 0) {
                        fullAuthor = response[0];
                        console.log(`[SupabaseQuoteRepository] Loaded full author data for ID ${detail.authorId}`);
                    }
                } catch (err) {
                    console.error(`[SupabaseQuoteRepository] Failed to load author ${detail.authorId}:`, err);
                }
            }
            
            finalBook = fullBook;
            finalAuthor = fullAuthor;
            wasSynced = true;
            syncCorrections = {
                author: correction?.originalAuthor && correction?.matchedAuthor && 
                    correction.originalAuthor !== correction.matchedAuthor ?
                    { original: correction.originalAuthor, matched: correction.matchedAuthor } : undefined,
                book: correction?.originalBook && correction?.matchedBook && 
                    correction.originalBook !== correction.matchedBook ?
                    { original: correction.originalBook, matched: correction.matchedBook } : undefined,
            };
        }
      } catch (error) {
        console.error('[SupabaseQuoteRepository] Direct sync network error, falling back to pending queue:', error);
      }
    } else {
        console.log('[SupabaseQuoteRepository] Skipping direct sync, adding to pending queue. Reason:', 
            !cleanBook && !cleanAuthor ? 'no book/author' : 
            !user ? 'no user' : 
            !isOnline ? 'offline' : 'unknown');
    }
    
    // Fallback: Add to pending queue (for offline or errors)
    if (!wasSynced) {
        console.log('[SupabaseQuoteRepository] Adding to pending queue...');
        await this.addToPendingQueue(tempId, text, cleanBook, cleanAuthor, createdAt);
        console.log('[SupabaseQuoteRepository] Added to pending queue successfully');
    }
    
    // Update local cache optimistically
    await delay(100);
    const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const newQuote: Quote = {
        id: tempId, // Temp ID
        text,
        book: finalBook || cleanBook,
        author: finalAuthor || cleanAuthor,
        theme: undefined,
        likesCount: 0,
        likes: [],
        isLiked: false,
        date: createdAt,
        isSaved: false,
        comments: 0,
        blockData: {},
        user: user || { id: "1", name: "Clément QLF", username: "@clementqlf" },
        ...(wasSynced ? { wasSynced: true, syncedAt: createdAt, syncCorrections } : {})
    };
    const updatedQuotes = [newQuote, ...quotes];
    await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);
    
    return newQuote;
  }

  async updateQuote(id: number, updates: Partial<Quote>): Promise<Quote> {
    // Maintain local cache update for offline/responsiveness
    const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const quoteIndex = quotes.findIndex(q => q.id === id);
    
    if (quoteIndex > -1) {
        quotes[quoteIndex] = { ...quotes[quoteIndex], ...updates };
        await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
    }

    // Prefer names for author and book in the payload to match backend "find or create" logic
    const payload: any = { ...updates };
    if (updates.author) {
        payload.author = typeof updates.author === 'string' ? updates.author : (updates.author as any).name;
    }
    if (updates.book) {
        payload.book = typeof updates.book === 'string' ? updates.book : (updates.book as any).title;
    }

    try {
        console.log(`Updating quote ${id} on server...`, payload);
        const headers = await this.getHeaders();
        const response = await fetch(`${this.API_URL}/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            console.log('Quote updated on server successfully');
        } else {
            console.error('Failed to update quote on server:', await response.text());
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (error) {
        console.error('Network error updating quote:', error);
        // Add to offline queue
        await OperationQueue.getInstance().enqueue({
            type: 'UPDATE',
            entityType: 'quote',
            entityId: id,
            payload,
        });
    }
    
    // Return the updated quote
    const updatedQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const updatedQuote = updatedQuotes.find(q => q.id === id);
    if (!updatedQuote) {
        throw new Error(`Quote with id ${id} not found after update`);
    }
    return updatedQuote;
  }

  async deleteQuote(id: number): Promise<void> {
    // Optimistic local delete
    const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const newQuotes = quotes.filter(q => q.id !== id);
    await StorageService.setItem(STORAGE_KEYS.QUOTES, newQuotes);

    try {
        console.log('Deleting quote on server:', id);
        const headers = await this.getHeaders();
        const response = await fetch(`${this.API_URL}/${id}`, {
            method: 'DELETE',
            headers
        });

        if (response.ok) {
            console.log('Quote deleted on server');
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (error) {
        console.error('Network error deleting quote:', error);
        // Add to offline queue
        await OperationQueue.getInstance().enqueue({
            type: 'DELETE',
            entityType: 'quote',
            entityId: id,
        });
    }
  }

  async toggleLike(id: number): Promise<{ isLiked: boolean; likesCount: number }> {
    // 1. Déterminer l'état actuel pour savoir si on like ou unlike
    const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const quoteIndex = quotes.findIndex(q => q.id === id);
    const quote = quotes[quoteIndex];
    const newIsLiked = !(quote?.isLiked);

    // 2. Mise à jour optimiste locale
    if (quote) {
        quote.isLiked = newIsLiked;
        quote.likesCount += newIsLiked ? 1 : -1;
        quotes[quoteIndex] = quote;
        await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
    }

    // 3. Tenter l'appel serveur
    try {
        const headers = await this.getHeaders();
        const response = await fetch(`${this.API_URL}/${id}/like`, {
            method: 'POST',
            headers
        });
        if (response.ok) {
            const data = await response.json();
            return data.isLiked;
        }
        throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        console.error('Error toggling like:', e);
        // 4. En cas d'échec, ajouter à la queue offline
        await OperationQueue.getInstance().enqueue({
            type: newIsLiked ? 'LIKE' : 'UNLIKE',
            entityType: 'quote',
            entityId: id,
        });
        return { isLiked: newIsLiked, likesCount: quote?.likesCount || 0 };
    }
  }

  async toggleSave(id: number): Promise<{ isSaved: boolean }> {
    const quotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const quoteIndex = quotes.findIndex(q => q.id === id);
    const quote = quotes[quoteIndex];
    const newIsSaved = !(quote?.isSaved);

    if (quote) {
        quote.isSaved = newIsSaved;
        quotes[quoteIndex] = quote;
        await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
    }

    try {
        const headers = await this.getHeaders();
        const response = await fetch(`${this.API_URL}/${id}/toggle-save`, {
            method: 'POST',
            headers
        });
        if (response.ok) {
            const data = await response.json();
            return { isSaved: data.isSaved };
        }
        throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        console.error('Error toggling save:', e);
        await OperationQueue.getInstance().enqueue({
            type: newIsSaved ? 'SAVE' : 'UNSAVE',
            entityType: 'quote',
            entityId: id,
        });
        return { isSaved: newIsSaved };
    }
  }

  async analyzeQuote(id: number): Promise<Quote> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.API_URL}/${id}/analyze`, {
        method: 'POST',
        headers
    });
    if (!response.ok) {
        throw new Error(`Failed to analyze quote: ${await response.text()}`);
    }
    const q = await response.json();
    const mappedQuote = this.mapQuoteFromServer(q);

    // Update local cache
    const currentQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
    const updatedQuotes = currentQuotes.map(cq => cq.id === id ? mappedQuote : cq);
    await StorageService.setItem(STORAGE_KEYS.QUOTES, updatedQuotes);

    return mappedQuote;
  }

  async chatWithAI(id: number, messages: { role: 'user' | 'model'; content: string }[]): Promise<string> {
    try {
        console.log(`[SupabaseQuoteRepository] Sending message to AI for quote ${id}...`);
        const headers = await this.getHeaders();
        const response = await fetch(`${this.API_URL}/${id}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ messages })
        });
        if (response.ok) {
            const data = await response.json();
            return data.response;
        } else {
            console.warn(`Server returned error: ${response.status}. Using fallback response.`);
        }
    } catch (error) {
        console.warn('[SupabaseQuoteRepository] Network error chatting with AI, using fallback:', error);
    }

    // Rich offline fallback
    await delay(1200);
    const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    if (lastUserMessage.includes('thème') || lastUserMessage.includes('theme') || lastUserMessage.includes('sujet')) {
        return "Cette citation aborde en profondeur des thèmes universels tels que la condition humaine, le passage du temps et la recherche de sens. L'auteur y exprime une dualité touchante entre l'idéalisme et la dure réalité de son époque.";
    }
    if (lastUserMessage.includes('contexte') || lastUserMessage.includes('époque') || lastUserMessage.includes('quand') || lastUserMessage.includes('histoire')) {
        return "L'œuvre a été écrite dans une période de grands bouleversements intellectuels et sociaux. L'auteur a cherché à travers ces lignes à capturer les tensions invisibles de sa génération, ce qui donne à la citation cette résonance historique unique.";
    }
    if (lastUserMessage.includes('style') || lastUserMessage.includes('écriture') || lastUserMessage.includes('métaphore') || lastUserMessage.includes('figures')) {
        return "Le style est caractérisé par un équilibre remarquable entre lyrisme poétique et précision philosophique. L'utilisation d'antithèses et de métaphores discrètes permet de condenser une pensée complexe en une formule percutante et mémorable.";
    }
    if (lastUserMessage.includes('pourquoi') || lastUserMessage.includes('sens') || lastUserMessage.includes('signifie')) {
        return "À un niveau plus profond, cette phrase remet en question nos certitudes quotidiennes. Elle nous invite à suspendre notre jugement et à contempler l'ironie délicate des relations humaines et de notre propre existence.";
    }

    return "C'est une excellente question. Cette formulation recèle en effet plusieurs niveaux de lecture. En la replaçant dans l'ensemble de l'œuvre, on comprend que l'auteur cherche avant tout à susciter une réflexion intime chez le lecteur plutôt qu'à imposer une vérité absolue.";
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
        const cleanUsername = username.replace('@', '');
        const user = await httpClient.get<User>(`/users/${cleanUsername}`);
        return user;
    } catch (e) {
        console.log('Error fetching user:', e);
        return undefined;
    }
  }

  /**
   * Get the count of pending quotes
   */
  async getPendingQuotesCount(): Promise<number> {
    const pending = await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES);
    return pending ? pending.length : 0;
  }

  /**
   * Get all pending quotes (for debugging/testing)
   */
  async getAllPendingQuotes(): Promise<PendingQuote[]> {
    return await StorageService.getItem<PendingQuote[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
  }

  /**
   * Clear all pending quotes (for testing/cleanup)
   */
  async clearPendingQuotes(): Promise<void> {
    await StorageService.removeItem(STORAGE_KEYS.PENDING_QUOTES);
  }
}
