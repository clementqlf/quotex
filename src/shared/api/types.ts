import type { User, CreateUserDto, UpdateUserDto } from '@/src/entities/user/model/User';
import type { Author, ReadingStatus, Laureate, CreateAuthorDto } from '@/src/entities/author/model/Author';
import type { Book, CreateBookDto, BookImportPayload } from '@/src/entities/book/model/Book';
import type { Quote, CreateQuoteDto, UpdateQuoteDto } from '@/src/entities/quote/model/Quote';

export type {
  User, CreateUserDto, UpdateUserDto,
  Author, ReadingStatus, Laureate, CreateAuthorDto,
  Book, CreateBookDto, BookImportPayload,
  Quote, CreateQuoteDto, UpdateQuoteDto
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
  category?: string;
  prizeId: number;
  authorId?: number;
  bookId?: number;
  author?: Author;
  book?: Book;
}

export interface LiteraryPrize {
  id: number;
  name: string;
  description?: string;
  image?: string;
  inventaireUri?: string;
  wikipediaTitle?: string;
  inceptionYear?: number;
  founder?: string;
  laureates?: LiteraryPrizeLaureate[];
}
