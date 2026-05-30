/**
 * Domain Object: Author
 * Représente un auteur dans le domaine métier
 */



// Type ReadingStatus pour le statut de lecture
export type ReadingStatus = 'READ' | 'TO_READ' | 'READING' | 'DROPPED';

// Type pour un lauréat (prix littéraire)
export interface Laureate {
  id: number;
  name: string;
  year: number;
  prizeName: string;
  category?: string;
}

// Type de base pour un auteur
export interface Author {
  id?: number; // Identifiant unique (peut être undefined pour les auteurs non sauvegardés)
  name: string; // Nom de l'auteur
  description: string; // Description
  image: string; // URL de l'image
  birthDate: string; // Date de naissance
  nationality: string; // Nationalité
  similarAuthors?: Author[]; // Auteurs similaires
  openLibraryId?: string; // Identifiant Open Library
  inventaireUri?: string; // URI Inventaire (pour les données françaises)
  isSaved?: boolean; // Est-ce que l'utilisateur a sauvegardé cet auteur
  isEnriching?: boolean; // En cours d'enrichissement des données
  quotesCount?: number; // Nombre de citations
  followersCount?: number; // Nombre de followers
  laureates?: Laureate[]; // Prix littéraires reçus
}

// DTO pour créer un auteur
export interface CreateAuthorDto {
  name: string;
  description?: string;
  image?: string;
  birthDate?: string;
  nationality?: string;
  openLibraryId?: string;
  inventaireUri?: string;
}

// Fabrique pour créer des objets Author
export class AuthorFactory {
  static create(dto: CreateAuthorDto & { id: number }): Author {
    return {
      id: dto.id,
      name: dto.name,
      description: dto.description || '',
      image: dto.image || '',
      birthDate: dto.birthDate || '',
      nationality: dto.nationality || '',
      openLibraryId: dto.openLibraryId,
      inventaireUri: dto.inventaireUri,
      isSaved: false,
      quotesCount: 0,
      followersCount: 0,
    };
  }

  static createFromServer(data: any): Author {
    return {
      ...data,
      name: data.name || 'Auteur inconnu',
      description: data.description || '',
      image: data.image || '',
      birthDate: data.birthDate || '',
      nationality: data.nationality || '',
    };
  }
}
