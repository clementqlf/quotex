/**
 * Domain Object: Quote
 * Représente une citation dans le domaine métier
 * Découplé de l'implémentation technique (Supabase, etc.)
 */

// Type de base pour une citation
export interface Quote {
  id: number; // Identifiant unique
  text: string; // Texte de la citation
  book?: string | Book | null; // Livre associé (peut être une string ou un objet)
  author?: string | Author | null; // Auteur (peut être une string ou un objet)
  theme?: string; // Thème de la citation
  date?: string; // Date de création
  likesCount: number; // Nombre de likes
  likes?: any[]; // Tableau de relations (pour Supabase)
  isLiked: boolean; // Est-ce que l'utilisateur courant a liké
  user?: User; // Utilisateur propriétaire
  comments?: number; // Nombre de commentaires
  isSaved?: boolean; // Est-ce que l'utilisateur courant a sauvegardé
  time?: string; // Heure (pour compatibilité)
  notes?: string; // Notes personnelles
  blockData?: Record<string, any>; // Données de blocks personnalisés
  aiInterpretation?: string; // Interprétation par IA
  
  // Champs de synchronisation
  wasSynced?: boolean; // A été synchronisé avec le serveur
  syncedAt?: string; // Date de dernière synchronisation
  syncCorrections?: {
    author?: { original: string; matched: string };
    book?: { original: string; matched: string };
  };
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
