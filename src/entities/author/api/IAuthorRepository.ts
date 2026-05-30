import { Author, Book } from '@/src/shared/api/types';

/**
 * Interface du Repository pour les Authors
 */
export interface IAuthorRepository {
  // CRUD
  getAuthors(): Promise<Author[]>;
  getAuthorById(id: number): Promise<Author | undefined>;
  getAuthorByName(name: string): Promise<Author | undefined>;
  
  // Books
  getBooks(): Promise<Book[]>;
  getBooksByAuthor(authorName: string, authorId?: number): Promise<Book[]>;
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
