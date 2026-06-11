import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import { Author, Book } from '@/src/shared/api/types';
import { authorService } from '../api/AuthorService';
import { IAuthorRepository } from './IAuthorRepository';

/**
 * Implémentation du Repository Author avec Supabase
 */
export class SupabaseAuthorRepository implements IAuthorRepository {
  private static instance: SupabaseAuthorRepository | null = null;
  
  public static getInstance(): SupabaseAuthorRepository {
    if (!SupabaseAuthorRepository.instance) {
      SupabaseAuthorRepository.instance = new SupabaseAuthorRepository();
    }
    return SupabaseAuthorRepository.instance;
  }

  constructor() {}

  async getAuthors(): Promise<Author[]> {
    return await authorService.getAuthors();
  }

  async getAuthorById(id: number): Promise<Author | undefined> {
    return await authorService.getAuthorById(id);
  }

  async getAuthorByName(name: string): Promise<Author | undefined> {
    return await authorService.getAuthorByName(name);
  }

  async getBooks(): Promise<Book[]> {
    return await authorService.getBooks();
  }

  async getBooksByAuthor(authorName: string, authorId?: number): Promise<Book[]> {
    return await authorService.getBooksByAuthor(authorName, authorId);
  }

  async getBookByTitle(title: string): Promise<Book | undefined> {
    const book = await authorService.getBookByTitle(title);
    if (book) {
      const books = await this.getBooks();
      const existing = books.find(b => b.id === book.id);
      if (existing && JSON.stringify(existing) === JSON.stringify(book)) {
        return existing;
      }
      const updated = books.map(b => b.id === book.id ? { ...b, ...book } : b);
      if (!existing) {
        updated.push(book);
      }
      await StorageService.setItem(STORAGE_KEYS.BOOKS, updated);
      return book;
    }
    return undefined;
  }

  async getBookById(id: number): Promise<Book | undefined> {
    const book = await authorService.getBookById(id);
    if (book) {
      const books = await this.getBooks();
      const existing = books.find(b => b.id === id);
      if (existing && JSON.stringify(existing) === JSON.stringify(book)) {
        return existing;
      }
      const updated = books.map(b => b.id === id ? { ...b, ...book } : b);
      if (!existing) {
        updated.push(book);
      }
      await StorageService.setItem(STORAGE_KEYS.BOOKS, updated);
      return book;
    }
    return undefined;
  }

  async getBookByInventaireUri(inventaireUri: string): Promise<Book | undefined> {
    const book = await authorService.getBookByInventaireUri(inventaireUri);
    if (book) {
      const books = await this.getBooks();
      const existing = books.find(b => b.id === book.id);
      if (existing && JSON.stringify(existing) === JSON.stringify(book)) {
        return existing;
      }
      const updated = books.map(b => b.id === book.id ? { ...b, ...book } : b);
      if (!existing) {
        updated.push(book);
      }
      await StorageService.setItem(STORAGE_KEYS.BOOKS, updated);
      return book;
    }
    return undefined;
  }

  async toggleSaveAuthor(id: number): Promise<{ isSaved: boolean; followersCount: number } | null> {
    const res = await authorService.toggleSaveAuthor(id);
    await this.refreshAuthors();
    return res;
  }

  async toggleSaveBook(id: number): Promise<void> {
    await authorService.toggleSaveBook(id);
    await this.refreshBooks();
  }

  async updateBookStatus(id: number, status: string): Promise<void> {
    await authorService.updateBookStatus(id, status);
    await this.refreshBooks();
  }

  async getNotableWorks(authorId: number): Promise<Book[]> {
    return await authorService.getNotableWorks(authorId);
  }

  async importBook(bookData: any): Promise<Book | undefined> {
    const book = await authorService.importBook(bookData);
    if (book) {
      const books = await this.getBooks();
      const existing = books.find(b => b.id === book.id);
      if (existing && JSON.stringify(existing) === JSON.stringify(book)) {
        return existing;
      }
      const updated = books.map(b => b.id === book.id ? { ...b, ...book } : b);
      if (!existing) {
        updated.push(book);
      }
      await StorageService.setItem(STORAGE_KEYS.BOOKS, updated);
      return book;
    }
    return undefined;
  }

  private async refreshAuthors(): Promise<void> {
    const authors = await authorService.getAuthors();
    await StorageService.setItem(STORAGE_KEYS.AUTHORS, authors);
  }

  private async refreshBooks(): Promise<void> {
    const books = await authorService.getBooks();
    await StorageService.setItem(STORAGE_KEYS.BOOKS, books);
  }
}
