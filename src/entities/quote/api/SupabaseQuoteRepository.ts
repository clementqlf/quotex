import { Quote } from '@/src/shared/api/types';
import { IQuoteRepository } from './IQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

import { httpClient } from '@/src/shared/api/HttpClient';
import { authService } from '@/src/entities/user/api/AuthService';

/**
 * Implémentation du Repository Quote avec Supabase
 * Cette classe implique IQuoteRepository avec l'API Supabase
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

  private async checkConnection(): Promise<boolean> {
    try {
      await httpClient.request('/quotes', { method: 'OPTIONS' });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async addToPendingQueue(tempId: number, text: string, book: string | null, author: string | null, createdAt: string) {
    const pending = await StorageService.getItem<any[]>(STORAGE_KEYS.PENDING_QUOTES) || [];
    
    const existingIndex = pending.findIndex(q => q.id === tempId);
    if (existingIndex > -1) {
        pending[existingIndex] = {
            id: tempId, text, book, author, createdAt,
            retryCount: (pending[existingIndex].retryCount || 0) + 1
        };
    } else {
        pending.push({ id: tempId, text, book, author, createdAt, retryCount: 0 });
    }
    
    await StorageService.setItem(STORAGE_KEYS.PENDING_QUOTES, pending);
  }

  async getQuotes(userId?: string): Promise<Quote[]> {
    // Essayer de récupérer depuis le cache d'abord
    const cachedQuotes = await StorageService.getItem<Quote[]>(STORAGE_KEYS.QUOTES);
    if (cachedQuotes) {
      return cachedQuotes;
    }
    
    // Sinon, récupérer depuis Supabase (à implémenter)
    // Pour l'instant, on retourne le cache ou un tableau vide
    return cachedQuotes || [];
  }

  async getQuoteById(id: number): Promise<Quote | null> {
    const quotes = await this.getQuotes();
    return quotes.find(q => q.id === id) || null;
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
    
    // Check connection
    const isOnline = await this.checkConnection();
    
    let finalBook: any = book || null;
    let finalAuthor: any = author || null;
    let wasSynced = false;
    let syncCorrections: any = undefined;

    if ((book || author) && user && isOnline) {
      try {
        const result = await httpClient.post<any>('/sync-quotes', {
            offlineQuotes: [{
                id: String(tempId),
                text,
                author,
                book,
                createdAt,
                userId: user.id
            }]
        });

        if (result && result.syncedCount > 0) {
            const correction = (result.corrections || [])[0];
            const detail = (result.syncDetails || [])[0];
            
            finalBook = correction?.matchedBook || book;
            finalAuthor = correction?.matchedAuthor || author;
            
            // Récupération des objets complets via l'API REST de Supabase avec HttpClient
            const REST_BASE_URL = httpClient['buildUrl']('').replace('/functions/v1', '/rest/v1');
            
            if (detail?.bookId) {
                try {
                    const data = await httpClient.get<any[]>(`${REST_BASE_URL}/Book`, { params: { select: '*', id: `eq.${detail.bookId}` } });
                    if (data && data.length > 0) finalBook = data[0];
                } catch (e) {}
            }
            
            if (detail?.authorId) {
                try {
                    const data = await httpClient.get<any[]>(`${REST_BASE_URL}/Author`, { params: { select: '*', id: `eq.${detail.authorId}` } });
                    if (data && data.length > 0) finalAuthor = data[0];
                } catch (e) {}
            }
            
            wasSynced = true;
            syncCorrections = {
                author: correction?.originalAuthor && correction?.matchedAuthor && correction.originalAuthor !== correction.matchedAuthor ? { original: correction.originalAuthor, matched: correction.matchedAuthor } : undefined,
                book: correction?.originalBook && correction?.matchedBook && correction.originalBook !== correction.matchedBook ? { original: correction.originalBook, matched: correction.matchedBook } : undefined,
            };
        }
      } catch (error) {
          console.error('[SupabaseQuoteRepository] Direct sync failed:', error);
      }
    }
    
    if (!wasSynced) {
        await this.addToPendingQueue(tempId, text, book || null, author || null, createdAt);
    }
    
    const newQuote: Quote = {
      id: tempId,
      text,
      book: finalBook,
      author: finalAuthor,
      likesCount: 0,
      isLiked: false,
      date: createdAt,
      isSaved: false,
      comments: 0,
      blockData: {},
      user: user || { id: "1", name: "Clément QLF", username: "@clementqlf" },
      ...(wasSynced ? { wasSynced: true, syncedAt: createdAt, syncCorrections } : {})
    };
    
    // Sauvegarder dans le cache
    const quotes = await this.getQuotes();
    await StorageService.setItem(STORAGE_KEYS.QUOTES, [newQuote, ...quotes]);
    
    return newQuote;
  }

  async updateQuote(id: number, updates: Partial<Quote>): Promise<Quote> {
    const quotes = await this.getQuotes();
    const index = quotes.findIndex(q => q.id === id);
    
    if (index === -1) {
      throw new Error(`Quote with id ${id} not found`);
    }
    
    const updatedQuote = { ...quotes[index], ...updates };
    quotes[index] = updatedQuote;
    await StorageService.setItem(STORAGE_KEYS.QUOTES, quotes);
    
    return updatedQuote;
  }

  async deleteQuote(id: number): Promise<void> {
    const quotes = await this.getQuotes();
    const filteredQuotes = quotes.filter(q => q.id !== id);
    await StorageService.setItem(STORAGE_KEYS.QUOTES, filteredQuotes);
  }

  async toggleLike(id: number): Promise<{ isLiked: boolean; likesCount: number }> {
    const quotes = await this.getQuotes();
    const quote = quotes.find(q => q.id === id);
    
    if (!quote) {
      throw new Error(`Quote with id ${id} not found`);
    }
    
    const isLiked = !quote.isLiked;
    const likesCount = isLiked ? quote.likesCount + 1 : quote.likesCount - 1;
    
    await this.updateQuote(id, { isLiked, likesCount });
    
    return { isLiked, likesCount };
  }

  async toggleSave(id: number): Promise<{ isSaved: boolean }> {
    const quotes = await this.getQuotes();
    const quote = quotes.find(q => q.id === id);
    
    if (!quote) {
      throw new Error(`Quote with id ${id} not found`);
    }
    
    const isSaved = !quote.isSaved;
    await this.updateQuote(id, { isSaved });
    
    return { isSaved };
  }

  async getUserQuotes(userId: string): Promise<Quote[]> {
    const quotes = await this.getQuotes();
    return quotes.filter(q => q.user?.id === userId);
  }

  async getUserByUsername(username: string): Promise<any> {
    try {
      const cleanUsername = username.replace('@', '');
      return await httpClient.get<any>(`/users/${cleanUsername}`);
    } catch (e) {
      console.log('Error fetching user:', e);
      return null;
    }
  }
}
