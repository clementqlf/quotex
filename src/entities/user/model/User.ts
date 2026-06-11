/**
 * Domain Object: User
 * Représente un utilisateur dans le domaine métier
 */

// Type de base pour un utilisateur
export interface User {
  id: string; // UUID de Supabase Auth
  name?: string; // Nom complet
  username: string; // Nom d'utilisateur unique
  email?: string; // Email
  image?: string; // URL de l'image de profil
  bio?: string; // Biographie
  website?: string; // Site web
  followers?: number; // Nombre de followers
  following?: number; // Nombre de personnes suivies
}

// DTO pour créer un utilisateur
export interface CreateUserDto {
  username: string;
  email: string;
  name?: string;
  image?: string;
  bio?: string;
  website?: string;
}

// DTO pour mettre à jour un utilisateur
export interface UpdateUserDto extends Partial<CreateUserDto> {
  id: string;
}

// Type pour les données utilisateur du serveur (peut contenir des champs supplémentaires)
export interface ServerUserData {
  id: string;
  username?: string;
  email?: string;
  name?: string;
  image?: string;
  bio?: string;
  website?: string;
  followers?: number;
  following?: number;
  // Champs supplémentaires non typés - limités à string, number ou undefined
  [key: string]: string | number | undefined;
}

// Fabrique pour créer des objets User
export class UserFactory {
  static create(dto: CreateUserDto & { id: string }): User {
    return {
      id: dto.id,
      username: dto.username,
      email: dto.email,
      name: dto.name,
      image: dto.image,
      bio: dto.bio,
      website: dto.website,
      followers: 0,
      following: 0,
    };
  }

  static createFromServer(data: ServerUserData): User {
    return {
      id: data.id,
      username: data.username || '',
      email: data.email || '',
      name: data.name,
      image: data.image,
      bio: data.bio,
      website: data.website,
      followers: data.followers || 0,
      following: data.following || 0,
    };
  }
}
