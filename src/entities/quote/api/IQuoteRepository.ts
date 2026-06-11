import { Quote, User } from '@/src/shared/api/types';

/**
 * Interface du Repository pour les Quotes
 * Découple la logique domaine de l'implémentation technique (Supabase, etc.)
 */
export interface IQuoteRepository {
  // CRUD
  /**
   * Récupère la liste des citations.
   * @param userId {string} (Optionnel) Filtrer par ID utilisateur.
   * @returns {Promise<Quote[]>} Un tableau de citations.
   */
  getQuotes(userId?: string): Promise<Quote[]>;

  /**
   * Récupère une citation par son ID.
   * @param id {number} L'ID de la citation.
   * @returns {Promise<Quote | null>} La citation ou null si introuvable.
   */
  getQuoteById(id: number): Promise<Quote | null>;

  /**
   * Crée une nouvelle citation.
   * @offline_support OUI - Utilise la file d'attente optimiste si le réseau est indisponible.
   * @cache_invalidation Invalide la clé React Query ['quotes'] au succès.
   * @param text {string} Le contenu scanné ou saisi.
   * @param book {string | null} Le titre du livre.
   * @param author {string | null} L'auteur.
   * @returns {Promise<Quote>} La citation créée (avec un tempId si offline).
   */
  createQuote(text: string, book?: string | null, author?: string | null): Promise<Quote>;

  /**
   * Met à jour une citation existante.
   * @param id {number} L'ID de la citation.
   * @param updates {Partial<Quote>} Les modifications à apporter.
   * @returns {Promise<Quote>} La citation mise à jour.
   */
  updateQuote(id: number, updates: Partial<Quote>): Promise<Quote>;

  /**
   * Supprime une citation.
   * @param id {number} L'ID de la citation à supprimer.
   */
  deleteQuote(id: number): Promise<void>;
  
  // Actions spécifiques
  /**
   * Bascule l'état 'Like' d'une citation.
   * @param id {number} L'ID de la citation.
   */
  toggleLike(id: number): Promise<{ isLiked: boolean; likesCount: number }>;

  /**
   * Bascule l'état 'Sauvegardé' (Favori) d'une citation.
   * @param id {number} L'ID de la citation.
   */
  toggleSave(id: number): Promise<{ isSaved: boolean }>;
  
  // Recherche
  /**
   * Récupère les citations d'un utilisateur spécifique.
   */
  getUserQuotes(userId: string): Promise<Quote[]>;

  /**
   * Recherche un utilisateur par son @username.
   */
  getUserByUsername(username: string): Promise<User | undefined>;
}
