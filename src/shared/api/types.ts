// Re-exports des types depuis les entités pour compatibilité descendante
// Les types ont été déplacés vers leurs entités respectives (F-010)

// User
export type {
  User,
  CreateUserDto,
  UpdateUserDto,
} from '@/src/entities/user/model/User';

// Author
export type {
  Author,
  ReadingStatus,
  Laureate,
  CreateAuthorDto,
} from '@/src/entities/author/model/Author';

// Book
export type {
  Book,
  CreateBookDto,
  BookImportPayload,
} from '@/src/entities/book/model/Book';

// Quote
export type {
  Quote,
  CreateQuoteDto,
  UpdateQuoteDto,
} from '@/src/entities/quote/model/Quote';

// Autres types (Review, LiteraryPrize, etc.)
export interface Review {
  id: number;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: User;
  userId: string;
  bookId: number;
}

export interface LiteraryPrize {
  id: number;
  name: string;
  description?: string;
  image?: string;
  inventaireUri?: string;
  wikipediaTitle?: string;
}

// Export des DTOs pour compatibilité
export type { CreateQuoteDto, UpdateQuoteDto, BookImportPayload };
