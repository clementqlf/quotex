import { z } from 'zod';
import { Quote, User } from '@/src/shared/api/types';
import { IQuoteRepository } from './IQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

import { httpClient } from '@/src/shared/api/HttpClient';
import { authService } from '@/src/entities/user/api/AuthService';
import { localQuotesDB, globalQuotesDB } from '@/src/shared/api/staticData';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';
import { safeFetch, trackExternalError, ErrorSeverity } from '@/src/shared/lib/resilience/networkResilience';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve as () => void, ms));

// Timeout configuration for AI requests
const AI_TIMEOUT_MS = 15000;
const MAX_AI_MESSAGES = 20;

// Zod schema for AI response validation
const AIResponseSchema = z.object({
  response: z.string().min(1).max(10000),
});

// Sanitization helper to prevent XSS
const sanitizeString = (input: string | undefined | null): string => {
  if (!input || typeof input !== 'string') return '';
  // Remove potentially dangerous characters
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
};


/**
 * Implémentation du Repository Quote avec Supabase
 * Cette classe implique IQuoteRepository avec l'API Supabase
 * Elle gère à la fois les appels HTTP, le cache local, et la synchronisation offline
 */
export class SupabaseQuoteRepository implements IQuoteRepository {
  private static instance: SupabaseQuoteRepository | null = null;
  
  // Singleton pattern pour éviter multiples instances
  public static getInstance(): SupabaseQuoteRepository {
    if (!SupabaseQuoteRepository.instance) {
      SupabaseQuoteRepository.instance = new SupabaseQuoteRepository();
    }
    return SupabaseQuoteRepository.instance;
  }

  constructor() {}

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

            // Preserve local pending quotes
            const currentLocalQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES) || [];
            const pendingFullQuotes = currentLocalQuotes.filter(q => q._isPending === true);
            
            const finalQuotes = [...pendingFullQuotes, ...mappedQuotes];

            // Update local cache
            await StorageService.setItem(STORAGE_KEYS.QUOTES, finalQuotes);

            return finalQuotes;
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
   * Crée une citation sur le serveur via /sync-quotes.
   * L'application appelante (QuoteUseCases) gère la file d'attente hors-ligne.
   * @param text {string} Contenu de la citation
   * @param book {string} Titre optionnel du livre
   * @param author {string} Nom optionnel de l'auteur
   */
  async createQuote(text: string, book?: string | null, author?: string | null): Promise<Quote> {
    const tempId = Date.now();
    const createdAt = new Date().toISOString();
    const user = await authService.getUser();
    
    if (!user) throw new Error("Utilisateur non connecté");
    
    const cleanBook = book && book.trim() !== '' && book.trim() !== 'Livre inconnu' ? book.trim() : null;
    const cleanAuthor = author && author.trim() !== '' && author.trim() !== 'Auteur inconnu' ? author.trim() : null;
    
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

    if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.syncedCount === 0) {
        throw new Error('Server returned syncedCount: 0');
    }
    
    // Handle corrections from server
    const corrections = result.corrections || [];
    const syncDetails = result.syncDetails || [];
    
    const correction = corrections[0];
    const detail = syncDetails[0];
    
    let finalBook: any = correction?.matchedBook || cleanBook;
    let finalAuthor: any = correction?.matchedAuthor || cleanAuthor;
    
    const REST_BASE_URL = httpClient['buildUrl']('').replace('/functions/v1', '/rest/v1');
    
    if (detail?.bookId) {
        try {
            const bookRes = await httpClient.get<any[]>(`${REST_BASE_URL}/Book`, { 
                params: { select: '*', id: `eq.${detail.bookId}` } 
            });
            if (bookRes && bookRes.length > 0) finalBook = bookRes[0];
        } catch (err) {
            console.error(`Failed to load book ${detail.bookId}:`, err);
        }
    }
    
    if (detail?.authorId) {
        try {
            const authorRes = await httpClient.get<any[]>(`${REST_BASE_URL}/Author`, { 
                params: { select: '*', id: `eq.${detail.authorId}` } 
            });
            if (authorRes && authorRes.length > 0) finalAuthor = authorRes[0];
        } catch (err) {
            console.error(`Failed to load author ${detail.authorId}:`, err);
        }
    }
    
    // Build sync corrections if any
    const syncCorrections: any = {};
    if (correction?.matchedAuthor && correction.matchedAuthor !== cleanAuthor) {
        syncCorrections.author = { original: cleanAuthor || '', matched: typeof finalAuthor === 'string' ? finalAuthor : (finalAuthor?.name || correction.matchedAuthor) };
    }
    if (correction?.matchedBook && correction.matchedBook !== cleanBook) {
        syncCorrections.book = { original: cleanBook || '', matched: typeof finalBook === 'string' ? finalBook : (finalBook?.title || correction.matchedBook) };
    }

    // Server doesn't return the full quote object from /sync-quotes, 
    // it returns syncedCount. So we construct the resulting quote:
    // (QuoteUseCases will just use the returned ID to update its local version)
    return {
        id: tempId, // In reality, we should fetch the real ID, but sync-quotes uses the offline ID (tempId)
        text,
        book: finalBook,
        author: finalAuthor,
        theme: undefined,
        likesCount: 0,
        likes: [],
        isLiked: false,
        user,
        date: createdAt,
        time: "A l'instant",
        isSaved: false,
        comments: 0,
        blockData: {},
        wasSynced: true,
        syncedAt: new Date().toISOString(),
        syncCorrections: Object.keys(syncCorrections).length > 0 ? syncCorrections : undefined,
    };
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
        payload.author = typeof updates.author === 'string' ? updates.author : updates.author.name;
    }
    if (updates.book) {
        payload.book = typeof updates.book === 'string' ? updates.book : updates.book.title;
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
    // Validate message count to prevent abuse
    if (messages.length > MAX_AI_MESSAGES) {
      throw new Error(`Too many messages for AI processing: ${messages.length} (max: ${MAX_AI_MESSAGES})`);
    }

    try {
        console.log(`[SupabaseQuoteRepository] Sending message to AI for quote ${id}...`);
        const headers = await this.getHeaders();
        
        const data = await safeFetch(`${this.API_URL}/${id}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ messages }),
            timeoutMs: AI_TIMEOUT_MS,
            maxRetries: 1,
            schema: AIResponseSchema,
            onError: (error, ctx) => {
                trackExternalError('Groq', error, {
                    ...ctx,
                    quoteId: id,
                    messageCount: messages.length
                }, ErrorSeverity.HIGH);
            }
        });
        
        return data.response;
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
            console.warn(`[SupabaseQuoteRepository] AI request timed out after ${AI_TIMEOUT_MS}ms. Using fallback.`);
        } else {
            console.warn('[SupabaseQuoteRepository] Network error chatting with AI, using fallback:', error?.message);
        }
    }

    // Rich offline fallback with XSS sanitization
    await delay(1200);
    const lastMessage = messages[messages.length - 1];
    const lastUserMessage = sanitizeString(lastMessage?.content).toLowerCase();

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
}
