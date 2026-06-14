/**
 * Domain Object: Quote
 * Représente une citation dans le domaine métier
 * Découplé de l'implémentation technique (Supabase, etc.)
 */

import { Author } from '@/src/entities/author/model/Author';
import { Book } from '@/src/entities/book/model/Book';
import { User } from '@/src/entities/user/model/User';

// Type pour un like sur une citation
export interface QuoteLike {
  id: string;
  userId: string;
  quoteId: number;
  createdAt: string;
}

// Type pour les corrections de synchronisation
export interface SyncCorrection<T = string> {
  original: string;
  matched: T;
}

// Type pour les corrections de sync sur une quote
export interface QuoteSyncCorrections {
  author?: SyncCorrection<string>;
  book?: SyncCorrection<string>;
}

// Type pour les données de blocks personnalisés
export interface BlockData {
  customFields?: Record<string, string | number | boolean>;
  layout?: string[];
  theme?: string;
  tags?: string[];
  additionalThemes?: string[];
  chatHistory?: { role: 'user' | 'model'; content: string }[];
  // Autres champs personnalisés
  [key: string]: string | number | boolean | string[] | { role: string; content: string }[] | Record<string, unknown> | undefined;
}

// Type de base pour une citation
export interface Quote {
  id: number; // Identifiant unique
  text: string; // Texte de la citation
  book?: string | Book | null; // Livre associé (peut être une string ou un objet Book)
  author?: string | Author | null; // Auteur (peut être une string ou un objet Author)
  theme?: string; // Thème de la citation
  date?: string; // Date de création de la quote
  savedAt?: string | null; // Date où l'utilisateur a sauvegardé la quote (userquote.AddedAt)
  likesCount: number; // Nombre de likes
  likes?: QuoteLike[]; // Tableau de relations (pour Supabase)
  isLiked: boolean; // Est-ce que l'utilisateur courant a liké
  user?: User; // Utilisateur propriétaire (devrait être obligatoire)
  comments?: number; // Nombre de commentaires
  isSaved?: boolean; // Est-ce que l'utilisateur courant a sauvegardé
  time?: string; // Heure (pour compatibilité)
  notes?: string | null; // Notes personnelles
  blockData?: BlockData; // Données de blocks personnalisés
  aiInterpretation?: string | null; // Interprétation par IA
  
  // Champs de synchronisation
  wasSynced?: boolean; // A été synchronisé avec le serveur
  syncedAt?: string | null; // Date de dernière synchronisation
  syncCorrections?: QuoteSyncCorrections; // Corrections appliquées lors de la sync

  // Indicateurs offline-first
  _isPending?: boolean; // Indique si la citation est en attente de synchronisation
}

// DTO pour créer une citation
export interface CreateQuoteDto {
  text: string;
  book?: string | null;
  author?: string | null;
  theme?: string;
}

// DTO pour mettre à jour une citation
export interface UpdateQuoteDto extends Partial<CreateQuoteDto> {
  id: number;
}

// Fabrique pour créer des objets Quote
export class QuoteFactory {
  static create(dto: CreateQuoteDto & { id: number }): Quote {
    return {
      id: dto.id,
      text: dto.text,
      book: dto.book || null,
      author: dto.author || null,
      theme: dto.theme,
      date: new Date().toISOString(),
      likesCount: 0,
      isLiked: false,
      isSaved: false,
      comments: 0,
      blockData: {},
    };
  }

  static createFromServer(data: any): Quote {
    return {
      ...data,
      book: data.book || null,
      author: data.author || null,
      date: data.date || new Date().toISOString(),
      blockData: data.blockData || {},
    };
  }
}
