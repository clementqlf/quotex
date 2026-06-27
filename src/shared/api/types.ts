import type { Author, CreateAuthorDto, Laureate, ReadingStatus } from '@/src/entities/author/model/Author';
import type { Book, BookImportPayload, CreateBookDto } from '@/src/entities/book/model/Book';
import type { CreateQuoteDto, Quote, UpdateQuoteDto } from '@/src/entities/quote/model/Quote';
import type { CreateUserDto, UpdateUserDto, User } from '@/src/entities/user/model/User';

export type {
  Author, Book, BookImportPayload, CreateAuthorDto, CreateBookDto, CreateQuoteDto, CreateUserDto, Laureate, Quote, ReadingStatus, UpdateQuoteDto, UpdateUserDto, User
};

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

export interface LiteraryPrizeLaureate {
  id: number;
  year: number;
  category?: string | null;
  prizeId: number;
  authorId?: number | null;
  bookId?: number | null;
  author?: Author | null;
  book?: Book | null;
}

export interface LiteraryPrize {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  inventaireUri?: string | null;
  wikipediaTitle?: string | null;
  inceptionYear?: number | null;
  founder?: string | null;
  laureates?: LiteraryPrizeLaureate[];
}
