import { Author, Book } from '../api/types';

export const getBookTitle = (book: string | Book | undefined | null): string => {
    if (!book) return 'Livre inconnu';
    if (typeof book === 'string') {
        const trimmed = book.trim();
        const low = trimmed.toLowerCase();
        if (trimmed === '' || low === 'null' || low === 'inconnu' || low === 'livre inconnu' || low.startsWith('unknown')) {
            return 'Livre inconnu';
        }
        return trimmed;
    }
    const title = book.title || '';
    const trimmedTitle = title.trim();
    const lowTitle = trimmedTitle.toLowerCase();
    if (trimmedTitle === '' || lowTitle === 'null' || lowTitle === 'inconnu' || lowTitle === 'livre inconnu' || lowTitle.startsWith('unknown')) {
        return 'Livre inconnu';
    }
    return trimmedTitle;
};

export const getAuthorName = (author: string | Author | undefined | null): string => {
    if (!author) return 'Auteur inconnu';
    if (typeof author === 'string') {
        const trimmed = author.trim();
        const low = trimmed.toLowerCase();
        if (trimmed === '' || low === 'null' || low === 'inconnu' || low === 'auteur inconnu' || low.startsWith('unknown')) {
            return 'Auteur inconnu';
        }
        return trimmed;
    }
    const name = author.name || '';
    const trimmedName = name.trim();
    const lowName = trimmedName.toLowerCase();
    if (trimmedName === '' || lowName === 'null' || lowName === 'inconnu' || lowName === 'auteur inconnu' || lowName.startsWith('unknown')) {
        return 'Auteur inconnu';
    }
    return trimmedName;
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

/**
 * Safely parse a JSON field that might be stringified
 * @param value - The value to parse (string, object, null, or undefined)
 * @returns Parsed value or null if parsing fails
 */
export const parseJsonField = <T>(value: string | T | undefined | null): T | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; }
    catch { return null; }
  }
  return value as T;
};

/**
 * Safely extracts an array from a BlockData object by blockId.
 * Guarantees a valid Array output even if the block data is missing, undefined, or not an array.
 */
export const getBlockDataArray = <T>(
  blockData?: Record<string, any> | null,
  blockId?: string | null
): T[] => {
  if (!blockId || !blockData) return [];
  const val = blockData[blockId];
  return Array.isArray(val) ? (val as T[]) : [];
};

/**
 * Computes dynamic font size and line height according to text length
 * so short quotes (or single words) fill space nicely and read prominently.
 */
/* eslint-disable @typescript-eslint/no-magic-numbers */
export const getDynamicQuoteFontSize = (text?: string, isModal: boolean = false) => {
  const len = text ? text.trim().length : 0;

  if (len <= 20) {
    // Single word / extremely short phrase (very large)
    return {
      fontSize: isModal ? 32 : 28,
      lineHeight: isModal ? 40 : 36,
    };
  } else if (len <= 50) {
    // Short quote
    return {
      fontSize: isModal ? 26 : 22,
      lineHeight: isModal ? 34 : 30,
    };
  } else if (len <= 120) {
    // Medium length quote
    return {
      fontSize: isModal ? 21 : 18,
      lineHeight: isModal ? 29 : 25,
    };
  } else if (len <= 250) {
    // Long quote
    return {
      fontSize: isModal ? 17 : 15,
      lineHeight: isModal ? 24 : 21,
    };
  } else {
    // Very long quote
    return {
      fontSize: isModal ? 15 : 13,
      lineHeight: isModal ? 21 : 18,
    };
  }
};



