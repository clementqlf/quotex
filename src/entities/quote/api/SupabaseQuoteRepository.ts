import { Quote } from '@/src/shared/api/types';
import { IQuoteRepository } from './IQuoteRepository';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

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
    const newQuote: Quote = {
      id: tempId,
      text,
      book: book || null,
      author: author || null,
      likesCount: 0,
      isLiked: false,
      date: new Date().toISOString(),
      isSaved: false,
      comments: 0,
      blockData: {},
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
