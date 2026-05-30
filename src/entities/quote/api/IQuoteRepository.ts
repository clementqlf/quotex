import { Quote } from '@/src/shared/api/types';

/**
 * Interface du Repository pour les Quotes
 * Découple la logique domaine de l'implémentation technique (Supabase, etc.)
 */
export interface IQuoteRepository {
  // CRUD
  getQuotes(userId?: string): Promise<Quote[]>;
  getQuoteById(id: number): Promise<Quote | null>;
  createQuote(text: string, book?: string | null, author?: string | null): Promise<Quote>;
  updateQuote(id: number, updates: Partial<Quote>): Promise<Quote>;
  deleteQuote(id: number): Promise<void>;
  
  // Actions spécifiques
  toggleLike(id: number): Promise<{ isLiked: boolean; likesCount: number }>;
  toggleSave(id: number): Promise<{ isSaved: boolean }>;
  
  // Recherche
  getUserQuotes(userId: string): Promise<Quote[]>;
  getUserByUsername(username: string): Promise<any>;
}
