import { Book } from '@/src/shared/api/types';

export type BookImportPayload = {
  title: string;
  authors?: string[];
  author?: string | { name?: string } | null;
  authorUris?: string[];
  description?: string;
  cover?: string;
  inventaireUri?: string;
  openLibraryId?: string;
  googleId?: string;
  isbn?: string;
  year?: number | null;
  pages?: number | null;
  genre?: string | null;
};

type RawBookData = Record<string, any> | string | null | undefined;

type BuildBookImportPayloadParams = {
  title?: string;
  cover?: string;
  bookData?: RawBookData;
  book?: Partial<Book> | null;
};

const parseBookData = (bookData: RawBookData): Record<string, any> | null => {
  if (!bookData) return null;

  if (typeof bookData === 'string') {
    try {
      const parsed = JSON.parse(bookData);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  return typeof bookData === 'object' ? bookData : null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
};

export const buildBookImportPayload = ({ title, cover, bookData, book }: BuildBookImportPayloadParams): BookImportPayload | null => {
  const parsed = parseBookData(bookData);
  const resolvedTitle = parsed?.label || parsed?.title || book?.title || title;

  if (!resolvedTitle) return null;

  const fallbackAuthorName = typeof book?.author === 'string'
    ? book.author
    : book?.author && typeof book.author === 'object' && 'name' in book.author
      ? book.author.name
      : undefined;

  const parsedAuthors = toStringArray(parsed?.authors);
  const fallbackAuthors = fallbackAuthorName ? [fallbackAuthorName] : [];

  // Don't send pages=0 to backend - send null to let SQL default handle it
  // Backend will use COALESCE or enrich from Inventaire
  const parsedPages = parsed?.pages;
  const bookPages = book?.pages;
  const pages = parsedPages !== undefined && parsedPages !== null && parsedPages > 0
    ? parsedPages
    : (bookPages !== undefined && bookPages !== null && bookPages > 0 ? bookPages : null);

  return {
    title: resolvedTitle,
    authors: parsedAuthors.length > 0 ? parsedAuthors : fallbackAuthors,
    author: book?.author ?? null,
    authorUris: toStringArray(parsed?.authorUris),
    description: parsed?.description ?? book?.description ?? '',
    cover: cover ?? parsed?.image ?? parsed?.cover ?? book?.cover ?? '',
    inventaireUri: parsed?.uri ?? parsed?.inventaireUri ?? book?.inventaireUri,
    openLibraryId: parsed?.openLibraryId ?? book?.openLibraryId,
    googleId: parsed?.googleId ?? book?.googleId,
    isbn: parsed?.isbn ?? book?.isbn,
    year: parsed?.year ?? book?.year,
    pages: pages,
    genre: parsed?.genre ?? book?.genre ?? null,
  };
};