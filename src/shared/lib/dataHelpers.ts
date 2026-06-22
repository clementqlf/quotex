import { Author, Book } from '../api/types';

export const getBookTitle = (book: string | Book | undefined | null): string => {
    if (!book) return 'Livre inconnu';
    if (typeof book === 'string') return book;
    return book.title || 'Livre inconnu';
};

export const getAuthorName = (author: string | Author | undefined | null): string => {
    if (!author) return 'Auteur inconnu';
    if (typeof author === 'string') return author;
    return author.name || 'Auteur inconnu';
};

export const STATUS_OPTIONS = [
  { label: 'Lu', value: 'READ', color: '#10B981' },
  { label: 'À lire', value: 'TO_READ', color: '#3B82F6' },
  { label: 'En cours de lecture', value: 'READING', color: '#F59E0B' },
  { label: 'Pas fini', value: 'DROPPED', color: '#EF4444' },
];

export const getStatusLabel = (status?: string) => {
  const option = STATUS_OPTIONS.find(o => o.value === status);
  return option ? option.label : status || '';
};

export const getStatusColor = (status?: string) => {
  const option = STATUS_OPTIONS.find(o => o.value === status);
  return option ? option.color : '#9CA3AF';
};

/**
 * Utility to convert base64 to ArrayBuffer for Supabase Storage
 * Pure JS implementation to support Hermes and production builds without global atob.
 */
export const decodeBase64 = (base64: string): ArrayBuffer => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Remove potential data URI prefix and whitespace/newlines
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '').replace(/\s/g, '');

  let bufferLength = cleanBase64.length * 0.75;
  if (cleanBase64.endsWith('==')) {
    bufferLength -= 2;
  } else if (cleanBase64.endsWith('=')) {
    bufferLength -= 1;
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const encoded1 = lookup[cleanBase64.charCodeAt(i)] || 0;
    const encoded2 = lookup[cleanBase64.charCodeAt(i + 1)] || 0;
    const encoded3 = lookup[cleanBase64.charCodeAt(i + 2)] || 0;
    const encoded4 = lookup[cleanBase64.charCodeAt(i + 3)] || 0;

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }

  return arrayBuffer;
};

export const isUserQuote = (quote: any, currentUserId?: string | null): boolean => {
  return quote?.user?.id === currentUserId || !quote?.user || !!quote?.isSaved;
};


