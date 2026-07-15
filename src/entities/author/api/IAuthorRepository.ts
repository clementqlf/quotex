import { Author, Book, ExternalBookResult } from '@/src/shared/api/types';

/**
 * Interface du Repository pour les Authors
 */
export interface IAuthorRepository {
  // CRUD
  getAuthors(): Promise<Author[]>;
  getAuthorById(id: number): Promise<Author | undefined>;
  getAuthorByName(name: string, inventaireUri?: string): Promise<Author | undefined>;
  
  // Books
  getBooks(): Promise<Book[]>;
  getBooksByAuthor(authorName: string, authorId?: number): Promise<Book[]>;
  getExternalBooksByAuthor(authorId: number): Promise<ExternalBookResult[]>;
  resolveGoogleBook(title: string, author?: string): Promise<ExternalBookResult | null>;
  getBookByTitle(title: string): Promise<Book | undefined>;
  getBookById(id: number): Promise<Book | undefined>;
  getBookByInventaireUri(inventaireUri: string): Promise<Book | undefined>;
  
  // Actions
  toggleSaveAuthor(id: number): Promise<{ isSaved: boolean; followersCount: number } | null>;
  toggleSaveBook(id: number): Promise<void>;
  updateBookStatus(id: number, status: string): Promise<void>;
  getNotableWorks(authorId: number): Promise<Book[]>;
  importBook(bookData: any): Promise<Book | undefined>;
}
