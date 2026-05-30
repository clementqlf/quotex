/**
 * Domain Object: Book
 * Représente un livre dans le domaine métier
 */

import { ReadingStatus, Laureate } from '@/src/entities/author/model/Author';

// Type de base pour un livre
export interface Book {
  id?: number; // Identifiant unique (peut être undefined pour les livres non sauvegardés)
  title: string; // Titre du livre
  description: string; // Description
  year: number; // Année de publication
  pages: number; // Nombre de pages
  author: string | Author; // Auteur (peut être une string ou un objet)
  rating: number; // Note
  genre: string; // Genre littéraire
  cover: string; // URL de la couverture
  buyLinks?: Array<{ store: string; url: string; price: string }>; // Liens d'achat
  similarBooks?: Book[]; // Livres similaires
  isSaved?: boolean; // Est-ce que l'utilisateur a sauvegardé ce livre
  isEnriching?: boolean; // En cours d'enrichissement des données
  readingStatus?: ReadingStatus | null; // Statut de lecture
  inventaireUri?: string; // URI Inventaire (pour les données françaises)
  openLibraryId?: string; // Identifiant Open Library
  googleId?: string; // Identifiant Google Books
  isbn?: string; // ISBN du livre
  laureates?: Laureate[]; // Prix littéraires reçus
  lastEnrichedAt?: string; // Date du dernier enrichissement
}

// DTO pour créer un livre
export interface CreateBookDto {
  title: string;
  description?: string;
  year?: number;
  pages?: number;
  author?: string | Author;
  rating?: number;
  genre?: string;
  cover?: string;
  isbn?: string;
  openLibraryId?: string;
  googleId?: string;
  inventaireUri?: string;
}

// DTO pour importer un livre (avec données complètes)
export interface BookImportPayload extends CreateBookDto {
  buyLinks?: Array<{ store: string; url: string; price: string }>;
  similarBooks?: Book[];
  readingStatus?: ReadingStatus | null;
}

// Fabrique pour créer des objets Book
export class BookFactory {
  static create(dto: CreateBookDto & { id: number }): Book {
    return {
      id: dto.id,
      title: dto.title,
      description: dto.description || '',
      year: dto.year || 0,
      pages: dto.pages || 0,
      author: dto.author || '',
      rating: dto.rating || 0,
      genre: dto.genre || '',
      cover: dto.cover || '',
      isbn: dto.isbn,
      openLibraryId: dto.openLibraryId,
      googleId: dto.googleId,
      inventaireUri: dto.inventaireUri,
      isSaved: false,
      readingStatus: null,
    };
  }

  static createFromServer(data: any): Book {
    return {
      ...data,
      title: data.title || 'Livre inconnu',
      description: data.description || '',
      year: data.year || 0,
      pages: data.pages || 0,
      author: data.author || '',
      rating: data.rating || 0,
      genre: data.genre || '',
      cover: data.cover || '',
    };
  }
}
