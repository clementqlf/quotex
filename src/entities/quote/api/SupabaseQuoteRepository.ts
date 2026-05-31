import { Quote } from '@/src/shared/api/types';
import { IQuoteRepository } from './IQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

import { authService } from '@/src/entities/user/api/AuthService';
import { API_BASE_URL } from '@/src/shared/config/api';
import { supabase } from '@/src/shared/api/supabase';/**
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

  private async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${API_BASE_URL}/quotes`, {
        method: 'OPTIONS',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
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
        const headers = await this.getHeaders();
        const SYNC_URL = `${API_BASE_URL}/sync-quotes`;
        
        const response = await fetch(SYNC_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                offlineQuotes: [{
                    id: String(tempId),
                    text,
                    author,
                    book,
                    createdAt,
                    userId: user.id
                }]
            }),
        });

        if (response.ok) {
            const result = await response.json();
            if (result.syncedCount > 0) {
                const correction = (result.corrections || [])[0];
                const detail = (result.syncDetails || [])[0];
                
                finalBook = correction?.matchedBook || book;
                finalAuthor = correction?.matchedAuthor || author;
                
                // Fetch full objects if IDs are provided
                if (detail?.bookId) {
                    try {
                        const { data } = await supabase.from('Book').select('*').eq('id', detail.bookId).single();
                        if (data) finalBook = data;
                    } catch (e) {}
                }
                
                if (detail?.authorId) {
                    try {
                        const { data } = await supabase.from('Author').select('*').eq('id', detail.authorId).single();
                        if (data) finalAuthor = data;
                    } catch (e) {}
                }
                
                wasSynced = true;
                syncCorrections = {
                    author: correction?.originalAuthor && correction?.matchedAuthor && correction.originalAuthor !== correction.matchedAuthor ? { original: correction.originalAuthor, matched: correction.matchedAuthor } : undefined,
                    book: correction?.originalBook && correction?.matchedBook && correction.originalBook !== correction.matchedBook ? { original: correction.originalBook, matched: correction.matchedBook } : undefined,
                };
            }
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
    // À implémenter avec Supabase
    return null;
  }
}
